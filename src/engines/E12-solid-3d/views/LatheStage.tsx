/**
 * E12 `lathe` 무대(SVG, Three.js 없음).
 *
 * - 가운데 세로 축(굵은 점선). 도형을 붙이면 붙인 변이 축 위에 놓이고 굵게 칠해진다.
 * - 도형이 돌아가는 동안 30°마다 잔상(옅은 같은 도형)이 쌓인다. 360°가 되면 잔상을 지우고 입체를 그린다.
 * - 완성된 입체는 끌어서(또는 Q·E) 돌려 볼 수 있다. 레이저는 입체 위에 겹쳐 그린다.
 * - 입체·단면의 이름은 화면에 쓰지 않는다.
 */
import { useId, useRef } from 'react';
import {
  axisChain,
  chainHeight,
  chainRadius,
  frontArc,
  laserHeight,
  makeProjector,
  naturalChain,
  planePoint,
  pointsAttr,
  radiusAt,
  rimRings,
  ringPoints,
  solidSilhouette,
  STAGE_H,
  STAGE_SCALE,
  STAGE_W,
  type RH,
  type StageProjector,
} from '../lathe/render';
import { ANGLE_STEP, FULL_TURN } from '../lathe/profiles';
import { solid3dStrings as S } from '../strings.ko';
import type { LatheAction, LatheState } from '../types';
import styles from '../View.module.css';

interface LatheStageProps {
  readonly state: LatheState;
  /** 화면에 그리는 각도(연출 중에는 상태 각도와 다를 수 있다). */
  readonly displayAngle: number;
  readonly readOnly: boolean;
  readonly dispatch: (action: LatheAction) => void;
  readonly onLiveMessage: (msg: string) => void;
}

const DRAG_STEP_PX = 18;
const NATURAL_OFFSET = 1.1;

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function chainPolygon(
  chain: readonly RH[],
  projector: StageProjector,
  alpha: number,
  hMid: number,
  rOffset = 0,
) {
  return chain.map((p) => projector.point(planePoint(p, alpha, hMid, rOffset)));
}

function meanDepth(points: readonly { readonly depth: number }[]): number {
  if (points.length === 0) return 0;
  return points.reduce((sum, p) => sum + p.depth, 0) / points.length;
}

