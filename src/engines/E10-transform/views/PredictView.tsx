/**
 * E10 `predict` 화면: 결과 자리를 먼저 칠하고 확인하면 도형이 실제로 움직인다.
 *
 * 확인 전에는 시작 도형·이름표·칠한 칸만 그린다. 결과 도형·테두리·잔상·호·
 * 애니메이션은 확인 뒤에만 만든다. 결과 칸은 Observation에만 있고 화면 문구로
 * 쓰지 않는다.
 */
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { pointerToLogical } from '../../../core/engine-sdk';
import type { CPA, EngineViewProps } from '../../../core/engine-sdk';
import { applyMovesUpTo } from '../moves';
import { arcPath, boardRect, cellRect, ptXY, pointerToCell } from '../layout';
import { cellKey, sameCellSet } from '../square';
import { resultFigure } from '../modes/predict';
import { transformStrings as S } from '../strings.ko';
import type {
  Cell,
  Move,
  PredictState,
  SquareFigure,
  TransformAction,
  TransformConfig,
} from '../types';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import styles from '../View.module.css';
import { FigureShape } from './parts/FigureShape';
import { moveText } from './parts/move-text';
import { MOVE_DURATION_MS, prefersReducedMotion } from './parts/motion';
import { useMoveAnimation } from './parts/useMoveAnimation';

const PAPER = '#fbfaf6';
const INK = '#1d2330';
const GRID = '#c9d2e2';
const BLUE = '#2f6fde';
const ORANGE = '#e8872e';

type PredictViewProps = EngineViewProps<TransformConfig, PredictState, TransformAction>;

interface ResultLayerProps {
  readonly start: SquareFigure;
  readonly operations: readonly Move[];
  readonly rect: ReturnType<typeof boardRect>;
  readonly cpa: CPA;
  readonly reduced: boolean;
  readonly painted: readonly Cell[];
  readonly result: SquareFigure;
  readonly labels: readonly string[] | undefined;
  readonly ghost: boolean;
  readonly arcTrail: boolean;
}

