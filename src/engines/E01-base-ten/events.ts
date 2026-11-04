/**
 * E01의 공개 이벤트·판정. 둘 다 순수 함수다.
 *
 * 이벤트 모양은 T046(E07 연결)이 받도록 카드 결정 14에 고정되어 있다.
 * `column`은 E07과 같은 자릿값 지수(일 0, 십 1, 백 2, 천 3)다.
 * decimal에서는 소수 자리(−1·−2)까지 같은 규칙으로 늘린다.
 */
import { Rational } from '../../core/math';
import type { EngineEvent, EnginePredicate, JsonValue, Observation } from '../../core/engine-sdk';
import type { BaseTenBlock, BaseTenState, BlockValue } from './types';
import {
  columnOf,
  exponentOfShapeColumn,
  isDecimal,
  jsonValueOf,
  placeValueOf,
  rationalOfShape,
  rationalValueOf,
  shapeColumnOfExponent,
} from './value';

function argsRecord(args: JsonValue | undefined): Readonly<Record<string, JsonValue>> {
  if (args === null || typeof args !== 'object' || Array.isArray(args)) return {};
  return args;
}

function numberArg(args: Readonly<Record<string, JsonValue>>, key: string): number | null {
  const value = args[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function rationalOfJson(value: JsonValue | undefined): Rational | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    try {
      return Number.isInteger(value) ? Rational.of(value) : Rational.parse(String(value));
    } catch {
      return null;
    }
  }
  if (typeof value === 'string') {
    try {
      return Rational.parse(value);
    } catch {
      return null;
    }
  }
  return null;
}

function sameRational(left: JsonValue | undefined, right: JsonValue | undefined): boolean {
  const a = rationalOfJson(left);
  const b = rationalOfJson(right);
  return a !== null && b !== null && a.compareTo(b) === 0;
}

function valueOfBlocks(blocks: readonly BaseTenBlock[], state: BaseTenState): JsonValue {
  const decimal = isDecimal(state.settings);
  let total = Rational.of(0);
  for (const block of blocks) {
    total = total.add(rationalOfShape(block.value, state.settings.interpretation));
  }
  return decimal ? total.toDecimalString() : Number(total.n);
}

function emitLogEvents(prev: BaseTenState, next: BaseTenState): EngineEvent[] {
  if (next.log.length <= prev.log.length) return [];
  const events: EngineEvent[] = [];
  const decimal = isDecimal(next.settings);
  for (const entry of next.log.slice(prev.log.length)) {
    // 되감기는 묶기·풀기가 아니므로 grouped/broken을 내지 않는다.
    if (entry.kind === 'rewind') continue;
    const from = entry.from;
    if (from === undefined) continue;
    const grouped = entry.kind === 'group';
    const to = (grouped ? from * 10 : from / 10) as BlockValue;
    const column = exponentOfShapeColumn(columnOf(from), next.settings.interpretation);
    events.push({
      name: grouped ? 'grouped' : 'broken',
      payload: {
        from: decimal ? rationalOfShape(from, 'decimal').toDecimalString() : from,
        to: decimal ? rationalOfShape(to, 'decimal').toDecimalString() : to,
        column,
      },
    });
  }
  return events;
}

function divideColumns(state: BaseTenState): JsonValue[] {
  const plates = state.divide?.plates ?? 1;
  const interpretation = state.settings.interpretation;
  const shapeColumns = interpretation === 'decimal' ? [0, -1, -2] : [3, 2, 1, 0];
  const rows: JsonValue[] = [];

  for (const column of shapeColumns) {
    const shape = placeValueOf(shapeColumnOfExponent(column, interpretation));
    if (shape === null) continue;
    const pile = state.blocks.filter(
      (block) => block.plate === undefined && block.value === shape,
    ).length;
    const perPlateCounts = Array.from(
      { length: plates },
      (_, plate) =>
        state.blocks.filter((block) => block.plate === plate && block.value === shape).length,
    );
    const allEqual = perPlateCounts.every((count) => count === perPlateCounts[0]);
    rows.push({
      column,
      perPlate: allEqual ? (perPlateCounts[0] ?? 0) : null,
      pile,
    });
  }
  return rows;
}

