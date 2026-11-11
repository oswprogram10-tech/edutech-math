/**
 * tangram 화면.
 *
 * - 조각을 끌면 자석 스냅 뒤 `place-piece`다.
 * - 두 번 탭(350ms 안, 움직임 없음)하면 `turn-piece`다.
 * - 키보드는 방향키(1/2칸 + 0.3칸 스냅) · R(돌리기) · F(뒤집기) ·
 *   Enter/Space(조각 고르기 과제에서만 toggle-select)다.
 * - 패턴 블록 쟁반 더미는 Enter로 `add-piece`, Delete로 `remove-piece`다.
 *
 * 조각 이름·꼭짓점 수·실루엣 정답 배치는 화면에 쓰지 않는다.
 */
import { useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import {
  isTapGesture,
  minTouchRadius,
  pointerToLogical,
  svgScaleFactor,
  useRenderedSize,
} from '../../../core/engine-sdk';
import type { EngineViewProps, Point } from '../../../core/engine-sdk';
import {
  PIECE_COLORS,
  pieceVertices,
  TANGRAM_CELL,
  TANGRAM_COLS,
  TANGRAM_ORIGIN,
  TANGRAM_ROWS,
} from '../tangram/pieces';
import type { PieceSet } from '../tangram/pieces';
import { SilhouetteDecor } from '../tangram/decor';
import { analyzeTangram, tangramPiecePolygons } from '../tangram/observe';
import { silhouettePartPolygons } from '../tangram/silhouettes';
import { KEYBOARD_SNAP_TOLERANCE, snapPiece, snapToleranceUnits } from '../tangram/snap';
import { sFromJson, sToNumber, sToJson } from '../tangram/surd';
import type { Surd, SurdD } from '../tangram/surd';
import type { SPoint } from '../tangram/surd-geometry';
import { patternSpawnPoint, traySlots } from '../tangram/tray';
import type { SPointJson, TangramPiece, TangramState } from '../tangram/types';
import { cutStrings as S } from '../strings.ko';
import type { CutAction, CutConfig } from '../types';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import styles from '../View.module.css';

const LOGICAL = { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT };
const PAPER = '#fbfaf6';
const INK = '#1d2330';
const GRID = '#d4dbe8';
const SILHOUETTE = '#343c49';
const TRAY_LEFT = 18;
const TAP_MS = 350;

type TangramViewProps = EngineViewProps<CutConfig, TangramState, CutAction>;

type Drag =
  | {
      readonly kind: 'piece';
      readonly pointerId: number;
      readonly piece: string;
      readonly start: Point;
      readonly startAt: Point;
    }
  | {
      readonly kind: 'tray';
      readonly pointerId: number;
      readonly pieceKind: string;
      readonly start: Point;
    }
  | null;

function screenOf(point: SPoint): Point {
  return {
    x: TANGRAM_ORIGIN.x + sToNumber(point.x) * TANGRAM_CELL,
    y: TANGRAM_ORIGIN.y + sToNumber(point.y) * TANGRAM_CELL,
  };
}

function pointAttribute(point: { readonly x: number; readonly y: number }): string {
  return `${point.x.toFixed(3)},${point.y.toFixed(3)}`;
}

function pointsAttribute(points: readonly Point[]): string {
  return points.map(pointAttribute).join(' ');
}

function atOf(piece: TangramPiece, d: SurdD): SPoint | null {
  try {
    return {
      x: sFromJson(piece.at[0], d),
      y: sFromJson(piece.at[1], d),
    };
  } catch {
    return null;
  }
}

function atNumber(point: SPoint): Point {
  return { x: sToNumber(point.x), y: sToNumber(point.y) };
}

function jsonOf(point: { readonly x: number; readonly y: number }, d: SurdD): SPointJson {
  const x: Surd = sFromJson([point.x.toFixed(6), '0'], d);
  const y: Surd = sFromJson([point.y.toFixed(6), '0'], d);
  return [sToJson(x), sToJson(y)];
}

function colorOf(index: number): string {
  return PIECE_COLORS[index % PIECE_COLORS.length] ?? PIECE_COLORS[0];
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function TangramView({
  state,
  dispatch,
  cpa,
  readOnly = false,
  targetSize,
}: TangramViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const rendered = useRenderedSize(svgRef);
  const hitRadius = Math.max(16, Math.ceil(minTouchRadius(targetSize, rendered, LOGICAL)));
  const scale = svgScaleFactor(rendered, LOGICAL);
  const colored = cpa !== 'P';

  const [status, setStatus] = useState('');
  const [lastTouched, setLastTouched] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    readonly piece: string;
    readonly dx: number;
    readonly dy: number;
  } | null>(null);
  const dragRef = useRef<Drag>(null);
  const lastTap = useRef<{ readonly piece: string; readonly at: number } | null>(null);

  const d = state.settings.d;
  const step = state.settings.rotationStep;
  const set = state.settings.pieceSet;
  const analysis = analyzeTangram(state);
  const filled = analysis.filled;
  const polygons = tangramPiecePolygons(state);
  const silhouetteParts = silhouettePartPolygons(set, state.settings.silhouette).map((part) =>
    part.map(screenOf),
  );
  const silhouettePoints = silhouetteParts.flat();
  const silhouetteId = state.settings.silhouette;
  const patterns = set === 'pattern-blocks' ? traySlots('pattern-blocks') : [];

  const pieceCenter = (piece: TangramPiece): Point | null => {
    const polygon = polygons.get(piece.id);
    if (!polygon || polygon.length === 0) return null;
    const points = polygon.map(screenOf);
    const x = points.reduce((sum, point) => sum + point.x, 0) / points.length;
    const y = points.reduce((sum, point) => sum + point.y, 0) / points.length;
    return { x, y };
  };

  const pieceAt = (point: Point): TangramPiece | null => {
    let best: TangramPiece | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let index = state.pieces.length - 1; index >= 0; index -= 1) {
      const piece = state.pieces[index];
      if (!piece) continue;
      const polygon = polygons.get(piece.id);
      if (!polygon) continue;
      const screen = polygon.map(screenOf);
      const center = pieceCenter(piece);
      if (!center) continue;
      const inside =
        screen.length >= 3 &&
        (() => {
          let result = false;
          for (
            let edge = 0, previous = screen.length - 1;
            edge < screen.length;
            previous = edge, edge += 1
          ) {
            const a = screen[edge];
            const b = screen[previous];
            if (!a || !b) continue;
            if (a.y > point.y !== b.y > point.y) {
              const x = ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
              if (point.x < x) result = !result;
            }
          }
          return result;
        })();
      const offset = inside ? 0 : distance(point, center);
      if ((inside || offset <= hitRadius) && offset < bestDistance) {
        best = piece;
        bestDistance = offset;
      }
    }
    return best;
  };

  const trayPieceAt = (point: Point): { readonly kind: string; readonly center: Point } | null => {
    if (set !== 'pattern-blocks') return null;
    for (const slot of patterns) {
      const vertices = pieceVertices(set, slot.kind, slot.at, 0, false, step).map(screenOf);
      if (vertices.length < 3) continue;
      const center = {
        x: vertices.reduce((sum, vertex) => sum + vertex.x, 0) / vertices.length,
        y: vertices.reduce((sum, vertex) => sum + vertex.y, 0) / vertices.length,
      };
      if (distance(point, center) <= hitRadius + 8) {
        return { kind: slot.kind, center };
      }
    }
    return null;
  };

  const selectPiece = (piece: TangramPiece, sourceIndex: number): void => {
    setLastTouched(piece.id);
    if (!state.settings.selectMode) return;
    const selected = state.selected.includes(piece.id);
    dispatch({ type: 'toggle-select', piece: piece.id });
    setStatus(
      selected ? S.tangram.unselected(sourceIndex + 1) : S.tangram.selected(sourceIndex + 1),
    );
  };

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (readOnly) return;
    const point = pointerToLogical(event, svgRef.current, LOGICAL);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // jsdom·이미 끝난 포인터.
    }

    if (set === 'pattern-blocks') {
      const trayPiece = trayPieceAt(point);
      if (trayPiece) {
        dragRef.current = {
          kind: 'tray',
          pointerId: event.pointerId,
          pieceKind: trayPiece.kind,
          start: point,
        };
        return;
      }
    }

    const piece = pieceAt(point);
    if (!piece) return;
    const at = atOf(piece, d);
    if (!at) return;
    setLastTouched(piece.id);
    dragRef.current = {
      kind: 'piece',
      pointerId: event.pointerId,
      piece: piece.id,
      start: point,
      startAt: atNumber(at),
    };
  };

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.kind !== 'piece') return;
    const point = pointerToLogical(event, svgRef.current, LOGICAL);
    setPreview({
      piece: drag.piece,
      dx: point.x - drag.start.x,
      dy: point.y - drag.start.y,
    });
  };

  const onPointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag || readOnly || drag.pointerId !== event.pointerId) return;
    const point = pointerToLogical(event, svgRef.current, LOGICAL);
    setPreview(null);

    if (drag.kind === 'tray') {
      const moved = distance(point, drag.start) > 8;
      const grid = moved
        ? {
            x: (point.x - TANGRAM_ORIGIN.x) / TANGRAM_CELL,
            y: (point.y - TANGRAM_ORIGIN.y) / TANGRAM_CELL,
          }
        : atNumber(patternSpawnPoint());
      dispatch({ type: 'add-piece', kind: drag.pieceKind, at: jsonOf(grid, d) });
      setStatus('');
      return;
    }

    const moved = !isTapGesture([drag.start, point], 8);
    if (!moved) {
      const now = Date.now();
      const previous = lastTap.current;
      const piece = state.pieces.find((candidate) => candidate.id === drag.piece);
      if (!piece) return;
      if (previous && previous.piece === drag.piece && now - previous.at < TAP_MS) {
        dispatch({ type: 'turn-piece', piece: drag.piece });
        lastTap.current = null;
        setStatus('');
        return;
      }
      lastTap.current = { piece: drag.piece, at: now };
      const index = state.pieces.findIndex((candidate) => candidate.id === drag.piece);
      selectPiece(piece, index < 0 ? 0 : index);
      return;
    }

    const raw = {
      x: drag.startAt.x + (point.x - drag.start.x) / TANGRAM_CELL,
      y: drag.startAt.y + (point.y - drag.start.y) / TANGRAM_CELL,
    };
    const tolerance = snapToleranceUnits(state.settings.snapTolerancePx, Math.max(scale, 0.05));
    dispatch({
      type: 'place-piece',
      piece: drag.piece,
      at: snapPiece(state, drag.piece, raw, tolerance),
    });
    setStatus('');
  };

  const onPieceKeyDown = (
    event: ReactKeyboardEvent<SVGGElement>,
    piece: TangramPiece,
    index: number,
  ): void => {
    if (readOnly) return;
    const key = event.key;
    if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight') {
      event.preventDefault();
      event.stopPropagation();
      const at = atOf(piece, d);
      if (!at) return;
      const current = atNumber(at);
      const dx = key === 'ArrowLeft' ? -0.5 : key === 'ArrowRight' ? 0.5 : 0;
      const dy = key === 'ArrowUp' ? -0.5 : key === 'ArrowDown' ? 0.5 : 0;
      const raw = { x: current.x + dx, y: current.y + dy };
      dispatch({
        type: 'place-piece',
        piece: piece.id,
        at: snapPiece(state, piece.id, raw, KEYBOARD_SNAP_TOLERANCE),
      });
      setLastTouched(piece.id);
      setStatus('');
      return;
    }
    if (key === 'r' || key === 'R') {
      event.preventDefault();
      event.stopPropagation();
      dispatch({ type: 'turn-piece', piece: piece.id });
      setLastTouched(piece.id);
      setStatus('');
      return;
    }
    if (key === 'f' || key === 'F') {
      event.preventDefault();
      event.stopPropagation();
      dispatch({ type: 'flip-piece', piece: piece.id });
      setLastTouched(piece.id);
      setStatus('');
      return;
    }
    if (key === 'Delete' || key === 'Backspace') {
      if (set !== 'pattern-blocks') return;
      event.preventDefault();
      event.stopPropagation();
      dispatch({ type: 'remove-piece', piece: piece.id });
      setStatus('');
      return;
    }
    if (key === 'Enter' || key === ' ' || key === 'Spacebar') {
      event.preventDefault();
      event.stopPropagation();
      selectPiece(piece, index);
    }
  };

  const onTrayKeyDown = (event: ReactKeyboardEvent<SVGGElement>, kind: string): void => {
    if (readOnly) return;
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      event.stopPropagation();
      dispatch({ type: 'add-piece', kind, at: jsonOf(atNumber(patternSpawnPoint()), d) });
      setStatus('');
      return;
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      event.stopPropagation();
      const last = state.pieces[state.pieces.length - 1];
      if (last) dispatch({ type: 'remove-piece', piece: last.id });
      setStatus('');
    }
  };

  const moveLast = (): TangramPiece | null => {
    const piece = state.pieces.find((candidate) => candidate.id === lastTouched) ?? null;
    if (!piece) setStatus(S.tangram.needPiece);
    return piece;
  };

  const trayLabel = (index: number): string => S.tangram.trayPiece(index + 1);

  const toolbarStatus = filled ? S.tangram.filled : status;

  return (
    <div className={styles.wrap} data-target-size={targetSize}>
      <div className={styles.toolbar}>
        <button
          type="button"
          className={styles.button}
          onClick={() => {
            const piece = moveLast();
            if (!piece) return;
            dispatch({ type: 'turn-piece', piece: piece.id });
            setStatus('');
          }}
          disabled={readOnly}
        >
          {S.tangram.turn}
        </button>
        <button
          type="button"
          className={styles.button}
          onClick={() => {
            const piece = moveLast();
            if (!piece) return;
            dispatch({ type: 'flip-piece', piece: piece.id });
            setStatus('');
          }}
          disabled={readOnly || !state.settings.allowFlip}
        >
          {S.tangram.flip}
        </button>
        <span className={styles.hint}>
          {state.settings.selectMode ? S.tangram.fixedHint : S.tangram.hint}
        </span>
      </div>

      <p className={styles.instructions}>{S.instructions.tangram}</p>
      <p className={styles.status} role="status" data-testid="tangram-status">
        {toolbarStatus}
      </p>

      <div className={styles.boardArea}>
        <svg
          ref={svgRef}
          className={styles.canvas}
          viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`}
          role="group"
          aria-label={S.canvasLabel.tangram}
          tabIndex={readOnly ? -1 : 0}
          data-testid="cut-canvas"
          data-cpa={cpa}
          data-piece-set={set}
          data-filled={filled ? 'true' : 'false'}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            dragRef.current = null;
            setPreview(null);
          }}
        >
          <rect width={LOGICAL_WIDTH} height={LOGICAL_HEIGHT} fill={PAPER} />

          <g pointerEvents="none" stroke={GRID} strokeWidth={1} strokeOpacity={0.45}>
            {Array.from({ length: TANGRAM_COLS + 1 }, (_, index) => {
              const x = TANGRAM_ORIGIN.x + index * TANGRAM_CELL;
              return (
                <line
                  key={`tangram-grid-x-${index}`}
                  x1={x}
                  y1={TANGRAM_ORIGIN.y}
                  x2={x}
                  y2={TANGRAM_ORIGIN.y + TANGRAM_ROWS * TANGRAM_CELL}
                />
              );
            })}
            {Array.from({ length: TANGRAM_ROWS + 1 }, (_, index) => {
              const y = TANGRAM_ORIGIN.y + index * TANGRAM_CELL;
              return (
                <line
                  key={`tangram-grid-y-${index}`}
                  x1={TANGRAM_ORIGIN.x}
                  y1={y}
                  x2={TANGRAM_ORIGIN.x + TANGRAM_COLS * TANGRAM_CELL}
                  y2={y}
                />
              );
            })}
          </g>

          <g pointerEvents="none">
            <rect
              x={TANGRAM_ORIGIN.x + TRAY_LEFT * TANGRAM_CELL - 14}
              y={TANGRAM_ORIGIN.y - 14}
              width={(TANGRAM_COLS - TRAY_LEFT) * TANGRAM_CELL + 14}
              height={TANGRAM_ROWS * TANGRAM_CELL + 14}
              rx={16}
              fill="#eef2f9"
              stroke="#c9d2e2"
              strokeWidth={2}
            />
            <text
              x={TANGRAM_ORIGIN.x + TRAY_LEFT * TANGRAM_CELL}
              y={TANGRAM_ORIGIN.y + 14}
              fontSize={15}
              fontWeight={700}
              fill="#5a6478"
            >
              {S.tangram.tray}
            </text>
          </g>

          {silhouetteParts.length > 0 ? (
            <g pointerEvents="none">
              {silhouetteParts.map((part, index) => (
                <polygon
                  key={`silhouette-part-${index}`}
                  points={pointsAttribute(part)}
                  fill={SILHOUETTE}
                  fillOpacity={0.92}
                  stroke={SILHOUETTE}
                  strokeWidth={2}
                  strokeLinejoin="round"
                />
              ))}
              {state.settings.showPieceOutlines
                ? silhouetteParts.map((part, index) => (
                    <polygon
                      key={`silhouette-outline-${index}`}
                      points={pointsAttribute(part)}
                      fill="none"
                      stroke="#ffffff"
                      strokeOpacity={0.9}
                      strokeWidth={2}
                      strokeDasharray="7 5"
                      strokeLinejoin="round"
                    />
                  ))
                : null}
            </g>
          ) : null}

          {state.pieces.map((piece, index) => {
            const polygon = polygons.get(piece.id);
            if (!polygon || polygon.length < 3) return null;
            const points = polygon.map(screenOf);
            const at = atOf(piece, d);
            const atPoint = at ? atNumber(at) : { x: 0, y: 0 };
            const color = filled ? '#b5651d' : colorOf(index);
            const center = pieceCenter(piece);
            const selected = state.selected.includes(piece.id);
            const previewing = preview?.piece === piece.id ? preview : null;
            return (
              <g
                key={piece.id}
                className={styles.piece}
                role="button"
                tabIndex={readOnly ? -1 : 0}
                aria-label={S.pieceLabel(index + 1)}
                data-piece={piece.id}
                data-ax={atPoint.x.toFixed(3)}
                data-ay={atPoint.y.toFixed(3)}
                data-rot={piece.rot * step}
                data-flip={piece.flip ? 'true' : 'false'}
                data-selected={selected ? 'true' : 'false'}
                transform={
                  previewing
                    ? `translate(${previewing.dx.toFixed(2)} ${previewing.dy.toFixed(2)})`
                    : undefined
                }
                onFocus={() => setLastTouched(piece.id)}
                onKeyDown={(event) => onPieceKeyDown(event, piece, index)}
              >
                <polygon
                  points={pointsAttribute(points)}
                  fill={colored || filled ? color : '#ffffff'}
                  fillOpacity={filled ? 0.98 : colored ? 0.22 : 1}
                  stroke={filled ? '#7a3f14' : colored ? color : INK}
                  strokeWidth={selected ? 5 : 3}
                  strokeDasharray={selected ? '10 6' : undefined}
                  strokeLinejoin="round"
                  pointerEvents="none"
                />
                {center ? (
                  <circle
                    cx={center.x}
                    cy={center.y}
                    r={hitRadius}
                    fill="transparent"
                    data-hit-target="true"
                    pointerEvents="none"
                  />
                ) : null}
                <text
                  x={center?.x ?? 0}
                  y={(center?.y ?? 0) + 6}
                  textAnchor="middle"
                  fontSize={20}
                  fontWeight={700}
                  fill={filled ? '#fff7e8' : INK}
                  pointerEvents="none"
                >
                  {S.pieceNumber(index + 1)}
                </text>
              </g>
            );
          })}

          {set === 'pattern-blocks'
            ? patterns.map((slot, index) => {
                const polygon = pieceVertices(set, slot.kind, slot.at, 0, false, step).map(
                  screenOf,
                );
                if (polygon.length < 3) return null;
                const center = {
                  x: polygon.reduce((sum, point) => sum + point.x, 0) / polygon.length,
                  y: polygon.reduce((sum, point) => sum + point.y, 0) / polygon.length,
                };
                return (
                  <g
                    key={`tray-${slot.kind}-${index}`}
                    role="button"
                    tabIndex={readOnly ? -1 : 0}
                    aria-label={trayLabel(index)}
                    onKeyDown={(event) => onTrayKeyDown(event, slot.kind)}
                  >
                    <polygon
                      points={pointsAttribute(polygon)}
                      fill={colorOf(index)}
                      fillOpacity={0.18}
                      stroke={colorOf(index)}
                      strokeWidth={2.5}
                      strokeLinejoin="round"
                      pointerEvents="none"
                    />
                    <circle
                      cx={center.x}
                      cy={center.y}
                      r={hitRadius}
                      fill="transparent"
                      pointerEvents="none"
                    />
                    <text
                      x={center.x}
                      y={center.y + 5}
                      textAnchor="middle"
                      fontSize={14}
                      fontWeight={700}
                      fill={INK}
                      pointerEvents="none"
                    >
                      +
                    </text>
                  </g>
                );
              })
            : null}

          {filled ? (
            <SilhouetteDecor
              pieceSet={set as PieceSet}
              silhouette={silhouetteId}
              points={silhouettePoints}
            />
          ) : null}
        </svg>
      </div>

      <p className={styles.hint}>{set === 'pattern-blocks' ? S.tangram.addHint : S.tangram.hint}</p>
    </div>
  );
}
