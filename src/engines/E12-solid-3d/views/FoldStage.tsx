/**
 * E12 `net-fold` 접기 3D 정사영 무대(SVG, Three.js 없음).
 *
 * - 고정 정사영: 요 각도 `45° + 90° * viewTurn`, 내려보기 `30°`.
 * - 화가 알고리즘(면 중심 깊이순), 채움 불투명도 0.85.
 * - "접기" 시 0 → 90° 를 1.6초 동안 `requestAnimationFrame`으로 움직인다(`animate:false` / `prefers-reduced-motion` 제외).
 */
import { useEffect, useRef, useState } from 'react';
import { foldTransforms, type NetEvaluation, type Vec3 } from '../net/geometry';
import {
  boxCenter3D,
  computeStageFit,
  formatNetFoldStatus,
  mapSharedEdgeInFace3D,
  NET_LOCKED_STYLE,
  NET_PLAIN_STYLE,
  pairStyleForSlot,
  projectOrthoPoint,
  slotCorners3D,
  zigzagPath,
  type PairShape,
} from '../net/visuals';
import { solid3dStrings as S } from '../strings.ko';
import type { NetFoldAction, NetFoldState } from '../types';
import styles from '../View.module.css';

const STAGE_W = 216;
const STAGE_H = 168;
const ANIM_DURATION_MS = 1600;
const HALF_PI = Math.PI / 2;

