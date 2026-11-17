/**
 * E12 `xray` 3D 직육면체·사투상 겨냥도 무대(SVG, Three.js 없음).
 *
 * - 끌어 돌리기: 8px(`MOVE_THRESHOLD_PX`) 넘게 끌면 0.5°/px 지역 미리보기 후 떼면 15° 정규화 `set-view`.
 * - 8px 안에서 떼면 현재 도구(`face`·`edge`·`vertex`·`query`) 대상 탭으로 처리.
 * - 숨은 요소의 표시는 숨어 있는 동안 그리지 않으며, 엑스레이 켜기·회전으로 보이면 다시 그린다.
 */
import { useRef, useState } from 'react';
import { clamp } from '../../../core/engine-sdk';
import { solid3dStrings as S } from '../strings.ko';
import type { XrayAction, XrayState } from '../types';
import styles from '../View.module.css';
import {
  XRAY_EDGE_IDS,
  XRAY_FACE_IDS,
  XRAY_VERTEX_IDS,
  edgeEndpoints,
  faceCenter,
  faceCorners,
  hiddenEdges,
  hiddenVertices,
  normalizeView,
  oppositeFace,
  projectXrayPoint,
  sketchHiddenEdges,
  sketchHiddenVertices,
  sketchProject,
  sketchVisibleFaces,
  vertexPoint,
  viewBasis,
  visibleFaces,
  xrayScaleForStage,
  type XrayEdgeId,
  type XrayFaceId,
  type XrayVertexId,
  type XrayViewAngle,
} from '../xray/geometry';
import { MOVE_THRESHOLD_PX } from './usePressGesture';

