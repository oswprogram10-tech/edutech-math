/**
 * 힌트 ② `apex-gather` (MC-PYRAMID-AS-PRISM-COUNT, "모으기 핸들 재생"):
 * 지금 n의 각기둥을 옅게 그리고, 윗면 꼭짓점들에서 꼭대기 한 점으로 가는 화살표를 그린다.
 * 높이 0이거나 지금 입체가 각기둥이면 그리지 않는다. 개수·번호는 쓰지 않는다.
 */
import type { OverlayProps } from '../../../core/engine-sdk';
import {
  buildPrismModel,
  prismKind,
  prismScaleForStage,
  projectPrismPoint,
  viewBasis,
} from '../prism/geometry';
import { solid3dStrings as S } from '../strings.ko';
import type { SolidConfig, SolidState } from '../types';
import { NET_CARD_H, NET_CARD_HEADER_H, NET_CARD_W, NetHelperBox } from './NetHelperBox';
import { PrismMiniSolid } from './PrismMiniSolid';

const INNER_W = NET_CARD_W;
const INNER_H = NET_CARD_H - NET_CARD_HEADER_H;

export function ApexGatherOverlay({ state }: OverlayProps<SolidConfig, SolidState>) {
  if (state.mode !== 'prism-pyramid') return null;
  const spec = { n: state.sides, height: state.height, top: state.top } as const;
  if (prismKind(spec) !== 'pyramid') return null;

  const prismModel = buildPrismModel({ ...spec, top: 'flat' }, state.settings.orientation);
  const pyramidModel = buildPrismModel(spec, state.settings.orientation);
  const apex = pyramidModel.vertices.find((v) => v.id === 'apex');
  if (!apex) return null;

  const basis = viewBasis(state.view);
  const scale = prismScaleForStage(INNER_W, INNER_H);
  const proj = (p: readonly [number, number, number]) =>
    projectPrismPoint(p, basis, scale, INNER_W, INNER_H);
  const apexPt = proj(apex.p);

  return (
    <NetHelperBox
      testId="apex-gather"
      titleTestId="apex-gather-title"
      title={S.prism.apexGatherTitle}
      canvasSelector='svg[data-testid="prism-stage"]'
    >
      <PrismMiniSolid model={prismModel} view={state.view} width={INNER_W} height={INNER_H} ghost />
      {prismModel.vertices
        .filter((v) => v.id.startsWith('t'))
        .map((v) => {
          const from = proj(v.p);
          const dx = apexPt.x - from.x;
          const dy = apexPt.y - from.y;
          const len = Math.hypot(dx, dy);
          if (len < 6) return null;
          const ux = dx / len;
          const uy = dy / len;
          const tipX = apexPt.x - ux * 7;
          const tipY = apexPt.y - uy * 7;
          const left = `${(tipX - uy * 4 - ux * 7).toFixed(1)},${(tipY + ux * 4 - uy * 7).toFixed(1)}`;
          const right = `${(tipX + uy * 4 - ux * 7).toFixed(1)},${(tipY - ux * 4 - uy * 7).toFixed(1)}`;
          return (
            <g key={`ag-${v.id}`} data-testid={`apex-gather-arrow-${v.id}`}>
              <line
                x1={from.x}
                y1={from.y}
                x2={tipX}
                y2={tipY}
                stroke="#ea580c"
                strokeWidth={2.2}
                strokeLinecap="round"
              />
              <polygon
                points={`${tipX.toFixed(1)},${tipY.toFixed(1)} ${left} ${right}`}
                fill="#ea580c"
              />
            </g>
          );
        })}
      <circle
        data-testid="apex-gather-apex"
        cx={apexPt.x}
        cy={apexPt.y}
        r={6.5}
        fill="#ea580c"
        stroke="#ffffff"
        strokeWidth={2}
      />
    </NetHelperBox>
  );
}
