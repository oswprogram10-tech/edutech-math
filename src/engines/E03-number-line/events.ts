/**
 * E03의 공개 이벤트·판정. 둘 다 순수 함수다.
 *
 * `value-changed` payload는 다른 엔진과 맞추기 위해 정확히 `{ value: "<Rational>" }`다.
 */
import { Rational } from '../../core/math/rational';
import type { EngineEvent, EnginePredicate, JsonValue, Observation } from '../../core/engine-sdk';
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

export const predicates: Readonly<Record<string, EnginePredicate>> = {
  hasPointAt,
  cardsCorrect,
  samePoint,
  jumpTotalIs,
};
