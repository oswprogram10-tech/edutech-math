/** 힌트 ②: 텐프레임의 빈칸에 점선 동그라미를 그린다. */
import type { OverlayProps } from '../../../core/engine-sdk';
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import { frameCellPoint } from '../layout';
import { FRAME_COLS, FRAME_ROWS } from '../types';
import type { CountersConfig, CountersState } from '../types';

export function FrameGapsOverlay({ state }: OverlayProps<CountersConfig, CountersState>) {
  if (state.mode !== 'ten-frame') return null;
  const occupied = new Set(
    state.counters
      .filter((counter) => counter.frame !== null && counter.cell !== null)
      .map((counter) => `${counter.frame}:${counter.cell}`),
  );
  const gaps: { x: number; y: number }[] = [];
  for (let frame = 0; frame < state.frames; frame += 1) {
    for (let cell = 0; cell < FRAME_COLS * FRAME_ROWS; cell += 1) {
      if (!occupied.has(`${frame}:${cell}`)) {
        gaps.push(frameCellPoint(state.frames, frame, cell));
      }
    }
  }
  return (
    <CanvasAlignedOverlay
      canvasSelector={'svg[data-testid="counters-canvas"]'}
      logicalWidth={1000}
      logicalHeight={600}
    >
      {gaps.map((point, index) => (
        <circle
          key={`gap-${index}`}
          cx={point.x}
          cy={point.y}
          r={24}
          fill="none"
          stroke="#2f6fde"
          strokeWidth={2.5}
          strokeDasharray="7 6"
          opacity={0.75}
        />
      ))}
    </CanvasAlignedOverlay>
  );
}
