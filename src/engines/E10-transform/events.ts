/**
 * E10의 공개 이벤트·판정. 둘 다 순수 함수다.
 *
 * 이벤트: `moved`, `target-reached`, `prediction-confirmed`,
 * `tile-placed`, `gap-shown`, `covered-fully`, `overlapped`, `folded`,
 * `center-found`, `completed`.
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

function stringArray(value: JsonValue | undefined): string[] {
  return arrayOf(value).filter((item): item is string => typeof item === 'string');
}

function moveRecords(observation: Observation): readonly Readonly<Record<string, JsonValue>>[] {
  return arrayOf(observation['moves'])
    .map((item) => recordOf(item))
    .filter((item): item is Readonly<Record<string, JsonValue>> => item !== null);
}

function shapeRecords(observation: Observation): readonly Readonly<Record<string, JsonValue>>[] {
  return arrayOf(observation['shapes'])
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

  fullCover: (observation, args) => {
    if (observation['coverage'] !== '1') return false;
    if (observation['overlapCells'] !== 0) return false;
    const tile = stringArg(argsRecord(args), 'tile');
    if (tile === null) return true;
    const placed = stringArray(observation['placedTiles']);
    return placed.length > 0 && placed.every((item) => item === tile);
  },

  movesUsedInclude: (observation, args) => {
    const kinds = stringArray(argsRecord(args)['kinds']);
    if (kinds.length === 0) return false;
    const used = stringArray(observation['movesUsed']);
    return kinds.every((kind) => used.includes(kind));
  },

  movesUsedAre: (observation, args) => {
    const kinds = [...new Set(stringArray(argsRecord(args)['kinds']))].sort();
    if (kinds.length === 0) return false;
    const used = [...new Set(stringArray(observation['movesUsed']))].sort();
    return used.length === kinds.length && used.every((kind, index) => kind === kinds[index]);
  },

  pentagonGapSeen: (observation) => {
    const pentagon = recordOf(observation['pentagon']);
    const count = pentagon ? pentagon['count'] : undefined;
    return typeof count === 'number' && count >= 3;
  },

  overlapped: (observation, args) => {
    if (argsRecord(args)['ever'] === true) return observation['everOverlapped'] === true;
    return observation['overlapped'] === true;
  },

  sidePairsMatch: (observation) => observation['sidePairsCorrect'] === true,

  axesFound: (observation, args) => {
    const record = argsRecord(args);
    const shape = stringArg(record, 'shape') ?? stringArg(observation, 'shape');
    const count = numberArg(record, 'count');
    if (shape === null || count === null) return false;
    return shapeRecords(observation).some((item) => {
      const found = item['axesFound'];
      return item['id'] === shape && typeof found === 'number' && found >= count;
    });
  },

  triedDiagonalAxis: (observation, args) => {
    const shape = stringArg(argsRecord(args), 'shape');
    const records = shapeRecords(observation);
    if (shape === null) return records.some((item) => item['diagonalTried'] === true);
    return records.some((item) => item['id'] === shape && item['diagonalTried'] === true);
  },

  lastFoldOk: (observation) => {
    const last = recordOf(observation['lastFold']);
    return last !== null && last['ok'] === true;
  },

  centerFound: (observation, args) => {
    const found = stringArray(observation['centerFound']);
    const shape = stringArg(argsRecord(args), 'shape');
    return shape === null ? found.length > 0 : found.includes(shape);
  },

  flipUsed: (observation) => observation['flipUsed'] === true,

  completedSymmetric: (observation) =>
    observation['closed'] === true && observation['symmetric'] === true,
};

export const EVENT_NAMES = [
  'moved',
  'target-reached',
  'prediction-confirmed',
  'tile-placed',
  'gap-shown',
  'covered-fully',
  'overlapped',
  'folded',
  'center-found',
  'completed',
] as const;

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

  if (prev.mode === 'tessellation' && next.mode === 'tessellation') {
    const before = observe(prev);
    const after = observe(next);
    if (next.placed.length > prev.placed.length) {
      const last = next.placed[next.placed.length - 1];
      if (last) {
        events.push({ name: 'tile-placed', payload: { tile: last.tile } });
        if (after['coverage'] === '1' && after['overlapCells'] === 0) {
          events.push({ name: 'covered-fully', payload: { tile: last.tile } });
        }
      }
    }
    if (prev.checked !== true && next.checked === true) {
      const gaps = after['gapCells'];
      if (typeof gaps === 'number' && gaps > 0) {
        events.push({
          name: 'gap-shown',
          payload: { tile: after['tile'] ?? 'square', gaps },
        });
      }
    }
    if (prev.hub < 3 && next.hub >= 3) {
      const pentagon = recordOf(after['pentagon']);
      const gapDegrees = pentagon ? pentagon['gapDegrees'] : undefined;
      events.push({
        name: 'gap-shown',
        payload: {
          tile: 'pentagon-regular',
          gaps: typeof gapDegrees === 'number' ? gapDegrees : 0,
        },
      });
    }
    void before;
  }

  if (prev.mode === 'congruence' && next.mode === 'congruence') {
    const before = observe(prev);
    const after = observe(next);
    if (before['overlapped'] !== true && after['overlapped'] === true) {
      events.push({ name: 'overlapped' });
    }
  }

  if (prev.mode === 'line-symmetry' && next.mode === 'line-symmetry') {
    if (next.folds.length > prev.folds.length) {
      const last = next.folds[next.folds.length - 1];
      if (last) events.push({ name: 'folded', payload: { ok: last.ok } });
    }
    if (prev.task === 'complete' && next.task === 'complete') {
      const before = observe(prev);
      const after = observe(next);
      if (before['closed'] !== true && after['closed'] === true) {
        events.push({ name: 'completed', payload: { symmetric: after['symmetric'] === true } });
      }
    }
  }

  if (prev.mode === 'point-symmetry' && next.mode === 'point-symmetry') {
    if (next.centerFound.length > prev.centerFound.length) {
      const shape = next.centerFound[next.centerFound.length - 1];
      if (shape) events.push({ name: 'center-found', payload: { shape } });
    }
    if (prev.task === 'complete' && next.task === 'complete') {
      const before = observe(prev);
      const after = observe(next);
      if (before['closed'] !== true && after['closed'] === true) {
        events.push({ name: 'completed', payload: { symmetric: after['symmetric'] === true } });
      }
    }
  }

  return events;
}
