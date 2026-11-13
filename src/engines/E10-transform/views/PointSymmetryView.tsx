/**
 * `point-symmetry` 화면: 압정을 꽂고 180° 돌려 점대칭의 중심을 찾는다.
 *
 * 겹치기 전에는 중심 자리·대응점을 어떤 표시로도 그리지 않는다. 압정은 학생이
 * 고른 자리일 뿐이고, 겹친 뒤에야 금색 중심 표시와 이등분 표시가 나타난다.
 * 완성하기는 반쪽만 보여 주고 나머지 반쪽은 그리지 않는다.
 */
import { useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import type { EngineViewProps } from '../../../core/engine-sdk';
import { pointerToLogical } from '../../../core/engine-sdk';
import { arcPath, boardRect, ptXY } from '../layout';
import type { BoardRect } from '../layout';
import {
  currentPointShape,
  isPointComplete,
  pinCenter,
  pointOverlaps,
} from '../modes/point-symmetry';
import { POLYGONS } from '../polygons';
import type { PointPresetId } from '../polygons';
import { transformStrings as S } from '../strings.ko';
import type { PointSymmetryState, Pt, Side, TransformAction, TransformConfig } from '../types';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import styles from '../View.module.css';

const PAPER = '#fbfaf6';
const GRID = '#c9d2e2';
const INK = '#1d2330';
const ORANGE = '#e8872e';
const GOLD = '#c9960b';
const RED = '#b42318';

type Props = EngineViewProps<TransformConfig, PointSymmetryState, TransformAction>;

interface ScreenPoint {
  readonly x: number;
  readonly y: number;
}

/** 두 배 좌표 압정을 화면 좌표로. */
function pinXY(rect: BoardRect, pin: Pt): ScreenPoint {
  return { x: rect.x + (pin[0] / 2) * rect.cell, y: rect.y + (pin[1] / 2) * rect.cell };
}

function pointsToString(points: readonly ScreenPoint[]): string {
  return points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ');
}

function regularPoints(
  center: ScreenPoint,
  radius: number,
  sides: number,
  startDegrees = -90,
): ScreenPoint[] {
  const result: ScreenPoint[] = [];
  for (let index = 0; index < sides; index += 1) {
    const radians = ((startDegrees + (360 / sides) * index) * Math.PI) / 180;
    result.push({
      x: center.x + radius * Math.cos(radians),
      y: center.y + radius * Math.sin(radians),
    });
  }
  return result;
}

/** 도형의 꼭짓점을 화면 좌표로. 정오각형은 격자점이 아니라 화면에서만 그린다. */
function shapeScreenPoints(shape: PointPresetId, rect: BoardRect): ScreenPoint[] {
  const preset = POLYGONS[shape];
  if (preset.regular) {
    return regularPoints(
      ptXY(rect, preset.regular.center),
      preset.regular.radius * rect.cell,
      preset.regular.sides,
    );
  }
  return preset.points.map((point) => ptXY(rect, point));
}

function rotate180(point: ScreenPoint, center: ScreenPoint): ScreenPoint {
  return { x: center.x * 2 - point.x, y: center.y * 2 - point.y };
}

function flipScreen(point: ScreenPoint, center: ScreenPoint, side: Side): ScreenPoint {
  if (side === 'left' || side === 'right') return { x: center.x * 2 - point.x, y: point.y };
  return { x: point.x, y: center.y * 2 - point.y };
}

function boxCenter(points: readonly ScreenPoint[]): ScreenPoint {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    if (point.x < minX) minX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.x > maxX) maxX = point.x;
    if (point.y > maxY) maxY = point.y;
  }
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
}

interface BisectPair {
  readonly from: Pt;
  readonly to: Pt;
}

/** 겹쳤을 때 대응점 쌍. 두 배 좌표에서 `pin - p`가 다른 꼭짓점이면 짝이다. */
function bisectPairs(shape: PointPresetId, pin: Pt): BisectPair[] {
  const points = POLYGONS[shape].points;
  const result: BisectPair[] = [];
  points.forEach((point, index) => {
    const reflected: Pt = [pin[0] - point[0], pin[1] - point[1]];
    const match = points.findIndex((item) => item[0] === reflected[0] && item[1] === reflected[1]);
    if (match > index) result.push({ from: point, to: points[match] as Pt });
  });
  return result;
}

