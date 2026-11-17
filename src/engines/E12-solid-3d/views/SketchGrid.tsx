/**
 * E12 `xray` 사투상 겨냥도 점 격자(SVG).
 *
 * - 점 간격은 `clamp(32px, 들어갈 수 있는 크기, 48px)`.
 * - 점 누르기(첫 점 → 둘째 점)와 끌어 잇기(Pointer Events) 모두 지원.
 * - 가장 가까운 점에서 간격의 35%보다 멀고 잠기지 않은 선분에서 12px 안이면 선분을 뺀다(점 누르기 우선).
 * - 채점 결과(맞다/틀리다)를 화면에 쓰지 않는다.
 */
import { useEffect, useRef, useState } from 'react';
import { clamp } from '../../../core/engine-sdk';
import { solid3dStrings as S } from '../strings.ko';
import type { XrayAction, XrayState } from '../types';
import styles from '../View.module.css';
import { sketchGridBounds, type SketchDot, type SketchSegment } from '../xray/geometry';

const PAD = 16;
const MIN_SPACING = 32;
const MAX_SPACING = 48;

interface SketchGridProps {
  readonly state: XrayState;
  readonly readOnly: boolean;
  readonly dispatch: (action: XrayAction) => void;
  readonly onLiveMessage: (msg: string) => void;
  readonly onNarrowChange?: (narrow: boolean) => void;
}

interface PointerSession {
  readonly pointerId: number;
  readonly mode: 'dot' | 'remove';
  readonly startDot: SketchDot | null;
  readonly targetSeg: SketchSegment | null;
  readonly prevStart: SketchDot | null;
}

function sameDot(a: SketchDot | null, b: SketchDot | null): boolean {
  return a !== null && b !== null && a[0] === b[0] && a[1] === b[1];
}

