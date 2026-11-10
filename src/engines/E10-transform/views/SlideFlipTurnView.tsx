/**
 * E10 `slide-flip-turn` 화면: 모눈 위 비대칭 도형을 밀고 뒤집고 돌린다.
 *
 * - C 단계에서만 끌기 제스처를 쓴다(도형 몸통·돌리기 손잡이·뒤집기 손잡이).
 * - P·A 단계는 버튼과 캔버스 키보드만 쓴다.
 * - 잔상은 이동 직전 도형을 반투명·점선으로, 회전 호는 마지막 돌리기의
 *   꼭짓점 궤적으로 그린다.
 */
import { useRef } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import {
  distance,
  minTouchRadius,
  pointerToLogical,
  useRenderedSize,
} from '../../../core/engine-sdk';
import type { EngineViewProps, Point } from '../../../core/engine-sdk';
import { arcPath, boardRect, cellRect, figureBox, ptXY, pointerToCell } from '../layout';
import { cellKey, sameCellSet } from '../square';
import { currentFigure, figureBeforeMove } from '../modes/slide-flip-turn';
import { transformStrings as S } from '../strings.ko';
import type {
  Cell,
  SlideFlipTurnState,
  TransformAction,
  TransformConfig,
  TurnAngle,
} from '../types';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import styles from '../View.module.css';
import { FigureShape } from './parts/FigureShape';
import { MoveList } from './parts/MoveList';
import { MovePanel } from './parts/MovePanel';
import { prefersReducedMotion } from './parts/motion';
import { useMoveAnimation } from './parts/useMoveAnimation';

const LOGICAL = { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT };
const PAPER = '#fbfaf6';
const INK = '#1d2330';
const GRID = '#c9d2e2';
const BLUE = '#2f6fde';
const ORANGE = '#e8872e';

type SlideFlipTurnViewProps = EngineViewProps<TransformConfig, SlideFlipTurnState, TransformAction>;

interface Gesture {
  readonly pointerId: number;
  readonly kind: 'body' | 'turn';
  readonly start: Point;
  readonly center: Point;
}

function containsCell(cells: readonly Cell[], cell: Cell): boolean {
  const key = cellKey(cell);
  return cells.some((candidate) => cellKey(candidate) === key);
}

function arrowPoints(cx: number, cy: number, side: string): string {
  const size = 13;
  if (side === 'up') {
    return `${cx},${cy - size} ${cx - size},${cy + size} ${cx + size},${cy + size}`;
  }
  if (side === 'down') {
    return `${cx},${cy + size} ${cx - size},${cy - size} ${cx + size},${cy - size}`;
  }
  if (side === 'left') {
    return `${cx - size},${cy} ${cx + size},${cy - size} ${cx + size},${cy + size}`;
  }
  return `${cx + size},${cy} ${cx - size},${cy - size} ${cx - size},${cy + size}`;
}