function divideProgress(state: BaseTenState): EngineEvent {
  const plates = state.divide?.plates ?? 1;
  const plateValues: Rational[] = [];
  for (let plate = 0; plate < plates; plate += 1) {
    let total = Rational.of(0);
    for (const block of state.blocks) {
      if (block.plate !== plate) continue;
      total = total.add(rationalOfShape(block.value, state.settings.interpretation));
    }
    plateValues.push(total);
  }
  const first = plateValues[0] ?? Rational.of(0);
  const equal = plateValues.every((value) => value.compareTo(first) === 0);
  const pile = state.blocks.filter((block) => block.plate === undefined);
  return {
    name: 'divide-progress',
    payload: {
      columns: divideColumns(state),
      equal,
      pileValue: valueOfBlocks(pile, state),
    },
  };
}

export function emit(prev: BaseTenState, next: BaseTenState): EngineEvent[] {
  if (prev === next) return [];
  const events: EngineEvent[] = [...emitLogEvents(prev, next)];

  if (rationalValueOf(prev).compareTo(rationalValueOf(next)) !== 0) {
    events.push({ name: 'value-changed', payload: { value: jsonValueOf(next) } });
  }

  if (next.mode === 'divide') events.push(divideProgress(next));

  return events;
}

export const predicates: Readonly<Record<string, EnginePredicate>> = {
  valueIs: (observation: Observation, args) => {
    const expected = argsRecord(args)['value'];
    return expected !== undefined && sameRational(observation['value'], expected);
  },

  canonical: (observation: Observation) => observation['canonical'] === true,

  countsAre: (observation: Observation, args) => {
    const record = argsRecord(args);
    const counts = observation['counts'];
    if (counts === null || typeof counts !== 'object' || Array.isArray(counts)) return false;
    const table = counts as Readonly<Record<string, JsonValue>>;
    const keys = ['thousands', 'hundreds', 'tens', 'ones', 'tenths', 'hundredths'];
    let expected = false;
    for (const key of keys) {
      const want = numberArg(record, key);
      if (want === null) continue;
      expected = true;
      if (table[key] !== want) return false;
    }
    return expected;
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
    const expected = argsRecord(args)['value'];
    return expected !== undefined && sameRational(observation['chartValue'], expected);
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
    let key: string;
    if (table['thousands'] !== undefined) {
      key =
        value === 1000 ? 'thousands' : value === 100 ? 'hundreds' : value === 10 ? 'tens' : 'ones';
    } else {
      key = value === 100 ? 'ones' : value === 10 ? 'tenths' : 'hundredths';
    }
    const actual = table[key];
    return typeof actual === 'number' && actual >= min;
  },

  // ── big-number ────────────────────────────────────────────
  cutsAre: (observation: Observation, args) => {
    const expected = argsRecord(args)['positions'];
    const cuts = observation['cuts'];
    if (!Array.isArray(expected) || !Array.isArray(cuts)) return false;
    const want = expected.filter((value): value is number => typeof value === 'number');
    if (want.length !== expected.length || want.length !== cuts.length) return false;
    const sorted = [...want].sort((a, b) => a - b);
    return cuts.every((cut, index) => cut === sorted[index]);
  },

  cutsCorrect: (observation: Observation) => observation['cutsCorrect'] === true,

  builtIs: (observation: Observation, args) => {
    const expected = argsRecord(args)['value'];
    return typeof expected === 'string' && observation['built'] === expected;
  },

  selectedPlaceIs: (observation: Observation, args) => {
    const expected = numberArg(argsRecord(args), 'exponent');
    return expected !== null && observation['selectedPlace'] === expected;
  },

  // ── divide ────────────────────────────────────────────────
  platesEqual: (observation: Observation) => observation['equal'] === true,

  plateValueIs: (observation: Observation, args) => {
    const expected = argsRecord(args)['value'];
    const values = observation['plateValues'];
    if (expected === undefined || !Array.isArray(values) || values.length === 0) return false;
    return values.every((value) => sameRational(value, expected));
  },

  pileValueIs: (observation: Observation, args) => {
    const expected = argsRecord(args)['value'];
    return expected !== undefined && sameRational(observation['pileValue'], expected);
  },

  rewound: (observation: Observation) => observation['rewound'] === true,
};

/** T047이 낼 `rewind-requested`를 되감기 Action으로 바꾼다. */
export function receive(state: BaseTenState, event: EngineEvent): { type: 'rewind' } | null {
  if (event.name !== 'rewind-requested') return null;
  return state.mode === 'divide' ? { type: 'rewind' } : null;
}

export const EVENT_NAMES = ['grouped', 'broken', 'value-changed', 'divide-progress'] as const;
