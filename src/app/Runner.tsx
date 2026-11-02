/**
 * 활동 실행 화면(E2E·교사 시연용).
 *
 * URL 해시 `#/run/demo`로 열린다. 학습자 선택 화면이 아직 없으므로 예약 ID "0"으로
 * 기록한다. T006에서 실제 번호 선택으로 바꾼다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadEngine } from '../core/engine-sdk';
import type { CPA, EngineId, JsonValue, LoadedEngine } from '../core/engine-sdk';
import {
  advanceSession,
  applyActionWithLinks,
  applyControl,
  createSlotHistories,
  evaluateGoal,
  isSessionComplete,
  loadUnitContent,
  observationsOf,
  runnerStrings,
  sessionAfterEdit,
  sessionAfterSubmit,
  startSession,
  TaskRecorder,
} from '../core/runner';
import type {
  ContentActivity,
  ContentTask,
  RunnerSession,
  SlotControl,
  SlotHistories,
  SlotView,
  TaskLinkSpec,
  TaskStatus,
  UnitContent,
} from '../core/runner';
import { getStorage, taskProgressId } from '../core/storage';
import type { Storage, TaskStatus as StorageTaskStatus } from '../core/storage';
import styles from './Runner.module.css';

/** T006 전까지 쓰는 시연·점검용 학습자 ID. */
const DEMO_LEARNER = '0';
const TARGET_SIZE = 48;

interface LoadedSlot extends SlotView {
  readonly mode: string;
  readonly cpa: CPA;
}

interface FlatTask {
  readonly activity: ContentActivity;
  readonly task: ContentTask;
}

interface LoadedContent {
  readonly content: UnitContent;
  readonly definitions: ReadonlyMap<EngineId, LoadedEngine>;
  readonly storage?: Storage;
}

function slotsForTask(
  task: ContentTask,
  definitions: ReadonlyMap<EngineId, LoadedEngine>,
): LoadedSlot[] {
  const specs = task.views ?? [
    {
      slot: 'main',
      engine: task.engine,
      mode: task.mode,
      cpa: task.cpa,
      config: task.config as JsonValue,
    },
  ];

  return specs.map((spec) => {
    const definition = definitions.get(spec.engine);
    if (!definition) throw new Error(`엔진을 불러오지 못했습니다: ${spec.engine}`);
    return {
      slot: spec.slot,
      engine: spec.engine,
      mode: spec.mode,
      cpa: spec.cpa,
      config: spec.config,
      definition,
    };
  });
}

function putProgress(
  storage: Storage | undefined,
  content: UnitContent,
  taskId: string,
  status: StorageTaskStatus,
): void {
  if (!storage) return;
  void storage
    .putTaskProgress({
      id: taskProgressId(DEMO_LEARNER, taskId),
      learner: DEMO_LEARNER,
      taskId,
      unit: content.unit,
      status,
      updatedAt: Date.now(),
    })
    .catch((error: unknown) => console.warn('[runner] 과제 진행을 저장하지 못했습니다.', error));
}

interface TaskStageProps {
  readonly content: UnitContent;
  readonly activity: ContentActivity;
  readonly task: ContentTask;
  readonly slots: readonly LoadedSlot[];
  readonly links: readonly TaskLinkSpec[];
  readonly storage?: Storage;
  readonly status: TaskStatus;
  readonly isLast: boolean;
  readonly onResult: (passed: boolean) => void;
  readonly onEdit: () => void;
  readonly onNext: () => void;
}

