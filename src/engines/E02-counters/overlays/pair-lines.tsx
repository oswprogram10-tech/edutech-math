/** 힌트 ②: 짝이 없는 셈돌을 강조한다. */
import type { OverlayProps } from '../../../core/engine-sdk';
import { plateSlotPoint } from '../layout';
import type { CountersConfig, CountersState } from '../types';

export function PairLinesOverlay({ state }: OverlayProps<CountersConfig, CountersState>) {
  if (state.mode !== 'part-whole') return null;
  const paired = new Set(state.pairs.flat());
  const unpaired = state.counters.filter((counter) => !paired.has(counter.id));
  if (unpaired.length === 0) return null;
  return (
    <svg viewBox="0 0 1000 600" width="100%" height="100%" aria-hidden="true">
      {unpaired.map((counter) => {
        const point = plateSlotPoint(state.plates, counter.plate, counter.slot);
        return (
          <circle
            key={counter.id}
            cx={point.x}
            cy={point.y}
            r={32}
            fill="none"
            stroke="#e8872e"
            strokeWidth={3.5}
            strokeDasharray="8 5"
          />
        );
      })}
    </svg>
  );
}
