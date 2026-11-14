/**
 * 힌트 ② `fold-path` (MC-NET-ADJACENT-AS-OPPOSITE):
 * `predict.of` 면을 바닥으로 두고, 바닥에서 예측한 면까지 트리 경로 경첩만 90°로 접어
 * 두 면이 어떻게 만나는지 보여 준다. 진짜 마주 보는 면은 강조하지 않는다.
 * 예측이 없거나 예측이 마주 보는 면이면 그리지 않는다.
 */
import type { OverlayProps } from '../../../core/engine-sdk';
import { bfsPathToFace, evaluateNet, foldTransformsWith, type Vec3 } from '../net/geometry';
import { NET_PLAIN_STYLE, projectOrthoPoint } from '../net/visuals';
import { solid3dStrings as S } from '../strings.ko';
import type { SolidConfig, SolidState } from '../types';
import { NET_CARD_H, NET_CARD_HEADER_H, NET_CARD_W, NetHelperBox } from './NetHelperBox';

const INNER_W = NET_CARD_W;
const INNER_H = NET_CARD_H - NET_CARD_HEADER_H;

export function FoldPathOverlay({ state }: OverlayProps<SolidConfig, SolidState>) {
  if (state.mode !== 'net-fold' || !state.settings.predict || !state.prediction) {
    return null;
  }
  const targetLabel = state.settings.predict.of;
  const predLabel = state.prediction;
  const ofIdx = state.faces.findIndex((f) => f.label === targetLabel);
  const predIdx = state.faces.findIndex((f) => f.label === predLabel);
  if (ofIdx < 0 || predIdx < 0) return null;

  const evaluation = evaluateNet(state.faces, state.settings);
  if (evaluation.valid && evaluation.opposites[targetLabel] === predLabel) {
    return null;
  }

  const pathSet = bfsPathToFace(state.faces, ofIdx, predIdx);
  if (!pathSet.has(predIdx)) return null;

  const transforms = foldTransformsWith(state.faces, ofIdx, (idx) =>
    pathSet.has(idx) ? Math.PI / 2 : 0,
  );

  // 투영 범위 계산
  const allPts: Vec3[] = [];
  for (const tr of transforms) {
    allPts.push(...tr.corners);
  }
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const [x, y, z] of allPts) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  const center: Vec3 = [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2];

  let pMinX = Infinity;
  let pMaxX = -Infinity;
  let pMinY = Infinity;
  let pMaxY = -Infinity;
  for (const pt of allPts) {
    const p = projectOrthoPoint(pt, center, state.viewTurn, 1, 0, 0);
    if (p.x < pMinX) pMinX = p.x;
    if (p.x > pMaxX) pMaxX = p.x;
    if (p.y < pMinY) pMinY = p.y;
    if (p.y > pMaxY) pMaxY = p.y;
  }
  const scale = Math.min(
    (INNER_W - 28) / Math.max(0.5, pMaxX - pMinX),
    (INNER_H - 24) / Math.max(0.5, pMaxY - pMinY),
  );
  const offsetX = INNER_W / 2 - ((pMinX + pMaxX) / 2) * scale;
  const offsetY = INNER_H / 2 - ((pMinY + pMaxY) / 2) * scale;
  const projectPt = (pt: Vec3) =>
    projectOrthoPoint(pt, center, state.viewTurn, scale, offsetX, offsetY);

  const items = transforms
    .map((tr, idx) => {
      const pts = tr.corners.map(projectPt);
      const c = projectPt(tr.center);
      return {
        idx,
        depth: c.depth,
        cx: c.x,
        cy: c.y,
        points: pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '),
      };
    })
    .sort((a, b) => a.depth - b.depth);

  return (
    <NetHelperBox
      testId="fold-path"
      titleTestId="fold-path-title"
      title={S.net.foldPathTitle(targetLabel)}
    >
      {items.map((item) => {
        const face = state.faces[item.idx];
        if (!face) return null;
        const isTarget = item.idx === ofIdx;
        const isPred = item.idx === predIdx;
        const fill = isTarget ? '#dbeafe' : isPred ? '#ffedd5' : NET_PLAIN_STYLE.fill;
        const stroke = isTarget ? '#1d4ed8' : isPred ? '#ea580c' : '#64748b';
        const strokeWidth = isTarget || isPred ? 2.4 : 1.1;

        return (
          <g key={`fp-face-${item.idx}`}>
            <polygon
              points={item.points}
              fill={fill}
              fillOpacity={0.85}
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeLinejoin="round"
            />
            {face.label ? (
              <text
                x={item.cx}
                y={item.cy + 3.5}
                textAnchor="middle"
                fontSize={10}
                fontWeight={isTarget || isPred ? 800 : 600}
                fill="#1d2330"
              >
                {face.label}
              </text>
            ) : null}
          </g>
        );
      })}
    </NetHelperBox>
  );
}