export function SlideFlipTurnView({
  state,
  dispatch,
  cpa,
  readOnly = false,
  targetSize,
}: SlideFlipTurnViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const rendered = useRenderedSize(svgRef);
  const rect = boardRect(state.settings.grid);
  const reduced = prefersReducedMotion();
  const figure = currentFigure(state);
  const ghost = state.moves.length > 0 ? figureBeforeMove(state, state.moves.length - 1) : null;
  const lastMove = state.moves[state.moves.length - 1];
  const animation = useMoveAnimation({
    start: state.start,
    moves: state.moves,
    rect,
    cpa,
    reduced,
  });
  const hitRadius = Math.max(18, Math.ceil(minTouchRadius(targetSize, rendered, LOGICAL)));
  const gesture = useRef<Gesture | null>(null);
  const gestureEnabled = cpa === 'C' && !readOnly;

  const centerIndex = Math.min(state.center, Math.max(0, figure.outline.length - 1));
  const centerPoint = figure.outline[centerIndex] ?? figure.outline[0] ?? [0, 0];
  const centerXY = ptXY(rect, centerPoint);
  const handleOffset = Math.max(56, hitRadius * 1.8);
  const handlePoint = { x: centerXY.x + handleOffset, y: centerXY.y };
  const box = figureBox(rect, figure);
  const target = state.settings.target;
  const atTarget = target !== null && sameCellSet(target, figure.cells);
  const moveLabel = S.vertexLabels[centerIndex] ?? S.vertexLabels[0];

  const capture = (event: ReactPointerEvent<SVGSVGElement>) => {
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // 포인터가 이미 끝났거나 jsdom처럼 캡처를 지원하지 않는 환경.
    }
  };

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!gestureEnabled) return;
    const point = pointerToLogical(event, svgRef.current, LOGICAL);
    if (distance(point, handlePoint) <= hitRadius * 1.5) {
      gesture.current = {
        pointerId: event.pointerId,
        kind: 'turn',
        start: point,
        center: centerXY,
      };
      capture(event);
      return;
    }
    const cell = pointerToCell(rect, point);
    if (!containsCell(figure.cells, cell)) return;
    gesture.current = {
      pointerId: event.pointerId,
      kind: 'body',
      start: point,
      center: centerXY,
    };
    capture(event);
  };

  const onPointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    const current = gesture.current;
    gesture.current = null;
    if (!current || current.pointerId !== event.pointerId || !gestureEnabled) return;
    const point = pointerToLogical(event, svgRef.current, LOGICAL);
    if (current.kind === 'body') {
      const dx = Math.round((point.x - current.start.x) / rect.cell);
      const dy = Math.round((point.y - current.start.y) / rect.cell);
      if (dx === 0 && dy === 0) return;
      if (Math.abs(dx) >= Math.abs(dy)) dispatch({ type: 'slide', dx, dy: 0 });
      else dispatch({ type: 'slide', dx: 0, dy });
      return;
    }
    const startAngle = Math.atan2(
      current.start.y - current.center.y,
      current.start.x - current.center.x,
    );
    const endAngle = Math.atan2(point.y - current.center.y, point.x - current.center.x);
    let degrees = ((endAngle - startAngle) * 180) / Math.PI;
    degrees = ((degrees + 540) % 360) - 180;
    const steps = Math.round(degrees / 90);
    if (steps === 0) return;
    const angle = (Math.abs(steps) * 90) as TurnAngle;
    if (angle !== 90 && angle !== 180) return;
    dispatch({
      type: 'turn',
      direction: steps > 0 ? 'cw' : 'ccw',
      angle,
      center: centerPoint,
    });
  };

  const onKeyDown = (event: ReactKeyboardEvent<SVGSVGElement>) => {
    if (readOnly) return;
    const key = event.key;
    if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight') {
      event.preventDefault();
      const side =
        key === 'ArrowUp'
          ? 'up'
          : key === 'ArrowDown'
            ? 'down'
            : key === 'ArrowLeft'
              ? 'left'
              : 'right';
      if (event.shiftKey) {
        dispatch({ type: 'flip', side });
        return;
      }
      const dx = side === 'left' ? -1 : side === 'right' ? 1 : 0;
      const dy = side === 'up' ? -1 : side === 'down' ? 1 : 0;
      dispatch({ type: 'slide', dx, dy });
      return;
    }
    if (key.toLowerCase() === 'r') {
      event.preventDefault();
      dispatch({
        type: 'turn',
        direction: event.shiftKey ? 'ccw' : 'cw',
        angle: 90,
        center: centerPoint,
      });
      return;
    }
    if (key.toLowerCase() === 'c') {
      event.preventDefault();
      const length = figure.outline.length;
      if (length === 0) return;
      const step = event.shiftKey ? -1 : 1;
      dispatch({ type: 'select-center', index: (state.center + step + length) % length });
      return;
    }
    if (key === 'Backspace') {
      event.preventDefault();
      dispatch({ type: 'undo-move' });
    }
  };

  const arcTrail =
    state.settings.arcTrail && lastMove?.kind === 'turn' && ghost !== null
      ? ghost.outline.map((point, index) => {
          const next = figure.outline[index];
          if (!next) return null;
          const path = arcPath(
            ptXY(rect, lastMove.center),
            ptXY(rect, point),
            ptXY(rect, next),
            lastMove.angle,
            lastMove.direction,
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
      : null;

  const flipHandles = [
    { side: 'up' as const, x: box.x + box.width / 2, y: box.y - 42 },
    { side: 'down' as const, x: box.x + box.width / 2, y: box.y + box.height + 42 },
    { side: 'left' as const, x: box.x - 42, y: box.y + box.height / 2 },
    { side: 'right' as const, x: box.x + box.width + 42, y: box.y + box.height / 2 },
  ];

  return (
    <div className={styles.wrap} data-target-size={targetSize}>
      <div className={styles.toolbar}>
        <span className={styles.group}>
          <span className={styles.groupLabel}>{S.panel.gridLabel}</span>
          <span data-testid="transform-grid">{S.panel.gridValue(state.settings.grid)}</span>
        </span>
        <span className={styles.badge} aria-live="polite" data-testid="center-announce">
          {S.centerAnnounce(moveLabel)}
        </span>
        <span className={styles.hint}>{S.keyboard['slide-flip-turn']}</span>
      </div>

      <p className={styles.instructions}>{S.instructions['slide-flip-turn']}</p>
      <p className={styles.status} role="status" data-testid="transform-status">
        {state.lastBlocked ? S.status.blocked : atTarget ? S.status.targetDone : ''}
      </p>

      <div className={styles.canvasArea}>
        <svg
          ref={svgRef}
          className={styles.canvas}
          viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`}
          role="group"
          aria-label={S.canvasLabel['slide-flip-turn']}
          tabIndex={readOnly ? -1 : 0}
          data-testid="transform-canvas"
          data-motion={reduced ? 'reduced' : 'full'}
          data-cpa={cpa}
          onKeyDown={onKeyDown}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            gesture.current = null;
          }}
        >
          <defs>
            <pattern
              id="e10-figure-hatch"
              width="18"
              height="18"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(35)"
            >
              <rect width="18" height="18" fill="#dbe7ff" />
              <line x1="0" y1="0" x2="0" y2="18" stroke={BLUE} strokeWidth="5" />
            </pattern>
            <pattern
              id="e10-ghost-hatch"
              width="16"
              height="16"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(-35)"
            >
              <rect width="16" height="16" fill="#eef1f6" />
              <line x1="0" y1="0" x2="0" y2="16" stroke="#7a8497" strokeWidth="3" />
            </pattern>
            <pattern
              id="e10-target-hatch"
              width="20"
              height="20"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(70)"
            >
              <rect width="20" height="20" fill="#fff7e6" />
              <line x1="0" y1="0" x2="0" y2="20" stroke="#e8a13a" strokeWidth="3" />
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

          {target ? (
            <g data-target pointerEvents="none">
              {target.map((cell) => {
                const boxRect = cellRect(rect, cell);
                return (
                  <rect
                    key={`target-${cell[0]}-${cell[1]}`}
                    x={boxRect.x}
                    y={boxRect.y}
                    width={boxRect.width}
                    height={boxRect.height}
                    fill="url(#e10-target-hatch)"
                    fillOpacity={0.7}
                    stroke="#e8a13a"
                    strokeWidth={2.5}
                    strokeDasharray="8 6"
                  />
                );
              })}
            </g>
          ) : null}

          {ghost && state.settings.ghost ? (
            <g data-ghost pointerEvents="none">
              <FigureShape
                figure={ghost}
                rect={rect}
                fill="url(#e10-ghost-hatch)"
                stroke="#7a8497"
                strokeWidth={3}
                dash="10 8"
                opacity={0.25}
              />
            </g>
          ) : null}

          {arcTrail}
          {arcTrail && lastMove?.kind === 'turn' ? (
            <g data-pin pointerEvents="none">
              <circle
                cx={ptXY(rect, lastMove.center).x}
                cy={ptXY(rect, lastMove.center).y}
                r={9}
                fill={ORANGE}
                stroke="#ffffff"
                strokeWidth={2}
              />
            </g>
          ) : null}

          <g
            data-figure
            data-animating={animation.animating ? 'true' : undefined}
            transform={animation.transform ?? undefined}
            pointerEvents="none"
          >
            <FigureShape
              figure={figure}
              rect={rect}
              fill="url(#e10-figure-hatch)"
              stroke={INK}
              strokeWidth={4}
              labels={state.settings.labels ? S.vertexLabels : undefined}
            />
          </g>

          <g pointerEvents="none">
            {figure.outline.map((point, index) => {
              const xy = ptXY(rect, point);
              const selected = index === centerIndex;
              return (
                <g key={`vertex-${index}`}>
                  <circle
                    cx={xy.x}
                    cy={xy.y}
                    r={selected ? 12 : 8}
                    fill={selected ? ORANGE : '#ffffff'}
                    stroke={INK}
                    strokeWidth={3}
                  />
                  {selected ? (
                    <circle
                      cx={xy.x}
                      cy={xy.y}
                      r={hitRadius}
                      fill="none"
                      stroke={ORANGE}
                      strokeWidth={2}
                      strokeDasharray="6 5"
                    />
                  ) : null}
                </g>
              );
            })}
          </g>

          {gestureEnabled ? (
            <g data-turn-handle role="button" aria-label={S.centerAria(moveLabel)}>
              <line
                x1={centerXY.x}
                y1={centerXY.y}
                x2={handlePoint.x - hitRadius}
                y2={handlePoint.y}
                stroke={ORANGE}
                strokeWidth={3}
                strokeDasharray="6 5"
                pointerEvents="none"
              />
              <circle
                cx={handlePoint.x}
                cy={handlePoint.y}
                r={hitRadius}
                fill="#fff7e6"
                stroke={ORANGE}
                strokeWidth={3}
              />
              <path
                d={`M ${handlePoint.x - 11} ${handlePoint.y - 11} A 16 16 0 1 1 ${handlePoint.x - 11} ${handlePoint.y + 11}`}
                fill="none"
                stroke={ORANGE}
                strokeWidth={3.5}
                strokeLinecap="round"
                pointerEvents="none"
              />
            </g>
          ) : null}

          {gestureEnabled
            ? flipHandles.map((handle) => (
                <g
                  key={`flip-${handle.side}`}
                  data-flip-handle={handle.side}
                  role="button"
                  aria-label={`${S.sides[handle.side]}로 뒤집기`}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    dispatch({ type: 'flip', side: handle.side });
                  }}
                >
                  <circle
                    cx={handle.x}
                    cy={handle.y}
                    r={Math.max(24, hitRadius * 0.8)}
                    fill="#ffffff"
                    stroke={BLUE}
                    strokeWidth={2.5}
                  />
                  <polygon
                    points={arrowPoints(handle.x, handle.y, handle.side)}
                    fill={BLUE}
                    pointerEvents="none"
                  />
                </g>
              ))
            : null}

          {gestureEnabled
            ? figure.outline.map((point, index) => {
                const xy = ptXY(rect, point);
                return (
                  <circle
                    key={`vertex-hit-${index}`}
                    cx={xy.x}
                    cy={xy.y}
                    r={hitRadius}
                    fill="transparent"
                    stroke="transparent"
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      dispatch({ type: 'select-center', index });
                    }}
                  />
                );
              })
            : null}
        </svg>
      </div>

      <MoveList start={state.start} moves={state.moves} />

      <MovePanel state={state} figure={figure} dispatch={dispatch} readOnly={readOnly} />
    </div>
  );
}
