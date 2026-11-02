/**
 * 여러 엔진 슬롯과 이벤트 연결(linkedViews).
 *
 * 엔진끼리 직접 import하지 않는다. 러너가 A의 emit 결과를 B의 receive에 넘기고,
 * B가 돌려준 Action을 B 슬롯에 dispatch한다. 연결이 순환해도 같은 Action 처리
 * 안에서 같은 연결선은 한 번만 지나간다.
 *
 * 되돌리기 단위는 '사용자의 Action 하나 + 그 연결로 생긴 Action들'이다.
 * 따라서 슬롯별 History가 아니라 모든 슬롯 상태를 한 스냅숏으로 쌓는다.
 */
import { createHistory, pushHistory, redoHistory, undoHistory } from '../engine-sdk';
import type { EngineEvent, History, JsonValue, LoadedEngine, Observation } from '../engine-sdk';
import { toJsonValue } from './json';
import type { SlotAction, SlotControl, TaskLinkSpec } from './types';

export interface SlotView {
  readonly slot: string;
  readonly definition: LoadedEngine;
  readonly config: unknown;
}

/** 한 시점의 모든 슬롯 상태. */
export type SlotStates = Readonly<Record<string, unknown>>;

/** 모든 슬롯을 함께 되돌리는 하나의 History. */
export type SlotHistories = History<SlotStates>;

type RuntimeCreate = (config: unknown) => unknown;
type RuntimeReduce = (state: unknown, action: unknown) => unknown;
type RuntimeObserve = (state: unknown, config: unknown) => Observation;
type RuntimeEmit = (prev: unknown, next: unknown, action: unknown) => EngineEvent[];
type RuntimeReceive = (state: unknown, event: EngineEvent, config: unknown) => unknown | null;

function createEngineState(view: SlotView): unknown {
  const create = view.definition.createInitialState as unknown as RuntimeCreate;
  return create(view.config);
}

export function reduceEngine(view: SlotView, state: unknown, action: unknown): unknown {
  const reduce = view.definition.reduce as unknown as RuntimeReduce;
  return reduce(state, action);
}

export function observeEngine(
  view: SlotView,
  state: unknown,
  config: unknown = view.config,
): Observation {
  const observe = view.definition.observe as unknown as RuntimeObserve;
  return observe(state, config);
}

export function createSlotHistories(views: readonly SlotView[]): SlotHistories {
  const states: Record<string, unknown> = {};
  for (const view of views) {
    if (Object.prototype.hasOwnProperty.call(states, view.slot)) {
      throw new Error(`슬롯 이름이 중복됩니다: ${view.slot}`);
    }
    states[view.slot] = createEngineState(view);
  }
  return createHistory(states);
}

export function statesOf(histories: SlotHistories): SlotStates {
  return histories.present;
}

export function observationsOf(
  views: readonly SlotView[],
  histories: SlotHistories,
): Readonly<Record<string, Observation>> {
  const observations: Record<string, Observation> = {};
  for (const view of views) {
    const state = histories.present[view.slot];
    if (state !== undefined) observations[view.slot] = observeEngine(view, state);
  }
  return observations;
}

function emitFrom(view: SlotView, prev: unknown, next: unknown, action: unknown): EngineEvent[] {
  const emit = view.definition.emit as unknown as RuntimeEmit | undefined;
  if (!emit) return [];
  const events = emit(prev, next, action);
  if (import.meta.env.DEV) {
    for (const event of events) {
      if (!view.definition.events.includes(event.name)) {
        throw new Error(`${view.definition.id}가 events에 없는 이벤트를 냈습니다: ${event.name}`);
      }
    }
  }
  return events;
}

function receiveFrom(view: SlotView, state: unknown, event: EngineEvent): unknown | null {
  const receive = view.definition.receive as unknown as RuntimeReceive | undefined;
  return receive ? receive(state, event, view.config) : null;
}

export interface ApplyActionResult {
  readonly histories: SlotHistories;
  readonly applied: readonly SlotAction[];
}

