/**
 * 활동 실행기 화면.
 *
 * 콘텐츠 한 단원을 과제 순서대로 보여 주고, 조작·채점·기록을 맡는다.
 * 앱은 라우트와 로딩 화면만 두고 이 컴포넌트를 재사용한다.
 * 실패해도 정답·정답 상태는 화면에 내보내지 않는다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentType } from 'react';
import type { EngineId, LoadedEngine, TargetSize } from '../engine-sdk';
import type { LearnerId, Storage, TaskStatus as StorageTaskStatus } from '../storage';
import { taskProgressId } from '../storage';
import {
  advanceSession,
  isSessionComplete,
  sessionAfterEdit,
  sessionAfterSubmit,
  startSession,
} from './session';
import { applyActionWithLinks, applyControl, createSlotHistories, observationsOf } from './links';
import { evaluateGoal } from './goal';
import { RESPONSE_SLOT, judgeObservation as mergeJudgeObservation } from './response';
import { TaskRecorder } from './recorder';
import { runnerStrings } from './strings.ko';
import { taskSlotViews } from './views';
import type { SlotHistories } from './links';
import type { TaskSlotView } from './views';
import type {
  ContentActivity,
  ContentTask,
  RunnerSession,
  SlotControl,
  TaskLinkSpec,
  TaskStatus,
  UnitContent,
} from './types';
import styles from './ActivityRunner.module.css';

/** T006 전까지 쓰는 시연·점검용 학습자 ID. */
export const DEMO_LEARNER: LearnerId = '0';
const DEFAULT_TARGET_SIZE: TargetSize = 48;

type LoadedSlot = TaskSlotView;

interface FlatTask {
  readonly activity: ContentActivity;
  readonly task: ContentTask;
}

