/**
 * E03의 공개 이벤트·판정. 둘 다 순수 함수다.
 *
 * `value-changed` payload는 다른 엔진과 맞추기 위해 정확히 `{ value: "<Rational>" }`다.
 */
import { Rational } from '../../core/math/rational';
import type { EngineEvent, EnginePredicate, JsonValue, Observation } from '../../core/engine-sdk';
import { frogAt } from './frog';
import { parseValue } from './ticks';
import type { NumberLineAction, NumberLineState } from './types';

function payloadRecord(payload: JsonValue | undefined): Readonly<Record<string, JsonValue>> | null {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) return null;
  return payload;
}

function stringField(record: Readonly<Record<string, JsonValue>>, key: string): string | null {
  const value = record[key];
  return typeof value === 'string' ? value : null;
}

function valuePayload(value: string | null): EngineEvent[] {
  if (value === null) return [];
  return [{ name: 'value-changed', payload: { value } }];
}

/** reduce 결과가 실제로 바뀐 경우에만 이벤트를 낸다. */
export function emit(
  prev: NumberLineState,
  next: NumberLineState,
  action: NumberLineAction,
): EngineEvent[] {
  if (prev === next) return [];

  switch (action.type) {
    case 'place-point': {
      const point = [...next.points]
        .reverse()
        .find((candidate) => !prev.points.some((before) => before.id === candidate.id));
      if (!point) return [];
      return [
        { name: 'point-placed', payload: { id: point.id, value: point.value } },
        ...valuePayload(point.value),
      ];
    }

    case 'move-point': {
      const point = next.points.find((candidate) => candidate.id === action.id);
      const before = prev.points.find((candidate) => candidate.id === action.id);
      if (!point || !before || point.value === before.value) return [];
      return [
        { name: 'point-moved', payload: { id: point.id, value: point.value } },
        ...valuePayload(point.value),
      ];
    }

    case 'add-jump': {
      const jump = next.jumps[next.jumps.length - 1];
      if (!jump || next.jumps.length === prev.jumps.length) return [];
      const from = parseValue(jump.from) ?? Rational.of(0);
      const to = parseValue(jump.to) ?? Rational.of(0);
      return [
        {
          name: 'jumped',
          payload: { from: jump.from, to: jump.to, size: to.sub(from).toJSON() },
        },
      ];
    }

    case 'place-card': {
      const placed = next.cardValues[action.card];
      if (!placed || placed === prev.cardValues[action.card]) return [];
      return [
        { name: 'card-placed', payload: { card: action.card, value: placed } },
        ...valuePayload(next.lastValue),
      ];
    }

    case 'zoom': {
      if (next.zoomLevel === prev.zoomLevel) return [];
      return [{ name: 'zoomed', payload: { level: next.zoomLevel, tick: nextTick(next) } }];
    }

    case 'hop': {
      const row = next.skip?.rows[action.row];
      const before = prev.skip?.rows[action.row];
      if (!row || !before || row.hops.length === before.hops.length) return [];
      const landing = row.hops[row.hops.length - 1];
      if (landing === undefined) return [];
      return [
        {
          name: 'hopped',
          payload: { row: action.row, step: row.step, count: row.hops.length, landing },
        },
        ...valuePayload(landing),
      ];
    }

    case 'round': {
      const item = next.rounding?.items[action.item];
      const before = prev.rounding?.items[action.item];
      if (!item || !before) return [];
      const resultChanged = item.marker !== null && item.marker !== before.marker;
      const methodChanged = item.method !== before.method;
      if (!resultChanged && !methodChanged) return [];
      const events: EngineEvent[] = [
        {
          name: 'rounded',
          payload: {
            item: action.item,
            value: item.value,
            result: item.marker,
            method: item.method,
          },
        },
      ];
      if (resultChanged) events.push(...valuePayload(item.marker));
      return events;
    }

    case 'move-marker': {
      const item = next.rounding?.items[action.item];
      const before = prev.rounding?.items[action.item];
      if (!item || !before || item.marker === before.marker) return [];
      return valuePayload(item.marker);
    }

    case 'log-zoom': {
      const level = next.logZoom?.level;
      if (level === undefined || level === prev.logZoom?.level) return [];
      const max = parseValue(next.max) ?? Rational.of(0);
      return [
        {
          name: 'zoomed',
          payload: { level, tick: max.div(Rational.of(10)).toJSON() },
        },
      ];
    }

    case 'scale-pair': {
      const pairs = next.double?.pairs;
      const pair = pairs?.[pairs.length - 1];
      if (!pair || pairs?.length === prev.double?.pairs.length) return [];
      return [{ name: 'pair-added', payload: { top: pair.top, bottom: pair.bottom } }];
    }

    case 'frog-jump': {
      const frog = next.frog;
      const before = prev.frog;
      if (!frog || !before || frog.jumps.length === before.jumps.length) return [];
      const size = frog.jumps[frog.jumps.length - 1];
      if (size === undefined) return [];
      const from = frogAt(before).toJSON();
      const to = frogAt(frog).toJSON();
      return [{ name: 'jumped', payload: { from, to, size } }, ...valuePayload(to)];
    }

    default:
      return [];
  }
}

