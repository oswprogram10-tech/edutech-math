/**
 * 여러 엔진 슬롯과 이벤트 연결(linkedViews).
 *
 * 엔진끼리 직접 import하지 않는다. 러너가 A의 emit 결과를 B의 receive에 넘기고,
 * B가 돌려준 Action을 B 슬롯에 dispatch한다. 연결이 순환해도 같은 Action 처리
 * 안에서 같은 연결선은 한 번만 지나간다.
 */
import { createHistory, pushHistory, redoHistory, undoHistory } from '../engine-sdk';
import type { EngineEvent, JsonValue, LoadedEngine, Observation } from '../engine-sdk';
import type { History } from '../engine-sdk';
import { toJsonValue } from './json';
import type { SlotAction, SlotControl, TaskLinkSpec } from './types';

export interface SlotView {
  readonly slot: string;
  readonly definition: LoadedEngine;
  readonly config: unknown;
}

export type SlotHistories = Readonly<Record<string, History<unknown>>>;

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
  const histories: Record<string, History<unknown>> = {};
  for (const view of views) {
    if (histories[view.slot]) throw new Error(`슬롯 이름이 중복됩니다: ${view.slot}`);
    histories[view.slot] = createHistory(createEngineState(view));
  }
  return histories;
}

export function statesOf(histories: SlotHistories): Readonly<Record<string, unknown>> {
  const states: Record<string, unknown> = {};
  for (const [slot, history] of Object.entries(histories)) states[slot] = history.present;
  return states;
}

export function observationsOf(
  views: readonly SlotView[],
  histories: SlotHistories,
): Readonly<Record<string, Observation>> {
  const observations: Record<string, Observation> = {};
  for (const view of views) {
    const history = histories[view.slot];
    if (history) observations[view.slot] = observeEngine(view, history.present);
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
  const root = viewBySlot.get(slot);
  if (!root) throw new Error(`없는 슬롯입니다: ${slot}`);

  let current = histories;
  const applied: SlotAction[] = [];
  const visitedLinks = new Set<string>();

  const apply = (targetSlot: string, targetAction: unknown): void => {
    const view = viewBySlot.get(targetSlot);
    if (!view) throw new Error(`없는 슬롯입니다: ${targetSlot}`);
    const before = current[targetSlot];
    if (!before) throw new Error(`슬롯 상태가 없습니다: ${targetSlot}`);

    const prev = before.present;
    const next = reduceEngine(view, prev, targetAction);
    current = { ...current, [targetSlot]: pushHistory(before, next) };
    applied.push({ slot: targetSlot, action: toJsonValue(targetAction) });

    for (const event of emitFrom(view, prev, next, targetAction)) {
      for (const link of links) {
        if (link.from !== targetSlot || link.event !== event.name) continue;
        const key = `${link.from}->${link.to}:${link.event}`;
        if (visitedLinks.has(key)) continue;
        visitedLinks.add(key);

        const receiver = viewBySlot.get(link.to);
        if (!receiver) throw new Error(`연결 대상 슬롯이 없습니다: ${link.to}`);
        const receiverHistory = current[link.to];
        if (!receiverHistory) throw new Error(`슬롯 상태가 없습니다: ${link.to}`);

        const received = receiveFrom(receiver, receiverHistory.present, event);
        if (received !== null) apply(link.to, received);
      }
    }
  };

  apply(slot, action);
  return { histories: current, applied };
}

/** 되돌리기·다시하기는 한 슬롯의 스냅숏만 움직인다. 연결은 다시 발동하지 않는다. */
export function applyControl(
  histories: SlotHistories,
  slot: string,
  control: SlotControl,
): SlotHistories {
  const history = histories[slot];
  if (!history) throw new Error(`없는 슬롯입니다: ${slot}`);
  const next = control === 'undo' ? undoHistory(history) : redoHistory(history);
  return next === history ? histories : { ...histories, [slot]: next };
}

/** 기록 재생에 쓰는 Action 변환. 러너 화면과 같은 reduce를 쓴다. */
export function applyRecordedAction(
  view: SlotView,
  history: History<unknown>,
  action: JsonValue,
): History<unknown> {
  return pushHistory(history, reduceEngine(view, history.present, action));
}