function TaskStage({
  content,
  activity,
  task,
  slots,
  links,
  storage,
  status,
  isLast,
  onResult,
  onEdit,
  onNext,
}: TaskStageProps) {
  const [histories, setHistories] = useState<SlotHistories>(() => createSlotHistories(slots));
  const historiesRef = useRef(histories);
  const startedRef = useRef(false);
  const passedRef = useRef(false);
  const lastSlotRef = useRef(slots[0]?.slot ?? 'main');

  const recorder = useMemo(
    () =>
      new TaskRecorder({
        sink: storage,
        learner: DEMO_LEARNER,
        unit: content.unit,
        task: task.id,
        engine: task.engine,
      }),
    [storage, content.unit, task.id, task.engine],
  );

  const judgeView = slots[0];
  const displaySlots = useMemo(
    () => [...slots].sort((a, b) => a.slot.localeCompare(b.slot)),
    [slots],
  );

  const commit = useCallback((next: SlotHistories) => {
    historiesRef.current = next;
    setHistories(next);
  }, []);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void recorder.started();
    putProgress(storage, content, task.id, 'in-progress');
  }, [recorder, storage, content, task.id]);

  const markPassed = useCallback(
    (recordSubmission: boolean) => {
      if (passedRef.current) return;
      passedRef.current = true;
      if (recordSubmission) void recorder.submitted();
      void recorder.passed();
      putProgress(storage, content, task.id, 'completed');
      onResult(true);
    },
    [recorder, storage, content, task.id, onResult],
  );

  const judge = useCallback(
    (current: SlotHistories): boolean => {
      if (!judgeView) return false;
      const observation = observationsOf(slots, current)[judgeView.slot];
      return observation ? evaluateGoal(task.goal, observation, judgeView.definition) : false;
    },
    [judgeView, slots, task.goal],
  );

  const handleAction = (slot: string, action: unknown) => {
    if (status === 'passed') return;
    if (status === 'failed') onEdit();
    lastSlotRef.current = slot;

    const result = applyActionWithLinks(slots, links, historiesRef.current, slot, action);
    commit(result.histories);
    for (const item of result.applied) void recorder.acted(item.slot, item.action);

    if (task.submit === 'auto' && judge(result.histories)) markPassed(true);
  };

  const handleControl = useCallback(
    (slot: string, control: SlotControl) => {
      if (status === 'passed') return;
      if (status === 'failed') onEdit();
      const next = applyControl(historiesRef.current, slot, control);
      if (next === historiesRef.current) return;
      commit(next);
      lastSlotRef.current = slot;
      void recorder.control(slot, control);
    },
    [status, onEdit, commit, recorder],
  );

  const handleSubmit = () => {
    if (status === 'passed') return;
    void recorder.submitted();
    if (judge(historiesRef.current)) {
      markPassed(false);
      return;
    }
    void recorder.failed();
    onResult(false);
  };

  const handleUndo = (slot: string) => handleControl(slot, 'undo');
  const handleRedo = (slot: string) => handleControl(slot, 'redo');

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
      ) {
        return;
      }
      const modifier = event.ctrlKey || event.metaKey;
      if (!modifier) return;
      const key = event.key.toLowerCase();
      if (key === 'z') {
        event.preventDefault();
        handleControl(lastSlotRef.current, event.shiftKey ? 'redo' : 'undo');
      } else if (key === 'y') {
        event.preventDefault();
        handleControl(lastSlotRef.current, 'redo');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleControl]);

  return (
    <section className={styles.task}>
      <div className={styles.promptBox}>
        <p className={styles.activity}>{activity.title}</p>
        <h2 className={styles.prompt}>{task.prompt}</h2>
      </div>

      <div className={styles.panels} data-panel-count={displaySlots.length}>
        {displaySlots.map((slot) => {
          const history = histories[slot.slot] ?? { past: [], present: undefined, future: [] };
          const state = history.present;
          const canUndo = history.past.length > 0 && status !== 'passed';
          const canRedo = history.future.length > 0 && status !== 'passed';
          const View = slot.definition.View;
          return (
            <section
              key={slot.slot}
              className={styles.panel}
              data-testid={`runner-slot-${slot.slot}`}
              aria-label={runnerStrings.slotLabel(slot.slot)}
            >
              {displaySlots.length > 1 ? (
                <h3 className={styles.slotTitle}>{runnerStrings.slotLabel(slot.slot)}</h3>
              ) : null}
              <View
                config={slot.config as never}
                state={state as never}
                dispatch={(action) => handleAction(slot.slot, action)}
                cpa={slot.cpa}
                mode={slot.mode}
                readOnly={status === 'passed'}
                targetSize={TARGET_SIZE}
              />
              <div
                className={styles.slotControls}
                role="toolbar"
                aria-label={runnerStrings.controls}
              >
                <button type="button" onClick={() => handleUndo(slot.slot)} disabled={!canUndo}>
                  {runnerStrings.undo}
                </button>
                <button type="button" onClick={() => handleRedo(slot.slot)} disabled={!canRedo}>
                  {runnerStrings.redo}
                </button>
              </div>
            </section>
          );
        })}
      </div>

      <div className={styles.feedback} aria-live="polite">
        {status === 'failed' ? (
          <p className={styles.failed} role="alert">
            {runnerStrings.failed}
          </p>
        ) : null}
        {status === 'passed' ? (
          <>
            <p className={styles.passed} role="status">
              {runnerStrings.passed}
            </p>
            {isLast ? (
              <>
                <p className={styles.completed}>{runnerStrings.completed}</p>
                <a className={styles.primary} href="#">
                  {runnerStrings.finish}
                </a>
              </>
            ) : (
              <button type="button" className={styles.primary} onClick={onNext}>
                {runnerStrings.next}
              </button>
            )}
          </>
        ) : null}
      </div>

      {task.submit === 'button' && status !== 'passed' ? (
        <div className={styles.submitRow}>
          <button type="button" className={styles.primary} onClick={handleSubmit}>
            {runnerStrings.submit}
          </button>
        </div>
      ) : null}
    </section>
  );
}

