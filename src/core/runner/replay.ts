/**
 * 기록 재생.
 *
 * 저장된 `acted` 이벤트(Action + undo/redo control)만으로 최종 상태를 다시 만든다.
 * 연결(links)은 기록할 때 이미 각 슬롯의 Action으로 남았으므로 재생에서는
 * 다시 발동하지 않는다. 그래야 같은 Action이 두 번 적용되지 않는다.
 */
import { createHistory } from '../engine-sdk';
import type { History, LoadedEngine, Observation } from '../engine-sdk';
import type { JsonObject, LearningEvent } from '../storage';
import {
  applyControl,
  applyRecordedAction,
  createSlotHistories,
  observeEngine,
  observationsOf,
  statesOf,
} from './links';
import { toJsonValue } from './json';
import type { SlotView } from './links';
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

function actionOf(data: JsonObject): unknown {
  if (!Object.prototype.hasOwnProperty.call(data, 'action')) {
    throw new ReplayError('acted 이벤트에 action이나 control이 없습니다.');
  }
  return data['action'];
}

/** 여러 슬롯 과제의 기록을 재생한다. views[0]이 슬롯이 없는 기록의 기본값이다. */
export function replaySlots(
  views: readonly SlotView[],
  events: readonly LearningEvent[],
): SlotReplayResult {
  const fallback = views[0]?.slot;
  if (!fallback) throw new ReplayError('재생할 엔진 화면이 없습니다.');
  const viewBySlot = new Map(views.map((view) => [view.slot, view]));
  let histories = createSlotHistories(views);

  for (const event of events) {
    if (event.verb !== 'acted') continue;
    const data = actedData(event);
    const slot = slotOf(data, fallback);
    const view = viewBySlot.get(slot);
    const history = histories[slot];
    if (!view || !history) throw new ReplayError(`기록에 없는 슬롯입니다: ${slot}`);

    const control = controlOf(data);
    if (control) {
      histories = applyControl(histories, slot, control);
      continue;
    }
    histories = {
      ...histories,
      [slot]: applyRecordedAction(view, history, toJsonValue(actionOf(data))),
    };
  }

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
      const nextHistories = applyControl({ [MAIN_SLOT]: history }, MAIN_SLOT, control);
      const next = nextHistories[MAIN_SLOT];
      if (next) history = next;
      continue;
    }
    history = applyRecordedAction(view, history, toJsonValue(actionOf(data)));
  }

  return { state: history.present, observation: observeEngine(view, history.present) };
}
