/**
 * E05의 공개 이벤트·판정.
 *
 * `value-changed`의 payload는 정확히 `{ value: "<Rational 문자열>" }`이다.
 * E03도 같은 이름·모양을 약속으로 받는다(엔진끼리 import하지 않는다).
 */
import { Rational } from '../../core/math';
import type { EngineEvent, EnginePredicate, JsonValue, Observation } from '../../core/engine-sdk';
import { denominatorNumber, numeratorNumber } from './fractions';
import { piecesOf } from './reduce';
import type {
  EventCounts,
  FractionModelAction,
  FractionModelConfig,
  FractionModelState,
} from './types';

function payloadRecord(payload: JsonValue | undefined): Readonly<Record<string, JsonValue>> | null {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) return null;
  return payload;
}

function payloadString(value: JsonValue | undefined): string | null {
  return typeof value === 'string' ? value : null;
}

function payloadNumber(value: JsonValue | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function count(state: FractionModelState, key: keyof EventCounts): number {
  return state.counters[key];
}

function ratioOf(shaded: number, parts: number): string {
  if (parts <= 0) return '0';
  return Rational.of(Math.max(0, Math.min(parts, Math.trunc(shaded))), parts).toString();
}

/** 모드마다 "학생이 지금 나타낸 수" 하나를 고른다. */
export function primaryValue(state: FractionModelState): string {
  switch (state.mode) {
    case 'partition': {
      const parts = piecesOf(state).length;
      return ratioOf(state.shaded.length, parts);
    }
    case 'shade':
      return ratioOf(state.shaded.length, state.parts);
    case 'compare': {
      const index = state.selectedBar ?? 0;
      const bar = state.bars[index] ?? state.bars[0];
      return bar ? ratioOf(bar.shaded.length, bar.parts) : '0';
    }
    case 'overlay-slicer':
      return state.a;
    case 'discrete': {
      const groups = Math.max(1, Math.floor(state.items / state.groupSize));
      return ratioOf(state.selectedGroups.length, groups);
    }
    case 'mixed':
      if (state.kind === 'problem') return state.result ?? state.a ?? '0';
      return Rational.of(
        state.wholes * state.denominator + state.pieces,
        state.denominator,
      ).toString();
    case 'add-sub':
      return state.result ?? state.a;
    case 'decimal-grid': {
      const total = state.size * state.size * state.layers;
      return ratioOf(state.shaded.length, total);
    }
  }
}

function shadedPayload(next: FractionModelState): JsonValue {
  switch (next.mode) {
    case 'shade':
      return { value: primaryValue(next), parts: next.parts, shaded: next.shaded.length };
    case 'partition':
      return { value: primaryValue(next), shaded: next.shaded.length };
    case 'discrete':
      return {
        value: primaryValue(next),
        selectedGroups: [...next.selectedGroups],
        selectedCount: next.selectedGroups.length * next.groupSize,
      };
    case 'decimal-grid':
      return { value: primaryValue(next), cells: next.shaded.length, layer: next.layer };
    case 'compare':
      return { value: primaryValue(next) };
    default:
      return { value: primaryValue(next) };
  }
}

/** reduce 결과가 실제로 바뀐 경우에만 이벤트를 낸다. */
export function emit(
  prev: FractionModelState,
  next: FractionModelState,
  action: FractionModelAction,
): EngineEvent[] {
  if (prev === next) return [];
  const events: EngineEvent[] = [];

  switch (action.type) {
    case 'cut':
      if (next.mode === 'partition') {
        events.push({
          name: 'partitioned',
          payload: { parts: piecesOf(next).length, cuts: next.cuts.length },
        });
      }
      break;

    case 'overlay':
      if (next.mode === 'overlay-slicer') {
        events.push({
          name: 'overlaid',
          payload: { overlaid: next.overlaid, grid: next.grid },
        });
      } else if (next.mode === 'add-sub') {
        events.push({
          name: 'overlaid',
          payload: { overlaid: next.commonGrid !== null, grid: next.commonGrid },
        });
      }
      break;

    case 'set-grid':
      if (next.mode === 'overlay-slicer') {
        events.push({ name: 'overlaid', payload: { overlaid: next.overlaid, grid: next.grid } });
      } else if (next.mode === 'add-sub') {
        events.push({
          name: 'overlaid',
          payload: { overlaid: next.commonGrid !== null, grid: next.commonGrid },
        });
      }
      break;

    case 'fuse':
      if (count(next, 'fused') > count(prev, 'fused')) {
        events.push({ name: 'fused', payload: { count: count(next, 'fused') } });
      }
      break;

    case 'break-whole':
      if (count(next, 'brokeWhole') > count(prev, 'brokeWhole')) {
        events.push({ name: 'broke-whole', payload: { count: count(next, 'brokeWhole') } });
      }
      break;

    case 'combine':
      if (count(next, 'fused') > count(prev, 'fused')) {
        events.push({ name: 'fused', payload: { count: count(next, 'fused') } });
      }
      if (count(next, 'brokeWhole') > count(prev, 'brokeWhole')) {
        events.push({ name: 'broke-whole', payload: { count: count(next, 'brokeWhole') } });
      }
      break;

    case 'toggle-part':
    case 'toggle-bar-part':
    case 'shade-piece':
    case 'toggle-group':
    case 'toggle-cell':
    case 'shade-row':
      if (count(next, 'shaded') > count(prev, 'shaded')) {
        events.push({ name: 'shaded', payload: shadedPayload(next) });
      }
      break;

    case 'set-shade-value':
    case 'set-bar-value':
      events.push({ name: 'shaded', payload: shadedPayload(next) });
      break;

    default:
      break;
  }

  const before = primaryValue(prev);
  const after = primaryValue(next);
  if (before !== after) {
    events.push({ name: 'value-changed', payload: { value: after } });
  }

  return events;
}

/**
 * 다른 엔진의 `value-changed`를 받아 자기 표시 값을 맞춘다.
 * shade는 칸을 다시 칠하고, compare는 선택한 막대를 맞춘다.
 */
export function receive(
  state: FractionModelState,
  event: EngineEvent,
  config: FractionModelConfig,
): FractionModelAction | null {
  void config;
  if (event.name !== 'value-changed') return null;
  const record = payloadRecord(event.payload);
  if (!record) return null;
  const value = payloadString(record['value']);
  if (value === null) return null;
  const parsed = (() => {
    try {
      return Rational.parse(value);
    } catch {
      return null;
    }
  })();
  if (!parsed || parsed.isNegative()) return null;

  if (state.mode === 'shade') {
    return { type: 'set-shade-value', value: parsed.toString() };
  }
  if (state.mode === 'compare') {
    const bar = state.selectedBar ?? 0;
    if (bar < 0 || bar >= state.bars.length) return null;
    return { type: 'set-bar-value', bar, value: parsed.toString() };
  }
  return null;
}

function rationalOf(value: JsonValue | undefined): Rational | null {
  if (typeof value !== 'string') return null;
  try {
    return Rational.parse(value);
  } catch {
    return null;
  }
}

function candidateValues(observation: Observation): Rational[] {
  const candidates: Rational[] = [];
  const wholes = observation['wholes'];
  if (Array.isArray(wholes)) {
    for (const entry of wholes) {
      if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) continue;
      const parsed = rationalOf(entry['value']);
      if (parsed) candidates.push(parsed);
    }
  }
  for (const key of ['value', 'result']) {
    const parsed = rationalOf(observation[key]);
    if (parsed) candidates.push(parsed);
  }
  return candidates;
}

