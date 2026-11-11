/**
 * geoboard `fixed-perimeter` 제약 화면(T103).
 *
 * - 왼쪽 위 꼭짓점을 `[0, 0]`에 고정한 직사각형 하나를 고무줄로 그린다.
 * - 오른쪽 아래 꼭짓점 손잡이를 끌면 둘레는 그대로이고 가로·세로가 바뀐다.
 * - 넓이는 지금 값만 실시간으로 쓴다. 최대 넓이·정답 직사각형은 쓰지 않는다.
 * - 기록표는 학생이 "기록하기"로 남긴 줄만 보여 준다.
 */
import { useRef } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { clamp, minTouchRadius, pointerToLogical, useRenderedSize } from '../../../core/engine-sdk';
import type { EngineViewProps } from '../../../core/engine-sdk';
import { boardRect, nearestPeg, pegPoint } from '../layout';
import { currentRect, rectRange } from '../modes/perimeter/reduce';
import { geoBoardStrings as S } from '../strings.ko';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import type { GeoAction, GeoConfig, GeoboardState } from '../types';
import styles from '../View.module.css';

const PAPER = '#fbfaf6';
const INK = '#1d2330';
const GRID = '#c9d2e2';
const ORANGE = '#e8872e';
const BLUE = '#2f6fde';
const LOGICAL = { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT };

type PerimeterViewProps = EngineViewProps<GeoConfig, GeoboardState, GeoAction>;

