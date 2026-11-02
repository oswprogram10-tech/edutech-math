/**
 * 힌트 ②: 학생이 찍은 점까지 0에서의 거리를 막대로 보여 준다.
 * 정답 위치에 점을 대신 찍지 않는다(T011 구현 결정 10).
 */
import { Rational } from '../../../core/math/rational';
import type { OverlayProps } from '../../../core/engine-sdk';
import { rowsOf } from '../reduce';
import { parseValue, xOfValue } from '../ticks';
import { numberLineStrings } from '../strings.ko';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import type { NumberLineConfig, NumberLineState } from '../types';

function formatDistance(value: Rational): string {
  try {
    return value.toDecimalString();
  } catch {
    return value.toString();
  }
}

export function DistanceFromZeroOverlay({
  state,
}: OverlayProps<NumberLineConfig, NumberLineState>) {
  const min = parseValue(state.min) ?? Rational.of(0);
  const max = parseValue(state.max) ?? min.add(Rational.of(1));
  const zero = Rational.of(0);
  const startValue = zero.compareTo(min) < 0 ? min : zero;
  const rows = rowsOf(state);
  const startX = xOfValue(startValue, min, max);

  return (
    <svg
      viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`}
      width="100%"
      height="100%"
      data-testid="overlay-distance-from-zero"
      aria-hidden="true"
    >
      {state.points.map((point, index) => {
        const value = parseValue(point.value);
        if (!value) return null;
        const distance = value.sub(zero).abs();
        if (distance.isZero()) return null;
        const x = xOfValue(value, min, max);
        const baseY = rows[0]?.y ?? 300;
        const y = baseY - 52 - index * 26;
        const left = Math.min(startX, x);
        const width = Math.abs(x - startX);
        return (
          <g key={point.id} data-distance-value={point.value}>
            <line
              x1={left}
              y1={y}
              x2={left + width}
              y2={y}
              stroke="#0f7b6c"
              strokeWidth={6}
              strokeLinecap="round"
              opacity={0.75}
            />
            <line
              x1={startX}
              y1={y - 12}
              x2={startX}
              y2={y + 12}
              stroke="#0f7b6c"
              strokeWidth={3}
            />
            <circle cx={x} cy={y} r={7} fill="#0f7b6c" />
            <text
              x={left + width / 2}
              y={y - 12}
              fill="#0f5f55"
              fontSize={18}
              fontWeight={700}
              textAnchor="middle"
            >
              {numberLineStrings.overlayDistance(point.value, formatDistance(distance))}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
