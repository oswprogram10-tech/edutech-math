/**
 * slice·formula-derive 화면.
 *
 * - 옮기기: 조각을 끌면 자석 스냅 뒤 `move-piece`.
 * - 가위: 자를 점 두 개를 차례로 누르면 `cut`. 키보드는 C → ←/→ → Enter 두 번.
 * - 경첩: 조각을 고른 뒤 경첩 점을 누르면 `hinge`. 키보드는 H → ←/→ → Enter.
 * - 돌리기·복제: 조각을 누르면 `rotate-piece`/`duplicate`.
 *
 * 정답 도형 이름·넓이·각도는 화면에 쓰지 않는다. Observation에만 있다.
 */
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { minTouchRadius, pointerToLogical, useRenderedSize } from '../../../core/engine-sdk';
import type { EngineViewProps, Point } from '../../../core/engine-sdk';
import { sameRPoint } from '../rpoint';
import type { RPoint } from '../rpoint';
import { unitCoverBox } from '../pieces/outline';
import { cutCandidates, hingeCandidates } from '../pieces/candidates';
import { snapTranslation } from '../pieces/snap';
import { cutStrings as S } from '../strings.ko';
import type { CutAction, CutConfig } from '../types';
import {
  boardGridLines,
  boardPoint,
  boardPoints,
  centroid,
  nearestCandidateIndex,
  pieceAtPoint,
  pointsAttribute,
  unitCoverLines,
  unitCoverRect,
} from '../layout';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import type { Piece, PieceTool, PiecesState } from '../pieces/types';
import styles from '../View.module.css';

const LOGICAL = { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT };
const PAPER = '#fbfaf6';
const INK = '#1d2330';
const GRID = '#c9d2e2';
const ORANGE = '#e8872e';

const PALETTE = ['#2f6fde', '#c2410c', '#2f9e6b', '#7c3aed'] as const;

type PiecesViewProps = EngineViewProps<CutConfig, PiecesState, CutAction>;

type Drag =
  | {
      readonly kind: 'move';
      readonly pointerId: number;
      readonly piece: string;
      readonly start: Point;
    }
  | {
      readonly kind: 'cut';
      readonly pointerId: number;
      readonly piece: string;
      readonly from: RPoint;
    }
  | null;

function patternKind(index: number): 'plain' | 'hatch' | 'dots' {
  const remainder = index % 3;
  if (remainder === 1) return 'hatch';
  if (remainder === 2) return 'dots';
  return 'plain';
}

function patternId(index: number): string {
  return `cut-piece-pattern-${index}`;
}

function colorOf(index: number): string {
  return PALETTE[index % PALETTE.length] ?? PALETTE[0];
}

