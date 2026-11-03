/**
 * E01의 공개 이벤트·판정. 둘 다 순수 함수다.
 *
 * 이벤트 모양은 T046(E07 연결)이 받도록 카드 결정 14에 고정되어 있다.
 * `column`은 E07과 같은 자릿값 지수(일 0, 십 1, 백 2, 천 3)다.
 */
import type { EngineEvent, EnginePredicate, JsonValue, Observation } from '../../core/engine-sdk';
import type { BaseTenState } from './types';
import { columnOf, valueOf } from './value';

function argsRecord(args: JsonValue | undefined): Readonly<Record<string, JsonValue>> {
  if (args === null || typeof args !== 'object' || Array.isArray(args)) return {};
  return args;
}

function numberArg(args: Readonly<Record<string, JsonValue>>, key: string): number | null {
  const value = args[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function emit(prev: BaseTenState, next: BaseTenState): EngineEvent[] {
  if (prev === next) return [];
  const events: EngineEvent[] = [];

  if (next.log.length > prev.log.length) {
    for (const entry of next.log.slice(prev.log.length)) {
      const from = entry.from;
      const grouped = entry.kind === 'group';
      events.push({
        name: grouped ? 'grouped' : 'broken',
        payload: {
          from,
          to: grouped ? from * 10 : from / 10,
          column: columnOf(from),
        },
      });
    }
  }

  const before = valueOf(prev);
  const after = valueOf(next);
  if (before !== after) {
    events.push({ name: 'value-changed', payload: { value: after } });
  }

  return events;
}

export const predicates: Readonly<Record<string, EnginePredicate>> = {
  valueIs: (observation: Observation, args) => {
    const value = numberArg(argsRecord(args), 'value');
    return value !== null && observation['value'] === value;
  },

  canonical: (observation: Observation) => observation['canonical'] === true,

  countsAre: (observation: Observation, args) => {
    const record = argsRecord(args);
    const counts = observation['counts'];
    if (counts === null || typeof counts !== 'object' || Array.isArray(counts)) return false;
    const table = counts as Readonly<Record<string, JsonValue>>;
    for (const key of ['thousands', 'hundreds', 'tens', 'ones']) {
      const expected = numberArg(record, key);
      if (expected !== null && table[key] !== expected) return false;
    }
    return (
      record['thousands'] !== undefined ||
      record['hundreds'] !== undefined ||
      record['tens'] !== undefined ||
      record['ones'] !== undefined
    );
  },

  groupedAtLeast: (observation: Observation, args) => {
    const record = argsRecord(args);
    const from = numberArg(record, 'from');
    const count = numberArg(record, 'count') ?? 0;
    const log = observation['log'];
    if (from === null || !Array.isArray(log)) return false;
    return (
      log.filter(
        (entry) =>
          entry !== null &&
          typeof entry === 'object' &&
          !Array.isArray(entry) &&
          entry['kind'] === 'group' &&
          entry['from'] === from,
      ).length >= count
    );
  },

  brokeAtLeast: (observation: Observation, args) => {
    const record = argsRecord(args);
    const from = numberArg(record, 'from');
    const count = numberArg(record, 'count') ?? 0;
    const log = observation['log'];
    if (from === null || !Array.isArray(log)) return false;
    return (
      log.filter(
        (entry) =>
          entry !== null &&
          typeof entry === 'object' &&
          !Array.isArray(entry) &&
          entry['kind'] === 'break' &&
          entry['from'] === from,
      ).length >= count
    );
  },

  brokeBefore: (observation: Observation, args) => {
    const record = argsRecord(args);
    const first = numberArg(record, 'first');
    const then = numberArg(record, 'then');
    const log = observation['log'];
    if (first === null || then === null || !Array.isArray(log)) return false;
    const firstIndex = log.findIndex(
      (entry) =>
        entry !== null &&
        typeof entry === 'object' &&
        !Array.isArray(entry) &&
        entry['kind'] === 'break' &&
        entry['from'] === first,
    );
    const thenIndex = log.findIndex(
      (entry) =>
        entry !== null &&
        typeof entry === 'object' &&
        !Array.isArray(entry) &&
        entry['kind'] === 'break' &&
        entry['from'] === then,
    );
    return firstIndex >= 0 && thenIndex >= 0 && firstIndex < thenIndex;
  },

  chartIs: (observation: Observation, args) => {
    const value = numberArg(argsRecord(args), 'value');
    return value !== null && observation['chartValue'] === value;
  },

  /** args `{value, min}`: 그 값 블록이 min개 이상 있는가(힌트·과제용). */
  blocksAtLeast: (observation: Observation, args) => {
    const record = argsRecord(args);
    const value = numberArg(record, 'value');
    const min = numberArg(record, 'min');
    const counts = observation['counts'];
    if (value === null || min === null || counts === null || typeof counts !== 'object') {
      return false;
    }
    const table = counts as Readonly<Record<string, JsonValue>>;
    const key =
      value === 1000 ? 'thousands' : value === 100 ? 'hundreds' : value === 10 ? 'tens' : 'ones';
    const actual = table[key];
    return typeof actual === 'number' && actual >= min;
  },
};

/** 이 엔진은 다른 엔진 이벤트를 받지 않는다(E07 연결은 T046). */
export const EVENT_NAMES = ['grouped', 'broken', 'value-changed'] as const;
