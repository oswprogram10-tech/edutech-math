/**
 * 힌트 ② cell-diff (MC-CHART-ROW-COL).
 *
 * `args.cell`(없으면 오개념이 걸린 첫 칸)과 같은 행에서 보이는 이웃 두 칸 사이에 "→ +a"를,
 * 같은 열에서 보이는 이웃 두 칸 사이에 "↓ +b"를 그린다. 그 줄·그 칸의 한 칸 차이가 가로와 세로에서
 * 다르다는 것을 눈으로 보게 한다.
 *
 * 보이는 몸통 칸(처음부터 안 가렸거나 돋보기로 연 칸)만 쓴다. 머리 칸과 학생이 쓴 칸은 쓰지 않고,
 * 가린 칸의 값은 어디에도 쓰지 않는다. 짝이 여러 개이면 고른 칸에서 가장 가까운 짝(같은 거리면 왼쪽·위쪽)이다.
 */
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import { cellKey, isVisibleBody, parseCell, rowColCells, valueAt } from '../calc-table';
import { CELL, bodyRect, centerOf, tableLayout } from '../calc-table-layout';
import { patternStrings as S } from '../strings.ko';
import type { PatternConfig, PatternState } from '../types';
import { TABLE_CANVAS, argsOf, calcTableOf } from './helpers';

const MARK = '#1d2330';

export function CellDiffOverlay({ state, args }: OverlayProps<PatternConfig, PatternState>) {
  const table = calcTableOf(state);
  if (!table || table.settings.error !== null) return null;
  const { settings } = table;
  const layout = tableLayout(settings);

  const requested = argsOf(args)['cell'];
  const target =
    typeof requested === 'string' && parseCell(requested, settings.rows, settings.cols) !== null
      ? requested
      : (rowColCells(settings, table.entries, table.revealed)[0] ?? null);
  const parsed = target === null ? null : parseCell(target, settings.rows, settings.cols);

  const seen = (row: number, col: number): boolean => {
    if (row < 0 || col < 0 || row >= settings.rows || col >= settings.cols) return false;
    return isVisibleBody(settings, table.revealed, cellKey(row, col));
  };

  // 같은 행에서 보이는 이웃 두 칸(왼쪽 칸 번호). 고른 칸에서 가까운 짝, 같으면 왼쪽.
  let rowPair: number | null = null;
  let colPair: number | null = null;
  if (parsed !== null) {
    const [row, col] = parsed;
    let best = Number.POSITIVE_INFINITY;
    for (let c = 0; c + 1 < settings.cols; c += 1) {
      if (!seen(row, c) || !seen(row, c + 1)) continue;
      const dist = Math.min(Math.abs(c - col), Math.abs(c + 1 - col));
      if (dist < best) {
        best = dist;
        rowPair = c;
      }
    }
    best = Number.POSITIVE_INFINITY;
    for (let r = 0; r + 1 < settings.rows; r += 1) {
      if (!seen(r, col) || !seen(r + 1, col)) continue;
      const dist = Math.min(Math.abs(r - row), Math.abs(r + 1 - row));
      if (dist < best) {
        best = dist;
        colPair = r;
      }
    }
  }

  const pill = (x: number, y: number, text: string, testId: string) => (
    <g data-testid={testId}>
      <rect
        x={x - 36}
        y={y - 13}
        width={72}
        height={26}
        rx={13}
        fill="#ffffff"
        stroke={MARK}
        strokeWidth={2.5}
      />
      <text
        x={x}
        y={y}
        fontSize={17}
        fontWeight={800}
        textAnchor="middle"
        dominantBaseline="central"
        fill={MARK}
      >
        {text}
      </text>
    </g>
  );

  return (
    <CanvasAlignedOverlay
      testId="cell-diff"
      canvasSelector={TABLE_CANVAS}
      logicalWidth={layout.width}
      logicalHeight={layout.height}
    >
      {parsed !== null && rowPair !== null
        ? (() => {
            const row = parsed[0];
            const a = bodyRect(row, rowPair);
            const b = bodyRect(row, rowPair + 1);
            const diff = valueAt(settings, row, rowPair + 1) - valueAt(settings, row, rowPair);
            const y = a.y;
            const x1 = centerOf(a).x;
            const x2 = centerOf(b).x;
            return (
              <g data-testid="cell-diff-row" data-row={row} data-from={rowPair}>
                <line x1={x1} y1={y} x2={x2} y2={y} stroke={MARK} strokeWidth={4} />
                <polygon
                  points={`${x2 + 2},${y} ${x2 - 12},${y - 8} ${x2 - 12},${y + 8}`}
                  fill={MARK}
                />
                {pill((x1 + x2) / 2, y, S.overlay.cellDiffRow(diff), 'cell-diff-row-label')}
              </g>
            );
          })()
        : null}
      {parsed !== null && colPair !== null
        ? (() => {
            const col = parsed[1];
            const a = bodyRect(colPair, col);
            const b = bodyRect(colPair + 1, col);
            const diff = valueAt(settings, colPair + 1, col) - valueAt(settings, colPair, col);
            const x = a.x + CELL * 0.09;
            const y1 = centerOf(a).y;
            const y2 = centerOf(b).y;
            return (
              <g data-testid="cell-diff-col" data-col={col} data-from={colPair}>
                <line x1={x} y1={y1} x2={x} y2={y2} stroke={MARK} strokeWidth={4} />
                <polygon
                  points={`${x},${y2 + 2} ${x - 8},${y2 - 12} ${x + 8},${y2 - 12}`}
                  fill={MARK}
                />
                {pill(
                  centerOf(a).x,
                  (y1 + y2) / 2,
                  S.overlay.cellDiffCol(diff),
                  'cell-diff-col-label',
                )}
              </g>
            );
          })()
        : null}
    </CanvasAlignedOverlay>
  );
}
