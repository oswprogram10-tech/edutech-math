/**
 * 힌트 ② level-try (MC-MEAN-MIDDLE-VALUE). args `{ value }`: 학생이 고른 높이.
 * 그 높이에 가로 점선을 긋고, 선보다 위 블록은 빗금으로, 선까지 모자란 칸은 점선 빈 칸으로 그린다.
 * 남는 블록 수와 모자란 칸 수는 학생이 고른 높이 기준이라 정답이 아니다. value가 없으면 그리지 않는다.
 */
import type { ReactElement } from 'react';
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import { Rational } from '../../../core/math';
import { LEVEL, levelGeometry } from '../layout';
import { E19_STRINGS as S } from '../strings.ko';
import { CANVAS_SELECTOR, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import type { ChanceConfig, ChanceState } from '../types';

const INK = '#1d2330';

function levelOf(args: unknown): number | null {
  if (args === null || typeof args !== 'object') return null;
  const raw = (args as { value?: unknown }).value;
  if (typeof raw !== 'number' && typeof raw !== 'string') return null;
  try {
    const value = Rational.parse(String(raw));
    return value.isInteger() ? Number(value.n) : null;
  } catch {
    return null;
  }
}

export function LevelTryOverlay({ state, args }: OverlayProps<ChanceConfig, ChanceState>) {
  if (state.mode !== 'leveling' || state.error !== null) return null;
  const value = levelOf(args);
  if (value === null || value < 0 || value > state.maxHeight) return null;
  const geometry = levelGeometry(state);
  const { blockW, blockH } = geometry;
  const lineY = LEVEL.baseY - value * blockH;
  let extra = 0;
  let lack = 0;
  const hatches: ReactElement[] = [];
  const gaps: ReactElement[] = [];
  geometry.columns.forEach((column) => {
    const height = state.heights[column.index] ?? 0;
    for (let k = value; k < height; k += 1) {
      extra += 1;
      hatches.push(
        <rect
          key={`e${column.index}-${k}`}
          data-part="extra"
          x={column.cx - blockW / 2}
          y={LEVEL.baseY - (k + 1) * blockH}
          width={blockW}
          height={blockH}
          fill="url(#e19-level-hatch)"
          stroke={INK}
          strokeWidth={2}
        />,
      );
    }
    for (let k = height; k < value; k += 1) {
      lack += 1;
      gaps.push(
        <rect
          key={`l${column.index}-${k}`}
          data-part="lack"
          x={column.cx - blockW / 2}
          y={LEVEL.baseY - (k + 1) * blockH}
          width={blockW}
          height={blockH}
          fill="none"
          stroke={INK}
          strokeWidth={2}
          strokeDasharray="6 4"
        />,
      );
    }
  });
  return (
    <CanvasAlignedOverlay
      testId="overlay-level-try"
      canvasSelector={CANVAS_SELECTOR}
      logicalWidth={LOGICAL_WIDTH}
      logicalHeight={LOGICAL_HEIGHT}
    >
      <defs>
        <pattern id="e19-level-hatch" width={8} height={8} patternUnits="userSpaceOnUse">
          <path d="M-2,2 l4,-4 M0,8 l8,-8 M6,10 l4,-4" stroke={INK} strokeWidth={2} />
        </pattern>
      </defs>
      {hatches}
      {gaps}
      <line
        data-part="level-line"
        x1={LEVEL.left - 10}
        y1={lineY}
        x2={LEVEL.right + 10}
        y2={lineY}
        stroke="#8a4b00"
        strokeWidth={4}
        strokeDasharray="12 7"
      />
      <text
        data-part="counts"
        x={LEVEL.left}
        y={96}
        fontSize={26}
        fontWeight={800}
        fill="#8a4b00"
        stroke="#fffdf6"
        strokeWidth={6}
        paintOrder="stroke"
        data-extra={extra}
        data-lack={lack}
      >
        {S.leveling.overlay.levelTry(extra, lack)}
      </text>
    </CanvasAlignedOverlay>
  );
}
