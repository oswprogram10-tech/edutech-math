/** 힌트 ②: bridge에서 10칸 표시선까지 남은 빈칸을 점선 동그라미로 보여 준다. */
import type { OverlayProps } from '../../../core/engine-sdk';
import { bridgeCellWidth, BRIDGE_GROUND_Y, BRIDGE_START_X } from '../layout';
import type { CountersConfig, CountersState } from '../types';

export function TenGapOverlay({ config, state }: OverlayProps<CountersConfig, CountersState>) {
  if (!(state.mode === 'part-whole' && 'variant' in state && state.variant === 'bridge')) {
    return null;
  }
  if (config.tenMarker !== true || state.gap <= 10) return null;
  const sum = state.placed.reduce((total, length) => total + length, 0);
  if (sum >= 10) return null;
  const cell = bridgeCellWidth(Math.max(state.gap, sum, 10));
  const remaining = 10 - sum;
  return (
    <svg viewBox="0 0 1000 600" width="100%" height="100%" aria-hidden="true">
      {Array.from({ length: remaining }, (_, index) => (
        <circle
          key={`gap-${index}`}
          cx={BRIDGE_START_X + (sum + index) * cell + cell / 2}
          cy={BRIDGE_GROUND_Y - 70}
          r={Math.max(8, cell / 2 - 4)}
          fill="none"
          stroke="#e8872e"
          strokeWidth={2.5}
          strokeDasharray="6 5"
        />
      ))}
    </svg>
  );
}
