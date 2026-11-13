/**
 * `line-symmetry` 화면: 대칭축 찾기 · 데칼코마니 · 반쪽 완성하기.
 *
 * 접기 전에는 정답 축·축 개수를 그리지 않는다. 접은 결과(겹침/빈틈)는 학생이
 * 접은 뒤에만 보여 준다. 완성하기는 남은 반쪽을 절대 그리지 않는다.
 */
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import type { EngineViewProps } from '../../../core/engine-sdk';
import { pointerToLogical } from '../../../core/engine-sdk';
import { boardRect, ptXY, triBoardRect, triPtXY } from '../layout';
import type { BoardRect, TriBoardRect } from '../layout';
import { currentLineShape, isLineComplete } from '../modes/line-symmetry';
import { POLYGONS } from '../polygons';
import type { LinePresetId } from '../polygons';
import { transformStrings as S } from '../strings.ko';
import type { LineSymmetryState, Pt, TransformAction, TransformConfig } from '../types';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import styles from '../View.module.css';
import { prefersReducedMotion } from './parts/motion';
import { DotBoard } from './parts/DotBoard';

const PAPER = '#fbfaf6';
const GRID = '#c9d2e2';
const INK = '#1d2330';
const ORANGE = '#e8872e';
const RED = '#b42318';
const BLUE = '#2f6fde';

type Props = EngineViewProps<TransformConfig, LineSymmetryState, TransformAction>;

interface ScreenPoint {
  readonly x: number;
  readonly y: number;
}

function reflect(point: ScreenPoint, a: ScreenPoint, b: ScreenPoint): ScreenPoint {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const squared = dx * dx + dy * dy;
  if (squared < 1e-9) return point;
  const t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / squared;
  const foot = { x: a.x + t * dx, y: a.y + t * dy };
  return { x: foot.x * 2 - point.x, y: foot.y * 2 - point.y };
}

function pathOf(points: readonly ScreenPoint[]): string {
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ')
    .concat(' Z');
}

/**
 * 축에 수직인 방향으로 `scale`배 늘인 SVG 행렬.
 *
 * 접기 미리보기에서 1 → −1 → 1로 움직이면 종이가 축 쪽으로 납작해졌다가
 * 반대편으로 넘어갔다가 다시 펴지는 모습이 된다.
 */
function foldPreviewMatrix(a: ScreenPoint, b: ScreenPoint, scale: number): string | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  if (length < 1e-9) return null;
  const nx = -dy / length;
  const ny = dx / length;
  const k = scale - 1;
  const m00 = 1 + k * nx * nx;
  const m01 = k * nx * ny;
  const m10 = k * ny * nx;
  const m11 = 1 + k * ny * ny;
  const tx = a.x - (m00 * a.x + m01 * a.y);
  const ty = a.y - (m10 * a.x + m11 * a.y);
  return `matrix(${m00.toFixed(4)} ${m10.toFixed(4)} ${m01.toFixed(4)} ${m11.toFixed(4)} ${tx.toFixed(2)} ${ty.toFixed(2)})`;
}

/** 접기 미리보기의 수직 배율. 0 → 접힘(−1) → 1로 돌아온다. */
function foldPreviewScale(progress: number): number {
  const t = progress < 0 ? 0 : progress > 1 ? 1 : progress;
  return Math.cos(2 * Math.PI * t);
}

const FOLD_PREVIEW_MS = 700;

function isTriShape(shape: LinePresetId): boolean {
  return POLYGONS[shape].board === 'tri';
}

interface BoardGeom {
  readonly tri: boolean;
  readonly rect: BoardRect | TriBoardRect;
  readonly toScreen: (point: Pt) => ScreenPoint;
  readonly toPoint: (point: ScreenPoint) => Pt;
  readonly pointsString: (points: readonly Pt[]) => string;
  readonly gridLines: readonly {
    readonly x1: number;
    readonly y1: number;
    readonly x2: number;
    readonly y2: number;
  }[];
}

