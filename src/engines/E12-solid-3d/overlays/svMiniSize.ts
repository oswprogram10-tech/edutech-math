/** `surface-volume` 오버레이용 등각 상자 그림의 viewBox 크기. */
import { computeStageLayout } from '../layout';

export function isoBoxSize(w: number, d: number, h: number, unit: number) {
  const layout = computeStageLayout(w, d, h, unit);
  return layout.viewBox;
}

/**
 * 오버레이를 맞출 본 그림 선택자. steps는 단계별 무대 svg, fixed-volume은 가늘고 긴 상자 그림이라
 * 오버레이가 너무 작아지므로 무대 줄 전체를 덮는 빈 앵커 svg(`sv-fixed-stage-anchor`)에 맞춘다.
 * 앵커는 고르기 단추 위쪽 무대 줄만 덮으므로 오버레이가 단추를 가리지 않는다.
 */
export function svOverlayAnchor(variant: 'steps' | 'fixed-volume'): string {
  return variant === 'fixed-volume'
    ? 'svg[data-testid="sv-fixed-stage-anchor"]'
    : 'svg[data-testid="sv-net-stage"], svg[data-testid="sv-box-stage"], svg[data-testid="sv-fill-stage"]';
}
