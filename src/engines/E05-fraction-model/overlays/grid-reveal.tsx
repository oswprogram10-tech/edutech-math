/**
 * 힌트 ②: 공통 격자 선만 보여 준다. 정답 칸은 절대 칠하지 않는다.
 */
import type { OverlayProps } from '../../../core/engine-sdk';
import { denominatorNumber, lcm, parseFraction } from '../fractions';
import type { FractionModelConfig, FractionModelState } from '../types';

const ORIGIN = { x: 260, y: 110 };
const SIZE = 360;

function gridOf(state: FractionModelState): number | null {
  if (state.mode === 'overlay-slicer') {
    const a = parseFraction(state.a, '1/2');
    const b = parseFraction(state.b, '1/3');
    const da = denominatorNumber(a);
    const db = denominatorNumber(b);
    if (da === null || db === null) return null;
    return lcm(da, db);
  }
  if (state.mode === 'shade') return state.parts;
  if (state.mode === 'add-sub') {
    const a = parseFraction(state.a, '1/2');
    const b = parseFraction(state.b, '1/3');
    const da = denominatorNumber(a);
    const db = denominatorNumber(b);
    if (da === null || db === null) return null;
    return lcm(da, db);
  }
  return null;
}

export function GridRevealOverlay({
  state,
}: OverlayProps<FractionModelConfig, FractionModelState>) {
  const grid = gridOf(state);
  if (grid === null || grid < 2) return null;
  const step = SIZE / grid;
  return (
    <svg
      viewBox="0 0 1000 600"
      width="100%"
      height="100%"
      data-testid="overlay-grid-reveal"
      aria-hidden="true"
    >
      <rect
        x={ORIGIN.x - 8}
        y={ORIGIN.y - 8}
        width={SIZE + 16}
        height={SIZE + 16}
        rx={12}
        fill="#ffffff"
        opacity={0.9}
      />
      {Array.from({ length: grid + 1 }, (_, index) => (
        <g key={`grid-line-${index}`}>
          <line
            x1={ORIGIN.x + index * step}
            y1={ORIGIN.y}
            x2={ORIGIN.x + index * step}
            y2={ORIGIN.y + SIZE}
            stroke="#1d2330"
            strokeWidth={1.5}
            strokeDasharray="6 6"
            opacity={0.7}
          />
          <line
            x1={ORIGIN.x}
            y1={ORIGIN.y + index * step}
            x2={ORIGIN.x + SIZE}
            y2={ORIGIN.y + index * step}
            stroke="#1d2330"
            strokeWidth={1.5}
            strokeDasharray="6 6"
            opacity={0.7}
          />
        </g>
      ))}
    </svg>
  );
}
