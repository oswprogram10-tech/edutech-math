/**
 * 힌트 ② `stand-up` (MC-PRISM-BASE-ORIENTATION, "입체를 회전시켜 세움"):
 * 눕힌 입체(왼쪽) → 화살표 → 세운 입체(오른쪽)를 작게 그린다.
 * 밑면에 색이나 이름을 붙이지 않는다. 입체가 이미 서 있으면 그리지 않는다.
 */
import type { OverlayProps } from '../../../core/engine-sdk';
import { buildPrismModel } from '../prism/geometry';
import { solid3dStrings as S } from '../strings.ko';
import type { SolidConfig, SolidState } from '../types';
import { NET_CARD_H, NET_CARD_HEADER_H, NET_CARD_W, NetHelperBox } from './NetHelperBox';
import { PrismMiniSolid } from './PrismMiniSolid';

const INNER_W = NET_CARD_W;
const INNER_H = NET_CARD_H - NET_CARD_HEADER_H;
const HALF_W = 92;

export function StandUpOverlay({ state }: OverlayProps<SolidConfig, SolidState>) {
  if (state.mode !== 'prism-pyramid' || state.settings.orientation !== 'lying') return null;
  const spec = { n: state.sides, height: state.height, top: state.top } as const;
  const lying = buildPrismModel(spec, 'lying');
  const upright = buildPrismModel(spec, 'upright');
  const midY = INNER_H / 2;
  const midX = INNER_W / 2;

  return (
    <NetHelperBox
      testId="stand-up"
      titleTestId="stand-up-title"
      title={S.prism.standUpTitle}
      canvasSelector='svg[data-testid="prism-stage"]'
    >
      <g data-testid="stand-up-lying">
        <PrismMiniSolid model={lying} view={state.view} width={HALF_W} height={INNER_H} />
      </g>
      <g data-testid="stand-up-arrow">
        <line
          x1={midX - 12}
          y1={midY}
          x2={midX + 4}
          y2={midY}
          stroke="#475569"
          strokeWidth={2.4}
          strokeLinecap="round"
        />
        <polygon
          points={`${midX + 12},${midY} ${midX + 4},${midY - 6} ${midX + 4},${midY + 6}`}
          fill="#475569"
        />
      </g>
      <g transform={`translate(${INNER_W - HALF_W}, 0)`} data-testid="stand-up-upright">
        <PrismMiniSolid model={upright} view={state.view} width={HALF_W} height={INNER_H} />
      </g>
    </NetHelperBox>
  );
}
