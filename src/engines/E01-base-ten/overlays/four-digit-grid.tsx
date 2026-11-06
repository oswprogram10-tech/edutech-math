/** 힌트 ②: 오른쪽부터 네 자리마다 흐린 세로선을 긋는다(이름표 없이). */
import type { OverlayProps } from '../../../core/engine-sdk';
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import { BIG_STRIP, bigDigitRects } from '../layout';
import type { BaseTenConfig, BaseTenState } from '../types';

export function FourDigitGridOverlay({ state }: OverlayProps<BaseTenConfig, BaseTenState>) {
  const big = state.bigNumber;
  if (!big || big.value.length <= 4) return null;
  const rects = bigDigitRects(big.value.length);

  return (
    <CanvasAlignedOverlay
      canvasSelector={'svg[data-testid="base-ten-canvas"]'}
      logicalWidth={1000}
      logicalHeight={600}
    >
      {rects.map((rect, index) => {
        const position = rects.length - 1 - index;
        if (position % 4 !== 0 || index >= rects.length - 1) return null;
        const next = rects[index + 1];
        if (!next) return null;
        const x = (rect.x + rect.width + next.x) / 2;
        return (
          <line
            key={`grid-${position}`}
            x1={x}
            y1={BIG_STRIP.y + 4}
            x2={x}
            y2={BIG_STRIP.y + BIG_STRIP.height - 4}
            stroke="#2f6fde"
            strokeOpacity={0.35}
            strokeWidth={2}
            strokeDasharray="10 8"
          />
        );
      })}
    </CanvasAlignedOverlay>
  );
}
