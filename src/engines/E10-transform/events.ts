/**
 * E10의 공개 이벤트·판정. 둘 다 순수 함수다.
 *
 * 이벤트: `moved {kind}`, `target-reached`, `prediction-confirmed {matches}`.
 */
import type { EngineEvent, EnginePredicate, JsonValue, Observation } from '../../core/engine-sdk';
import { observe } from './observe';
import type { TransformState } from './types';

function recordOf(value: JsonValue | undefined): Readonly<Record<string, JsonValue>> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  return value;
}

function argsRecord(args: JsonValue | undefined): Readonly<Record<string, JsonValue>> {
  return recordOf(args) ?? {};
}

function numberArg(args: Readonly<Record<string, JsonValue>>, key: string): number | null {
  const value = args[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function stringArg(args: Readonly<Record<string, JsonValue>>, key: string): string | null {
  const value = args[key];
  return typeof value === 'string' ? value : null;
}

function arrayOf(value: JsonValue | undefined): readonly JsonValue[] {
  return Array.isArray(value) ? value : [];
}

function moveRecords(observation: Observation): readonly Readonly<Record<string, JsonValue>>[] {
  return arrayOf(observation['moves'])
    .map((item) => recordOf(item))
    .filter((item): item is Readonly<Record<string, JsonValue>> => item !== null);
}

export const predicates: Readonly<Record<string, EnginePredicate>> = {
  reachedTarget: (observation, args) => {
    if (observation['atTarget'] !== true) return false;
    const record = argsRecord(args);
    const moves = numberArg(record, 'moves');
    const maxMoves = numberArg(record, 'maxMoves');
    const moveCount = observation['moveCount'];
    if (typeof moveCount !== 'number') return false;
    if (moves !== null && moveCount !== moves) return false;
    if (maxMoves !== null && moveCount > maxMoves) return false;
    return true;
  },

  orientationIs: (observation, args) => {
    const orientation = stringArg(argsRecord(args), 'orientation');
    return orientation !== null && observation['orientation'] === orientation;
  },

  usedMove: (observation, args) => {
    const record = argsRecord(args);
    const kind = stringArg(record, 'kind');
    if (kind === null) return false;
    const direction = stringArg(record, 'direction');
    const angle = numberArg(record, 'angle');
    const side = stringArg(record, 'side');
    return moveRecords(observation).some((move) => {
      if (move['kind'] !== kind) return false;
      if (direction !== null && move['direction'] !== direction) return false;
      if (angle !== null && move['angle'] !== angle) return false;
      if (side !== null && move['side'] !== side) return false;
      return true;
    });
  },

  predictionMatches: (observation, args) => {
    if (observation['matches'] !== true) return false;
    if (argsRecord(args)['confirmed'] === true) return observation['confirmed'] === true;
    return true;
  },

  predictedOrientation: (observation, args) => {
    const expected = stringArg(argsRecord(args), 'is');
    return expected !== null && observation['paintedOrientation'] === expected;
  },

  predictionOffsetOnly: (observation) => observation['offsetOnly'] === true,
};

export const EVENT_NAMES = ['moved', 'target-reached', 'prediction-confirmed'] as const;

export function emit(prev: TransformState, next: TransformState): EngineEvent[] {
  if (prev === next) return [];
  const events: EngineEvent[] = [];

  if (prev.mode === 'slide-flip-turn' && next.mode === 'slide-flip-turn') {
    if (next.moves !== prev.moves && next.moves.length >= prev.moves.length) {
      const last = next.moves[next.moves.length - 1];
      if (last) events.push({ name: 'moved', payload: { kind: last.kind } });
    }
    const before = observe(prev);
    const after = observe(next);
    if (before['atTarget'] !== true && after['atTarget'] === true) {
      events.push({ name: 'target-reached' });
    }
  }

  if (prev.mode === 'predict' && next.mode === 'predict') {
    if (prev.confirmed !== true && next.confirmed === true) {
      events.push({
        name: 'prediction-confirmed',
        payload: { matches: observe(next)['matches'] === true },
      });
    }
  }

  return events;
}
