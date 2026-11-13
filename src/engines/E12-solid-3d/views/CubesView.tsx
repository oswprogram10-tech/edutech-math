/**
 * E12 cubes 모드: 등각(아이소메트릭) 2D SVG 무대 + 실시간 위·앞·옆 투영 + 보기 그림.
 *
 * - 각 기둥을 `<g data-col="x,y">`로 묶어 바닥 마름모와 쌓기나무를 한 누름 영역으로 다룬다.
 * - 짧게 누르면 현재 도구(쌓기/빼기), 600ms 넘게 누르면 빼기(remove)를 보낸다.
 * - 화면에 높이·전체 개수 숫자를 절대 표시하지 않는다(정답 노출 금지).
 */
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import type { EngineViewProps, Point } from '../../../core/engine-sdk';
import {
  computeReferenceLayout,
  computeStageLayout,
  cubeFaces,
  floorDiamond,
  frontMarkerGeometry,
  pointsAttr,
  projectPoint,
  sortColumnsForPainter,
  sortCubesForPainter,
  stepCursorInScreen,
} from '../layout';
import { solid3dStrings as S } from '../strings.ko';
import type {
  CubeColor,
  CubeCoord,
  CubeItem,
  CubesAction,
  CubesConfig,
  CubesState,
  FocusCell,
} from '../types';
import { columnHeight, frontView, rotateCell, sideView, topView } from '../voxel';
import styles from '../View.module.css';
import { ProjectionGrid } from './ProjectionGrid';

const LONG_PRESS_MS = 600;
const MOVE_THRESHOLD_PX = 8;
const INK = '#1d2330';
const FOCUS_STROKE = '#e8872e';

const CUBE_PALETTE: Readonly<
  Record<
    CubeColor,
    { readonly top: string; readonly front: string; readonly right: string; readonly mark: string }
  >
> = {
  plain: { top: '#f6ebd8', front: '#e4cda7', right: '#cca978', mark: '#1d2330' },
  red: { top: '#fca5a5', front: '#ef4444', right: '#b91c1c', mark: '#7f1d1d' },
  blue: { top: '#93c5fd', front: '#3b82f6', right: '#1d4ed8', mark: '#1e3a8a' },
  yellow: { top: '#fde68a', front: '#f59e0b', right: '#b45309', mark: '#78350f' },
  green: { top: '#86efac', front: '#22c55e', right: '#15803d', mark: '#14532d' },
};

type CubesViewProps = EngineViewProps<CubesConfig, CubesState, CubesAction>;

interface PressSession {
  readonly pointerId: number;
  readonly x: number;
  readonly y: number;
  readonly startX: number;
  readonly startY: number;
  timerId: number | null;
  longPressed: boolean;
  moved: boolean;
}

function topFaceMark(color: CubeColor, top: readonly [Point, Point, Point, Point]) {
  if (color === 'plain') return null;
  const cx = (top[0].x + top[2].x) / 2;
  const cy = (top[0].y + top[2].y) / 2;
  const r = Math.max(4, (top[2].x - top[0].x) * 0.14);
  const stroke = CUBE_PALETTE[color].mark;

  if (color === 'red') {
    return <circle cx={cx} cy={cy} r={r} fill={stroke} pointerEvents="none" />;
  }
  if (color === 'blue') {
    const pts = [
      `${cx},${cy - r}`,
      `${cx + r * 0.95},${cy + r * 0.75}`,
      `${cx - r * 0.95},${cy + r * 0.75}`,
    ].join(' ');
    return <polygon points={pts} fill={stroke} pointerEvents="none" />;
  }
  if (color === 'yellow') {
    return (
      <rect
        x={cx - r * 0.8}
        y={cy - r * 0.8}
        width={r * 1.6}
        height={r * 1.6}
        fill={stroke}
        pointerEvents="none"
      />
    );
  }
  // green diamond ◆
  const pts = [`${cx},${cy - r}`, `${cx + r},${cy}`, `${cx},${cy + r}`, `${cx - r},${cy}`].join(
    ' ',
  );
  return <polygon points={pts} fill={stroke} pointerEvents="none" />;
}