interface XrayStageProps {
  readonly state: XrayState;
  readonly compact?: boolean;
  readonly readOnly: boolean;
  readonly dispatch: (action: XrayAction) => void;
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

interface Pt2D {
  readonly x: number;
  readonly y: number;
  readonly depth: number;
}

function faceBaseFill(id: XrayFaceId): string {
  switch (id) {
    case 'top':
      return '#ffffff';
    case 'front':
    case 'left':
      return '#f8fafc';
    default:
      return '#eef2f7';
  }
}

export function XrayStage({
  state,
  compact = false,
  readOnly,
  dispatch,
  onLiveMessage,
}: XrayStageProps) {
  const { settings } = state;
  const { w, d, h } = settings.solid;
  const stageW = compact ? 220 : 600;
  const stageH = compact ? 166 : 450;
  const uiScale = compact ? 1 : 1.5;

  const dragRef = useRef<StageDrag | null>(null);
  const suppressNextClickRef = useRef(false);
  const [dragView, setDragView] = useState<XrayViewAngle | null>(null);

  const effectiveView = dragView ?? state.view;
  const isSketchDisplay = settings.display === 'sketch';
  const basis = viewBasis(effectiveView);
  const solidScale = xrayScaleForStage(w, d, h, stageW, stageH);

  // 사투상 표시용 격자 맞춤 변환
  const skSpanX = Math.max(1, 2 * w + d);
  const skSpanY = Math.max(1, 2 * h + d);
  const skScale = Math.min((stageW - 44) / skSpanX, (stageH - 40) / skSpanY);
  const skOffX = (stageW - skSpanX * skScale) / 2;
  const skOffY = (stageH - skSpanY * skScale) / 2;

  const projectPt = (pt: readonly [number, number, number]): Pt2D => {
    if (isSketchDisplay) {
      const [gx, gy] = sketchProject(pt);
      return {
        x: skOffX + gx * skScale,
        y: skOffY + (skSpanY - gy) * skScale,
        depth: -pt[1] + pt[2] * 0.01 + pt[0] * 0.001,
      };
    }
    return projectXrayPoint(pt, w, d, h, basis, solidScale, stageW, stageH);
  };

  const visFaceList = isSketchDisplay ? sketchVisibleFaces() : visibleFaces(effectiveView);
  const visFaceSet = new Set<XrayFaceId>(visFaceList);
  const hiddenEdgeSet = new Set<XrayEdgeId>(
    isSketchDisplay ? sketchHiddenEdges() : hiddenEdges(effectiveView),
  );
  const hiddenVertSet = new Set<XrayVertexId>(
    isSketchDisplay ? sketchHiddenVertices() : hiddenVertices(effectiveView),
  );

  const showAllThrough = state.xray || isSketchDisplay;
  const markedFaceSet = new Set<XrayFaceId>(state.marked.faces);
  const markedEdgeSet = new Set<XrayEdgeId>(state.marked.edges);
  const markedVertSet = new Set<XrayVertexId>(state.marked.vertices);

  const facesToRender = (state.xray ? XRAY_FACE_IDS : visFaceList)
    .map((id) => {
      const corners = faceCorners(id, w, d, h).map(projectPt);
      const center = projectPt(faceCenter(id, w, d, h));
      return {
        id,
        hidden: !visFaceSet.has(id),
        depth: center.depth,
        center,
        points: corners.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '),
      };
    })
    .sort((a, b) => a.depth - b.depth);

  const triggerElementTap = (kind: 'face' | 'edge' | 'vertex', id: string) => {
    if (readOnly) return;
    if (kind === 'face') {
      if (!isFaceIdSafe(id) || !visFaceSet.has(id)) return;
      if (state.tool === 'query' && settings.faceQuery) {
        dispatch({ type: 'query-face', face: id });
        onLiveMessage(S.xray.live.faceQueried);
        return;
      }
      if (state.tool === 'face' && settings.tools.includes('face')) {
        const wasMarked = markedFaceSet.has(id);
        dispatch({ type: 'toggle-mark', kind: 'face', id });
        onLiveMessage(S.xray.live.markChanged(!wasMarked));
      }
      return;
    }
    if (kind === 'edge' && state.tool === 'edge' && settings.tools.includes('edge')) {
      const edgeId = id as XrayEdgeId;
      if (hiddenEdgeSet.has(edgeId) && !showAllThrough) return;
      const wasMarked = markedEdgeSet.has(edgeId);
      dispatch({ type: 'toggle-mark', kind: 'edge', id: edgeId });
      onLiveMessage(S.xray.live.markChanged(!wasMarked));
      return;
    }
    if (kind === 'vertex' && state.tool === 'vertex' && settings.tools.includes('vertex')) {
      const vertId = id as XrayVertexId;
      if (hiddenVertSet.has(vertId) && !showAllThrough) return;
      const wasMarked = markedVertSet.has(vertId);
      dispatch({ type: 'toggle-mark', kind: 'vertex', id: vertId });
      onLiveMessage(S.xray.live.markChanged(!wasMarked));
    }
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const hitEl =
      e.target instanceof Element ? e.target.closest('[data-xray-kind][data-xray-id]') : null;
    const tapKindAttr = hitEl?.getAttribute('data-xray-kind');
    const tapKind =
      tapKindAttr === 'face' || tapKindAttr === 'edge' || tapKindAttr === 'vertex'
        ? tapKindAttr
        : null;
    const tapId = hitEl?.getAttribute('data-xray-id') ?? null;

    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startYaw: state.view.yaw,
      startPitch: state.view.pitch,
      moved: false,
      tapKind,
      tapId,
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
    if (!drag.moved && Math.hypot(dx, dy) > MOVE_THRESHOLD_PX) {
      drag.moved = true;
    }
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
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      const next = normalizeView({
        yaw: drag.startYaw + dx * 0.5,
        pitch: drag.startPitch + dy * 0.5,
      });
      if (next.yaw !== state.view.yaw || next.pitch !== state.view.pitch) {
        dispatch({ type: 'set-view', yaw: next.yaw, pitch: next.pitch });
        onLiveMessage(S.xray.live.turned);
      }
      return;
    }

    if (!drag.moved && drag.tapKind && drag.tapId) {
      suppressNextClickRef.current = true;
      triggerElementTap(drag.tapKind, drag.tapId);
    }
  };

