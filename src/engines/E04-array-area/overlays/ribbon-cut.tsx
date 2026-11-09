/**
 * 힌트 ②: scaler에서 곱하는 수가 1보다 작을 때 원래 리본이 그 비율 지점에서
 * 잘리는 장면을 보여 준다(MC-MULT-ALWAYS-BIGGER). 길이 숫자는 쓰지 않는다.
 */
import { Rational } from '../../../core/math';
import type { OverlayProps } from '../../../core/engine-sdk';
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { ArrayAreaConfig, ArrayAreaState } from '../types';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';

function ratioOf(text: string): number {
  try {
    const value = Rational.parse(text);
    return Number(value.n) / Number(value.d);
  } catch {
    return 1;
  }
}

export function RibbonCutOverlay({ state }: OverlayProps<ArrayAreaConfig, ArrayAreaState>) {
  if (state.mode !== 'fraction-area' || state.scaler === null || state.scaler.index === null) {
    return null;
  }
  const multiplier = state.settings.multipliers[state.scaler.index];
  if (multiplier === undefined) return null;
  const ratio = ratioOf(multiplier);
  if (!(ratio < 1)) return null;

  const base = state.settings.base;
  const maxRatio = Math.max(1, ...state.settings.multipliers.map(ratioOf));
  const pxPerUnit = 560 / Math.max(1, base * maxRatio);
  const x = 150;
  const y = 110;
  const width = base * pxPerUnit;
  const cut = x + width * ratio;

  return (
    <CanvasAlignedOverlay
      canvasSelector={'svg[data-testid="array-canvas"]'}
      logicalWidth={LOGICAL_WIDTH}
      logicalHeight={LOGICAL_HEIGHT}
    >
      <defs>
        <pattern
          id="e04-ribbon-cut-hatch"
          width={9}
          height={9}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line x1={0} y1={0} x2={0} y2={9} stroke="#c2410c" strokeWidth={2.4} />
        </pattern>
      </defs>
      <rect
        x={cut}
        y={y}
        width={Math.max(0, x + width - cut)}
        height={64}
        fill="url(#e04-ribbon-cut-hatch)"
        fillOpacity={0.3}
        stroke="#c2410c"
        strokeWidth={2}
        strokeDasharray="8 5"
      />
      <line x1={cut} y1={y - 10} x2={cut} y2={y + 74} stroke="#c2410c" strokeWidth={4} />
      <polygon
        points={`${cut - 9},${y - 10} ${cut + 9},${y - 10} ${cut},${y + 2}`}
        fill="#c2410c"
      />
    </CanvasAlignedOverlay>
  );
}
