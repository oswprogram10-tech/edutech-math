/**
 * E12 각기둥 전개도 조각 판(SVG).
 *
 * - 조각은 이미 놓인 조각의 변에 하나씩 붙인다. 붙일 수 있는 변에는 48px 이상 "+" 손잡이를 단다.
 * - 칸 크기는 조각 배치 경계 상자가 판에 들어오게 정한다(24~56px, 넘치면 더 줄인다).
 * - 어느 자리로 가는지, 왜 접히지 않는지는 그리지 않는다. 문제 조각에 빗금만 칠한다(접은 뒤).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { edgeMidAndNormal, layoutPieces, polygonCenter } from '../prismnet/layout';
import { pieceEdgeCount } from '../prismnet/model';
import { canAttach, canRemovePiece } from '../prismnet/reduce';
import { baseMarkerPoints, fitPlaced, pieceStyle, pointsAttr, toScreen } from '../prismnet/visuals';
import { solid3dStrings as S } from '../strings.ko';
import type { PrismNetAction, PrismNetState } from '../types';
import styles from '../View.module.css';
import { HatchPattern } from './PrismNetMini';

const FALLBACK_W = 520;
const FALLBACK_H = 380;
const HANDLE_R = 24;
const HANDLE_GAP = 30;
const MAX_CELL = 56;
const MIN_CELL_GUARD = 8;
const HATCH_ID = 'e12-prismnet-hatch-board';

interface PrismNetBoardProps {
  readonly state: PrismNetState;
  readonly readOnly: boolean;
  readonly selectedId: number | null;
  /** 접은 뒤 문제 조각에 빗금을 칠할 조각 배열 번호. 없으면 칠하지 않는다. */
  readonly problemIndices: ReadonlySet<number>;
  readonly dispatch: (action: PrismNetAction) => void;
  readonly onSelect: (id: number | null) => void;
  readonly onLiveMessage: (msg: string) => void;
}

function PlusMark({ cx, cy, r }: { readonly cx: number; readonly cy: number; readonly r: number }) {
  return (
    <g aria-hidden="true" stroke="#1d4fa8" strokeWidth={3.4} strokeLinecap="round">
      <line x1={cx - r} y1={cy} x2={cx + r} y2={cy} />
      <line x1={cx} y1={cy - r} x2={cx} y2={cy + r} />
    </g>
  );
}