function starPath(center: ScreenPoint, outer: number, inner: number): string {
  const points: string[] = [];
  for (let index = 0; index < 10; index += 1) {
    const radius = index % 2 === 0 ? outer : inner;
    const radians = ((-90 + index * 36) * Math.PI) / 180;
    points.push(
      `${(center.x + radius * Math.cos(radians)).toFixed(2)},${(center.y + radius * Math.sin(radians)).toFixed(2)}`,
    );
  }
  return points.join(' ');
}

function toNumber(value: { readonly n: bigint; readonly d: bigint }): number {
  return Number(value.n) / Number(value.d);
}

function tickPair(
  from: ScreenPoint,
  to: ScreenPoint,
): readonly { readonly a: ScreenPoint; readonly b: ScreenPoint }[] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const nx = (-dy / length) * 9;
  const ny = (dx / length) * 9;
  return [0.36, 0.64].map((t) => {
    const cx = from.x + dx * t;
    const cy = from.y + dy * t;
    return { a: { x: cx - nx, y: cy - ny }, b: { x: cx + nx, y: cy + ny } };
  });
}

export function PointSymmetryView({ state, dispatch, cpa, readOnly = false, targetSize }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const rect = boardRect(9);
  const half = state.settings.half;
  const startPoint = half[half.length - 1] ?? [0, 0];
  const [cursor, setCursor] = useState<Pt>(() => (state.task === 'complete' ? startPoint : [9, 9]));
  const [focused, setFocused] = useState(false);

  const moveCursor = (key: string, limit: number) => {
    setCursor((current) => {
      const x =
        key === 'ArrowLeft'
          ? Math.max(0, current[0] - 1)
          : key === 'ArrowRight'
            ? Math.min(limit, current[0] + 1)
            : current[0];
      const y =
        key === 'ArrowUp'
          ? Math.max(0, current[1] - 1)
          : key === 'ArrowDown'
            ? Math.min(limit, current[1] + 1)
            : current[1];
      return [x, y];
    });
  };

  const onKeyDown = (event: ReactKeyboardEvent<SVGSVGElement>) => {
    if (readOnly) return;
    const key = event.key;

    if (state.task === 'complete') {
      if (key.startsWith('Arrow')) {
        event.preventDefault();
        moveCursor(key, 9);
        return;
      }
      if (key === 'Enter') {
        event.preventDefault();
        dispatch({ type: 'add-vertex', at: cursor });
        return;
      }
      if (key === 'Backspace' || key === 'Delete') {
        event.preventDefault();
        dispatch({ type: 'undo-vertex' });
      }
      return;
    }

    if (key.startsWith('Arrow')) {
      event.preventDefault();
      if (event.shiftKey) {
        const side: Side =
          key === 'ArrowUp'
            ? 'up'
            : key === 'ArrowDown'
              ? 'down'
              : key === 'ArrowLeft'
                ? 'left'
                : 'right';
        dispatch({ type: 'flip', side });
        return;
      }
      moveCursor(key, 18);
      return;
    }
    if (key === 'Enter' || key === ' ') {
      event.preventDefault();
      dispatch({ type: 'place-pin', at: cursor });
      return;
    }
    if (key.toLowerCase() === 't') {
      event.preventDefault();
      dispatch({ type: 'turn-180' });
      return;
    }
    if (key === 'Escape') {
      event.preventDefault();
      dispatch({ type: 'reset-turn' });
      return;
    }
    const digit = Number(key);
    if (Number.isInteger(digit) && digit >= 1 && digit <= 9) {
      event.preventDefault();
      dispatch({ type: 'select-shape', index: digit - 1 });
    }
  };

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (readOnly) return;
    const point = pointerToLogical(event, svgRef.current, {
      width: LOGICAL_WIDTH,
      height: LOGICAL_HEIGHT,
    });
    if (state.task === 'complete') {
      const at: Pt = [
        Math.max(0, Math.min(9, Math.round((point.x - rect.x) / rect.cell))),
        Math.max(0, Math.min(9, Math.round((point.y - rect.y) / rect.cell))),
      ];
      setCursor(at);
      dispatch({ type: 'add-vertex', at });
      return;
    }
    const doubled: Pt = [
      Math.max(0, Math.min(18, Math.round(((point.x - rect.x) / rect.cell) * 2))),
      Math.max(0, Math.min(18, Math.round(((point.y - rect.y) / rect.cell) * 2))),
    ];
    setCursor(doubled);
    dispatch({ type: 'place-pin', at: doubled });
  };

  const gridLines = Array.from({ length: 10 }, (_, index) => ({
    x1: rect.x + index * rect.cell,
    y1: rect.y,
    x2: rect.x + index * rect.cell,
    y2: rect.y + rect.height,
  })).concat(
    Array.from({ length: 10 }, (_, index) => ({
      x1: rect.x,
      y1: rect.y + index * rect.cell,
      x2: rect.x + rect.width,
      y2: rect.y + index * rect.cell,
    })),
  );

  if (state.task === 'complete') {
    const complete = isPointComplete(state);
    const halfScreen = half.map((point) => ptXY(rect, point));
    const studentScreen = state.vertices.map((point) => ptXY(rect, point));
    const center = pinCenter(state.settings.center);
    const centerXY = {
      x: rect.x + toNumber(center.x) * rect.cell,
      y: rect.y + toNumber(center.y) * rect.cell,
    };
    const cursorXY = ptXY(rect, cursor);

    return (
      <div className={styles.wrap} data-target-size={targetSize}>
        <div className={styles.toolbar}>
          <span className={styles.group}>
            <span className={styles.groupLabel}>{S.point.complete.instruction}</span>
          </span>
          <span className={styles.hint}>{S.keyboard['point-symmetry']}</span>
        </div>
        <p className={styles.instructions}>{S.point.complete.instruction}</p>
        <p className={styles.status} role="status" data-testid="point-status">
          {complete ? S.point.complete.closed : S.point.complete.notClosed}
        </p>

        <div className={styles.stageRow}>
          <div className={styles.boardArea}>
            <svg
              ref={svgRef}
              className={styles.canvas}
              viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`}
              role="group"
              aria-label={S.canvasLabel['point-symmetry']}
              tabIndex={readOnly ? -1 : 0}
              data-testid="transform-canvas"
              data-motion="full"
              data-cpa={cpa}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={onKeyDown}
              onPointerDown={onPointerDown}
            >
              <rect width={LOGICAL_WIDTH} height={LOGICAL_HEIGHT} fill={PAPER} />
              <rect
                x={rect.x}
                y={rect.y}
                width={rect.width}
                height={rect.height}
                fill="#fffdf7"
                stroke="#7a8497"
                strokeWidth={2}
              />
              <g stroke={GRID} strokeWidth={1.2} strokeOpacity={0.75} pointerEvents="none">
                {gridLines.map((line, index) => (
                  <line key={`grid-${index}`} x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} />
                ))}
              </g>
              {Array.from({ length: 10 }, (_, row) =>
                Array.from({ length: 10 }, (_, index) => {
                  const xy = ptXY(rect, [index, row]);
                  return (
                    <circle
                      key={`dot-${index}-${row}`}
                      cx={xy.x}
                      cy={xy.y}
                      r={3.5}
                      fill="#9aa7bd"
                    />
                  );
                }),
              )}
              <g data-given-center>
                <circle
                  cx={centerXY.x}
                  cy={centerXY.y}
                  r={10}
                  fill="none"
                  stroke={GOLD}
                  strokeWidth={3}
                  strokeDasharray="7 5"
                />
                <circle cx={centerXY.x} cy={centerXY.y} r={3} fill={GOLD} />
              </g>
              <polyline
                points={halfScreen.map((point) => `${point.x},${point.y}`).join(' ')}
                fill="none"
                stroke={INK}
                strokeWidth={5}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {state.vertices.length > 0 ? (
                <polyline
                  data-student-path
                  points={studentScreen.map((point) => `${point.x},${point.y}`).join(' ')}
                  fill="none"
                  stroke={ORANGE}
                  strokeWidth={5}
                  strokeDasharray="8 6"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ) : null}
              {state.vertices.map((point, index) => {
                const xy = ptXY(rect, point);
                return (
                  <circle
                    key={`student-vertex-${index}`}
                    cx={xy.x}
                    cy={xy.y}
                    r={7}
                    fill={ORANGE}
                    stroke="#ffffff"
                    strokeWidth={2}
                  />
                );
              })}
              {focused ? (
                <circle
                  data-cursor
                  cx={cursorXY.x}
                  cy={cursorXY.y}
                  r={18}
                  fill="none"
                  stroke={ORANGE}
                  strokeWidth={3}
                  strokeDasharray="7 5"
                  pointerEvents="none"
                />
              ) : null}
            </svg>
          </div>
          <div className={styles.sideStack}>
            <div className={styles.panel} role="group" aria-label={S.name}>
              <section className={styles.panelGroup}>
                <span className={styles.panelLabel}>{S.point.complete.instruction}</span>
                <div className={styles.directionRow}>
                  <button
                    type="button"
                    className={styles.button}
                    disabled={readOnly || state.vertices.length === 0}
                    onClick={() => dispatch({ type: 'undo-vertex' })}
                  >
                    {S.point.complete.undo}
                  </button>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const shape = currentPointShape(state);
  const base = shapeScreenPoints(shape, rect);
  const origin = boxCenter(base);
  const overlaps = pointOverlaps(state);
  const centerPoint = state.pin ? pinXY(rect, state.pin) : null;
  const flippedSide: Side | null = state.flipped;
  const turnedShape =
    state.turned && centerPoint ? base.map((point) => rotate180(point, centerPoint)) : null;
  const flippedShape = flippedSide
    ? base.map((point) => flipScreen(point, origin, flippedSide))
    : null;
  const activeShape = turnedShape ?? flippedShape ?? base;
  const ghost = state.turned || state.flipped !== null;

  const pairs = overlaps && state.pin ? bisectPairs(shape, state.pin) : [];
  const cursorXY = pinXY(rect, cursor);

  const status = state.flipped
    ? S.point.flipWarn
    : state.turned
      ? overlaps
        ? S.point.centerFound
        : S.point.notYet
      : S.point.prompt;

  return (
    <div className={styles.wrap} data-target-size={targetSize}>
      <div className={styles.toolbar}>
        <span className={styles.group}>
          <span className={styles.groupLabel}>{S.point.shapePick(state.shapeIndex)}</span>
        </span>
        <span className={styles.hint}>{S.keyboard['point-symmetry']}</span>
      </div>
      <p className={styles.instructions}>{S.instructions['point-symmetry']}</p>
      <p className={styles.status} role="status" data-testid="point-status">
        {status}
      </p>

      <div className={styles.stageRow}>
        <div className={styles.boardArea}>
          <svg
            ref={svgRef}
            className={styles.canvas}
            viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`}
            role="group"
            aria-label={S.canvasLabel['point-symmetry']}
            tabIndex={readOnly ? -1 : 0}
            data-testid="transform-canvas"
            data-motion="full"
            data-cpa={cpa}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={onKeyDown}
            onPointerDown={onPointerDown}
          >
            <defs>
              <pattern
                id="e10-point-gold"
                width="18"
                height="18"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <rect width="18" height="18" fill="#fff4cc" />
                <line x1="0" y1="0" x2="0" y2="18" stroke={GOLD} strokeWidth="3" />
              </pattern>
            </defs>
            <rect width={LOGICAL_WIDTH} height={LOGICAL_HEIGHT} fill={PAPER} />
            <rect
              x={rect.x}
              y={rect.y}
              width={rect.width}
              height={rect.height}
              fill="#fffdf7"
              stroke="#7a8497"
              strokeWidth={2}
            />
            <g stroke={GRID} strokeWidth={1.2} strokeOpacity={0.75} pointerEvents="none">
              {gridLines.map((line, index) => (
                <line key={`grid-${index}`} x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} />
              ))}
            </g>
            {Array.from({ length: 10 }, (_, row) =>
              Array.from({ length: 10 }, (_, index) => {
                const xy = ptXY(rect, [index, row]);
                return (
                  <circle key={`dot-${index}-${row}`} cx={xy.x} cy={xy.y} r={3.5} fill="#9aa7bd" />
                );
              }),
            )}

            {ghost ? (
              <polygon
                data-ghost
                points={pointsToString(base)}
                fill="none"
                stroke="#9aa7bd"
                strokeWidth={3}
                strokeDasharray="9 7"
                opacity={0.75}
              />
            ) : null}

            <polygon
              data-shape
              points={pointsToString(activeShape)}
              fill={overlaps ? 'url(#e10-point-gold)' : '#dbe7ff'}
              fillOpacity={0.45}
              stroke={INK}
              strokeWidth={4}
              strokeLinejoin="round"
            />

            {state.turned && centerPoint && state.settings.showArcs
              ? base.map((point, index) => {
                  const path = arcPath(
                    centerPoint,
                    point,
                    rotate180(point, centerPoint),
                    180,
                    'cw',
                  );
                  return path ? (
                    <path
                      key={`arc-${index}`}
                      data-arc
                      d={path}
                      fill="none"
                      stroke={ORANGE}
                      strokeWidth={3.5}
                      strokeLinecap="round"
                    />
                  ) : null;
                })
              : null}

            {centerPoint ? (
              <g data-pin={overlaps ? 'center' : 'trial'}>
                <circle
                  cx={centerPoint.x}
                  cy={centerPoint.y}
                  r={overlaps ? 16 : 10}
                  fill={overlaps ? GOLD : ORANGE}
                  stroke="#ffffff"
                  strokeWidth={3}
                />
                {!overlaps ? (
                  <circle
                    cx={centerPoint.x}
                    cy={centerPoint.y}
                    r={19}
                    fill="none"
                    stroke={ORANGE}
                    strokeWidth={2}
                    strokeOpacity={0.55}
                  />
                ) : null}
              </g>
            ) : null}

            {overlaps && centerPoint ? (
              <g data-center-mark>
                <polygon
                  points={starPath(centerPoint, 30, 13)}
                  fill={GOLD}
                  stroke="#ffffff"
                  strokeWidth={2}
                />
                <text
                  x={centerPoint.x + 34}
                  y={centerPoint.y - 22}
                  fontSize={28}
                  fontWeight={800}
                  fill={GOLD}
                  stroke="#ffffff"
                  strokeWidth={4}
                  paintOrder="stroke"
                >
                  {S.point.center}
                </text>
              </g>
            ) : null}

            {pairs.map((pair, index) => {
              const from = ptXY(rect, pair.from);
              const to = ptXY(rect, pair.to);
              const ticks = tickPair(from, to);
              return (
                <g key={`bisect-${index}`} data-bisect>
                  <line
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    stroke={RED}
                    strokeWidth={2.5}
                    strokeDasharray="10 6"
                  />
                  {ticks.map((tick, tickIndex) => (
                    <line
                      key={`tick-${tickIndex}`}
                      x1={tick.a.x}
                      y1={tick.a.y}
                      x2={tick.b.x}
                      y2={tick.b.y}
                      stroke={RED}
                      strokeWidth={3}
                    />
                  ))}
                </g>
              );
            })}

            {focused ? (
              <circle
                data-cursor
                cx={cursorXY.x}
                cy={cursorXY.y}
                r={state.pin ? 22 : 18}
                fill="none"
                stroke={ORANGE}
                strokeWidth={3}
                strokeDasharray="7 5"
                pointerEvents="none"
              />
            ) : null}
          </svg>
        </div>
        <div className={styles.sideStack}>
          <div className={styles.panel} role="group" aria-label={S.name}>
            <section className={styles.panelGroup}>
              <span className={styles.panelLabel}>{S.point.place}</span>
              <div className={styles.directionRow}>
                <button
                  type="button"
                  className={styles.button}
                  disabled={readOnly}
                  onClick={() => dispatch({ type: 'place-pin', at: cursor })}
                >
                  {S.point.place}
                </button>
                <button
                  type="button"
                  className={styles.button}
                  disabled={readOnly || !state.pin}
                  onClick={() => dispatch({ type: 'turn-180' })}
                >
                  {S.point.turn}
                </button>
                <button
                  type="button"
                  className={styles.button}
                  disabled={readOnly || (!state.turned && !state.flipped)}
                  onClick={() => dispatch({ type: 'reset-turn' })}
                >
                  {S.point.reset}
                </button>
              </div>
            </section>
            <section className={styles.panelGroup}>
              <span className={styles.panelLabel}>{S.point.shapePick(state.shapeIndex)}</span>
              <div className={styles.directionRow}>
                {state.settings.shapes.map((id: PointPresetId, index: number) => (
                  <button
                    key={id}
                    type="button"
                    className={styles.button}
                    aria-pressed={state.shapeIndex === index}
                    disabled={readOnly}
                    onClick={() => dispatch({ type: 'select-shape', index })}
                  >
                    {S.point.shapePick(index)}
                  </button>
                ))}
              </div>
            </section>
            <section className={styles.panelGroup}>
              <span className={styles.panelLabel}>{S.panel.flipGroup}</span>
              <div className={styles.directionRow}>
                {(['up', 'down', 'left', 'right'] as const).map((side) => (
                  <button
                    key={side}
                    type="button"
                    className={styles.button}
                    disabled={readOnly}
                    onClick={() => dispatch({ type: 'flip', side })}
                  >
                    {S.sides[side]}
                  </button>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