function ResultLayer({
  start,
  operations,
  rect,
  cpa,
  reduced,
  painted,
  result,
  labels,
  ghost,
  arcTrail,
}: ResultLayerProps) {
  const animate = !reduced && cpa !== 'A';
  const [played, setPlayed] = useState(() => (animate ? 0 : operations.length));

  useEffect(() => {
    if (!animate) return;
    const timers = operations.map((_, index) =>
      window.setTimeout(() => setPlayed(index + 1), index * MOVE_DURATION_MS),
    );
    return () => {
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, [animate, operations]);

  const moves = operations.slice(0, played);
  const figure = applyMovesUpTo(start, operations, played);
  const complete = !animate || played >= operations.length;
  const animation = useMoveAnimation({ start, moves, rect, cpa, reduced });
  const paintedKeys = new Set(painted.map((cell) => cellKey(cell)));
  const resultKeys = new Set(result.cells.map((cell) => cellKey(cell)));
  return (
    <>
      {ghost && played > 0 ? (
        <g data-ghost opacity={0.25} pointerEvents="none">
          <FigureShape
            figure={applyMovesUpTo(start, operations, played - 1)}
            rect={rect}
            fill="none"
            stroke="#7a8497"
            strokeWidth={3}
            dash="10 8"
          />
        </g>
      ) : null}

      {arcTrail
        ? moves.map((move, index) => {
            if (move.kind !== 'turn') return null;
            const before = applyMovesUpTo(start, operations, index);
            const after = applyMovesUpTo(start, operations, index + 1);
            const center = ptXY(rect, move.center);
            return (
              <g key={`turn-arc-${index}`} pointerEvents="none">
                {before.outline.map((point, vertex) => {
                  const next = after.outline[vertex];
                  if (!next) return null;
                  const path = arcPath(
                    center,
                    ptXY(rect, point),
                    ptXY(rect, next),
                    move.angle,
                    move.direction,
                  );
                  return path ? (
                    <path
                      key={`arc-${index}-${vertex}`}
                      data-arc
                      d={path}
                      fill="none"
                      stroke={ORANGE}
                      strokeWidth={3.5}
                      strokeLinecap="round"
                    />
                  ) : null;
                })}
              </g>
            );
          })
        : null}

      <g
        data-result
        data-animating={animation.animating ? 'true' : undefined}
        transform={animation.transform ?? undefined}
      >
        <FigureShape
          figure={figure}
          rect={rect}
          fill="url(#e10-result-hatch)"
          stroke="#2f9e6b"
          strokeWidth={4}
          labels={labels}
        />
        {complete ? (
          <g pointerEvents="none">
            {result.cells.map((cell) => {
              const key = cellKey(cell);
              const box = cellRect(rect, cell);
              const mark = paintedKeys.has(key)
                ? 'url(#e10-mark-correct)'
                : 'url(#e10-mark-missing)';
              return (
                <rect
                  key={`mark-${key}`}
                  x={box.x}
                  y={box.y}
                  width={box.width}
                  height={box.height}
                  fill={mark}
                  data-mark={paintedKeys.has(key) ? 'correct' : 'missing'}
                />
              );
            })}
            {painted
              .filter((cell) => !resultKeys.has(cellKey(cell)))
              .map((cell) => {
                const box = cellRect(rect, cell);
                return (
                  <rect
                    key={`extra-${cellKey(cell)}`}
                    x={box.x}
                    y={box.y}
                    width={box.width}
                    height={box.height}
                    fill="url(#e10-mark-extra)"
                    data-mark="extra"
                  />
                );
              })}
          </g>
        ) : null}
      </g>
    </>
  );
}

function initialCursor(figure: SquareFigure, grid: number): Cell {
  let i = grid;
  let j = grid;
  for (const cell of figure.cells) {
    if (cell[0] < i) i = cell[0];
    if (cell[1] < j) j = cell[1];
  }
  return [Math.max(0, Math.min(grid - 1, i)), Math.max(0, Math.min(grid - 1, j))];
}

export function PredictView({
  state,
  dispatch,
  cpa,
  readOnly = false,
  targetSize,
}: PredictViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const reduced = prefersReducedMotion();
  const rect = boardRect(state.settings.grid);
  const [cursor, setCursor] = useState<Cell>(() => initialCursor(state.start, state.settings.grid));
  const [focused, setFocused] = useState(false);
  const painting = useRef<{ readonly pointerId: number; readonly value: boolean } | null>(null);
  const lastCell = useRef<string | null>(null);

  const paintedKeys = new Set(state.painted.map((cell) => cellKey(cell)));
  const result = resultFigure(state);
  const matches = sameCellSet(result.cells, state.painted);
  const firstTurn = state.operations[0];

  const paintAt = (cell: Cell, value: boolean) => {
    dispatch({ type: 'paint', cells: [cell], value });
  };

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (readOnly || state.confirmed) return;
    const point = pointerToLogical(event, svgRef.current, {
      width: LOGICAL_WIDTH,
      height: LOGICAL_HEIGHT,
    });
    const cell = pointerToCell(rect, point);
    const value = !paintedKeys.has(cellKey(cell));
    painting.current = { pointerId: event.pointerId, value };
    lastCell.current = cellKey(cell);
    paintAt(cell, value);
    setCursor(cell);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // jsdom처럼 포인터 캡처를 지원하지 않는 환경.
    }
  };

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const active = painting.current;
    if (!active || active.pointerId !== event.pointerId || readOnly || state.confirmed) return;
    const point = pointerToLogical(event, svgRef.current, {
      width: LOGICAL_WIDTH,
      height: LOGICAL_HEIGHT,
    });
    const cell = pointerToCell(rect, point);
    const key = cellKey(cell);
    if (key === lastCell.current) return;
    lastCell.current = key;
    paintAt(cell, active.value);
  };

  const onPointerUp = () => {
    painting.current = null;
    lastCell.current = null;
  };

  const onKeyDown = (event: ReactKeyboardEvent<SVGSVGElement>) => {
    if (readOnly) return;
    const grid = state.settings.grid;
    const key = event.key;
    if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight') {
      event.preventDefault();
      setCursor((current) => {
        const i =
          key === 'ArrowLeft'
            ? Math.max(0, current[0] - 1)
            : key === 'ArrowRight'
              ? Math.min(grid - 1, current[0] + 1)
              : current[0];
        const j =
          key === 'ArrowUp'
            ? Math.max(0, current[1] - 1)
            : key === 'ArrowDown'
              ? Math.min(grid - 1, current[1] + 1)
              : current[1];
        return [i, j];
      });
      return;
    }
    if (key === 'Enter' || key === ' ' || key === 'Spacebar') {
      event.preventDefault();
      if (state.confirmed) return;
      dispatch({ type: 'toggle-cell', cell: cursor });
      return;
    }
    if (key === 'Delete' || key === 'Backspace') {
      event.preventDefault();
      dispatch({ type: 'clear-paint' });
    }
  };

  const operationItems = state.operations.map((move, index) => ({
    key: `operation-${index}`,
    text: moveText(move, applyMovesUpTo(state.start, state.operations, index)),
  }));

  const cursorCell = cursor;

  return (
    <div className={styles.wrap} data-target-size={targetSize}>
      <div className={styles.toolbar}>
        <span className={styles.group}>
          <span className={styles.groupLabel}>{S.panel.gridLabel}</span>
          <span data-testid="transform-grid">{S.panel.gridValue(state.settings.grid)}</span>
        </span>
        <span className={styles.hint}>{S.keyboard.predict}</span>
      </div>

      <p className={styles.instructions}>
        {state.settings.selfCheck ? S.instructions.predict : S.instructions.predictNoCheck}
      </p>
      <p className={styles.status} role="status" data-testid="predict-status">
        {state.settings.selfCheck && state.confirmed && matches
          ? S.status.targetDone
          : !state.confirmed && state.painted.length === 0
            ? S.predict.emptyPaint
            : ''}
      </p>

      <div className={styles.stageRow}>
        <div className={styles.boardArea}>
          <svg
            ref={svgRef}
            className={styles.canvas}
            viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`}
            role="group"
            aria-label={S.canvasLabel.predict}
            tabIndex={readOnly ? -1 : 0}
            data-testid="transform-canvas"
            data-motion={reduced ? 'reduced' : 'full'}
            data-cpa={cpa}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={onKeyDown}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <defs>
              <pattern
                id="e10-start-hatch"
                width="18"
                height="18"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(35)"
              >
                <rect width="18" height="18" fill="#dbe7ff" />
                <line x1="0" y1="0" x2="0" y2="18" stroke={BLUE} strokeWidth="5" />
              </pattern>
              <pattern
                id="e10-painted-hatch"
                width="20"
                height="20"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(-30)"
              >
                <rect width="20" height="20" fill="#fff2d8" />
                <line x1="0" y1="0" x2="0" y2="20" stroke={ORANGE} strokeWidth="4" />
              </pattern>
              <pattern
                id="e10-result-hatch"
                width="18"
                height="18"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(35)"
              >
                <rect width="18" height="18" fill="#d9f2e6" />
                <line x1="0" y1="0" x2="0" y2="18" stroke="#2f9e6b" strokeWidth="5" />
              </pattern>
              <pattern id="e10-mark-correct" width="34" height="34" patternUnits="userSpaceOnUse">
                <path
                  d="M8 18 L14 24 L27 8"
                  fill="none"
                  stroke="#1f7a4d"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </pattern>
              <pattern id="e10-mark-extra" width="30" height="30" patternUnits="userSpaceOnUse">
                <path
                  d="M7 7 L23 23 M23 7 L7 23"
                  stroke="#b42318"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
              </pattern>
              <pattern id="e10-mark-missing" width="26" height="26" patternUnits="userSpaceOnUse">
                <circle cx="13" cy="13" r="4" fill="#2f6fde" fillOpacity={0.65} />
              </pattern>
            </defs>

            <rect width={LOGICAL_WIDTH} height={LOGICAL_HEIGHT} fill={PAPER} />
            <g stroke={GRID} strokeWidth={1.4} strokeOpacity={0.75} pointerEvents="none">
              {Array.from({ length: state.settings.grid + 1 }, (_, index) => (
                <line
                  key={`v-${index}`}
                  x1={rect.x + index * rect.cell}
                  y1={rect.y}
                  x2={rect.x + index * rect.cell}
                  y2={rect.y + rect.height}
                />
              ))}
              {Array.from({ length: state.settings.grid + 1 }, (_, index) => (
                <line
                  key={`h-${index}`}
                  x1={rect.x}
                  y1={rect.y + index * rect.cell}
                  x2={rect.x + rect.width}
                  y2={rect.y + index * rect.cell}
                />
              ))}
            </g>

            {state.painted.map((cell) => {
              const box = cellRect(rect, cell);
              return (
                <rect
                  key={`painted-${cellKey(cell)}`}
                  data-painted
                  x={box.x}
                  y={box.y}
                  width={box.width}
                  height={box.height}
                  fill="url(#e10-painted-hatch)"
                  stroke={ORANGE}
                  strokeWidth={2.5}
                  strokeDasharray="7 5"
                />
              );
            })}

            <g data-start pointerEvents="none">
              <FigureShape
                figure={state.start}
                rect={rect}
                fill="url(#e10-start-hatch)"
                stroke={INK}
                strokeWidth={4}
                labels={state.settings.labels ? S.vertexLabels : undefined}
              />
            </g>

            {!state.confirmed && firstTurn && firstTurn.kind === 'turn' ? (
              <g data-pin pointerEvents="none">
                <circle
                  cx={ptXY(rect, firstTurn.center).x}
                  cy={ptXY(rect, firstTurn.center).y}
                  r={9}
                  fill={ORANGE}
                  stroke="#ffffff"
                  strokeWidth={2}
                />
              </g>
            ) : null}

            {state.settings.selfCheck && state.confirmed ? (
              <ResultLayer
                start={state.start}
                operations={state.operations}
                rect={rect}
                cpa={cpa}
                reduced={reduced}
                painted={state.painted}
                result={result}
                labels={state.settings.labels ? S.vertexLabels : undefined}
                ghost={state.settings.ghost}
                arcTrail={state.settings.arcTrail}
              />
            ) : null}

            {focused || readOnly ? (
              <rect
                data-cursor
                x={cellRect(rect, cursorCell).x}
                y={cellRect(rect, cursorCell).y}
                width={rect.cell}
                height={rect.cell}
                fill="none"
                stroke={ORANGE}
                strokeWidth={3}
                strokeDasharray="8 5"
                pointerEvents="none"
              />
            ) : null}
          </svg>
        </div>

        <div className={styles.sideStack}>
          <div className={styles.predictActions}>
            {state.settings.selfCheck ? (
              <>
                <button
                  type="button"
                  className={styles.button}
                  disabled={readOnly || state.painted.length === 0 || state.confirmed}
                  onClick={() => dispatch({ type: 'confirm' })}
                >
                  {S.predict.confirm}
                </button>
                {state.confirmed ? (
                  <button
                    type="button"
                    className={styles.button}
                    disabled={readOnly}
                    onClick={() => dispatch({ type: 'retry' })}
                  >
                    {S.predict.retry}
                  </button>
                ) : (
                  <button
                    type="button"
                    className={styles.button}
                    disabled={readOnly || state.painted.length === 0}
                    onClick={() => dispatch({ type: 'clear-paint' })}
                  >
                    {S.predict.clearPaint}
                  </button>
                )}
              </>
            ) : (
              <button
                type="button"
                className={styles.button}
                disabled={readOnly || state.painted.length === 0}
                onClick={() => dispatch({ type: 'clear-paint' })}
              >
                {S.predict.clearPaint}
              </button>
            )}
          </div>

          {state.settings.showOperation ? (
            <section className={styles.operationPanel} aria-label={S.panel.operationTitle}>
              <h3 className={styles.panelLabel}>{S.panel.operationTitle}</h3>
              <ol className={styles.moveList} data-testid="operation-list">
                {operationItems.map((item) => (
                  <li key={item.key} className={styles.moveItem}>
                    {item.text}
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
