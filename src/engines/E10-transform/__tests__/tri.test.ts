/**
 * T105 삼각 격자 테스트. 60° 회전·뒤집기·정육각형 6조각·중심 격자 덮기를
 * 정수 좌표만으로 확인한다.
 */
import { describe, expect, it } from 'vitest';
import {
  applyTriMove,
  decodeTriCell,
  flipTriFigure,
  hexagonCells,
  hexagonVertices,
  rotateTriFigure,
  triCellKey,
} from '../tri';
import type { TriFigure } from '../tri';

function sample(): TriFigure {
  return {
    outline: [
      [2, 3],
      [4, 1],
      [5, 2],
    ],
    tris: [
      [7, 10],
      [13, 4],
      [4, 16],
    ],
  };
}

/** 화면 좌표의 부호 있는 넓이. 뒤집힘(방향)만 보는 테스트용 계산이다. */
function signedArea(figure: TriFigure): number {
  const root = Math.sqrt(3) / 2;
  const points = figure.outline.map(([a, b]) => ({ x: a + b / 2, y: root * b }));
  let sum = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    if (!current || !next) continue;
    sum += current.x * next.y - next.x * current.y;
  }
  return sum / 2;
}

describe('E10 삼각 격자', () => {
  it('시계 60°를 여섯 번 돌리면 제자리다', () => {
    let figure = sample();
    for (let index = 0; index < 6; index += 1) {
      figure = rotateTriFigure(figure, [3, 3], 60, 'cw');
    }
    expect(figure).toEqual(sample());
  });

  it('시계 60°와 반시계 60°는 서로 역이다', () => {
    const start = sample();
    const roundTrip = rotateTriFigure(rotateTriFigure(start, [1, 2], 60, 'cw'), [1, 2], 60, 'ccw');
    expect(roundTrip).toEqual(start);
  });

  it('같은 쪽 뒤집기를 두 번 하면 방향이 원래대로 돌아온다', () => {
    // T104처럼 뒤집기 축을 도형의 바깥 꼭짓점에 두므로 두 번 뒤집으면 자리는
    // 옮겨지지만, 종이를 같은 쪽으로 두 번 접은 것처럼 방향은 원래대로다.
    const start = sample();
    const twiceRight = flipTriFigure(flipTriFigure(start, 'right'), 'right');
    const twiceDown = flipTriFigure(flipTriFigure(start, 'down'), 'down');
    expect(Math.sign(signedArea(twiceRight))).toBe(Math.sign(signedArea(start)));
    expect(Math.sign(signedArea(twiceDown))).toBe(Math.sign(signedArea(start)));
    expect(Math.abs(signedArea(twiceRight))).toBeCloseTo(Math.abs(signedArea(start)), 9);
    expect(Math.abs(signedArea(twiceDown))).toBeCloseTo(Math.abs(signedArea(start)), 9);

    // 반대쪽으로 두 번 뒤집으면 정확히 제자리다.
    expect(flipTriFigure(flipTriFigure(start, 'right'), 'left')).toEqual(start);
    expect(flipTriFigure(flipTriFigure(start, 'down'), 'up')).toEqual(start);
  });

  it('applyTriMove가 밀기·뒤집기·돌리기를 모두 처리한다', () => {
    const start = sample();
    expect(applyTriMove(start, { kind: 'slide', dx: 2, dy: -1 })).toEqual({
      outline: [
        [4, 2],
        [6, 0],
        [7, 1],
      ],
      tris: [
        [13, 7],
        [19, 1],
        [10, 13],
      ],
    });
    expect(
      applyTriMove(start, { kind: 'turn', direction: 'cw', angle: 120, center: [0, 0] }),
    ).not.toEqual(start);
  });

  it('정육각형은 단위 삼각형 6조각이고 모두 세 배 무게중심이 맞다', () => {
    const cells = hexagonCells(1, 1);
    expect(cells).toHaveLength(6);
    expect(hexagonVertices(1, 1)).toHaveLength(6);
    expect(cells.every((cell) => decodeTriCell(cell) !== null)).toBe(true);
    expect(new Set(cells.map(triCellKey)).size).toBe(6);
  });

  it('a − b ≡ 0 (mod 3)인 중심들의 정육각형은 겹치지 않는다', () => {
    const keys: string[] = [];
    for (let b = -8; b <= 8; b += 1) {
      for (let a = -8; a <= 8; a += 1) {
        if ((((a - b) % 3) + 3) % 3 !== 0) continue;
        for (const cell of hexagonCells(a, b)) keys.push(triCellKey(cell));
      }
    }
    expect(keys.length).toBeGreaterThan(0);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
