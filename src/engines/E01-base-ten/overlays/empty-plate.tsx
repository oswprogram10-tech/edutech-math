/**
 * 힌트 ②: 지금 나누는 자리에 블록이 안 간 접시를 점선으로 강조한다(MC-DIV-QUOTIENT-ZERO).
 * 접시 번호나 값은 쓰지 않는다.
 */
import type { OverlayProps } from '../../../core/engine-sdk';
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import { dividePlateRects } from '../layout';
import type { BaseTenConfig, BaseTenState, BlockValue } from '../types';

const ORDER: readonly BlockValue[] = [1000, 100, 10, 1];

export function EmptyPlateOverlay({ state }: OverlayProps<BaseTenConfig, BaseTenState>) {
  const plates = state.divide?.plates ?? 0;
  if (plates === 0) return null;

  const pileValues = new Set(
    state.blocks.filter((block) => block.plate === undefined).map((block) => block.value),
  );
  const focus = ORDER.find((value) => pileValues.has(value));
  if (focus === undefined) return null;

  const rects = dividePlateRects(plates);
  return (
    <CanvasAlignedOverlay
      canvasSelector={'svg[data-testid="base-ten-canvas"]'}
      logicalWidth={1000}
      logicalHeight={600}
    >
      {rects.map((rect, index) => {
        const hasBlock = state.blocks.some(
          (block) => block.plate === index && block.value === focus,
        );
        if (hasBlock) return null;
        return (
          <rect
            key={`empty-${index}`}
            x={rect.x + 4}
            y={rect.y + 4}
            width={rect.width - 8}
            height={rect.height - 8}
            rx={16}
            fill="#e8872e"
            fillOpacity={0.07}
            stroke="#e8872e"
            strokeWidth={3}
            strokeDasharray="12 8"
          />
        );
      })}
    </CanvasAlignedOverlay>
  );
}
