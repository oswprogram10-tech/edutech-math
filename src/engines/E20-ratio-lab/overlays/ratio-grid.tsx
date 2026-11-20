/**
 * 힌트 ② ratio-grid.
 * 지금 크기 위에 처음 크기(w0×h0) 타일을 왼쪽 위부터 깐다. 다 덮이지 않는 부분은 빗금으로 둔다.
 * 가로·세로가 같은 배로 늘었다면 타일이 빈틈없이 덮고, 아니면 빗금이 남는다. 값은 쓰지 않는다.
 */
import { useId } from 'react';
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import { pictureRect } from '../layout';
import { CANVAS_SELECTOR, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import type { RatioConfig, RatioState } from '../types';

export function RatioGridOverlay({ state }: OverlayProps<RatioConfig, RatioState>) {
  const hatchId = `e20-rg-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  if (state.mode !== 'resize' || state.error !== null) return null;
  const { size, base } = state;
  const r = pictureRect(size);
  const nx = Math.floor(size.w / base.w);
  const ny = Math.floor(size.h / base.h);
  const coveredW = nx * base.w;
  const coveredH = ny * base.h;
  const tiles = [];
  for (let j = 0; j < ny; j += 1) {
    for (let i = 0; i < nx; i += 1) {
      tiles.push(
        <rect
          key={`t${i}-${j}`}
          x={r.x + i * base.w * r.cell}
          y={r.y + j * base.h * r.cell}
          width={base.w * r.cell}
          height={base.h * r.cell}
          fill="#2f6fde"
          fillOpacity={0.12}
          stroke="#2f6fde"
          strokeWidth={3.5}
          strokeDasharray="9 5"
          data-part="tile"
        />,
      );
    }
  }
  const leftovers: { key: string; x: number; y: number; w: number; h: number }[] = [];
  if (coveredW < size.w) {
    leftovers.push({
      key: 'right',
      x: r.x + coveredW * r.cell,
      y: r.y,
      w: (size.w - coveredW) * r.cell,
      h: r.h,
    });
  }
  if (coveredH < size.h && coveredW > 0) {
    leftovers.push({
      key: 'bottom',
      x: r.x,
      y: r.y + coveredH * r.cell,
      w: coveredW * r.cell,
      h: (size.h - coveredH) * r.cell,
    });
  }
  return (
    <CanvasAlignedOverlay
      testId="overlay-ratio-grid"
      canvasSelector={CANVAS_SELECTOR}
      logicalWidth={LOGICAL_WIDTH}
      logicalHeight={LOGICAL_HEIGHT}
    >
      <defs>
        <pattern
          id={hatchId}
          width={10}
          height={10}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line x1={0} y1={0} x2={0} y2={10} stroke="#c0392b" strokeWidth={3} />
        </pattern>
      </defs>
      {tiles}
      {leftovers.map((leftover) => (
        <rect
          key={leftover.key}
          x={leftover.x}
          y={leftover.y}
          width={leftover.w}
          height={leftover.h}
          fill={`url(#${hatchId})`}
          fillOpacity={0.85}
          stroke="#c0392b"
          strokeWidth={2}
          data-part="leftover"
          data-edge={leftover.key}
        />
      ))}
    </CanvasAlignedOverlay>
  );
}
