/** E10 정수 모눈 변환 경계 테스트. */
import { describe, expect, it } from 'vitest';
import { gp, isSimplePolygon, polygonArea } from '../../../core/math';
import { normalizeCells, orientCells, orientationOf } from '../orientation';
import {
  cellKey,
  flipFigure,
  inGrid,
  rotateCell,
  rotateFigure,
  rotatePt,
  translateFigure,
} from '../square';
import { presetFigure, SHAPE_IDS, SHAPES } from '../shapes';
import { ORIENTATIONS } from '../types';
import type { Cell, Pt, Side } from '../types';

const SIDES: readonly Side[] = ['up', 'down', 'left', 'right'];

describe('E10 rotatePt·rotateCell', () => {
  it('0 좌표와 칸 꼭짓점 중심에서도 정수로 간다', () => {
    expect(rotatePt([0, 0], [0, 0], 90, 'cw')).toEqual([0, 0]);
    expect(rotatePt([3, 3], [2, 3], 90, 'cw')).toEqual([2, 4]);
    expect(rotateCell([2, 3], [2, 3], 90, 'cw')).toEqual([1, 3]);
    // 칸을 그 칸의 꼭짓점 중심으로 180° 돌리면 대각선 건너 칸으로 간다.
    expect(rotateCell([0, 0], [0, 0], 180, 'ccw')).toEqual([-1, -1]);
  });

  it('정수가 아닌 입력은 예외를 던진다', () => {
    expect(() => rotatePt([0.5, 0], [0, 0], 90, 'cw')).toThrow(RangeError);
    expect(() => rotatePt([0, 0], [1.5, 0], 90, 'cw')).toThrow(RangeError);
    expect(() => rotateCell([0, 0], [0, 0], 90, 'cw')).not.toThrow();
    expect(() => rotateCell([0.5, 0], [0, 0], 90, 'cw')).toThrow(RangeError);
    expect(() => translateFigure({ outline: [[0, 0]], cells: [[0, 0]] }, 0.5, 0)).toThrow(
      RangeError,
    );
  });

  it('시계 90°를 네 번 하면 제자리다', () => {
    let cell: Cell = [3, 5];
    let point: Pt = [3, 5];
    for (let count = 0; count < 4; count += 1) {
      cell = rotateCell(cell, [4, 3], 90, 'cw');
      point = rotatePt(point, [4, 3], 90, 'cw');
    }
    expect(cell).toEqual([3, 5]);
    expect(point).toEqual([3, 5]);
  });

  it('시계 270°는 반시계 90°와 같다', () => {
    const center: Pt = [4, 3];
    for (const cell of [
      [0, 0],
      [4, 3],
      [9, 9],
    ] as const) {
      expect(rotateCell(cell, center, 270, 'cw')).toEqual(rotateCell(cell, center, 90, 'ccw'));
      expect(rotateCell(cell, center, 270, 'ccw')).toEqual(rotateCell(cell, center, 90, 'cw'));
    }
  });

  it('뒤집기를 두 번 하면 방향이 제자리이고, 반대쪽으로 두 번 하면 도형도 제자리다', () => {
    const figure = presetFigure('flag-L', [1, 1]);
    for (const side of SIDES) {
      const twice = flipFigure(flipFigure(figure, side), side);
      // 같은 쪽 변을 축으로 두 번 뒤집으면 방향은 id로 돌아오지만 폭만큼 옮겨진다.
      expect(orientationOf(figure.cells, twice.cells)).toBe('id');
    }
    const pairs: readonly (readonly [Side, Side])[] = [
      ['left', 'right'],
      ['right', 'left'],
      ['up', 'down'],
      ['down', 'up'],
    ];
    for (const [first, second] of pairs) {
      expect(flipFigure(flipFigure(figure, first), second)).toEqual(figure);
    }
  });

  it('회전·뒤집기 뒤에도 모든 칸이 모눈 안에 있는지 센다', () => {
    const figure = presetFigure('flag-L', [4, 3]);
    expect(inGrid(figure, 10)).toBe(true);
    expect(inGrid(translateFigure(figure, 20, 0), 10)).toBe(false);
  });
});

describe('E10 도형 프리셋', () => {
  it('세 프리셋의 다각형 넓이가 칸 수와 같고 단순 다각형이다', () => {
    for (const shape of SHAPE_IDS) {
      const preset = SHAPES[shape];
      const points = preset.outline.map((point) => gp(point[0], point[1]));
      expect(polygonArea(points).toString()).toBe(String(preset.cells.length));
      expect(isSimplePolygon(points)).toBe(true);
    }
  });

  it('세 프리셋 모두 8가지 방향이 서로 다르다', () => {
    for (const shape of SHAPE_IDS) {
      const start = presetFigure(shape, [0, 0]);
      const keys = new Set(
        ORIENTATIONS.map((orientation) =>
          normalizeCells(orientCells(start.cells, orientation, [0, 0])),
        ),
      );
      expect(keys.size).toBe(8);
    }
  });

  it('돌린 뒤에도 꼭짓점 순서가 유지되어 이름표가 따라간다', () => {
    const figure = presetFigure('flag-L', [4, 3]);
    const turned = rotateFigure(figure, [4, 3], 90, 'cw');
    expect(turned.outline).toHaveLength(figure.outline.length);
    expect(turned.outline[0]).toEqual([4, 3]);
    expect(turned.cells).toEqual(figure.cells.map((cell) => rotateCell(cell, [4, 3], 90, 'cw')));
    expect(new Set(turned.cells.map(cellKey)).size).toBe(turned.cells.length);
  });
});
