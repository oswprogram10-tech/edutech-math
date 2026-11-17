/**
 * 힌트 ② `xray-peek` (MC-3D-HIDDEN-UNCOUNTED):
 * 현재 시점의 상자를 엑스레이 켠 모습(면 반투명, 숨은 모서리 굵은 주황 점선, 숨은 꼭짓점 속 빈 원)으로 그린다.
 * 개수·번호는 쓰지 않으며, `display === 'sketch'`면 그리지 않는다.
 */
import type { OverlayProps } from '../../../core/engine-sdk';
import { solid3dStrings as S } from '../strings.ko';
import type { SolidConfig, SolidState } from '../types';
import {
  XRAY_EDGE_IDS,
  XRAY_FACE_IDS,
  edgeEndpoints,
  faceCenter,
  faceCorners,
  hiddenEdges,
  hiddenVertices,
  projectXrayPoint,
  vertexPoint,
  viewBasis,
  xrayScaleForStage,
} from '../xray/geometry';
import { NET_CARD_H, NET_CARD_HEADER_H, NET_CARD_W, NetHelperBox } from './NetHelperBox';

const INNER_W = NET_CARD_W;
const INNER_H = NET_CARD_H - NET_CARD_HEADER_H;

export function XrayPeekOverlay({ state }: OverlayProps<SolidConfig, SolidState>) {
  if (state.mode !== 'xray' || state.settings.display === 'sketch') {
    return null;
  }

  const { w, d, h } = state.settings.solid;
  const basis = viewBasis(state.view);
  const scale = xrayScaleForStage(w, d, h, INNER_W, INNER_H);
  const proj = (pt: readonly [number, number, number]) =>
    projectXrayPoint(pt, w, d, h, basis, scale, INNER_W, INNER_H);

  const facesSorted = XRAY_FACE_IDS.map((id) => {
    const pts = faceCorners(id, w, d, h).map(proj);
    const c = proj(faceCenter(id, w, d, h));
    return {
      id,
      depth: c.depth,
      points: pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '),
    };
  }).sort((a, b) => a.depth - b.depth);

  const hiddenEdgeSet = new Set(hiddenEdges(state.view));
  const hiddenVertIds = hiddenVertices(state.view);

  return (
    <NetHelperBox
      testId="xray-peek"
      titleTestId="xray-peek-title"
      title={S.xray.peekTitle}
      canvasSelector='svg[data-testid="xray-sketch"], svg[data-testid="xray-stage"]'
    >
      {facesSorted.map((f) => (
        <polygon
          key={`xp-face-${f.id}`}
          points={f.points}
          fill="#e2e8f0"
          fillOpacity={0.35}
          stroke="none"
        />
      ))}

      {XRAY_EDGE_IDS.filter((id) => hiddenEdgeSet.has(id)).map((id) => {
        const [a, b] = edgeEndpoints(id, w, d, h);
        const pa = proj(a);
        const pb = proj(b);
        return (
          <line
            key={`xp-he-${id}`}
            data-testid={`xray-peek-edge-${id}`}
            x1={pa.x}
            y1={pa.y}
            x2={pb.x}
            y2={pb.y}
            stroke="#ea580c"
            strokeWidth={2.8}
            strokeDasharray="6 4"
            strokeLinecap="round"
          />
        );
      })}

      {XRAY_EDGE_IDS.filter((id) => !hiddenEdgeSet.has(id)).map((id) => {
        const [a, b] = edgeEndpoints(id, w, d, h);
        const pa = proj(a);
        const pb = proj(b);
        return (
          <line
            key={`xp-ve-${id}`}
            x1={pa.x}
            y1={pa.y}
            x2={pb.x}
            y2={pb.y}
            stroke="#334155"
            strokeWidth={1.6}
            strokeLinecap="round"
          />
        );
      })}

      {hiddenVertIds.map((vid) => {
        const pt = proj(vertexPoint(vid, w, d, h));
        return (
          <circle
            key={`xp-hv-${vid}`}
            data-testid={`xray-peek-vertex-${vid}`}
            cx={pt.x}
            cy={pt.y}
            r={5}
            fill="#ffffff"
            stroke="#ea580c"
            strokeWidth={2.2}
          />
        );
      })}
    </NetHelperBox>
  );
}
