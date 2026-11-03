/** 힌트 ②: 학생이 놓은 셈돌에 1, 2, 3 … 순서 번호를 붙인다. 목표 수는 쓰지 않는다. */
import type { OverlayProps } from '../../../core/engine-sdk';
import { frameCellPoint, plateSlotPoint, sharePlateCenter } from '../layout';
import type { CountersConfig, CountersState } from '../types';

function shareSlot(center: { x: number; y: number }, index: number): { x: number; y: number } {
  return {
    x: center.x - 62 + (index % 5) * 31,
    y: center.y - 20 + Math.floor(index / 5) * 28,
  };
}

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
  } else if (state.mode === 'rekenrek') {
    const leftX = 210;
    const rightX = 790;
    const gap = 46;
    const rowY = (row: number) => {
      const count = Math.max(1, state.rows);
      const spacing = count > 1 ? Math.min(82, 440 / (count - 1)) : 0;
      return Math.round(120 + row * spacing);
    };
    state.left.forEach((pushed, row) => {
      for (let slot = 0; slot < pushed; slot += 1) {
        const x = slot < pushed ? leftX + slot * gap : rightX - (10 - slot - 1) * gap;
        points.push({ x, y: rowY(row) });
      }
    });
  } else if (state.mode === 'share') {
    state.plates.forEach((count, plate) => {
      const center = sharePlateCenter(state.groups, plate);
      for (let index = 0; index < count; index += 1) points.push(shareSlot(center, index));
    });
  } else if (state.mode === 'measure-out') {
    state.counters
      .filter((counter) => counter.bag === null)
      .forEach((counter) => points.push({ x: counter.x, y: counter.y }));
  } else if (state.mode === 'part-whole' && !('variant' in state)) {
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
