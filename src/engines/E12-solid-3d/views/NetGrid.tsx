/**
 * E12 `net-fold` 2D 모눈판(SVG).
 *
 * - 칸 크기는 `clamp(minCell, 들어갈 수 있는 크기, 72px)`, `minCell = max(32, ceil(48 / minFaceSide))`로 가장 짧은 면 변이 48px 이상이 되게 한다.
 * - Pointer Events(누름→이동→뗌)로 놓기·빼기·미리보기 그림자("놓을 수 없어요")를 처리한다.
 */
import { useEffect, useRef, useState } from 'react';
import { clamp } from '../../../core/engine-sdk';
import type { NetEvaluation } from '../net/geometry';
import { canPlaceFace, findFaceAtCell } from '../net/reduce';
import {
  faceCenter2D,
  NET_LOCKED_STYLE,
  NET_PLAIN_STYLE,
  pairStyleForSlot,
  zigzagPath,
  type PairShape,
} from '../net/visuals';
import { solid3dStrings as S } from '../strings.ko';
import type { NetFoldAction, NetFoldState } from '../types';
import styles from '../View.module.css';

const PAD = 8;
const MIN_FACE_PX = 48;
const ABS_MIN_CELL = 32;
const MAX_CELL = 72;

interface NetGridProps {
  readonly state: NetFoldState;
  readonly evaluation: NetEvaluation;
  readonly readOnly: boolean;
  readonly dispatch: (action: NetFoldAction) => void;
  readonly onLiveMessage: (msg: string) => void;
}

interface ActivePress {
  readonly pointerId: number;
  readonly mode: 'place' | 'remove';
  readonly x: number;
  readonly y: number;
}

function PairMarkSvg({
  shape,
  cx,
  cy,
  color,
}: {
  readonly shape: PairShape;
  readonly cx: number;
  readonly cy: number;
  readonly color: string;
}) {
  if (shape === 'circle') {
    return <circle cx={cx} cy={cy} r={5.5} fill={color} />;
  }
  if (shape === 'triangle') {
    return (
      <polygon points={`${cx},${cy - 6} ${cx + 6},${cy + 5} ${cx - 6},${cy + 5}`} fill={color} />
    );
  }
  return <rect x={cx - 5} y={cy - 5} width={10} height={10} rx={1.5} fill={color} />;
}

function LockIconSvg({ x, y }: { readonly x: number; readonly y: number }) {
  return (
    <g transform={`translate(${x}, ${y})`} aria-hidden="true">
      <rect x={2} y={6} width={10} height={8} rx={2} fill="#475569" />
      <path
        d="M4.5 6V4.5a2.5 2.5 0 0 1 5 0V6"
        fill="none"
        stroke="#475569"
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    </g>
  );
}