  const handleChildClick = (kind: 'face' | 'edge' | 'vertex', id: string) => {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }
    triggerElementTap(kind, id);
  };

  const faceInteractive =
    !readOnly &&
    ((state.tool === 'face' && settings.tools.includes('face')) ||
      (state.tool === 'query' && settings.faceQuery));
  const edgeInteractive = !readOnly && state.tool === 'edge' && settings.tools.includes('edge');
  const vertexInteractive =
    !readOnly && state.tool === 'vertex' && settings.tools.includes('vertex');

  const stageClass = compact ? styles.xrayCompactStageSvg : styles.xrayStageSvg;

  return (
    <svg
      className={stageClass}
      data-testid="xray-stage"
      data-display={settings.display}
      viewBox={`0 0 ${stageW} ${stageH}`}
      width={stageW}
      height={stageH}
      role="application"
      aria-label={S.xray.stageLabel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(e) => finishPointer(e, false)}
      onPointerCancel={(e) => finishPointer(e, true)}
    >
      <defs>
        <pattern
          id="e12-xray-highlight-hatch"
          width={8}
          height={8}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line x1={0} y1={0} x2={0} y2={8} stroke="#ca8a04" strokeWidth={2} />
        </pattern>
        <pattern id="e12-xray-dots" width={10} height={10} patternUnits="userSpaceOnUse">
          <circle cx={5} cy={5} r={2} fill="#1d4ed8" />
        </pattern>
        <pattern
          id="e12-xray-stripes"
          width={8}
          height={8}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(-45)"
        >
          <line x1={0} y1={0} x2={0} y2={8} stroke="#ea580c" strokeWidth={2.2} />
        </pattern>
      </defs>

      {/* 1. 면 채움(깊이순) */}
      {facesToRender.map((item) => {
        const { id, hidden, center, points } = item;
        const isQuery = state.queryFace !== null;
        const isQueried = isQuery && state.queryFace === id;
        const isParallel =
          isQuery && state.queryFace !== null && id === oppositeFace(state.queryFace);
        const isPerp =
          isQuery &&
          state.queryFace !== null &&
          id !== state.queryFace &&
          id !== oppositeFace(state.queryFace);
        const isHighlight = settings.highlightFace === id;
        const isMarked = !hidden && markedFaceSet.has(id);

        let fill = faceBaseFill(id);
        let patternOverlay: string | null = null;
        let stroke = 'none';
        let strokeWidth = 0;

        if (isQueried) {
          fill = '#dbeafe';
          stroke = '#1d4ed8';
          strokeWidth = 3;
        } else if (isParallel) {
          fill = '#dbeafe';
          patternOverlay = 'url(#e12-xray-dots)';
          stroke = '#1d4ed8';
          strokeWidth = 2.2;
        } else if (isPerp) {
          fill = '#ffedd5';
          patternOverlay = 'url(#e12-xray-stripes)';
          stroke = '#ea580c';
          strokeWidth = 2;
        } else if (isHighlight) {
          fill = '#fef08a';
          patternOverlay = 'url(#e12-xray-highlight-hatch)';
          stroke = '#ca8a04';
          strokeWidth = 2.2;
        }

        if (isMarked) {
          stroke = '#1d4ed8';
          strokeWidth = 3;
        }

        const faceOpacity = state.xray ? 0.35 : 1;

        return (
          <g key={`fvis-${id}`} pointerEvents="none">
            <polygon
              points={points}
              fill={fill}
              fillOpacity={faceOpacity}
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeLinejoin="round"
            />
            {patternOverlay ? (
              <polygon
                points={points}
                fill={patternOverlay}
                fillOpacity={state.xray ? 0.45 : 0.7}
              />
            ) : null}
            {isQueried && (!hidden || state.xray) ? (
              <g>
                <rect
                  x={center.x - 24 * uiScale}
                  y={center.y - 10 * uiScale}
                  width={48 * uiScale}
                  height={20 * uiScale}
                  rx={6 * uiScale}
                  fill="#1d4ed8"
                />
                <text
                  x={center.x}
                  y={center.y + 4 * uiScale}
                  textAnchor="middle"
                  fontSize={10.5 * uiScale}
                  fontWeight={800}
                  fill="#ffffff"
                >
                  {S.xray.selectedFaceTag}
                </text>
              </g>
            ) : null}
            {isMarked ? (
              <g>
                <circle cx={center.x} cy={center.y} r={11 * uiScale} fill="#1d4ed8" />
                <text
                  x={center.x}
                  y={center.y + 4.5 * uiScale}
                  textAnchor="middle"
                  fontSize={13 * uiScale}
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
      {XRAY_FACE_IDS.map((id, idx) => {
        const isVisible = visFaceSet.has(id);
        if (!isVisible && !state.xray) return null;
        const corners = faceCorners(id, w, d, h).map(projectPt);
        const points = corners.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
        const isMarked = isVisible && markedFaceSet.has(id);
        const canTap = isVisible && faceInteractive;

        return (
          <g
            key={`fhit-${id}`}
            data-testid={`xray-face-${id}`}
            data-hidden={isVisible ? 'false' : 'true'}
            data-marked={isMarked ? 'true' : 'false'}
            data-xray-kind={canTap ? 'face' : undefined}
            data-xray-id={canTap ? id : undefined}
            tabIndex={canTap ? 0 : undefined}
            role={canTap ? 'button' : undefined}
            aria-pressed={
              canTap ? (state.tool === 'query' ? state.queryFace === id : isMarked) : undefined
            }
            aria-label={canTap ? S.xray.faceAria(idx + 1) : undefined}
            style={canTap ? { cursor: 'pointer' } : undefined}
            pointerEvents={canTap ? 'auto' : 'none'}
            onClick={() => handleChildClick('face', id)}
            onKeyDown={(e) => {
              if (!canTap) return;
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                triggerElementTap('face', id);
              }
            }}
          >
            <polygon points={points} fill="transparent" />
          </g>
        );
      })}

      {/* 3. 모서리(고정 순서: 숨은 모서리 먼저, 보이는 모서리 나중 + Tab 대상) */}
      {XRAY_EDGE_IDS.map((id, idx) => {
        const isHidden = hiddenEdgeSet.has(id);
        if (isHidden && !showAllThrough) return null;
        const [a, b] = edgeEndpoints(id, w, d, h);
        const pa = projectPt(a);
        const pb = projectPt(b);
        const isMarked = markedEdgeSet.has(id);
        const showMarked = isMarked && (!isHidden || showAllThrough);
        const canTap = edgeInteractive;

        const mx = (pa.x + pb.x) / 2;
        const my = (pa.y + pb.y) / 2;

        return (
          <g
            key={`edge-${id}`}
            data-testid={`xray-edge-${id}`}
            data-hidden={isHidden ? 'true' : 'false'}
            data-marked={showMarked ? 'true' : 'false'}
            data-xray-kind={canTap ? 'edge' : undefined}
            data-xray-id={canTap ? id : undefined}
            tabIndex={canTap ? 0 : undefined}
            role={canTap ? 'button' : undefined}
            aria-pressed={canTap ? isMarked : undefined}
            aria-label={canTap ? S.xray.edgeAria(idx + 1) : undefined}
            style={canTap ? { cursor: 'pointer' } : undefined}
            onClick={() => handleChildClick('edge', id)}
            onKeyDown={(e) => {
              if (!canTap) return;
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                triggerElementTap('edge', id);
              }
            }}
          >
            <line
              x1={pa.x}
              y1={pa.y}
              x2={pb.x}
              y2={pb.y}
              stroke={showMarked ? '#1d4ed8' : isHidden ? '#64748b' : '#1e293b'}
              strokeWidth={(showMarked ? 4.5 : isHidden ? 2 : 2.2) * uiScale}
              strokeDasharray={
                isHidden && !showMarked ? `${6 * uiScale} ${5 * uiScale}` : undefined
              }
              strokeLinecap="round"
            />
            {showMarked ? (
              <g pointerEvents="none">
                <circle cx={mx} cy={my} r={9 * uiScale} fill="#1d4ed8" />
                <text
                  x={mx}
                  y={my + 4 * uiScale}
                  textAnchor="middle"
                  fontSize={11 * uiScale}
                  fontWeight={800}
                  fill="#ffffff"
                >
                  ✓
                </text>
              </g>
            ) : null}
            {canTap ? (
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
      {XRAY_VERTEX_IDS.map((id, idx) => {
        const isHidden = hiddenVertSet.has(id);
        if (isHidden && !showAllThrough) return null;
        const pt = projectPt(vertexPoint(id, w, d, h));
        const isMarked = markedVertSet.has(id);
        const showMarked = isMarked && (!isHidden || showAllThrough);
        const canTap = vertexInteractive;

        return (
          <g
            key={`vert-${id}`}
            data-testid={`xray-vertex-${id}`}
            data-hidden={isHidden ? 'true' : 'false'}
            data-marked={showMarked ? 'true' : 'false'}
            data-xray-kind={canTap ? 'vertex' : undefined}
            data-xray-id={canTap ? id : undefined}
            tabIndex={canTap ? 0 : undefined}
            role={canTap ? 'button' : undefined}
            aria-pressed={canTap ? isMarked : undefined}
            aria-label={canTap ? S.xray.vertexAria(idx + 1) : undefined}
            style={canTap ? { cursor: 'pointer' } : undefined}
            onClick={() => handleChildClick('vertex', id)}
            onKeyDown={(e) => {
              if (!canTap) return;
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                triggerElementTap('vertex', id);
              }
            }}
          >
            {showMarked ? (
              <g pointerEvents="none">
                <circle cx={pt.x} cy={pt.y} r={10 * uiScale} fill="#1d4ed8" />
                <text
                  x={pt.x}
                  y={pt.y + 4 * uiScale}
                  textAnchor="middle"
                  fontSize={12 * uiScale}
                  fontWeight={800}
                  fill="#ffffff"
                >
                  ✓
                </text>
              </g>
            ) : isHidden ? (
              <circle
                cx={pt.x}
                cy={pt.y}
                r={5.5 * uiScale}
                fill="#ffffff"
                stroke="#64748b"
                strokeWidth={2 * uiScale}
              />
            ) : canTap ? (
              <circle cx={pt.x} cy={pt.y} r={5 * uiScale} fill="#64748b" />
            ) : null}

            {canTap ? <circle cx={pt.x} cy={pt.y} r={24} fill="transparent" /> : null}
          </g>
        );
      })}
    </svg>
  );
}

function isFaceIdSafe(id: string): id is XrayFaceId {
  return (XRAY_FACE_IDS as readonly string[]).includes(id);
}