function pointToSegmentDistance(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  const t = clamp(((px - x1) * dx + (py - y1) * dy) / lenSq, 0, 1);
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

export function SketchGrid({
  state,
  readOnly,
  dispatch,
  onLiveMessage,
  onNarrowChange,
}: SketchGridProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const sessionRef = useRef<PointerSession | null>(null);
  const onNarrowChangeRef = useRef(onNarrowChange);
  useEffect(() => {
    onNarrowChangeRef.current = onNarrowChange;
  }, [onNarrowChange]);
  const narrowRef = useRef(false);
  const sideReservedRef = useRef<number | null>(null);

  const { w, d, h } = state.settings.solid;
  const bounds = sketchGridBounds(w, d, h);
  const cols = Math.max(1, bounds.maxX - bounds.minX);
  const rows = Math.max(1, bounds.maxY - bounds.minY);

  const fallbackSpacing = clamp(Math.floor(416 / Math.max(cols, rows)), MIN_SPACING, MAX_SPACING);
  const [measuredSpacing, setMeasuredSpacing] = useState<number | null>(null);
  const spacing = measuredSpacing ?? fallbackSpacing;

  const [startDot, setStartDot] = useState<SketchDot | null>(null);
  const [hoverDot, setHoverDot] = useState<SketchDot | null>(null);
  const [cursor, setCursor] = useState<SketchDot>([0, 0]);

  useEffect(() => {
    const el = hostRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const rowEl = el.closest('[data-xray-row="true"]');
    const minGridWidth = cols * MIN_SPACING + PAD * 2;
    const measure = () => {
      const cw = el.clientWidth;
      const ch = el.clientHeight;
      if (cw < 40 || ch < 40) return;

      const rowDir = rowEl instanceof HTMLElement ? getComputedStyle(rowEl).flexDirection : '';
      const rowWidth = rowEl instanceof HTMLElement ? rowEl.clientWidth : cw;
      let nextNarrow = narrowRef.current;
      if (!narrowRef.current) {
        if (rowDir === 'row' && cw < minGridWidth) {
          sideReservedRef.current = Math.max(0, rowWidth - cw);
          nextNarrow = true;
        }
      } else {
        const reserved = sideReservedRef.current;
        if (reserved === null || rowWidth - reserved >= minGridWidth + 4) {
          nextNarrow = false;
        }
      }

      if (nextNarrow !== narrowRef.current) {
        narrowRef.current = nextNarrow;
        sideReservedRef.current = nextNarrow ? sideReservedRef.current : null;
        onNarrowChangeRef.current?.(nextNarrow);
      }

      const fit = Math.floor(Math.min((cw - PAD * 2) / cols, (ch - PAD * 2) / rows));
      setMeasuredSpacing(clamp(fit, MIN_SPACING, MAX_SPACING));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (rowEl instanceof Element) ro.observe(rowEl);
    return () => ro.disconnect();
  }, [cols, rows]);

  const svgWidth = cols * spacing + PAD * 2;
  const svgHeight = rows * spacing + PAD * 2;

  const dotToPx = (dot: SketchDot): { readonly x: number; readonly y: number } => ({
    x: PAD + (dot[0] - bounds.minX) * spacing,
    y: PAD + (bounds.maxY - dot[1]) * spacing,
  });

  const localPointOf = (e: React.PointerEvent<SVGSVGElement>): { x: number; y: number } | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return {
      x: ((e.clientX - rect.left) / rect.width) * svgWidth,
      y: ((e.clientY - rect.top) / rect.height) * svgHeight,
    };
  };

  const nearestDotFromEvent = (
    e: React.PointerEvent<SVGSVGElement>,
  ): {
    readonly dot: SketchDot;
    readonly dist: number;
    readonly local: { x: number; y: number } | null;
  } | null => {
    const local = localPointOf(e);
    if (local) {
      const gx = clamp(
        Math.round((local.x - PAD) / spacing) + bounds.minX,
        bounds.minX,
        bounds.maxX,
      );
      const gy = clamp(
        bounds.maxY - Math.round((local.y - PAD) / spacing),
        bounds.minY,
        bounds.maxY,
      );
      const p = dotToPx([gx, gy]);
      return {
        dot: [gx, gy],
        dist: Math.hypot(local.x - p.x, local.y - p.y),
        local,
      };
    }
    const target = e.target;
    if (target instanceof Element) {
      const dotEl = target.closest('[data-dot-x][data-dot-y]');
      if (dotEl) {
        const dx = Number(dotEl.getAttribute('data-dot-x'));
        const dy = Number(dotEl.getAttribute('data-dot-y'));
        if (Number.isInteger(dx) && Number.isInteger(dy)) {
          return { dot: [dx, dy], dist: 0, local: null };
        }
      }
    }
    return null;
  };

  const findRemovableSegmentNear = (px: number, py: number): SketchSegment | null => {
    let bestSeg: SketchSegment | null = null;
    let bestDist = 12;
    for (const seg of state.segments) {
      if (seg.locked) continue;
      const pa = dotToPx(seg.a);
      const pb = dotToPx(seg.b);
      const dist = pointToSegmentDistance(px, py, pa.x, pa.y, pb.x, pb.y);
      if (dist <= bestDist) {
        bestDist = dist;
        bestSeg = seg;
      }
    }
    return bestSeg;
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (readOnly || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const hit = nearestDotFromEvent(e);
    if (!hit) return;

    // 1. 점이 가까우면(간격의 35% 이내) 점 누르기 우선
    if (hit.dist > spacing * 0.35 && hit.local) {
      const seg = findRemovableSegmentNear(hit.local.x, hit.local.y);
      if (seg) {
        sessionRef.current = {
          pointerId: e.pointerId,
          mode: 'remove',
          startDot: null,
          targetSeg: seg,
          prevStart: startDot,
        };
        try {
          e.currentTarget.setPointerCapture?.(e.pointerId);
        } catch {
          // ignore
        }
        return;
      }
    }

    const prev = startDot;
    setStartDot(hit.dot);
    setHoverDot(hit.dot);
    setCursor(hit.dot);
    sessionRef.current = {
      pointerId: e.pointerId,
      mode: 'dot',
      startDot: hit.dot,
      targetSeg: null,
      prevStart: prev,
    };
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      // ignore
    }
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const sess = sessionRef.current;
    if (!sess || sess.pointerId !== e.pointerId || sess.mode !== 'dot') return;
    const hit = nearestDotFromEvent(e);
    if (hit) setHoverDot(hit.dot);
  };

  const finishPress = (e: React.PointerEvent<SVGSVGElement>, cancelled: boolean) => {
    const sess = sessionRef.current;
    if (!sess || sess.pointerId !== e.pointerId) return;
    sessionRef.current = null;
    setHoverDot(null);
    if (cancelled || readOnly) return;

    if (sess.mode === 'remove' && sess.targetSeg) {
      dispatch({ type: 'remove-segment', a: sess.targetSeg.a, b: sess.targetSeg.b });
      setStartDot(null);
      onLiveMessage(S.xray.live.segmentRemoved);
      return;
    }

    const hit = nearestDotFromEvent(e);
    const endDot = hit?.dot ?? sess.startDot;
    if (!sess.startDot || !endDot) return;

    if (!sameDot(endDot, sess.startDot)) {
      dispatch({
        type: 'add-segment',
        a: sess.startDot,
        b: endDot,
        style: state.lineStyle,
      });
      setStartDot(null);
      setCursor(endDot);
      onLiveMessage(S.xray.live.segmentAdded);
      return;
    }

    // 같은 점에서 뗌(탭)
    if (sess.prevStart) {
      if (sameDot(sess.prevStart, endDot)) {
        setStartDot(null);
      } else {
        dispatch({
          type: 'add-segment',
          a: sess.prevStart,
          b: endDot,
          style: state.lineStyle,
        });
        setStartDot(null);
        onLiveMessage(S.xray.live.segmentAdded);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<SVGSVGElement>) => {
    if (readOnly) return;
    const [cx, cy] = cursor;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setCursor([Math.max(bounds.minX, cx - 1), cy]);
      return;
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      setCursor([Math.min(bounds.maxX, cx + 1), cy]);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor([cx, Math.min(bounds.maxY, cy + 1)]);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor([cx, Math.max(bounds.minY, cy - 1)]);
      return;
    }
    if (e.key === 'l' || e.key === 'L') {
      e.preventDefault();
      const nextStyle = state.lineStyle === 'solid' ? 'dashed' : 'solid';
      dispatch({ type: 'set-line-style', style: nextStyle });
      onLiveMessage(
        S.xray.live.styleChanged(nextStyle === 'solid' ? S.xray.solidLine : S.xray.dashedLine),
      );
      return;
    }
    if (e.key === 'Backspace') {
      e.preventDefault();
      for (let i = state.segments.length - 1; i >= 0; i -= 1) {
        const seg = state.segments[i];
        if (!seg || seg.locked) continue;
        if (sameDot(seg.a, cursor) || sameDot(seg.b, cursor)) {
          dispatch({ type: 'remove-segment', a: seg.a, b: seg.b });
          onLiveMessage(S.xray.live.segmentRemoved);
          break;
        }
      }
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (startDot === null) {
        setStartDot(cursor);
      } else if (sameDot(startDot, cursor)) {
        setStartDot(null);
      } else {
        dispatch({
          type: 'add-segment',
          a: startDot,
          b: cursor,
          style: state.lineStyle,
        });
        setStartDot(null);
        onLiveMessage(S.xray.live.segmentAdded);
      }
    }
  };

  const dots: SketchDot[] = [];
  for (let y = bounds.maxY; y >= bounds.minY; y -= 1) {
    for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
      dots.push([x, y]);
    }
  }

  const startPx = startDot ? dotToPx(startDot) : null;
  const hoverPx = hoverDot ? dotToPx(hoverDot) : null;
  const cursorPx = dotToPx(cursor);

  return (
    <div ref={hostRef} className={styles.netGridHost}>
      <svg
        ref={svgRef}
        className={styles.netGridSvg}
        data-testid="xray-sketch"
        data-dot-spacing={spacing}
        width={svgWidth}
        height={svgHeight}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        style={{
          minWidth: cols * MIN_SPACING + PAD * 2,
          minHeight: rows * MIN_SPACING + PAD * 2,
        }}
        role="application"
        aria-label={S.xray.sketchLabel}
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={(e) => finishPress(e, false)}
        onPointerCancel={(e) => finishPress(e, true)}
        onKeyDown={handleKeyDown}
      >
        {/* 이미 그어진 선분 */}
        {state.segments.map((seg) => {
          const pa = dotToPx(seg.a);
          const pb = dotToPx(seg.b);
          const stroke = seg.locked ? '#475569' : '#2563eb';
          return (
            <line
              key={`seg-${seg.a[0]}-${seg.a[1]}-${seg.b[0]}-${seg.b[1]}`}
              data-testid={`xray-seg-${seg.a[0]}-${seg.a[1]}-${seg.b[0]}-${seg.b[1]}`}
              data-style={seg.style}
              data-locked={seg.locked ? 'true' : 'false'}
              x1={pa.x}
              y1={pa.y}
              x2={pb.x}
              y2={pb.y}
              stroke={stroke}
              strokeWidth={seg.locked ? 2.8 : 3}
              strokeDasharray={seg.style === 'dashed' ? '6 5' : undefined}
              strokeLinecap="round"
            />
          );
        })}

        {/* 끌기 중 선분 미리보기 */}
        {startPx && hoverPx && startDot && hoverDot && !sameDot(startDot, hoverDot) ? (
          <line
            x1={startPx.x}
            y1={startPx.y}
            x2={hoverPx.x}
            y2={hoverPx.y}
            stroke="#2563eb"
            strokeOpacity={0.5}
            strokeWidth={2.5}
            strokeDasharray={state.lineStyle === 'dashed' ? '6 5' : undefined}
            strokeLinecap="round"
            pointerEvents="none"
          />
        ) : null}

        {/* 점 격자 (지름 6px = 반지름 3px) */}
        {dots.map((dot) => {
          const p = dotToPx(dot);
          const isStart = sameDot(startDot, dot);
          return (
            <g key={`dot-${dot[0]}-${dot[1]}`}>
              <circle
                data-testid={`xray-dot-${dot[0]}-${dot[1]}`}
                data-dot-x={dot[0]}
                data-dot-y={dot[1]}
                cx={p.x}
                cy={p.y}
                r={3}
                fill={isStart ? '#1d4ed8' : '#64748b'}
                aria-label={S.xray.dotAria(dot[0], dot[1])}
              />
              {isStart ? (
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={7.5}
                  fill="none"
                  stroke="#1d4ed8"
                  strokeWidth={2.2}
                  pointerEvents="none"
                />
              ) : null}
            </g>
          );
        })}

        {/* 키보드 초점 커서 */}
        <circle
          data-testid="xray-sketch-cursor"
          cx={cursorPx.x}
          cy={cursorPx.y}
          r={10}
          fill="none"
          stroke="#e8872e"
          strokeWidth={2}
          strokeDasharray="4 3"
          pointerEvents="none"
        />
      </svg>
    </div>
  );
}
