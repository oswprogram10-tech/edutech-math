/**
 * 힌트 ② `turn-same` (MC-SHAPE-ORIENTATION):
 * 같은 둥근기둥의 세운 그림과 눕힌 그림을 나란히 그리고 둥근 화살표로 잇는다.
 * 눕힌 그림은 0.9초 동안 세운 모습에서 눕는 모습으로 돌아간다(움직임을 줄이는 설정이면 멈춘 그림).
 * 모양 이름은 쓰지 않는다.
 */
import type { OverlayProps } from '../../../core/engine-sdk';
import { solid3dStrings as S } from '../strings.ko';
import type { SolidConfig, SolidState } from '../types';
import { ShapeGlyph } from '../views/ShapeIcon';
import { prefersReducedMotion } from '../views/shapesMotion';
import { NET_CARD_H, NET_CARD_HEADER_H, NET_CARD_W, NetHelperBox } from './NetHelperBox';

const INNER_W = NET_CARD_W;
const INNER_H = NET_CARD_H - NET_CARD_HEADER_H;
const GLYPH_PX = 76;
const SCALE = GLYPH_PX / 64;

export function TurnSameOverlay({ state }: OverlayProps<SolidConfig, SolidState>) {
  if (state.mode !== 'shapes-sort') return null;
  const reduced = prefersReducedMotion();
  const leftX = 14;
  const rightX = INNER_W - 14 - GLYPH_PX;
  const top = (INNER_H - GLYPH_PX) / 2 - 6;
  const midX = INNER_W / 2;
  const arcY = top + 6;
  const cx = rightX + GLYPH_PX / 2;
  const glyph = (pose: 'standing' | 'lying') => (
    <g transform="translate(-32 -58)">
      <ShapeGlyph kind="cylinder" pose={pose} color="blue" size="large" />
    </g>
  );

  return (
    <NetHelperBox
      testId="turn-same"
      titleTestId="turn-same-title"
      title={S.shapes.overlay.turnSameTitle}
      titleSize={11.5}
      canvasSelector='svg[data-testid="ss-ramp"], svg[data-testid="ss-tower"], svg[data-testid="ss-mystery"]'
    >
      <g
        data-testid="turn-same-standing"
        transform={`translate(${leftX + GLYPH_PX / 2} ${top + GLYPH_PX - 8}) scale(${SCALE})`}
      >
        {glyph('standing')}
      </g>
      <path
        data-testid="turn-same-arrow"
        d={`M${midX - 22} ${arcY + 22} Q${midX} ${arcY - 14} ${midX + 22} ${arcY + 22}`}
        fill="none"
        stroke="#475569"
        strokeWidth={2.6}
        strokeLinecap="round"
      />
      <polygon
        points={`${midX + 24},${arcY + 26} ${midX + 14},${arcY + 14} ${midX + 28},${arcY + 12}`}
        fill="#475569"
      />
      <g
        data-testid="turn-same-lying"
        transform={`translate(${rightX + GLYPH_PX / 2} ${top + GLYPH_PX - 8}) scale(${SCALE})`}
      >
        <g>
          {reduced ? null : (
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="-90 0 -17"
              to="0 0 -17"
              dur="0.9s"
              fill="freeze"
            />
          )}
          {glyph('lying')}
        </g>
      </g>
      <text
        x={leftX + GLYPH_PX / 2}
        y={INNER_H - 6}
        fontSize={11}
        textAnchor="middle"
        fill="#334155"
      >
        {S.shapes.overlay.turnSameStanding}
      </text>
      <text x={cx} y={INNER_H - 6} fontSize={11} textAnchor="middle" fill="#334155">
        {S.shapes.overlay.turnSameLying}
      </text>
    </NetHelperBox>
  );
}
