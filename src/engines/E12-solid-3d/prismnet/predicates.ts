/**
 * E12 `prism-net` predicate · 이벤트 생성(순수 함수). 다른 모드 관찰에서는 모두 false다.
 */
import type {
  EngineEvent,
  EnginePredicate,
  JsonValue,
  Observation,
} from '../../../core/engine-sdk';
import type { PrismNetState } from '../types';
import { evaluateState } from './observe';

function isRecord(value: JsonValue | undefined): value is Readonly<Record<string, JsonValue>> {
  return (
    value !== null && value !== undefined && typeof value === 'object' && !Array.isArray(value)
  );
}

function evaluationOf(observation: Observation): Readonly<Record<string, JsonValue>> | null {
  if (observation['mode'] !== 'prism-net') return null;
  const evaluation = observation['evaluation'];
  return isRecord(evaluation) ? evaluation : null;
}

function readCount(observation: Observation, name: 'base' | 'rect'): number | null {
  const value = observation['pieceCount'];
  if (!isRecord(value)) return null;
  const n = value[name];
  return typeof n === 'number' ? n : null;
}

const PROBLEM_KEYS = {
  duplicate: 'duplicates',
  mismatch: 'mismatch',
  overlap: 'paperOverlap',
  missing: 'missing',
} as const;

export const prismNetPredicates: Readonly<Record<string, EnginePredicate>> = {
  prismNetValid: (observation) => evaluationOf(observation)?.['valid'] === true,

  prismNetFoldedValid: (observation) =>
    evaluationOf(observation)?.['valid'] === true && observation['folded'] === true,

  prismNetBothBasesSameEnd: (observation) =>
    evaluationOf(observation)?.['bothBasesSameEnd'] === true,

  prismNetPieceCountIs: (observation, args) => {
    if (observation['mode'] !== 'prism-net' || !isRecord(args)) return false;
    const base = args['base'];
    const rect = args['rect'];
    if (base === undefined && rect === undefined) return false;
    for (const [name, want] of [
      ['base', base],
      ['rect', rect],
    ] as const) {
      if (want === undefined) continue;
      if (typeof want !== 'number' || !Number.isInteger(want)) return false;
      if (readCount(observation, name) !== want) return false;
    }
    return true;
  },

  prismNetHasProblem: (observation, args) => {
    const evaluation = evaluationOf(observation);
    if (!evaluation || !isRecord(args)) return false;
    const kind = args['kind'];
    if (kind !== 'duplicate' && kind !== 'mismatch' && kind !== 'overlap' && kind !== 'missing') {
      return false;
    }
    const count = evaluation[PROBLEM_KEYS[kind]];
    return typeof count === 'number' && count >= 1;
  },
};

export function emitPrismNet(prev: PrismNetState, next: PrismNetState): EngineEvent[] {
  const events: EngineEvent[] = [];

  if (next.pieces.length > prev.pieces.length) {
    const prevIds = new Set(prev.pieces.map((p) => p.id));
    for (const piece of next.pieces) {
      if (!prevIds.has(piece.id)) {
        events.push({ name: 'piece-attached', payload: { type: piece.type } });
      }
    }
  } else if (next.pieces.length < prev.pieces.length) {
    const nextIds = new Set(next.pieces.map((p) => p.id));
    for (const piece of prev.pieces) {
      if (!nextIds.has(piece.id)) events.push({ name: 'piece-removed', payload: {} });
    }
  }

  if (!prev.folded && next.folded) {
    events.push({ name: 'prism-net-folded', payload: { valid: evaluateState(next).valid } });
  } else if (prev.folded && !next.folded) {
    events.push({ name: 'prism-net-unfolded', payload: {} });
  }
  return events;
}
