/**
 * diagonal 모드 화면(T103).
 *
 * - 정n각형 하나를 크게 그리고 꼭짓점 두 개를 차례로 골라 대각선을 긋는다.
 * - 이웃한 꼭짓점은 긋지 않고 "이건 변이에요"로 알려 준다(레이저가 변을 따라 튕긴다).
 * - 개수 표는 학생이 그은 수만 적는다. 전체 대각선 수·완성 여부·도형 이름은 쓰지 않는다.
 * - 꼭짓점 좌표는 그리기용 number이고, 상태에는 꼭짓점 번호만 있다.
 */
import { useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { minTouchRadius, pointerToLogical, useRenderedSize } from '../../../core/engine-sdk';
import type { EngineViewProps, Point } from '../../../core/engine-sdk';
import { currentPolygon, drawnPairs, sidePairs } from '../modes/diagonal/reduce';
import { DIAGONAL_CENTER, vertexPoint } from '../modes/diagonal/observe';
import type { DiagonalPair, DiagonalState } from '../modes/diagonal/types';
import { geoBoardStrings as S } from '../strings.ko';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import type { GeoAction, GeoConfig } from '../types';
import styles from '../View.module.css';

const PAPER = '#fbfaf6';
const INK = '#1d2330';
const MUTED = '#8a93a5';
const ORANGE = '#e8872e';
const RED = '#c2410c';
const BLUE = '#2f6fde';
const LOGICAL = { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT };

type DiagonalViewProps = EngineViewProps<GeoConfig, DiagonalState, GeoAction>;

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function labelPoint(n: number, index: number): Point {
  const vertex = vertexPoint(n, index);
  const length = distance(vertex, DIAGONAL_CENTER) || 1;
  return {
    x: vertex.x + ((vertex.x - DIAGONAL_CENTER.x) / length) * 34,
    y: vertex.y + ((vertex.y - DIAGONAL_CENTER.y) / length) * 34,
  };
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function pairKey(pair: DiagonalPair): string {
  return `${pair[0]}-${pair[1]}`;
}

export function DiagonalView({
  state,
  dispatch,
  cpa,
  readOnly = false,
  targetSize,
}: DiagonalViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const rendered = useRenderedSize(svgRef);
  const hitRadius = Math.max(18, Math.ceil(minTouchRadius(targetSize, rendered, LOGICAL)));
  const [cursor, setCursor] = useState(0);
  const n = currentPolygon(state);
  const cursorIndex = Math.min(cursor, n - 1);
  const drawn = drawnPairs(state, n);
  const sides = sidePairs(state, n);
  const reduced = prefersReducedMotion();
  const colored = cpa === 'C';
  const rejected = state.lastRejected;

  const drawPair = (
    pair: DiagonalPair,
    options: { readonly duplicate: boolean; readonly side: boolean },
  ) => {
    const from = vertexPoint(n, pair[0]);
    const to = vertexPoint(n, pair[1]);
    const stroke = options.side ? BLUE : colored ? ORANGE : INK;
    const width = options.side ? 5 : colored ? 6 : 4.5;
    return (
      <g key={`${options.side ? 'side' : 'diag'}-${pairKey(pair)}`} pointerEvents="none">
        {colored && !options.side ? (
          <line
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            stroke={stroke}
            strokeWidth={13}
            strokeOpacity={0.22}
            strokeLinecap="round"
          />
        ) : null}
        <line
          x1={from.x}
          y1={from.y}
          x2={to.x}
          y2={to.y}
          stroke={options.duplicate ? RED : stroke}
          strokeWidth={options.duplicate ? width + 2 : width}
          strokeLinecap="round"
          strokeDasharray={options.duplicate ? '12 7' : undefined}
        >
          {options.duplicate && !reduced ? (
            <animate attributeName="stroke-opacity" values="1;0.15;1" dur="0.45s" repeatCount="2" />
          ) : null}
        </line>
      </g>
    );
  };

  const vertexAt = (point: Point): number | null => {
    let best: { readonly index: number; readonly distance: number } | null = null;
    for (let index = 0; index < n; index += 1) {
      const current = distance(point, vertexPoint(n, index));
      if (!best || current < best.distance) best = { index, distance: current };
    }
    return best && best.distance <= hitRadius ? best.index : null;
  };

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (readOnly) return;
    const point = pointerToLogical(event, svgRef.current, LOGICAL);
    const vertex = vertexAt(point);
    if (vertex === null) return;
    setCursor(vertex);
    dispatch({ type: 'pick-vertex', vertex });
  };

  const onCanvasKeyDown = (event: ReactKeyboardEvent<SVGSVGElement>) => {
    if (readOnly) return;
    const key = event.key;
    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      event.preventDefault();
      const step = key === 'ArrowRight' ? 1 : -1;
      setCursor((current) => (((current + step) % n) + n) % n);
      return;
    }
    if (key === 'Enter' || key === ' ' || key === 'Spacebar') {
      event.preventDefault();
      dispatch({ type: 'pick-vertex', vertex: cursorIndex });
      return;
    }
    if (key === 'Escape') {
      event.preventDefault();
      if (state.pending !== null) dispatch({ type: 'pick-vertex', vertex: state.pending });
      return;
    }
    if (key === 'Backspace') {
      event.preventDefault();
      dispatch({ type: 'undo-diagonal' });
    }
  };

  const rejectedPair =
    rejected && rejected.reason === 'adjacent' && rejected.n === n ? rejected.pair : null;
  const rejectedDuplicate =
    rejected && rejected.reason === 'duplicate' && rejected.n === n ? rejected.pair : null;
  const statusText =
    rejectedPair !== null
      ? S.diagonal.adjacent
      : rejectedDuplicate !== null
        ? S.diagonal.duplicate
        : state.pending !== null
          ? S.diagonal.pending
          : '';

  return (
    <div className={styles.wrap} data-target-size={targetSize}>
      <div className={styles.toolbar} role="toolbar" aria-label={S.diagonal.polygonGroup}>
        {state.settings.polygons.map((count, index) => (
          <button
            key={`polygon-${count}`}
            type="button"
            className={styles.button}
            aria-pressed={state.current === index}
            onClick={() => {
              setCursor(0);
              dispatch({ type: 'select-polygon', index });
            }}
            disabled={readOnly}
          >
            {S.diagonal.polygonButton(count)}
          </button>
        ))}
        <button
          type="button"
          className={styles.button}
          onClick={() => dispatch({ type: 'undo-diagonal' })}
          disabled={readOnly || drawn.length === 0}
        >
          {S.diagonal.undo}
        </button>
        <button
          type="button"
          className={styles.button}
          onClick={() => dispatch({ type: 'clear-diagonals' })}
          disabled={readOnly || drawn.length === 0}
        >
          {S.diagonal.clear}
        </button>
      </div>

      <p className={styles.instructions}>{S.diagonal.instructions}</p>
      <p className={styles.status} role="status" data-testid="diagonal-status">
        {statusText}
      </p>

      <div className={styles.stageRow}>
        <div className={styles.boardArea}>
          <svg
            ref={svgRef}
            className={styles.canvas}
            viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`}
            role="group"
            aria-label={S.diagonal.canvasLabel}
            tabIndex={readOnly ? -1 : 0}
            data-testid="geo-canvas"
            data-cpa={cpa}
            onKeyDown={onCanvasKeyDown}
            onPointerDown={onPointerDown}
          >
            <rect width={LOGICAL_WIDTH} height={LOGICAL_HEIGHT} fill={PAPER} />

            <polygon
              points={Array.from({ length: n }, (_, index) => {
                const point = vertexPoint(n, index);
                return `${point.x.toFixed(2)},${point.y.toFixed(2)}`;
              }).join(' ')}
              fill={colored ? '#fff7ee' : 'none'}
              fillOpacity={colored ? 0.55 : 0}
              stroke={INK}
              strokeWidth={colored ? 5 : 4}
              strokeLinejoin="round"
              pointerEvents="none"
            />

            {sides.map((pair) => drawPair(pair, { duplicate: false, side: true }))}

            {drawn.map((pair) => drawPair(pair, { duplicate: false, side: false }))}

            {rejectedDuplicate
              ? drawPair(rejectedDuplicate, { duplicate: true, side: false })
              : null}

            {rejectedPair
              ? (() => {
                  const from = vertexPoint(n, rejectedPair[0]);
                  const to = vertexPoint(n, rejectedPair[1]);
                  const middle = midpoint(from, to);
                  return (
                    <g key="rejected-side" pointerEvents="none">
                      <line
                        x1={from.x}
                        y1={from.y}
                        x2={to.x}
                        y2={to.y}
                        stroke={ORANGE}
                        strokeWidth={16}
                        strokeOpacity={0.55}
                        strokeLinecap="round"
                        strokeDasharray="20 10"
                      >
                        {!reduced ? (
                          <animate
                            attributeName="stroke-dashoffset"
                            values="0;-60"
                            dur="0.7s"
                            repeatCount="indefinite"
                          />
                        ) : null}
                      </line>
                      <text
                        x={middle.x}
                        y={middle.y - 22}
                        textAnchor="middle"
                        fontSize={24}
                        fontWeight={800}
                        fill={RED}
                      >
                        {S.diagonal.sideLabel}
                      </text>
                    </g>
                  );
                })()
              : null}

            {Array.from({ length: n }, (_, index) => {
              const point = vertexPoint(n, index);
              const label = labelPoint(n, index);
              const chosen = state.pending === index || cursorIndex === index;
              return (
                <g key={`vertex-${index}`} pointerEvents="none">
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={chosen ? 17 : 12}
                    fill={state.pending === index ? ORANGE : PAPER}
                    stroke={state.pending === index ? RED : INK}
                    strokeWidth={chosen ? 4 : 3}
                  />
                  <text
                    x={label.x}
                    y={label.y + 8}
                    textAnchor="middle"
                    fontSize={26}
                    fontWeight={800}
                    fill={state.pending === index ? RED : INK}
                  >
                    {S.diagonal.vertexLabels[index] ?? String(index + 1)}
                  </text>
                </g>
              );
            })}

            <circle
              cx={vertexPoint(n, cursorIndex).x}
              cy={vertexPoint(n, cursorIndex).y}
              r={Math.max(22, hitRadius * 0.7)}
              fill="none"
              stroke={MUTED}
              strokeWidth={2.5}
              strokeDasharray="7 5"
              pointerEvents="none"
              data-testid="diagonal-cursor"
            />
          </svg>
        </div>

        <div className={styles.sideStack}>
          {state.settings.countTable ? (
            <table
              data-testid="diagonal-table"
              style={{ marginTop: 12, borderCollapse: 'collapse', minWidth: 260 }}
            >
              <caption style={{ textAlign: 'left', fontWeight: 700, paddingBottom: 6 }}>
                {S.diagonal.countTableTitle}
              </caption>
              <thead>
                <tr>
                  <th
                    scope="col"
                    style={{ borderBottom: '2px solid #9aa4b5', padding: '6px 10px' }}
                  >
                    {S.diagonal.vertexCount}
                  </th>
                  <th
                    scope="col"
                    style={{ borderBottom: '2px solid #9aa4b5', padding: '6px 10px' }}
                  >
                    {S.diagonal.drawnCount}
                  </th>
                </tr>
              </thead>
              <tbody>
                {state.settings.polygons.map((count) => {
                  const value = state.drawn[String(count)]?.length ?? 0;
                  return (
                    <tr key={`row-${count}`}>
                      <th scope="row" style={{ padding: '6px 10px', fontWeight: 700 }}>
                        {count}
                      </th>
                      <td
                        data-testid={`diagonal-count-${count}`}
                        style={{ padding: '6px 10px', textAlign: 'center', minWidth: 92 }}
                      >
                        {value > 0 ? value : ''}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : null}

          <p className={styles.hint}>{S.diagonal.canvasHint}</p>
        </div>
      </div>
    </div>
  );
}
