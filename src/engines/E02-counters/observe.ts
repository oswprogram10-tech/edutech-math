/**
 * E02 관찰 결과. 판정·힌트는 이 값만 본다.
 * 화면에 보이지 않는 값(flash의 shown 등)도 판정을 위해 여기에 넣는다.
 */
import type { Observation } from '../../core/engine-sdk';
import {
  bridgeSumOf,
  bubbleAllHitTarget,
  bubbleValuesOf,
  distinctSplitsOf,
  frameFillOf,
  isFull,
  measureOutLooseOf,
  pairingLeftoverOf,
  pairingPairsOf,
  platesOf,
  rekenrekTotalOf,
  shareEqualOf,
  subtractStrategyOf,
  totalOf,
  unpairedOf,
} from './reduce';
import type { CountersConfig, CountersState } from './types';

export function observe(state: CountersState, config: CountersConfig): Observation {
  const total = totalOf(state);
  const base = { mode: state.mode, total };

  switch (state.mode) {
    case 'summon':
      return {
        ...base,
        shelf: config.shelf ?? true,
      };

    case 'ten-frame': {
      const frameFill = frameFillOf(state);
      return {
        ...base,
        frameFill,
        full: frameFill.map((count) => count >= 10),
        moves: state.moves,
        bond: state.bond ? [...state.bond] : null,
        madeTenFirst: state.madeTenFirst,
        subtractStrategy: subtractStrategyOf(state),
        fullFrames: Array.from({ length: state.frames }, (_, frame) => isFull(state, frame)),
      };
    }

    case 'part-whole': {
      if ('variant' in state) {
        if (state.variant === 'bridge') {
          const sum = bridgeSumOf(state);
          return {
            ...base,
            placed: [...state.placed],
            sum,
            gap: state.gap,
            fits: sum === state.gap,
            recorded: state.recorded.map((entry) => [...entry]),
            distinctBridges: state.recorded.length,
          };
        }
        return {
          ...base,
          pops: state.pops.map((values) => [...values]),
          popCount: state.pops.length,
          allPopsHitTarget: bubbleAllHitTarget(state),
          streak: state.streak,
          bestStreak: state.bestStreak,
          misses: state.misses,
          remaining: bubbleValuesOf(state),
        };
      }
      const plates = platesOf(state);
      return {
        ...base,
        plates,
        recorded: state.recorded.map(([a, b]) => [a, b]),
        distinctSplits: distinctSplitsOf(state),
        pairs: state.pairs.length,
        unpaired: unpairedOf(state),
      };
    }

    case 'flash':
      return {
        ...base,
        phase: state.phase,
        shown: state.shown,
        layout: state.layout,
      };

    case 'rekenrek':
      return {
        ...base,
        rows: [...state.left],
        total: rekenrekTotalOf(state),
        history: [...state.history],
        reached: [...state.reached],
        fullRowPushes: state.fullRowPushes,
        moves: state.moves,
      };

    case 'pairing':
      return {
        ...base,
        phase: state.phase,
        prediction: state.prediction,
        paired: state.phase === 'paired',
        pairs: pairingPairsOf(state),
        leftover: pairingLeftoverOf(state),
      };

    case 'share':
      return {
        ...base,
        plates: [...state.plates],
        pile: state.pile,
        equal: shareEqualOf(state),
        rounds: state.rounds,
      };

    case 'measure-out':
      return {
        ...base,
        groupSize: state.groupSize,
        bags: state.bagCount,
        loose: measureOutLooseOf(state),
        lastAttempt: state.lastAttempt ? { ...state.lastAttempt } : null,
      };
  }
}