export function PiecesView({
  state,
  dispatch,
  cpa,
  readOnly = false,
  targetSize,
}: PiecesViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const rendered = useRenderedSize(svgRef);
  const hitRadius = Math.max(16, Math.ceil(minTouchRadius(targetSize, rendered, LOGICAL)));
  const colored = cpa !== 'P';

  const [tool, setTool] = useState<PieceTool>('move');
  const [cutTarget, setCutTarget] = useState<string | null>(null);
  const [cutIndex, setCutIndex] = useState(0);
  const [cutStart, setCutStart] = useState<RPoint | null>(null);
  const [hingeTarget, setHingeTarget] = useState<string | null>(null);
  const [hingeIndex, setHingeIndex] = useState(0);
  const [status, setStatus] = useState('');
  const [animating, setAnimating] = useState<string | null>(null);
  const dragRef = useRef<Drag>(null);

  const activeTool: PieceTool =
    tool === 'move' || state.settings.tools.includes(tool) ? tool : 'move';

  const cutPiece = state.pieces.find((piece) => piece.id === cutTarget) ?? null;
  const cutList = cutPiece ? cutCandidates(cutPiece) : [];
  const cutCursor = cutList.length > 0 ? (cutList[cutIndex % cutList.length] ?? null) : null;

  const hingePiece = state.pieces.find((piece) => piece.id === hingeTarget) ?? null;
  const hingeList = hingePiece ? hingeCandidates(hingePiece) : [];
  const hingeCursor =
    hingeList.length > 0 ? (hingeList[hingeIndex % hingeList.length] ?? null) : null;

  const lastCuts = useRef(state.cuts);

  useEffect(() => {
    if (state.cuts === lastCuts.current) return;
    lastCuts.current = state.cuts;
    setCutTarget(null);
    setCutStart(null);
    setHingeTarget(null);
    setTool('move');
    setStatus('');
    svgRef.current?.focus();
  }, [state.cuts]);

  useEffect(() => {
    const hinge = state.lastHinge;
    if (!hinge) return;
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    if (reduced) return;
    // 이펙트 안에서 곧바로 setState하면 연쇄 렌더가 되므로 다음 틱에 시작한다.
    const start = window.setTimeout(() => setAnimating(hinge.piece), 0);
    const stop = window.setTimeout(() => {
      setAnimating((current) => (current === hinge.piece ? null : current));
    }, 600);
    return () => {
      window.clearTimeout(start);
      window.clearTimeout(stop);
    };
  }, [state.lastHinge]);

  const resetCursors = () => {
    setCutTarget(null);
    setCutStart(null);
    setHingeTarget(null);
    setStatus('');
  };

  const chooseTool = (next: PieceTool) => {
    if (readOnly) return;
    resetCursors();
    setTool(next);
  };

  const beginCut = (piece: Piece) => {
    if (!state.settings.tools.includes('scissors')) return;
    setTool('scissors');
    setHingeTarget(null);
    setCutTarget(piece.id);
    setCutStart(null);
    setCutIndex(0);
    setStatus(S.status.cutPick);
  };

  const beginHinge = (piece: Piece) => {
    if (!state.settings.tools.includes('hinge180')) return;
    setTool('hinge180');
    setCutTarget(null);
    setCutStart(null);
    setHingeTarget(piece.id);
    setHingeIndex(0);
    setStatus(S.status.hingeHint);
  };

  const moveBy = (piece: string, dx: number, dy: number) => {
    if (readOnly) return;
    const snapped = snapTranslation(state, piece, { x: dx, y: dy });
    if (snapped[0] === '0' && snapped[1] === '0') return;
    dispatch({ type: 'move-piece', piece, by: snapped });
  };

  const commitCut = (piece: string, from: RPoint, to: RPoint) => {
    if (sameRPoint(from, to)) return;
    dispatch({ type: 'cut', piece, from, to });
  };

  const stepCut = (delta: number) => {
    if (cutList.length === 0) return;
    setCutIndex((current) => (current + delta + cutList.length) % cutList.length);
  };

  const confirmCut = () => {
    if (!cutTarget || !cutCursor) return;
    if (!cutStart) {
      setCutStart(cutCursor);
      setStatus(S.status.cutStart);
      return;
    }
    commitCut(cutTarget, cutStart, cutCursor);
  };

  const confirmHinge = () => {
    if (!hingeTarget || !hingeCursor) return;
    dispatch({ type: 'hinge', piece: hingeTarget, at: hingeCursor });
    setHingeTarget(null);
    setTool('move');
    setStatus('');
  };

  const onCutKey = (event: ReactKeyboardEvent<SVGElement>): boolean => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      stepCut(1);
      return true;
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      stepCut(-1);
      return true;
    }
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      confirmCut();
      return true;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      resetCursors();
      setTool('move');
      return true;
    }
    return false;
  };

  const onHingeKey = (event: ReactKeyboardEvent<SVGElement>): boolean => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      if (hingeList.length > 0) {
        setHingeIndex((current) => (current + 1) % hingeList.length);
      }
      return true;
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (hingeList.length > 0) {
        setHingeIndex((current) => (current - 1 + hingeList.length) % hingeList.length);
      }
      return true;
    }
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      confirmHinge();
      return true;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      resetCursors();
      setTool('move');
      return true;
    }
    return false;
  };

  const onPieceKeyDown = (event: ReactKeyboardEvent<SVGGElement>, piece: Piece): void => {
    if (readOnly) return;
    event.stopPropagation();
    if (cutTarget === piece.id && onCutKey(event)) return;
    if (hingeTarget === piece.id && onHingeKey(event)) return;

    const key = event.key;
    if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight') {
      event.preventDefault();
      const dx = key === 'ArrowLeft' ? -1 : key === 'ArrowRight' ? 1 : 0;
      const dy = key === 'ArrowUp' ? -1 : key === 'ArrowDown' ? 1 : 0;
      moveBy(piece.id, dx, dy);
      return;
    }
    if (key === 'r' || key === 'R') {
      event.preventDefault();
      if (state.settings.tools.includes('rotate90')) {
        dispatch({ type: 'rotate-piece', piece: piece.id, turns: event.shiftKey ? -1 : 1 });
      }
      return;
    }
    if (key === 'd' || key === 'D') {
      event.preventDefault();
      if (state.settings.tools.includes('duplicate')) {
        dispatch({ type: 'duplicate', piece: piece.id });
      }
      return;
    }
    if (key === 'c' || key === 'C') {
      event.preventDefault();
      beginCut(piece);
      return;
    }
    if (key === 'h' || key === 'H') {
      event.preventDefault();
      beginHinge(piece);
    }
  };

  const onCanvasKeyDown = (event: ReactKeyboardEvent<SVGSVGElement>) => {
    if (readOnly) return;
    if (cutTarget && onCutKey(event)) return;
    if (hingeTarget && onHingeKey(event)) return;
    const key = event.key;
    if (key === 'Escape') {
      resetCursors();
      setTool('move');
      return;
    }
    if (key === 'c' || key === 'C') {
      const piece = state.pieces[0];
      if (piece) {
        event.preventDefault();
        beginCut(piece);
      }
      return;
    }
    if (key === 'h' || key === 'H') {
      const piece = state.pieces[0];
      if (piece) {
        event.preventDefault();
        beginHinge(piece);
      }
    }
  };

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (readOnly) return;
    const point = pointerToLogical(event, svgRef.current, LOGICAL);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // jsdom·이미 끝난 포인터.
    }

    if (activeTool === 'scissors' || cutTarget !== null) {
      const piece = pieceAtPoint(state.pieces, point) ?? cutPiece;
      if (!piece) return;
      const candidates = cutCandidates(piece);
      const near = nearestCandidateIndex(candidates, point, hitRadius);
      if (cutStart && cutTarget === piece.id && near !== null) {
        const target = candidates[near];
        if (target && !sameRPoint(cutStart, target)) {
          dragRef.current = {
            kind: 'cut',
            pointerId: event.pointerId,
            piece: piece.id,
            from: cutStart,
          };
          return;
        }
      }
      setTool('scissors');
      setHingeTarget(null);
      setCutTarget(piece.id);
      const index = near ?? 0;
      setCutIndex(index);
      const first = candidates[index];
      if (first) {
        setCutStart(first);
        setStatus(S.status.cutStart);
      } else {
        setCutStart(null);
        setStatus(S.status.cutPick);
      }
      return;
    }

    if (activeTool === 'hinge180' || hingeTarget !== null) {
      if (hingeTarget && hingeList.length > 0) {
        const near = nearestCandidateIndex(hingeList, point, hitRadius);
        const target = near === null ? null : hingeList[near];
        if (target) {
          dispatch({ type: 'hinge', piece: hingeTarget, at: target });
          setHingeTarget(null);
          setTool('move');
          setStatus('');
          return;
        }
      }
      const piece = pieceAtPoint(state.pieces, point);
      if (!piece) return;
      beginHinge(piece);
      return;
    }

    const piece = pieceAtPoint(state.pieces, point);
    if (!piece) return;

    if (activeTool === 'rotate90') {
      dispatch({ type: 'rotate-piece', piece: piece.id, turns: 1 });
      return;
    }
    if (activeTool === 'duplicate') {
      dispatch({ type: 'duplicate', piece: piece.id });
      return;
    }
    dragRef.current = {
      kind: 'move',
      pointerId: event.pointerId,
      piece: piece.id,
      start: point,
    };
  };

  const onPointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag || readOnly || drag.pointerId !== event.pointerId) return;
    const point = pointerToLogical(event, svgRef.current, LOGICAL);

    if (drag.kind === 'move') {
      const raw = {
        x: (point.x - drag.start.x) / 50,
        y: (point.y - drag.start.y) / 50,
      };
      if (Math.abs(raw.x) < 0.2 && Math.abs(raw.y) < 0.2) return;
      const snapped = snapTranslation(state, drag.piece, raw);
      if (snapped[0] === '0' && snapped[1] === '0') return;
      dispatch({ type: 'move-piece', piece: drag.piece, by: snapped });
      return;
    }

    const piece = state.pieces.find((candidate) => candidate.id === drag.piece);
    if (!piece) return;
    const candidates = cutCandidates(piece);
    const near = nearestCandidateIndex(candidates, point, hitRadius);
    const target = near === null ? null : candidates[near];
    if (target) {
      if (sameRPoint(target, drag.from)) {
        setCutStart(target);
        setStatus(S.status.cutStart);
        return;
      }
      commitCut(drag.piece, drag.from, target);
    }
  };

  const unitBox = state.settings.unitCover === 'after-assemble' ? unitCoverBox(state) : null;
  const unitRect = unitBox
    ? unitCoverRect(unitBox.minX, unitBox.minY, unitBox.maxX, unitBox.maxY)
    : null;

  return (
    <div className={styles.wrap} data-target-size={targetSize}>
      <div className={styles.toolbar}>
        <span className={styles.group} role="group" aria-label={S.toolbar.tools}>
          <button
            type="button"
            className={styles.button}
            aria-pressed={activeTool === 'move'}
            onClick={() => chooseTool('move')}
            disabled={readOnly}
          >
            {S.toolbar.labels.move}
          </button>
          {state.settings.tools
            .filter((candidate) => candidate !== 'move')
            .map((candidate) => (
              <button
                key={candidate}
                type="button"
                className={styles.button}
                aria-pressed={activeTool === candidate}
                onClick={() => chooseTool(candidate)}
                disabled={readOnly}
              >
                {S.toolbar.labels[candidate]}
              </button>
            ))}
        </span>
        <span className={styles.hint}>{S.canvasHint}</span>
      </div>

      <p className={styles.instructions}>{S.instructions[state.mode]}</p>
      <p className={styles.status} role="status" data-testid="cut-status">
        {status}
      </p>

      <div className={styles.boardArea}>
        <svg
          ref={svgRef}
          className={styles.canvas}
          viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`}
          role="group"
          aria-label={S.canvasLabel[state.mode]}
          tabIndex={readOnly ? -1 : 0}
          data-testid="cut-canvas"
          data-cpa={cpa}
          data-cut-cursor={cutCursor ? `${cutCursor[0]},${cutCursor[1]}` : undefined}
          data-hinge-cursor={hingeCursor ? `${hingeCursor[0]},${hingeCursor[1]}` : undefined}
          onKeyDown={onCanvasKeyDown}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            dragRef.current = null;
          }}
        >
          <defs>
            {state.pieces.map((piece, index) => {
              const color = colorOf(index);
              const kind = patternKind(index);
              return (
                <pattern
                  key={`pattern-${piece.id}`}
                  id={patternId(index)}
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
          {state.settings.grid > 0 ? (
            <g stroke={GRID} strokeWidth={1} strokeOpacity={0.55} pointerEvents="none">
              {boardGridLines().map((line, index) => (
                <line key={`grid-${index}`} x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} />
              ))}
            </g>
          ) : null}

          {unitRect ? (
            <g pointerEvents="none" data-unit-cover="true">
              <rect
                x={unitRect.x}
                y={unitRect.y}
                width={unitRect.width}
                height={unitRect.height}
                fill="none"
                stroke="#8a4b00"
                strokeWidth={2}
                strokeDasharray="8 5"
              />
              {unitCoverLines(unitRect).map((line, index) => (
                <line
                  key={`unit-${index}`}
                  x1={line.x1}
                  y1={line.y1}
                  x2={line.x2}
                  y2={line.y2}
                  stroke="#8a4b00"
                  strokeWidth={1}
                  strokeOpacity={0.5}
                />
              ))}
            </g>
          ) : null}

          {state.pieces.map((piece, index) => {
            const screen = boardPoints(piece.vertices);
            const label = S.pieceLabel(index + 1);
            const center = centroid(screen);
            const color = colorOf(index);
            const kind = colored ? patternKind(index) : 'plain';
            const animatingPiece = animating === piece.id;
            return (
              <g
                key={piece.id}
                className={styles.piece}
                role="button"
                tabIndex={readOnly ? -1 : 0}
                aria-label={label}
                data-piece={piece.id}
                data-copy={piece.copy ? 'true' : 'false'}
                data-animating={animatingPiece ? 'true' : 'false'}
                onKeyDown={(event) => onPieceKeyDown(event, piece)}
              >
                <polygon
                  points={pointsAttribute(screen)}
                  fill={colored ? color : '#ffffff'}
                  fillOpacity={colored ? 0.16 : 1}
                  stroke={colored ? color : INK}
                  strokeWidth={colored ? 3 : 2.5}
                  strokeDasharray={piece.copy ? '11 7' : undefined}
                  strokeLinejoin="round"
                  pointerEvents="none"
                />
                {colored && kind !== 'plain' ? (
                  <polygon
                    points={pointsAttribute(screen)}
                    fill={`url(#${patternId(index)})`}
                    stroke="none"
                    pointerEvents="none"
                  />
                ) : null}
                <text
                  x={center.x}
                  y={center.y + 6}
                  textAnchor="middle"
                  fontSize={20}
                  fontWeight={700}
                  fill={INK}
                  pointerEvents="none"
                >
                  {S.pieceNumber(index + 1)}
                </text>
              </g>
            );
          })}

          {cutPiece
            ? cutList.map((candidate, index) => {
                const point = boardPoint(candidate);
                const chosen = cutCursor !== null && sameRPoint(candidate, cutCursor);
                const from = cutStart !== null && sameRPoint(candidate, cutStart);
                return (
                  <g key={`cut-${index}`} pointerEvents="none" data-cut-candidate={index}>
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={chosen ? 15 : 8}
                      fill={chosen ? ORANGE : '#ffffff'}
                      fillOpacity={chosen ? 0.85 : 0.7}
                      stroke={ORANGE}
                      strokeWidth={2}
                    />
                    {from ? (
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r={22}
                        fill="none"
                        stroke="#8a4b00"
                        strokeWidth={3}
                        strokeDasharray="6 4"
                      />
                    ) : null}
                  </g>
                );
              })
            : null}

          {hingePiece
            ? hingeList.map((candidate, index) => {
                const point = boardPoint(candidate);
                const chosen = hingeCursor !== null && sameRPoint(candidate, hingeCursor);
                return (
                  <g key={`hinge-${index}`} pointerEvents="none" data-hinge-candidate={index}>
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={chosen ? 17 : 9}
                      fill={chosen ? '#7c3aed' : '#ffffff'}
                      fillOpacity={chosen ? 0.85 : 0.75}
                      stroke="#7c3aed"
                      strokeWidth={2.5}
                    />
                    <circle cx={point.x} cy={point.y} r={3} fill="#7c3aed" />
                  </g>
                );
              })
            : null}

          {cutPiece && cutStart && cutCursor ? (
            <line
              x1={boardPoint(cutStart).x}
              y1={boardPoint(cutStart).y}
              x2={boardPoint(cutCursor).x}
              y2={boardPoint(cutCursor).y}
              stroke={ORANGE}
              strokeWidth={2.5}
              strokeDasharray="9 6"
              pointerEvents="none"
              data-cut-preview="true"
            />
          ) : null}
        </svg>
      </div>

      <p className={styles.hint}>{S.canvasHint}</p>
    </div>
  );
}
