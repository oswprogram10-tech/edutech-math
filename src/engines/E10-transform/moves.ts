/**
 * E10의 이동 적용·병합·명세 해석.
 *
 * 밀기 병합: 바로 앞 기록도 밀기면 둘을 더해 한 번으로 친다. 합이 `(0,0)`이면
 * 그 기록을 지운다. 키보드 방향키 다섯 번이 "다섯 번 이동"이 되면 "두 번
 * 이동" 판정이 깨지고, 밀기 두 번은 수학적으로도 밀기 한 번이기 때문이다.
 */
import { applySquareMove, assertPt, safeInteger } from './square';
import type {
  Move,
  MoveSpec,
  Pt,
  Side,
  SquareFigure,
  TurnAngle,
  TurnDirection,
  VertexRef,
} from './types';
import { SIDES } from './types';

function sideOf(value: unknown): Side {
  if (value === 'up' || value === 'down' || value === 'left' || value === 'right') return value;
  throw new RangeError('뒤집기·밀기 방향이 올바르지 않습니다.');
}

function directionOf(value: unknown): TurnDirection {
  if (value === 'cw' || value === 'ccw') return value;
  throw new RangeError('돌리기 방향이 올바르지 않습니다.');
}

function angleOf(value: unknown): TurnAngle {
  if (value === 90 || value === 180 || value === 270) return value;
  throw new RangeError('돌리기 각도가 올바르지 않습니다.');
}

function slideDelta(direction: Side, cells: number): { readonly dx: number; readonly dy: number } {
  const count = safeInteger(cells, 'cells');
  if (count < 0) throw new RangeError('밀기 칸 수는 0 이상이어야 합니다.');
  switch (direction) {
    case 'up':
      return { dx: 0, dy: -count };
    case 'down':
      return { dx: 0, dy: count };
    case 'left':
      return { dx: -count, dy: 0 };
    case 'right':
      return { dx: count, dy: 0 };
  }
}

/** 문자열 `'vertex-A'`~`'vertex-J'`를 그 순간 도형의 꼭짓점으로 바꾼다. */
function centerOf(figure: SquareFigure, ref: VertexRef): Pt {
  if (typeof ref !== 'string') return assertPt(ref, 'turn.center');
  const match = /^vertex-([A-J])$/.exec(ref);
  if (!match?.[1]) throw new RangeError(`알 수 없는 꼭짓점 이름입니다: ${ref}`);
  const index = match[1].charCodeAt(0) - 'A'.charCodeAt(0);
  const point = figure.outline[index];
  if (!point) throw new RangeError(`그 도형에 ${ref} 꼭짓점이 없습니다.`);
  return point;
}

/** 명세 하나를 지금 도형 기준의 Move로 바꾼다. */
export function resolveMoveSpec(figure: SquareFigure, spec: MoveSpec): Move {
  switch (spec.type) {
    case 'slide': {
      const { dx, dy } = slideDelta(sideOf(spec.direction), spec.cells);
      return { kind: 'slide', dx, dy };
    }
    case 'flip':
      return { kind: 'flip', side: sideOf(spec.side) };
    case 'turn':
      return {
        kind: 'turn',
        direction: directionOf(spec.direction),
        angle: angleOf(spec.angle),
        center: centerOf(figure, spec.center),
      };
  }
}

/** 차례로 적용하며 중심을 좌표로 바꾼다. */
export function resolveMoveSpecs(start: SquareFigure, specs: readonly MoveSpec[]): Move[] {
  const moves: Move[] = [];
  let figure = start;
  for (const spec of specs) {
    const move = resolveMoveSpec(figure, spec);
    moves.push(move);
    figure = applySquareMove(figure, move);
  }
  return moves;
}

export function applyMove(figure: SquareFigure, move: Move): SquareFigure {
  return applySquareMove(figure, move);
}

/** `start`에 앞에서부터 `count`개 이동을 적용한 도형. */
export function applyMovesUpTo(
  start: SquareFigure,
  moves: readonly Move[],
  count: number,
): SquareFigure {
  const limit = Math.max(0, Math.min(moves.length, Math.trunc(count)));
  let figure = start;
  for (let index = 0; index < limit; index += 1) {
    const move = moves[index];
    if (!move) continue;
    figure = applySquareMove(figure, move);
  }
  return figure;
}

/** `start`에 모든 이동을 적용한 도형. */
export function figureAfter(start: SquareFigure, moves: readonly Move[]): SquareFigure {
  return applyMovesUpTo(start, moves, moves.length);
}

/** 밀기 두 번을 한 번으로 합친 새 목록. */
export function appendMove(moves: readonly Move[], move: Move): Move[] {
  if (move.kind !== 'slide') return [...moves, move];
  const last = moves[moves.length - 1];
  if (last?.kind !== 'slide') return [...moves, move];
  const dx = last.dx + safeInteger(move.dx, 'dx');
  const dy = last.dy + safeInteger(move.dy, 'dy');
  const merged: Move[] = moves.slice(0, -1);
  if (dx !== 0 || dy !== 0) merged.push({ kind: 'slide', dx, dy });
  return merged;
}

/** 이동이 하나도 없을 때의 기본 중심 인덱스. */
export function clampCenter(index: number, outline: readonly Pt[]): number {
  if (!Number.isInteger(index) || index < 0 || index >= outline.length) return 0;
  return index;
}

/** 중심 좌표가 그 도형의 꼭짓점이면 인덱스, 아니면 null. */
export function centerIndexAt(figure: SquareFigure, center: Pt): number | null {
  const index = figure.outline.findIndex(
    (point) => point[0] === center[0] && point[1] === center[1],
  );
  return index < 0 ? null : index;
}

/** Observation의 `centerLabel`은 A~J다. */
export function centerLabelAt(figure: SquareFigure, center: Pt): string | null {
  const index = centerIndexAt(figure, center);
  if (index === null || index > 9) return null;
  return String.fromCharCode('A'.charCodeAt(0) + index);
}

export function sideIndex(side: Side): number {
  return SIDES.indexOf(side);
}
