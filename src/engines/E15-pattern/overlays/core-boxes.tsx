/**
 * 힌트 ② core-boxes (MC-PATTERN-CORE).
 *
 * 주어진 칸에 실제 반복 단위마다 번호 붙은 점선 상자를 씌우고, 빈칸 쪽에도 같은 길이의
 * 빈 상자 틀을 이어 그린다(토큰 없음). 학생 칸 가운데 바로 앞 상자의 같은 자리 토큰과
 * 다른 칸에는 ✕ 표시를 한다. 정답 토큰은 그리지 않는다.
 */
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import { trackLayout } from '../layout';
import type { Box } from '../layout';
import { coreOf } from '../pattern';
import { patternStrings as S } from '../strings.ko';
import type { PatternConfig, PatternState } from '../types';
import { PATTERN_CANVAS, sequenceOf } from './helpers';

interface Run {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** 칸 번호 [from, to)를 줄(y)마다 끊어 상자 하나씩으로 만든다. */
function runsOf(boxes: readonly Box[], from: number, to: number): Run[] {
  const runs: Run[] = [];
  let start = from;
  while (start < to) {
    const first = boxes[start];
    if (!first) break;
    let end = start;
    while (end + 1 < to && boxes[end + 1]?.y === first.y) end += 1;
    const last = boxes[end] ?? first;
    runs.push({
      x: first.x - 7,
      y: first.y - 7,
      width: last.x + last.size - first.x + 14,
      height: first.size + 14,
    });
    start = end + 1;
  }
  return runs;
}

export function CoreBoxesOverlay({ state }: OverlayProps<PatternConfig, PatternState>) {
  const sequence = sequenceOf(state);
  if (!sequence || sequence.settings.variant !== 'extend') return null;
  const { settings, slots } = sequence;
  const core = coreOf(settings.given);
  if (core === null) return null;
  const layout = trackLayout(settings, sequence.sent);
  const boxes: Box[] = [...layout.given, ...layout.slots];
  const total = boxes.length;
  const p = core.length;
  const combined: (string | null)[] = [...settings.given, ...slots];

  const groups: { readonly number: number; readonly runs: Run[] }[] = [];
  for (let g = 0; g * p < total; g += 1) {
    groups.push({ number: g + 1, runs: runsOf(boxes, g * p, Math.min(total, (g + 1) * p)) });
  }

  const crosses: Box[] = [];
  slots.forEach((token, j) => {
    const index = settings.given.length + j;
    if (index < p || token === null) return;
    const before = combined[index - p] ?? null;
    const box = layout.slots[j];
    if (before !== null && before !== token && box) crosses.push(box);
  });

  return (
    <CanvasAlignedOverlay
      testId="core-boxes"
      canvasSelector={PATTERN_CANVAS}
      logicalWidth={layout.width}
      logicalHeight={layout.height}
    >
      {groups.map((group) =>
        group.runs.map((run, index) => (
          <g key={`${group.number}-${index}`}>
            <rect
              x={run.x}
              y={run.y}
              width={run.width}
              height={run.height}
              rx={14}
              fill="none"
              stroke="#2f6fde"
              strokeWidth={4}
              strokeDasharray="12 8"
            />
            {index === 0 ? (
              <g>
                <circle cx={run.x + 14} cy={run.y - 4} r={14} fill="#2f6fde" />
                <text
                  x={run.x + 14}
                  y={run.y - 4}
                  fontSize={17}
                  fontWeight={800}
                  fill="#ffffff"
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  {S.overlay.coreBox(group.number)}
                </text>
              </g>
            ) : null}
          </g>
        )),
      )}
      {crosses.map((box) => (
        <g
          key={`x-${box.x}-${box.y}`}
          stroke="#1d2330"
          strokeWidth={7}
          strokeLinecap="round"
          data-testid="core-boxes-x"
        >
          <line
            x1={box.x + 14}
            y1={box.y + 14}
            x2={box.x + box.size - 14}
            y2={box.y + box.size - 14}
          />
          <line
            x1={box.x + box.size - 14}
            y1={box.y + 14}
            x2={box.x + 14}
            y2={box.y + box.size - 14}
          />
        </g>
      ))}
    </CanvasAlignedOverlay>
  );
}