function nextTick(state: NumberLineState): string {
  // observe와 같은 계산을 이벤트 payload에도 넣어 다른 엔진이 바로 쓸 수 있게 한다.
  const unit = parseValue(state.unit) ?? Rational.of(1);
  if (state.mode === 'decimal') {
    let tick = unit;
    for (let index = 0; index < state.zoomLevel; index += 1) tick = tick.div(Rational.of(10));
    return tick.toJSON();
  }
  if (state.mode === 'fraction') {
    const parts = state.subdivisions[0] ?? 4;
    return unit.div(Rational.of(parts)).toJSON();
  }
  return unit.toJSON();
}

/**
 * 다른 엔진이 `value-changed`를 보내면 그 값을 '연결 점'으로 표시한다.
 * 연결 점은 학생이 찍은 점으로 세지 않는다(Observation의 points에 넣지 않는다).
 */
export function receive(state: NumberLineState, event: EngineEvent): NumberLineAction | null {
  if (event.name !== 'value-changed') return null;
  const record = payloadRecord(event.payload);
  if (!record) return null;
  const value = stringField(record, 'value');
  if (value === null) return null;
  const parsed = parseValue(value);
  if (!parsed) return null;
  const normalized = parsed.toJSON();
  if (state.linkedValue === normalized) return null;
  return { type: 'set-linked', value: normalized };
}

function observationPointValues(observation: Observation): Rational[] {
  const points = observation['points'];
  if (!Array.isArray(points)) return [];
  const result: Rational[] = [];
  for (const entry of points) {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const value = entry['value'];
    if (typeof value !== 'string') continue;
    const parsed = parseValue(value);
    if (parsed) result.push(parsed);
  }
  return result;
}

function sameRational(observation: Observation, key: string, expected: Rational): boolean {
  const raw = observation[key];
  if (typeof raw !== 'string') return false;
  const parsed = parseValue(raw);
  return parsed !== null && parsed.equals(expected);
}

/** args `{ value }`인 점이 있는가. `3/4`과 `0.75`는 같은 점이다. */
export const hasPointAt: EnginePredicate = (
  observation: Observation,
  args: JsonValue | undefined,
): boolean => {
  const record = payloadRecord(args);
  if (!record) return false;
  const value = stringField(record, 'value');
  const expected = parseValue(value ?? undefined);
  if (!expected) return false;
  return observationPointValues(observation).some((point) => point.equals(expected));
};

/** args `{ value }`인 점이 정확히 하나뿐인가. 눈금마다 점을 찍어 통과하는 것을 막는다. */
export const onlyPointAt: EnginePredicate = (
  observation: Observation,
  args: JsonValue | undefined,
): boolean => {
  const record = payloadRecord(args);
  if (!record) return false;
  const value = stringField(record, 'value');
  const expected = parseValue(value ?? undefined);
  if (!expected) return false;
  const points = observationPointValues(observation);
  return points.length === 1 && (points[0]?.equals(expected) ?? false);
};

/** 카드가 모두 자기 값과 같은 위치에 꽂혔는가. 카드가 없으면 거짓. */
export const cardsCorrect: EnginePredicate = (observation: Observation): boolean =>
  observation['cardsCorrect'] === true;

