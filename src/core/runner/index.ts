// T005 활동 실행기 공개 API. 앱은 이 파일만 import한다.
// zod 콘텐츠 스키마는 check:specs 테스트에서만 쓰고 여기서는 공개하지 않는다.
export type {
  BacktrackRequest,
  ContentActivity,
  ContentTask,
  DiagnoseSpec,
  RunnerSession,
  SlotAction,
  SlotControl,
  SlotReplayResult,
  SubmitMode,
  TaskLinkSpec,
  TaskStatus,
  TaskViewSpec,
  UnitContent,
} from './types';

export {
  ContentFormatError,
  ContentNotFoundError,
  contentUnitIds,
  loadUnitContent,
} from './content-loader';

export { ActivityRunner } from './ActivityRunner';
export type { ActivityRunnerProps } from './ActivityRunner';

export { evaluateGoal, jsonEqual, resolveObservationPath } from './goal';
export type { GoalEngine } from './goal';

export { engineIdsOfContent, taskSlotViews } from './views';
export type { TaskSlotView } from './views';

export {
  RESPONSE_SLOT,
  createInitialState as createResponseState,
  judgeObservation,
  observe as observeResponse,
  reduce as reduceResponse,
  responseStrings,
} from './response';
export type {
  ChoiceField,
  ChoiceFieldState,
  ChoiceOption,
  CompareField,
  CompareFieldState,
  CompareSymbol,
  NumberField,
  NumberFieldState,
  NumberForm,
  NumberPart,
  OrderField,
  OrderFieldState,
  OrderItem,
  ResponseAction,
  ResponseConfig,
  ResponseField,
  ResponseFieldState,
  ResponseFigure,
  ResponseSpec,
  ResponseState,
  SortBin,
  SortCard,
  SortField,
  SortFieldState,
} from './response';

export {
  applyActionWithLinks,
  applyControl,
  applyRecordedAction,
  applyRecordedActions,
  createSlotHistories,
  observeEngine,
  observationsOf,
  reduceEngine,
  statesOf,
} from './links';
export type { ApplyActionResult, SlotHistories, SlotStates, SlotView } from './links';

export { MAIN_SLOT, ReplayError, replaySlots, replayTask } from './replay';
export type { TaskReplayResult } from './replay';

export {
  appendShareAction,
  createSharePayload,
  decodeSharePayload,
  encodeSharePayload,
  parseSharePayload,
  replayShare,
} from './share';
export type { ShareAction, ShareLink, SharePayload, SharePayloadResult, ShareView } from './share';
export { ShareDialog } from './ShareDialog';

export {
  advanceSession,
  currentTaskId,
  failureCount,
  hasNextTask,
  isSessionComplete,
  resetTaskFailures,
  sessionAfterEdit,
  sessionAfterSubmit,
  shownHintLevel,
  startSession,
} from './session';

export { TaskRecorder } from './recorder';
export type { BacktrackEvent, TaskRecorderOptions } from './recorder';

export { runnerStrings } from './strings.ko';
