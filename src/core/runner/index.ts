// T005 활동 실행기 공개 API. 앱은 이 파일만 import한다.
export type {
  ContentActivity,
  ContentTask,
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
  ContentSchemaError,
  activitySchema,
  linkSchema,
  parseUnitContent,
  taskSchema,
  unitContentSchema,
  viewSchema,
} from './content-schema';

export { ContentNotFoundError, contentUnitIds, loadUnitContent } from './content-loader';

export { evaluateGoal, jsonEqual, resolveObservationPath } from './goal';
export type { GoalEngine } from './goal';

export {
  applyActionWithLinks,
  applyControl,
  applyRecordedAction,
  createSlotHistories,
  observeEngine,
  observationsOf,
  reduceEngine,
  statesOf,
} from './links';
export type { ApplyActionResult, SlotHistories, SlotView } from './links';

export { MAIN_SLOT, ReplayError, replaySlots, replayTask } from './replay';
export type { TaskReplayResult } from './replay';

export {
  advanceSession,
  currentTaskId,
  failureCount,
  hasNextTask,
  isSessionComplete,
  sessionAfterEdit,
  sessionAfterSubmit,
  startSession,
} from './session';

export { TaskRecorder } from './recorder';
export type { TaskRecorderOptions } from './recorder';

export { runnerStrings } from './strings.ko';