function putProgress(
  storage: Storage | undefined,
  learner: LearnerId,
  content: UnitContent,
  taskId: string,
  status: StorageTaskStatus,
): void {
  if (!storage) return;
  void storage
    .putTaskProgress({
      id: taskProgressId(learner, taskId),
      learner,
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
  readonly definitions: ReadonlyMap<EngineId, LoadedEngine>;
  readonly storage?: Storage;
  readonly learner: LearnerId;
  readonly targetSize: TargetSize;
  readonly status: TaskStatus;
  readonly isLast: boolean;
  readonly onResult: (passed: boolean) => void;
  readonly onEdit: () => void;
  readonly onNext: () => void;
  readonly onFinish?: () => void;
}

function TaskStage({
  content,
  activity,
  task,
  slots,
  links,
  definitions,
  storage,
  learner,
  targetSize,
  status,
  isLast,
  onResult,
  onEdit,
  onNext,
  onFinish,
}: TaskStageProps) {
  const [histories, setHistories] = useState<SlotHistories>(() => createSlotHistories(slots));
  const historiesRef = useRef(histories);
  const startedRef = useRef(false);
  const passedRef = useRef(false);
  const groupRef = useRef(0);

  const recorder = useMemo(
    () =>
      new TaskRecorder({
        sink: storage,
        learner,
        unit: content.unit,
        task: task.id,
        engine: task.engine,
      }),
    [storage, learner, content.unit, task.id, task.engine],
  );

  const judgeView = slots[0];
  const displaySlots = useMemo(
    () =>
      [...slots]
        .filter((slot) => task.showEngine !== false || slot.slot === RESPONSE_SLOT)
        .sort((a, b) => a.slot.localeCompare(b.slot)),
    [slots, task.showEngine],
  );

  const commit = useCallback((next: SlotHistories) => {
    historiesRef.current = next;
    setHistories(next);
  }, []);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void recorder.started();
    putProgress(storage, learner, content, task.id, 'in-progress');
  }, [recorder, storage, learner, content, task.id]);

  const markPassed = useCallback(
    (recordSubmission: boolean) => {
      if (passedRef.current) return;
      passedRef.current = true;
      if (recordSubmission) void recorder.submitted();
      void recorder.passed();
      putProgress(storage, learner, content, task.id, 'completed');
      onResult(true);
    },
    [recorder, storage, learner, content, task.id, onResult],
  );

  const judge = useCallback(
    (current: SlotHistories): boolean => {
      if (!judgeView) return false;
      const observations = observationsOf(slots, current);
      const judgeResult = observations[judgeView.slot];
      const responseResult = task.response ? observations[RESPONSE_SLOT] : undefined;
      const observation = mergeJudgeObservation(judgeResult, responseResult);
      return observation ? evaluateGoal(task.goal, observation, judgeView.definition) : false;
    },
    [judgeView, slots, task.goal, task.response],
  );

  const handleAction = (slot: string, action: unknown) => {
    if (status === 'passed') return;
    if (status === 'failed') onEdit();

    const result = applyActionWithLinks(slots, links, historiesRef.current, slot, action);
    commit(result.histories);

    // 사용자 Action 하나와 연결로 생긴 Action 전체가 한 번의 되돌리기 단위다.
    groupRef.current += 1;
    const group = `g${groupRef.current}`;
    for (const item of result.applied) void recorder.acted(item.slot, item.action, group);

    if (task.submit === 'auto' && judge(result.histories)) markPassed(true);
  };

  const handleControl = useCallback(
    (control: SlotControl) => {
      if (status === 'passed') return;
      if (status === 'failed') onEdit();
      const next = applyControl(historiesRef.current, control);
      if (next === historiesRef.current) return;
      commit(next);
      void recorder.control(control);
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
        handleControl(event.shiftKey ? 'redo' : 'undo');
      } else if (key === 'y') {
        event.preventDefault();
        handleControl('redo');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleControl]);

  const canUndo = histories.past.length > 0 && status !== 'passed';
  const canRedo = histories.future.length > 0 && status !== 'passed';

  return (
    <section className={styles.task}>
      <div className={styles.promptBox}>
        <p className={styles.activity}>{activity.title}</p>
        <h2 className={styles.prompt}>{task.prompt}</h2>
      </div>

      <div className={styles.panels} data-panel-count={displaySlots.length}>
        {displaySlots.map((slot) => {
          const state = histories.present[slot.slot];
          // 엔진 View는 자기 props만 쓰고, 응답 View만 definitions를 읽는다.
          const View = slot.definition.View as unknown as ComponentType<Record<string, unknown>>;
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
                {...({
                  config: slot.config,
                  state,
                  dispatch: (action: unknown) => handleAction(slot.slot, action),
                  cpa: slot.cpa,
                  mode: slot.mode,
                  readOnly: status === 'passed',
                  targetSize,
                  definitions,
                } satisfies Record<string, unknown>)}
              />
            </section>
          );
        })}
      </div>

      <div className={styles.controls} role="toolbar" aria-label={runnerStrings.controls}>
        <button type="button" onClick={() => handleControl('undo')} disabled={!canUndo}>
          {runnerStrings.undo}
        </button>
        <button type="button" onClick={() => handleControl('redo')} disabled={!canRedo}>
          {runnerStrings.redo}
        </button>
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
                {onFinish ? (
                  <button type="button" className={styles.primary} onClick={onFinish}>
                    {runnerStrings.finish}
                  </button>
                ) : null}
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

export interface ActivityRunnerProps {
  readonly content: UnitContent;
  readonly definitions: ReadonlyMap<EngineId, LoadedEngine>;
  readonly storage?: Storage;
  /** T006 전에는 예약 ID "0". */
  readonly learner?: LearnerId;
  /** 주어지면 그 활동의 과제만 실행한다. 없으면 단원 전체를 실행한다. */
  readonly activityId?: string;
  /** 저학년 모드에서는 64. 기본 48. */
  readonly targetSize?: TargetSize;
  /** 과제가 바뀔 때마다 현재 과제를 알린다(TTS·상단 바용). */
  readonly onTaskChange?: (task: ContentTask) => void;
  /** 첫 화면으로 돌아가기. 없으면 나가기 버튼을 그리지 않는다. */
  readonly onExit?: () => void;
}

export function ActivityRunner({
  content,
  definitions,
  storage,
  learner = DEMO_LEARNER,
  activityId,
  targetSize = DEFAULT_TARGET_SIZE,
  onTaskChange,
  onExit,
}: ActivityRunnerProps) {
  const tasks = useMemo<FlatTask[]>(() => {
    const activities = activityId
      ? content.activities.filter((activity) => activity.id === activityId)
      : content.activities;
    return activities.flatMap((activity) => activity.tasks.map((task) => ({ activity, task })));
  }, [content, activityId]);
  const [session, setSession] = useState<RunnerSession>(() =>
    startSession(tasks.map((item) => item.task.id)),
  );

  const current = tasks[session.index];

  useEffect(() => {
    if (current) onTaskChange?.(current.task);
  }, [current, onTaskChange]);

  if (!current) {
    return (
      <main className={styles.runner}>
        <p className={styles.completed}>{runnerStrings.completed}</p>
        {onExit ? (
          <button type="button" className={styles.primary} onClick={onExit}>
            {runnerStrings.back}
          </button>
        ) : null}
      </main>
    );
  }

  const slots = taskSlotViews(current.task, definitions);
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
        {onExit ? (
          <button type="button" className={styles.back} onClick={onExit}>
            {runnerStrings.back}
          </button>
        ) : null}
      </header>

      <TaskStage
        key={current.task.id}
        content={content}
        activity={current.activity}
        task={current.task}
        slots={slots}
        links={current.task.links ?? []}
        definitions={definitions}
        storage={storage}
        learner={learner}
        targetSize={targetSize}
        status={complete ? 'passed' : session.status}
        isLast={session.index === tasks.length - 1}
        onResult={(passed) =>
          setSession((value) => sessionAfterSubmit(value, current.task.id, passed))
        }
        onEdit={() => setSession(sessionAfterEdit)}
        onNext={() => setSession(advanceSession)}
        onFinish={onExit}
      />
    </main>
  );
}
