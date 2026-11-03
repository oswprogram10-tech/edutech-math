/**
 * E02 셈돌 화면.
 *
 * - 모든 포인터 위치는 SDK `pointerToLogical`로만 논리 좌표로 바꾼다.
 * - 동시 터치는 `useMultiTouchCount`로 세고, 버튼·키보드 대체 입력을 항상 둔다.
 * - 기본 설정에서는 개수·정답 숫자를 화면에 쓰지 않는다.
 */
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import {
  distance,
  minTouchRadius,
  pointerToLogical,
  snapToPoints,
  useDrag,
  useMultiTouchCount,
  useRenderedSize,
} from '../../core/engine-sdk';
import type { EngineViewProps, Point } from '../../core/engine-sdk';
import { CounterIconShape } from './icons';
import {
  frameBounds,
  frameCellPoint,
  inRect,
  plateBounds,
  plateSlotPoint,
  sceneIconPoint,
  summonPoint,
  SUMMON_SHELF,
  trayPoint,
  TRAY_BOTTOM,
  TRAY_TOP,
} from './layout';
import { frameFillOf, platesOf, totalOf } from './reduce';
import { countersStrings as S } from './strings.ko';
import {
  FRAME_CELL,
  FRAME_COLS,
  FRAME_GAP,
  FRAME_HEIGHT,
  FRAME_ROWS,
  FRAME_WIDTH,
  LOGICAL_HEIGHT,
  LOGICAL_WIDTH,
  TRASH_RECT,
} from './types';
import type {
  CountersAction,
  CountersConfig,
  CountersState,
  CounterIcon,
  FrameCounter,
} from './types';
import styles from './View.module.css';

const LOGICAL = { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT };
const TAP_SLOP = 10;
const ITEM_RADIUS = 26;
const STEP = FRAME_CELL + FRAME_GAP;
const INK = '#1d2330';
const MUTED = '#5b6577';
const BLUE = '#2f6fde';
const PAPER = '#fbfaf6';
const SELECT = '#e8872e';

type Target =
  | { readonly kind: 'summon'; readonly id: string }
  | { readonly kind: 'frame'; readonly frame: number }
  | { readonly kind: 'tray'; readonly id: string }
  | { readonly kind: 'placed'; readonly id: string; readonly frame: number }
  | { readonly kind: 'plate-counter'; readonly id: string }
  | { readonly kind: 'plate'; readonly plate: number }
  | null;

type CountersViewProps = EngineViewProps<CountersConfig, CountersState, CountersAction>;

function clampPoint(x: number, y: number): Point {
  return {
    x: Math.max(0, Math.min(LOGICAL_WIDTH, Math.round(x))),
    y: Math.max(0, Math.min(LOGICAL_HEIGHT, Math.round(y))),
  };
}

function trayCounters(state: Extract<CountersState, { mode: 'ten-frame' }>): FrameCounter[] {
  return state.counters
    .filter((counter) => counter.frame === null && counter.tray >= 0)
    .sort((a, b) => a.tray - b.tray);
}

function placedCounters(state: Extract<CountersState, { mode: 'ten-frame' }>): FrameCounter[] {
  return state.counters.filter((counter) => counter.frame !== null);
}

