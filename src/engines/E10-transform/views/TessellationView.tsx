/**
 * `tessellation` 화면: 타일을 밀고·뒤집고·돌려 틀을 채운다.
 *
 * 빈틈·겹침은 단위 칸을 정확히 세어 그린다. 학생이 "빈틈 살펴보기"를 누르기
 * 전에는 빈 칸을 빨갛게 칠하지 않는다. 정오각형은 한 꼭짓점 둘레 시험만 한다.
 */
import { useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import type { EngineViewProps, Point } from '../../../core/engine-sdk';
import { pointerToLogical } from '../../../core/engine-sdk';
import { boardRect, cellRect, triBoardRect, triPtXY } from '../layout';
import type { BoardRect, TriBoardRect } from '../layout';
import {
  SQUARE_FRAME,
  TRI_FRAME_ROWS,
  TRI_FRAME_WIDTH,
  squareFrameKeys,
  tessellationStats,
  tileFamily,
  triangleFrameKeys,
} from '../tiles';
import type { TessTile } from '../tiles';
import { decodeTriCell } from '../tri';
import { transformStrings as S } from '../strings.ko';
import type { Pt, TessellationState, TransformAction, TransformConfig } from '../types';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import styles from '../View.module.css';
import { TileEditor } from './parts/TileEditor';

const PAPER = '#fbfaf6';
const GRID = '#c9d2e2';
const INK = '#1d2330';
const ORANGE = '#e8872e';
const RED = '#b42318';
const TILE_FILLS = ['#dbe7ff', '#d9f2e6', '#fff2d8', '#f3ddf7', '#e2ecff'] as const;

const TRI_BOARD = triBoardRect(-3, 7, -2, 8);

type Props = EngineViewProps<TransformConfig, TessellationState, TransformAction>;

function keyOfCell(tile: TessTile, cell: Pt): string {
  if (tileFamily(tile) === 'tri') {
    const decoded = decodeTriCell(cell);
    return decoded ? `${decoded.up ? 'U' : 'D'}${decoded.a},${decoded.b}` : `${cell[0]},${cell[1]}`;
  }
  return `${cell[0]},${cell[1]}`;
}

function triCellPoints(cell: Pt): readonly Pt[] | null {
  const decoded = decodeTriCell(cell);
  if (!decoded) return null;
  const { up, a, b } = decoded;
  return up
    ? [
        [a, b],
        [a + 1, b],
        [a, b + 1],
      ]
    : [
        [a + 1, b],
        [a, b + 1],
        [a + 1, b + 1],
      ];
}

function frameCellFromKey(
  key: string,
): { readonly up: boolean; readonly a: number; readonly b: number } | null {
  const match = /^([UD])(-?\d+),(-?\d+)$/.exec(key);
  if (!match?.[1] || !match[2] || !match[3]) return null;
  return { up: match[1] === 'U', a: Number(match[2]), b: Number(match[3]) };
}

function triPointsToString(rect: TriBoardRect, points: readonly Pt[]): string {
  return points
    .map((point) => {
      const xy = triPtXY(rect, point);
      return `${xy.x.toFixed(2)},${xy.y.toFixed(2)}`;
    })
    .join(' ');
}

function squareBoundary(cells: readonly Pt[], rect: BoardRect) {
  const set = new Set(cells.map((cell) => `${cell[0]},${cell[1]}`));
  const segments: {
    readonly x1: number;
    readonly y1: number;
    readonly x2: number;
    readonly y2: number;
  }[] = [];
  for (const cell of cells) {
    const box = cellRect(rect, cell as readonly [number, number]);
    const [i, j] = cell;
    if (!set.has(`${i},${j - 1}`))
      segments.push({ x1: box.x, y1: box.y, x2: box.x + box.width, y2: box.y });
    if (!set.has(`${i},${j + 1}`))
      segments.push({
        x1: box.x,
        y1: box.y + box.height,
        x2: box.x + box.width,
        y2: box.y + box.height,
      });
    if (!set.has(`${i - 1},${j}`))
      segments.push({ x1: box.x, y1: box.y, x2: box.x, y2: box.y + box.height });
    if (!set.has(`${i + 1},${j}`))
      segments.push({
        x1: box.x + box.width,
        y1: box.y,
        x2: box.x + box.width,
        y2: box.y + box.height,
      });
  }
  return segments;
}

function tileColor(id: number): string {
  return TILE_FILLS[id % TILE_FILLS.length] ?? TILE_FILLS[0];
}

interface SquareLayerProps {
  readonly rect: BoardRect;
  readonly placed: TessellationState['placed'];
  readonly stamp: TessellationState['stamp'];
  readonly checked: boolean;
}

function SquareLayer({ rect, placed, stamp, checked }: SquareLayerProps) {
  const counts = new Map<string, number>();
  for (const tile of placed) {
    for (const cell of tile.cells) {
      const key = keyOfCell(tile.tile, cell);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const stampKeys = new Set(stamp.cells.map((cell) => `${cell[0]},${cell[1]}`));
  const frame = squareFrameKeys();
  return (
    <>
      {placed.map((tile) =>
        tile.cells.map((cell) => {
          const box = cellRect(rect, cell as readonly [number, number]);
          const key = keyOfCell(tile.tile, cell);
          const overlap = (counts.get(key) ?? 0) >= 2;
          return (
            <rect
              key={`placed-${tile.id}-${cell[0]}-${cell[1]}`}
              data-placed-tile={tile.id}
              data-overlap-cell={overlap ? 'true' : undefined}
              x={box.x + 0.5}
              y={box.y + 0.5}
              width={box.width - 1}
              height={box.height - 1}
              fill={overlap ? 'url(#e10-tess-overlap)' : tileColor(tile.id)}
              stroke={overlap ? RED : '#5b6b88'}
              strokeWidth={overlap ? 2.5 : 1}
            />
          );
        }),
      )}
      {placed.map((tile) => {
        const segments = squareBoundary(tile.cells, rect);
        return (
          <g key={`border-${tile.id}`} pointerEvents="none">
            {segments.map((segment, index) => (
              <line
                key={`edge-${index}`}
                x1={segment.x1}
                y1={segment.y1}
                x2={segment.x2}
                y2={segment.y2}
                stroke={INK}
                strokeWidth={3}
              />
            ))}
          </g>
        );
      })}
      {checked
        ? [...frame]
            .filter((key) => (counts.get(key) ?? 0) === 0)
            .map((key) => {
              const [i, j] = key.split(',').map(Number);
              if (typeof i !== 'number' || typeof j !== 'number') return null;
              const box = cellRect(rect, [i, j]);
              return (
                <rect
                  key={`gap-${key}`}
                  data-gap-cell
                  x={box.x + 1}
                  y={box.y + 1}
                  width={box.width - 2}
                  height={box.height - 2}
                  fill="url(#e10-tess-gap)"
                  stroke={RED}
                  strokeWidth={2}
                />
              );
            })
        : null}
      {stamp.cells.map((cell) => {
        const box = cellRect(rect, cell as readonly [number, number]);
        const inside = stampKeys.has(`${cell[0]},${cell[1]}`);
        return (
          <rect
            key={`stamp-${cell[0]}-${cell[1]}`}
            data-stamp={inside ? 'true' : undefined}
            x={box.x + 3}
            y={box.y + 3}
            width={box.width - 6}
            height={box.height - 6}
            fill="url(#e10-tess-stamp)"
            stroke={ORANGE}
            strokeWidth={2}
            strokeDasharray="8 5"
          />
        );
      })}
    </>
  );
}

interface TriLayerProps {
  readonly rect: TriBoardRect;
  readonly placed: TessellationState['placed'];
  readonly stamp: TessellationState['stamp'];
  readonly checked: boolean;
}

function TriLayer({ rect, placed, stamp, checked }: TriLayerProps) {
  const counts = new Map<string, number>();
  for (const tile of placed) {
    for (const cell of tile.cells) {
      const key = keyOfCell(tile.tile, cell);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const frame = triangleFrameKeys();
  return (
    <>
      {placed.map((tile) =>
        tile.cells.map((cell, index) => {
          const points = triCellPoints(cell);
          if (!points) return null;
          const key = keyOfCell(tile.tile, cell);
          const overlap = (counts.get(key) ?? 0) >= 2;
          return (
            <polygon
              key={`placed-${tile.id}-${index}`}
              data-placed-tile={tile.id}
              data-overlap-cell={overlap ? 'true' : undefined}
              points={triPointsToString(rect, points)}
              fill={overlap ? 'url(#e10-tess-overlap)' : tileColor(tile.id)}
              stroke={overlap ? RED : '#5b6b88'}
              strokeWidth={overlap ? 2.5 : 1}
            />
          );
        }),
      )}
      {checked
        ? [...frame]
            .filter((key) => (counts.get(key) ?? 0) === 0)
            .map((key) => {
              const decoded = frameCellFromKey(key);
              if (!decoded) return null;
              const points = triCellPoints(
                decoded.up
                  ? [3 * decoded.a + 1, 3 * decoded.b + 1]
                  : [3 * decoded.a + 2, 3 * decoded.b + 2],
              );
              if (!points) return null;
              return (
                <polygon
                  key={`gap-${key}`}
                  data-gap-cell
                  points={triPointsToString(rect, points)}
                  fill="url(#e10-tess-gap)"
                  stroke={RED}
                  strokeWidth={2}
                />
              );
            })
        : null}
      {stamp.cells.map((cell, index) => {
        const points = triCellPoints(cell);
        if (!points) return null;
        return (
          <polygon
            key={`stamp-${index}`}
            data-stamp="true"
            points={triPointsToString(rect, points)}
            fill="url(#e10-tess-stamp)"
            stroke={ORANGE}
            strokeWidth={2}
            strokeDasharray="8 5"
          />
        );
      })}
    </>
  );
}

function polar(center: { x: number; y: number }, radius: number, degrees: number) {
  const radians = (degrees * Math.PI) / 180;
  return { x: center.x + radius * Math.cos(radians), y: center.y + radius * Math.sin(radians) };
}

function PentagonLayer({ hub, gapCheck }: { readonly hub: number; readonly gapCheck: boolean }) {
  const center = { x: 500, y: 520 };
  const radius = 150;
  // 오각형은 허브 꼭짓점을 공유하므로 중심까지의 거리가 외접원 반지름과 같다.
  const distance = radius;
  const startAngle = -90;
  // 오각형 i는 [-144 + 108i, -36 + 108i]를 차지한다. 360° = [-144, 216].
  const occupiedEnd = -144 + 108 * hub;
  const gapDegrees = gapCheck ? Math.max(0, Math.min(360, 216 - occupiedEnd)) : 0;
  const overlapDegrees = Math.max(0, occupiedEnd - 216);
  const sector = (from: number, to: number) => {
    const a = polar(center, distance, from);
    const b = polar(center, distance, to);
    const largeArc = to - from > 180 ? 1 : 0;
    return `M ${center.x} ${center.y} L ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${distance} ${distance} 0 ${largeArc} 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)} Z`;
  };
  return (
    <g data-pentagon-hub={hub}>
      <circle
        cx={center.x}
        cy={center.y}
        r={distance + 4}
        fill="none"
        stroke="#d7deea"
        strokeDasharray="8 6"
      />
      {Array.from({ length: hub }, (_, index) => {
        const angle = startAngle + index * 108;
        const pentagonCenter = polar(center, distance, angle);
        const points = Array.from({ length: 5 }, (_, vertex) => {
          const point = polar(pentagonCenter, radius, angle + 180 + vertex * 72);
          return `${point.x.toFixed(2)},${point.y.toFixed(2)}`;
        }).join(' ');
        return (
          <polygon
            key={`pentagon-${index}`}
            data-pentagon={index}
            points={points}
            fill={TILE_FILLS[index % TILE_FILLS.length]}
            stroke={INK}
            strokeWidth={3}
          />
        );
      })}
      {gapCheck && gapDegrees > 0 ? (
        <path
          data-gap-cell
          d={sector(occupiedEnd, 216)}
          fill="url(#e10-tess-gap)"
          stroke={RED}
          strokeWidth={2.5}
        />
      ) : null}
      {overlapDegrees > 0 ? (
        <path
          data-overlap-cell
          d={sector(216, occupiedEnd)}
          fill="url(#e10-tess-overlap)"
          stroke={RED}
          strokeWidth={2.5}
        />
      ) : null}
    </g>
  );
}

export function TessellationView({ state, dispatch, cpa, readOnly = false, targetSize }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [cells, setCells] = useState(6);
  const [flipNext, setFlipNext] = useState(false);
  const family = tileFamily(state.tile);
  const rect = boardRect(SQUARE_FRAME);
  const stats = tessellationStats(state.placed, state.tile);
  const centerIndex = Math.min(state.center, Math.max(0, state.stamp.outline.length - 1));
  const centerPoint = state.stamp.outline[centerIndex] ?? [0, 0];
  const checked = state.checked && state.settings.gapCheck;
  const drag = useRef<{
    readonly pointerId: number;
    readonly startA: number;
    readonly startB: number;
    appliedA: number;
    appliedB: number;
  } | null>(null);

  /** 화면 좌표를 격자 단위(정사각형) 또는 삼각 격자 좌표로 되돌린다. */
  const gridCoords = (point: Point): { readonly a: number; readonly b: number } => {
    if (family === 'tri') {
      const root = Math.sqrt(3) / 2;
      const b = (point.y - TRI_BOARD.originY) / (root * TRI_BOARD.unit);
      const a = (point.x - TRI_BOARD.originX) / TRI_BOARD.unit - b / 2;
      return { a, b };
    }
    return { a: (point.x - rect.x) / rect.cell, b: (point.y - rect.y) / rect.cell };
  };

  const pointerPoint = (event: ReactPointerEvent<SVGSVGElement>) =>
    pointerToLogical(event, svgRef.current, { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT });

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (readOnly || cpa !== 'C' || family === 'free') return;
    const start = gridCoords(pointerPoint(event));
    drag.current = {
      pointerId: event.pointerId,
      startA: start.a,
      startB: start.b,
      appliedA: 0,
      appliedB: 0,
    };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // jsdom처럼 포인터 캡처를 지원하지 않는 환경.
    }
  };

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId || readOnly) return;
    const current = gridCoords(pointerPoint(event));
    const da = Math.round(current.a - active.startA);
    const db = Math.round(current.b - active.startB);
    if (da === active.appliedA && db === active.appliedB) return;
    const dx = da - active.appliedA;
    const dy = db - active.appliedB;
    active.appliedA = da;
    active.appliedB = db;
    dispatch({ type: 'move', move: { kind: 'slide', dx, dy } });
  };

  const onPointerUp = () => {
    drag.current = null;
  };

  const pickTile = (tile: TessTile) => {
    dispatch({ type: 'select-tile', tile });
  };

  const tileLocked = (tile: TessTile): boolean => {
    if (state.placed.length === 0) return false;
    const current = state.placed[0]?.tile;
    return current !== undefined && tileFamily(current) !== tileFamily(tile);
  };

  const onKeyDown = (event: ReactKeyboardEvent<SVGSVGElement>) => {
    if (readOnly) return;
    const key = event.key;
    if (state.tile === 'pentagon-regular') {
      if (key === 'Enter' || key === ' ') {
        event.preventDefault();
        dispatch({ type: 'hub-add' });
        return;
      }
      if (key === 'Backspace' || key === 'Delete') {
        event.preventDefault();
        dispatch({ type: 'hub-remove' });
      }
      return;
    }

    if (key.toLowerCase() === 'f') {
      event.preventDefault();
      setFlipNext((current) => !current);
      return;
    }
    if (key.toLowerCase() === 'r') {
      event.preventDefault();
      const angle = family === 'square' ? 90 : 60;
      dispatch({
        type: 'move',
        move: {
          kind: 'turn',
          direction: event.shiftKey ? 'ccw' : 'cw',
          angle,
          center: centerPoint,
        },
      });
      return;
    }
    if (key.toLowerCase() === 'c') {
      event.preventDefault();
      const length = state.stamp.outline.length;
      if (length === 0) return;
      const step = event.shiftKey ? -1 : 1;
      dispatch({ type: 'select-center', index: (state.center + step + length) % length });
      return;
    }
    if (key === 'Enter' || key === ' ') {
      event.preventDefault();
      dispatch({ type: 'place' });
      return;
    }
    if (key === 'Backspace' || key === 'Delete') {
      event.preventDefault();
      dispatch({ type: 'remove-last' });
      return;
    }
    if (key.toLowerCase() === 'g') {
      event.preventDefault();
      dispatch({ type: 'check-gaps' });
      return;
    }
    if (!key.startsWith('Arrow')) return;
    event.preventDefault();
    const side =
      key === 'ArrowUp'
        ? 'up'
        : key === 'ArrowDown'
          ? 'down'
          : key === 'ArrowLeft'
            ? 'left'
            : 'right';
    if (flipNext) {
      setFlipNext(false);
      dispatch({ type: 'move', move: { kind: 'flip', side } });
      return;
    }
    if (family === 'square') {
      const dx = side === 'left' ? -cells : side === 'right' ? cells : 0;
      const dy = side === 'up' ? -cells : side === 'down' ? cells : 0;
      dispatch({ type: 'move', move: { kind: 'slide', dx, dy } });
      return;
    }
    let dx = 0;
    let dy = 0;
    if (side === 'right') dx = 1;
    if (side === 'left') dx = -1;
    if (side === 'down') dy = 1;
    if (side === 'up') dy = -1;
    if (event.shiftKey) {
      if (side === 'down') {
        dx = -1;
        dy = 1;
      } else if (side === 'up') {
        dx = 1;
        dy = -1;
      }
    }
    dispatch({ type: 'move', move: { kind: 'slide', dx, dy } });
  };

  const status =
    family === 'free'
      ? state.hub >= 4
        ? S.tessellation.hasOverlap
        : state.hub === 3 && state.settings.gapCheck
          ? S.tessellation.hasGap
          : ''
      : stats.overlapCells > 0
        ? S.tessellation.hasOverlap
        : checked && stats.gapCells > 0
          ? S.tessellation.hasGap
          : checked && stats.gapCells === 0 && stats.overlapCells === 0
            ? S.tessellation.full
            : '';

  const tileOptions: readonly TessTile[] = [
    ...state.settings.baseTiles,
    ...(state.settings.customize === 'edge-translate' ? (['custom'] as const) : []),
  ];

  return (
    <div className={styles.wrap} data-target-size={targetSize}>
      <div className={styles.toolbar}>
        <span className={styles.group}>
          <span className={styles.groupLabel}>{S.tessellation.tileGroup}</span>
        </span>
        <span className={styles.hint}>{S.keyboard.tessellation}</span>
      </div>
      <p className={styles.instructions}>{S.instructions.tessellation}</p>
      <p className={styles.status} role="status" data-testid="tessellation-status">
        {status}
      </p>

      <div className={styles.panel} role="group" aria-label={S.tessellation.tileGroup}>
        {tileOptions.map((tile) => {
          const locked = tileLocked(tile);
          return (
            <button
              key={tile}
              type="button"
              className={styles.button}
              aria-pressed={state.tile === tile}
              aria-disabled={locked ? 'true' : undefined}
              disabled={readOnly}
              onClick={() => {
                if (locked) return;
                pickTile(tile);
              }}
            >
              {S.tessellation.tiles[tile] ?? tile}
            </button>
          );
        })}
        {state.placed.length > 0 && tileOptions.some(tileLocked) ? (
          <span className={styles.badge}>{S.tessellation.otherFamily}</span>
        ) : null}
      </div>

      <div className={styles.canvasArea}>
        <svg
          ref={svgRef}
          className={styles.canvas}
          viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`}
          role="group"
          aria-label={S.canvasLabel.tessellation}
          tabIndex={readOnly ? -1 : 0}
          data-testid="transform-canvas"
          data-motion="full"
          data-cpa={cpa}
          style={{ touchAction: 'none' }}
          onKeyDown={onKeyDown}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <defs>
            <pattern
              id="e10-tess-overlap"
              width="16"
              height="16"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(35)"
            >
              <rect width="16" height="16" fill="#ffe3e0" />
              <line x1="0" y1="0" x2="0" y2="16" stroke={RED} strokeWidth="4" />
            </pattern>
            <pattern id="e10-tess-gap" width="16" height="16" patternUnits="userSpaceOnUse">
              <rect width="16" height="16" fill="#fff5f4" />
              <circle cx="8" cy="8" r="3.5" fill={RED} />
            </pattern>
            <pattern
              id="e10-tess-stamp"
              width="16"
              height="16"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(-35)"
            >
              <rect width="16" height="16" fill="#fff2d8" />
              <line x1="0" y1="0" x2="0" y2="16" stroke={ORANGE} strokeWidth="3.5" />
            </pattern>
          </defs>
          <rect width={LOGICAL_WIDTH} height={LOGICAL_HEIGHT} fill={PAPER} />
          {family === 'square' ? (
            <>
              <rect
                data-frame
                x={rect.x}
                y={rect.y}
                width={rect.width}
                height={rect.height}
                fill="#ffffff"
                stroke="#7a8497"
                strokeWidth={3}
              />
              <g stroke={GRID} strokeWidth={1.1} strokeOpacity={0.7} pointerEvents="none">
                {Array.from({ length: SQUARE_FRAME + 1 }, (_, index) => (
                  <line
                    key={`v-${index}`}
                    x1={rect.x + index * rect.cell}
                    y1={rect.y}
                    x2={rect.x + index * rect.cell}
                    y2={rect.y + rect.height}
                  />
                ))}
                {Array.from({ length: SQUARE_FRAME + 1 }, (_, index) => (
                  <line
                    key={`h-${index}`}
                    x1={rect.x}
                    y1={rect.y + index * rect.cell}
                    x2={rect.x + rect.width}
                    y2={rect.y + index * rect.cell}
                  />
                ))}
              </g>
              <SquareLayer
                rect={rect}
                placed={state.placed}
                stamp={state.stamp}
                checked={checked}
              />
            </>
          ) : null}
          {family === 'tri' ? (
            <>
              <g data-frame stroke="#aab4c6" strokeWidth={0.8} pointerEvents="none">
                {Array.from({ length: TRI_FRAME_ROWS }, (_, b) => {
                  const start = -Math.floor(b / 2);
                  return Array.from({ length: TRI_FRAME_WIDTH }, (_, offset) => {
                    const a = start + offset;
                    const up = triCellPoints([3 * a + 1, 3 * b + 1]);
                    const down = triCellPoints([3 * a + 2, 3 * b + 2]);
                    return (
                      <g key={`frame-${a}-${b}`}>
                        {up ? (
                          <polygon
                            points={triPointsToString(TRI_BOARD, up)}
                            fill="#ffffff"
                            stroke="#d7deea"
                            strokeWidth={0.8}
                          />
                        ) : null}
                        {down ? (
                          <polygon
                            points={triPointsToString(TRI_BOARD, down)}
                            fill="#ffffff"
                            stroke="#d7deea"
                            strokeWidth={0.8}
                          />
                        ) : null}
                      </g>
                    );
                  });
                })}
              </g>
              <TriLayer
                rect={TRI_BOARD}
                placed={state.placed}
                stamp={state.stamp}
                checked={checked}
              />
            </>
          ) : null}
          {family === 'free' ? (
            <PentagonLayer hub={state.hub} gapCheck={state.settings.gapCheck} />
          ) : null}
        </svg>
      </div>

      <div className={styles.panel} role="group" aria-label={S.name}>
        {family !== 'free' ? (
          <>
            <section className={styles.panelGroup}>
              <span className={styles.panelLabel}>{S.panel.slideGroup}</span>
              <div className={styles.directionRow}>
                {(['up', 'down', 'left', 'right'] as const).map((side) => (
                  <button
                    key={side}
                    type="button"
                    className={styles.button}
                    disabled={readOnly}
                    onClick={() => {
                      if (family === 'square') {
                        dispatch({
                          type: 'move',
                          move: {
                            kind: 'slide',
                            dx: side === 'left' ? -cells : side === 'right' ? cells : 0,
                            dy: side === 'up' ? -cells : side === 'down' ? cells : 0,
                          },
                        });
                      } else {
                        const dx = side === 'left' ? -1 : side === 'right' ? 1 : 0;
                        const dy = side === 'down' ? 1 : side === 'up' ? -1 : 0;
                        dispatch({ type: 'move', move: { kind: 'slide', dx, dy } });
                      }
                    }}
                  >
                    {S.sides[side]}
                  </button>
                ))}
                {family === 'square' ? (
                  <label className={styles.field}>
                    <span>{S.tessellation.cells}</span>
                    <input
                      className={styles.input}
                      type="number"
                      min={1}
                      max={12}
                      value={cells}
                      disabled={readOnly}
                      onChange={(event) => {
                        const next = Number(event.target.value);
                        if (!Number.isFinite(next)) return;
                        setCells(Math.min(12, Math.max(1, Math.round(next))));
                      }}
                    />
                  </label>
                ) : null}
                {family === 'tri' ? (
                  <>
                    <button
                      type="button"
                      className={styles.button}
                      disabled={readOnly}
                      onClick={() =>
                        dispatch({ type: 'move', move: { kind: 'slide', dx: -1, dy: 1 } })
                      }
                    >
                      {S.tessellation.diagonalSw}
                    </button>
                    <button
                      type="button"
                      className={styles.button}
                      disabled={readOnly}
                      onClick={() =>
                        dispatch({ type: 'move', move: { kind: 'slide', dx: 1, dy: -1 } })
                      }
                    >
                      {S.tessellation.diagonalNe}
                    </button>
                  </>
                ) : null}
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
                    onClick={() => dispatch({ type: 'move', move: { kind: 'flip', side } })}
                  >
                    {S.sides[side]}
                  </button>
                ))}
              </div>
            </section>
            <section className={styles.panelGroup}>
              <span className={styles.panelLabel}>{S.panel.turnGroup}</span>
              <div className={styles.directionRow}>
                <button
                  type="button"
                  className={styles.button}
                  disabled={readOnly}
                  onClick={() =>
                    dispatch({
                      type: 'move',
                      move: {
                        kind: 'turn',
                        direction: 'cw',
                        angle: family === 'square' ? 90 : 60,
                        center: centerPoint,
                      },
                    })
                  }
                >
                  {S.turnDirections.cw}
                </button>
                <button
                  type="button"
                  className={styles.button}
                  disabled={readOnly}
                  onClick={() =>
                    dispatch({
                      type: 'move',
                      move: {
                        kind: 'turn',
                        direction: 'ccw',
                        angle: family === 'square' ? 90 : 60,
                        center: centerPoint,
                      },
                    })
                  }
                >
                  {S.turnDirections.ccw}
                </button>
                <button
                  type="button"
                  className={styles.button}
                  disabled={readOnly}
                  onClick={() => {
                    const length = state.stamp.outline.length;
                    if (length === 0) return;
                    dispatch({ type: 'select-center', index: (state.center + 1) % length });
                  }}
                >
                  {S.panel.turnCenter}
                </button>
              </div>
            </section>
          </>
        ) : (
          <section className={styles.panelGroup} aria-label={S.tessellation.hubTitle}>
            <span className={styles.panelLabel}>{S.tessellation.hubTitle}</span>
            <div className={styles.directionRow}>
              <button
                type="button"
                className={styles.button}
                disabled={readOnly}
                onClick={() => dispatch({ type: 'hub-add' })}
              >
                {S.tessellation.hubAdd}
              </button>
              <button
                type="button"
                className={styles.button}
                disabled={readOnly}
                onClick={() => dispatch({ type: 'hub-remove' })}
              >
                {S.tessellation.hubRemove}
              </button>
            </div>
          </section>
        )}
        <section className={styles.panelGroup}>
          <span className={styles.panelLabel}>{S.panel.moveListTitle}</span>
          <div className={styles.directionRow}>
            <button
              type="button"
              className={styles.button}
              disabled={readOnly}
              onClick={() => dispatch({ type: 'place' })}
            >
              {S.tessellation.place}
            </button>
            <button
              type="button"
              className={styles.button}
              disabled={readOnly || state.placed.length === 0}
              onClick={() => dispatch({ type: 'remove-last' })}
            >
              {S.tessellation.removeLast}
            </button>
            <button
              type="button"
              className={styles.button}
              disabled={readOnly || (state.placed.length === 0 && state.movesUsed.length === 0)}
              onClick={() => dispatch({ type: 'clear-tiles' })}
            >
              {S.tessellation.clearAll}
            </button>
            {state.settings.gapCheck ? (
              <button
                type="button"
                className={styles.button}
                disabled={readOnly}
                onClick={() => dispatch({ type: 'check-gaps' })}
              >
                {S.tessellation.checkGaps}
              </button>
            ) : null}
          </div>
        </section>
      </div>

      {state.settings.customize === 'edge-translate' ? (
        <TileEditor customCells={state.customCells} dispatch={dispatch} readOnly={readOnly} />
      ) : null}
    </div>
  );
}