/** args `{ parts?, }`인 등분이 있는가. parts가 없으면 "등분인 전체"가 하나라도 있는지. */
export const isEqualPartition: EnginePredicate = (
  observation: Observation,
  args: JsonValue | undefined,
): boolean => {
  const record = payloadRecord(args);
  const wanted = payloadNumber(record?.['parts']);
  const wholes = observation['wholes'];
  if (!Array.isArray(wholes)) return false;
  return wholes.some((entry) => {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) return false;
    if (entry['equal'] !== true) return false;
    return wanted === null || entry['parts'] === wanted;
  });
};

/** args `{ value }`와 같은 수를 나타냈는가(동치 비교). */
export const shadedEquals: EnginePredicate = (
  observation: Observation,
  args: JsonValue | undefined,
): boolean => {
  const record = payloadRecord(args);
  const target = rationalOf(record?.['value']);
  if (!target) return false;
  return candidateValues(observation).some((value) => value.equals(target));
};

/** args `{ value }`와 표기(raw)까지 같은가. */
export const shadedRawIs: EnginePredicate = (
  observation: Observation,
  args: JsonValue | undefined,
): boolean => {
  const record = payloadRecord(args);
  const target = payloadString(record?.['value']);
  if (target === null) return false;
  const wholes = observation['wholes'];
  if (Array.isArray(wholes)) {
    for (const entry of wholes) {
      if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) continue;
      if (entry['raw'] === target) return true;
    }
  }
  return observation['raw'] === target;
};

