/**
 * 힌트 ② `unpainted-blink` (MC-SURFACE-3-FACES):
 * 전개도를 작게 그리고, 아직 칠하지 않은 면의 테두리를 주황색으로 0.8초마다 깜빡인다.
 * `prefers-reduced-motion`이면 굵은 테두리로 고정한다. 모든 면을 칠했거나 steps가 아니면 그리지 않는다.
 */
import type { OverlayProps } from '../../../core/engine-sdk';
import { netBounds } from '../sv/geometry';
import { solid3dStrings as S } from '../strings.ko';
import type { SolidConfig, SolidState } from '../types';
import { prefersReducedMotion } from '../views/svPaint';
import { NET_CARD_H, NET_CARD_HEADER_H, NET_CARD_W, NetHelperBox } from './NetHelperBox';
import { SvMiniNet } from './svMini';

const INNER_W = NET_CARD_W;
const INNER_H = NET_CARD_H - NET_CARD_HEADER_H;

export function UnpaintedBlinkOverlay({ state }: OverlayProps<SolidConfig, SolidState>) {
  if (state.mode !== 'surface-volume' || state.settings.variant !== 'steps') return null;
  if (state.painted.length >= 6) return null;
  const [w, d, h] = state.dims;
  const { cols, rows } = netBounds(w, d, h);
  const cell = Math.min((INNER_W - 16) / cols, (INNER_H - 12) / rows, 20);
  const x0 = (INNER_W - cols * cell) / 2;
  const y0 = (INNER_H - rows * cell) / 2;
  const painted = new Set<string>(state.painted);
  const reduced = prefersReducedMotion();

  return (
    <NetHelperBox
      testId="unpainted-blink"
      titleTestId="unpainted-blink-title"
      title={S.sv.overlay.unpaintedTitle}
      canvasSelector='svg[data-testid="sv-net-stage"], svg[data-testid="sv-box-stage"]'
    >
      <SvMiniNet
        w={w}
        d={d}
        h={h}
        cell={cell}
        x0={x0}
        y0={y0}
        testIdPrefix="unpainted-blink"
        reducedMotion={reduced}
        style={(face) =>
          painted.has(face)
            ? { fill: '#dbe7ff', stroke: '#334155', strokeWidth: 1.4 }
            : {
                fill: '#ffffff',
                stroke: '#ea580c',
                strokeWidth: reduced ? 4 : 3,
                blink: true,
              }
        }
      />
    </NetHelperBox>
  );
}
