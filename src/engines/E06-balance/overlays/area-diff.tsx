/**
 * 힌트 ② area-diff (일반 ②).
 * 두 격자를 왼쪽 아래 모서리에 맞춰 겹친 그림을 판 가운데에 그린다.
 * 한쪽에만 있는 칸은 빗금(왼쪽만 ／, 오른쪽만 ＼)으로 그린다. 숫자는 쓰지 않는다.
 * 두 접시의 넓이를 모르면(□를 아직 넣지 않았거나 항을 고르기 전) 그리지 않는다.
 */
import { useId } from 'react';
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import {
  DIFF_AREA,
  DIFF_BOTTOM,
  DIFF_CENTER_X,
  DIFF_PANEL,
  MAX_CELL,
  countOf,
  diffPieces,
} from '../proportion/layout';
import { readProportion } from '../proportion/read';
import { balanceStrings as S } from '../strings.ko';
import { CANVAS_SELECTOR, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import type { E06Config, E06State } from '../unions';

export function AreaDiffOverlay({ state }: OverlayProps<E06Config, E06State>) {
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, '');
  if (state.mode !== 'proportion' || state.error !== null) return null;
  if (state.settings.look === 'symbols') return null;
  const reading = readProportion(state);
  const { leftDims, rightDims } = reading;
  if (
    reading.left === null ||
    reading.right === null ||
    leftDims.w === null ||
    leftDims.h === null ||
    rightDims.w === null ||
    rightDims.h === null
  ) {
    return null;
  }
  const mine = { w: countOf(leftDims.w), h: countOf(leftDims.h) };
  const other = { w: countOf(rightDims.w), h: countOf(rightDims.h) };
  const maxW = Math.max(mine.w, other.w);
  const maxH = Math.max(mine.h, other.h);
  const unit = Math.min(MAX_CELL, DIFF_AREA.width / maxW, DIFF_AREA.height / maxH);
  const originX = DIFF_CENTER_X - (maxW * unit) / 2;
  const originY = DIFF_BOTTOM;
  const leftOnly = diffPieces(mine, other, unit, originX, originY);
  const rightOnly = diffPieces(other, mine, unit, originX, originY);
  const commonW = Math.min(mine.w, other.w) * unit;
  const commonH = Math.min(mine.h, other.h) * unit;
  const leftId = `e06-diff-l-${rawId}`;
  const rightId = `e06-diff-r-${rawId}`;
  const legendY = DIFF_PANEL.y + DIFF_PANEL.height - 22;
  return (
    <CanvasAlignedOverlay
      testId="overlay-area-diff"
      canvasSelector={CANVAS_SELECTOR}
      logicalWidth={LOGICAL_WIDTH}
      logicalHeight={LOGICAL_HEIGHT}
    >
      <defs>
        <pattern
          id={leftId}
          width={10}
          height={10}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width={10} height={10} fill="#ffffff" />
          <line x1={0} y1={0} x2={0} y2={10} stroke="#1d4fa8" strokeWidth={4} />
        </pattern>
        <pattern
          id={rightId}
          width={10}
          height={10}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(-45)"
        >
          <rect width={10} height={10} fill="#ffffff" />
          <line x1={0} y1={0} x2={0} y2={10} stroke="#8a4b00" strokeWidth={4} />
        </pattern>
      </defs>
      <rect
        x={DIFF_PANEL.x}
        y={DIFF_PANEL.y}
        width={DIFF_PANEL.width}
        height={DIFF_PANEL.height}
        rx={16}
        fill="#ffffff"
        fillOpacity={0.94}
        stroke="#4a5568"
        strokeWidth={3}
      />
      <g role="img" aria-label={S.proportion.areaDiff.label} data-part="overlap">
        <rect
          x={originX}
          y={originY - commonH}
          width={commonW}
          height={commonH}
          fill="#e8edf6"
          data-part="common"
        />
        {leftOnly.map((piece, index) => (
          <rect
            key={`l${index}`}
            {...piece}
            fill={`url(#${leftId})`}
            stroke="#1d4fa8"
            strokeWidth={2}
            data-part="left-only"
          />
        ))}
        {rightOnly.map((piece, index) => (
          <rect
            key={`r${index}`}
            {...piece}
            fill={`url(#${rightId})`}
            stroke="#8a4b00"
            strokeWidth={2}
            data-part="right-only"
          />
        ))}
        <rect
          x={originX}
          y={originY - mine.h * unit}
          width={mine.w * unit}
          height={mine.h * unit}
          fill="none"
          stroke="#1d4fa8"
          strokeWidth={4}
        />
        <rect
          x={originX}
          y={originY - other.h * unit}
          width={other.w * unit}
          height={other.h * unit}
          fill="none"
          stroke="#8a4b00"
          strokeWidth={4}
          strokeDasharray="10 6"
        />
      </g>
      <g data-part="legend">
        <rect
          x={DIFF_PANEL.x + 24}
          y={legendY - 9}
          width={18}
          height={18}
          fill={`url(#${leftId})`}
          stroke="#1d4fa8"
          strokeWidth={2}
        />
        <text
          x={DIFF_PANEL.x + 50}
          y={legendY}
          dominantBaseline="central"
          fontSize={18}
          fontWeight={700}
          fill="#1d2330"
        >
          {S.proportion.areaDiff.leftOnly}
        </text>
        <rect
          x={DIFF_PANEL.x + 164}
          y={legendY - 9}
          width={18}
          height={18}
          fill={`url(#${rightId})`}
          stroke="#8a4b00"
          strokeWidth={2}
        />
        <text
          x={DIFF_PANEL.x + 190}
          y={legendY}
          dominantBaseline="central"
          fontSize={18}
          fontWeight={700}
          fill="#1d2330"
        >
          {S.proportion.areaDiff.rightOnly}
        </text>
      </g>
    </CanvasAlignedOverlay>
  );
}
