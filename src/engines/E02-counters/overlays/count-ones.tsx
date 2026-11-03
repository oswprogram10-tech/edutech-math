/** 힌트 ②: 학생이 놓은 셈돌에 1, 2, 3 … 순서 번호를 붙인다. 목표 수는 쓰지 않는다. */
import type { OverlayProps } from '../../../core/engine-sdk';
import { frameCellPoint, plateSlotPoint } from '../layout';
import type { CountersConfig, CountersState } from '../types';

export function CountOnesOverlay({ state }: OverlayProps<CountersConfig, CountersState>) {
  const points: { x: number; y: number }[] = [];
  if (state.mode === 'summon') {
    state.counters.forEach((counter) => points.push({ x: counter.x, y: counter.y }));
  } else if (state.mode === 'ten-frame') {
    state.counters
      .filter((counter) => counter.frame !== null && counter.cell !== null)
      .sort((a, b) => (a.frame ?? 0) - (b.frame ?? 0) || (a.cell ?? 0) - (b.cell ?? 0))
      .forEach((counter) => {
        points.push(frameCellPoint(state.frames, counter.frame ?? 0, counter.cell ?? 0));
      });
  } else if (state.mode === 'part-whole') {
    state.counters
      .slice()
      .sort((a, b) => a.plate - b.plate || a.slot - b.slot)
      .forEach((counter) => {
        points.push(plateSlotPoint(state.plates, counter.plate, counter.slot));
      });
  }

  if (points.length === 0) return null;

  return (
    <svg viewBox="0 0 1000 600" width="100%" height="100%" aria-hidden="true">
      {points.map((point, index) => (
        <g key={`count-${index}`}>
          <circle cx={point.x} cy={point.y} r={15} fill="#ffffff" opacity={0.92} />
          <text
            x={point.x}
            y={point.y + 6}
            textAnchor="middle"
            fontSize={18}
            fontWeight={700}
            fill="#1d4fa8"
          >
            {index + 1}
          </text>
        </g>
      ))}
    </svg>
  );
}
