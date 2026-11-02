/**
 * 활동 실행기 화면.
 *
 * 콘텐츠 한 단원을 과제 순서대로 보여 주고, 조작·채점·기록·힌트를 맡는다.
 * 앱은 라우트와 로딩 화면만 두고 이 컴포넌트를 재사용한다.
 * 실패해도 정답·정답 상태는 화면에 내보내지 않는다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentType } from 'react';
import { OverlayLayer } from '../engine-sdk';
import type { EngineId, LoadedEngine, Observation, TargetSize } from '../engine-sdk';
import type { LearnerId, Storage, TaskStatus as StorageTaskStatus } from '../storage';
import { taskProgressId } from '../storage';
import {
  backtrackTarget,
  diagnoseObservation,
  feedbackStrings,
  hintLevelFor,
  selectHint,
} from '../feedback';
import type { HintSelection } from '../feedback';
import {
  advanceSession,
  failureCount,
  isSessionComplete,
  sessionAfterEdit,
  sessionAfterSubmit,
  startSession,
} from './session';
import { applyActionWithLinks, applyControl, createSlotHistories, observationsOf } from './links';
import { evaluateGoal, resolveObservationPath } from './goal';
import { RESPONSE_SLOT, judgeObservation as mergeJudgeObservation } from './response';
import { TaskRecorder } from './recorder';
import { runnerStrings } from './strings.ko';
import { taskSlotViews } from './views';
import type { SlotHistories } from './links';
import type { TaskSlotView } from './views';
import type {
  BacktrackRequest,
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

/**
 * `LoadedEngine`은 타입을 지운 정의라 오버레이 props가 `never`다.
 * 실행기는 이미 슬롯 상태를 `unknown`으로 들고 다니므로 여기서만 좁힌 모양으로 바꾼다.
 */
const Overlay = OverlayLayer as unknown as ComponentType<{
  definition: LoadedEngine;
  overlay: string;
  config: unknown;
  state: unknown;
  args?: unknown;
}>;

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