function matchesFocus(
  cube: CubeItem,
  focus: FocusCell | null,
  rows: number,
  maxHeight: number,
): boolean {
  if (!focus) return false;
  if (focus.view === 'top') {
    const targetY = rows - 1 - focus.row;
    return cube.x === focus.col && cube.y === targetY;
  }
  if (focus.view === 'front') {
    const targetZ = maxHeight - 1 - focus.row;
    return cube.x === focus.col && cube.z === targetZ;
  }
  const targetZ = maxHeight - 1 - focus.row;
  return cube.y === focus.col && cube.z === targetZ;
}

function ToolIcon({
  kind,
}: {
  readonly kind: 'add' | 'remove' | 'left' | 'right' | 'translucent' | 'clear';
}) {
  switch (kind) {
    case 'add':
      return (
        <svg width={18} height={18} viewBox="0 0 18 18" aria-hidden="true">
          <path d="M9 3v12M3 9h12" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" />
        </svg>
      );
    case 'remove':
      return (
        <svg width={18} height={18} viewBox="0 0 18 18" aria-hidden="true">
          <path d="M3 9h12" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" />
        </svg>
      );
    case 'left':
      return (
        <svg width={18} height={18} viewBox="0 0 18 18" aria-hidden="true">
          <path
            d="M7 5L3.5 8.5 7 12M4 8.5h6.5a4 4 0 0 1 0 8"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'right':
      return (
        <svg width={18} height={18} viewBox="0 0 18 18" aria-hidden="true">
          <path
            d="M11 5l3.5 3.5L11 12M14 8.5H7.5a4 4 0 0 0 0 8"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'translucent':
      return (
        <svg width={18} height={18} viewBox="0 0 18 18" aria-hidden="true">
          <rect
            x={3}
            y={3}
            width={12}
            height={12}
            rx={2}
            fill="currentColor"
            fillOpacity={0.25}
            stroke="currentColor"
            strokeWidth={1.8}
            strokeDasharray="3 2"
          />
        </svg>
      );
    case 'clear':
      return (
        <svg width={18} height={18} viewBox="0 0 18 18" aria-hidden="true">
          <path
            d="M4 4l10 10M14 4L4 14"
            stroke="currentColor"
            strokeWidth={2.2}
            strokeLinecap="round"
          />
        </svg>
      );
  }
}

function ReferenceShapeSvg({ cubes }: { readonly cubes: readonly CubeCoord[] }) {
  const layout = computeReferenceLayout(cubes, 30);
  const maxX = Math.max(1, ...cubes.map(([x]) => x + 1));
  const maxY = Math.max(1, ...cubes.map(([, y]) => y + 1));
  const painted = sortCubesForPainter(
    cubes.map(([x, y, z]) => ({ x, y, z })),
    maxX,
    maxY,
    0,
  );
  const palette = CUBE_PALETTE.plain;

  return (
    <div className={styles.projCard}>
      <p className={styles.projTitle}>{S.referenceTitle}</p>
      <svg
        className={styles.refSvg}
        width={Math.min(180, layout.viewBox.width)}
        height={Math.min(180, layout.viewBox.height)}
        viewBox={`0 0 ${layout.viewBox.width} ${layout.viewBox.height}`}
        data-testid="cubes-reference"
        role="img"
        aria-label={S.referenceAria}
      >
        {painted.map(({ cube, rx, ry }) => {
          const faces = cubeFaces(layout, rx, ry, cube.z);
          return (
            <g key={`ref-${cube.x}-${cube.y}-${cube.z}`}>
              <polygon
                points={pointsAttr(faces.top)}
                fill={palette.top}
                stroke={INK}
                strokeWidth={1.3}
                strokeLinejoin="round"
              />
              <polygon
                points={pointsAttr(faces.front)}
                fill={palette.front}
                stroke={INK}
                strokeWidth={1.3}
                strokeLinejoin="round"
              />
              <polygon
                points={pointsAttr(faces.right)}
                fill={palette.right}
                stroke={INK}
                strokeWidth={1.3}
                strokeLinejoin="round"
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function CubesView({ state, dispatch, cpa, readOnly = false, targetSize }: CubesViewProps) {
  const { settings } = state;
  const [cols, rows] = settings.grid;
  const layout = computeStageLayout(cols, rows, settings.maxHeight);
  const pressRef = useRef<PressSession | null>(null);
  const [liveMessage, setLiveMessage] = useState('');
  const [blockedAdd, setBlockedAdd] = useState(false);

  const clearPressTimer = () => {
    const active = pressRef.current;
    if (active && active.timerId !== null) {
      window.clearTimeout(active.timerId);
      active.timerId = null;
    }
  };

  useEffect(() => {
    return () => {
      clearPressTimer();
      pressRef.current = null;
    };
  }, []);

  const canAddAt = (x: number, y: number): boolean => {
    if (state.cubes.length >= settings.maxCubes) return false;
    return columnHeight(state.cubes, x, y) < settings.maxHeight;
  };

  const canRemoveAt = (x: number, y: number): boolean => {
    const h = columnHeight(state.cubes, x, y);
    if (h <= 0) return false;
    const top = state.cubes.find((c) => c.x === x && c.y === y && c.z === h - 1);
    return Boolean(top && !top.locked);
  };

  const performAdd = (x: number, y: number) => {
    if (readOnly) return;
    if (!canAddAt(x, y)) {
      setBlockedAdd(true);
      setLiveMessage(S.live.maxReached);
      return;
    }
    setBlockedAdd(false);
    dispatch({ type: 'add', x, y });
    setLiveMessage(S.live.added);
  };

  const performRemove = (x: number, y: number) => {
    if (readOnly) return;
    setBlockedAdd(false);
    if (canRemoveAt(x, y)) {
      dispatch({ type: 'remove', x, y });
      setLiveMessage(S.live.removed);
    }
  };

  const onColumnPointerDown = (event: ReactPointerEvent<SVGGElement>, x: number, y: number) => {
    if (readOnly) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    clearPressTimer();

    const session: PressSession = {
      pointerId: event.pointerId,
      x,
      y,
      startX: event.clientX,
      startY: event.clientY,
      timerId: null,
      longPressed: false,
      moved: false,
    };

    session.timerId = window.setTimeout(() => {
      if (pressRef.current !== session) return;
      session.longPressed = true;
      session.timerId = null;
      performRemove(x, y);
    }, LONG_PRESS_MS);

    pressRef.current = session;
  };

  const onColumnPointerMove = (event: ReactPointerEvent<SVGGElement>) => {
    const session = pressRef.current;
    if (!session || session.pointerId !== event.pointerId || session.longPressed) return;
    if (
      Math.hypot(event.clientX - session.startX, event.clientY - session.startY) > MOVE_THRESHOLD_PX
    ) {
      session.moved = true;
      clearPressTimer();
    }
  };

  const onColumnPointerUp = (event: ReactPointerEvent<SVGGElement>, x: number, y: number) => {
    const session = pressRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    clearPressTimer();
    pressRef.current = null;
    if (readOnly || session.longPressed || session.moved) return;
    if (
      Math.hypot(event.clientX - session.startX, event.clientY - session.startY) > MOVE_THRESHOLD_PX
    ) {
      return;
    }
    if (state.tool === 'add') {
      performAdd(x, y);
    } else {
      performRemove(x, y);
    }
  };

  const onColumnPointerCancel = (event: ReactPointerEvent<SVGGElement>) => {
    const session = pressRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    clearPressTimer();
    pressRef.current = null;
  };

  const onCanvasKeyDown = (event: ReactKeyboardEvent<SVGSVGElement>) => {
    if (readOnly) return;
    const key = event.key;
    if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight') {
      event.preventDefault();
      const next = stepCursorInScreen(state.cursor, cols, rows, state.viewTurn, key);
      dispatch({ type: 'move-cursor', to: next });
      setLiveMessage(S.live.cursorAt(next[0], next[1]));
      return;
    }
    if (key === 'Enter' || key === ' ' || key === 'Spacebar') {
      event.preventDefault();
      performAdd(state.cursor[0], state.cursor[1]);
      return;
    }
    if (key === 'Backspace' || key === 'Delete') {
      event.preventDefault();
      performRemove(state.cursor[0], state.cursor[1]);
      return;
    }
    const lower = key.toLowerCase();
    if (lower === 'q' && !settings.rotationLocked) {
      event.preventDefault();
      dispatch({ type: 'turn', dir: 'left' });
      setLiveMessage(S.live.turned);
      return;
    }
    if (lower === 'e' && !settings.rotationLocked) {
      event.preventDefault();
      dispatch({ type: 'turn', dir: 'right' });
      setLiveMessage(S.live.turned);
      return;
    }
    if (lower === 't' && settings.translucentToggle) {
      event.preventDefault();
      const next = !state.translucent;
      dispatch({ type: 'set-translucent', on: next });
      setLiveMessage(next ? S.live.translucentOn : S.live.translucentOff);
    }
  };

  const columns = sortColumnsForPainter(cols, rows, state.viewTurn);
  const cubesByCol = new Map<string, CubeItem[]>();
  for (const cube of state.cubes) {
    const key = `${cube.x},${cube.y}`;
    const list = cubesByCol.get(key) ?? [];
    list.push(cube);
    cubesByCol.set(key, list);
  }

  const maxReached = state.cubes.length >= settings.maxCubes;
  const statusText = maxReached || blockedAdd ? S.maxReached : '';

  const topMatrix = settings.views.includes('top') ? topView(state.cubes, settings.grid) : null;
  const frontMatrix = settings.views.includes('front')
    ? frontView(state.cubes, settings.grid, settings.maxHeight)
    : null;
  const sideMatrix = settings.views.includes('side')
    ? sideView(state.cubes, settings.grid, settings.maxHeight)
    : null;

  const frontMarker = settings.frontMarker
    ? frontMarkerGeometry(layout, cols, rows, state.viewTurn)
    : null;

  const hasRemovable = state.cubes.some((c) => !c.locked);
  const [cursorRx, cursorRy] = rotateCell(
    state.cursor[0],
    state.cursor[1],
    cols,
    rows,
    state.viewTurn,
  );
  const cursorDiamond = floorDiamond(layout, cursorRx, cursorRy);
  const cursorTop = projectPoint(
    layout,
    cursorRx,
    cursorRy,
    columnHeight(state.cubes, state.cursor[0], state.cursor[1]),
  );
  void cursorTop;

  const refViews = settings.referenceViews;
  const hasRefViews = Boolean(refViews && (refViews.top || refViews.front || refViews.side));

  return (
    <div className={styles.wrap} data-target-size={targetSize} data-cpa={cpa}>
      <p className={styles.instructions}>{S.instructions}</p>
      <p className={styles.status} role="status" data-testid="cubes-status">
        {statusText}
      </p>
      <div className={styles.srOnly} aria-live="polite" data-testid="cubes-live">
        {liveMessage}
      </div>

      <div className={styles.stageRow}>
        <div className={styles.boardArea}>
          <svg
            className={styles.stageSvg}
            viewBox={`0 0 ${layout.viewBox.width} ${layout.viewBox.height}`}
            style={{ aspectRatio: `${layout.viewBox.width} / ${layout.viewBox.height}` }}
            role="application"
            aria-label={S.canvasLabel}
            tabIndex={readOnly ? -1 : 0}
            data-testid="cubes-canvas"
            data-cpa={cpa}
            onKeyDown={onCanvasKeyDown}
          >
            {/* 바닥 격자 배경 */}
            <g pointerEvents="none">
              {columns.map(({ x, y, rx, ry }) => {
                const diamond = floorDiamond(layout, rx, ry);
                const isTopFocus =
                  state.focus?.view === 'top' &&
                  state.focus.col === x &&
                  state.focus.row === rows - 1 - y;
                return (
                  <polygon
                    key={`floor-bg-${x}-${y}`}
                    points={pointsAttr(diamond)}
                    fill={isTopFocus ? '#ffedd5' : '#f1f5f9'}
                    stroke={isTopFocus ? FOCUS_STROKE : '#94a3b8'}
                    strokeWidth={isTopFocus ? 2.5 : 1.2}
                  />
                );
              })}
            </g>

            {/* 앞 표시 */}
            {frontMarker ? (
              <g pointerEvents="none" data-testid="cubes-front-marker">
                <line
                  x1={frontMarker.arrowFrom.x}
                  y1={frontMarker.arrowFrom.y}
                  x2={frontMarker.arrowTo.x}
                  y2={frontMarker.arrowTo.y}
                  stroke="#1d4fa8"
                  strokeWidth={2.4}
                  strokeLinecap="round"
                />
                <circle
                  cx={frontMarker.arrowTo.x}
                  cy={frontMarker.arrowTo.y}
                  r={3.2}
                  fill="#1d4fa8"
                />
                <text
                  x={frontMarker.text.x}
                  y={frontMarker.text.y + 5}
                  textAnchor="middle"
                  fontSize={16}
                  fontWeight={800}
                  fill="#1d4fa8"
                >
                  {S.front}
                </text>
              </g>
            ) : null}

            {/* 기둥별 누름 영역 + 화가 순서 쌓기나무 */}
            {columns.map(({ x, y, rx, ry }) => {
              const colCubes = cubesByCol.get(`${x},${y}`) ?? [];
              const diamond = floorDiamond(layout, rx, ry);
              const isCursor = state.cursor[0] === x && state.cursor[1] === y;
              return (
                <g
                  key={`col-${x}-${y}`}
                  data-col={`${x},${y}`}
                  aria-label={S.columnAria(x, y)}
                  style={readOnly ? undefined : { cursor: 'pointer' }}
                  onPointerDown={(event) => onColumnPointerDown(event, x, y)}
                  onPointerMove={onColumnPointerMove}
                  onPointerUp={(event) => onColumnPointerUp(event, x, y)}
                  onPointerCancel={onColumnPointerCancel}
                  onPointerLeave={onColumnPointerCancel}
                >
                  <polygon
                    points={pointsAttr(diamond)}
                    fill="transparent"
                    data-floor={`${x},${y}`}
                  />
                  {colCubes.map((cube) => {
                    const effectiveColor = settings.colorHints ? cube.color : 'plain';
                    const palette = CUBE_PALETTE[effectiveColor];
                    const faces = cubeFaces(layout, rx, ry, cube.z);
                    const focusedCube = matchesFocus(cube, state.focus, rows, settings.maxHeight);
                    const fillOpacity = state.translucent ? 0.35 : 1;
                    return (
                      <g
                        key={`cube-${cube.x}-${cube.y}-${cube.z}`}
                        data-cube={`${cube.x},${cube.y},${cube.z}`}
                        data-focused-cube={focusedCube ? 'true' : undefined}
                      >
                        <polygon
                          points={pointsAttr(faces.top)}
                          fill={palette.top}
                          fillOpacity={fillOpacity}
                          stroke={INK}
                          strokeWidth={1.6}
                          strokeLinejoin="round"
                        />
                        <polygon
                          points={pointsAttr(faces.front)}
                          fill={palette.front}
                          fillOpacity={fillOpacity}
                          stroke={INK}
                          strokeWidth={1.6}
                          strokeLinejoin="round"
                        />
                        <polygon
                          points={pointsAttr(faces.right)}
                          fill={palette.right}
                          fillOpacity={fillOpacity}
                          stroke={INK}
                          strokeWidth={1.6}
                          strokeLinejoin="round"
                        />
                        {settings.colorHints ? topFaceMark(effectiveColor, faces.top) : null}
                        {focusedCube ? (
                          <polygon
                            points={pointsAttr(faces.outline)}
                            fill="none"
                            stroke={FOCUS_STROKE}
                            strokeWidth={4}
                            strokeLinejoin="round"
                            pointerEvents="none"
                          />
                        ) : null}
                      </g>
                    );
                  })}

                  {/* 커서 칸 기둥 테두리 강조 */}
                  {!readOnly && isCursor && colCubes.length > 0 ? (
                    <polygon
                      points={pointsAttr(cubeFaces(layout, rx, ry, colCubes.length - 1).top)}
                      fill="none"
                      stroke={FOCUS_STROKE}
                      strokeWidth={3}
                      strokeDasharray="6 4"
                      pointerEvents="none"
                    />
                  ) : null}
                </g>
              );
            })}

            {/* 커서 바닥 마름모 굵은 점선 테두리 */}
            {!readOnly ? (
              <polygon
                points={pointsAttr(cursorDiamond)}
                fill="none"
                stroke={FOCUS_STROKE}
                strokeWidth={3.2}
                strokeDasharray="6 4"
                pointerEvents="none"
                data-testid="cubes-cursor"
              />
            ) : null}
          </svg>
        </div>

        <div className={styles.sideStack}>
          <div className={styles.toolbar} role="toolbar" aria-label={S.name}>
            <button
              type="button"
              className={styles.button}
              aria-pressed={state.tool === 'add'}
              disabled={readOnly}
              onClick={() => dispatch({ type: 'select-tool', tool: 'add' })}
            >
              <ToolIcon kind="add" />
              <span>{S.tools.add}</span>
            </button>
            <button
              type="button"
              className={styles.button}
              aria-pressed={state.tool === 'remove'}
              disabled={readOnly}
              onClick={() => dispatch({ type: 'select-tool', tool: 'remove' })}
            >
              <ToolIcon kind="remove" />
              <span>{S.tools.remove}</span>
            </button>

            {!settings.rotationLocked ? (
              <>
                <button
                  type="button"
                  className={styles.button}
                  disabled={readOnly}
                  onClick={() => {
                    dispatch({ type: 'turn', dir: 'left' });
                    setLiveMessage(S.live.turned);
                  }}
                >
                  <ToolIcon kind="left" />
                  <span>{S.turnLeft}</span>
                </button>
                <button
                  type="button"
                  className={styles.button}
                  disabled={readOnly}
                  onClick={() => {
                    dispatch({ type: 'turn', dir: 'right' });
                    setLiveMessage(S.live.turned);
                  }}
                >
                  <ToolIcon kind="right" />
                  <span>{S.turnRight}</span>
                </button>
              </>
            ) : null}

            {settings.translucentToggle ? (
              <button
                type="button"
                className={styles.button}
                aria-pressed={state.translucent}
                disabled={readOnly}
                onClick={() => {
                  const next = !state.translucent;
                  dispatch({ type: 'set-translucent', on: next });
                  setLiveMessage(next ? S.live.translucentOn : S.live.translucentOff);
                }}
              >
                <ToolIcon kind="translucent" />
                <span>{S.translucent}</span>
              </button>
            ) : null}

            <button
              type="button"
              className={styles.button}
              disabled={readOnly || !hasRemovable}
              onClick={() => {
                setBlockedAdd(false);
                dispatch({ type: 'clear' });
                setLiveMessage(S.live.cleared);
              }}
            >
              <ToolIcon kind="clear" />
              <span>{S.clear}</span>
            </button>
          </div>

          {settings.views.length > 0 ? (
            <div className={styles.panelBlock}>
              <div className={styles.projRow}>
                {topMatrix ? (
                  <ProjectionGrid
                    view="top"
                    matrix={topMatrix}
                    title={S.views.top}
                    testId="cubes-view-top"
                    focus={state.focus}
                    onFocusCell={(cell) => dispatch({ type: 'focus-cell', cell })}
                    readOnly={readOnly}
                  />
                ) : null}
                {frontMatrix ? (
                  <ProjectionGrid
                    view="front"
                    matrix={frontMatrix}
                    title={S.views.front}
                    testId="cubes-view-front"
                    focus={state.focus}
                    onFocusCell={(cell) => dispatch({ type: 'focus-cell', cell })}
                    readOnly={readOnly}
                  />
                ) : null}
                {sideMatrix ? (
                  <ProjectionGrid
                    view="side"
                    matrix={sideMatrix}
                    title={S.views.side}
                    testId="cubes-view-side"
                    focus={state.focus}
                    onFocusCell={(cell) => dispatch({ type: 'focus-cell', cell })}
                    readOnly={readOnly}
                  />
                ) : null}
              </div>
              <p className={styles.hint}>{S.projectionHint}</p>
            </div>
          ) : null}

          {settings.reference || hasRefViews ? (
            <div className={styles.panelBlock}>
              <div className={styles.projRow}>
                {settings.reference ? <ReferenceShapeSvg cubes={settings.reference.cubes} /> : null}
                {refViews?.top ? (
                  <ProjectionGrid
                    view="top"
                    matrix={refViews.top}
                    title={S.referenceViewTitle('top')}
                    testId="cubes-reference-top"
                  />
                ) : null}
                {refViews?.front ? (
                  <ProjectionGrid
                    view="front"
                    matrix={refViews.front}
                    title={S.referenceViewTitle('front')}
                    testId="cubes-reference-front"
                  />
                ) : null}
                {refViews?.side ? (
                  <ProjectionGrid
                    view="side"
                    matrix={refViews.side}
                    title={S.referenceViewTitle('side')}
                    testId="cubes-reference-side"
                  />
                ) : null}
              </div>
            </div>
          ) : null}

          <p className={styles.hint}>{S.keyHint}</p>
        </div>
      </div>
    </div>
  );
}
