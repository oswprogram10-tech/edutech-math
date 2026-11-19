/**
 * 힌트 ② big-tilt (MC-EQUAL-ANSWER).
 * 학생이 마지막으로 넣은 값으로 저울을 크게(12°) 기울인 반투명 그림자 저울을 그리고,
 * 그 위에 두 쪽의 합을 큰 글자로 쓴다(사이에 ≠). 넣은 값이 없거나 수평이면 그리지 않는다.
 * 쓰는 수는 학생이 직접 넣은 값에서 나온 것뿐이다(정답 노출 아님).
 */
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import {
  BEAM_HALF,
  MAX_TILT,
  PAN_CENTER,
  PAN_HALF,
  PAN_SURFACE_Y,
  PIVOT,
  beamRotation,
  panOffsets,
} from '../layout';
import { sideValue } from '../observe';
import { balanceStrings as S } from '../strings.ko';
import { CANVAS_SELECTOR, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import type { BalanceConfig, BalanceState } from '../types';

export function BigTiltOverlay({ state }: OverlayProps<BalanceConfig, BalanceState>) {
  if (state.error !== null || state.settings.look === 'symbols') return null;
  const last = state.tries[state.tries.length - 1];
  if (last === undefined) return null;
  const left = sideValue(state.left, last);
  const right = sideValue(state.right, last);
  if (left === null || right === null) return null;
  const order = left.compareTo(right);
  if (order === 0) return null;
  const tilt = order > 0 ? 'left' : 'right';
  const offsets = panOffsets(tilt, MAX_TILT);
  const names = ['left', 'right'] as const;
  return (
    <CanvasAlignedOverlay
      testId="overlay-big-tilt"
      canvasSelector={CANVAS_SELECTOR}
      logicalWidth={LOGICAL_WIDTH}
      logicalHeight={LOGICAL_HEIGHT}
    >
      <g opacity={0.5} data-part="ghost-scale">
        <g transform={`rotate(${beamRotation(tilt, MAX_TILT)} ${PIVOT.x} ${PIVOT.y})`}>
          <line
            x1={PIVOT.x - BEAM_HALF}
            y1={PIVOT.y}
            x2={PIVOT.x + BEAM_HALF}
            y2={PIVOT.y}
            stroke="#a8321f"
            strokeWidth={12}
            strokeLinecap="round"
          />
        </g>
        {names.map((name) => {
          const cx = PAN_CENTER[name];
          const offset = offsets[name];
          return (
            <g key={name} transform={`translate(${offset.dx} ${offset.dy})`}>
              <path
                d={`M${cx} ${PIVOT.y} L${cx - PAN_HALF} ${PAN_SURFACE_Y} M${cx} ${PIVOT.y} L${cx + PAN_HALF} ${PAN_SURFACE_Y} M${cx - PAN_HALF} ${PAN_SURFACE_Y} H${cx + PAN_HALF}`}
                stroke="#a8321f"
                strokeWidth={5}
                strokeDasharray="14 8"
                fill="none"
              />
            </g>
          );
        })}
      </g>
      <g data-part="totals">
        <rect
          x={290}
          y={262}
          width={420}
          height={96}
          rx={16}
          fill="#ffffff"
          fillOpacity={0.92}
          stroke="#a8321f"
          strokeWidth={4}
        />
        <text
          x={500}
          y={310}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={72}
          fontWeight={800}
          fill="#7a1f14"
        >
          {`${left.toString()} ${S.sign.notEqual} ${right.toString()}`}
        </text>
      </g>
    </CanvasAlignedOverlay>
  );
}
