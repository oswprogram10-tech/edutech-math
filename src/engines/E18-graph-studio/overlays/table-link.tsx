/**
 * 힌트 ② table-link (MC-GRAPH-TABLE-MISMATCH).
 *
 * 그래프의 범주 이름 옆에 표 값 글("표: 5")을 쓰고, 학생이 채운 칸마다 1, 2, 3… 번호를 단다.
 * 표 값은 이미 화면에 있는 값이고, 학생이 그리지 않은 칸은 번호를 달지 않는다.
 */
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import { bandCenter, markRect, valuePosition } from '../layout';
import { mismatchCategoriesOf, tableReferenceOf } from '../observe';
import { graphStrings as S } from '../strings.ko';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import type { GraphConfig, GraphState } from '../types';
import { CANVAS_SELECTOR, overlayFrame, targetCategory } from './helpers';

interface BadgeProps {
  readonly x: number;
  readonly y: number;
  readonly number: number;
}

function Badge({ x, y, number }: BadgeProps) {
  return (
    <g data-number={number}>
      <circle cx={x} cy={y} r={15} fill="#ffffff" stroke="#b45309" strokeWidth={3} />
      <text x={x} y={y + 7} textAnchor="middle" fontSize={20} fontWeight={800} fill="#b45309">
        {number}
      </text>
    </g>
  );
}

export function TableLinkOverlay({ state, args }: OverlayProps<GraphConfig, GraphState>) {
  const target = targetCategory(state, args, mismatchCategoriesOf(state)[0]);
  if (!target) return null;
  const reference = tableReferenceOf(state, target.cat);
  if (reference === null) return null;
  const frame = overlayFrame(state);
  const vertical = frame.orientation === 'vertical';
  const plot = frame.plot;
  const center = bandCenter(frame, target.index);
  const { settings } = state;
  const student = settings.graph === 'student';

  const numbers: BadgeProps[] = [];
  if (student && settings.graphType === 'o-mark') {
    (state.marks[target.cat] ?? []).forEach((cell, order) => {
      const rect = markRect(frame, target.index, cell);
      numbers.push({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, number: order + 1 });
    });
  } else if (student) {
    const cells = state.bars[target.cat] ?? 0;
    for (let cell = 1; cell <= cells; cell += 1) {
      const middle = valuePosition(frame, cell - 0.5);
      numbers.push({ x: vertical ? center : middle, y: vertical ? middle : center, number: cell });
    }
  }

  return (
    <CanvasAlignedOverlay
      testId="table-link"
      canvasSelector={CANVAS_SELECTOR}
      logicalWidth={LOGICAL_WIDTH}
      logicalHeight={LOGICAL_HEIGHT}
    >
      <g data-testid="table-link-value">
        <rect
          x={vertical ? center - 62 : plot.x - 150}
          y={vertical ? plot.y + plot.height + 62 : center + 14}
          width={124}
          height={38}
          rx={10}
          fill="#fff7e6"
          stroke="#b45309"
          strokeWidth={3}
        />
        <text
          x={vertical ? center : plot.x - 88}
          y={vertical ? plot.y + plot.height + 89 : center + 40}
          textAnchor="middle"
          fontSize={22}
          fontWeight={800}
          fill="#8a4b00"
        >
          {S.overlay.tableValue(reference)}
        </text>
      </g>
      {numbers.map((item) => (
        <Badge key={item.number} {...item} />
      ))}
    </CanvasAlignedOverlay>
  );
}
