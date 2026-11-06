/**
 * 활동 실행기 화면.
 *
 * 콘텐츠 한 단원을 과제 순서대로 보여 주고, 조작·채점·기록·힌트를 맡는다.
 * 앱은 라우트와 로딩 화면만 두고 이 컴포넌트를 재사용한다.
 * 실패해도 정답·정답 상태는 화면에 내보내지 않는다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentType } from 'react';
import { OverlayLayer, loadEngine } from '../engine-sdk';
import type { EngineId, LoadedEngine, Observation, TargetSize } from '../engine-sdk';
import type {
  LearnerId,
  MasteryRecord,
  Storage,
  TaskStatus as StorageTaskStatus,
} from '../storage';
import { masteryId, taskProgressId } from '../storage';
import {
  backtrackTarget,
  diagnoseObservation,
  feedbackStrings,
  hintLevelFor,
  selectHint,
} from '../feedback';
import type { HintSelection } from '../feedback';
import {
  boosterPlanFor,
  findBacktrackCandidates,
  initialProbabilityFor,
  loadKnowledgeGraph,
  masteryAfterResult,
  masteryParams,
} from '../knowledge';
import type { BoosterPlan, KnowledgeGraph } from '../knowledge';
import {
  advanceSession,
  failureCount,
  hasNextTask,
  isSessionComplete,
  resetTaskFailures,
  sessionAfterEdit,
  sessionAfterSubmit,
  startSession,
} from './session';
import { applyActionWithLinks, applyControl, createSlotHistories, observationsOf } from './links';
import { createSharePayload, encodeSharePayload, filterShareActions } from './share';
import type { ShareAction, ShareView } from './share';
import { ShareDialog } from './ShareDialog';
import { toJsonValue } from './json';
import { shareHash } from '../storage';
import { evaluateGoal, resolveObservationPath } from './goal';
import { RESPONSE_SLOT, judgeObservation as mergeJudgeObservation } from './response';
import { TaskRecorder } from './recorder';
import type { BacktrackEvent } from './recorder';
import { loadUnitContent } from './content-loader';
import { runnerStrings } from './strings.ko';
import { engineIdsOfContent, taskSlotViews } from './views';
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
  /** 부스터 모달이 덮고 있는 동안에는 입력·단축키를 받지 않는다. */
  readonly paused?: boolean;
  /** 이 과제에서 이미 틀린 횟수(힌트 단계의 시작점). */
  readonly initialFailures: number;
  readonly onResult: (passed: boolean, hintLevel?: number) => void;
  readonly onEdit: () => void;
  readonly onNext: () => void;
  readonly onFinish?: () => void;
  readonly onHint?: (text: string | null) => void;
  readonly onBacktrack?: (request: BacktrackRequest) => void;
  /** ③에서 '선생님께 도움 요청' 카드를 보여 줄지. 기본은 onBacktrack이 없을 때. */
  readonly showHelpCard?: boolean;
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
  paused = false,
  initialFailures,
  onResult,
  onEdit,
  onNext,
  onFinish,
  onHint,
  onBacktrack,
  showHelpCard,
}: TaskStageProps) {
  const [histories, setHistories] = useState<SlotHistories>(() => createSlotHistories(slots));
  const [hint, setHint] = useState<HintSelection | null>(null);
  const [share, setShare] = useState<{ readonly code: string; readonly link: string } | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const shareActionsRef = useRef<ShareAction[]>([]);
  const taskRef = useRef<HTMLElement>(null);
  const hintRef = useRef<HTMLElement>(null);
  const historiesRef = useRef(histories);
  const startedRef = useRef(false);
  const passedRef = useRef(false);
  const groupRef = useRef(0);
  const failureRef = useRef(initialFailures);
  const previousFailuresRef = useRef(initialFailures);
  const onHintRef = useRef(onHint);
  const onBacktrackRef = useRef(onBacktrack);

  // 부스터를 통과해 실패 횟수가 0으로 돌아오면 힌트 ①부터 다시 시작한다.
  // 과제가 바뀌면 TaskStage 자체가 새로 만들어지므로 여기서는 같은 과제의 초기화만 다룬다.
  useEffect(() => {
    if (initialFailures < previousFailuresRef.current) {
      failureRef.current = initialFailures;
      setHint(null);
      onHintRef.current?.(null);
    }
    previousFailuresRef.current = initialFailures;
  }, [initialFailures]);

  useEffect(() => {
    onHintRef.current = onHint;
    onBacktrackRef.current = onBacktrack;
  }, [onHint, onBacktrack]);

  // 과제가 바뀌면(TaskStage가 다시 만들어지면) 읽어 주기 문장을 지운다.
  useEffect(() => () => onHintRef.current?.(null), []);

  // 부스터 모달이 덮는 동안 원래 과제는 포커스·클릭을 받지 않는다.
  // inert를 쓰는 브라우저는 그대로, 못 쓰는 브라우저는 aria-hidden + 포인터 차단으로 대신한다.
  useEffect(() => {
    const node = taskRef.current;
    if (!node || !paused) return;
    // `inert` 속성을 실제로 지원하는지 확인한다(구형 Safari 대비).
    const hasInert = (node as unknown as { inert?: unknown }).inert !== undefined;
    if (hasInert) {
      node.setAttribute('inert', '');
    } else {
      node.setAttribute('aria-hidden', 'true');
      node.style.pointerEvents = 'none';
    }
    return () => {
      node.removeAttribute('inert');
      node.removeAttribute('aria-hidden');
      node.style.removeProperty('pointer-events');
    };
  }, [paused]);

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
      // 힌트를 보고 맞혔으면 그 단계만큼만 숙달도를 올린다(docs/05 §2).
      // 틀린 적이 없으면(failureRef 0) 힌트 없음으로 본다.
      const shownLevel = failureRef.current > 0 ? hintLevelFor(failureRef.current) : 0;
      onResult(true, shownLevel);
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
      onBacktrackRef.current?.({ taskId: task.id, target, misconceptions });
    }
  }, [judgeView, recorder, slots, task]);

  const handleAction = (slot: string, action: unknown) => {
    if (paused || status === 'passed') return;
    if (status === 'failed') onEdit();

    const result = applyActionWithLinks(slots, links, historiesRef.current, slot, action);
    commit(result.histories);

    // 사용자 Action 하나와 연결로 생긴 Action 전체가 한 번의 되돌리기 단위다.
    groupRef.current += 1;
    const group = `g${groupRef.current}`;
    for (const item of result.applied) void recorder.acted(item.slot, item.action, group);
    for (const item of result.applied) {
      shareActionsRef.current = [...shareActionsRef.current, { ...item, group }];
    }

    if (task.submit === 'auto' && judge(result.histories)) markPassed(true);
  };

  const handleControl = useCallback(
    (control: SlotControl) => {
      if (paused || status === 'passed') return;
      if (status === 'failed') onEdit();
      const next = applyControl(historiesRef.current, control);
      if (next === historiesRef.current) return;
      commit(next);
      shareActionsRef.current = [...shareActionsRef.current, { control }];
      void recorder.control(control);
    },
    [paused, status, onEdit, commit, recorder],
  );

  const openShare = useCallback(() => {
    setShareError(null);
    const sharedSlots = new Set<string>();
    const views: ShareView[] = [];
    for (const slot of slots) {
      if (slot.slot === RESPONSE_SLOT) continue;
      sharedSlots.add(slot.slot);
      views.push({
        slot: slot.slot,
        engine: slot.definition.id,
        mode: slot.mode,
        cpa: slot.cpa,
        config: toJsonValue(slot.config),
      });
    }

    if (views.length === 0) {
      setShareError(runnerStrings.shareFailed);
      return;
    }

    const sharedLinks = links.filter(
      (link) => sharedSlots.has(link.from) && sharedSlots.has(link.to),
    );
    // 응답 슬롯 Action과, 응답만 든 묶음을 가리키는 되돌리기·다시하기를 함께 뺀다.
    const actions = filterShareActions(shareActionsRef.current, sharedSlots);
    const payload = createSharePayload(views, sharedLinks, actions);
    const encoded = encodeSharePayload(payload);
    if (!encoded.ok) {
      setShareError(
        encoded.error === 'TOO_LONG' ? runnerStrings.shareTooLong : runnerStrings.shareFailed,
      );
      return;
    }

    const base = window.location.href.split('#')[0] ?? window.location.href;
    setShare({ code: encoded.code, link: `${base}${shareHash(encoded.code)}` });
  }, [slots, links]);

  const handleSubmit = () => {
    if (paused || status === 'passed') return;
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
    if (paused) return;
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
  }, [handleControl, paused]);

  const canUndo = histories.past.length > 0 && status !== 'passed';
  const canRedo = histories.future.length > 0 && status !== 'passed';

  const show = hint?.kind === 'rule' ? hint.rule.show : undefined;
  const overlayTarget = show ? slots.find((slot) => slot.definition.id === show.engine) : undefined;
  const overlayVisible =
    show !== undefined &&
    overlayTarget !== undefined &&
    displaySlots.some((slot) => slot.slot === overlayTarget.slot);
  const hasContentPanel = displaySlots.some(
    (slot) => (slot.definition.layout ?? 'fit') === 'content',
  );

  // 새 힌트(단계가 바뀔 때)가 화면 밖이면 보이게 한다. 부스터 모달 안에서는 모달만 스크롤한다.
  const hintLevel = hint?.level ?? null;
  useEffect(() => {
    if (hintLevel === null) return;
    const node = hintRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const dialog = node.closest<HTMLElement>('[role="dialog"][aria-modal="true"]');
    const bounds = dialog?.getBoundingClientRect();
    const top = bounds?.top ?? 0;
    const bottom = bounds?.bottom ?? window.innerHeight;
    if (rect.top >= top && rect.bottom <= bottom) return;

    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const behavior: ScrollBehavior = reduced ? 'auto' : 'smooth';

    if (dialog) {
      if (typeof dialog.scrollBy !== 'function') return;
      const delta = rect.top < top ? rect.top - top - 8 : rect.bottom - bottom + 8;
      dialog.scrollBy({ top: delta, behavior });
      return;
    }
    if (typeof node.scrollIntoView !== 'function') return;
    node.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior });
  }, [hintLevel]);

  return (
    <section ref={taskRef} className={styles.task} data-paused={paused ? 'true' : undefined}>
      <div className={styles.promptBox}>
        <p className={styles.activity}>{activity.title}</p>
        <h2 className={styles.prompt}>{task.prompt}</h2>
      </div>

      <div
        className={styles.panels}
        data-panel-count={displaySlots.length}
        data-has-content={hasContentPanel ? 'true' : undefined}
      >
        {displaySlots.map((slot) => {
          const state = histories.present[slot.slot];
          // 엔진 View는 자기 props만 쓰고, 응답 View만 definitions를 읽는다.
          const View = slot.definition.View as unknown as ComponentType<Record<string, unknown>>;
          return (
            <section
              key={slot.slot}
              className={styles.panel}
              data-slot={slot.slot}
              data-layout={slot.definition.layout ?? 'fit'}
              data-testid={`runner-slot-${slot.slot}`}
              aria-label={runnerStrings.slotLabel(slot.slot)}
            >
              {displaySlots.length > 1 ? (
                <h3 className={styles.slotTitle}>{runnerStrings.slotLabel(slot.slot)}</h3>
              ) : null}
              <div className={styles.viewport}>
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
              </div>
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
        <button type="button" onClick={openShare}>
          {runnerStrings.show}
        </button>
        <button type="button" onClick={() => handleControl('undo')} disabled={!canUndo}>
          {runnerStrings.undo}
        </button>
        <button type="button" onClick={() => handleControl('redo')} disabled={!canRedo}>
          {runnerStrings.redo}
        </button>
      </div>

      {shareError ? (
        <p className={styles.failed} role="alert">
          {shareError}
        </p>
      ) : null}

      <div className={styles.feedback} aria-live="polite">
        {status === 'failed' ? (
          <p className={styles.failed} role="alert">
            {runnerStrings.failed}
          </p>
        ) : null}
        {hint && status !== 'passed' ? (
          <section
            ref={hintRef}
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
            {hint.level === 3 && (showHelpCard ?? !onBacktrack) ? (
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

      {share ? (
        <ShareDialog code={share.code} link={share.link} onClose={() => setShare(null)} />
      ) : null}
    </section>
  );
}

interface BoosterRunnerProps {
  readonly plan: BoosterPlan;
  readonly content: UnitContent;
  readonly definitions: ReadonlyMap<EngineId, LoadedEngine>;
  readonly storage?: Storage;
  readonly learner: LearnerId;
  readonly targetSize: TargetSize;
  readonly onTaskResult: (task: ContentTask, passed: boolean, hintLevel: number) => void;
  readonly onPassed: () => void;
  readonly onFailed: () => void;
}

/**
 * 부스터 모달. 원래 과제 화면은 실행기가 뒤에 그대로 두므로
 * 여기서는 부스터 과제만 진행하고, 끝나면 실행기에 알린다.
 * 학년·단원 ID는 보여 주지 않고 활동 제목만 쓴다.
 */
function BoosterRunner({
  plan,
  content,
  definitions,
  storage,
  learner,
  targetSize,
  onTaskResult,
  onPassed,
  onFailed,
}: BoosterRunnerProps) {
  const [session, setSession] = useState<RunnerSession>(() =>
    startSession(plan.tasks.map((task) => task.id)),
  );
  const dialogRef = useRef<HTMLDivElement>(null);
  const passedNotifiedRef = useRef(false);
  const current = plan.tasks[session.index];

  useEffect(() => {
    if (session.status !== 'passed' || hasNextTask(session) || passedNotifiedRef.current) return;
    passedNotifiedRef.current = true;
    onPassed();
  }, [session, onPassed]);

  // 포커스는 모달 안에만 둔다. 닫히면 열기 전 자리로 돌아간다.
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    const focusables = (): HTMLElement[] => {
      if (!dialog) return [];
      return Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
    };

    focusables()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0] as HTMLElement;
      const last = items[items.length - 1] as HTMLElement;
      const active = document.activeElement;
      const inside = active instanceof HTMLElement && dialog?.contains(active) === true;
      if (event.shiftKey && (!inside || active === first)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (!inside || active === last)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (previous?.isConnected) previous.focus();
    };
  }, []);

  if (!current) return null;

  const slots = taskSlotViews(current, definitions);

  return (
    <div className={styles.modalBackdrop} data-testid="booster-backdrop">
      <div
        ref={dialogRef}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="booster-title"
        data-testid="booster-dialog"
      >
        <h2 id="booster-title" className={styles.modalTitle}>
          {runnerStrings.boosterTitle}
        </h2>
        <p className={styles.modalActivity}>{plan.activity.title}</p>
        <TaskStage
          key={current.id}
          content={content}
          activity={plan.activity}
          task={current}
          slots={slots}
          links={current.links ?? []}
          definitions={definitions}
          storage={storage}
          learner={learner}
          targetSize={targetSize}
          status={isSessionComplete(session) ? 'passed' : session.status}
          isLast={session.index === plan.tasks.length - 1}
          initialFailures={failureCount(session, current.id)}
          onResult={(passed, hintLevel = 0) => {
            onTaskResult(current, passed, hintLevel);
            // 부스터 안에서는 다시 부스터를 열지 않는다. 실행기가 깊이를 센다.
            if (!passed && hintLevel >= 3) {
              onFailed();
              return;
            }
            setSession((value) => sessionAfterSubmit(value, current.id, passed, hintLevel));
          }}
          onEdit={() => setSession(sessionAfterEdit)}
          onNext={() => setSession(advanceSession)}
          onBacktrack={() => undefined}
          showHelpCard={false}
        />
      </div>
    </div>
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
  /**
   * ③ 역추적 요청 알림. 실행기는 이 콜백과 별개로 지식 그래프를 보고
   * 부스터 모달을 직접 연다. 후보가 없으면 '선생님께 도움 요청' 카드를 남긴다.
   */
  readonly onBacktrack?: (request: BacktrackRequest) => void;
  /** 부스터 콘텐츠 로더. 테스트에서 가짜 콘텐츠를 넣을 때 바꾼다. */
  readonly loadContent?: (unitId: string) => Promise<UnitContent>;
}

interface BoosterSession {
  readonly plan: BoosterPlan;
  readonly content: UnitContent;
  readonly definitions: ReadonlyMap<EngineId, LoadedEngine>;
  readonly request: BacktrackRequest;
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
  loadContent = loadUnitContent,
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
  const [booster, setBooster] = useState<BoosterSession | null>(null);
  // 도움 카드를 띄운 과제 ID. 과제가 바뀌면 자동으로 숨는다(상태 초기화 효과 없이).
  const [helpTaskId, setHelpTaskId] = useState<string | null>(null);

  const graphRef = useRef<KnowledgeGraph | null>(null);
  const masteryRef = useRef<Map<string, MasteryRecord>>(new Map());
  const knowledgeReadyRef = useRef<Promise<void>>(Promise.resolve());
  const masteryQueueRef = useRef<Promise<void>>(Promise.resolve());
  const backtrackingRef = useRef(false);
  const boosterDepthRef = useRef(0);

  const current = tasks[session.index];
  const taskById = useMemo(
    () => new Map(tasks.map((item) => [item.task.id, item.task] as const)),
    [tasks],
  );

  useEffect(() => {
    if (current) onTaskChange?.(current.task);
  }, [current, onTaskChange]);

  // 그래프와 이 학습자의 숙달 기록을 한 번 불러온다. 실패해도 수업은 계속된다.
  useEffect(() => {
    let cancelled = false;
    knowledgeReadyRef.current = (async () => {
      let graph: KnowledgeGraph | null = null;
      try {
        graph = await loadKnowledgeGraph();
      } catch (error) {
        console.warn('[runner] 지식 그래프를 불러오지 못했습니다.', error);
      }

      let records: MasteryRecord[] = [];
      if (storage) {
        try {
          records = await storage.listMastery();
        } catch (error) {
          console.warn('[runner] 숙달 기록을 불러오지 못했습니다.', error);
        }
      }
      if (cancelled) return;
      if (graph) graphRef.current = graph;
      const mine = new Map<string, MasteryRecord>();
      for (const record of records) {
        if (record.learner === learner) mine.set(record.conceptId, record);
      }
      masteryRef.current = mine;
    })();
    return () => {
      cancelled = true;
    };
  }, [storage, learner]);

  /**
   * 과제 결과를 숙달도에 반영한다. 과제마다 개념 전부를 갱신하고 저장한다.
   * 여러 제출이 겹쳐도 앞 결과를 덮어쓰지 않도록 한 줄로 세운다.
   */
  const applyMasteryResult = useCallback(
    (task: ContentTask, passed: boolean, hintLevel: number) => {
      if (task.concepts.length === 0) return;
      const run = async (): Promise<void> => {
        await knowledgeReadyRef.current;
        let graph = graphRef.current;
        if (!graph) {
          try {
            graph = await loadKnowledgeGraph();
            graphRef.current = graph;
          } catch (error) {
            console.warn('[runner] 숙달 확률을 계산할 그래프가 없습니다.', error);
          }
        }

        const records = new Map(masteryRef.current);
        const changed: MasteryRecord[] = [];
        for (const conceptId of task.concepts) {
          const previous = records.get(conceptId);
          const initialP = graph
            ? initialProbabilityFor(graph, records, conceptId)
            : masteryParams.initialP;
          const next = masteryAfterResult(previous, passed, hintLevel, task.id, initialP);
          const record: MasteryRecord = {
            id: masteryId(learner, conceptId),
            learner,
            conceptId,
            p: next.p,
            passedTasks: next.passedTasks,
            updatedAt: Date.now(),
          };
          records.set(conceptId, record);
          changed.push(record);
        }
        masteryRef.current = records;

        if (storage) {
          try {
            await storage.putMasteryRecords(changed);
          } catch (error) {
            console.warn('[runner] 숙달 기록을 저장하지 못했습니다.', error);
          }
        }
      };

      masteryQueueRef.current = masteryQueueRef.current.then(run).catch((error: unknown) => {
        console.warn('[runner] 숙달 기록을 갱신하지 못했습니다.', error);
      });
    },
    [learner, storage],
  );

  const recordBacktrack = useCallback(
    (event: BacktrackEvent) => {
      const source = taskById.get(event.from) ?? current?.task;
      if (!source) return;
      const recorder = new TaskRecorder({
        sink: storage,
        learner,
        unit: content.unit,
        task: source.id,
        engine: source.engine,
      });
      void recorder.backtracked(event);
    },
    [storage, learner, content.unit, taskById, current?.task],
  );

  const definitionsFor = useCallback(
    async (
      boosterContent: UnitContent,
    ): Promise<ReadonlyMap<EngineId, LoadedEngine> | undefined> => {
      const result = new Map(definitions);
      try {
        await Promise.all(
          engineIdsOfContent(boosterContent).map(async (id) => {
            if (result.has(id)) return;
            result.set(id, await loadEngine(id));
          }),
        );
      } catch (error) {
        console.warn('[runner] 부스터 엔진을 불러오지 못했습니다.', error);
        return undefined;
      }
      return result;
    },
    [definitions],
  );

  const openBooster = useCallback(
    async (request: BacktrackRequest, minDepth: number): Promise<void> => {
      if (backtrackingRef.current) return;
      backtrackingRef.current = true;
      setHelpTaskId(request.taskId);
      try {
        await knowledgeReadyRef.current;
        let graph = graphRef.current;
        if (!graph) {
          try {
            graph = await loadKnowledgeGraph();
            graphRef.current = graph;
          } catch (error) {
            console.warn('[runner] 역추적할 지식 그래프가 없습니다.', error);
            return;
          }
        }

        const sourceTask = taskById.get(request.taskId) ?? current?.task;
        if (!sourceTask) return;

        const candidates = findBacktrackCandidates(graph, masteryRef.current, {
          taskConcepts: sourceTask.concepts,
          ...(request.target === undefined ? {} : { target: request.target }),
          minDepth,
        });

        for (const candidate of candidates) {
          const concept = graph.concepts.get(candidate.conceptId);
          if (!concept) continue;
          let loaded: UnitContent | undefined;
          try {
            loaded = await loadContent(concept.unit);
          } catch {
            // 아직 콘텐츠가 없는 단원은 다음 후보로 넘어간다.
            continue;
          }
          const plan = boosterPlanFor(candidate.conceptId, loaded);
          if (!plan) continue;
          const loadedDefinitions = await definitionsFor(loaded);
          if (!loadedDefinitions) continue;

          boosterDepthRef.current = candidate.depth;
          recordBacktrack({
            from: request.taskId,
            to: candidate.conceptId,
            depth: candidate.depth,
            outcome: 'opened',
          });
          setBooster({
            plan,
            content: loaded,
            definitions: loadedDefinitions,
            request,
          });
          setHelpTaskId(null);
          return;
        }

        recordBacktrack({ from: request.taskId, depth: minDepth, outcome: 'no-booster' });
      } finally {
        backtrackingRef.current = false;
      }
    },
    [taskById, current?.task, loadContent, definitionsFor, recordBacktrack],
  );

  const handleBacktrack = useCallback(
    (request: BacktrackRequest) => {
      onBacktrack?.(request);
      if (booster) return;
      void openBooster(request, 0);
    },
    [onBacktrack, booster, openBooster],
  );

  const handleBoosterPassed = useCallback(() => {
    const active = booster;
    if (!active) return;
    recordBacktrack({
      from: active.request.taskId,
      to: active.plan.conceptId,
      depth: boosterDepthRef.current,
      outcome: 'passed',
    });
    setSession((value) => resetTaskFailures(value, active.request.taskId));
    setBooster(null);
    setHelpTaskId(null);
  }, [booster, recordBacktrack]);

  const handleBoosterFailed = useCallback(() => {
    const active = booster;
    if (!active) return;
    const depth = boosterDepthRef.current;
    recordBacktrack({
      from: active.request.taskId,
      to: active.plan.conceptId,
      depth,
      outcome: 'failed',
    });
    setBooster(null);

    const nextDepth = depth + 1;
    if (nextDepth > masteryParams.maxBacktrackDepth) {
      recordBacktrack({ from: active.request.taskId, depth, outcome: 'no-booster' });
      setHelpTaskId(active.request.taskId);
      return;
    }
    void openBooster(active.request, nextDepth);
  }, [booster, recordBacktrack, openBooster]);

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
  const boosterKey = booster
    ? `${booster.plan.conceptId}:${booster.plan.tasks.map((task) => task.id).join(',')}`
    : '';

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
        paused={booster !== null}
        initialFailures={failureCount(session, current.task.id)}
        onResult={(passed, hintLevel = 0) => {
          applyMasteryResult(current.task, passed, hintLevel);
          setSession((value) => sessionAfterSubmit(value, current.task.id, passed, hintLevel));
        }}
        onEdit={() => setSession(sessionAfterEdit)}
        onNext={() => setSession(advanceSession)}
        onFinish={onExit}
        onHint={onHint}
        onBacktrack={handleBacktrack}
        showHelpCard={helpTaskId === current.task.id}
      />

      {booster ? (
        <BoosterRunner
          key={boosterKey}
          plan={booster.plan}
          content={booster.content}
          definitions={booster.definitions}
          storage={storage}
          learner={learner}
          targetSize={targetSize}
          onTaskResult={applyMasteryResult}
          onPassed={handleBoosterPassed}
          onFailed={handleBoosterFailed}
        />
      ) : null}
    </main>
  );
}
