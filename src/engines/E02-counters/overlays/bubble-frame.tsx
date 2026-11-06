/** 힌트 ②: 지금 고른 방울 수만큼 텐프레임에 점을 찍고 빈칸을 점선으로 보여 준다. */
import type { OverlayProps } from '../../../core/engine-sdk';
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { CountersConfig, CountersState } from '../types';

const CELL = 34;
const LEFT = 40;
const TOP = 430;
const COLS = 5;

export function BubbleFrameOverlay({ state }: OverlayProps<CountersConfig, CountersState>) {
  if (!(state.mode === 'part-whole' && 'variant' in state && state.variant === 'bubble-pairs')) {
    return null;
  }
  const selected = state.selected.length;
  return (
    <CanvasAlignedOverlay
      canvasSelector={'svg[data-testid="counters-canvas"]'}
      logicalWidth={1000}
      logicalHeight={600}
    >
      <rect
        x={LEFT - 8}
        y={TOP - 8}
        width={COLS * CELL + 16}
        height={2 * CELL + 16}
        rx={14}
        fill="#ffffff"
        fillOpacity={0.75}
        stroke="#2f6fde"
        strokeWidth={3}
      />
      {Array.from({ length: 10 }, (_, cell) => {
        const x = LEFT + (cell % COLS) * CELL + CELL / 2;
        const y = TOP + Math.floor(cell / COLS) * CELL + CELL / 2;
        if (cell < selected) {
          return <circle key={`dot-${cell}`} cx={x} cy={y} r={11} fill="#2f6fde" />;
        }
        return (
          <circle
            key={`slot-${cell}`}
            cx={x}
            cy={y}
            r={11}
            fill="none"
            stroke="#9aa6ba"
            strokeWidth={2}
            strokeDasharray="4 4"
          />
        );
      })}
    </CanvasAlignedOverlay>
  );
}