/** args `{ a, b }`가 같은 수인가. */
export const samePoint: EnginePredicate = (
  _observation: Observation,
  args: JsonValue | undefined,
): boolean => {
  const record = payloadRecord(args);
  if (!record) return false;
  const a = parseValue(stringField(record, 'a') ?? undefined);
  const b = parseValue(stringField(record, 'b') ?? undefined);
  return a !== null && b !== null && a.equals(b);
};

/** 점프 합계가 args `{ value }`와 같은가. */
export const jumpTotalIs: EnginePredicate = (
  observation: Observation,
  args: JsonValue | undefined,
): boolean => {
  const record = payloadRecord(args);
  if (!record) return false;
  const value = stringField(record, 'value');
  const expected = parseValue(value ?? undefined);
  if (!expected) return false;
  return sameRational(observation, 'jumpTotal', expected);
};

// ── T080 개구리 점프 predicates ─────────────────────────────

/** args `{ value }`: 개구리 위치가 그 값인가. */
export const frogAtIs: EnginePredicate = (
  observation: Observation,
  args: JsonValue | undefined,
): boolean => {
  const record = payloadRecord(args);
  if (!record) return false;
  const expected = parseValue(stringField(record, 'value') ?? undefined);
  if (!expected) return false;
  return sameRational(observation, 'frogAt', expected);
};

/** args `{ size, count }`: 그 크기의 점프가 정확히 count번인가. */
export const frogJumpCountIs: EnginePredicate = (
  observation: Observation,
  args: JsonValue | undefined,
): boolean => {
  const record = payloadRecord(args);
  if (!record) return false;
  const size = parseValue(stringField(record, 'size') ?? undefined);
  const count = numberField(record, 'count');
  if (!size || count === null) return false;
  const jumps = observation['frogJumps'];
  if (!Array.isArray(jumps)) return false;
  let matches = 0;
  for (const jump of jumps) {
    if (typeof jump === 'string' && parseValue(jump)?.equals(size)) matches += 1;
  }
  return matches === count;
};

/** args `{ value }`: 누른 점프 크기의 합이 그 값인가. */
export const frogJumpTotalIs: EnginePredicate = (
  observation: Observation,
  args: JsonValue | undefined,
): boolean => {
  const record = payloadRecord(args);
  if (!record) return false;
  const expected = parseValue(stringField(record, 'value') ?? undefined);
  if (!expected) return false;
  return sameRational(observation, 'frogJumpTotal', expected);
};

// ── T048 새 모드 predicates ─────────────────────────────────

function numberField(record: Readonly<Record<string, JsonValue>>, key: string): number | null {
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function rowRecord(
  observation: Observation,
  row: number,
): Readonly<Record<string, JsonValue>> | null {
  const rows = observation['skipRows'];
  if (!Array.isArray(rows)) return null;
  const entry = rows[row];
  if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) return null;
  return entry;
}

function rowArg(record: Readonly<Record<string, JsonValue>>): number {
  const row = numberField(record, 'row');
  return row !== null && row >= 0 ? Math.trunc(row) : 0;
}

function rationalFieldEquals(value: JsonValue | undefined, expected: Rational): boolean {
  if (typeof value !== 'string') return false;
  const parsed = parseValue(value);
  return parsed !== null && parsed.equals(expected);
}

/** args `{ value, row? }`에 해당 줄의 도착 값이 그 값인가. */
export const landingIs: EnginePredicate = (
  observation: Observation,
  args: JsonValue | undefined,
): boolean => {
  const record = payloadRecord(args);
  if (!record) return false;
  const expected = parseValue(stringField(record, 'value') ?? undefined);
  if (!expected) return false;
  const row = rowRecord(observation, rowArg(record));
  if (!row) return false;
  return rationalFieldEquals(row['landing'], expected);
};

/** args `{ count, row? }`에 해당 줄의 뛴 횟수가 그 수인가. */
export const hopCountIs: EnginePredicate = (
  observation: Observation,
  args: JsonValue | undefined,
): boolean => {
  const record = payloadRecord(args);
  if (!record) return false;
  const count = numberField(record, 'count');
  if (count === null) return false;
  const row = rowRecord(observation, rowArg(record));
  if (!row) return false;
  const actual = row['hopCount'];
  return typeof actual === 'number' && actual === count;
};