/**
 * 한 슬롯의 Action을 적용하고, 연결된 슬롯으로 이벤트를 전달한다.
 * 사용자 Action 하나와 연결로 생긴 Action 전체가 History 한 칸이 된다.
 * 돌려주는 applied에는 연결로 생긴 Action도 순서대로 들어 있다(이것도 기록한다).
 */
export function applyActionWithLinks(
  views: readonly SlotView[],
  links: readonly TaskLinkSpec[],
  histories: SlotHistories,
  slot: string,
  action: unknown,
): ApplyActionResult {
  const viewBySlot = new Map(views.map((view) => [view.slot, view]));
  if (!viewBySlot.has(slot)) throw new Error(`없는 슬롯입니다: ${slot}`);

  let states = histories.present;
  let changed = false;
  const applied: SlotAction[] = [];
  const visitedLinks = new Set<string>();

  const apply = (targetSlot: string, targetAction: unknown): void => {
    const view = viewBySlot.get(targetSlot);
    if (!view) throw new Error(`없는 슬롯입니다: ${targetSlot}`);
    if (!Object.prototype.hasOwnProperty.call(states, targetSlot)) {
      throw new Error(`슬롯 상태가 없습니다: ${targetSlot}`);
    }

    const prev = states[targetSlot];
    const next = reduceEngine(view, prev, targetAction);
    if (!Object.is(prev, next)) changed = true;
    states = { ...states, [targetSlot]: next };
    applied.push({ slot: targetSlot, action: toJsonValue(targetAction) });

    for (const event of emitFrom(view, prev, next, targetAction)) {
      for (const link of links) {
        if (link.from !== targetSlot || link.event !== event.name) continue;
        const key = `${link.from}->${link.to}:${link.event}`;
        if (visitedLinks.has(key)) continue;
        visitedLinks.add(key);

        const receiver = viewBySlot.get(link.to);
        if (!receiver) throw new Error(`연결 대상 슬롯이 없습니다: ${link.to}`);
        if (!Object.prototype.hasOwnProperty.call(states, link.to)) {
          throw new Error(`슬롯 상태가 없습니다: ${link.to}`);
        }

        const received = receiveFrom(receiver, states[link.to], event);
        if (received !== null) apply(link.to, received);
      }
    }
  };

  apply(slot, action);
  return {
    histories: changed ? pushHistory(histories, states) : histories,
    applied,
  };
}

/** 기록에 남은 Action 묶음 하나를 슬롯 상태 전체에 적용하고 History 한 칸으로 쌓는다. */
export function applyRecordedActions(
  views: readonly SlotView[],
  histories: SlotHistories,
  actions: readonly SlotAction[],
): SlotHistories {
  if (actions.length === 0) return histories;
  const viewBySlot = new Map(views.map((view) => [view.slot, view]));
  let states = histories.present;
  let changed = false;

  for (const item of actions) {
    const view = viewBySlot.get(item.slot);
    if (!view) throw new Error(`기록에 없는 슬롯입니다: ${item.slot}`);
    if (!Object.prototype.hasOwnProperty.call(states, item.slot)) {
      throw new Error(`슬롯 상태가 없습니다: ${item.slot}`);
    }
    const prev = states[item.slot];
    const next = reduceEngine(view, prev, item.action);
    if (!Object.is(prev, next)) changed = true;
    states = { ...states, [item.slot]: next };
  }

  return changed ? pushHistory(histories, states) : histories;
}

/** 되돌리기·다시하기는 모든 슬롯을 함께 움직인다. */
export function applyControl(histories: SlotHistories, control: SlotControl): SlotHistories {
  return control === 'undo' ? undoHistory(histories) : redoHistory(histories);
}

/** 엔진 하나짜리 기록 재생에 쓰는 Action 변환. 러너 화면과 같은 reduce를 쓴다. */
export function applyRecordedAction(
  view: SlotView,
  history: History<unknown>,
  action: JsonValue,
): History<unknown> {
  return pushHistory(history, reduceEngine(view, history.present, action));
}
