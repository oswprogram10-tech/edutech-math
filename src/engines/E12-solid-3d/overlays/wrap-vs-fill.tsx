/**
 * 힌트 ② `wrap-vs-fill` (MC-VOLUME-SURFACE-CONFUSION):
 * 왼쪽에 포장지로 겉만 감싼 상자(빗금), 오른쪽에 쌓기나무로 속을 채운 상자(칸 격자)를 나란히 그린다.
 * 수·넓이·부피 결과를 쓰지 않는다.
 */
import type { OverlayProps } from '../../../core/engine-sdk';
import { solid3dStrings as S } from '../strings.ko';
import type { SolidConfig, SolidState } from '../types';
import { NET_CARD_H, NET_CARD_HEADER_H, NET_CARD_W, NetHelperBox } from './NetHelperBox';
import { SvIsoBoxMini } from './svMini';
import { isoBoxSize, svOverlayAnchor } from './svMiniSize';

const INNER_W = NET_CARD_W;
const INNER_H = NET_CARD_H - NET_CARD_HEADER_H;
const UNIT = 22;
const BOX = { w: 3, d: 2, h: 2 } as const;

export function WrapVsFillOverlay({ state }: OverlayProps<SolidConfig, SolidState>) {
  if (state.mode !== 'surface-volume') return null;
  const size = isoBoxSize(BOX.w, BOX.d, BOX.h, UNIT);
  const half = INNER_W / 2;
  const offX = (half - size.width) / 2;
  const offY = (INNER_H - 22 - size.height) / 2;

  return (
    <NetHelperBox
      testId="wrap-vs-fill"
      titleTestId="wrap-vs-fill-title"
      title={S.sv.overlay.wrapVsFillTitle}
      canvasSelector={svOverlayAnchor(state.settings.variant)}
    >
      <g data-testid="wrap-vs-fill-wrap" transform={`translate(${offX}, ${offY})`}>
        <SvIsoBoxMini {...BOX} unit={UNIT} kind="hatch" idPrefix="wvf" />
      </g>
      <g data-testid="wrap-vs-fill-fill" transform={`translate(${half + offX}, ${offY})`}>
        <SvIsoBoxMini {...BOX} unit={UNIT} kind="cubes" idPrefix="wvf" />
      </g>
      <text
        x={half / 2}
        y={INNER_H - 10}
        textAnchor="middle"
        fontSize={13}
        fontWeight={800}
        fill="#d9730d"
      >
        {S.sv.overlay.wrapLabel}
      </text>
      <text
        x={half + half / 2}
        y={INNER_H - 10}
        textAnchor="middle"
        fontSize={13}
        fontWeight={800}
        fill="#1d4fa8"
      >
        {S.sv.overlay.fillLabel}
      </text>
    </NetHelperBox>
  );
}
