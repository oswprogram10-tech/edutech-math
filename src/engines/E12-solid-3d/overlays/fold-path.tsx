/**
 * 힌트 ② `fold-path` (MC-NET-ADJACENT-AS-OPPOSITE):
 * `predict.of` 면을 바닥으로 두고, 바닥에서 예측한 면까지 트리 경로 경첩만 90°로 접어
 * 두 면이 어떻게 만나는지 보여 준다. 진짜 마주 보는 면은 강조하지 않는다.
 * 예측이 없거나 예측이 마주 보는 면이면 그리지 않는다.
 */
import type { OverlayProps } from '../../../core/engine-sdk';
import { bfsPathToFace, evaluateNet, foldTransformsWith } from '../net/geometry';
import { computeFoldPathLayout, NET_PLAIN_STYLE } from '../net/visuals';
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
  const layout = computeFoldPathLayout(
    transforms,
    ofIdx,
    predIdx,
    state.viewTurn,
    INNER_W,
    INNER_H,
  );
  const starItem = layout.items.find((it) => it.idx === ofIdx);

  return (
    <NetHelperBox
      testId="fold-path"
      titleTestId="fold-path-title"
      title={S.net.foldPathTitle(targetLabel)}
    >
      <g data-testid="fold-path-scene" data-view-turn={layout.viewTurn}>
        {layout.items.map((item) => {
          const face = state.faces[item.idx];
          if (!face) return null;
          const isTarget = item.idx === ofIdx;
          const isPred = item.idx === predIdx;
          const fill = isTarget ? '#dbeafe' : isPred ? '#ffedd5' : NET_PLAIN_STYLE.fill;
          const stroke = isTarget ? '#1d4ed8' : isPred ? '#ea580c' : '#64748b';
          const strokeWidth = isTarget || isPred ? 2.4 : 1.1;

          return (
            <g
              key={`fp-face-${item.idx}`}
              data-face-idx={item.idx}
              data-depth={item.depth.toFixed(3)}
            >
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

        {starItem ? (
          <polygon
            data-testid="fold-path-target-outline"
            points={starItem.points}
            fill="none"
            stroke="#1d4ed8"
            strokeWidth={2.8}
            strokeDasharray="5 3"
            strokeLinejoin="round"
            pointerEvents="none"
          />
        ) : null}
      </g>
    </NetHelperBox>
  );
}
