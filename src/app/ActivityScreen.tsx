/**
 * `#/activity/<활동ID>` — S3 활동 화면.
 *
 * 단원 콘텐츠에서 해당 활동만 골라 `ActivityRunner`로 실행한다.
 * 상단 바에는 뒤로·제목·발문 읽기·설정만 둔다(도움 버튼은 T012 전까지 숨김).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadEngine } from '../core/engine-sdk';
import type { EngineId, LoadedEngine, TargetSize } from '../core/engine-sdk';
import { ActivityRunner, loadUnitContent } from '../core/runner';
import type { ContentActivity, ContentTask, UnitContent } from '../core/runner';
import { isLowerGradeUnit, readPreferences, savePreference } from './preferences';
import { navigate, unitIdOfActivity } from './router';
import { activityStrings } from './strings.ko';
import { useStudentSession } from './useStudentSession';
import { useTts } from './useTts';
import { useUserGesture } from './user-gesture';
import styles from './ActivityScreen.module.css';

interface LoadedActivity {
  readonly content: UnitContent;
  readonly activity: ContentActivity;
  readonly definitions: ReadonlyMap<EngineId, LoadedEngine>;
}

interface ActivityScreenProps {
  readonly activityId: string;
}

function SpeakerIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4 9h4l5-4v14l-5-4H4z" />
      <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />
    </svg>
  );
}

export function ActivityScreen({ activityId }: ActivityScreenProps) {
  const session = useStudentSession();
  const [loaded, setLoaded] = useState<LoadedActivity | null>(null);
  const [error, setError] = useState<'load' | 'notfound' | null>(null);
  const [currentTask, setCurrentTask] = useState<ContentTask | null>(null);
  const [autoRead, setAutoRead] = useState(false);
  const [largeTarget, setLargeTarget] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const { available: ttsAvailable, speak, cancel } = useTts();
  const gestureSeen = useUserGesture();

  const unitId = useMemo(() => unitIdOfActivity(activityId), [activityId]);

  useEffect(() => {
    if (session.phase === 'missing') navigate({ kind: 'home' });
  }, [session.phase]);

  useEffect(() => {
    if (session.phase !== 'ready') return;
    let cancelled = false;
    const load = async () => {
      try {
        const [content, preferences] = await Promise.all([
          loadUnitContent(unitId),
          readPreferences(session.storage),
        ]);
        const activity = content.activities.find((item) => item.id === activityId);
        if (!activity) {
          if (!cancelled) setError('notfound');
          return;
        }

        const engineIds = new Set<EngineId>();
        for (const task of activity.tasks) {
          engineIds.add(task.engine);
          for (const view of task.views ?? []) engineIds.add(view.engine);
        }
        const entries = await Promise.all(
          [...engineIds].map(async (id) => [id, await loadEngine(id)] as const),
        );
        if (cancelled) return;

        const lowerGrade = isLowerGradeUnit(unitId);
        setAutoRead(preferences.autoRead ?? lowerGrade);
        setLargeTarget(preferences.largeTarget ?? lowerGrade);
        setLoaded({ content, activity, definitions: new Map(entries) });
      } catch (reason) {
        console.warn('[app] 활동을 불러오지 못했습니다.', reason);
        if (!cancelled) setError('load');
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [session, unitId, activityId]);

  const onTaskChange = useCallback((task: ContentTask) => {
    setCurrentTask(task);
  }, []);

  const prompt = currentTask?.prompt ?? '';
  const taskId = currentTask?.id;

  useEffect(() => {
    cancel();
    if (autoRead && gestureSeen && ttsAvailable && prompt) speak(prompt);
  }, [autoRead, gestureSeen, prompt, taskId, ttsAvailable, speak, cancel]);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  const toggleAutoRead = () => {
    if (session.phase !== 'ready') return;
    const next = !autoRead;
    setAutoRead(next);
    void savePreference(session.storage, 'autoRead', next).catch((reason: unknown) =>
      console.warn('[app] 자동 읽기 설정을 저장하지 못했습니다.', reason),
    );
  };

  const toggleLargeTarget = () => {
    if (session.phase !== 'ready') return;
    const next = !largeTarget;
    setLargeTarget(next);
    void savePreference(session.storage, 'largeTarget', next).catch((reason: unknown) =>
      console.warn('[app] 큰 버튼 설정을 저장하지 못했습니다.', reason),
    );
  };

  const switchFriend = () => {
    setMenuOpen(false);
    navigate({ kind: 'home' });
  };

  const goToMap = useCallback(() => navigate({ kind: 'map' }), []);

  if (session.phase === 'missing' || session.phase === 'loading') {
    return (
      <main className={styles.state}>
        <p role="status">{activityStrings.loading}</p>
      </main>
    );
  }

  if (session.phase === 'error' || error) {
    return (
      <main className={styles.state}>
        <p role="alert">
          {error === 'notfound' ? activityStrings.notFound : activityStrings.loadError}
        </p>
        <a className={styles.back} href="#/map">
          {activityStrings.back}
        </a>
      </main>
    );
  }

  if (!loaded) {
    return (
      <main className={styles.state}>
        <p role="status">{activityStrings.loading}</p>
      </main>
    );
  }

  const targetSize: TargetSize = largeTarget ? 64 : 48;
  const taskIndex = Math.max(
    0,
    loaded.activity.tasks.findIndex((task) => task.id === currentTask?.id),
  );
  const taskTotal = loaded.activity.tasks.length;

  return (
    <div className={styles.screen}>
      <header className={styles.topBar}>
        <a className={styles.back} href="#/map" aria-label={activityStrings.back}>
          <span aria-hidden="true">←</span>
          <span className={styles.backText}>{activityStrings.back}</span>
        </a>
        <h1 className={styles.title}>{loaded.activity.title}</h1>
        <div className={styles.topActions}>
          {ttsAvailable ? (
            <button
              type="button"
              className={styles.iconButton}
              aria-label={activityStrings.readPrompt}
              onClick={() => speak(prompt)}
            >
              <SpeakerIcon />
            </button>
          ) : null}
          <div className={styles.menuWrap} ref={menuRef}>
            <button
              type="button"
              className={styles.iconButton}
              aria-label={activityStrings.settings}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <span aria-hidden="true">⋯</span>
            </button>
            {menuOpen ? (
              <div className={styles.menu} role="menu" aria-label={activityStrings.settingsMenu}>
                <p className={styles.menuLearner}>
                  {activityStrings.learnerLabel(session.learner)}
                </p>
                {ttsAvailable ? (
                  <button
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={autoRead}
                    className={styles.menuItem}
                    onClick={toggleAutoRead}
                  >
                    <span className={styles.check} aria-hidden="true">
                      {autoRead ? '✓' : ''}
                    </span>
                    {activityStrings.autoRead}
                  </button>
                ) : null}
                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={largeTarget}
                  className={styles.menuItem}
                  onClick={toggleLargeTarget}
                >
                  <span className={styles.check} aria-hidden="true">
                    {largeTarget ? '✓' : ''}
                  </span>
                  {activityStrings.largeTarget}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className={styles.menuItem}
                  onClick={switchFriend}
                >
                  {activityStrings.switchFriend}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <div className={styles.runnerHost} data-testid="activity-tool">
        <ActivityRunner
          content={loaded.content}
          definitions={loaded.definitions}
          storage={session.storage}
          learner={session.learner}
          activityId={loaded.activity.id}
          targetSize={targetSize}
          onTaskChange={onTaskChange}
          onExit={goToMap}
        />
      </div>

      <footer className={styles.progress}>
        <span className={styles.progressText}>
          {activityStrings.progress(taskIndex + 1, taskTotal)}
        </span>
        <span className={styles.dots} aria-hidden="true">
          {loaded.activity.tasks.map((task, index) => (
            <span
              key={task.id}
              className={styles.dot}
              data-state={index < taskIndex ? 'done' : index === taskIndex ? 'current' : 'todo'}
            />
          ))}
        </span>
      </footer>
    </div>
  );
}
