/**
 * 힌트 ② gap-compare (MC-GRAPH-GAP-ORDER).
 *
 * 학생이 채운 ○ 개수만큼을 축부터 빈틈없이 쌓은 반투명 열을 그 열 옆에 그리고,
 * 두 열 꼭대기 사이에 ↕(가로 그래프는 ↔)를 둔다. 학생이 채운 칸 수만 쓴다.
 */
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import { markRect, markSide, valuePosition } from '../layout';
import { gapCategoriesOf } from '../observe';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import type { GraphConfig, GraphState } from '../types';
import { CANVAS_SELECTOR, overlayFrame, targetCategory } from './helpers';

export function GapCompareOverlay({ state, args }: OverlayProps<GraphConfig, GraphState>) {
  const target = targetCategory(state, args, gapCategoriesOf(state)[0]);
  if (!target) return null;
  const marks = state.marks[target.cat] ?? [];
  if (marks.length === 0) return null;
  const frame = overlayFrame(state);
  const vertical = frame.orientation === 'vertical';
  const side = markSide(frame);
  const shift = side + 14;
  const count = marks.length;
  const top = Math.max(...marks) + 1;
  const studentEnd = valuePosition(frame, top);
  const ghostEnd = valuePosition(frame, count);
  const first = markRect(frame, target.index, 0);
  const mid = (studentEnd + ghostEnd) / 2;

  return (
    <CanvasAlignedOverlay
      testId="gap-compare"
      canvasSelector={CANVAS_SELECTOR}
      logicalWidth={LOGICAL_WIDTH}
      logicalHeight={LOGICAL_HEIGHT}
    >
      {Array.from({ length: count }, (_, cell) => {
        const rect = markRect(frame, target.index, cell);
        return (
          <rect
            key={cell}
            data-ghost-cell={cell}
            x={rect.x + (vertical ? shift : 0)}
            y={rect.y + (vertical ? 0 : shift)}
            width={rect.width}
            height={rect.height}
            rx={6}
            fill="#e8872e"
            fillOpacity={0.32}
            stroke="#b45309"
            strokeWidth={3}
          />
        );
      })}
      {vertical ? (
        <>
          <line
            x1={first.x - 16}
            x2={first.x + shift + side + 16}
            y1={studentEnd}
            y2={studentEnd}
            stroke="#b45309"
            strokeWidth={3}
            strokeDasharray="10 6"
          />
          <line
            x1={first.x - 16}
            x2={first.x + shift + side + 16}
            y1={ghostEnd}
            y2={ghostEnd}
            stroke="#b45309"
            strokeWidth={3}
            strokeDasharray="10 6"
          />
          <text
            data-testid="gap-arrow"
            x={first.x + shift + side + 30}
            y={mid + 12}
            fontSize={36}
            fontWeight={800}
            fill="#b45309"
          >
            ↕
          </text>
        </>
      ) : (
        <>
          <line
            y1={first.y - 16}
            y2={first.y + shift + side + 16}
            x1={studentEnd}
            x2={studentEnd}
            stroke="#b45309"
            strokeWidth={3}
            strokeDasharray="10 6"
          />
          <line
            y1={first.y - 16}
            y2={first.y + shift + side + 16}
            x1={ghostEnd}
            x2={ghostEnd}
            stroke="#b45309"
            strokeWidth={3}
            strokeDasharray="10 6"
          />
          <text
            data-testid="gap-arrow"
            x={mid}
            y={first.y + shift + side + 46}
            textAnchor="middle"
            fontSize={36}
            fontWeight={800}
            fill="#b45309"
          >
            ↔
          </text>
        </>
      )}
    </CanvasAlignedOverlay>
  );
}
