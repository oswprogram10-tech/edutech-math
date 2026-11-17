/**
 * 힌트 ② `wraps-compare` (MC-PERIMETER-AREA-SAME):
 * fixed-volume에서 1×1×V 상자와 겉넓이가 가장 작은 상자의 전개도를 같은 1cm 칸 크기로 나란히 그린다.
 * 넓이 수를 쓰지 않는다. 칸 크기를 같게 맞추므로 어느 쪽 포장지가 더 큰지 눈으로 견줄 수 있다.
 */
import type { OverlayProps } from '../../../core/engine-sdk';
import { minSurfaceBox, netBounds } from '../sv/geometry';
import { solid3dStrings as S } from '../strings.ko';
import type { SolidConfig, SolidState } from '../types';
import { NET_CARD_H, NET_CARD_HEADER_H, NET_CARD_W, NetHelperBox } from './NetHelperBox';
import { SvMiniNet } from './svMini';
import { svOverlayAnchor } from './svMiniSize';

const INNER_W = NET_CARD_W;
const INNER_H = NET_CARD_H - NET_CARD_HEADER_H;
const GAP = 12;

export function WrapsCompareOverlay({ state }: OverlayProps<SolidConfig, SolidState>) {
  if (state.mode !== 'surface-volume' || state.settings.variant !== 'fixed-volume') return null;
  const v = state.settings.volume;
  const best = minSurfaceBox(v);
  if (!best) return null;
  const long = { w: 1, d: 1, h: v } as const;
  const bestBox = { w: best[0], d: best[1], h: best[2] } as const;
  const a = netBounds(long.w, long.d, long.h);
  const b = netBounds(bestBox.w, bestBox.d, bestBox.h);
  const cell = Math.min(
    (INNER_W - 12 - GAP) / (a.cols + b.cols),
    (INNER_H - 10) / Math.max(a.rows, b.rows),
    18,
  );
  const aW = a.cols * cell;
  const bW = b.cols * cell;
  const startX = (INNER_W - (aW + bW + GAP)) / 2;
  const grid = cell >= 3;
  const style = {
    fill: '#ffffff',
    stroke: '#334155',
    strokeWidth: cell >= 6 ? 1.4 : 1,
  } as const;

  return (
    <NetHelperBox
      testId="wraps-compare"
      titleTestId="wraps-compare-title"
      title={S.sv.overlay.wrapsCompareTitle}
      titleSize={11}
      canvasSelector={svOverlayAnchor('fixed-volume')}
    >
      <g data-testid="wraps-compare-long">
        <SvMiniNet
          {...long}
          cell={cell}
          x0={startX}
          y0={(INNER_H - a.rows * cell) / 2}
          grid={grid}
          style={() => style}
        />
      </g>
      <g data-testid="wraps-compare-best">
        <SvMiniNet
          {...bestBox}
          cell={cell}
          x0={startX + aW + GAP}
          y0={(INNER_H - b.rows * cell) / 2}
          grid={grid}
          style={() => style}
        />
      </g>
    </NetHelperBox>
  );
}
