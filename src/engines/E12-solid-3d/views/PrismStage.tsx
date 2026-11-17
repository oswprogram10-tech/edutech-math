/**
 * E12 `prism-pyramid` 입체 무대(SVG, Three.js 없음).
 *
 * - 끌어 돌리기: 8px(`MOVE_THRESHOLD_PX`) 넘게 끌면 0.5°/px 지역 미리보기 후 떼면 15° 정규화 `set-view`.
 * - 8px 안에서 떼면 현재 도구(`face`·`edge`·`vertex`) 대상 탭으로 처리.
 * - 숨은 요소의 표시는 숨어 있는 동안 그리지 않으며, 엑스레이를 켜거나 돌려서 보이면 다시 그린다.
 * - "한 점으로 모으기"를 바꾸면 윗면 꼭짓점이 꼭대기 한 점으로 모이는(또는 펴지는) 300ms 애니메이션을 그린다.
 *   `prefers-reduced-motion`이거나 `matchMedia`가 없으면 바로 바꾼다.
 * - 면·모서리·꼭짓점 개수와 표시 개수를 쓰지 않는다.
 */
import { useEffect, useRef, useState } from 'react';
import { clamp } from '../../../core/engine-sdk';
import {
  buildPrismModel,
  hiddenPrismEdges,
  hiddenPrismVertices,
  normalizeView,
  polygonPoints,
  prismKind,
  prismScaleForStage,
  projectPrismPoint,
  viewBasis,
  visiblePrismFaces,
  type XrayViewAngle,
} from '../prism/geometry';
import { solid3dStrings as S } from '../strings.ko';
import type { PrismAction, PrismState, PrismTop } from '../types';
import styles from '../View.module.css';
import { MOVE_THRESHOLD_PX } from './usePressGesture';

const STAGE_W = 600;
const STAGE_H = 450;
const GATHER_MS = 300;
const LIGHT: readonly [number, number, number] = [-0.35, -0.55, 0.75];

interface PrismStageProps {
  readonly state: PrismState;
  readonly readOnly: boolean;
  readonly dispatch: (action: PrismAction) => void;
  readonly onLiveMessage: (msg: string) => void;
}

