/**
 * 힌트 ②: 접시별 값을 높이 막대로만 보여 준다(숫자 없이).
 * 같은 높이인지 눈으로 비교하게 한다.
 */
import { Rational } from '../../../core/math';
import type { OverlayProps } from '../../../core/engine-sdk';
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import { dividePlateRects } from '../layout';
import type { BaseTenConfig, BaseTenState } from '../types';
import { rationalOfShape } from '../value';

function plateTotals(state: BaseTenState, plates: number): Rational[] {
  return Array.from({ length: plates }, (_, plate) => {
    let total = Rational.of(0);
    for (const block of state.blocks) {
      if (block.plate !== plate) continue;
      total = total.add(rationalOfShape(block.value, state.settings.interpretation));
    }
    return total;
  });
}

export function PlateLevelsOverlay({ state }: OverlayProps<BaseTenConfig, BaseTenState>) {
  const plates = state.divide?.plates ?? 0;
  if (plates === 0) return null;
  const totals = plateTotals(state, plates);
  const max = totals.reduce(
    (current, value) => (value.compareTo(current) > 0 ? value : current),
    Rational.of(0),
  );
  const rects = dividePlateRects(plates);

  return (
    <CanvasAlignedOverlay
      canvasSelector={'svg[data-testid="base-ten-canvas"]'}
      logicalWidth={1000}
      logicalHeight={600}
    >
      {rects.map((rect, index) => {
        const total = totals[index] ?? Rational.of(0);
        const fraction = max.isZero() ? Rational.of(0) : total.div(max);
        const ratio = Number(fraction.n) / Number(fraction.d);
        const height = Math.round(160 * Math.max(0, Math.min(1, ratio)));
        const width = Math.max(20, Math.min(44, rect.width / 4));
        const baseline = rect.y + rect.height - 16;
        return (
          <g key={`level-${index}`}>
            <line
              x1={rect.x + 10}
              y1={baseline}
              x2={rect.x + rect.width - 10}
              y2={baseline}
              stroke="#1d4fa8"
              strokeOpacity={0.35}
              strokeWidth={2}
            />
            {height > 0 ? (
              <rect
                x={rect.x + rect.width / 2 - width / 2}
                y={baseline - height}
                width={width}
                height={height}
                rx={6}
                fill="#2f6fde"
                fillOpacity={0.32}
                stroke="#1d4fa8"
                strokeWidth={2}
              />
            ) : null}
          </g>
        );
      })}
    </CanvasAlignedOverlay>
  );
}
