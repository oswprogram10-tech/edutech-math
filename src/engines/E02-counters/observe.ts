/**
 * E02 관찰 결과. 판정·힌트는 이 값만 본다.
 * 화면에 보이지 않는 값(flash의 shown 등)도 판정을 위해 여기에 넣는다.
 */
import type { Observation } from '../../core/engine-sdk';
import {
  distinctSplitsOf,
  frameFillOf,
  isFull,
  platesOf,
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
  }
}