export function CountersView({
  config,
  state,
  dispatch,
  cpa,
  readOnly = false,
  scale = 1,
  targetSize,
}: CountersViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const rendered = useRenderedSize(svgRef);
  const measured = minTouchRadius(targetSize, rendered, LOGICAL);
  const radius = Math.max(20, Math.min(34, Math.ceil(Math.max(ITEM_RADIUS, measured))));
  const hitRadius = Math.max(radius + 12, measured);
  const snapThreshold = Math.max(FRAME_CELL * 0.8, measured);

  const [selected, setSelected] = useState<string | null>(null);
  const dragTarget = useRef<Target>(null);
  const summonTap = useRef(false);
  const pointers = useRef(new Set<number>());
  const maxPointers = useRef(0);
  const mt = useMultiTouchCount();

  const input = config.input ?? ['multitouch', 'tap', 'buttons'];
  const allowMulti = input.includes('multitouch');
  const allowTap = input.includes('tap');
  const allowButtons = input.includes('buttons');
  const icon: CounterIcon = config.icon ?? 'dot';

  const toPoint = (event: { readonly clientX: number; readonly clientY: number }): Point =>
    pointerToLogical(event, svgRef.current, LOGICAL);

  const nearestCell = (point: Point): { frame: number; cell: number } | null => {
    if (state.mode !== 'ten-frame') return null;
    const candidates: { point: Point; frame: number; cell: number }[] = [];
    for (let frame = 0; frame < state.frames; frame += 1) {
      for (let cell = 0; cell < FRAME_COLS * FRAME_ROWS; cell += 1) {
        candidates.push({ point: frameCellPoint(state.frames, frame, cell), frame, cell });
      }
    }
    const result = snapToPoints(
      point,
      candidates.map((candidate) => candidate.point),
      snapThreshold,
    );
    if (!result || result.index === undefined) return null;
    const found = candidates[result.index];
    return found ? { frame: found.frame, cell: found.cell } : null;
  };

  const targetAt = (point: Point): Target => {
    if (state.mode === 'summon') {
      const counter = state.counters.find((item) => distance(item, point) <= hitRadius);
      return counter ? { kind: 'summon', id: counter.id } : null;
    }
    if (state.mode === 'ten-frame') {
      const placed = placedCounters(state).find(
        (item) =>
          item.frame !== null &&
          item.cell !== null &&
          distance(frameCellPoint(state.frames, item.frame, item.cell), point) <= hitRadius,
      );
      if (placed && placed.frame !== null) {
        return { kind: 'placed', id: placed.id, frame: placed.frame };
      }
      const tray = trayCounters(state).find(
        (item) => distance(trayPoint(item.tray), point) <= hitRadius,
      );
      if (tray) return { kind: 'tray', id: tray.id };
      for (let frame = 0; frame < state.frames; frame += 1) {
        if (inRect(point, frameBounds(state.frames, frame))) {
          return { kind: 'frame', frame };
        }
      }
      return null;
    }
    if (state.mode === 'part-whole') {
      const counter = state.counters
        .slice()
        .sort((a, b) => b.slot - a.slot)
        .find(
          (item) =>
            distance(plateSlotPoint(state.plates, item.plate, item.slot), point) <= hitRadius,
        );
      if (counter) return { kind: 'plate-counter', id: counter.id };
      for (let plate = 0; plate < state.plates; plate += 1) {
        if (inRect(point, plateBounds(state.plates, plate))) {
          return { kind: 'plate', plate };
        }
      }
    }
    return null;
  };

  const firstEmptyCell = (frame: number): number | null => {
    if (state.mode !== 'ten-frame') return null;
    const used = new Set(
      state.counters
        .filter((counter) => counter.frame === frame && counter.cell !== null)
        .map((counter) => counter.cell),
    );
    for (let cell = 0; cell < FRAME_COLS * FRAME_ROWS; cell += 1) {
      if (!used.has(cell)) return cell;
    }
    return null;
  };

  const activatePlateCounter = (id: string) => {
    if (state.mode !== 'part-whole') return;
    const counter = state.counters.find((item) => item.id === id);
    if (!counter) return;
    if (selected && selected !== id) {
      const first = state.counters.find((item) => item.id === selected);
      if (first && first.plate !== counter.plate) {
        dispatch({ type: 'pair', a: first.id, b: counter.id });
        setSelected(null);
        return;
      }
    }
    setSelected(id);
  };

  const drag = useDrag({
    getPoint: toPoint,
    disabled: readOnly,
    onStart: (info) => {
      dragTarget.current = targetAt(info.start);
    },
    onEnd: (info) => {
      const target = dragTarget.current;
      dragTarget.current = null;
      if (!target) return;
      const moved = distance(info.start, info.current) >= TAP_SLOP;
      const point = info.current;

      if (state.mode === 'summon' && target.kind === 'summon') {
        if (moved && inRect(point, TRASH_RECT)) {
          dispatch({ type: 'remove', id: target.id });
        } else if (moved) {
          const next = clampPoint(point.x, point.y);
          dispatch({ type: 'move', id: target.id, x: next.x, y: next.y });
        }
        return;
      }

      if (state.mode === 'ten-frame') {
        if (target.kind === 'frame') {
          if (moved && info.delta.x <= -STEP * 2 && target.frame > 0) {
            dispatch({ type: 'swipe-fill', from: target.frame, to: target.frame - 1 });
          } else if (moved && info.delta.x >= STEP * 2 && target.frame < state.frames - 1) {
            dispatch({ type: 'swipe-fill', from: target.frame, to: target.frame + 1 });
          }
          return;
        }
        if (target.kind === 'tray') {
          if (!moved) {
            const cell = firstEmptyCell(0);
            if (cell !== null) dispatch({ type: 'place', id: target.id, frame: 0, cell });
            return;
          }
          const nearest = nearestCell(point);
          if (nearest) {
            dispatch({ type: 'place', id: target.id, frame: nearest.frame, cell: nearest.cell });
          }
          return;
        }
        if (target.kind === 'placed') {
          if (!moved) {
            dispatch({ type: 'take-out', id: target.id });
            return;
          }
          const bounds = frameBounds(state.frames, target.frame);
          if (!inRect(point, bounds)) {
            dispatch({ type: 'take-out', id: target.id });
            return;
          }
          const nearest = nearestCell(point);
          if (nearest) {
            dispatch({ type: 'place', id: target.id, frame: nearest.frame, cell: nearest.cell });
          }
          return;
        }
      }

      if (state.mode === 'part-whole') {
        if (target.kind === 'plate-counter') {
          if (!moved) {
            activatePlateCounter(target.id);
            return;
          }
          for (let plate = 0; plate < state.plates; plate += 1) {
            if (inRect(point, plateBounds(state.plates, plate))) {
              dispatch({ type: 'move-to-plate', id: target.id, plate });
              return;
            }
          }
          return;
        }
        if (target.kind === 'plate' && !moved && selected) {
          dispatch({ type: 'move-to-plate', id: selected, plate: target.plate });
          setSelected(null);
        }
      }
    },
  });

  const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (readOnly) return;
    const point = toPoint(event);
    if (state.mode === 'summon') {
      pointers.current.add(event.pointerId);
      maxPointers.current = Math.max(maxPointers.current, pointers.current.size);
      mt.handlers.onPointerDown(event);
      summonTap.current =
        targetAt(point) === null && inRect(point, SUMMON_SHELF) && (allowMulti || allowTap);
    }
    drag.handlers.onPointerDown(event);
  };

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    drag.handlers.onPointerMove(event);
  };

  const handlePointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    drag.handlers.onPointerUp(event);
    if (state.mode === 'summon') {
      mt.handlers.onPointerUp(event);
      pointers.current.delete(event.pointerId);
      if (pointers.current.size === 0) {
        const count = Math.max(1, maxPointers.current);
        if (summonTap.current) {
          if (allowMulti) dispatch({ type: 'summon', count });
          else if (allowTap) dispatch({ type: 'summon', count: 1 });
        }
        maxPointers.current = 0;
        summonTap.current = false;
      }
    }
  };

  const handlePointerCancel = (event: ReactPointerEvent<SVGSVGElement>) => {
    drag.handlers.onPointerCancel(event);
    if (state.mode === 'summon') {
      mt.handlers.onPointerCancel(event);
      pointers.current.delete(event.pointerId);
      if (pointers.current.size === 0) {
        maxPointers.current = 0;
        summonTap.current = false;
      }
    }
  };

  // flash: 보여 주는 시간이 지나면 View가 hide를 보낸다(엔진은 시간을 재지 않는다).
  useEffect(() => {
    if (state.mode !== 'flash' || state.phase !== 'showing') return;
    const timer = window.setTimeout(() => dispatch({ type: 'hide' }), state.displayMs);
    return () => window.clearTimeout(timer);
  }, [state, dispatch]);

  const keyHandler = (event: ReactKeyboardEvent<SVGGElement>, action: () => void) => {
    if (readOnly) return;
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      action();
    }
  };

  const moveSummon = (id: string, dx: number, dy: number) => {
    if (state.mode !== 'summon') return;
    const counter = state.counters.find((item) => item.id === id);
    if (!counter) return;
    const next = clampPoint(counter.x + dx, counter.y + dy);
    dispatch({ type: 'move', id, x: next.x, y: next.y });
  };

  const showTotal = config.showNumeral === 'always';

  return (
    <div className={styles.wrap} data-target-size={targetSize} style={{ width: `${100 * scale}%` }}>
      <div className={styles.toolbar}>
        {state.mode === 'summon' && allowButtons ? (
          <div className={styles.buttons} role="group" aria-label={S.addCount(1)}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((count) => (
              <button
                key={count}
                type="button"
                className={styles.button}
                onClick={() => dispatch({ type: 'summon', count })}
                disabled={readOnly}
              >
                {count}
              </button>
            ))}
          </div>
        ) : null}

        {state.mode === 'summon' && !allowButtons ? (
          <button
            type="button"
            className={styles.button}
            onClick={() => dispatch({ type: 'summon', count: 1 })}
            disabled={readOnly}
          >
            {S.addOne}
          </button>
        ) : null}

        {state.mode === 'ten-frame' && state.frames === 2 ? (
          <button
            type="button"
            className={styles.button}
            onClick={() => dispatch({ type: 'swipe-fill', from: 1, to: 0 })}
            disabled={readOnly}
          >
            {S.swipeButton(0)}
          </button>
        ) : null}

        {state.mode === 'part-whole' ? (
          <button
            type="button"
            className={styles.button}
            onClick={() => dispatch({ type: 'record-split' })}
            disabled={readOnly}
          >
            {S.recordSplit}
          </button>
        ) : null}

        {state.mode === 'flash' && state.phase === 'ready' ? (
          <button
            type="button"
            className={styles.button}
            onClick={() => dispatch({ type: 'show' })}
            disabled={readOnly}
          >
            {S.flashShow}
          </button>
        ) : null}

        {showTotal ? (
          <p className={styles.total} data-testid="counter-total">
            {S.total(totalOf(state))}
          </p>
        ) : null}
      </div>

      <svg
        ref={svgRef}
        className={styles.canvas}
        viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`}
        role="group"
        aria-label={S.canvasLabel}
        data-testid="counters-canvas"
        data-cpa={cpa}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        <rect width={LOGICAL_WIDTH} height={LOGICAL_HEIGHT} fill={PAPER} />

        {state.mode === 'summon' ? (
          <SummonScene
            state={state}
            icon={icon}
            radius={radius}
            readOnly={readOnly}
            onKeyDown={(event, id) => {
              if (event.key === 'Delete' || event.key === 'Backspace') {
                event.preventDefault();
                dispatch({ type: 'remove', id });
              } else if (event.key === 'ArrowLeft') {
                event.preventDefault();
                moveSummon(id, -20, 0);
              } else if (event.key === 'ArrowRight') {
                event.preventDefault();
                moveSummon(id, 20, 0);
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                moveSummon(id, 0, -20);
              } else if (event.key === 'ArrowDown') {
                event.preventDefault();
                moveSummon(id, 0, 20);
              }
            }}
            shelf={config.shelf ?? true}
          />
        ) : null}

        {state.mode === 'ten-frame' ? (
          <TenFrameScene
            state={state}
            icon={icon}
            radius={radius}
            readOnly={readOnly}
            showBond={(config.showBond ?? 'never') === 'after-move'}
            onCounterKey={(event, id) => {
              if (
                event.key === 'Delete' ||
                event.key === 'Backspace' ||
                event.key === 'Enter' ||
                event.key === ' ' ||
                event.key === 'Spacebar'
              ) {
                event.preventDefault();
                dispatch({ type: 'take-out', id });
              }
            }}
            onTrayKey={(event, id) => {
              keyHandler(event, () => {
                const cell = firstEmptyCell(0);
                if (cell !== null) dispatch({ type: 'place', id, frame: 0, cell });
              });
            }}
            onFrameKey={(event, frame) => {
              if (event.key === 'ArrowLeft' && frame > 0) {
                event.preventDefault();
                dispatch({ type: 'swipe-fill', from: frame, to: frame - 1 });
              }
            }}
          />
        ) : null}

        {state.mode === 'part-whole' ? (
          <PartWholeScene
            state={state}
            icon={icon}
            radius={radius}
            readOnly={readOnly}
            scene={config.scene}
            selected={selected}
            onCounterKey={(event, id) => {
              if (event.key === 'ArrowLeft') {
                event.preventDefault();
                const counter = state.counters.find((item) => item.id === id);
                if (counter && counter.plate > 0) {
                  dispatch({ type: 'move-to-plate', id, plate: counter.plate - 1 });
                }
              } else if (event.key === 'ArrowRight') {
                event.preventDefault();
                const counter = state.counters.find((item) => item.id === id);
                if (counter && counter.plate < state.plates - 1) {
                  dispatch({ type: 'move-to-plate', id, plate: counter.plate + 1 });
                }
              } else if (event.key === 'Delete' || event.key === 'Backspace') {
                event.preventDefault();
                setSelected(null);
              } else {
                keyHandler(event, () => activatePlateCounter(id));
              }
            }}
            onPlateKey={(event, plate) => {
              if (event.key === 'Enter' && selected) {
                event.preventDefault();
                dispatch({ type: 'move-to-plate', id: selected, plate });
                setSelected(null);
              }
            }}
          />
        ) : null}

        {state.mode === 'flash' ? <FlashScene state={state} icon={icon} radius={radius} /> : null}
      </svg>

      {state.mode === 'part-whole' ? (
        <div className={styles.plateControls}>
          {Array.from({ length: state.plates }, (_, plate) => {
            const count = platesOf(state)[plate] ?? 0;
            return (
              <div key={plate} className={styles.plateControl}>
                <span className={styles.plateName}>
                  {S.plateLabel(plate)} · {S.plateCount(count)}
                </span>
                <div className={styles.buttonRow}>
                  <button
                    type="button"
                    className={styles.smallButton}
                    aria-label={`${S.plateLabel(plate)} ${S.splitMinus}`}
                    onClick={() =>
                      dispatch({ type: 'set-split', plate, left: Math.max(0, count - 1) })
                    }
                    disabled={readOnly || count === 0}
                  >
                    −
                  </button>
                  <button
                    type="button"
                    className={styles.smallButton}
                    aria-label={`${S.plateLabel(plate)} ${S.splitPlus}`}
                    onClick={() => dispatch({ type: 'set-split', plate, left: count + 1 })}
                    disabled={readOnly}
                  >
                    +
                  </button>
                  {plate > 0 ? (
                    <button
                      type="button"
                      className={styles.smallButton}
                      onClick={() => dispatch({ type: 'merge', from: plate, to: plate - 1 })}
                      disabled={readOnly || count === 0}
                    >
                      {S.mergeTo(plate - 1)}
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      <p className={styles.instructions}>
        {
          S.instructions[
            state.mode === 'ten-frame'
              ? 'tenFrame'
              : state.mode === 'part-whole'
                ? 'partWhole'
                : state.mode
          ]
        }
      </p>
      <p className={styles.status} aria-live="polite">
        {state.mode === 'flash'
          ? state.phase === 'ready'
            ? S.flashReady
            : state.phase === 'showing'
              ? S.flashShowing
              : S.flashHidden
          : state.mode === 'part-whole'
            ? `${S.pairs(state.pairs.length)} · ${S.unpaired(
                Math.max(0, state.counters.length - state.pairs.length * 2),
              )}`
            : state.mode === 'ten-frame'
              ? S.moves(state.moves)
              : ''}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 모드별 그림
// ─────────────────────────────────────────────────────────────

interface SummonSceneProps {
  readonly state: Extract<CountersState, { mode: 'summon' }>;
  readonly icon: CounterIcon;
  readonly radius: number;
  readonly readOnly: boolean;
  readonly shelf: boolean;
  readonly onKeyDown: (event: ReactKeyboardEvent<SVGGElement>, id: string) => void;
}

function SummonScene({ state, icon, radius, readOnly, shelf, onKeyDown }: SummonSceneProps) {
  return (
    <g>
      {shelf ? (
        <rect
          x={SUMMON_SHELF.x}
          y={SUMMON_SHELF.y}
          width={SUMMON_SHELF.width}
          height={SUMMON_SHELF.height}
          rx={24}
          fill="#f1ede2"
          stroke="#d7deea"
          strokeWidth={2}
        />
      ) : null}
      <rect
        x={TRASH_RECT.x}
        y={TRASH_RECT.y}
        width={TRASH_RECT.width}
        height={TRASH_RECT.height}
        rx={12}
        fill="#ffffff"
        stroke="#aab4c6"
        strokeWidth={2}
        strokeDasharray="8 6"
      />
      <text x={TRASH_RECT.x + 16} y={TRASH_RECT.y + 36} fill={MUTED} fontSize={20}>
        {S.trash}
      </text>
      {state.counters.map((counter, index) => (
        <g
          key={counter.id}
          className={styles.item}
          role="button"
          tabIndex={readOnly ? -1 : 0}
          aria-label={S.counterLabel(index)}
          data-counter-id={counter.id}
          onKeyDown={(event) => onKeyDown(event, counter.id)}
        >
          <circle
            cx={counter.x}
            cy={counter.y}
            r={radius + 8}
            className={styles.focusRing}
            data-part="focus-ring"
          />
          <CounterIconShape
            icon={icon}
            color={counter.color}
            x={counter.x}
            y={counter.y}
            r={radius}
          />
        </g>
      ))}
    </g>
  );
}

interface TenFrameSceneProps {
  readonly state: Extract<CountersState, { mode: 'ten-frame' }>;
  readonly icon: CounterIcon;
  readonly radius: number;
  readonly readOnly: boolean;
  readonly showBond: boolean;
  readonly onCounterKey: (event: ReactKeyboardEvent<SVGGElement>, id: string) => void;
  readonly onTrayKey: (event: ReactKeyboardEvent<SVGGElement>, id: string) => void;
  readonly onFrameKey: (event: ReactKeyboardEvent<SVGGElement>, frame: number) => void;
}

function TenFrameScene({
  state,
  icon,
  radius,
  readOnly,
  showBond,
  onCounterKey,
  onTrayKey,
  onFrameKey,
}: TenFrameSceneProps) {
  const fill = frameFillOf(state);
  const tray = trayCounters(state);
  return (
    <g>
      {Array.from({ length: state.frames }, (_, frame) => {
        const bounds = frameBounds(state.frames, frame);
        return (
          <g
            key={`frame-${frame}`}
            className={styles.frame}
            role="group"
            tabIndex={readOnly ? -1 : 0}
            aria-label={S.frameLabel(frame)}
            data-frame={frame}
            onKeyDown={(event) => onFrameKey(event, frame)}
          >
            <rect
              x={bounds.x}
              y={bounds.y}
              width={bounds.width}
              height={bounds.height}
              rx={14}
              fill="#ffffff"
              stroke="#1d2330"
              strokeWidth={3}
            />
            <line
              x1={bounds.x + FRAME_WIDTH / 2}
              y1={bounds.y}
              x2={bounds.x + FRAME_WIDTH / 2}
              y2={bounds.y + FRAME_HEIGHT}
              stroke="#1d2330"
              strokeWidth={3}
            />
            {Array.from({ length: FRAME_COLS * FRAME_ROWS }, (_, cell) => {
              const point = frameCellPoint(state.frames, frame, cell);
              return (
                <g key={`cell-${frame}-${cell}`}>
                  <rect
                    x={point.x - FRAME_CELL / 2}
                    y={point.y - FRAME_CELL / 2}
                    width={FRAME_CELL}
                    height={FRAME_CELL}
                    fill="none"
                    stroke="#c9d3e2"
                    strokeWidth={1.5}
                  />
                  {fill[frame] === FRAME_COLS * FRAME_ROWS ? (
                    <text
                      x={bounds.x + bounds.width - 12}
                      y={bounds.y + 20}
                      textAnchor="end"
                      fontSize={16}
                      fill={BLUE}
                    >
                      {S.full}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </g>
        );
      })}

      {placedCounters(state).map((counter) => {
        if (counter.frame === null || counter.cell === null) return null;
        const point = frameCellPoint(state.frames, counter.frame, counter.cell);
        return (
          <g
            key={counter.id}
            className={styles.item}
            role="button"
            tabIndex={readOnly ? -1 : 0}
            aria-label={S.frameCellLabel(counter.frame, counter.cell)}
            data-counter-id={counter.id}
            onKeyDown={(event) => onCounterKey(event, counter.id)}
          >
            <circle cx={point.x} cy={point.y} r={radius + 6} className={styles.focusRing} />
            <CounterIconShape
              icon={icon}
              color={counter.color}
              x={point.x}
              y={point.y}
              r={radius}
            />
          </g>
        );
      })}

      <rect
        x={40}
        y={TRAY_TOP}
        width={LOGICAL_WIDTH - 80}
        height={TRAY_BOTTOM - TRAY_TOP - 10}
        rx={18}
        fill="#f1ede2"
        stroke="#d7deea"
        strokeWidth={2}
      />
      <text x={60} y={TRAY_TOP + 26} fill={MUTED} fontSize={18}>
        {S.tray}
      </text>
      {tray.map((counter) => {
        const point = trayPoint(counter.tray);
        return (
          <g
            key={counter.id}
            className={styles.item}
            role="button"
            tabIndex={readOnly ? -1 : 0}
            aria-label={S.trayCounterLabel(counter.tray)}
            data-tray-id={counter.id}
            onKeyDown={(event) => onTrayKey(event, counter.id)}
          >
            <circle cx={point.x} cy={point.y} r={radius + 6} className={styles.focusRing} />
            <CounterIconShape
              icon={icon}
              color={counter.color}
              x={point.x}
              y={point.y}
              r={radius}
            />
          </g>
        );
      })}

      {showBond && state.bond ? (
        <g pointerEvents="none">
          <text x={500} y={332} textAnchor="middle" fontSize={18} fill={MUTED}>
            {S.bondTitle}
          </text>
          <circle cx={500} cy={362} r={26} fill="#ffffff" stroke={INK} strokeWidth={2} />
          <text x={500} y={370} textAnchor="middle" fontSize={22} fill={INK}>
            {state.bond[0]}
          </text>
          <line x1={500} y1={388} x2={446} y2={424} stroke={INK} strokeWidth={2} />
          <line x1={500} y1={388} x2={554} y2={424} stroke={INK} strokeWidth={2} />
          <circle cx={440} cy={438} r={24} fill="#ffffff" stroke={INK} strokeWidth={2} />
          <text x={440} y={445} textAnchor="middle" fontSize={20} fill={INK}>
            {state.bond[1]}
          </text>
          <circle cx={560} cy={438} r={24} fill="#ffffff" stroke={INK} strokeWidth={2} />
          <text x={560} y={445} textAnchor="middle" fontSize={20} fill={INK}>
            {state.bond[2]}
          </text>
        </g>
      ) : null}
    </g>
  );
}

interface PartWholeSceneProps {
  readonly state: Extract<CountersState, { mode: 'part-whole' }>;
  readonly icon: CounterIcon;
  readonly radius: number;
  readonly readOnly: boolean;
  readonly selected: string | null;
  readonly scene: CountersConfig['scene'];
  readonly onCounterKey: (event: ReactKeyboardEvent<SVGGElement>, id: string) => void;
  readonly onPlateKey: (event: ReactKeyboardEvent<SVGGElement>, plate: number) => void;
}

function PartWholeScene({
  state,
  icon,
  radius,
  readOnly,
  selected,
  scene,
  onCounterKey,
  onPlateKey,
}: PartWholeSceneProps) {
  const plateList = platesOf(state);
  const pairIds = new Set(state.pairs.flat());
  return (
    <g>
      {scene ? (
        <g pointerEvents="none">
          {[0, 1].map((row) => (
            <g key={`scene-row-${row}`}>
              {Array.from({ length: scene.numbers[row] ?? 0 }, (_, index) => (
                <g key={`scene-${row}-${index}`}>
                  <CounterIconShape
                    icon={scene.icon}
                    color={row === 0 ? 'red' : 'blue'}
                    x={sceneIconPoint(index, row).x}
                    y={sceneIconPoint(index, row).y}
                    r={12}
                  />
                  {scene.kind === 'remove' && row === 1 ? (
                    <text
                      x={sceneIconPoint(index, row).x}
                      y={sceneIconPoint(index, row).y + 8}
                      textAnchor="middle"
                      fontSize={26}
                      fill="#d64545"
                    >
                      ×
                    </text>
                  ) : null}
                </g>
              ))}
            </g>
          ))}
          <text x={60} y={70} fontSize={18} fill={MUTED}>
            {scene.kind === 'join'
              ? S.sceneJoin
              : scene.kind === 'remove'
                ? S.sceneRemove
                : S.sceneCompare}
          </text>
        </g>
      ) : null}

      {Array.from({ length: state.plates }, (_, plate) => {
        const bounds = plateBounds(state.plates, plate);
        return (
          <g
            key={`plate-${plate}`}
            className={styles.plate}
            role="button"
            tabIndex={readOnly ? -1 : 0}
            aria-label={`${S.plateLabel(plate)} ${S.plateCount(plateList[plate] ?? 0)}`}
            data-plate={plate}
            onKeyDown={(event) => onPlateKey(event, plate)}
          >
            <ellipse
              cx={bounds.x + bounds.width / 2}
              cy={bounds.y + bounds.height / 2}
              rx={bounds.width / 2}
              ry={bounds.height / 2}
              fill="#ffffff"
              stroke="#c9d3e2"
              strokeWidth={3}
            />
            <text
              x={bounds.x + bounds.width / 2}
              y={bounds.y - 14}
              textAnchor="middle"
              fontSize={18}
              fill={MUTED}
            >
              {S.plateLabel(plate)}
            </text>
          </g>
        );
      })}

      {state.counters.map((counter) => {
        const point = plateSlotPoint(state.plates, counter.plate, counter.slot);
        const isSelected = selected === counter.id;
        return (
          <g
            key={counter.id}
            className={styles.item}
            role="button"
            tabIndex={readOnly ? -1 : 0}
            aria-label={`${S.plateLabel(counter.plate)} ${S.counterLabel(counter.slot)}`}
            aria-pressed={isSelected}
            data-counter-id={counter.id}
            onKeyDown={(event) => onCounterKey(event, counter.id)}
          >
            <circle cx={point.x} cy={point.y} r={radius + 8} className={styles.focusRing} />
            {isSelected ? (
              <circle
                cx={point.x}
                cy={point.y}
                r={radius + 6}
                fill="none"
                stroke={SELECT}
                strokeWidth={4}
                strokeDasharray="6 4"
              />
            ) : null}
            <CounterIconShape
              icon={icon}
              color={isSelected || pairIds.has(counter.id) ? 'blue' : 'red'}
              x={point.x}
              y={point.y}
              r={radius}
            />
          </g>
        );
      })}

      {state.pairs.map(([a, b], index) => {
        const first = state.counters.find((counter) => counter.id === a);
        const second = state.counters.find((counter) => counter.id === b);
        if (!first || !second) return null;
        const from = plateSlotPoint(state.plates, first.plate, first.slot);
        const to = plateSlotPoint(state.plates, second.plate, second.slot);
        return (
          <line
            key={`pair-${index}`}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            stroke={SELECT}
            strokeWidth={3}
            strokeDasharray="6 4"
            pointerEvents="none"
          />
        );
      })}
    </g>
  );
}

interface FlashSceneProps {
  readonly state: Extract<CountersState, { mode: 'flash' }>;
  readonly icon: CounterIcon;
  readonly radius: number;
}

function FlashScene({ state, icon, radius }: FlashSceneProps) {
  if (state.phase !== 'showing') {
    return (
      <g pointerEvents="none">
        <rect
          x={220}
          y={150}
          width={560}
          height={300}
          rx={28}
          fill="#f1ede2"
          stroke="#d7deea"
          strokeWidth={3}
        />
        <text x={500} y={320} textAnchor="middle" fontSize={40} fill={MUTED}>
          ?
        </text>
      </g>
    );
  }
  return (
    <g pointerEvents="none">
      {Array.from({ length: state.chosen }, (_, index) => {
        const point = state.points[index] ?? summonPoint(index);
        return (
          <CounterIconShape
            key={`flash-${index}`}
            icon={icon}
            color={index % 2 === 0 ? 'red' : 'blue'}
            x={point.x}
            y={point.y}
            r={radius}
          />
        );
      })}
    </g>
  );
}
