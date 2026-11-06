/**
 * 힌트 ②: 같은 값 블록 열 개 자리를 점선 윤곽으로 보여 준다.
 * 실제 블록 자리에 윤곽을 맞추고, 모자라는 자리는 그 줄 간격으로 이어 빈 윤곽을 그린다.
 * 이미 있는 블록 수만큼은 옅게 채워, 몇 개가 모자라는지 눈으로 보게 한다.
 * 목표 수나 정답 숫자는 쓰지 않는다.
 */
import type { OverlayProps } from '../../../core/engine-sdk';
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import { tenOutlineRects } from '../layout';
import type { BaseTenConfig, BaseTenState, BlockValue } from '../types';
import { BLOCK_VALUES } from '../types';

function chosenValue(state: BaseTenState, args: unknown): BlockValue {
  if (args !== null && typeof args === 'object' && 'from' in args) {
    const from = (args as { readonly from?: unknown }).from;
    if (from === 1 || from === 10 || from === 100 || from === 1000) return from;
  }
  for (const value of BLOCK_VALUES) {
    if (state.blocks.some((block) => block.value === value)) return value;
  }
  return 1;
}

export function TenOutlineOverlay({ state, args }: OverlayProps<BaseTenConfig, BaseTenState>) {
  const value = chosenValue(state, args);
  const count = state.blocks.filter((block) => block.value === value).length;
  const rects = tenOutlineRects(state, value);

  return (
    <CanvasAlignedOverlay
      canvasSelector={'svg[data-testid="base-ten-canvas"]'}
      logicalWidth={1000}
      logicalHeight={600}
    >
      {rects.map((rect, index) => {
        const filled = index < Math.min(count, 10);
        return (
          <rect
            key={`ten-${index}`}
            x={rect.x}
            y={rect.y}
            width={rect.width}
            height={rect.height}
            rx={6}
            fill={filled ? '#2f6fde' : 'none'}
            fillOpacity={filled ? 0.16 : 0}
            stroke="#2f6fde"
            strokeWidth={2.5}
            strokeDasharray={filled ? undefined : '8 6'}
            strokeOpacity={filled ? 0.55 : 0.85}
          />
        );
      })}
    </CanvasAlignedOverlay>
  );
}