interface FoldStageProps {
  readonly state: NetFoldState;
  readonly evaluation: NetEvaluation;
  readonly readOnly: boolean;
  readonly dispatch: (action: NetFoldAction) => void;
  readonly onLiveMessage: (msg: string) => void;
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function StagePairMark({
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
    return <circle cx={cx} cy={cy} r={4.5} fill={color} />;
  }
  if (shape === 'triangle') {
    return (
      <polygon points={`${cx},${cy - 5} ${cx + 5},${cy + 4} ${cx - 5},${cy + 4}`} fill={color} />
    );
  }
  return <rect x={cx - 4} y={cy - 4} width={8} height={8} rx={1.2} fill={color} />;
}

interface DrawableItem {
  readonly key: string;
  readonly depth: number;
  readonly kind: 'face' | 'missing';
  readonly pointsAttr: string;
  readonly center2D: { readonly x: number; readonly y: number };
  readonly faceIdx?: number;
  readonly slotIdx?: number;
}

export function FoldStage({
  state,
  evaluation,
  readOnly,
  dispatch,
  onLiveMessage,
}: FoldStageProps) {
  const instantOnly = !state.settings.animate || prefersReducedMotion();
  const [animAngle, setAnimAngle] = useState<number>(() => (state.folded ? HALF_PI : 0));
  const angleRef = useRef<number>(state.folded ? HALF_PI : 0);

  useEffect(() => {
    const target = state.folded ? HALF_PI : 0;
    if (
      instantOnly ||
      typeof window === 'undefined' ||
      typeof window.requestAnimationFrame !== 'function'
    ) {
      angleRef.current = target;
      return;
    }
    const startAngle = angleRef.current;
    if (Math.abs(target - startAngle) < 1e-4) {
      angleRef.current = target;
      return;
    }
    const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    let rafId = 0;
    const step = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, Math.max(0, elapsed / ANIM_DURATION_MS));
      const next = startAngle + (target - startAngle) * easeInOut(t);
      angleRef.current = next;
      setAnimAngle(next);
      if (t < 1) {
        rafId = window.requestAnimationFrame(step);
      }
    };
    rafId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(rafId);
  }, [state.folded, instantOnly]);

  const effectiveAngle = instantOnly ? (state.folded ? HALF_PI : 0) : animAngle;
  const isSettled = state.folded && Math.abs(effectiveAngle - HALF_PI) < 0.02;

  const fit = computeStageFit(state.faces, evaluation, state.viewTurn, STAGE_W, STAGE_H, 20);
  const projectPt = (pt: Vec3) =>
    projectOrthoPoint(pt, fit.center, state.viewTurn, fit.scale, fit.offsetX, fit.offsetY);

  const transforms = foldTransforms(state.faces, effectiveAngle);
  const overlapSet = new Set(evaluation.overlapFaceIndices);
  const showPairColors = state.folded && evaluation.valid && state.settings.pairColors;
  const showCollisions = isSettled && !evaluation.valid && state.settings.collisionHighlight;

  const items: DrawableItem[] = [];
  transforms.forEach((tr, idx) => {
    const pts = tr.corners.map(projectPt);
    const cProj = projectPt(tr.center);
    items.push({
      key: `fold-face-${idx}`,
      depth: cProj.depth,
      kind: 'face',
      pointsAttr: pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '),
      center2D: { x: cProj.x, y: cProj.y },
      faceIdx: idx,
    });
  });

  if (showCollisions) {
    for (const slotIdx of evaluation.missingSlots) {
      const box = evaluation.slotBoxes[slotIdx];
      if (!box) continue;
      const pts = slotCorners3D(box).map(projectPt);
      const cProj = projectPt(boxCenter3D(box));
      items.push({
        key: `missing-slot-${slotIdx}`,
        depth: cProj.depth + 0.01,
        kind: 'missing',
        pointsAttr: pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '),
        center2D: { x: cProj.x, y: cProj.y },
        slotIdx,
      });
    }
  }

  items.sort((a, b) => a.depth - b.depth);

  const tornPaths: string[] = [];
  if (showCollisions) {
    for (const torn of evaluation.tornEdgeList) {
      for (const faceIdx of [torn.a, torn.b]) {
        const face = state.faces[faceIdx];
        const tr = transforms[faceIdx];
        if (!face || !tr) continue;
        const [e1, e2] = mapSharedEdgeInFace3D(face, tr, torn.segment);
        const p1 = projectPt(e1);
        const p2 = projectPt(e2);
        tornPaths.push(zigzagPath(p1.x, p1.y, p2.x, p2.y, 3.5, 6));
      }
    }
  }

  const statusText = state.folded
    ? formatNetFoldStatus(evaluation, state.settings.pairColors)
    : S.net.unfoldedHint;

  return (
    <div className={styles.panelBlock}>
      <div className={styles.netStageWrap}>
        <svg
          className={styles.netStageSvg}
          data-testid="net-fold-stage"
          width={STAGE_W}
          height={STAGE_H}
          viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
          role="img"
          aria-label={S.net.stageLabel}
        >
          <defs>
            <pattern
              id="e12-net-stage-hatch"
              width={8}
              height={8}
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <line x1={0} y1={0} x2={0} y2={8} stroke="#dc2626" strokeWidth={2.2} />
            </pattern>
          </defs>

          {items.map((item) => {
            if (item.kind === 'missing') {
              return (
                <g key={item.key} data-testid={`net-missing-slot-${item.slotIdx}`}>
                  <polygon
                    className={styles.netMissingSlot}
                    points={item.pointsAttr}
                    fill="rgba(254, 226, 226, 0.28)"
                    stroke="#dc2626"
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    strokeLinejoin="round"
                  />
                  <text
                    x={item.center2D.x}
                    y={item.center2D.y + 4}
                    textAnchor="middle"
                    fontSize={10}
                    fontWeight={800}
                    fill="#b91c1c"
                  >
                    {S.net.missingTag}
                  </text>
                </g>
              );
            }

            const idx = item.faceIdx ?? 0;
            const face = state.faces[idx];
            if (!face) return null;
            const slot = evaluation.slotOf[idx] ?? null;
            const pairStyle = showPairColors ? pairStyleForSlot(slot) : null;
            const isOverlap = showCollisions && overlapSet.has(idx);
            const isPredictMode = state.settings.predict !== null;
            const isPredictTarget =
              isPredictMode && face.label !== null && face.label === state.settings.predict?.of;
            const isPredicted =
              isPredictMode && face.label !== null && face.label === state.prediction;
            const baseStyle = pairStyle ?? (face.locked ? NET_LOCKED_STYLE : NET_PLAIN_STYLE);
            const strokeColor = isPredicted
              ? '#ea580c'
              : isPredictTarget
                ? '#1d4ed8'
                : isOverlap
                  ? '#dc2626'
                  : baseStyle.stroke;
            const strokeWidth = isPredicted || isPredictTarget ? 3 : 1.5;

            return (
              <g key={item.key} data-pair-shape={pairStyle ? pairStyle.shape : undefined}>
                <polygon
                  points={item.pointsAttr}
                  fill={baseStyle.fill}
                  fillOpacity={0.85}
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeLinejoin="round"
                />
                {isOverlap ? (
                  <polygon
                    points={item.pointsAttr}
                    fill="url(#e12-net-stage-hatch)"
                    fillOpacity={0.65}
                  />
                ) : null}
                {pairStyle ? (
                  <StagePairMark
                    shape={pairStyle.shape}
                    cx={face.label ? item.center2D.x + 10 : item.center2D.x}
                    cy={face.label ? item.center2D.y - 8 : item.center2D.y}
                    color={pairStyle.stroke}
                  />
                ) : null}
                {face.label ? (
                  <text
                    x={item.center2D.x}
                    y={item.center2D.y + 4}
                    textAnchor="middle"
                    fontSize={12}
                    fontWeight={800}
                    fill="#1d2330"
                  >
                    {face.label}
                  </text>
                ) : null}
                {isOverlap ? (
                  <text
                    x={item.center2D.x}
                    y={item.center2D.y + (face.label ? 15 : 4)}
                    textAnchor="middle"
                    fontSize={10}
                    fontWeight={800}
                    fill="#b91c1c"
                  >
                    {S.net.overlapTag}
                  </text>
                ) : null}
              </g>
            );
          })}

          {tornPaths.map((d, i) => (
            <path
              key={`stage-torn-${i}`}
              d={d}
              fill="none"
              stroke="#dc2626"
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </svg>

        {state.folded ? (
          <div className={styles.netStageTurns}>
            <button
              type="button"
              className={styles.button}
              data-testid="net-turn-left"
              disabled={readOnly}
              aria-label={S.turnLeft}
              onClick={() => {
                dispatch({ type: 'turn', dir: 'left' });
                onLiveMessage(S.live.turned);
              }}
            >
              <span>↺</span>
            </button>
            <button
              type="button"
              className={styles.button}
              data-testid="net-turn-right"
              disabled={readOnly}
              aria-label={S.turnRight}
              onClick={() => {
                dispatch({ type: 'turn', dir: 'right' });
                onLiveMessage(S.live.turned);
              }}
            >
              <span>↻</span>
            </button>
          </div>
        ) : null}
      </div>

      {state.folded ? (
        <p
          className={styles.netStatusText}
          data-testid="net-status"
          data-valid={evaluation.valid ? 'true' : 'false'}
        >
          {statusText}
        </p>
      ) : (
        <p className={styles.hint}>{statusText}</p>
      )}
    </div>
  );
}
