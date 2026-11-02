/**
 * 기록 재생.
 *
 * 저장된 `acted` 이벤트만으로 최종 상태를 다시 만든다.
 * - `{ slot, action, group? }`: 사용자 Action과 연결로 생긴 Action. 같은 group은
 *   되돌리기 한 단위이므로 한 번에 적용하고 History 한 칸으로 쌓는다.
 * - `{ control: 'undo'|'redo' }`: 모든 슬롯을 함께 되돌리거나 다시 한다(슬롯 없음).
 *
 * 연결(links)은 기록할 때 이미 각 슬롯의 Action으로 남았으므로 재생에서는
 * 다시 발동하지 않는다. 그래야 같은 Action이 두 번 적용되지 않는다.
 */
import { createHistory, redoHistory, undoHistory } from '../engine-sdk';
import type { History, LoadedEngine, Observation } from '../engine-sdk';
import type { JsonObject, LearningEvent } from '../storage';
import {
  applyControl,
  applyRecordedAction,
  applyRecordedActions,
  createSlotHistories,
  observeEngine,
  observationsOf,
  statesOf,
} from './links';
import type { SlotAction } from './types';
import type { SlotView } from './links';
import { toJsonValue } from './json';
import type { SlotReplayResult } from './types';

export const MAIN_SLOT = 'main';

export class ReplayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReplayError';
  }
}

function actedData(event: LearningEvent): JsonObject {
  if (!event.data) throw new ReplayError(`이벤트에 data가 없습니다: ${event.id}`);
  return event.data;
}

function slotOf(data: JsonObject, fallback: string): string {
  const slot = data['slot'];
  return typeof slot === 'string' && slot.length > 0 ? slot : fallback;
}

function controlOf(data: JsonObject): 'undo' | 'redo' | null {
  const control = data['control'];
  return control === 'undo' || control === 'redo' ? control : null;
}

function groupOf(data: JsonObject): string | null {
  const group = data['group'];
  return typeof group === 'string' && group.length > 0 ? group : null;
}

function actionOf(data: JsonObject): unknown {
  if (!Object.prototype.hasOwnProperty.call(data, 'action')) {
    throw new ReplayError('acted 이벤트에 action이나 control이 없습니다.');
  }
  return data['action'];
}

/** 여러 슬롯 과제의 기록을 재생한다. views[0]이 슬롯이 없는 Action 기록의 기본값이다. */
export function replaySlots(
  views: readonly SlotView[],
  events: readonly LearningEvent[],
): SlotReplayResult {
  const fallback = views[0]?.slot;
  if (!fallback) throw new ReplayError('재생할 엔진 화면이 없습니다.');
  let histories = createSlotHistories(views);

  let pendingGroup: string | null = null;
  let pendingActions: SlotAction[] = [];
  let singles = 0;

  const flush = () => {
    if (pendingActions.length === 0) return;
    try {
      histories = applyRecordedActions(views, histories, pendingActions);
    } catch (error) {
      throw error instanceof ReplayError
        ? error
        : new ReplayError(error instanceof Error ? error.message : '기록을 재생하지 못했습니다.');
    }
    pendingActions = [];
    pendingGroup = null;
  };

  for (const event of events) {
    if (event.verb !== 'acted') continue;
    const data = actedData(event);

    // 되돌리기·다시하기는 슬롯 구분 없이 지금까지 쌓은 모든 슬롯을 함께 움직인다.
    const control = controlOf(data);
    if (control) {
      flush();
      histories = applyControl(histories, control);
      continue;
    }

    const group = groupOf(data);
    const key = group ?? `__single-${singles++}`;
    if (pendingGroup !== null && pendingGroup !== key) flush();
    pendingGroup = key;
    pendingActions.push({
      slot: slotOf(data, fallback),
      action: toJsonValue(actionOf(data)),
    });
  }
  flush();

  return { states: statesOf(histories), observations: observationsOf(views, histories) };
}

export interface TaskReplayResult {
  readonly state: unknown;
  readonly observation: Observation;
}

/**
 * 엔진 하나짜리 과제를 재생한다. `events`는 그 과제의 이벤트만 넘긴다.
 * 기록의 slot 이름과 상관없이 이 엔진 하나에 적용한다.
 */
export function replayTask(
  definition: LoadedEngine,
  config: unknown,
  events: readonly LearningEvent[],
): TaskReplayResult {
  const view: SlotView = { slot: MAIN_SLOT, definition, config };
  const initial = (definition.createInitialState as unknown as (config: unknown) => unknown)(
    config,
  );
  let history: History<unknown> = createHistory(initial);

  for (const event of events) {
    if (event.verb !== 'acted') continue;
    const data = actedData(event);
    const control = controlOf(data);
    if (control) {
      history = control === 'undo' ? undoHistory(history) : redoHistory(history);
      continue;
    }
    history = applyRecordedAction(view, history, toJsonValue(actionOf(data)));
  }

  return { state: history.present, observation: observeEngine(view, history.present) };
}
