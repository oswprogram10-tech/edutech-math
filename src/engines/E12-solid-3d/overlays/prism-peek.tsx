/**
 * 힌트 ② `prism-peek` (MC-3D-HIDDEN-UNCOUNTED):
 * 지금 시점의 입체를 엑스레이 켠 모습으로 작게 그린다. 개수·번호는 쓰지 않는다.
 * 평면도형(높이 0)에는 숨은 요소가 없어 그리지 않는다.
 */
import type { OverlayProps } from '../../../core/engine-sdk';
import { buildPrismModel, prismKind } from '../prism/geometry';
import { solid3dStrings as S } from '../strings.ko';
import type { SolidConfig, SolidState } from '../types';
import { NET_CARD_H, NET_CARD_HEADER_H, NET_CARD_W, NetHelperBox } from './NetHelperBox';
import { PrismMiniSolid } from './PrismMiniSolid';

export function PrismPeekOverlay({ state }: OverlayProps<SolidConfig, SolidState>) {
  if (state.mode !== 'prism-pyramid') return null;
  const spec = { n: state.sides, height: state.height, top: state.top } as const;
  if (prismKind(spec) === 'base') return null;
  const model = buildPrismModel(spec, state.settings.orientation);
  return (
    <NetHelperBox
      testId="prism-peek"
      titleTestId="prism-peek-title"
      title={S.prism.peekTitle}
      canvasSelector='svg[data-testid="prism-stage"]'
    >
      <PrismMiniSolid
        model={model}
        view={state.view}
        width={NET_CARD_W}
        height={NET_CARD_H - NET_CARD_HEADER_H}
        showHidden
        testIdPrefix="prism-peek"
      />
    </NetHelperBox>
  );
}
