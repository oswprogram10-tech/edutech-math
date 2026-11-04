/** 힌트 ②: 짝짓기 연출을 다시 보이고, 남는 1명을 깃발 없이 윤곽으로 강조한다. */
import type { OverlayProps } from '../../../core/engine-sdk';
import { PAIRING_ICON_RADIUS, pairingPoint } from '../layout';
import type { CountersConfig, CountersState } from '../types';

const ICON_RADIUS = PAIRING_ICON_RADIUS;

export function PairMarchOverlay({ state }: OverlayProps<CountersConfig, CountersState>) {
  if (state.mode !== 'pairing') return null;
  const pairs = Array.from({ length: Math.floor(state.count / 2) }, (_, pair) => pair);
  const leftover = state.count % 2 === 1 ? state.count - 1 : null;
  return (
    <svg viewBox="0 0 1000 600" width="100%" height="100%" aria-hidden="true">
      {pairs.map((pair) => {
        const first = pairingPoint(pair * 2);
        const second = pairingPoint(pair * 2 + 1);
        return (
          <g key={`march-${pair}`}>
            <line
              x1={first.x + ICON_RADIUS}
              y1={first.y}
              x2={second.x - ICON_RADIUS}
              y2={second.y}
              stroke="#2f9e6b"
              strokeWidth={5}
              strokeDasharray="10 7"
              strokeLinecap="round"
            />
            <circle
              cx={first.x}
              cy={first.y}
              r={ICON_RADIUS + 6}
              fill="none"
              stroke="#2f9e6b"
              strokeWidth={2}
            />
            <circle
              cx={second.x}
              cy={second.y}
              r={ICON_RADIUS + 6}
              fill="none"
              stroke="#2f9e6b"
              strokeWidth={2}
            />
          </g>
        );
      })}
      {leftover !== null ? (
        <circle
          cx={pairingPoint(leftover).x}
          cy={pairingPoint(leftover).y}
          r={ICON_RADIUS + 10}
          fill="none"
          stroke="#e8872e"
          strokeWidth={4}
          strokeDasharray="8 6"
        />
      ) : null}
    </svg>
  );
}