interface StageDrag {
  readonly pointerId: number;
  readonly startX: number;
  readonly startY: number;
  readonly startYaw: number;
  readonly startPitch: number;
  moved: boolean;
  readonly tapKind: 'face' | 'edge' | 'vertex' | null;
  readonly tapId: string | null;
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** 모으기 애니메이션 중 윗면 오므림 정도(1: 각기둥, 0: 한 점). 끝나면 null. */
function useGatherAnimation(top: PrismTop, hasBody: boolean): number | null {
  const [prevTop, setPrevTop] = useState<PrismTop>(top);
  const [scale, setScale] = useState<number | null>(null);

  // 모으기 값이 바뀐 그 렌더에서 바로 시작 값을 정한다(깜빡임 없음).
  if (prevTop !== top) {
    setPrevTop(top);
    const canAnimate =
      hasBody && !prefersReducedMotion() && typeof requestAnimationFrame === 'function';
    setScale(canAnimate ? (top === 'apex' ? 1 : 0) : null);
  }

  const animating = scale !== null;
  useEffect(() => {
    if (!animating) return undefined;
    const from = top === 'apex' ? 1 : 0;
    const to = top === 'apex' ? 0 : 1;
    const startedAt = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = clamp((now - startedAt) / GATHER_MS, 0, 1);
      if (t >= 1) {
        setScale(null);
        return;
      }
      setScale(from + (to - from) * t);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [top, animating]);

  return scale;
}

function faceFill(normal: readonly [number, number, number]): string {
  const len = Math.hypot(normal[0], normal[1], normal[2]) || 1;
  const d = (normal[0] * LIGHT[0] + normal[1] * LIGHT[1] + normal[2] * LIGHT[2]) / len;
  const shade = clamp(0.5 + 0.5 * d, 0, 1);
  const channel = Math.round(226 + 29 * shade);
  return `rgb(${channel - 4}, ${channel}, ${Math.min(255, channel + 4)})`;
}

export function PrismStage({ state, readOnly, dispatch, onLiveMessage }: PrismStageProps) {
  const { settings } = state;
  const spec = { n: state.sides, height: state.height, top: state.top } as const;
  const kind = prismKind(spec);
  const isBase = kind === 'base';

  const dragRef = useRef<StageDrag | null>(null);
  const suppressNextClickRef = useRef(false);
  const [dragView, setDragView] = useState<XrayViewAngle | null>(null);
  const gatherScale = useGatherAnimation(state.top, !isBase);
  const animating = gatherScale !== null && !isBase;

  const effectiveView = dragView ?? state.view;
  const model = animating
    ? buildPrismModel(spec, settings.orientation, gatherScale)
    : buildPrismModel(spec, settings.orientation);
  const basis = viewBasis(effectiveView);
  const scale = prismScaleForStage(STAGE_W, STAGE_H);
  const proj = (p: readonly [number, number, number]) =>
    projectPrismPoint(p, basis, scale, STAGE_W, STAGE_H);

  const visibleSet = new Set(visiblePrismFaces(model, effectiveView));
  const hiddenEdgeSet = new Set(hiddenPrismEdges(model, effectiveView));
  const hiddenVertexSet = new Set(hiddenPrismVertices(model, effectiveView));
  const showAllThrough = state.xray;
  const markedFaces = new Set(state.marked.faces);
  const markedEdges = new Set(state.marked.edges);
  const markedVertices = new Set(state.marked.vertices);

  const tools = settings.tools;
  const markingEnabled = !readOnly && !isBase && !animating;
  const faceInteractive = markingEnabled && state.tool === 'face' && tools.includes('face');
  const edgeInteractive = markingEnabled && state.tool === 'edge' && tools.includes('edge');
  const vertexInteractive = markingEnabled && state.tool === 'vertex' && tools.includes('vertex');

  const facesToRender = (state.xray ? model.faces : model.faces.filter((f) => visibleSet.has(f.id)))
    .map((f) => ({
      face: f,
      depth: proj(f.center).depth,
      points: polygonPoints(f.points.map(proj)),
      center: proj(f.center),
    }))
    .sort((a, b) => a.depth - b.depth);

  const triggerElementTap = (tapKind: 'face' | 'edge' | 'vertex', id: string) => {
    if (!markingEnabled) return;
    if (tapKind === 'face') {
      if (!faceInteractive || !visibleSet.has(id)) return;
      const was = markedFaces.has(id);
      dispatch({ type: 'toggle-mark', kind: 'face', id });
      onLiveMessage(S.prism.live.markChanged(!was));
      return;
    }
    if (tapKind === 'edge') {
      if (!edgeInteractive) return;
      if (hiddenEdgeSet.has(id) && !showAllThrough) return;
      const was = markedEdges.has(id);
      dispatch({ type: 'toggle-mark', kind: 'edge', id });
      onLiveMessage(S.prism.live.markChanged(!was));
      return;
    }
    if (!vertexInteractive) return;
    if (hiddenVertexSet.has(id) && !showAllThrough) return;
    const was = markedVertices.has(id);
    dispatch({ type: 'toggle-mark', kind: 'vertex', id });
    onLiveMessage(S.prism.live.markChanged(!was));
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const hitEl =
      e.target instanceof Element ? e.target.closest('[data-prism-kind][data-prism-id]') : null;
    const attr = hitEl?.getAttribute('data-prism-kind');
    const tapKind = attr === 'face' || attr === 'edge' || attr === 'vertex' ? attr : null;
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startYaw: state.view.yaw,
      startPitch: state.view.pitch,
      moved: false,
      tapKind,
      tapId: hitEl?.getAttribute('data-prism-id') ?? null,
    };
    suppressNextClickRef.current = false;
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      // 일부 테스트 환경에서는 pointer capture를 지원하지 않는다.
    }
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    if (!settings.rotate || readOnly) return;
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
    if (cancelled) return;

    if (drag.moved && settings.rotate && !readOnly) {
      suppressNextClickRef.current = true;
      const next = normalizeView({
        yaw: drag.startYaw + (e.clientX - drag.startX) * 0.5,
        pitch: drag.startPitch + (e.clientY - drag.startY) * 0.5,
      });
      if (next.yaw !== state.view.yaw || next.pitch !== state.view.pitch) {
        dispatch({ type: 'set-view', yaw: next.yaw, pitch: next.pitch });
        onLiveMessage(S.prism.live.turned);
      }
      return;
    }
    if (!drag.moved && drag.tapKind && drag.tapId) {
      suppressNextClickRef.current = true;
      triggerElementTap(drag.tapKind, drag.tapId);
    }
  };

