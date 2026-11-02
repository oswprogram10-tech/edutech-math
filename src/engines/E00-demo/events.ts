/**
 * E00-demo의 공개 이벤트·판정.
 *
 * 러너는 reduce 직후 emit()을 호출해 다른 엔진에 알리고,
 * receive()로 다른 엔진의 이벤트를 자기 Action으로 바꾼다.
 * 둘 다 순수 함수다.
 */
import type { EngineEvent, EnginePredicate, JsonValue, Observation } from '../../core/engine-sdk';
import { nextCounterPoint } from './layout';
import type { DemoAction, DemoConfig, DemoState } from './types';

function payloadRecord(payload: JsonValue | undefined): Readonly<Record<string, JsonValue>> | null {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) return null;
  return payload;
}

function finiteNumber(value: JsonValue | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function counterPointFrom(payload: JsonValue | undefined): { x: number; y: number } | null {
  const record = payloadRecord(payload);
  if (!record) return null;
  const x = finiteNumber(record['x']);
  const y = finiteNumber(record['y']);
  return x === null || y === null ? null : { x, y };
}

function addedCounter(prev: DemoState, next: DemoState) {
  if (next.counters.length <= prev.counters.length) return null;
  return next.counters[next.counters.length - 1] ?? null;
}

function movedCounter(prev: DemoState, next: DemoState) {
  for (const counter of next.counters) {
    const before = prev.counters.find((item) => item.id === counter.id);
    if (before && (before.x !== counter.x || before.y !== counter.y)) return counter;
  }
  return null;
}

/** reduce 결과가 실제로 바뀐 경우에만 이벤트를 낸다. */
export function emit(prev: DemoState, next: DemoState, action: DemoAction): EngineEvent[] {
  if (prev === next) return [];

  switch (action.type) {
    case 'add': {
      const counter = addedCounter(prev, next);
      return counter
        ? [
            {
              name: 'counter-added',
              payload: { id: counter.id, x: counter.x, y: counter.y },
            },
          ]
        : [];
    }

    case 'move': {
      const counter = movedCounter(prev, next);
      return counter
        ? [
            {
              name: 'counter-moved',
              payload: { id: counter.id, x: counter.x, y: counter.y },
            },
          ]
        : [];
    }

    case 'group': {
      const group = next.groups[next.groups.length - 1];
      if (!group || next.groups.length === prev.groups.length) {
        return group && next.groups !== prev.groups
          ? [{ name: 'grouped', payload: { groupId: group.id, size: group.counterIds.length } }]
          : [];
      }
      return [{ name: 'grouped', payload: { groupId: group.id, size: group.counterIds.length } }];
    }

    case 'ungroup':
      return next.groups.length < prev.groups.length
        ? [{ name: 'ungrouped', payload: { groupId: action.groupId } }]
        : [];
  }
}

/**
 * 다른 엔진이 셈돌을 놓았다고 알리면 이 판에도 하나 놓는다.
 * payload의 x·y가 논리 좌표면 그 자리에, 아니면 화면과 같은 기본 자리에 놓는다.
 */
export function receive(
  state: DemoState,
  event: EngineEvent,
  config: DemoConfig,
): DemoAction | null {
  if (event.name !== 'counter-added') return null;
  const point = counterPointFrom(event.payload) ?? nextCounterPoint(state, config);
  return { type: 'add', x: point.x, y: point.y };
}

/** args `{ size }`인 묶음이 있는가. */
export const hasGroupOf: EnginePredicate = (
  observation: Observation,
  args: JsonValue | undefined,
): boolean => {
  const record = payloadRecord(args);
  if (!record) return false;
  const size = finiteNumber(record['size']);
  if (size === null) return false;
  const groups = observation['groups'];
  return Array.isArray(groups) && groups.includes(size);
};

export const predicates: Readonly<Record<string, EnginePredicate>> = {
  'has-group-of': hasGroupOf,
};
