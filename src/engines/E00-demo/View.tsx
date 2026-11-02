/**
 * E00-demo 화면.
 *
 * - 빈 곳 탭: 셈돌 놓기
 * - 셈돌 끌기: 옮기기 (손을 뗄 때 Action 한 번)
 * - 빈 곳 올가미: 안에 든 셈돌 묶기
 * - 키보드: Tab으로 이동, 방향키로 한 칸(Shift+방향키 다섯 칸), Space 선택, Enter 묶기
 */
import { useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import {
  clamp,
  minTouchRadius,
  pointerToLogical,
  selectInside,
  snapPoint,
  useDrag,
  useLasso,
  useRenderedSize,
} from '../../core/engine-sdk';
import type { EngineViewProps, Point } from '../../core/engine-sdk';
import { demoStrings } from './strings.ko';
import { DEMO_ORIGIN, DEFAULT_GRID_SIZE, LOGICAL_HEIGHT, LOGICAL_WIDTH } from './types';
import type { DemoAction, DemoConfig, DemoState } from './types';
import styles from './View.module.css';

const LOGICAL = { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT };
/** 이보다 적게 움직였으면 드래그가 아니라 탭(선택)으로 본다. */
const TAP_SLOP = 4;
/** 화면이 아주 클 때도 셈돌이 너무 작아 보이지 않게 하는 기본 반지름. */
const BASE_RADIUS = 34;

function groupBounds(
  counterIds: readonly string[],
  counters: DemoState['counters'],
  radius: number,
): { x: number; y: number; width: number; height: number } | null {
  const points = counters.filter((counter) => counterIds.includes(counter.id));
  if (points.length === 0) return null;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const padding = radius + 14;
  const x = Math.min(...xs) - padding;
  const y = Math.min(...ys) - padding;
  return {
    x,
    y,
    width: Math.max(...xs) + padding - x,
    height: Math.max(...ys) + padding - y,
  };
}

export function DemoView({
  config,
  state,
  dispatch,
  readOnly = false,
  scale = 1,
  targetSize,
}: EngineViewProps<DemoConfig, DemoState, DemoAction>) {
  const svgRef = useRef<SVGSVGElement>(null);
  const renderedSize = useRenderedSize(svgRef);
  const gridSize = config.gridSize && config.gridSize > 0 ? config.gridSize : DEFAULT_GRID_SIZE;
  const measuredRadius = minTouchRadius(targetSize, renderedSize, LOGICAL);
  const radius = Math.ceil(Math.max(BASE_RADIUS, measuredRadius));

  const [selected, setSelected] = useState<readonly string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeIdRef = useRef<string | null>(null);

  const toPoint = (event: { readonly clientX: number; readonly clientY: number }): Point =>
    pointerToLogical(event, svgRef.current, LOGICAL);

  const snap = (point: Point): Point =>
    snapPoint(point, { grid: { size: gridSize }, threshold: gridSize / 2 }).point;

  const toggleSelected = (id: string) => {
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  };

  const drag = useDrag({
    getPoint: toPoint,
    disabled: readOnly,
    onEnd: ({ start, current }) => {
      const id = activeIdRef.current;
      activeIdRef.current = null;
      setActiveId(null);
      if (!id) return;
      const moved = Math.hypot(current.x - start.x, current.y - start.y) >= TAP_SLOP;
      if (!moved) {
        toggleSelected(id);
        return;
      }
      const point = snap(current);
      dispatch({ type: 'move', id, x: point.x, y: point.y });
    },
  });

  const lasso = useLasso({
    getPoint: toPoint,
    disabled: readOnly,
    onGesture: ({ points, isTap }) => {
      if (isTap) {
        const point = snap(points[0] ?? DEMO_ORIGIN);
        dispatch({ type: 'add', x: point.x, y: point.y });
        return;
      }
      const inside = selectInside(points, state.counters, (counter) => ({
        x: counter.x,
        y: counter.y,
      }));
      if (inside.length >= 2) {
        dispatch({ type: 'group', ids: inside.map((counter) => counter.id) });
        setSelected([]);
      }
    },
  });

  const onCounterPointerDown = (id: string, event: ReactPointerEvent<SVGGElement>) => {
    if (readOnly) return;
    event.stopPropagation();
    activeIdRef.current = id;
    setActiveId(id);
    drag.handlers.onPointerDown(event);
  };

  const moveBy = (id: string, dx: number, dy: number) => {
    const counter = state.counters.find((item) => item.id === id);
    if (!counter) return;
    const point = snap({
      x: clamp(counter.x + dx, 0, LOGICAL_WIDTH),
      y: clamp(counter.y + dy, 0, LOGICAL_HEIGHT),
    });
    dispatch({ type: 'move', id, x: point.x, y: point.y });
  };

  const onCounterKeyDown = (id: string, event: ReactKeyboardEvent<SVGGElement>) => {
    if (readOnly) return;
    const step = gridSize * (event.shiftKey ? 5 : 1);
    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        moveBy(id, -step, 0);
        break;
      case 'ArrowRight':
        event.preventDefault();
        moveBy(id, step, 0);
        break;
      case 'ArrowUp':
        event.preventDefault();
        moveBy(id, 0, -step);
        break;
      case 'ArrowDown':
        event.preventDefault();
        moveBy(id, 0, step);
        break;
      case ' ':
      case 'Spacebar':
        event.preventDefault();
        toggleSelected(id);
        break;
      case 'Enter':
        event.preventDefault();
        if (selected.length >= 2) {
          dispatch({ type: 'group', ids: selected });
          setSelected([]);
        }
        break;
    }
  };

  const addAtCenter = () => {
    const offset = (state.counters.length % 5) * gridSize;
    dispatch({
      type: 'add',
      x: clamp(DEMO_ORIGIN.x + offset, 0, LOGICAL_WIDTH),
      y: DEMO_ORIGIN.y,
    });
  };

  const lassoPoints = lasso.path.map((point) => `${point.x},${point.y}`).join(' ');

  // 드래그 중인 셈돌은 미리보기 좌표로 그린다. 묶음 테두리도 같은 좌표를 써서 같이 움직인다.
  const displayCounters = state.counters.map((counter) =>
    activeId === counter.id && drag.current
      ? { ...counter, x: drag.current.x, y: drag.current.y }
      : counter,
  );

  return (
    <div className={styles.wrap} data-target-size={targetSize} style={{ width: `${100 * scale}%` }}>
      <div className={styles.toolbar}>
        <button type="button" className={styles.button} onClick={addAtCenter} disabled={readOnly}>
          {demoStrings.addCounter}
        </button>
        <p className={styles.hint}>{demoStrings.selectedHint}</p>
      </div>

      <svg
        ref={svgRef}
        className={styles.canvas}
        viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`}
        role="group"
        aria-label={demoStrings.canvasLabel}
        data-testid="demo-canvas"
        {...lasso.handlers}
      >
        <defs>
          <pattern id="e00-grid" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse">
            <path
              d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`}
              className={styles.gridLine}
              fill="none"
            />
          </pattern>
        </defs>
        <rect width={LOGICAL_WIDTH} height={LOGICAL_HEIGHT} fill="url(#e00-grid)" />
        <rect
          width={LOGICAL_WIDTH}
          height={LOGICAL_HEIGHT}
          className={styles.canvasEdge}
          fill="none"
        />

        {state.groups.map((group) => {
          const bounds = groupBounds(group.counterIds, displayCounters, radius);
          if (!bounds) return null;
          return (
            <rect
              key={group.id}
              x={bounds.x}
              y={bounds.y}
              width={bounds.width}
              height={bounds.height}
              rx={18}
              className={styles.groupOutline}
              pointerEvents="none"
            />
          );
        })}

        {displayCounters.map((counter, index) => {
          const isSelected = selected.includes(counter.id);
          return (
            <g
              key={counter.id}
              role="button"
              tabIndex={readOnly ? -1 : 0}
              aria-label={demoStrings.counterLabel(index + 1)}
              aria-pressed={isSelected}
              aria-disabled={readOnly}
              className={styles.counter}
              data-counter-id={counter.id}
              data-x={counter.x}
              data-y={counter.y}
              onPointerDown={(event) => onCounterPointerDown(counter.id, event)}
              onPointerMove={(event) => {
                event.stopPropagation();
                drag.handlers.onPointerMove(event);
              }}
              onPointerUp={(event) => {
                event.stopPropagation();
                drag.handlers.onPointerUp(event);
              }}
              onPointerCancel={(event) => {
                event.stopPropagation();
                drag.handlers.onPointerCancel(event);
              }}
              onKeyDown={(event) => onCounterKeyDown(counter.id, event)}
            >
              <circle
                cx={counter.x}
                cy={counter.y}
                r={radius + 8}
                className={styles.focusRing}
                data-part="focus-ring"
                pointerEvents="none"
              />
              <circle
                cx={counter.x}
                cy={counter.y}
                r={radius}
                className={styles.counterBody}
                data-part="body"
              />
              <text
                x={counter.x}
                y={counter.y}
                className={styles.counterNumber}
                pointerEvents="none"
              >
                {index + 1}
              </text>
              {isSelected ? (
                <g
                  data-selected-check={counter.id}
                  className={styles.checkBadge}
                  pointerEvents="none"
                >
                  <circle
                    cx={counter.x + radius * 0.62}
                    cy={counter.y - radius * 0.62}
                    r={Math.max(12, radius * 0.3)}
                    className={styles.checkCircle}
                  />
                  <text
                    x={counter.x + radius * 0.62}
                    y={counter.y - radius * 0.62}
                    className={styles.checkMark}
                    fontSize={Math.max(16, radius * 0.42)}
                  >
                    ✓
                  </text>
                </g>
              ) : null}
            </g>
          );
        })}

        {lasso.active && lasso.path.length > 1 ? (
          <polygon points={lassoPoints} className={styles.lasso} pointerEvents="none" />
        ) : null}
      </svg>

      <p className={styles.instructions}>{demoStrings.instructions}</p>

      {state.groups.length > 0 ? (
        <ul className={styles.groups}>
          {state.groups.map((group) => (
            <li key={group.id} className={styles.groupItem}>
              <span>{demoStrings.groupLabel(group.counterIds.length)}</span>
              <button
                type="button"
                className={styles.ungroup}
                onClick={() => dispatch({ type: 'ungroup', groupId: group.id })}
                disabled={readOnly}
              >
                {demoStrings.ungroup}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
