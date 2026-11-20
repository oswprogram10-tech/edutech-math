/**
 * 힌트 ② cross-brackets (MC-PROPORTION-CROSS-WRONG).
 * 식 줄 위에 바깥쪽 두 항(외항)을 잇는 위 괄호와 "바깥쪽", 아래에 안쪽 두 항(내항)을 잇는
 * 아래 괄호와 "안쪽"을 그린다. 두 괄호는 실선·점선으로도 구별한다(색만으로 전달하지 않는다).
 * 값은 쓰지 않는다. 식 줄이 없으면(카드를 아직 고르지 않았으면) 그리지 않는다.
 */
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import { TERM_X } from '../proportion/layout';
import { balanceStrings as S } from '../strings.ko';
import { CANVAS_SELECTOR, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import type { E06Config, E06State } from '../unions';

const OUTER_Y = 58;
const INNER_Y = 140;
const LEG = 9;

export function CrossBracketsOverlay({ state }: OverlayProps<E06Config, E06State>) {
  if (state.mode !== 'proportion' || state.error !== null) return null;
  if (state.terms.length !== 4) return null;
  const [a, b, c, d] = TERM_X;
  const text = {
    fontSize: 22,
    fontWeight: 800,
    dominantBaseline: 'central',
  } as const;
  return (
    <CanvasAlignedOverlay
      testId="overlay-cross-brackets"
      canvasSelector={CANVAS_SELECTOR}
      logicalWidth={LOGICAL_WIDTH}
      logicalHeight={LOGICAL_HEIGHT}
    >
      <g role="img" aria-label={S.proportion.brackets.outerLabel} data-part="outer">
        <path
          d={`M${a} ${OUTER_Y + LEG} V${OUTER_Y} H${d} V${OUTER_Y + LEG}`}
          fill="none"
          stroke="#a8321f"
          strokeWidth={5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <text x={a - 46} y={OUTER_Y} textAnchor="end" fill="#7a1f14" {...text}>
          {S.proportion.brackets.outer}
        </text>
      </g>
      <g role="img" aria-label={S.proportion.brackets.innerLabel} data-part="inner">
        <path
          d={`M${b} ${INNER_Y - LEG} V${INNER_Y} H${c} V${INNER_Y - LEG}`}
          fill="none"
          stroke="#1d4fa8"
          strokeWidth={5}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="10 8"
        />
        <text x={c + 36} y={INNER_Y} textAnchor="start" fill="#12356f" {...text}>
          {S.proportion.brackets.inner}
        </text>
      </g>
    </CanvasAlignedOverlay>
  );
}
