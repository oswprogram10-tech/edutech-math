/**
 * 힌트 ②: double에서 anchor부터 지금 쌍까지 만든 순서를 화살표로 다시 그린다.
 * 새 값은 쓰지 않고 연산 과정만 보여 준다(MC-FRAC-DIV-INVERT-WRONG).
 */
import type { OverlayProps } from '../../../core/engine-sdk';
import { pairOps } from '../double';
import { numberLineStrings } from '../strings.ko';
import { parseValue, xOfValue } from '../ticks';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import type { NumberLineConfig, NumberLineState } from '../types';

const TOP_Y = 245;
const BOTTOM_Y = 415;

function selectedIndex(state: NumberLineState, args: unknown): number {
  const line = state.double;
  if (!line) return -1;
  if (args !== null && typeof args === 'object' && !Array.isArray(args)) {
    const raw = (args as Record<string, unknown>)['index'];
    if (typeof raw === 'number' && raw >= 0 && raw < line.pairs.length) return Math.trunc(raw);
  }
  return line.selected;
}

function chainOf(state: NumberLineState, index: number): number[] {
  const pairs = state.double?.pairs ?? [];
  const chain: number[] = [];
  let cursor = index;
  let guard = 0;
  while (cursor >= 0 && cursor < pairs.length && guard < 64) {
    chain.unshift(cursor);
    const pair = pairs[cursor];
    cursor = pair && pair.from !== null ? pair.from : -1;
    guard += 1;
  }
  return chain;
}

export function PairReplayOverlay({
  state,
  args,
}: OverlayProps<NumberLineConfig, NumberLineState>) {
  const line = state.double;
  const index = selectedIndex(state, args);
  if (!line || index < 0) return null;
  const chain = chainOf(state, index);
  if (chain.length < 2) return null;
  const viewMax = parseValue(state.max);
  if (!viewMax) return null;
  const ops = pairOps(line.pairs, index);

  const positions = chain.map((pairIndex) => {
    const pair = line.pairs[pairIndex];
    const top = parseValue(pair?.top);
    return top
      ? xOfValue(top, parseValue(state.viewMin) ?? parseValue(state.min) ?? top, viewMax)
      : null;
  });

  return (
    <svg
      viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`}
      width="100%"
      height="100%"
      data-testid="overlay-pair-replay"
      aria-hidden="true"
    >
      <defs>
        <marker
          id="e03-pair-replay-arrow"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#8a3bd8" />
        </marker>
      </defs>
      {positions.slice(1).map((x, step) => {
        const from = positions[step];
        if (from === null || from === undefined || x === null || x === undefined) return null;
        return (
          <g key={`replay-${step}`} data-step={step}>
            <line
              x1={from}
              y1={TOP_Y - 42}
              x2={x}
              y2={TOP_Y - 42}
              stroke="#8a3bd8"
              strokeWidth={3}
              strokeDasharray="7 5"
              markerEnd="url(#e03-pair-replay-arrow)"
            />
            <line
              x1={from}
              y1={BOTTOM_Y + 52}
              x2={x}
              y2={BOTTOM_Y + 52}
              stroke="#8a3bd8"
              strokeWidth={3}
              strokeDasharray="7 5"
              markerEnd="url(#e03-pair-replay-arrow)"
            />
            {ops[step] ? (
              <text
                x={(from + x) / 2}
                y={TOP_Y - 52}
                fill="#6b2bb0"
                fontSize={18}
                fontWeight={700}
                textAnchor="middle"
              >
                {numberLineStrings.double.op(ops[step].kind, ops[step].factor)}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