export function PrismNetBoard({
  state,
  readOnly,
  selectedId,
  problemIndices,
  dispatch,
  onSelect,
  onLiveMessage,
}: PrismNetBoardProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<{ readonly w: number; readonly h: number }>({
    w: FALLBACK_W,
    h: FALLBACK_H,
  });
  const { settings, pieces } = state;
  const interactive = !readOnly && settings.editable;

  useEffect(() => {
    const el = hostRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const measure = () => {
      // 소수점 반올림 때문에 판이 칸을 1px도 넘지 않게 한다.
      const w = el.clientWidth - 1;
      const h = el.clientHeight - 1;
      if (w < 120 || h < 120) return;
      setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const placed = useMemo(
    () =>
      layoutPieces(
        pieces.map((p) => ({
          id: p.id,
          type: p.type,
          parent: p.parent,
          parentEdge: p.parentEdge,
          edge: p.edge,
        })),
        settings.n,
        settings.sideLen,
        settings.height,
      ),
    [pieces, settings.n, settings.sideLen, settings.height],
  );

  const showHandles = interactive && state.selectedType !== null && !state.folded;
  const reserve = showHandles ? HANDLE_R + HANDLE_GAP * 0.6 : 12;
  const maxCell = MAX_CELL;
  const fit = fitPlaced(placed, size.w, size.h, reserve + 6, maxCell, MIN_CELL_GUARD);

  const screenOf = (idx: number) => {
    const piece = placed[idx];
    return piece ? piece.points.map((p) => toScreen(fit, p)) : [];
  };

  const handles: {
    readonly key: string;
    readonly pieceId: number;
    readonly edge: number;
    readonly cx: number;
    readonly cy: number;
    readonly pieceNo: number;
  }[] = [];
  if (showHandles) {
    placed.forEach((piece, idx) => {
      const count = pieceEdgeCount(piece.type, settings.n);
      for (let e = 0; e < count; e += 1) {
        if (!canAttach(state, piece.id, e)) continue;
        const info = edgeMidAndNormal(piece.points, e);
        if (!info) continue;
        const mid = toScreen(fit, info.mid);
        handles.push({
          key: `h-${piece.id}-${e}`,
          pieceId: piece.id,
          edge: e,
          cx: mid.x + info.normal.x * HANDLE_GAP,
          cy: mid.y - info.normal.y * HANDLE_GAP,
          pieceNo: idx + 1,
        });
      }
    });
  }

  const doAttach = (parent: number | null, edge: number) => {
    if (!interactive) return;
    if (!canAttach(state, parent, edge)) {
      onLiveMessage(S.prismNet.live.cannot);
      return;
    }
    dispatch({ type: 'attach', parent, parentEdge: edge });
    onLiveMessage(S.prismNet.live.attached);
  };

  const pieceTap = (id: number) => {
    if (!interactive) return;
    if (selectedId === id) {
      if (canRemovePiece(state, id)) {
        dispatch({ type: 'remove-piece', id });
        onLiveMessage(S.prismNet.live.removed);
      }
      onSelect(null);
      return;
    }
    onSelect(id);
    onLiveMessage(S.prismNet.live.selected);
  };

  const canPlaceRoot = showHandles && pieces.length === 0 && canAttach(state, null, 0);

  return (
    <div ref={hostRef} className={styles.prismNetHost}>
      <svg
        className={styles.prismNetSvg}
        data-testid="prismnet-board"
        data-folded={state.folded ? 'true' : undefined}
        width={size.w}
        height={size.h}
        viewBox={`0 0 ${size.w} ${size.h}`}
        role="group"
        aria-label={S.prismNet.boardLabel}
      >
        <defs>
          <HatchPattern id={HATCH_ID} />
        </defs>

        {pieces.length === 0 && !canPlaceRoot ? (
          <text
            x={size.w / 2}
            y={size.h / 2}
            textAnchor="middle"
            fontSize={16}
            fontWeight={700}
            fill="#5b6577"
          >
            {interactive ? S.prismNet.emptyHint : ''}
          </text>
        ) : null}

        {placed.map((piece, idx) => {
          const screen = screenOf(idx);
          const style = pieceStyle(piece.type);
          const data = pieces[idx];
          const isSelected = selectedId === piece.id;
          const isBase = piece.type === 'base';
          const c = polygonCenter(screen);
          const problem = problemIndices.has(idx);
          return (
            <g
              key={`piece-${piece.id}`}
              data-testid={`prismnet-piece-${piece.id}`}
              data-selected={isSelected ? 'true' : undefined}
              data-type={piece.type}
              tabIndex={interactive ? 0 : undefined}
              role={interactive ? 'button' : 'img'}
              aria-pressed={interactive ? isSelected : undefined}
              aria-label={S.prismNet.pieceAria(isBase, idx + 1)}
              style={interactive ? { cursor: 'pointer' } : undefined}
              onClick={() => pieceTap(piece.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  if (selectedId === piece.id) onSelect(null);
                  else pieceTap(piece.id);
                }
              }}
            >
              <polygon
                points={pointsAttr(screen)}
                fill={style.fill}
                stroke={isSelected ? '#e8872e' : style.stroke}
                strokeWidth={isSelected ? 4 : 2}
                strokeLinejoin="round"
              />
              {isBase ? (
                <polygon
                  points={baseMarkerPoints(screen)}
                  fill="none"
                  stroke={style.stroke}
                  strokeWidth={2}
                  strokeLinejoin="round"
                />
              ) : null}
              {data?.locked ? <circle cx={c.x} cy={c.y} r={isBase ? 3 : 4} fill="#475569" /> : null}
              {settings.showLengths
                ? screen.map((a, e) => {
                    const b = screen[(e + 1) % screen.length];
                    if (!b) return null;
                    const mx = (a.x + b.x) / 2;
                    const my = (a.y + b.y) / 2;
                    const dx = c.x - mx;
                    const dy = c.y - my;
                    const len = Math.hypot(dx, dy) || 1;
                    const isSide = isBase || e % 2 === 0;
                    const text = isSide ? settings.sideLen : settings.height;
                    return (
                      <text
                        key={`len-${piece.id}-${e}`}
                        x={mx + (dx / len) * 12}
                        y={my + (dy / len) * 12 + 5}
                        textAnchor="middle"
                        fontSize={14}
                        fontWeight={800}
                        fill="#1d2330"
                        pointerEvents="none"
                      >
                        {text}
                      </text>
                    );
                  })
                : null}
              {problem ? (
                <polygon
                  data-testid={`prismnet-hatch-${piece.id}`}
                  points={pointsAttr(screen)}
                  fill={`url(#${HATCH_ID})`}
                  fillOpacity={0.7}
                  stroke="#dc2626"
                  strokeWidth={3}
                  strokeLinejoin="round"
                  pointerEvents="none"
                />
              ) : null}
            </g>
          );
        })}

        {handles.map((h) => (
          <g
            key={h.key}
            data-testid={`prismnet-handle-${h.pieceId}-${h.edge}`}
            tabIndex={0}
            role="button"
            aria-label={S.prismNet.handleAria(h.pieceNo, h.edge + 1)}
            style={{ cursor: 'pointer' }}
            onClick={() => doAttach(h.pieceId, h.edge)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                doAttach(h.pieceId, h.edge);
              }
            }}
          >
            <circle
              cx={h.cx}
              cy={h.cy}
              r={HANDLE_R}
              fill="#ffffff"
              fillOpacity={0.94}
              stroke="#2f6fde"
              strokeWidth={2.5}
            />
            <PlusMark cx={h.cx} cy={h.cy} r={9} />
          </g>
        ))}

        {canPlaceRoot ? (
          <g
            data-testid="prismnet-root-handle"
            tabIndex={0}
            role="button"
            aria-label={S.prismNet.rootHandleAria}
            style={{ cursor: 'pointer' }}
            onClick={() => doAttach(null, 0)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                doAttach(null, 0);
              }
            }}
          >
            <circle
              cx={size.w / 2}
              cy={size.h / 2}
              r={44}
              fill="#ffffff"
              fillOpacity={0.94}
              stroke="#2f6fde"
              strokeWidth={3}
            />
            <PlusMark cx={size.w / 2} cy={size.h / 2} r={18} />
          </g>
        ) : null}
      </svg>
    </div>
  );
}
