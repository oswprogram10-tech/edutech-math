/**
 * E12 `prism-net` Observation 생성(순수 함수).
 * `cards[].valid`·`evaluation`은 판정용 엔진 계산값이다. 학생 화면에는 쓰지 않는다.
 */
import type { Observation } from '../../../core/engine-sdk';
import type { PrismNetCardSettings, PrismNetState } from '../types';
import {
  buildPiecesFromSteps,
  countPieces,
  evaluatePrismNet,
  type PrismNetEvaluation,
} from './model';
import { remainingCounts } from './reduce';

export function evaluateState(state: PrismNetState): PrismNetEvaluation {
  return evaluatePrismNet(state.pieces, state.settings.n, {
    sideLen: state.settings.sideLen,
    height: state.settings.height,
  });
}

export function evaluateCardValid(
  card: PrismNetCardSettings,
  sizes: { readonly sideLen: number; readonly height: number },
): boolean {
  const pieces = buildPiecesFromSteps(card.root, card.steps, card.n);
  if (!pieces) return false;
  return evaluatePrismNet(pieces, card.n, sizes).valid;
}

export function observePrismNet(state: PrismNetState): Observation {
  const { settings } = state;
  const evaluation = evaluateState(state);
  const counts = countPieces(state.pieces);
  const remaining = remainingCounts(state);
  return {
    mode: state.mode,
    n: settings.n,
    sideLen: settings.sideLen,
    height: settings.height,
    pieceCount: { base: counts.base, rect: counts.rect },
    remaining: { base: remaining.base, rect: remaining.rect },
    folded: state.folded,
    foldCount: state.foldCount,
    evaluation: {
      valid: evaluation.valid,
      missing: evaluation.missing,
      duplicates: evaluation.duplicates.length,
      mismatch: evaluation.mismatch.length,
      paperOverlap: evaluation.paperOverlap.length,
      bothBasesSameEnd: evaluation.bothBasesSameEnd,
    },
    cards: settings.netCards.map((card) => ({
      id: card.id,
      valid: evaluateCardValid(card, settings),
    })),
  };
}
