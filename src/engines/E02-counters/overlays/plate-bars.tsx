/** 힌트 ②: share에서 접시마다 담긴 수를 숫자 없이 높이 막대로 나란히 보여 준다. */
import type { OverlayProps } from '../../../core/engine-sdk';
import { sharePlateCenter } from '../layout';
import type { CountersConfig, CountersState } from '../types';

const BASELINE = 430;
const MAX_HEIGHT = 190;
const BAR_WIDTH = 48;

export function PlateBarsOverlay({ state }: OverlayProps<CountersConfig, CountersState>) {
  if (state.mode !== 'share') return null;
  const max = Math.max(1, ...state.plates);
  return (
    <svg viewBox="0 0 1000 600" width="100%" height="100%" aria-hidden="true">
      {state.plates.map((count, plate) => {
        const center = sharePlateCenter(state.groups, plate);
        const height = count === 0 ? 4 : Math.max(12, Math.round((count / max) * MAX_HEIGHT));
        return (
          <rect
            key={`bar-${plate}`}
            x={center.x - BAR_WIDTH / 2}
            y={BASELINE - height}
            width={BAR_WIDTH}
            height={height}
            rx={8}
            fill="#9ec5ff"
            stroke="#2f6fde"
            strokeWidth={2}
          />
        );
      })}
      <line
        x1={100}
        y1={BASELINE}
        x2={900}
        y2={BASELINE}
        stroke="#5b6577"
        strokeWidth={3}
        strokeLinecap="round"
      />
    </svg>
  );
}