/** 첫 수 응답 필드의 학생 표기. 힌트 `{student}`에 쓴다. */
function studentRawOf(task: ContentTask, observation: Observation): string | undefined {
  const field = task.response?.fields.find((item) => item.kind === 'number');
  if (!field) return undefined;
  const found = resolveObservationPath(observation, `response.${field.id}.raw`);
  return found.found && typeof found.value === 'string' ? found.value : undefined;
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
  /** 이 과제에서 이미 틀린 횟수(힌트 단계의 시작점). */
  readonly initialFailures: number;
  readonly onResult: (passed: boolean, hintLevel?: number) => void;
  readonly onEdit: () => void;
  readonly onNext: () => void;
  readonly onFinish?: () => void;
  readonly onHint?: (text: string | null) => void;
  readonly onBacktrack?: (request: BacktrackRequest) => void;
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
  initialFailures,
  onResult,
  onEdit,
  onNext,
  onFinish,
  onHint,
  onBacktrack,
}: TaskStageProps) {
  const [histories, setHistories] = useState<SlotHistories>(() => createSlotHistories(slots));
  const [hint, setHint] = useState<HintSelection | null>(null);
  const historiesRef = useRef(histories);
  const startedRef = useRef(false);
  const passedRef = useRef(false);
  const groupRef = useRef(0);
  const failureRef = useRef(initialFailures);
  const onHintRef = useRef(onHint);
  const onBacktrackRef = useRef(onBacktrack);

  useEffect(() => {
    onHintRef.current = onHint;
    onBacktrackRef.current = onBacktrack;
  }, [onHint, onBacktrack]);

  // 과제가 바뀌면(TaskStage가 다시 만들어지면) 읽어 주기 문장을 지운다.
  useEffect(() => () => onHintRef.current?.(null), []);

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
      setHint(null);
      onHintRef.current?.(null);
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

  /** 틀린 제출에 힌트 사다리를 한 칸 올린다. 힌트는 제출이 틀렸을 때만 나온다. */
  const showHint = useCallback(() => {
    failureRef.current += 1;
    const level = hintLevelFor(failureRef.current);

    const observations = observationsOf(slots, historiesRef.current);
    const observation =
      mergeJudgeObservation(
        judgeView ? observations[judgeView.slot] : undefined,
        task.response ? observations[RESPONSE_SLOT] : undefined,
      ) ?? {};
    const misconceptions = diagnoseObservation(task, observation);
    const selection = selectHint({
      hints: task.hints,
      observation,
      misconceptions,
      level,
      engine: judgeView?.definition,
      vars: task.hintVars,
      student: studentRawOf(task, observation),
    });

    setHint(selection);
    onHintRef.current?.(selection.text);
    void recorder.hinted(
      level,
      selection.kind === 'rule' ? selection.index : 'default',
      misconceptions,
    );

    if (level === 3) {
      const target = backtrackTarget(
        selection.kind === 'rule' ? selection.rule.backtrack : undefined,
        misconceptions,
      );
      void recorder.backtracked(target);
      onBacktrackRef.current?.({ taskId: task.id, target, misconceptions });
    }
  }, [judgeView, recorder, slots, task]);

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
    showHint();
    onResult(false, hintLevelFor(failureRef.current));
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

  const show = hint?.kind === 'rule' ? hint.rule.show : undefined;
  const overlayTarget = show ? slots.find((slot) => slot.definition.id === show.engine) : undefined;
  const overlayVisible =
    show !== undefined &&
    overlayTarget !== undefined &&
    displaySlots.some((slot) => slot.slot === overlayTarget.slot);

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
              {show && overlayVisible && overlayTarget?.slot === slot.slot ? (
                <Overlay
                  definition={overlayTarget.definition}
                  overlay={show.overlay}
                  config={overlayTarget.config}
                  state={histories.present[overlayTarget.slot]}
                  args={show.args}
                />
              ) : null}
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
        {hint && status !== 'passed' ? (
          <section
            className={styles.hint}
            data-testid="hint"
            data-hint-level={hint.level}
            aria-label={runnerStrings.hint}
          >
            {hint.text ? (
              <p className={styles.hintText} data-testid="hint-text">
                {hint.text}
              </p>
            ) : null}
            {show && !overlayVisible && overlayTarget ? (
              <div className={styles.hintVisual} data-testid="hint-overlay">
                <Overlay
                  definition={overlayTarget.definition}
                  overlay={show.overlay}
                  config={overlayTarget.config}
                  state={histories.present[overlayTarget.slot]}
                  args={show.args}
                />
              </div>
            ) : null}
            {hint.level === 3 && !onBacktrack ? (
              <div className={styles.helpCard} data-testid="hint-help" role="status">
                <p className={styles.helpTitle}>{feedbackStrings.helpTitle}</p>
                <p className={styles.helpBody}>{feedbackStrings.helpBody}</p>
              </div>
            ) : null}
          </section>
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
  /** 힌트 문장이 바뀔 때 알린다. 없으면 화면에만 보인다. */
  readonly onHint?: (text: string | null) => void;
  /** ③ 역추적 요청. 없으면 실행기가 '선생님께 도움을 요청해요' 카드를 보여 준다. */
  readonly onBacktrack?: (request: BacktrackRequest) => void;
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
  onHint,
  onBacktrack,
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
        initialFailures={failureCount(session, current.task.id)}
        onResult={(passed, hintLevel = 0) =>
          setSession((value) => sessionAfterSubmit(value, current.task.id, passed, hintLevel))
        }
        onEdit={() => setSession(sessionAfterEdit)}
        onNext={() => setSession(advanceSession)}
        onFinish={onExit}
        onHint={onHint}
        onBacktrack={onBacktrack}
      />
    </main>
  );
}
