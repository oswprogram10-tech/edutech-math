/**
 * 힌트 ② hop-numbers (MC-JUMP-COUNT-START).
 *
 * 개구리 점프가 지나간 눈금 칸 사이마다 작은 호와 1, 2, 3… 번호를 그린다.
 * 도착 값은 쓰지 않는다. 개구리가 없으면 아무것도 그리지 않는다.
 */
import type { OverlayProps } from '../../../core/engine-sdk';
import { Rational } from '../../../core/math/rational';
import { frogSteps } from '../frog';
import { rowsOf } from '../reduce';
import { parseValue, xOfValue } from '../ticks';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import type { NumberLineConfig, NumberLineState } from '../types';

interface GapArc {
  readonly key: string;
  readonly x1: number;
  readonly x2: number;
  readonly y: number;
  readonly count: number;
  readonly lift: number;
}

function gapArcs(
  frog: NonNullable<NumberLineState['frog']>,
  min: NonNullable<ReturnType<typeof parseValue>>,
  max: NonNullable<ReturnType<typeof parseValue>>,
  rowY: number,
  tick: NonNullable<ReturnType<typeof parseValue>>,
): GapArc[] {
  if (tick.isZero() || tick.isNegative()) return [];
  const arcs: GapArc[] = [];
  let stepIndex = 0;
  for (const step of frogSteps(frog)) {
    const size = parseValue(step.size);
    const from = parseValue(step.from);
    if (!size || !from) continue;
    const ratio = size.abs().div(tick);
    if (!ratio.isInteger() || ratio.isZero()) continue;
    const count = Math.min(100, Number(ratio.n / ratio.d));
    const direction = size.isNegative() ? -1 : 1;
    for (let index = 0; index < count; index += 1) {
      const gapFrom = from.add(tick.mul(Rational.of(size.isNegative() ? -index : index)));
      const gapTo = gapFrom.add(tick.mul(Rational.of(direction)));
      if (
        gapFrom.compareTo(min) < 0 ||
        gapFrom.compareTo(max) > 0 ||
        gapTo.compareTo(min) < 0 ||
        gapTo.compareTo(max) > 0
      ) {
        continue;
      }
      arcs.push({
        key: `${stepIndex}-${index}`,
        x1: xOfValue(gapFrom, min, max),
        x2: xOfValue(gapTo, min, max),
        y: rowY,
        count: index + 1,
        lift: 16 + ((stepIndex + index) % 2) * 14,
      });
    }
    stepIndex += 1;
  }
  return arcs;
}

export function HopNumbersOverlay({ state }: OverlayProps<NumberLineConfig, NumberLineState>) {
  const frog = state.frog;
  if (!frog || frog.jumps.length === 0) return null;
  const min = parseValue(state.viewMin) ?? parseValue(state.min);
  const max = parseValue(state.viewMax) ?? parseValue(state.max);
  const rows = rowsOf(state);
  const row = rows[0];
  const tick = row?.step;
  if (!min || !max || !row || !tick) return null;

  const arcs = gapArcs(frog, min, max, row.y, tick);
  if (arcs.length === 0) return null;

  return (
    <svg
      viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`}
      width="100%"
      height="100%"
      data-testid="overlay-hop-numbers"
      aria-hidden="true"
    >
      {arcs.map((arc) => {
        const mid = (arc.x1 + arc.x2) / 2;
        const top = arc.y - arc.lift;
        return (
          <g key={arc.key} data-hop-number={arc.count}>
            <path
              d={`M ${arc.x1} ${arc.y - 14} Q ${mid} ${top} ${arc.x2} ${arc.y - 14}`}
              fill="none"
              stroke="#b35c00"
              strokeWidth={2}
            />
            <text
              x={mid}
              y={top + 1}
              fill="#8a4600"
              fontSize={13}
              fontWeight={700}
              textAnchor="middle"
            >
              {arc.count}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
