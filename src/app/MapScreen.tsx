/**
 * `#/map` — S2 별자리 자리.
 *
 * 별자리는 T008에서 만들고, 이 카드에서는 "준비 중" 안내와 활동 목록만 둔다.
 */
import { useEffect, useState } from 'react';
import { contentUnitIds, loadUnitContent } from '../core/runner';
import type { ContentActivity, UnitContent } from '../core/runner';
import { navigate } from './router';
import { mapStrings } from './strings.ko';
import { useStudentSession } from './useStudentSession';
import styles from './MapScreen.module.css';

interface ActivityEntry {
  readonly unitTitle: string;
  readonly activity: ContentActivity;
}

export function MapScreen() {
  const session = useStudentSession();
  const [entries, setEntries] = useState<ActivityEntry[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (session.phase === 'missing') navigate({ kind: 'home' });
  }, [session.phase]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const units: UnitContent[] = await Promise.all(
          contentUnitIds().map((unitId) => loadUnitContent(unitId)),
        );
        if (cancelled) return;
        setEntries(
          units.flatMap((unit) =>
            unit.activities.map((activity) => ({ unitTitle: unit.title, activity })),
          ),
        );
      } catch (reason) {
        console.warn('[app] 활동 목록을 불러오지 못했습니다.', reason);
        if (!cancelled) setError(true);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (session.phase === 'loading' || session.phase === 'missing') {
    return (
      <main className={styles.screen}>
        <p role="status">{mapStrings.loading}</p>
      </main>
    );
  }

  if (session.phase === 'error' || error) {
    return (
      <main className={styles.screen}>
        <p role="alert">{mapStrings.loadError}</p>
        <a className={styles.back} href="#/">
          {mapStrings.back}
        </a>
      </main>
    );
  }

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <a className={styles.brand} href="#/">
          MathExplorer
        </a>
        <span className={styles.learner}>{mapStrings.learnerLabel(session.learner)}</span>
      </header>

      <h1 className={styles.heading}>{mapStrings.heading}</h1>
      <p className={styles.soon} role="status">
        {mapStrings.constellationSoon}
      </p>

      <section className={styles.section} aria-labelledby="activities-heading">
        <h2 id="activities-heading" className={styles.sectionTitle}>
          {mapStrings.activitiesHeading}
        </h2>
        {entries === null ? (
          <p role="status">{mapStrings.loading}</p>
        ) : entries.length === 0 ? (
          <p className={styles.empty}>{mapStrings.empty}</p>
        ) : (
          <ul className={styles.list}>
            {entries.map((entry) => (
              <li key={entry.activity.id}>
                <a className={styles.activity} href={`#/activity/${entry.activity.id}`}>
                  <span className={styles.activityTitle}>{entry.activity.title}</span>
                  <span className={styles.unitTitle}>{entry.unitTitle}</span>
                  <span className={styles.count}>{entry.activity.tasks.length}개 과제</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