type RunnerContentProps = LoadedContent;

function RunnerContent({ content, definitions, storage }: RunnerContentProps) {
  const tasks = useMemo<FlatTask[]>(
    () =>
      content.activities.flatMap((activity) => activity.tasks.map((task) => ({ activity, task }))),
    [content],
  );
  const [session, setSession] = useState<RunnerSession>(() =>
    startSession(tasks.map((item) => item.task.id)),
  );

  const current = tasks[session.index];
  if (!current) {
    return (
      <main className={styles.runner}>
        <p className={styles.completed}>{runnerStrings.completed}</p>
        <a className={styles.back} href="#">
          {runnerStrings.back}
        </a>
      </main>
    );
  }

  const slots = slotsForTask(current.task, definitions);
  const complete = isSessionComplete(session);

  return (
    <main className={styles.runner}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{content.title}</h1>
          <p className={styles.meta}>
            {runnerStrings.task} {runnerStrings.taskCounter(session.index + 1, tasks.length)}
          </p>
        </div>
        <a className={styles.back} href="#">
          {runnerStrings.back}
        </a>
      </header>

      <TaskStage
        key={current.task.id}
        content={content}
        activity={current.activity}
        task={current.task}
        slots={slots}
        links={current.task.links ?? []}
        storage={storage}
        status={complete ? 'passed' : session.status}
        isLast={session.index === tasks.length - 1}
        onResult={(passed) =>
          setSession((value) => sessionAfterSubmit(value, current.task.id, passed))
        }
        onEdit={() => setSession(sessionAfterEdit)}
        onNext={() => setSession(advanceSession)}
      />
    </main>
  );
}

interface RunnerProps {
  readonly unitId: string;
}

export function Runner({ unitId }: RunnerProps) {
  const [loaded, setLoaded] = useState<LoadedContent | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const content = await loadUnitContent(unitId);
        const engineIds = new Set<EngineId>();
        for (const activity of content.activities) {
          for (const task of activity.tasks) {
            engineIds.add(task.engine);
            for (const view of task.views ?? []) engineIds.add(view.engine);
          }
        }
        const entries = await Promise.all(
          [...engineIds].map(async (id) => [id, await loadEngine(id)] as const),
        );
        const storage = await getStorage().catch(() => undefined);
        if (!cancelled) {
          setLoaded({ content, definitions: new Map(entries), storage });
        }
      } catch (reason) {
        console.warn('[runner] 콘텐츠를 불러오지 못했습니다.', reason);
        if (!cancelled) setError(true);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [unitId]);

  if (error) {
    return (
      <main className={styles.runner}>
        <p role="alert">{runnerStrings.loadError}</p>
        <a className={styles.back} href="#">
          {runnerStrings.back}
        </a>
      </main>
    );
  }

  if (!loaded) {
    return (
      <main className={styles.runner}>
        <p role="status">{runnerStrings.loading}</p>
      </main>
    );
  }

  return (
    <RunnerContent
      key={loaded.content.unit}
      content={loaded.content}
      definitions={loaded.definitions}
      storage={loaded.storage}
    />
  );
}