export function NetGrid({ state, evaluation, readOnly, dispatch, onLiveMessage }: NetGridProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const pressRef = useRef<ActivePress | null>(null);

  const [cols, rows] = state.settings.grid;
  const minFaceSide = Math.max(
    1,
    state.settings.target === 'cube' ? state.settings.faceSize : Math.min(...state.settings.dims),
  );
  const minCell = Math.max(ABS_MIN_CELL, Math.ceil(MIN_FACE_PX / minFaceSide));
  const fallbackCell = clamp(Math.floor(384 / Math.max(cols, rows)), minCell, MAX_CELL);
  const [measuredCell, setMeasuredCell] = useState<number | null>(null);
  const cellSize = measuredCell ?? fallbackCell;

  const [previewCell, setPreviewCell] = useState<readonly [number, number] | null>(null);

  useEffect(() => {
    const el = hostRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w < 40 || h < 40) return;
      const fit = Math.floor(Math.min((w - PAD * 2) / cols, (h - PAD * 2) / rows));
      setMeasuredCell(clamp(fit, minCell, MAX_CELL));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [cols, rows, minCell]);

  const svgWidth = cols * cellSize + PAD * 2;
  const svgHeight = rows * cellSize + PAD * 2;
  const isPredictMode = state.settings.predict !== null;
  const canEdit = !readOnly && state.settings.editable && !state.folded && !isPredictMode;

  const cellFromEvent = (
    e: React.PointerEvent<SVGSVGElement>,
  ): readonly [number, number] | null => {
    const svg = svgRef.current;
    if (svg) {
      const rect = svg.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const localX = ((e.clientX - rect.left) / rect.width) * svgWidth - PAD;
        const localY = ((e.clientY - rect.top) / rect.height) * svgHeight - PAD;
        const gx = Math.floor(localX / cellSize);
        const gy = Math.floor(localY / cellSize);
        if (gx >= 0 && gx < cols && gy >= 0 && gy < rows) {
          return [gx, gy];
        }
        return null;
      }
    }
    const target = e.target;
    if (target instanceof Element) {
      const cellEl = target.closest('[data-cell-x][data-cell-y]');
      if (cellEl) {
        const cx = Number(cellEl.getAttribute('data-cell-x'));
        const cy = Number(cellEl.getAttribute('data-cell-y'));
        if (Number.isInteger(cx) && Number.isInteger(cy)) {
          return [cx, cy];
        }
      }
    }
    return null;
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!canEdit || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const cell = cellFromEvent(e);
    if (!cell) return;
    const [gx, gy] = cell;
    const hit = findFaceAtCell(state.faces, gx, gy);
    if (hit) {
      pressRef.current = { pointerId: e.pointerId, mode: 'remove', x: gx, y: gy };
      setPreviewCell(null);
    } else {
      pressRef.current = { pointerId: e.pointerId, mode: 'place', x: gx, y: gy };
      setPreviewCell([gx, gy]);
    }
    dispatch({ type: 'move-cursor', to: [gx, gy] });
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      // 일부 테스트 환경에서는 pointer capture를 지원하지 않는다.
    }
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!canEdit) return;
    const press = pressRef.current;
    if (!press || press.pointerId !== e.pointerId) return;
    const cell = cellFromEvent(e);
    if (!cell) {
      if (press.mode === 'place') setPreviewCell(null);
      return;
    }
    const [gx, gy] = cell;
    if (press.mode === 'place') {
      setPreviewCell([gx, gy]);
    }
    pressRef.current = { ...press, x: gx, y: gy };
  };

  const finishPress = (e: React.PointerEvent<SVGSVGElement>, cancelled: boolean) => {
    const press = pressRef.current;
    if (!press || press.pointerId !== e.pointerId) return;
    pressRef.current = null;
    setPreviewCell(null);
    if (cancelled || !canEdit) return;
    const cell = cellFromEvent(e) ?? [press.x, press.y];
    const [gx, gy] = cell;
    if (press.mode === 'remove') {
      const hit = findFaceAtCell(state.faces, gx, gy);
      if (hit && !hit.locked) {
        dispatch({ type: 'remove-face', x: gx, y: gy });
        onLiveMessage(S.net.live.removed);
      }
      return;
    }
    if (canPlaceFace(state, gx, gy)) {
      dispatch({ type: 'place-face', x: gx, y: gy });
      onLiveMessage(S.net.live.placed);
    } else {
      onLiveMessage(S.net.live.cannotPlace);
    }
  };

  const overlapSet = new Set(evaluation.overlapFaceIndices);
  const showPairColors = state.folded && evaluation.valid && state.settings.pairColors;
  const showCollisions = state.folded && !evaluation.valid && state.settings.collisionHighlight;

  const previewValid =
    previewCell !== null ? canPlaceFace(state, previewCell[0], previewCell[1]) : false;

  return (
    <div ref={hostRef} className={styles.netGridHost}>
      <svg
        ref={svgRef}
        className={styles.netGridSvg}
        data-testid="net-grid"
        data-cell-size={cellSize}
        data-min-cell={minCell}
        width={svgWidth}
        height={svgHeight}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        style={{
          minWidth: cols * minCell + PAD * 2,
          minHeight: rows * minCell + PAD * 2,
        }}
        role="application"
        aria-label={S.net.gridLabel}
        tabIndex={isPredictMode ? -1 : 0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={(e) => finishPress(e, false)}
        onPointerCancel={(e) => finishPress(e, true)}
      >
        <defs>
          <pattern
            id="e12-net-grid-hatch"
            width={10}
            height={10}
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line x1={0} y1={0} x2={0} y2={10} stroke="#dc2626" strokeWidth={2.5} />
          </pattern>
        </defs>

        {/* 배경 모눈 칸 */}
        {Array.from({ length: rows }, (_, y) =>
          Array.from({ length: cols }, (__, x) => (
            <rect
              key={`cell-${x}-${y}`}
              data-testid={`net-cell-${x}-${y}`}
              data-cell-x={x}
              data-cell-y={y}
              x={PAD + x * cellSize}
              y={PAD + y * cellSize}
              width={cellSize}
              height={cellSize}
              fill="#ffffff"
              stroke="#cbd5e1"
              strokeWidth={1}
              aria-label={S.net.cellAria(x, y)}
            />
          )),
        )}

        {/* 놓여 있는 면 */}
        {state.faces.map((face, idx) => {
          const fx = PAD + face.x * cellSize + 1.5;
          const fy = PAD + face.y * cellSize + 1.5;
          const fw = face.w * cellSize - 3;
          const fh = face.h * cellSize - 3;
          const { cx, cy } = faceCenter2D(face, cellSize, PAD);

          const slot = evaluation.slotOf[idx] ?? null;
          const pairStyle = showPairColors ? pairStyleForSlot(slot) : null;
          const isOverlap = showCollisions && overlapSet.has(idx);
          const isPredictTarget =
            isPredictMode && face.label !== null && face.label === state.settings.predict?.of;
          const isPredicted =
            isPredictMode && face.label !== null && face.label === state.prediction;
          const isPredictOption =
            isPredictMode &&
            !readOnly &&
            !state.folded &&
            face.label !== null &&
            face.label !== state.settings.predict?.of;

          const baseStyle = pairStyle ?? (face.locked ? NET_LOCKED_STYLE : NET_PLAIN_STYLE);
          const strokeColor = isPredicted
            ? '#ea580c'
            : isPredictTarget
              ? '#1d4ed8'
              : isOverlap
                ? '#dc2626'
                : baseStyle.stroke;
          const strokeWidth = isPredicted || isPredictTarget ? 3.5 : 2;

          return (
            <g
              key={`face-${face.x}-${face.y}`}
              data-testid={`net-face-${face.x}-${face.y}`}
              data-cell-x={face.x}
              data-cell-y={face.y}
              data-pair-shape={pairStyle ? pairStyle.shape : undefined}
              aria-label={S.net.faceAria(face.x, face.y, face.w, face.h, face.label, face.locked)}
            >
              <rect
                x={fx}
                y={fy}
                width={fw}
                height={fh}
                rx={6}
                fill={baseStyle.fill}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
              />

              {isOverlap ? (
                <rect
                  x={fx}
                  y={fy}
                  width={fw}
                  height={fh}
                  rx={6}
                  fill="url(#e12-net-grid-hatch)"
                  fillOpacity={0.55}
                  pointerEvents="none"
                />
              ) : null}

              {pairStyle ? (
                <PairMarkSvg
                  shape={pairStyle.shape}
                  cx={face.label ? fx + fw - 12 : cx}
                  cy={face.label ? fy + 12 : cy}
                  color={pairStyle.stroke}
                />
              ) : null}

              {face.label ? (
                <text
                  x={cx}
                  y={cy + 6}
                  textAnchor="middle"
                  fontSize={Math.max(18, Math.round(cellSize * 0.4))}
                  fontWeight={800}
                  fill="#1d2330"
                  pointerEvents="none"
                >
                  {face.label}
                </text>
              ) : null}

              {face.locked && !isPredictTarget && !isPredicted ? (
                <LockIconSvg x={fx + 3} y={fy + 3} />
              ) : null}

              {isOverlap ? (
                <g pointerEvents="none">
                  <rect x={cx - 18} y={fy + fh - 19} width={36} height={16} rx={4} fill="#dc2626" />
                  <text
                    x={cx}
                    y={fy + fh - 7}
                    textAnchor="middle"
                    fontSize={10}
                    fontWeight={800}
                    fill="#ffffff"
                  >
                    {S.net.overlapTag}
                  </text>
                </g>
              ) : null}

              {isPredicted ? (
                <g pointerEvents="none">
                  <rect x={cx - 18} y={fy + 3} width={36} height={15} rx={4} fill="#ea580c" />
                  <text
                    x={cx}
                    y={fy + 14}
                    textAnchor="middle"
                    fontSize={10}
                    fontWeight={800}
                    fill="#ffffff"
                  >
                    {S.net.predictionTag}
                  </text>
                </g>
              ) : null}

              {isPredictMode && face.label && face.label !== state.settings.predict?.of ? (
                <rect
                  data-testid={`net-predict-${face.label}`}
                  data-cell-x={face.x}
                  data-cell-y={face.y}
                  x={fx}
                  y={fy}
                  width={fw}
                  height={fh}
                  rx={6}
                  fill="transparent"
                  role="button"
                  tabIndex={isPredictOption ? 0 : -1}
                  aria-pressed={isPredicted}
                  aria-disabled={!isPredictOption}
                  aria-label={face.label}
                  style={{ cursor: isPredictOption ? 'pointer' : 'default' }}
                  onClick={() => {
                    if (!isPredictOption || !face.label) return;
                    dispatch({ type: 'predict', label: face.label });
                    onLiveMessage(S.net.live.predicted(face.label));
                  }}
                  onKeyDown={(ev) => {
                    if (!isPredictOption || !face.label) return;
                    if (ev.key === 'Enter' || ev.key === ' ') {
                      ev.preventDefault();
                      dispatch({ type: 'predict', label: face.label });
                      onLiveMessage(S.net.live.predicted(face.label));
                    }
                  }}
                />
              ) : null}
            </g>
          );
        })}

        {/* 찢어지는 변 지그재그 선 */}
        {showCollisions
          ? evaluation.tornEdgeList.map((torn, i) => {
              const { segment } = torn;
              const x1 = PAD + (segment.axis === 'x' ? segment.coord : segment.lo) * cellSize;
              const y1 = PAD + (segment.axis === 'x' ? segment.lo : segment.coord) * cellSize;
              const x2 = PAD + (segment.axis === 'x' ? segment.coord : segment.hi) * cellSize;
              const y2 = PAD + (segment.axis === 'x' ? segment.hi : segment.coord) * cellSize;
              return (
                <path
                  key={`torn-${torn.a}-${torn.b}-${i}`}
                  data-testid="net-torn-edge"
                  d={zigzagPath(x1, y1, x2, y2, 4, 8)}
                  fill="none"
                  stroke="#dc2626"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  pointerEvents="none"
                />
              );
            })
          : null}

        {/* 커서 강조 (조작 가능 + 접지 않았을 때) */}
        {canEdit ? (
          <rect
            data-testid="net-cursor"
            x={PAD + state.cursor[0] * cellSize + 2}
            y={PAD + state.cursor[1] * cellSize + 2}
            width={Math.min(cols - state.cursor[0], state.shape[0]) * cellSize - 4}
            height={Math.min(rows - state.cursor[1], state.shape[1]) * cellSize - 4}
            rx={6}
            fill="none"
            stroke="#2f6fde"
            strokeWidth={2.5}
            strokeDasharray="6 3"
            pointerEvents="none"
          />
        ) : null}

        {/* 누르는 동안 놓일 자리 그림자 */}
        {previewCell !== null ? (
          <g data-testid="net-place-preview" pointerEvents="none">
            <rect
              x={PAD + previewCell[0] * cellSize + 2}
              y={PAD + previewCell[1] * cellSize + 2}
              width={state.shape[0] * cellSize - 4}
              height={state.shape[1] * cellSize - 4}
              rx={6}
              fill={previewValid ? 'rgba(47, 111, 222, 0.25)' : 'rgba(220, 38, 38, 0.18)'}
              stroke={previewValid ? '#2f6fde' : '#dc2626'}
              strokeWidth={2.5}
              strokeDasharray="6 4"
            />
            {!previewValid ? (
              <g>
                <rect
                  x={Math.max(
                    4,
                    Math.min(
                      svgWidth - 84,
                      PAD + (previewCell[0] + state.shape[0] / 2) * cellSize - 40,
                    ),
                  )}
                  y={Math.max(4, PAD + previewCell[1] * cellSize - 10)}
                  width={80}
                  height={20}
                  rx={6}
                  fill="#dc2626"
                />
                <text
                  x={Math.max(
                    44,
                    Math.min(svgWidth - 44, PAD + (previewCell[0] + state.shape[0] / 2) * cellSize),
                  )}
                  y={Math.max(18, PAD + previewCell[1] * cellSize + 4)}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight={800}
                  fill="#ffffff"
                >
                  {S.net.cannotPlace}
                </text>
              </g>
            ) : null}
          </g>
        ) : null}
      </svg>
    </div>
  );
}
