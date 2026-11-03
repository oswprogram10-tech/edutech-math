/**
 * 힌트 ②: 고른 상위 블록을 풀면 생길 열 조각을 흐리게 미리 보여 준다.
 */
import type { OverlayProps } from '../../../core/engine-sdk';
import { blockRect, blockSize, fanPoints } from '../layout';
import type { BaseTenConfig, BaseTenState, BlockValue } from '../types';
import { BLOCK_VALUES } from '../types';

function targetOf(
  state: BaseTenState,
  args: unknown,
): {
  readonly id: string;
  readonly value: BlockValue;
  readonly x: number;
  readonly y: number;
} | null {
  if (args !== null && typeof args === 'object' && 'id' in args) {
    const id = (args as { readonly id?: unknown }).id;
    if (typeof id === 'string') {
      const found = state.blocks.find((block) => block.id === id);
      if (found) return found;
    }
  }
  for (const value of BLOCK_VALUES) {
    if (value === 1) continue;
    const found = state.blocks.find((block) => block.value === value);
    if (found) return found;
  }
  return null;
}

export function BreakPreviewOverlay({ state, args }: OverlayProps<BaseTenConfig, BaseTenState>) {
  const target = targetOf(state, args);
  if (!target) return null;

  const lower = (target.value / 10) as BlockValue;
  const points = fanPoints({ x: target.x, y: target.y }, lower);
  const size = blockSize(lower);
  const original = blockRect(target);

  return (
    <svg viewBox="0 0 1000 600" width="100%" height="100%" aria-hidden="true">
      <rect
        x={original.x}
        y={original.y}
        width={original.width}
        height={original.height}
        rx={6}
        fill="none"
        stroke="#e8872e"
        strokeWidth={3}
        strokeDasharray="10 6"
      />
      {points.map((point, index) => (
        <rect
          key={`preview-${index}`}
          x={point.x - size.width / 2}
          y={point.y - size.height / 2}
          width={size.width}
          height={size.height}
          rx={5}
          fill="#2f6fde"
          fillOpacity={0.12}
          stroke="#2f6fde"
          strokeWidth={2}
          strokeDasharray="6 5"
        />
      ))}
    </svg>
  );
}