/** 지금 나타낸 분수가 기약인가. */
export const isIrreducible: EnginePredicate = (observation: Observation): boolean => {
  return observation['irreducible'] === true;
};

/** args `{ size }`. 겹친 공통 격자 칸 수가 맞는가. */
export const commonGridIs: EnginePredicate = (
  observation: Observation,
  args: JsonValue | undefined,
): boolean => {
  const record = payloadRecord(args);
  const size = payloadNumber(record?.['size'] ?? record?.['grid']);
  if (size === null) return false;
  return observation['commonGrid'] === size;
};

/** args `{ signature }`. 지금 절단이 그 서명과 다른가. */
export const differentCutFrom: EnginePredicate = (
  observation: Observation,
  args: JsonValue | undefined,
): boolean => {
  const record = payloadRecord(args);
  const signature = payloadString(record?.['signature']);
  if (signature === null) return false;
  return observation['cutSignature'] !== signature;
};

/** args `{ count? }`. 지금 칼선의 방향 묶음(0°·45°·90°·135°)이 count가지 이상인가. */
export const cutDirectionsAtLeast: EnginePredicate = (
  observation: Observation,
  args: JsonValue | undefined,
): boolean => {
  const record = payloadRecord(args);
  const wanted = payloadNumber(record?.['count']) ?? 2;
  const value = observation['cutDirections'];
  return typeof value === 'number' && value >= wanted;
};

const COUNT_KEYS: Readonly<Record<string, keyof EventCounts>> = {
  partitioned: 'partitioned',
  shaded: 'shaded',
  'value-changed': 'valueChanged',
  valueChanged: 'valueChanged',
  fused: 'fused',
  'broke-whole': 'brokeWhole',
  brokeWhole: 'brokeWhole',
  overlaid: 'overlaid',
  refined: 'refined',
  coarsened: 'coarsened',
};

/** args `{ name, count? }`. 이름이 붙은 이벤트가 count번 이상 일어났는가. */
export const eventAtLeast: EnginePredicate = (
  observation: Observation,
  args: JsonValue | undefined,
): boolean => {
  const record = payloadRecord(args);
  const name = payloadString(record?.['name']);
  if (name === null) return false;
  const key = COUNT_KEYS[name];
  if (!key) return false;
  const wanted = payloadNumber(record?.['count']) ?? 1;
  const counts = observation['counts'];
  if (counts === null || typeof counts !== 'object' || Array.isArray(counts)) return false;
  const actual = counts[key];
  return typeof actual === 'number' && actual >= wanted;
};

/** 색칠한 칸 수. 약분 탐정·묶음 과제가 쓴다. */
export const shadedCountIs: EnginePredicate = (
  observation: Observation,
  args: JsonValue | undefined,
): boolean => {
  const record = payloadRecord(args);
  const wanted = payloadNumber(record?.['count']);
  if (wanted === null) return false;
  const wholes = observation['wholes'];
  if (!Array.isArray(wholes)) return false;
  return wholes.some(
    (entry) =>
      entry !== null &&
      typeof entry === 'object' &&
      !Array.isArray(entry) &&
      entry['shaded'] === wanted,
  );
};

function isReducedString(value: string): boolean {
  const parsed = rationalOf(value);
  if (!parsed) return false;
  const numerator = numeratorNumber(parsed);
  const denominator = denominatorNumber(parsed);
  if (numerator === null || denominator === null) return false;
  let left = Math.abs(numerator);
  let right = Math.abs(denominator);
  while (right !== 0) {
    const remainder = left % right;
    left = right;
    right = remainder;
  }
  return left === 1 || numerator === 0;
}

/** args `{ value }`가 기약 표기인가. */
export const isReducedValue: EnginePredicate = (
  observation: Observation,
  args: JsonValue | undefined,
): boolean => {
  const record = payloadRecord(args);
  const value = payloadString(record?.['value']);
  if (value !== null) return isReducedString(value);
  return observation['irreducible'] === true;
};

export const predicates: Readonly<Record<string, EnginePredicate>> = {
  isEqualPartition,
  shadedEquals,
  shadedRawIs,
  isIrreducible,
  commonGridIs,
  commonGridSize: commonGridIs,
  differentCutFrom,
  cutDirectionsAtLeast,
  eventAtLeast,
  shadedCountIs,
  isReducedValue,
};
