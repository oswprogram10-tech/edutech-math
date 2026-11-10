/** E10 이동 하나를 학생 문구로 바꾸는 순수 함수. */
import { centerLabelAt } from '../../moves';
import { transformStrings as S } from '../../strings.ko';
import type { Move, Side, SquareFigure } from '../../types';

function slideSide(move: { readonly dx: number; readonly dy: number }): {
  readonly side: Side;
  readonly cells: number;
} {
  if (move.dx !== 0) {
    return { side: move.dx > 0 ? 'right' : 'left', cells: Math.abs(move.dx) };
  }
  return { side: move.dy > 0 ? 'down' : 'up', cells: Math.abs(move.dy) };
}

/** 돌리기 중심 이름표는 그 이동 직전 도형에서 찾는다. */
export function moveText(move: Move, before: SquareFigure): string {
  switch (move.kind) {
    case 'slide': {
      const { side, cells } = slideSide(move);
      return S.moveText.slide(S.sides[side], cells);
    }
    case 'flip':
      return S.moveText.flip(S.sides[move.side]);
    case 'turn': {
      const label = centerLabelAt(before, move.center) ?? '';
      return S.moveText.turn(label, S.turnDirections[move.direction], move.angle);
    }
  }
}
