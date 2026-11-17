/**
 * 힌트 ② `axis-compare` (MC-REVOLVE-AXIS-WRONG):
 * 같은 직각삼각형을 두 번 그린다. 왼쪽은 빗변을 축에 붙여 돌린 모습, 오른쪽은 높이 변을 축에 붙여
 * 돌린 모습이다. 축은 점선이다. 입체 이름은 쓰지 않는다. 직각삼각형을 고르지 않았으면 그리지 않는다.
 */
import type { OverlayProps } from '../../../core/engine-sdk';
import {
  axisChain,
  chainHeight,
  makeProjector,
  planePoint,
  pointsAttr,
  solidSilhouette,
} from '../lathe/render';
import type { LatheEdge } from '../lathe/profiles';
import { solid3dStrings as S } from '../strings.ko';
import type { SolidConfig, SolidState } from '../types';
import { NET_CARD_H, NET_CARD_HEADER_H, NET_CARD_W, NetHelperBox } from './NetHelperBox';

const INNER_W = NET_CARD_W;
const INNER_H = NET_CARD_H - NET_CARD_HEADER_H;
const HALF_W = INNER_W / 2;
const UNIT = 17;
const VIEW = { yaw: 0, pitch: 15 } as const;

function AxisFigure({ edge, testId }: { readonly edge: LatheEdge; readonly testId: string }) {
  const chain = axisChain('right-triangle', edge);
  if (!chain) return null;
  const hMid = chainHeight(chain) / 2;
  const projector = makeProjector(VIEW, UNIT, HALF_W, INNER_H - 6);
  const hull = solidSilhouette(chain, projector);
  const flat = chain.map((p) => projector.point(planePoint(p, 0, hMid)));
  const top = projector.point([0, 0, chainHeight(chain) - hMid + 0.4]);
  const bottom = projector.point([0, 0, -hMid - 0.4]);
  // 돌린 윤곽 위에 처음 도형(옅은 면)을 겹쳐 그린다.
  return (
    <g data-testid={testId}>
      <polygon
        points={pointsAttr(hull)}
        fill="#e6eefc"
        fillOpacity={0.9}
        stroke="#2f6fde"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <polygon
        points={pointsAttr(flat)}
        fill="#bcd4ff"
        fillOpacity={0.8}
        stroke="#1d4fa8"
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <line
        x1={bottom.x}
        y1={bottom.y}
        x2={top.x}
        y2={top.y}
        stroke="#475569"
        strokeWidth={2.2}
        strokeDasharray="5 4"
      />
    </g>
  );
}

export function AxisCompareOverlay({ state }: OverlayProps<SolidConfig, SolidState>) {
  if (state.mode !== 'lathe' || state.profile !== 'right-triangle') return null;
  return (
    <NetHelperBox
      testId="axis-compare"
      titleTestId="axis-compare-title"
      title={S.lathe.overlay.axisCompareTitle}
      titleSize={9.5}
      canvasSelector='svg[data-testid="lt-stage"]'
    >
      <g data-testid="axis-compare-left">
        <AxisFigure edge="hypotenuse" testId="axis-compare-hypotenuse" />
      </g>
      <g transform={`translate(${HALF_W}, 0)`} data-testid="axis-compare-right">
        <AxisFigure edge="leg-vertical" testId="axis-compare-leg" />
      </g>
    </NetHelperBox>
  );
}
