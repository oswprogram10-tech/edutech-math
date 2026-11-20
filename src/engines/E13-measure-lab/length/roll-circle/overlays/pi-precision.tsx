/**
 * 힌트 ② pi-precision (MC-CIRCLE-PI-EXACT). 기록표 오른쪽에 "더 자세히(0.001)" 칸을 덧그려 기록된 줄마다
 * 비(측정 원주 ÷ 지름)를 소수 셋째 자리까지 보인다. 기록이 두 줄보다 적으면 그리지 않는다.
 */
import { CanvasAlignedOverlay } from '../../../../../core/engine-sdk';
import type { OverlayProps } from '../../../../../core/engine-sdk';
import { rat } from '../../../rat';
import { E13_STRINGS as S } from '../../../strings.ko';
import { BOARD, boardHeight, geoOf } from '../layout';
import { formatFixed, ratioOf } from '../pi';
import { ROLL_CANVAS_SELECTOR } from '../types';
import type { RollConfig, RollState } from '../types';

const INK = '#1d2330';
const ORANGE = '#e8872e';

export function PiPrecisionOverlay({ state }: OverlayProps<RollConfig, RollState>) {
  if (state.error !== null || state.log.length < 2) return null;
  const table = geoOf(state).table;
  if (table === null) return null;
  const rows = state.log.map((row) => {
    const d = rat(row.d);
    const c = rat(row.c);
    return d === null || c === null ? '' : formatFixed(ratioOf(c, d, 3), 3);
  });
  const x = table.extraX;
  const w = table.extraW;
  return (
    <CanvasAlignedOverlay
      testId="overlay-pi-precision"
      canvasSelector={ROLL_CANVAS_SELECTOR}
      logicalWidth={BOARD.width}
      logicalHeight={boardHeight(state)}
    >
      <rect
        data-part="panel"
        x={x}
        y={table.top}
        width={w}
        height={table.height}
        fill="#fff6e8"
        stroke={ORANGE}
        strokeWidth={3}
        strokeDasharray="12 8"
      />
      <rect
        x={x}
        y={table.top}
        width={w}
        height={table.headH}
        fill="#ffe3bd"
        stroke={ORANGE}
        strokeWidth={3}
      />
      <text
        data-part="head"
        x={x + w / 2}
        y={table.top + table.headH / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={18}
        fontWeight={800}
        fill="#8a4b00"
      >
        {S.overlay.piPrecision}
      </text>
      {Array.from({ length: table.rows }, (_, i) => (
        <line
          key={i}
          data-part="row-line"
          x1={x}
          y1={table.top + table.headH + i * table.rowH}
          x2={x + w}
          y2={table.top + table.headH + i * table.rowH}
          stroke={ORANGE}
          strokeWidth={1.5}
        />
      ))}
      {rows.map((text, i) => (
        <text
          key={i}
          data-part="cell"
          data-row={i}
          x={x + w / 2}
          y={table.top + table.headH + i * table.rowH + table.rowH / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={18}
          fontWeight={700}
          fill={INK}
        >
          {text}
        </text>
      ))}
    </CanvasAlignedOverlay>
  );
}