function geometryFor(shape: LinePresetId): BoardGeom {
  if (isTriShape(shape)) {
    const rect = triBoardRect(-3, 7, -1, 7);
    return {
      tri: true,
      rect,
      toScreen: (point) => triPtXY(rect, point),
      toPoint: (point) => {
        const root = Math.sqrt(3) / 2;
        const b = Math.round((point.y - rect.originY) / (root * rect.unit));
        const a = Math.round((point.x - rect.originX) / rect.unit - b / 2);
        return [a, b];
      },
      pointsString: (points) => triPolygonPointsFor(rect, points),
      gridLines: [],
    };
  }
  const rect = boardRect(9);
  return {
    tri: false,
    rect,
    toScreen: (point) => ptXY(rect, point),
    toPoint: (point) => [
      Math.round((point.x - rect.x) / rect.cell),
      Math.round((point.y - rect.y) / rect.cell),
    ],
    pointsString: (points) =>
      points
        .map((entry) => {
          const xy = ptXY(rect, entry);
          return `${xy.x.toFixed(2)},${xy.y.toFixed(2)}`;
        })
        .join(' '),
    gridLines: Array.from({ length: 10 }, (_, index) => ({
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
    ),
  };
}

function triPolygonPointsFor(rect: TriBoardRect, points: readonly Pt[]): string {
  return points
    .map((point) => {
      const xy = triPtXY(rect, point);
      return `${xy.x.toFixed(2)},${xy.y.toFixed(2)}`;
    })
    .join(' ');
}

export function LineSymmetryView({ state, dispatch, cpa, readOnly = false, targetSize }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [cursor, setCursor] = useState<Pt>([4, 0]);
  const [focused, setFocused] = useState(false);
  const [mark, setMark] = useState<0 | 1 | 2 | 3>(0);
  const reduced = prefersReducedMotion();
  // 접기 미리보기는 접힌 결과가 있고, 설정이 켜져 있으며, 줄인 움직임이 아닐 때만 돈다.
  const previewEnabled =
    state.task !== 'complete' &&
    state.settings.foldPreview &&
    state.showing !== null &&
    state.axis !== null &&
    !reduced;
  const [foldProgress, setFoldProgress] = useState(1);
  const previewStarted = useRef(false);

  useEffect(() => {
    if (!previewEnabled) {
      previewStarted.current = false;
      // 효과 본문에서 바로 setState를 부르지 않도록 마이크로태스크로 미룬다.
      let cancelled = false;
      const reset = () => {
        if (!cancelled) setFoldProgress(1);
      };
      if (typeof queueMicrotask === 'function') queueMicrotask(reset);
      else void Promise.resolve().then(reset);
      return () => {
        cancelled = true;
      };
    }
    if (previewStarted.current) return;
    previewStarted.current = true;
    if (typeof requestAnimationFrame !== 'function' || typeof performance === 'undefined') return;
    let frame = 0;
    let started: number | null = null;
    const tick = (now: number) => {
      if (started === null) started = now;
      const value = Math.min(1, (now - started) / FOLD_PREVIEW_MS);
      setFoldProgress(value);
      if (value < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [previewEnabled]);

  if (state.task === 'decalcomania') {
    const onKeyDown = (event: ReactKeyboardEvent<SVGSVGElement>) => {
      if (readOnly) return;
      const key = event.key;
      if (key.startsWith('Arrow')) {
        event.preventDefault();
        setCursor((current) => {
          const x =
            key === 'ArrowLeft'
              ? Math.max(0, current[0] - 1)
              : key === 'ArrowRight'
                ? Math.min(8, current[0] + 1)
                : current[0];
          const y =
            key === 'ArrowUp'
              ? Math.max(0, current[1] - 1)
              : key === 'ArrowDown'
                ? Math.min(6, current[1] + 1)
                : current[1];
          return [x, y];
        });
        return;
      }
      if (key === 'Enter') {
        event.preventDefault();
        if (cursor[0] <= 4) dispatch({ type: 'add-dot', at: cursor, mark });
        return;
      }
      if (key === 'Backspace' || key === 'Delete') {
        event.preventDefault();
        dispatch({ type: 'remove-dot', at: cursor });
        return;
      }
      if (key.toLowerCase() === 'm') {
        event.preventDefault();
        setMark((current) => ((current + 1) % 4) as 0 | 1 | 2 | 3);
        return;
      }
      if (key.toLowerCase() === 'p') {
        event.preventDefault();
        dispatch({ type: state.folded ? 'unfold-paper' : 'fold-paper' });
      }
    };

    return (
      <div className={styles.wrap} data-target-size={targetSize}>
        <div className={styles.toolbar}>
          <span className={styles.badge}>{S.line.decal.marks[mark]}</span>
          <span className={styles.hint}>{S.keyboard['line-symmetry']}</span>
        </div>
        <p className={styles.instructions}>{S.line.decal.instruction}</p>
        <p className={styles.status} role="status">
          {state.folded ? S.line.decal.folded : ''}
        </p>
        <div className={styles.stageRow}>
          <div className={styles.boardArea}>
            <DotBoard
              svgRef={svgRef}
              dots={state.dots}
              folded={state.folded}
              cursor={cursor}
              focused={focused}
              readOnly={readOnly}
              cpa={cpa}
              targetSize={targetSize}
              onKeyDown={onKeyDown}
              onPick={(at) => {
                if (at[0] <= 4) dispatch({ type: 'add-dot', at, mark });
                else dispatch({ type: 'remove-dot', at });
              }}
            />
          </div>
          <div className={styles.sideStack}>
            <div className={styles.panel} role="group" aria-label={S.name}>
              <section className={styles.panelGroup}>
                <span className={styles.panelLabel}>{S.line.decal.mark}</span>
                <div className={styles.directionRow}>
                  {S.line.decal.marks.map((text, index) => (
                    <button
                      key={text}
                      type="button"
                      className={styles.button}
                      aria-pressed={mark === index}
                      disabled={readOnly}
                      onClick={() => setMark(index as 0 | 1 | 2 | 3)}
                    >
                      {text}
                    </button>
                  ))}
                </div>
              </section>
              <section className={styles.panelGroup}>
                <span className={styles.panelLabel}>{S.line.decal.fold}</span>
                <div className={styles.directionRow}>
                  <button
                    type="button"
                    className={styles.button}
                    disabled={readOnly || state.dots.length === 0}
                    onClick={() => dispatch({ type: 'fold-paper' })}
                  >
                    {S.line.decal.fold}
                  </button>
                  <button
                    type="button"
                    className={styles.button}
                    disabled={readOnly || !state.folded}
                    onClick={() => dispatch({ type: 'unfold-paper' })}
                  >
                    {S.line.decal.unfold}
                  </button>
                  <button
                    type="button"
                    className={styles.button}
                    disabled={readOnly}
                    onClick={() => dispatch({ type: 'remove-dot', at: cursor })}
                  >
                    {S.line.decal.erase}
                  </button>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const shape = currentLineShape(state);
  const geom = geometryFor(shape);
  const preset = POLYGONS[shape];
  const shapePoints = preset.points;
  const axisScreen = state.axis
    ? { a: geom.toScreen(state.axis[0]), b: geom.toScreen(state.axis[1]) }
    : null;
  const showingFold = state.showing !== null ? state.folds[state.showing] : null;
  const foldOk = showingFold?.ok === true;
  const mirror =
    showingFold && !showingFold.ok && axisScreen
      ? shapePoints.map((point) => reflect(geom.toScreen(point), axisScreen.a, axisScreen.b))
      : null;
  const originalScreen = shapePoints.map((point) => geom.toScreen(point));
  const foldPreviewRunning = previewEnabled && foldProgress < 1;
  const foldPreviewTransform =
    foldPreviewRunning && axisScreen
      ? foldPreviewMatrix(axisScreen.a, axisScreen.b, foldPreviewScale(foldProgress))
      : null;

  const moveCursor = (key: string) => {
    setCursor((current) => {
      if (geom.tri) {
        const next: Pt =
          key === 'ArrowLeft'
            ? [current[0] - 1, current[1]]
            : key === 'ArrowRight'
              ? [current[0] + 1, current[1]]
              : key === 'ArrowUp'
                ? [current[0], Math.max(0, current[1] - 1)]
                : [current[0], Math.min(6, current[1] + 1)];
        return next;
      }
      const x =
        key === 'ArrowLeft'
          ? Math.max(0, current[0] - 1)
          : key === 'ArrowRight'
            ? Math.min(8, current[0] + 1)
            : current[0];
      const y =
        key === 'ArrowUp'
          ? Math.max(0, current[1] - 1)
          : key === 'ArrowDown'
            ? Math.min(8, current[1] + 1)
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
        moveCursor(key);
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
      moveCursor(key);
      return;
    }
    if (key === 'Enter') {
      event.preventDefault();
      dispatch({ type: 'pick-point', at: cursor });
      return;
    }
    if (key.toLowerCase() === 'f') {
      event.preventDefault();
      dispatch({ type: 'fold' });
      return;
    }
    if (key.toLowerCase() === 'u') {
      event.preventDefault();
      dispatch({ type: 'unfold' });
      return;
    }
    if (key === 'Escape') {
      event.preventDefault();
      dispatch({ type: 'clear-axis' });
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
    const at = geom.toPoint(point);
    setCursor(at);
    if (state.task === 'complete') dispatch({ type: 'add-vertex', at });
    else dispatch({ type: 'pick-point', at });
  };

  const cursorScreen = geom.toScreen(cursor);
  const completed = isLineComplete(state);
  const halfScreen = state.settings.half.map((point) => geom.toScreen(point));
  const studentScreen = state.vertices.map((point) => geom.toScreen(point));
  const axisSettingScreen = state.settings.axis.map((point) => geom.toScreen(point));

  return (
    <div className={styles.wrap} data-target-size={targetSize}>
      <div className={styles.toolbar}>
        <span className={styles.group}>
          <span className={styles.groupLabel}>{S.line.shapePick(state.shapeIndex)}</span>
        </span>
        <span className={styles.hint}>{S.keyboard['line-symmetry']}</span>
      </div>
      <p className={styles.instructions}>
        {state.task === 'complete' ? S.line.complete.instruction : S.instructions['line-symmetry']}
      </p>
      <p className={styles.status} role="status" data-testid="line-status">
        {state.task === 'complete'
          ? completed
            ? S.line.complete.closed
            : S.line.complete.notClosed
          : showingFold
            ? foldOk
              ? S.line.foldOk
              : S.line.foldGap
            : state.pending
              ? S.line.pickSecond
              : ''}
      </p>

      <div className={styles.stageRow}>
        <div className={styles.boardArea}>
          <svg
            ref={svgRef}
            className={styles.canvas}
            viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`}
            role="group"
            aria-label={S.canvasLabel['line-symmetry']}
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
                id="e10-line-gap"
                width="16"
                height="16"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(35)"
              >
                <rect width="16" height="16" fill="#ffe3e0" />
                <line x1="0" y1="0" x2="0" y2="16" stroke={RED} strokeWidth="4" />
              </pattern>
              <pattern
                id="e10-line-axis"
                width="20"
                height="20"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <rect width="20" height="20" fill="#d9f2e6" />
                <line x1="0" y1="0" x2="0" y2="20" stroke="#1f7a4d" strokeWidth="4" />
              </pattern>
            </defs>
            <rect width={LOGICAL_WIDTH} height={LOGICAL_HEIGHT} fill={PAPER} />
            {geom.gridLines.length > 0 ? (
              <g stroke={GRID} strokeWidth={1.4} strokeOpacity={0.75} pointerEvents="none">
                {geom.gridLines.map((line, index) => (
                  <line key={`grid-${index}`} x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} />
                ))}
              </g>
            ) : null}
            {geom.tri ? (
              <g stroke={GRID} strokeWidth={1} strokeOpacity={0.7} pointerEvents="none">
                {Array.from({ length: 7 }, (_, b) =>
                  Array.from({ length: 9 }, (_, index) => {
                    const start = -Math.floor(b / 2);
                    const a = start + index;
                    const p1 = geom.toScreen([a, b]);
                    const p2 = geom.toScreen([a + 1, b]);
                    const p3 = geom.toScreen([a, b + 1]);
                    const p4 = geom.toScreen([a + 1, b + 1]);
                    return (
                      <g key={`tri-grid-${a}-${b}`}>
                        <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} />
                        <line x1={p1.x} y1={p1.y} x2={p3.x} y2={p3.y} />
                        <line x1={p2.x} y1={p2.y} x2={p4.x} y2={p4.y} />
                        <line x1={p3.x} y1={p3.y} x2={p4.x} y2={p4.y} />
                      </g>
                    );
                  }),
                )}
              </g>
            ) : null}

            {state.task === 'complete' ? (
              <>
                <line
                  data-complete-axis
                  x1={axisSettingScreen[0]?.x ?? 0}
                  y1={axisSettingScreen[0]?.y ?? 0}
                  x2={axisSettingScreen[1]?.x ?? 0}
                  y2={axisSettingScreen[1]?.y ?? 0}
                  stroke={BLUE}
                  strokeWidth={3}
                  strokeDasharray="12 8"
                />
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
                  const xy = geom.toScreen(point);
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
              </>
            ) : (
              <>
                <polygon
                  data-shape
                  data-fold-preview={foldPreviewRunning ? 'true' : undefined}
                  transform={foldPreviewTransform ?? undefined}
                  points={geom.pointsString(shapePoints)}
                  fill={foldFailFill(mirror)}
                  stroke={INK}
                  strokeWidth={4}
                  strokeLinejoin="round"
                  fillOpacity={0.2}
                />
                {mirror ? (
                  <polygon
                    data-mirror
                    points={mirror
                      .map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`)
                      .join(' ')}
                    fill="none"
                    stroke={RED}
                    strokeWidth={3}
                    strokeDasharray="10 7"
                  />
                ) : null}
                {axisScreen ? (
                  <g data-axis>
                    <line
                      x1={axisScreen.a.x}
                      y1={axisScreen.a.y}
                      x2={axisScreen.b.x}
                      y2={axisScreen.b.y}
                      stroke={foldOk ? '#1f7a4d' : BLUE}
                      strokeWidth={foldOk ? 5 : 3}
                      strokeDasharray={foldOk ? undefined : '12 8'}
                    />
                  </g>
                ) : null}
                {foldOk && axisScreen ? (
                  <g data-axis-found>
                    <line
                      x1={axisScreen.a.x}
                      y1={axisScreen.a.y}
                      x2={axisScreen.b.x}
                      y2={axisScreen.b.y}
                      stroke="url(#e10-line-axis)"
                      strokeWidth={12}
                      strokeOpacity={0.85}
                    />
                    <text
                      x={(axisScreen.a.x + axisScreen.b.x) / 2 + 18}
                      y={(axisScreen.a.y + axisScreen.b.y) / 2 - 14}
                      fontSize={30}
                      fontWeight={800}
                      fill="#1f7a4d"
                      stroke="#ffffff"
                      strokeWidth={4}
                      paintOrder="stroke"
                    >
                      ✓
                    </text>
                  </g>
                ) : null}
                {mirror ? (
                  <path
                    data-fold-gap
                    d={`${pathOf(originalScreen)} ${pathOf(mirror)}`}
                    fill="url(#e10-line-gap)"
                    fillRule="evenodd"
                    fillOpacity={0.7}
                    stroke="none"
                  />
                ) : null}
                {shapePoints.map((point, index) => {
                  const xy = geom.toScreen(point);
                  return (
                    <circle
                      key={`shape-vertex-${index}`}
                      cx={xy.x}
                      cy={xy.y}
                      r={7}
                      fill="#ffffff"
                      stroke={INK}
                      strokeWidth={2.5}
                      transform={foldPreviewTransform ?? undefined}
                    />
                  );
                })}
                {state.pending ? (
                  <circle
                    cx={geom.toScreen(state.pending).x}
                    cy={geom.toScreen(state.pending).y}
                    r={14}
                    fill="none"
                    stroke={ORANGE}
                    strokeWidth={4}
                  />
                ) : null}
              </>
            )}

            {focused ? (
              <circle
                data-cursor
                cx={cursorScreen.x}
                cy={cursorScreen.y}
                r={20}
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
            {state.task === 'find-axis' ? (
              <>
                <section className={styles.panelGroup}>
                  <span className={styles.panelLabel}>{S.line.fold}</span>
                  <div className={styles.directionRow}>
                    <button
                      type="button"
                      className={styles.button}
                      disabled={readOnly || !state.axis}
                      onClick={() => dispatch({ type: 'fold' })}
                    >
                      {S.line.fold}
                    </button>
                    <button
                      type="button"
                      className={styles.button}
                      disabled={readOnly || state.showing === null}
                      onClick={() => dispatch({ type: 'unfold' })}
                    >
                      {S.line.unfold}
                    </button>
                    <button
                      type="button"
                      className={styles.button}
                      disabled={readOnly || (!state.axis && !state.pending)}
                      onClick={() => dispatch({ type: 'clear-axis' })}
                    >
                      {S.line.clearAxis}
                    </button>
                  </div>
                </section>
                <section className={styles.panelGroup}>
                  <span className={styles.panelLabel}>{S.line.shapePick(state.shapeIndex)}</span>
                  <div className={styles.directionRow}>
                    {state.settings.shapes.map((id, index) => (
                      <button
                        key={id}
                        type="button"
                        className={styles.button}
                        aria-pressed={state.shapeIndex === index}
                        disabled={readOnly}
                        onClick={() => dispatch({ type: 'select-shape', index })}
                      >
                        {S.line.shapePick(index)}
                      </button>
                    ))}
                  </div>
                </section>
              </>
            ) : (
              <section className={styles.panelGroup}>
                <span className={styles.panelLabel}>{S.line.complete.instruction}</span>
                <div className={styles.directionRow}>
                  <button
                    type="button"
                    className={styles.button}
                    disabled={readOnly || state.vertices.length === 0}
                    onClick={() => dispatch({ type: 'undo-vertex' })}
                  >
                    {S.line.complete.undo}
                  </button>
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function foldFailFill(mirror: readonly ScreenPoint[] | null): string {
  return mirror ? 'url(#e10-line-gap)' : '#dbe7ff';
}
