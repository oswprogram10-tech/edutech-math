/**
 * 힌트 ②: 두 값이 수직선에서 같은 점인지 세로선으로 보여 준다.
 * 점을 대신 찍거나 정답을 표시하지 않는다(T011 구현 결정 10).
 */
import type { OverlayProps } from '../../../core/engine-sdk';
import { rowsOf } from '../reduce';
import { parseValue, xOfValue } from '../ticks';
import { numberLineStrings } from '../strings.ko';
import type { NumberLineConfig, NumberLineState } from '../types';
import { CanvasAlignedOverlay } from './canvas-frame';

interface Pair {
  readonly key: string;
  readonly x: number;
  readonly same: boolean;
}

function pairFromArgs(
  args: unknown,
  min: ReturnType<typeof parseValue>,
  max: ReturnType<typeof parseValue>,
): Pair | null {
  if (args === null || typeof args !== 'object' || Array.isArray(args)) return null;
  const record = args as Record<string, unknown>;
  const a = typeof record['a'] === 'string' ? parseValue(record['a']) : null;
  const b = typeof record['b'] === 'string' ? parseValue(record['b']) : null;
  if (!a || !b || !min || !max) return null;
  if (
    a.compareTo(min) < 0 ||
    a.compareTo(max) > 0 ||
    b.compareTo(min) < 0 ||
    b.compareTo(max) > 0
  ) {
    return null;
  }
  const x = xOfValue(a, min, max);
  const other = xOfValue(b, min, max);
  return { key: `${a.toJSON()}-${b.toJSON()}`, x, same: Math.abs(x - other) < 0.5 };
}

function duplicatePairs(
  state: NumberLineState,
  min: NonNullable<ReturnType<typeof parseValue>>,
  max: NonNullable<ReturnType<typeof parseValue>>,
): Pair[] {
  const seen = new Map<string, number>();
  const add = (value: string) => {
    const parsed = parseValue(value);
    if (!parsed) return;
    if (parsed.compareTo(min) < 0 || parsed.compareTo(max) > 0) return;
    seen.set(parsed.toJSON(), (seen.get(parsed.toJSON()) ?? 0) + 1);
  };
  for (const point of state.points) add(point.value);
  for (const card of state.cards) {
    const placed = state.cardValues[card];
    if (placed) add(placed);
  }
  const pairs: Pair[] = [];
  for (const [value, count] of seen) {
    if (count <= 1) continue;
    const parsed = parseValue(value);
    if (!parsed) continue;
    pairs.push({ key: value, x: xOfValue(parsed, min, max), same: true });
  }
  return pairs;
}

export function SamePointOverlay({ state, args }: OverlayProps<NumberLineConfig, NumberLineState>) {
  const min = parseValue(state.viewMin) ?? parseValue(state.min);
  const max = parseValue(state.viewMax) ?? parseValue(state.max);
  if (!min || !max) return null;
  const rows = rowsOf(state);
  const top = Math.min(...rows.map((row) => row.y)) - 58;
  const bottom = Math.max(...rows.map((row) => row.y)) + 52;
  const fromArgs = pairFromArgs(args, min, max);
  const pairs = fromArgs ? [fromArgs] : duplicatePairs(state, min, max);

  if (pairs.length === 0) return null;

  return (
    <CanvasAlignedOverlay testId="overlay-same-point">
      {pairs.map((pair) => (
        <g key={pair.key} data-same={pair.same}>
          <line
            x1={pair.x}
            y1={top}
            x2={pair.x}
            y2={bottom}
            stroke={pair.same ? '#d64545' : '#8a5a10'}
            strokeWidth={3}
            strokeDasharray="9 6"
          />
          <text
            x={pair.x + 10}
            y={top}
            fill={pair.same ? '#a52a2a' : '#8a5a10'}
            fontSize={18}
            fontWeight={700}
          >
            {pair.same ? numberLineStrings.samePoint : ''}
          </text>
        </g>
      ))}
    </CanvasAlignedOverlay>
  );
}
