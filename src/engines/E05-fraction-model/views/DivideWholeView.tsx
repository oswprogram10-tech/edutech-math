/**
 * T049 `partition` variant=divide-whole: 분수 ÷ 자연수 → ×1/n.
 *
 * - 나뉨수를 세로 띠로 칠해 시작한다.
 * - "÷ n" 카드로 가로 칸을 열고, 한 줄(`keep-row`)이나 한 묶음(`keep-bundle`)만 남긴다.
 * - 남긴 값·몫은 화면에 쓰지 않는다. `morphToMultiply`가 true일 때만 식 띠를 보여 준다.
 */
import { useMemo } from 'react';
import { Rational } from '../../../core/math';
import { mixedLabel } from '../fractions';
import { divideWholeBoard, WHOLE_GAP } from '../layout';
import { divideWholeSummary } from '../reduce-divide-whole';
import { fractionModelStrings as S } from '../strings.ko';
import type { DivideWholeState } from '../types';
import { CanvasFrame, GREEN, INK, ToolbarButton, YELLOW } from './shared';
import type { ModeProps } from './shared';
import styles from '../View.module.css';

export function DivideWholeView({
  config,
  state,
  dispatch,
  readOnly,
  targetSize,
}: ModeProps<DivideWholeState>) {
  const summary = useMemo(() => divideWholeSummary(state), [state]);
  const board = useMemo(
    () => divideWholeBoard(state.dividendParts, state.dividendShaded),
    [state.dividendParts, state.dividendShaded],
  );
  const rows = Math.max(1, state.rows);
  const cellHeight = board.size / rows;
  const bundleSize = summary.bundleSize ?? 0;
  const morphOn = config.morphToMultiply === true && summary.kept !== null;
  const dividendLabel = mixedLabel(Rational.parse(state.dividend));

  return (
    <div className={styles.wrap} data-target-size={targetSize}>
      <div className={styles.toolbar} role="toolbar" aria-label={S.canvasLabel}>
        <ToolbarButton
          pressed={state.rowsOpen}
          disabled={readOnly || state.rowsOpen}
          onClick={() => dispatch({ type: 'open-rows' })}
        >
          {S.divisorCard(state.divisor)}
        </ToolbarButton>
        {state.rowsOpen ? (
          <>
            <ToolbarButton
              disabled={readOnly || state.rows <= 1}
              onClick={() => dispatch({ type: 'set-rows', rows: rows - 1 })}
            >
              {S.rowsDown}
            </ToolbarButton>
            <ToolbarButton
              disabled={readOnly || state.rows >= state.divisor}
              onClick={() => dispatch({ type: 'set-rows', rows: rows + 1 })}
            >
              {S.rowsUp}
            </ToolbarButton>
            {state.rows >= 2
              ? Array.from({ length: state.rows }, (_, row) => (
                  <ToolbarButton
                    key={`keep-row-${row}`}
                    pressed={state.keptRow === row}
                    disabled={readOnly}
                    onClick={() => dispatch({ type: 'keep-row', row })}
                  >
                    {S.keepRow(row)}
                  </ToolbarButton>
                ))
              : null}
            {summary.canBundle ? (
              <ToolbarButton
                pressed={state.bundleOpen}
                disabled={readOnly || state.bundleOpen}
                onClick={() => dispatch({ type: 'bundle' })}
              >
                {S.bundle}
              </ToolbarButton>
            ) : null}
            {state.bundleOpen
              ? Array.from({ length: state.divisor }, (_, index) => (
                  <ToolbarButton
                    key={`keep-bundle-${index}`}
                    pressed={state.keptBundle === index}
                    disabled={readOnly}
                    onClick={() => dispatch({ type: 'keep-bundle', index })}
                  >
                    {S.keepBundle(index)}
                  </ToolbarButton>
                ))
              : null}
          </>
        ) : null}
      </div>

      <CanvasFrame label={S.divideWholeCanvasLabel}>
        <defs>
          <pattern id="e05-dw-strip" width="12" height="12" patternUnits="userSpaceOnUse">
            <rect x={0} y={0} width={12} height={12} fill="#fdf0d9" />
            <line x1={4} y1={0} x2={4} y2={12} stroke={YELLOW} strokeWidth={2} />
          </pattern>
        </defs>

        {Array.from({ length: board.squares }, (_, square) => {
          const originX = board.originX + square * (board.size + WHOLE_GAP);
          const cells = [];
          for (let row = 0; row < rows; row += 1) {
            for (let column = 0; column < state.dividendParts; column += 1) {
              const globalColumn = square * state.dividendParts + column;
              const shaded = globalColumn < state.dividendShaded;
              let opacity = 1;
              if (shaded && state.keptRow !== null && row !== state.keptRow) opacity = 0.18;
              if (shaded && state.keptBundle !== null && bundleSize > 0) {
                const group = Math.floor(globalColumn / bundleSize);
                if (group !== state.keptBundle) opacity = 0.18;
              }
              cells.push(
                <rect
                  key={`dw-${square}-${column}-${row}`}
                  x={originX + column * board.cellWidth}
                  y={board.originY + row * cellHeight}
                  width={board.cellWidth}
                  height={cellHeight}
                  fill={shaded ? 'url(#e05-dw-strip)' : '#ffffff'}
                  opacity={opacity}
                  stroke="#8a94a6"
                  strokeWidth={1}
                  data-testid="divide-whole-cell"
                  data-shaded={shaded ? 'true' : 'false'}
                  data-row={row}
                  data-global-column={globalColumn}
                />,
              );
            }
          }
          return (
            <g key={`dw-square-${square}`}>
              {cells}
              {Array.from({ length: Math.max(0, state.dividendParts - 1) }, (_, index) => {
                const column = index + 1;
                const x = originX + column * board.cellWidth;
                return (
                  <line
                    key={`dw-column-line-${square}-${column}`}
                    x1={x}
                    y1={board.originY}
                    x2={x}
                    y2={board.originY + board.size}
                    stroke={INK}
                    strokeWidth={2.5}
                    opacity={0.85}
                    data-testid="divide-whole-column-line"
                  />
                );
              })}
              <rect
                x={originX}
                y={board.originY}
                width={board.size}
                height={board.size}
                fill="none"
                stroke={INK}
                strokeWidth={4}
              />
            </g>
          );
        })}

        {state.bundleOpen && bundleSize > 0
          ? Array.from({ length: Math.max(0, state.divisor - 1) }, (_, index) => {
              const boundary = (index + 1) * bundleSize;
              if (boundary >= state.dividendShaded) return null;
              const square = Math.floor(boundary / state.dividendParts);
              const column = boundary % state.dividendParts;
              if (square >= board.squares) return null;
              const x =
                board.originX + square * (board.size + WHOLE_GAP) + column * board.cellWidth;
              return (
                <line
                  key={`bundle-line-${index}`}
                  x1={x}
                  y1={board.originY}
                  x2={x}
                  y2={board.originY + board.size}
                  stroke={GREEN}
                  strokeWidth={3}
                  strokeDasharray="8 6"
                />
              );
            })
          : null}
      </CanvasFrame>

      {morphOn ? (
        <p className={styles.readout}>
          {S.morphEquation(
            `${dividendLabel} ÷ ${state.divisor}`,
            `${dividendLabel} × 1/${state.divisor}`,
          )}
        </p>
      ) : null}
      <p className={styles.instructions}>
        {readOnly ? S.readOnlyHint : S.instructions.divideWhole} {S.divideWholeHint}
      </p>
    </div>
  );
}