  const handleChildClick = (tapKind: 'face' | 'edge' | 'vertex', id: string) => {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }
    triggerElementTap(tapKind, id);
  };

  const onElementKey = (
    e: React.KeyboardEvent<SVGGElement>,
    tapKind: 'face' | 'edge' | 'vertex',
    id: string,
    canTap: boolean,
  ) => {
    if (!canTap) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      triggerElementTap(tapKind, id);
    }
  };

  return (
    <svg
      className={styles.xrayStageSvg}
      data-testid="prism-stage"
      data-kind={kind}
      data-orientation={settings.orientation}
      viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
      width={STAGE_W}
      height={STAGE_H}
      role="application"
      aria-label={S.prism.stageLabel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(e) => finishPointer(e, false)}
      onPointerCancel={(e) => finishPointer(e, true)}
    >
      {/* 1. 면 채움(깊이순) */}
      {facesToRender.map(({ face, points, center }) => {
        const hidden = !visibleSet.has(face.id);
        const isMarked = !hidden && markedFaces.has(face.id);
        return (
          <g key={`fill-${face.id}`} pointerEvents="none">
            <polygon
              points={points}
              fill={faceFill(face.normal)}
              fillOpacity={state.xray ? 0.35 : 1}
              stroke={isMarked ? '#1d4ed8' : 'none'}
              strokeWidth={isMarked ? 3 : 0}
              strokeLinejoin="round"
            />
            {isMarked ? (
              <g>
                <circle cx={center.x} cy={center.y} r={16} fill="#1d4ed8" />
                <text
                  x={center.x}
                  y={center.y + 6}
                  textAnchor="middle"
                  fontSize={19}
                  fontWeight={800}
                  fill="#ffffff"
                >
                  ✓
                </text>
              </g>
            ) : null}
          </g>
        );
      })}

      {/* 2. 면 누름/Tab 대상(고정 순서) */}
      {model.faces.map((face, idx) => {
        const isVisible = visibleSet.has(face.id);
        if (!isVisible && !state.xray) return null;
        const canTap = isVisible && faceInteractive;
        const isMarked = isVisible && markedFaces.has(face.id);
        return (
          <g
            key={`hit-${face.id}`}
            data-testid={`prism-face-${face.id}`}
            data-hidden={isVisible ? 'false' : 'true'}
            data-marked={isMarked ? 'true' : 'false'}
            data-prism-kind={canTap ? 'face' : undefined}
            data-prism-id={canTap ? face.id : undefined}
            tabIndex={canTap ? 0 : undefined}
            role={canTap ? 'button' : undefined}
            aria-pressed={canTap ? isMarked : undefined}
            aria-label={canTap ? S.prism.faceAria(idx + 1) : undefined}
            style={canTap ? { cursor: 'pointer' } : undefined}
            pointerEvents={canTap ? 'auto' : 'none'}
            onClick={() => handleChildClick('face', face.id)}
            onKeyDown={(e) => onElementKey(e, 'face', face.id, canTap)}
          >
            <polygon points={polygonPoints(face.points.map(proj))} fill="transparent" />
          </g>
        );
      })}

      {/* 3. 모서리(고정 순서) */}
      {model.edges.map((edge, idx) => {
        const isHidden = hiddenEdgeSet.has(edge.id);
        if (isHidden && !showAllThrough) return null;
        const pa = proj(edge.a);
        const pb = proj(edge.b);
        const isMarked = markedEdges.has(edge.id);
        const showMarked = isMarked && (!isHidden || showAllThrough);
        const mx = (pa.x + pb.x) / 2;
        const my = (pa.y + pb.y) / 2;
        return (
          <g
            key={`edge-${edge.id}`}
            data-testid={`prism-edge-${edge.id}`}
            data-hidden={isHidden ? 'true' : 'false'}
            data-marked={showMarked ? 'true' : 'false'}
            data-prism-kind={edgeInteractive ? 'edge' : undefined}
            data-prism-id={edgeInteractive ? edge.id : undefined}
            tabIndex={edgeInteractive ? 0 : undefined}
            role={edgeInteractive ? 'button' : undefined}
            aria-pressed={edgeInteractive ? isMarked : undefined}
            aria-label={edgeInteractive ? S.prism.edgeAria(idx + 1) : undefined}
            style={edgeInteractive ? { cursor: 'pointer' } : undefined}
            pointerEvents={isBase ? 'none' : undefined}
            onClick={() => handleChildClick('edge', edge.id)}
            onKeyDown={(e) => onElementKey(e, 'edge', edge.id, edgeInteractive)}
          >
            <line
              x1={pa.x}
              y1={pa.y}
              x2={pb.x}
              y2={pb.y}
              stroke={showMarked ? '#1d4ed8' : isHidden ? '#64748b' : '#1e293b'}
              strokeWidth={showMarked ? 6.5 : isHidden ? 3 : 3.3}
              strokeDasharray={isHidden && !showMarked ? '9 7' : undefined}
              strokeLinecap="round"
            />
            {showMarked ? (
              <g pointerEvents="none">
                <circle cx={mx} cy={my} r={13} fill="#1d4ed8" />
                <text
                  x={mx}
                  y={my + 5}
                  textAnchor="middle"
                  fontSize={16}
                  fontWeight={800}
                  fill="#ffffff"
                >
                  ✓
                </text>
              </g>
            ) : null}
            {edgeInteractive ? (
              <line
                x1={pa.x}
                y1={pa.y}
                x2={pb.x}
                y2={pb.y}
                stroke="transparent"
                strokeWidth={28}
                strokeLinecap="round"
              />
            ) : null}
          </g>
        );
      })}

      {/* 4. 꼭짓점(고정 순서) */}
      {model.vertices.map((vertex, idx) => {
        const isHidden = hiddenVertexSet.has(vertex.id);
        if (isHidden && !showAllThrough) return null;
        const pt = proj(vertex.p);
        const isMarked = markedVertices.has(vertex.id);
        const showMarked = isMarked && (!isHidden || showAllThrough);
        return (
          <g
            key={`vert-${vertex.id}`}
            data-testid={`prism-vertex-${vertex.id}`}
            data-hidden={isHidden ? 'true' : 'false'}
            data-marked={showMarked ? 'true' : 'false'}
            data-prism-kind={vertexInteractive ? 'vertex' : undefined}
            data-prism-id={vertexInteractive ? vertex.id : undefined}
            tabIndex={vertexInteractive ? 0 : undefined}
            role={vertexInteractive ? 'button' : undefined}
            aria-pressed={vertexInteractive ? isMarked : undefined}
            aria-label={vertexInteractive ? S.prism.vertexAria(idx + 1) : undefined}
            style={vertexInteractive ? { cursor: 'pointer' } : undefined}
            pointerEvents={isBase ? 'none' : undefined}
            onClick={() => handleChildClick('vertex', vertex.id)}
            onKeyDown={(e) => onElementKey(e, 'vertex', vertex.id, vertexInteractive)}
          >
            {showMarked ? (
              <g pointerEvents="none">
                <circle cx={pt.x} cy={pt.y} r={15} fill="#1d4ed8" />
                <text
                  x={pt.x}
                  y={pt.y + 5.5}
                  textAnchor="middle"
                  fontSize={17}
                  fontWeight={800}
                  fill="#ffffff"
                >
                  ✓
                </text>
              </g>
            ) : isHidden ? (
              <circle cx={pt.x} cy={pt.y} r={8} fill="#ffffff" stroke="#64748b" strokeWidth={3} />
            ) : vertexInteractive ? (
              <circle cx={pt.x} cy={pt.y} r={7.5} fill="#64748b" />
            ) : null}
            {vertexInteractive ? <circle cx={pt.x} cy={pt.y} r={24} fill="transparent" /> : null}
          </g>
        );
      })}
    </svg>
  );
}