export function LatheStage({
  state,
  displayAngle,
  readOnly,
  dispatch,
  onLiveMessage,
}: LatheStageProps) {
  const rawId = useId();
  const uid = rawId.replace(/[^A-Za-z0-9_-]/g, '');
  const dragRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const { profile, edge, laser } = state;
  const complete = displayAngle >= FULL_TURN && edge !== null;
  const chain = profile && edge ? axisChain(profile, edge) : null;
  const projector = makeProjector(state.view);
  const center = projector.point([0, 0, 0]);

  // 축은 가장 큰 도형(높이 약 4.5)을 덮는 길이로 늘 같게 그린다.
  const axisTop = 2.7;
  const axisBottom = -2.7;
  const axisA = projector.point([0, 0, axisBottom]);
  const axisB = projector.point([0, 0, axisTop]);

  const hMid = chain ? chainHeight(chain) / 2 : 2;
  const ghostCount = edge !== null && !complete ? Math.floor(displayAngle / ANGLE_STEP) : 0;

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (readOnly || !complete) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    dragRef.current = { pointerId: e.pointerId, x: e.clientX, y: e.clientY };
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      // 일부 테스트 환경에서는 pointer capture를 지원하지 않는다.
    }
  };
  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    const stepsX = Math.trunc(dx / DRAG_STEP_PX);
    const stepsY = Math.trunc(dy / DRAG_STEP_PX);
    if (stepsX === 0 && stepsY === 0) return;
    drag.x += stepsX * DRAG_STEP_PX;
    drag.y += stepsY * DRAG_STEP_PX;
    dispatch({ type: 'rotate-view', dYaw: stepsX * 15, dPitch: stepsY * 15 });
    onLiveMessage(S.lathe.live.turned);
  };
  const handlePointerEnd = (e: React.PointerEvent<SVGSVGElement>) => {
    if (dragRef.current?.pointerId === e.pointerId) dragRef.current = null;
  };

  const renderAttachedEdge = () => {
    if (!chain || edge === null || complete) return null;
    const top = chainHeight(chain);
    const a = projector.point([0, 0, -hMid]);
    const b = projector.point([0, 0, top - hMid]);
    return (
      <line
        data-testid="lt-attached-edge"
        x1={a.x}
        y1={a.y}
        x2={b.x}
        y2={b.y}
        stroke="#d9730d"
        strokeWidth={7}
        strokeLinecap="round"
      />
    );
  };

  const renderNatural = () => {
    if (profile === null || edge !== null) return null;
    const nat = naturalChain(profile);
    const natMid = chainHeight(nat) / 2;
    const pts = chainPolygon(nat, projector, 0, natMid, NATURAL_OFFSET);
    return (
      <polygon
        data-testid="lt-profile-natural"
        points={pointsAttr(pts)}
        fill="#bcd4ff"
        fillOpacity={0.55}
        stroke="#2f6fde"
        strokeWidth={3}
        strokeLinejoin="round"
      />
    );
  };

  const renderRotating = () => {
    if (!chain || edge === null || complete) return null;
    const ghosts = Array.from({ length: ghostCount }, (_, k) => {
      const pts = chainPolygon(chain, projector, degToRad(k * ANGLE_STEP), hMid);
      return { k, pts, depth: meanDepth(pts) };
    }).sort((a, b) => a.depth - b.depth);
    const nowPts = chainPolygon(chain, projector, degToRad(displayAngle), hMid);
    return (
      <g data-testid="lt-rotating">
        {ghosts.map((g) => (
          <polygon
            key={`ghost-${g.k}`}
            data-testid={`lt-ghost-${g.k}`}
            points={pointsAttr(g.pts)}
            fill="#8fb1f2"
            fillOpacity={0.14}
            stroke="#5b86d6"
            strokeOpacity={0.55}
            strokeWidth={1.6}
            strokeLinejoin="round"
          />
        ))}
        <polygon
          data-testid="lt-profile-now"
          points={pointsAttr(nowPts)}
          fill="#bcd4ff"
          fillOpacity={0.6}
          stroke="#2f6fde"
          strokeWidth={3}
          strokeLinejoin="round"
        />
      </g>
    );
  };

  const renderSolid = () => {
    if (!chain || !profile || edge === null || !complete) return null;
    const hull = solidSilhouette(chain, projector);
    const rings = rimRings(profile, edge);
    const pitch = state.view.pitch;
    const R = chainRadius(chain);
    return (
      <g data-testid="lt-solid">
        <defs>
          <linearGradient
            id={`lt-shade-${uid}`}
            gradientUnits="userSpaceOnUse"
            x1={center.x - R * STAGE_SCALE}
            y1={0}
            x2={center.x + R * STAGE_SCALE}
            y2={0}
          >
            <stop offset="0" stopColor="#f3f7ff" />
            <stop offset="0.55" stopColor="#cfdcf7" />
            <stop offset="1" stopColor="#9fb6e6" />
          </linearGradient>
        </defs>
        <polygon
          points={pointsAttr(hull)}
          fill={`url(#lt-shade-${uid})`}
          stroke="#2f6fde"
          strokeWidth={3}
          strokeLinejoin="round"
        />
        {rings.map((ring, i) => {
          const showFull =
            (ring.cap === 'top' && pitch > 0) || (ring.cap === 'bottom' && pitch < 0);
          if (showFull) {
            const pts = ringPoints(projector, ring.r, ring.h, hMid);
            return (
              <polygon
                key={`ring-${i}`}
                points={pointsAttr(pts)}
                fill="#ffffff"
                fillOpacity={0.55}
                stroke="#2f6fde"
                strokeWidth={2.2}
              />
            );
          }
          const arc = frontArc(projector, state.view, ring.r, ring.h, hMid);
          return (
            <polyline
              key={`ring-${i}`}
              points={pointsAttr(arc)}
              fill="none"
              stroke="#2f6fde"
              strokeWidth={2.2}
              strokeOpacity={0.8}
            />
          );
        })}
      </g>
    );
  };

  const renderLaser = () => {
    if (!chain || !complete || !laser) return null;
    const top = chainHeight(chain);
    const R = chainRadius(chain);
    if (laser.plane === 'perpendicular') {
      const h = laserHeight(chain, laser.t);
      const r = radiusAt(chain, h);
      const mid = projector.point([0, 0, h - hMid]);
      const half = (R + 1.2) * STAGE_SCALE;
      return (
        <g data-testid="lt-laser-h-line" data-t={laser.t}>
          <line
            x1={mid.x - half}
            y1={mid.y}
            x2={mid.x + half}
            y2={mid.y}
            stroke="#dc2626"
            strokeWidth={3}
            strokeDasharray="10 5"
          />
          {r < 1e-9 ? (
            <circle cx={mid.x} cy={mid.y} r={5} fill="#dc2626" />
          ) : (
            <polygon
              points={pointsAttr(ringPoints(projector, r, h, hMid))}
              fill="#dc2626"
              fillOpacity={0.3}
              stroke="#dc2626"
              strokeWidth={2.6}
            />
          )}
        </g>
      );
    }
    const w = R + 0.6;
    const corners = [
      projector.point([-w, 0, -hMid - 0.4]),
      projector.point([w, 0, -hMid - 0.4]),
      projector.point([w, 0, top - hMid + 0.4]),
      projector.point([-w, 0, top - hMid + 0.4]),
    ];
    return (
      <g data-testid="lt-laser-v-plane">
        <defs>
          <pattern
            id={`lt-hatch-${uid}`}
            patternUnits="userSpaceOnUse"
            width={9}
            height={9}
            patternTransform="rotate(45)"
          >
            <line x1={0} y1={0} x2={0} y2={9} stroke="#dc2626" strokeWidth={2.2} />
          </pattern>
        </defs>
        <polygon
          points={pointsAttr(corners)}
          fill={`url(#lt-hatch-${uid})`}
          fillOpacity={0.7}
          stroke="#dc2626"
          strokeWidth={2.6}
          strokeDasharray="10 5"
        />
      </g>
    );
  };

  return (
    <svg
      className={styles.xrayStageSvg}
      data-testid="lt-stage"
      data-angle={Math.round(displayAngle)}
      data-ghosts={ghostCount}
      data-complete={complete ? 'true' : 'false'}
      viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
      width={STAGE_W}
      height={STAGE_H}
      role="img"
      aria-label={S.lathe.stageLabel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
    >
      <line
        data-testid="lt-axis"
        x1={axisA.x}
        y1={axisA.y}
        x2={axisB.x}
        y2={axisB.y}
        stroke="#475569"
        strokeWidth={4}
        strokeDasharray="12 8"
        strokeLinecap="round"
      />
      {renderNatural()}
      {renderRotating()}
      {renderSolid()}
      {renderAttachedEdge()}
      {renderLaser()}
    </svg>
  );
}
