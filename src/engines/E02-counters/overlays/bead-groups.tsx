/** 힌트 ②: rekenrek에서 민 구슬을 5개·10개 묶음 윤곽으로 보여 준다. 목표 수는 쓰지 않는다. */
import type { OverlayProps } from '../../../core/engine-sdk';
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import { REKENREK_BEAD_GAP, REKENREK_LEFT_X, REKENREK_RIGHT_X, rekenrekRowY } from '../layout';
import type { CountersConfig, CountersState } from '../types';

const BEAD_PAD = 28;

function beadX(slot: number, left: number): number {
  if (slot < left) return REKENREK_LEFT_X + slot * REKENREK_BEAD_GAP;
  return REKENREK_RIGHT_X - (10 - slot - 1) * REKENREK_BEAD_GAP;
}

export function BeadGroupsOverlay({ state }: OverlayProps<CountersConfig, CountersState>) {
  if (state.mode !== 'rekenrek') return null;
  const shapes: { x: number; y: number; width: number; key: string }[] = [];
  state.left.forEach((pushed, row) => {
    if (pushed <= 0) return;
    const y = rekenrekRowY(state.rows, row);
    [0, 5].forEach((start) => {
      const count = Math.min(5, Math.max(0, pushed - start));
      if (count <= 0) return;
      const first = beadX(start, pushed);
      const last = beadX(start + count - 1, pushed);
      shapes.push({
        x: first - BEAD_PAD,
        y: y - BEAD_PAD,
        width: last - first + BEAD_PAD * 2,
        key: `beads-${row}-${start}`,
      });
    });
  });
  if (shapes.length === 0) return null;
  return (
    <CanvasAlignedOverlay
      canvasSelector={'svg[data-testid="counters-canvas"]'}
      logicalWidth={1000}
      logicalHeight={600}
    >
      {shapes.map((shape) => (
        <rect
          key={shape.key}
          x={shape.x}
          y={shape.y}
          width={shape.width}
          height={BEAD_PAD * 2}
          rx={BEAD_PAD}
          fill="none"
          stroke="#e8872e"
          strokeWidth={3.5}
          strokeDasharray="9 6"
        />
      ))}
    </CanvasAlignedOverlay>
  );
}