/** args `{ value, row? }`에 해당 줄의 뛰기 크기가 그 값인가. */
export const stepIs: EnginePredicate = (
  observation: Observation,
  args: JsonValue | undefined,
): boolean => {
  const record = payloadRecord(args);
  if (!record) return false;
  const expected = parseValue(stringField(record, 'value') ?? undefined);
  if (!expected) return false;
  const row = rowRecord(observation, rowArg(record));
  if (!row) return false;
  return rationalFieldEquals(row['step'], expected);
};

/** args `{ value, result, method? }`로 어림했는가. */
export const roundedTo: EnginePredicate = (
  observation: Observation,
  args: JsonValue | undefined,
): boolean => {
  const record = payloadRecord(args);
  if (!record) return false;
  const value = parseValue(stringField(record, 'value') ?? undefined);
  const result = parseValue(stringField(record, 'result') ?? undefined);
  if (!value || !result) return false;
  const method = stringField(record, 'method');
  const items = observation['rounding'];
  if (!Array.isArray(items)) return false;
  return items.some((entry) => {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) return false;
    if (!rationalFieldEquals(entry['value'], value)) return false;
    if (!rationalFieldEquals(entry['marker'], result)) return false;
    if (method === null) return true;
    const actual = entry['method'];
    return typeof actual === 'string' && actual === method;
  });
};

function placedValues(observation: Observation): Rational[] {
  const values: Rational[] = [];
  const points = observation['points'];
  if (Array.isArray(points)) {
    for (const entry of points) {
      if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) continue;
      const parsed = parseValue(typeof entry['value'] === 'string' ? entry['value'] : undefined);
      if (parsed) values.push(parsed);
    }
  }
  const cards = observation['cards'];
  if (cards !== null && typeof cards === 'object' && !Array.isArray(cards)) {
    for (const raw of Object.values(cards)) {
      const parsed = parseValue(typeof raw === 'string' ? raw : undefined);
      if (parsed) values.push(parsed);
    }
  }
  return values;
}

/** args `{ value, within }`: |점 − value| ≤ within 인 점(또는 꽂힌 카드)이 있는가. */
export const hasPointNear: EnginePredicate = (
  observation: Observation,
  args: JsonValue | undefined,
): boolean => {
  const record = payloadRecord(args);
  if (!record) return false;
  const expected = parseValue(stringField(record, 'value') ?? undefined);
  const within = parseValue(stringField(record, 'within') ?? undefined);
  if (!expected || !within || within.isNegative()) return false;
  return placedValues(observation).some(
    (value) => value.sub(expected).abs().compareTo(within) <= 0,
  );
};

/** args `{ level }`: log-zoom의 현재 단계가 그 값인가. */
export const levelIs: EnginePredicate = (
  observation: Observation,
  args: JsonValue | undefined,
): boolean => {
  const record = payloadRecord(args);
  if (!record) return false;
  const level = numberField(record, 'level');
  const actual = observation['level'];
  return level !== null && typeof actual === 'number' && actual === level;
};

/** args `{ top, bottom }`: 그 대응 쌍이 있는가. */
export const hasPair: EnginePredicate = (
  observation: Observation,
  args: JsonValue | undefined,
): boolean => {
  const record = payloadRecord(args);
  if (!record) return false;
  const top = parseValue(stringField(record, 'top') ?? undefined);
  const bottom = parseValue(stringField(record, 'bottom') ?? undefined);
  if (!top || !bottom) return false;
  const pairs = observation['pairs'];
  if (!Array.isArray(pairs)) return false;
  return pairs.some((entry) => {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) return false;
    return rationalFieldEquals(entry['top'], top) && rationalFieldEquals(entry['bottom'], bottom);
  });
};

export const predicates: Readonly<Record<string, EnginePredicate>> = {
  hasPointAt,
  onlyPointAt,
  cardsCorrect,
  samePoint,
  jumpTotalIs,
  // T080
  frogAtIs,
  frogJumpCountIs,
  frogJumpTotalIs,
  // T048
  landingIs,
  hopCountIs,
  stepIs,
  roundedTo,
  hasPointNear,
  levelIs,
  hasPair,
};
