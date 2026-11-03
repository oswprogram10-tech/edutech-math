/**
 * 힌트 ②: 같은 값 블록 열 개 자리를 점선 윤곽으로 보여 준다.
 * 이미 있는 블록 수만큼은 옅게 채워, 몇 개가 모자라는지 눈으로 보게 한다.
 * 목표 수나 정답 숫자는 쓰지 않는다.
 */
import type { OverlayProps } from '../../../core/engine-sdk';
import { blockSize } from '../layout';
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
  const size = blockSize(value);
  const columns = 5;
  const stepX = size.width + 26;
  const stepY = size.height + 22;
  const originX = 500 - ((columns - 1) * stepX) / 2;
  const originY = 250;

  return (
    <svg viewBox="0 0 1000 600" width="100%" height="100%" aria-hidden="true">
      {Array.from({ length: 10 }, (_, index) => {
        const column = index % columns;
        const row = Math.floor(index / columns);
        const x = originX + column * stepX - size.width / 2;
        const y = originY + row * stepY - size.height / 2;
        const filled = index < Math.min(count, 10);
        return (
          <rect
            key={`ten-${index}`}
            x={x}
            y={y}
            width={size.width}
            height={size.height}
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
    </svg>
  );
}
