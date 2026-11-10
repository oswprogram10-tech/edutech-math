/**
 * angle-gather 화면.
 *
 * - 모양 단계: 꼭짓점 손잡이를 끌거나 방향키로 옮긴다. 볼록이 아니게 되는
 *   이동은 reducer가 무시하고, 화면은 "모양이 찌그러져요"를 띄운다.
 * - 자르기 단계: 각 조각을 모으는 자리로 끌어 모은다. 키보드는 각 조각에서
 *   Enter(모으기/빼기), R(돌리기)이다.
 *
 * 각도 숫자는 `showSum: 'after-gather'`이고 학생이 다 모았을 때만 쓴다.
 */
import { useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { minTouchRadius, pointerToLogical, useRenderedSize } from '../../../core/engine-sdk';
import type { EngineViewProps, Point } from '../../../core/engine-sdk';
import {
  bestTurn,
  cornerSector,
  cornerTriangle,
  fanState,
  remainingPolygon,
} from '../angle-gather/fan';
import { vertexMoveAllowed } from '../angle-gather/reduce';
import type { AngleGatherState, Peg } from '../angle-gather/types';
import { cutStrings as S } from '../strings.ko';
import type { CutAction, CutConfig } from '../types';
import {
  allPegs,
  boardPoint,
  centroid,
  cornerArcPaths,
  gatherCenterPoint,
  nearestPeg,
  normalizePolygonToBox,
  pegBoardRect,
  pegScreen,
  pegPointsAttribute,
  pointInScreenPolygon,
  pointsAttribute,
  screenDistance,
  sectorTriangle,
} from '../layout';
import { GATHER_RADIUS, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import styles from '../View.module.css';

const LOGICAL = { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT };
const PAPER = '#fbfaf6';
const INK = '#1d2330';
const GRID = '#d4dbe8';
const CENTER = gatherCenterPoint();
const GATHER_PIECE_RADIUS = 112;

const PALETTE = ['#2f6fde', '#c2410c', '#2f9e6b', '#7c3aed'] as const;

type AngleViewProps = EngineViewProps<CutConfig, AngleGatherState, CutAction>;

type Drag =
  | {
      readonly kind: 'vertex';
      readonly pointerId: number;
      readonly index: number;
    }
  | {
      readonly kind: 'corner';
      readonly pointerId: number;
      readonly index: number;
      readonly wasGathered: boolean;
      readonly startDistance: number;
      readonly start: Point;
    }
  | null;

function colorOf(index: number): string {
  return PALETTE[index % PALETTE.length] ?? PALETTE[0];
}

function patternKind(index: number): 'plain' | 'hatch' | 'dots' {
  const remainder = index % 3;
  if (remainder === 1) return 'hatch';
  if (remainder === 2) return 'dots';
  return 'plain';
}

function patternId(index: number): string {
  return `angle-corner-pattern-${index}`;
}

export function AngleGatherView({
  state,
  dispatch,
  cpa,
  readOnly = false,
  targetSize,
}: AngleViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const rendered = useRenderedSize(svgRef);
  const hitRadius = Math.max(18, Math.ceil(minTouchRadius(targetSize, rendered, LOGICAL)));
  const colored = cpa !== 'P';
  const [status, setStatus] = useState('');
  const dragRef = useRef<Drag>(null);
  const lastTap = useRef<{ readonly index: number; readonly at: number } | null>(null);

  const gathered = state.corners.filter((corner) => corner.gathered).length;
  const fan = fanState(state);
  const showSum =
    state.settings.showSum === 'after-gather' && (fan === 'straight' || fan === 'full');
  const sum = fan === 'straight' ? 180 : fan === 'full' ? 360 : null;
  const board = pegBoardRect();

  const vertexAt = (point: Point): number | null => {
    let best: number | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    state.vertices.forEach((peg, index) => {
      const distance = screenDistance(pegScreen(peg), point);
      if (distance <= hitRadius && distance < bestDistance) {
        best = index;
        bestDistance = distance;
      }
    });
    return best;
  };

  const cornerPolygon = (index: number): Point[] => {
    const corner = state.corners[index];
    if (!corner) return [];
    if (corner.gathered) {
      const sector = cornerSector(state.vertices, index, corner.turned);
      if (!sector) return [];
      return sectorTriangle(CENTER, sector.s, sector.e, GATHER_PIECE_RADIUS);
    }
    return cornerTriangle(state.vertices, index).map(boardPoint);
  };

  const cornerAt = (point: Point): number | null => {
    const corners = state.corners;
    for (let index = corners.length - 1; index >= 0; index -= 1) {
      const polygon = cornerPolygon(index);
      if (polygon.length >= 3 && pointInScreenPolygon(point, polygon)) return index;
    }
    return null;
  };

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (readOnly) return;
    const point = pointerToLogical(event, svgRef.current, LOGICAL);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // jsdom 등.
    }
    if (state.phase === 'shape') {
      const index = vertexAt(point);
      if (index === null) return;
      dragRef.current = { kind: 'vertex', pointerId: event.pointerId, index };
      return;
    }
    const index = cornerAt(point);
    if (index === null) return;
    const corner = state.corners[index];
    if (!corner) return;
    dragRef.current = {
      kind: 'corner',
      pointerId: event.pointerId,
      index,
      wasGathered: corner.gathered,
      startDistance: screenDistance(point, CENTER),
      start: point,
    };
  };

  const onPointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag || readOnly || drag.pointerId !== event.pointerId) return;
    const point = pointerToLogical(event, svgRef.current, LOGICAL);

    if (drag.kind === 'vertex') {
      const target = nearestPeg(point);
      if (!vertexMoveAllowed(state, drag.index, target)) {
        setStatus(S.angle.invalid);
        return;
      }
      setStatus('');
      dispatch({ type: 'move-vertex', index: drag.index, to: target });
      return;
    }

    const endDistance = screenDistance(point, CENTER);
    const inside = endDistance <= GATHER_RADIUS + hitRadius;
    const moved = screenDistance(point, drag.start) > 18;

    if (drag.wasGathered) {
      if (drag.startDistance <= GATHER_RADIUS + hitRadius && !inside) {
        dispatch({ type: 'ungather-corner', index: drag.index });
        setStatus('');
        return;
      }
      if (!moved && inside) {
        const now = Date.now();
        const previous = lastTap.current;
        if (previous && previous.index === drag.index && now - previous.at < 400) {
          dispatch({ type: 'turn-corner', index: drag.index });
          lastTap.current = null;
        } else {
          lastTap.current = { index: drag.index, at: now };
        }
      }
      return;
    }

    if (inside) {
      dispatch({
        type: 'gather-corner',
        index: drag.index,
        turned: bestTurn(state, drag.index),
      });
      setStatus('');
    }
  };

  const onVertexKeyDown = (event: ReactKeyboardEvent<SVGGElement>, index: number): void => {
    if (readOnly) return;
    const key = event.key;
    const peg = state.vertices[index];
    if (!peg) return;
    let next: Peg | null = null;
    if (key === 'ArrowLeft') next = [Math.max(0, peg[0] - 1), peg[1]];
    if (key === 'ArrowRight') next = [Math.min(12, peg[0] + 1), peg[1]];
    if (key === 'ArrowUp') next = [peg[0], Math.max(0, peg[1] - 1)];
    if (key === 'ArrowDown') next = [peg[0], Math.min(12, peg[1] + 1)];
    if (!next) return;
    event.preventDefault();
    event.stopPropagation();
    if (!vertexMoveAllowed(state, index, next)) {
      setStatus(S.angle.invalid);
      return;
    }
    setStatus('');
    dispatch({ type: 'move-vertex', index, to: next });
  };

  const onCornerKeyDown = (event: ReactKeyboardEvent<SVGGElement>, index: number): void => {
    if (readOnly) return;
    const corner = state.corners[index];
    if (!corner) return;
    const key = event.key;
    if (key === 'Enter' || key === ' ' || key === 'Spacebar') {
      event.preventDefault();
      event.stopPropagation();
      if (corner.gathered) {
        dispatch({ type: 'ungather-corner', index });
        setStatus(S.angle.ungathered(index + 1));
      } else {
        dispatch({ type: 'gather-corner', index, turned: bestTurn(state, index) });
        setStatus(S.angle.gathered(index + 1));
      }
      return;
    }
    if (key === 'r' || key === 'R') {
      event.preventDefault();
      event.stopPropagation();
      if (corner.gathered) dispatch({ type: 'turn-corner', index });
    }
  };

  const trialSlots = Array.from({ length: state.settings.repeatTrials }, (_, index) => index);

  return (
    <div className={styles.wrap} data-target-size={targetSize}>
      <div className={styles.toolbar}>
        <button
          type="button"
          className={styles.button}
          onClick={() => {
            setStatus('');
            dispatch({ type: 'cut-corners' });
          }}
          disabled={readOnly || state.phase === 'cut'}
        >
          {S.toolbar.cutCorners}
        </button>
        <button
          type="button"
          className={styles.button}
          onClick={() => {
            setStatus('');
            lastTap.current = null;
            dispatch({ type: 'new-trial' });
          }}
          disabled={readOnly}
        >
          {S.toolbar.newTrial}
        </button>
        <span className={styles.hint}>{S.canvasHint}</span>
      </div>

      <p className={styles.instructions}>{S.instructions['angle-gather']}</p>
      <p className={styles.status} role="status" data-testid="angle-status">
        {status}
      </p>

      <div className={styles.canvasArea}>
        <svg
          ref={svgRef}
          className={styles.canvas}
          viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`}
          role="group"
          aria-label={S.canvasLabel['angle-gather']}
          tabIndex={readOnly ? -1 : 0}
          data-testid="cut-canvas"
          data-cpa={cpa}
          data-phase={state.phase}
          data-fan={fan}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            dragRef.current = null;
          }}
        >
          <defs>
            {state.corners.map((corner) => {
              const color = colorOf(corner.index);
              const kind = patternKind(corner.index);
              return (
                <pattern
                  key={`angle-pattern-${corner.index}`}
                  id={patternId(corner.index)}
                  patternUnits="userSpaceOnUse"
                  width={18}
                  height={18}
                >
                  {kind === 'hatch' ? (
                    <path
                      d="M 0 18 L 18 0 M -4 14 L 14 -4 M 4 22 L 22 4"
                      stroke={color}
                      strokeWidth={2}
                      strokeOpacity={0.55}
                      fill="none"
                    />
                  ) : null}
                  {kind === 'dots' ? (
                    <>
                      <circle cx={4} cy={4} r={2.4} fill={color} fillOpacity={0.65} />
                      <circle cx={13} cy={13} r={2.4} fill={color} fillOpacity={0.65} />
                    </>
                  ) : null}
                </pattern>
              );
            })}
          </defs>

          <rect width={LOGICAL_WIDTH} height={LOGICAL_HEIGHT} fill={PAPER} />

          <g pointerEvents="none">
            <rect
              x={board.x}
              y={board.y}
              width={board.size}
              height={board.size}
              rx={18}
              fill="#ffffff"
              stroke="#d7deea"
              strokeWidth={2}
            />
            {Array.from({ length: 13 }, (_, index) => {
              const top = pegScreen([0, index]);
              const left = pegScreen([index, 0]);
              return (
                <g key={`peg-grid-${index}`} stroke={GRID} strokeWidth={1} strokeOpacity={0.6}>
                  <line x1={board.x} y1={top.y} x2={board.x + board.size} y2={top.y} />
                  <line x1={left.x} y1={board.y} x2={left.x} y2={board.y + board.size} />
                </g>
              );
            })}
            {allPegs().map((peg) => {
              const point = pegScreen(peg);
              return (
                <circle
                  key={`peg-${peg[0]}-${peg[1]}`}
                  cx={point.x}
                  cy={point.y}
                  r={3.2}
                  fill={INK}
                  fillOpacity={0.45}
                />
              );
            })}
          </g>

          <g pointerEvents="none">
            <rect
              x={700}
              y={150}
              width={450}
              height={500}
              rx={24}
              fill="#f4f7fd"
              stroke="#c9d2e2"
              strokeWidth={2}
              strokeDasharray="10 8"
            />
            <text x={716} y={184} className={styles.padLabel}>
              {S.angle.gatherPad}
            </text>
            <circle
              cx={CENTER.x}
              cy={CENTER.y}
              r={GATHER_RADIUS}
              fill="#ffffff"
              fillOpacity={0.55}
              stroke="#9aa8bf"
              strokeWidth={2}
              strokeDasharray="7 6"
            />
            <circle cx={CENTER.x} cy={CENTER.y} r={5} fill="#5a6478" />
          </g>

          {state.phase === 'shape' ? (
            <g pointerEvents="none">
              <polygon
                points={pegPointsAttribute(state.vertices)}
                fill="#2f6fde"
                fillOpacity={0.16}
                stroke="#2f6fde"
                strokeWidth={3.5}
                strokeLinejoin="round"
              />
              {state.vertices.map((peg, index) => {
                const point = pegScreen(peg);
                return (
                  <g key={`vertex-mark-${index}`}>
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={14}
                      fill="#ffffff"
                      stroke="#2f6fde"
                      strokeWidth={3}
                    />
                    <text
                      x={point.x}
                      y={point.y + 5}
                      textAnchor="middle"
                      fontSize={14}
                      fontWeight={700}
                      fill="#1d2330"
                    >
                      {index + 1}
                    </text>
                  </g>
                );
              })}
            </g>
          ) : (
            <g pointerEvents="none">
              <polygon
                points={pointsAttribute(remainingPolygon(state.vertices).map(boardPoint))}
                fill="#e7ebf3"
                fillOpacity={0.8}
                stroke="#b7c1d4"
                strokeWidth={2}
                strokeDasharray="8 6"
                strokeLinejoin="round"
              />
            </g>
          )}

          {state.phase === 'cut'
            ? state.corners.map((corner) => {
                const polygon = cornerPolygon(corner.index);
                if (polygon.length < 3) return null;
                const color = colorOf(corner.index);
                const kind = colored ? patternKind(corner.index) : 'plain';
                const sector = cornerSector(state.vertices, corner.index, corner.turned);
                const centerPoint = centroid(polygon);
                const vertexPoint = corner.gathered
                  ? CENTER
                  : pegScreen(state.vertices[corner.index] ?? [0, 0]);
                const arcs =
                  sector === null
                    ? []
                    : cornerArcPaths(
                        vertexPoint,
                        sector.s,
                        sector.e,
                        corner.gathered ? 28 : 16,
                        (corner.index % 4) + 1,
                      );
                return (
                  <g
                    key={`corner-${corner.index}`}
                    role="button"
                    tabIndex={readOnly ? -1 : 0}
                    aria-label={S.angle.cornerLabel(corner.index + 1)}
                    data-corner={corner.index}
                    data-gathered={corner.gathered ? 'true' : 'false'}
                    data-turned={corner.turned ? 'true' : 'false'}
                    onKeyDown={(event) => onCornerKeyDown(event, corner.index)}
                  >
                    <polygon
                      points={pointsAttribute(polygon)}
                      fill={colored ? color : '#ffffff'}
                      fillOpacity={colored ? 0.24 : 1}
                      stroke={colored ? color : INK}
                      strokeWidth={3}
                      strokeLinejoin="round"
                      pointerEvents="none"
                    />
                    {colored && kind !== 'plain' ? (
                      <polygon
                        points={pointsAttribute(polygon)}
                        fill={`url(#${patternId(corner.index)})`}
                        stroke="none"
                        pointerEvents="none"
                      />
                    ) : null}
                    <g pointerEvents="none">
                      {arcs.map((path, arcIndex) => (
                        <path
                          key={`arc-${corner.index}-${arcIndex}`}
                          d={path}
                          fill="none"
                          stroke={corner.gathered ? '#8a4b00' : color}
                          strokeWidth={2.5}
                          strokeLinecap="round"
                        />
                      ))}
                      <circle
                        cx={centerPoint.x}
                        cy={centerPoint.y}
                        r={hitRadius * 0.7}
                        fill="transparent"
                      />
                      {!corner.gathered ? (
                        <text
                          x={centerPoint.x}
                          y={centerPoint.y + 5}
                          textAnchor="middle"
                          fontSize={13}
                          fontWeight={700}
                          fill={INK}
                        >
                          {corner.index + 1}
                        </text>
                      ) : null}
                    </g>
                  </g>
                );
              })
            : null}

          {state.phase === 'shape'
            ? state.vertices.map((peg, index) => {
                const point = pegScreen(peg);
                return (
                  <g
                    key={`vertex-${index}`}
                    role="button"
                    tabIndex={readOnly ? -1 : 0}
                    aria-label={S.angle.vertexLabel(index + 1)}
                    data-vertex={index}
                    onKeyDown={(event) => onVertexKeyDown(event, index)}
                  >
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={hitRadius}
                      fill="transparent"
                      stroke="none"
                    />
                  </g>
                );
              })
            : null}

          {showSum && sum !== null ? (
            <text
              x={CENTER.x}
              y={CENTER.y - 148}
              textAnchor="middle"
              fontSize={24}
              fontWeight={700}
              fill="#1d2330"
              data-testid="angle-sum"
            >
              {S.angle.gatheredSum(sum)}
            </text>
          ) : null}

          {trialSlots.map((slot) => {
            const trial = state.trials[slot];
            const x = 710 + slot * 86;
            return (
              <g key={`trial-${slot}`} pointerEvents="none">
                <rect
                  x={x}
                  y={656}
                  width={72}
                  height={58}
                  rx={10}
                  fill="#ffffff"
                  fillOpacity={trial ? 0.9 : 0.35}
                  stroke="#c9d2e2"
                  strokeWidth={1.5}
                  strokeDasharray={trial ? undefined : '5 5'}
                />
                {trial ? (
                  <polygon
                    points={pointsAttribute(
                      normalizePolygonToBox(trial.vertices.map(pegScreen), {
                        x: x + 8,
                        y: 662,
                        width: 56,
                        height: 44,
                      }),
                    )}
                    fill="#2f6fde"
                    fillOpacity={0.18}
                    stroke="#2f6fde"
                    strokeWidth={2}
                  />
                ) : null}
                <text
                  x={x + 36}
                  y={736}
                  textAnchor="middle"
                  fontSize={13}
                  fontWeight={700}
                  fill="#5a6478"
                >
                  {S.angle.trial(slot + 1, state.settings.repeatTrials)}
                </text>
              </g>
            );
          })}

          <text x={716} y={622} fontSize={14} fontWeight={600} fill="#5a6478">
            {state.phase === 'shape' ? S.angle.shapeHint : S.angle.cornerHint}
          </text>
          <text x={716} y={776} fontSize={13} fontWeight={600} fill="#5a6478">
            {S.angle.gatherCount(gathered, state.corners.length)}
          </text>
        </svg>
      </div>

      <p className={styles.hint}>{state.phase === 'shape' ? S.angle.shapeHint : S.angle.cutHint}</p>
    </div>
  );
}
