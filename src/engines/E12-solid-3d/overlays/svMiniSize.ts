/** `surface-volume` 오버레이용 등각 상자 그림의 viewBox 크기. */
import { computeStageLayout } from '../layout';

export function isoBoxSize(w: number, d: number, h: number, unit: number) {
  const layout = computeStageLayout(w, d, h, unit);
  return layout.viewBox;
}

/**
 * 오버레이를 맞출 본 그림 선택자. steps는 단계별 무대 svg, fixed-volume은 가늘고 긴 상자 그림이라
 * 오버레이가 너무 작아지므로 무대와 고르기 단추를 담은 칸(`sv-board`)에 맞춘다.
 */
export function svOverlayAnchor(variant: 'steps' | 'fixed-volume'): string {
  return variant === 'fixed-volume'
    ? '[data-testid="sv-board"]'
    : 'svg[data-testid="sv-net-stage"], svg[data-testid="sv-box-stage"], svg[data-testid="sv-fill-stage"]';
}
