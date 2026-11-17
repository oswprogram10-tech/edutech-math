/**
 * E12 `surface-volume` 직육면체 무대(정사영 SVG).
 *
 * - 면마다 1cm 칸 격자를 옅게 그리고, 칠한 면은 색과 무늬로 보인다.
 * - 가장 가까운 모서리 세 개에 길이("4cm")를 붙인다. 치수는 문제 조건이다.
 * - 끌어 돌리기: 8px 넘게 끌면 0.5°/px 미리보기 후 떼면 15° 정규화 `set-view`.
 * - 넓이·부피·개수를 쓰지 않는다.
 */
import { useRef, useState } from 'react';
import { clamp } from '../../../core/engine-sdk';
import { faceSize } from '../sv/geometry';
import { solid3dStrings as S } from '../strings.ko';
import type { SvAction, SvState } from '../types';
import styles from '../View.module.css';
import {
  faceCorners,
  normalizeView,
  projectXrayPoint,
  viewBasis,
  visibleFaces,
  xrayScaleForStage,
  type XrayViewAngle,
} from '../xray/geometry';
import { MOVE_THRESHOLD_PX } from './usePressGesture';
import { gridLines, paintFill, paintKeyOf, SV_PAINT_STYLES, useSvUid, type SvPt } from './svPaint';
import { SvPatternDefs } from './svShared';

export const SV_STAGE_W = 600;
export const SV_STAGE_H = 450;

interface SvBoxStageProps {
  readonly state: SvState;
  readonly readOnly: boolean;
  readonly dispatch: (action: SvAction) => void;
  readonly onLiveMessage: (msg: string) => void;
  /** true면 끌어 돌릴 수 있다. */
  readonly rotatable?: boolean;
  readonly className?: string;
}

interface StageDrag {
  readonly pointerId: number;
  readonly startX: number;
  readonly startY: number;
  readonly startYaw: number;
  readonly startPitch: number;
  moved: boolean;
}

type V3 = readonly [number, number, number];

