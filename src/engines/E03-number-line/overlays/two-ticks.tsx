/**
 * 힌트 ②: rounding에서 값마다 아래·위 큰 눈금 두 개만 진하게 보여 준다.
 * 어느 쪽이 답인지는 알려 주지 않는다(MC-ROUND-WRONG-PLACE).
 */
import type { OverlayProps } from '../../../core/engine-sdk';
import { formatNumber, roundingEdges } from '../rounding';
import { roundingPlaceOf } from '../reduce-rounding';
import { parseValue, xOfValue } from '../ticks';
import { LINE_LEFT, LINE_RIGHT, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import type { NumberLineConfig, NumberLineState } from '../types';

const LINE_Y = 330;

export function TwoTicksOverlay({ state }: OverlayProps<NumberLineConfig, NumberLineState>) {
  if (!state.rounding) return null;
  const place = roundingPlaceOf(state);
  const min = parseValue(state.min);
  const max = parseValue(state.max);
  if (!place || !min || !max) return null;
  const items = state.rounding.items
    .map((item) => {
      const value = parseValue(item.value);
      if (!value) return null;
      const edges = roundingEdges(value, place);
      return {
        value: item.value,
        lower: edges.lower,
        upper: edges.upper,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
  if (items.length === 0) return null;
  return (
    <svg
      viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`}
      width="100%"
      height="100%"
      data-testid="overlay-two-ticks"
      aria-hidden="true"
    >
      <rect
        x={LINE_LEFT - 8}
        y={LINE_Y - 40}
        width={LINE_RIGHT - LINE_LEFT + 16}
        height={100}
        fill="#f7f9ff"
        opacity={0.62}
      />
      {items.map((item) => (
        <g key={item.value} data-upper={item.upper.toJSON()} data-lower={item.lower.toJSON()}>
          {[item.lower, item.upper].map((tick) => {
            const x = xOfValue(tick, min, max);
            return (
              <g key={tick.toJSON()}>
                <line
                  x1={x}
                  y1={LINE_Y - 20}
                  x2={x}
                  y2={LINE_Y + 20}
                  stroke="#2f6fde"
                  strokeWidth={6}
                  strokeDasharray="8 4"
                />
                <text
                  x={x}
                  y={LINE_Y + 44}
                  fill="#1d2330"
                  fontSize={20}
                  fontWeight={700}
                  textAnchor="middle"
                >
                  {formatNumber(tick)}
                </text>
              </g>
            );
          })}
        </g>
      ))}
    </svg>
  );
}
