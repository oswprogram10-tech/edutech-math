/**
 * T049 `multiply`: 두 분수 넓이의 겹침.
 *
 * - 세로 칸(a)은 노랑 + 세로 빗금, 가로 칸(b)은 파랑 + 가로 빗금,
 *   겹친 칸은 초록 + 격자 무늬다. 색만으로 구분하지 않는다.
 * - 모든 조작은 −/+ 단추(키보드 Enter·Space)로 끝낼 수 있다.
 * - 곱은 화면에 쓰지 않는다(Observation에만 있다).
 */
import { useMemo } from 'react';
import { fractionModelStrings as S } from '../strings.ko';
import { maxShaded, multiplySummary } from '../reduce-multiply';
import { multiplyBoard, WHOLE_GAP } from '../layout';
import type { MultiplyState } from '../types';
import { BLUE, CanvasFrame, GREEN, INK, ToolbarButton, YELLOW } from './shared';
import type { ModeProps } from './shared';
import styles from '../View.module.css';

function AdjustButtons({
  label,
  down,
  up,
  value,
  min,
  max,
  onDown,
  onUp,
  disabled,
}: {
  label: string;
  down: string;
  up: string;
  value: number;
  min: number;
  max: number;
  onDown: () => void;
  onUp: () => void;
  disabled: boolean;
}) {
  return (
    <span role="group" aria-label={label}>
      <ToolbarButton onClick={onDown} disabled={disabled || value <= min}>
        {down}
      </ToolbarButton>
      <ToolbarButton onClick={onUp} disabled={disabled || value >= max}>
        {up}
      </ToolbarButton>
    </span>
  );
}

export function MultiplyView({
  config,
  state,
  dispatch,
  readOnly,
  targetSize,
}: ModeProps<MultiplyState>) {
  const summary = useMemo(() => multiplySummary(state), [state]);
  const board = useMemo(
    () => multiplyBoard(state.aParts, state.aShaded, state.bParts),
    [state.aParts, state.aShaded, state.bParts],
  );
  const showCounts = config.showCounts ?? false;
  const maxA = maxShaded(state.aParts);

  return (
    <div className={styles.wrap} data-target-size={targetSize}>
      <div className={styles.toolbar} role="toolbar" aria-label={S.canvasLabel}>
        <AdjustButtons
          label={S.aPartsUp}
          down={S.aPartsDown}
          up={S.aPartsUp}
          value={state.aParts}
          min={1}
          max={state.maxDenominator}
          disabled={readOnly}
          onDown={() => dispatch({ type: 'set-parts', side: 'a', parts: state.aParts - 1 })}
          onUp={() => dispatch({ type: 'set-parts', side: 'a', parts: state.aParts + 1 })}
        />
        <AdjustButtons
          label={S.aShadedUp}
          down={S.aShadedDown}
          up={S.aShadedUp}
          value={state.aShaded}
          min={0}
          max={maxA}
          disabled={readOnly}
          onDown={() => dispatch({ type: 'set-shaded', side: 'a', count: state.aShaded - 1 })}
          onUp={() => dispatch({ type: 'set-shaded', side: 'a', count: state.aShaded + 1 })}
        />
        <AdjustButtons
          label={S.bPartsUp}
          down={S.bPartsDown}
          up={S.bPartsUp}
          value={state.bParts}
          min={1}
          max={state.maxDenominator}
          disabled={readOnly}
          onDown={() => dispatch({ type: 'set-parts', side: 'b', parts: state.bParts - 1 })}
          onUp={() => dispatch({ type: 'set-parts', side: 'b', parts: state.bParts + 1 })}
        />
        <AdjustButtons
          label={S.bShadedUp}
          down={S.bShadedDown}
          up={S.bShadedUp}
          value={state.bShaded}
          min={0}
          max={state.bParts}
          disabled={readOnly}
          onDown={() => dispatch({ type: 'set-shaded', side: 'b', count: state.bShaded - 1 })}
          onUp={() => dispatch({ type: 'set-shaded', side: 'b', count: state.bShaded + 1 })}
        />
      </div>

      <CanvasFrame label={S.multiplyCanvasLabel}>
        <defs>
          <pattern id="e05-mul-a" width="12" height="12" patternUnits="userSpaceOnUse">
            <rect x={0} y={0} width={12} height={12} fill="#fdf0d9" />
            <line x1={4} y1={0} x2={4} y2={12} stroke={YELLOW} strokeWidth={2} />
          </pattern>
          <pattern id="e05-mul-b" width="12" height="12" patternUnits="userSpaceOnUse">
            <rect x={0} y={0} width={12} height={12} fill="#e6eeff" />
            <line x1={0} y1={4} x2={12} y2={4} stroke={BLUE} strokeWidth={2} />
          </pattern>
          <pattern id="e05-mul-ab" width="12" height="12" patternUnits="userSpaceOnUse">
            <rect x={0} y={0} width={12} height={12} fill="#e4f2e8" />
            <line x1={4} y1={0} x2={4} y2={12} stroke={GREEN} strokeWidth={1.6} />
            <line x1={0} y1={4} x2={12} y2={4} stroke={GREEN} strokeWidth={1.6} />
          </pattern>
        </defs>

        {Array.from({ length: board.squares }, (_, square) => {
          const originX = board.originX + square * (board.size + WHOLE_GAP);
          const cells = [];
          for (let row = 0; row < state.bParts; row += 1) {
            for (let column = 0; column < state.aParts; column += 1) {
              const globalColumn = square * state.aParts + column;
              const inA = globalColumn < state.aShaded;
              const inB = row < state.bShaded;
              const fill =
                inA && inB
                  ? 'url(#e05-mul-ab)'
                  : inA
                    ? 'url(#e05-mul-a)'
                    : inB
                      ? 'url(#e05-mul-b)'
                      : '#ffffff';
              cells.push(
                <rect
                  key={`mul-${square}-${column}-${row}`}
                  x={originX + column * board.cellWidth}
                  y={board.originY + row * board.cellHeight}
                  width={board.cellWidth}
                  height={board.cellHeight}
                  fill={fill}
                  stroke="#8a94a6"
                  strokeWidth={1}
                  data-testid="multiply-cell"
                  data-in-a={inA ? 'true' : 'false'}
                  data-in-b={inB ? 'true' : 'false'}
                />,
              );
            }
          }
          return (
            <g key={`mul-square-${square}`}>
              {cells}
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
      </CanvasFrame>

      {showCounts ? (
        <p className={styles.readout}>
          {S.multiplyCounts(summary.totalCells, summary.overlapCells)}
        </p>
      ) : null}
      <p className={styles.instructions}>
        {readOnly ? S.readOnlyHint : S.instructions.multiply} {S.multiplyLegend}{' '}
        {S.multiplyKeyboardHint}
      </p>
    </div>
  );
}