export function SvBoxStage({
  state,
  readOnly,
  dispatch,
  onLiveMessage,
  rotatable = true,
}: SvBoxStageProps) {
  const uid = useSvUid();
  const [w, d, h] = state.dims;
  const dragRef = useRef<StageDrag | null>(null);
  const [dragView, setDragView] = useState<XrayViewAngle | null>(null);
  const view = dragView ?? state.view;
  const basis = viewBasis(view);
  const scale = xrayScaleForStage(w, d, h, SV_STAGE_W, SV_STAGE_H);
  const proj = (p: V3) => projectXrayPoint(p, w, d, h, basis, scale, SV_STAGE_W, SV_STAGE_H);
  const painted = new Set<string>(state.painted);

  const faces = visibleFaces(view)
    .map((id) => {
      const corners = faceCorners(id, w, d, h);
      const pts = corners.map(proj);
      const depth = pts.reduce((sum, p) => sum + p.depth, 0) / 4;
      return { id, corners, pts, depth };
    })
    .sort((a, b) => a.depth - b.depth);

  // 축마다 가장 가까운 모서리의 중점에 길이 글자를 둔다.
  const center = proj([w / 2, d / 2, h / 2]);
  const edgeLabel = (axis: 0 | 1 | 2) => {
    const len = axis === 0 ? w : axis === 1 ? d : h;
    let best: { readonly depth: number; readonly x: number; readonly y: number } | null = null;
    const others = axis === 0 ? [1, 2] : axis === 1 ? [0, 2] : [0, 1];
    const max: V3 = [w, d, h];
    for (const a of [0, 1]) {
      for (const b of [0, 1]) {
        const mid: [number, number, number] = [w / 2, d / 2, h / 2];
        mid[axis] = max[axis] / 2;
        mid[others[0] ?? 0] = a === 0 ? 0 : (max[others[0] ?? 0] ?? 0);
        mid[others[1] ?? 0] = b === 0 ? 0 : (max[others[1] ?? 0] ?? 0);
        const p = proj(mid);
        if (!best || p.depth > best.depth) best = { depth: p.depth, x: p.x, y: p.y };
      }
    }
    if (!best) return null;
    const dx = best.x - center.x;
    const dy = best.y - center.y;
    const norm = Math.hypot(dx, dy) || 1;
    return { len, x: best.x + (dx / norm) * 22, y: best.y + (dy / norm) * 22 + 6, axis };
  };
  const labels = ([0, 1, 2] as const).map(edgeLabel);

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!rotatable || readOnly) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startYaw: state.view.yaw,
      startPitch: state.view.pitch,
      moved: false,
    };
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      // 일부 테스트 환경에서는 pointer capture를 지원하지 않는다.
    }
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) > MOVE_THRESHOLD_PX) drag.moved = true;
    if (drag.moved) {
      setDragView({
        yaw: drag.startYaw + dx * 0.5,
        pitch: clamp(drag.startPitch + dy * 0.5, -75, 75),
      });
    }
  };

  const finishPointer = (e: React.PointerEvent<SVGSVGElement>, cancelled: boolean) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    setDragView(null);
    if (cancelled || !drag.moved) return;
    const next = normalizeView({
      yaw: drag.startYaw + (e.clientX - drag.startX) * 0.5,
      pitch: drag.startPitch + (e.clientY - drag.startY) * 0.5,
    });
    if (next.yaw !== state.view.yaw || next.pitch !== state.view.pitch) {
      dispatch({ type: 'set-view', yaw: next.yaw, pitch: next.pitch });
      onLiveMessage(S.sv.live.turned);
    }
  };

  return (
    <svg
      className={styles.xrayStageSvg}
      data-testid="sv-box-stage"
      data-yaw={view.yaw}
      data-pitch={view.pitch}
      viewBox={`0 0 ${SV_STAGE_W} ${SV_STAGE_H}`}
      width={SV_STAGE_W}
      height={SV_STAGE_H}
      role="img"
      aria-label={S.sv.stageLabel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(e) => finishPointer(e, false)}
      onPointerCancel={(e) => finishPointer(e, true)}
    >
      <SvPatternDefs uid={uid} />
      {faces.map(({ id, pts }) => {
        const [nU, nV] = faceSize(id, w, d, h);
        const isPainted = painted.has(id);
        const quad = pts as unknown as readonly [SvPt, SvPt, SvPt, SvPt];
        // 면의 p0→p1 방향 칸 수는 p0→p1이 가리키는 축에 따라 faceSize의 (가로, 세로) 순이다.
        const lines = gridLines(quad, nU, nV);
        const polygon = pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
        return (
          <g key={id} data-testid={`sv-box-face-${id}`} data-painted={isPainted ? 'true' : 'false'}>
            <polygon
              points={polygon}
              fill={
                isPainted ? paintFill(uid, paintKeyOf(id, state.settings.pairColors)) : '#ffffff'
              }
            />
            {lines.map((l, i) => (
              <line
                key={i}
                x1={l.x1}
                y1={l.y1}
                x2={l.x2}
                y2={l.y2}
                stroke={
                  isPainted
                    ? SV_PAINT_STYLES[paintKeyOf(id, state.settings.pairColors)].fg
                    : '#cbd5e1'
                }
                strokeOpacity={isPainted ? 0.55 : 1}
                strokeWidth={1}
              />
            ))}
            <polygon
              points={polygon}
              fill="none"
              stroke="#1e293b"
              strokeWidth={3}
              strokeLinejoin="round"
            />
          </g>
        );
      })}
      {labels.map((label) =>
        label ? (
          <text
            key={label.axis}
            data-testid={`sv-box-length-${label.axis === 0 ? 'w' : label.axis === 1 ? 'd' : 'h'}`}
            x={label.x}
            y={label.y}
            textAnchor="middle"
            fontSize={22}
            fontWeight={800}
            fill="#1d2330"
            stroke="#fbfaf6"
            strokeWidth={5}
            paintOrder="stroke"
          >
            {S.sv.lengthLabel(label.len)}
          </text>
        ) : null,
      )}
    </svg>
  );
}
