/**
 * S1 시작 화면.
 *
 * 번호(1~30)를 고르고 관심사를 고르거나 건너뛴 뒤 활동 목록으로 간다.
 * 이름·사진·생년월일 입력란은 만들지 않는다. 학년도 화면에 쓰지 않는다.
 */
import { useEffect, useState } from 'react';
import { INTERESTS } from '../core/storage';
import type { Interest, Learner, LearnerId, Storage, StorageStatus } from '../core/storage';
import { getStorage } from '../core/storage';
import { InterestIcon } from './InterestIcon';
import { navigate } from './router';
import { readCurrentLearner, saveCurrentLearner, saveLearnerInterests } from './preferences';
import { interestLabels, startStrings } from './strings.ko';
import styles from './StartScreen.module.css';

const NUMBERS = Array.from({ length: 30 }, (_, index) => index + 1);

interface StartData {
  readonly storage: Storage;
  readonly status: StorageStatus;
  readonly current?: LearnerId;
  readonly learners: ReadonlyMap<LearnerId, Learner>;
}

export function StartScreen() {
  const [data, setData] = useState<StartData | null>(null);
  const [error, setError] = useState(false);
  const [pending, setPending] = useState<LearnerId | null>(null);
  const [selected, setSelected] = useState<readonly Interest[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const storage = await getStorage();
        const [status, current, learners] = await Promise.all([
          storage.status(),
          readCurrentLearner(storage),
          storage.listLearners(),
        ]);
        if (!cancelled) {
          setData({
            storage,
            status,
            ...(current ? { current } : {}),
            learners: new Map(learners.map((learner) => [learner.number, learner])),
          });
        }
      } catch (reason) {
        console.warn('[app] 학생 정보를 불러오지 못했습니다.', reason);
        if (!cancelled) setError(true);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const pickNumber = async (number: number) => {
    if (!data) return;
    const learner = String(number);
    setPending(learner);
    setSelected(data.learners.get(learner)?.interests ?? []);
    try {
      await saveCurrentLearner(data.storage, learner);
    } catch (reason) {
      console.warn('[app] 현재 학습자를 저장하지 못했습니다.', reason);
    }
  };

  const finish = async (interests: readonly Interest[]) => {
    if (!data || !pending || saving) return;
    setSaving(true);
    try {
      await saveLearnerInterests(data.storage, pending, interests);
    } catch (reason) {
      console.warn('[app] 관심사를 저장하지 못했습니다.', reason);
    } finally {
      setSaving(false);
      navigate({ kind: 'map' });
    }
  };

  if (error) {
    return (
      <main className={styles.screen}>
        <h1 className={styles.brand}>{startStrings.heading}</h1>
        <p role="alert">{startStrings.loadError}</p>
        <a className={styles.teacherLink} href="#/teacher">
          {startStrings.teacher}
        </a>
      </main>
    );
  }

  if (!data) {
    return (
      <main className={styles.screen}>
        <h1 className={styles.brand}>{startStrings.heading}</h1>
        <p role="status">{startStrings.loading}</p>
      </main>
    );
  }

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <h1 className={styles.productName}>MathExplorer</h1>
        <p className={styles.tagline}>손으로 만지며 수학 원리를 발견해요</p>
        {data.status.backend === 'memory' ? (
          <p className={styles.notice} role="status">
            {startStrings.memoryNotice}
          </p>
        ) : null}
      </header>

      {pending ? (
        <section className={styles.panel} aria-labelledby="interests-heading">
          <button
            type="button"
            className={styles.back}
            onClick={() => setPending(null)}
            disabled={saving}
          >
            {startStrings.backToNumbers}
          </button>
          <h2 id="interests-heading" className={styles.heading}>
            {startStrings.interestsHeading}
          </h2>
          <p className={styles.hint}>{startStrings.interestsHint}</p>

          <div className={styles.interestGrid}>
            {INTERESTS.map((interest) => {
              const pressed = selected.includes(interest);
              return (
                <button
                  key={interest}
                  type="button"
                  className={styles.interest}
                  aria-pressed={pressed}
                  onClick={() =>
                    setSelected((current) =>
                      current.includes(interest)
                        ? current.filter((value) => value !== interest)
                        : [...current, interest],
                    )
                  }
                >
                  <InterestIcon interest={interest} />
                  <span>{interestLabels[interest]}</span>
                </button>
              );
            })}
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.secondary}
              onClick={() => void finish([])}
              disabled={saving}
            >
              {startStrings.skip}
            </button>
            <button
              type="button"
              className={styles.primary}
              onClick={() => void finish(selected)}
              disabled={saving}
            >
              {startStrings.start}
            </button>
          </div>
        </section>
      ) : (
        <section className={styles.panel} aria-labelledby="number-heading">
          <h2 id="number-heading" className={styles.heading}>
            {startStrings.heading}
          </h2>
          <p className={styles.hint}>{startStrings.hint}</p>
          {data.current ? (
            <p className={styles.current}>{startStrings.currentLearner(data.current)}</p>
          ) : null}

          <div className={styles.numberGrid}>
            {NUMBERS.map((number) => {
              const id = String(number);
              return (
                <button
                  key={number}
                  type="button"
                  className={styles.number}
                  aria-label={startStrings.numberLabel(number)}
                  aria-pressed={data.current === id}
                  onClick={() => void pickNumber(number)}
                >
                  {number}
                </button>
              );
            })}
          </div>
        </section>
      )}

      <a className={styles.teacherLink} href="#/teacher">
        {startStrings.teacher}
      </a>
    </main>
  );
}
