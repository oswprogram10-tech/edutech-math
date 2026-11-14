/**
 * 힌트 ② `fold-collision` (MC-NET-ANY-SIX):
 * 학생의 현재 전개도를 90° 접은 그림을 작게 그려 겹친 면(빨간 빗금+"겹침")과
 * 빈 슬롯(점선+"빈 곳")을 보인다. 접지 않은 상태에서도 그리며, valid면 그리지 않는다.
 */
import type { OverlayProps } from '../../../core/engine-sdk';
import { evaluateNet, foldTransforms, type Vec3 } from '../net/geometry';
import {
  boxCenter3D,
  computeStageFit,
  NET_LOCKED_STYLE,
  NET_PLAIN_STYLE,
  projectOrthoPoint,
  slotCorners3D,
} from '../net/visuals';
import { solid3dStrings as S } from '../strings.ko';
import type { SolidConfig, SolidState } from '../types';
import { NET_CARD_H, NET_CARD_HEADER_H, NET_CARD_W, NetHelperBox } from './NetHelperBox';

const INNER_W = NET_CARD_W;
const INNER_H = NET_CARD_H - NET_CARD_HEADER_H;

export function FoldCollisionOverlay({ state }: OverlayProps<SolidConfig, SolidState>) {
  if (state.mode !== 'net-fold' || state.faces.length === 0) return null;
  const evaluation = evaluateNet(state.faces, state.settings);
  if (evaluation.valid) return null;

  const fit = computeStageFit(state.faces, evaluation, state.viewTurn, INNER_W, INNER_H, 18);
  const projectPt = (pt: Vec3) =>
    projectOrthoPoint(pt, fit.center, state.viewTurn, fit.scale, fit.offsetX, fit.offsetY);

  const transforms = foldTransforms(state.faces, Math.PI / 2);
  const overlapSet = new Set(evaluation.overlapFaceIndices);

  const items: {
    readonly key: string;
    readonly depth: number;
    readonly kind: 'face' | 'missing';
    readonly points: string;
    readonly cx: number;
    readonly cy: number;
    readonly idx: number;
  }[] = [];

  transforms.forEach((tr, idx) => {
    const pts = tr.corners.map(projectPt);
    const c = projectPt(tr.center);
    items.push({
      key: `hc-face-${idx}`,
      depth: c.depth,
      kind: 'face',
      points: pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '),
      cx: c.x,
      cy: c.y,
      idx,
    });
  });

  for (const slotIdx of evaluation.missingSlots) {
    const box = evaluation.slotBoxes[slotIdx];
    if (!box) continue;
    const pts = slotCorners3D(box).map(projectPt);
    const c = projectPt(boxCenter3D(box));
    items.push({
      key: `hc-miss-${slotIdx}`,
      depth: c.depth + 0.01,
      kind: 'missing',
      points: pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '),
      cx: c.x,
      cy: c.y,
      idx: slotIdx,
    });
  }

  items.sort((a, b) => a.depth - b.depth);

  return (
    <NetHelperBox
      testId="fold-collision"
      titleTestId="fold-collision-title"
      title={S.net.foldCollisionTitle}
    >
      <defs>
        <pattern
          id="e12-overlay-collision-hatch"
          width={7}
          height={7}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line x1={0} y1={0} x2={0} y2={7} stroke="#dc2626" strokeWidth={2} />
        </pattern>
      </defs>

      {items.map((item) => {
        if (item.kind === 'missing') {
          return (
            <g key={item.key} data-testid={`fold-collision-missing-${item.idx}`}>
              <polygon
                points={item.points}
                fill="rgba(254, 226, 226, 0.3)"
                stroke="#dc2626"
                strokeWidth={1.8}
                strokeDasharray="4 3"
              />
              <text
                x={item.cx}
                y={item.cy + 3.5}
                textAnchor="middle"
                fontSize={9}
                fontWeight={800}
                fill="#b91c1c"
              >
                {S.net.missingTag}
              </text>
            </g>
          );
        }

        const face = state.faces[item.idx];
        const isOverlap = overlapSet.has(item.idx);
        const base = face?.locked ? NET_LOCKED_STYLE : NET_PLAIN_STYLE;
        return (
          <g key={item.key}>
            <polygon
              points={item.points}
              fill={base.fill}
              fillOpacity={0.85}
              stroke={isOverlap ? '#dc2626' : base.stroke}
              strokeWidth={isOverlap ? 2 : 1.2}
            />
            {isOverlap ? (
              <>
                <polygon
                  points={item.points}
                  fill="url(#e12-overlay-collision-hatch)"
                  fillOpacity={0.65}
                />
                <text
                  x={item.cx}
                  y={item.cy + 3.5}
                  textAnchor="middle"
                  fontSize={9}
                  fontWeight={800}
                  fill="#b91c1c"
                >
                  {S.net.overlapTag}
                </text>
              </>
            ) : null}
          </g>
        );
      })}
    </NetHelperBox>
  );
}