function pointsString(
  pegs: readonly (readonly [number, number])[],
  rect: ReturnType<typeof boardRect>,
): string {
  return pegs
    .map((peg) => pegPoint(rect, peg))
    .map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`)
    .join(' ');
}

export function PerimeterView({
  state,
  dispatch,
  cpa,
  readOnly = false,
  targetSize,
}: PerimeterViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const rendered = useRenderedSize(svgRef);
  const hitRadius = Math.max(30, Math.ceil(minTouchRadius(targetSize, rendered, LOGICAL)));
  const dragRef = useRef<number | null>(null);
  const constraint = state.settings.constraint;
  if (!constraint) return null;

  const [cols, rows] = state.settings.grid;
  const rect = boardRect(cols, rows);
  const range = rectRange(constraint, cols, rows);
  const size = currentRect(state);
  if (!range || !size) return null;

  const { width, height } = size;
  const half = range.half;
  const colored = cpa === 'C';
  const area = width * height;
  const band = state.bands[0];
  const handle = pegPoint(rect, [width, height]);
  const topMiddle = pegPoint(rect, [width / 2, 0]);
  const bottomMiddle = pegPoint(rect, [width / 2, height]);
  const rightMiddle = pegPoint(rect, [width, height / 2]);

  const resizeToWidth = (nextWidth: number) => {
    const safe = clamp(Math.round(nextWidth), range.minWidth, range.maxWidth);
    dispatch({ type: 'resize-rect', width: safe, height: half - safe });
  };

  const resizeToHeight = (nextHeight: number) => {
    const minHeight = Math.max(1, half - (cols - 1));
    const maxHeight = Math.min(half - 1, rows - 1);
    const safe = clamp(Math.round(nextHeight), minHeight, maxHeight);
    dispatch({ type: 'resize-rect', width: half - safe, height: safe });
  };

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (readOnly) return;
    const point = pointerToLogical(event, svgRef.current, LOGICAL);
    if (Math.hypot(point.x - handle.x, point.y - handle.y) > hitRadius) return;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // jsdom·이미 끝난 포인터.
    }
    dragRef.current = event.pointerId;
  };

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (readOnly || dragRef.current !== event.pointerId) return;
    const point = pointerToLogical(event, svgRef.current, LOGICAL);
    const peg = nearestPeg(rect, point);
    const deltaWidth = peg[0] - width;
    const deltaHeight = peg[1] - height;
    if (Math.abs(deltaWidth) >= Math.abs(deltaHeight)) resizeToWidth(width + deltaWidth);
    else resizeToHeight(height + deltaHeight);
  };

  const onCanvasKeyDown = (event: ReactKeyboardEvent<SVGSVGElement>) => {
    if (readOnly) return;
    const key = event.key;
    if (key === 'ArrowRight' || key === 'ArrowLeft') {
      event.preventDefault();
      resizeToWidth(width + (key === 'ArrowRight' ? 1 : -1));
      return;
    }
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      event.preventDefault();
      resizeToHeight(height + (key === 'ArrowDown' ? 1 : -1));
      return;
    }
    if (key === 'Enter' || key === ' ' || key === 'Spacebar') {
      event.preventDefault();
      dispatch({ type: 'log-rect' });
    }
  };

  return (
    <div className={styles.wrap} data-target-size={targetSize}>
      <div className={styles.toolbar}>
        <span className={styles.group}>
          <span className={styles.groupLabel}>{S.perimeter.perimeterLabel(constraint.value)}</span>
        </span>
        <button
          type="button"
          className={styles.button}
          onClick={() => dispatch({ type: 'log-rect' })}
          disabled={readOnly || !state.settings.log}
        >
          {S.perimeter.logButton}
        </button>
        <span className={styles.hint}>{S.perimeter.canvasHint}</span>
      </div>

      <p className={styles.instructions}>{S.perimeter.instructions}</p>

      <div className={styles.boardArea}>
        <svg
          ref={svgRef}
          className={styles.canvas}
          viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`}
          role="group"
          aria-label={S.perimeter.canvasLabel}
          tabIndex={readOnly ? -1 : 0}
          data-testid="geo-canvas"
          data-cpa={cpa}
          onKeyDown={onCanvasKeyDown}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={() => {
            dragRef.current = null;
          }}
          onPointerCancel={() => {
            dragRef.current = null;
          }}
        >
          <rect width={LOGICAL_WIDTH} height={LOGICAL_HEIGHT} fill={PAPER} />
          <g stroke={GRID} strokeWidth={1} strokeOpacity={0.5} pointerEvents="none">
            {Array.from({ length: rows }, (_, row) => (
              <line
                key={`h-${row}`}
                x1={rect.x}
                y1={pegPoint(rect, [0, row]).y}
                x2={rect.x + rect.width}
                y2={pegPoint(rect, [0, row]).y}
              />
            ))}
            {Array.from({ length: cols }, (_, col) => (
              <line
                key={`v-${col}`}
                x1={pegPoint(rect, [col, 0]).x}
                y1={rect.y}
                x2={pegPoint(rect, [col, 0]).x}
                y2={rect.y + rect.height}
              />
            ))}
          </g>

          <g pointerEvents="none">
            {Array.from({ length: rows }, (_, row) =>
              Array.from({ length: cols }, (_, col) => {
                const point = pegPoint(rect, [col, row]);
                return (
                  <circle
                    key={`peg-${col}-${row}`}
                    cx={point.x}
                    cy={point.y}
                    r={Math.max(3, Math.min(6, rect.spacing * 0.055))}
                    fill={INK}
                  />
                );
              }),
            )}
          </g>

          {band ? (
            <polygon
              points={pointsString(band.pegs, rect)}
              fill={colored ? BLUE : 'none'}
              fillOpacity={colored ? 0.1 : 0}
              stroke={colored ? BLUE : INK}
              strokeWidth={colored ? 6 : 5}
              strokeLinejoin="round"
              pointerEvents="none"
            />
          ) : null}

          <g pointerEvents="none">
            <text
              x={topMiddle.x}
              y={topMiddle.y - 28}
              textAnchor="middle"
              fontSize={24}
              fontWeight={800}
              fill={INK}
              data-testid="perimeter-value"
            >
              {S.perimeter.perimeterLabel(2 * (width + height))}
            </text>
            <text
              x={(rect.x + topMiddle.x) / 2}
              y={Math.max(rect.y - 8, 30)}
              textAnchor="middle"
              fontSize={20}
              fontWeight={700}
              fill={BLUE}
              data-testid="perimeter-width"
            >
              {S.perimeter.widthLabel(width)}
            </text>
            <text
              x={rightMiddle.x + 18}
              y={rightMiddle.y}
              textAnchor="start"
              fontSize={20}
              fontWeight={700}
              fill={BLUE}
              data-testid="perimeter-height"
            >
              {S.perimeter.heightLabel(height)}
            </text>
            <text
              x={(rect.x + pegPoint(rect, [width, 0]).x) / 2}
              y={(rect.y + pegPoint(rect, [0, height]).y) / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={34}
              fontWeight={800}
              fill={colored ? BLUE : INK}
              data-testid="perimeter-area"
            >
              {S.perimeter.areaLabel(area)}
            </text>
            <text
              x={bottomMiddle.x}
              y={bottomMiddle.y + 40}
              textAnchor="middle"
              fontSize={20}
              fontWeight={700}
              fill={BLUE}
              data-testid="perimeter-width-bottom"
            >
              {S.perimeter.widthLabel(width)}
            </text>
          </g>

          <g pointerEvents="none">
            <circle cx={handle.x} cy={handle.y} r={hitRadius} fill={ORANGE} fillOpacity={0.18} />
            <circle
              cx={handle.x}
              cy={handle.y}
              r={Math.max(22, hitRadius * 0.6)}
              fill={PAPER}
              stroke={ORANGE}
              strokeWidth={5}
              data-testid="perimeter-handle"
            />
            <circle cx={handle.x} cy={handle.y} r={5} fill={ORANGE} />
          </g>
        </svg>
      </div>

      {state.settings.log ? (
        <table
          data-testid="perimeter-log"
          style={{ marginTop: 12, borderCollapse: 'collapse', minWidth: 240 }}
        >
          <caption style={{ textAlign: 'left', fontWeight: 700, paddingBottom: 6 }}>
            {S.perimeter.logTitle}
          </caption>
          <thead>
            <tr>
              {[S.perimeter.logWidth, S.perimeter.logHeight, S.perimeter.logArea].map((label) => (
                <th
                  key={label}
                  scope="col"
                  style={{ borderBottom: '2px solid #9aa4b5', padding: '6px 10px' }}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {state.log.map((entry, index) => (
              <tr key={`log-${index}`} data-testid="perimeter-log-row">
                <td style={{ padding: '6px 10px', textAlign: 'center' }}>{entry.width}</td>
                <td style={{ padding: '6px 10px', textAlign: 'center' }}>{entry.height}</td>
                <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                  {entry.width * entry.height}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}
