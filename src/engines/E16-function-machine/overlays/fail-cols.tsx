/**
 * 힌트 ② fail-cols (MC-PATTERN-ONE-PAIR).
 * 학생 식이 성립하지 않는 열에 굵은 빨간 테두리와 빗금을 그린다. 식을 학생 표에 넣은 결과만 쓴다.
 */
import { useId } from 'react';
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import { columnHolds } from '../relation-check';
import { functionStrings as S } from '../strings.ko';
import { colX, row0Top } from '../table-layout';
import type { FunctionConfig, FunctionState } from '../types';
import { RELATION_CANVAS, onGrid, overlayData } from './helpers';

export function FailColsOverlay({ state }: OverlayProps<FunctionConfig, FunctionState>) {
  const patternId = useId();
  if (onGrid(state)) return null;
  const { columns, layout, rel } = overlayData(state);
  if (rel === null) return null;
  const holds = columnHolds(rel, columns);
  const failed = holds.flatMap((hold, index) => (hold === false ? [index] : []));
  if (failed.length === 0) return null;
  const top = row0Top(layout);
  const boxH = 2 * layout.cellH;

  return (
    <CanvasAlignedOverlay
      testId="fail-cols"
      canvasSelector={RELATION_CANVAS}
      logicalWidth={layout.width}
      logicalHeight={layout.height}
    >
      <defs>
        <pattern
          id={patternId}
          width={12}
          height={12}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width={12} height={12} fill="#fff1f0" opacity={0.25} />
          <line x1={0} y1={0} x2={0} y2={12} stroke="#c0392b" strokeWidth={2} opacity={0.55} />
        </pattern>
      </defs>
      <text
        x={layout.labelW}
        y={layout.topH / 2}
        fontSize={16}
        fontWeight={800}
        fill="#a02820"
        dominantBaseline="central"
      >
        {S.overlay.failCols}
      </text>
      {failed.map((index) => (
        <rect
          key={index}
          x={colX(layout, index) - 3}
          y={top - 3}
          width={layout.cellW + 6}
          height={boxH + 6}
          fill={`url(#${patternId})`}
          stroke="#c0392b"
          strokeWidth={6}
          rx={4}
          data-testid="fail-col"
          data-col={index}
        />
      ))}
    </CanvasAlignedOverlay>
  );
}
