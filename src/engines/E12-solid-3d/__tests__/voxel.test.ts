/**
 * E12 voxel·layout 순수 함수 단위 테스트(경계값·T130 5번·6번·13번 목록).
 */
import { describe, expect, it, vi } from 'vitest';
import { sortCubesForPainter } from '../layout';
import type { CubeCoord } from '../types';
import {
  findHiddenCubes,
  frontView,
  hasFloatingCubes,
  heightMap,
  isConnected,
  normalizeCubes,
  rotateCell,
  rotatedGridSize,
  sameCells,
  sameHeights,
  sideView,
  topView,
  unrotateCell,
  viewsCountRange,
  viewsCountSolutions,
} from '../voxel';

describe('E12 voxel 투영 행렬', () => {
  it('0개, 1개, 꽉 찬 격자(3×2×2)의 높이와 세 투영을 계산한다', () => {
    const grid = [3, 2] as const;
    const maxHeight = 2;

    expect(heightMap([], grid)).toEqual([
      [0, 0, 0],
      [0, 0, 0],
    ]);
    expect(topView([], grid)).toEqual([
      [0, 0, 0],
      [0, 0, 0],
    ]);
    expect(frontView([], grid, maxHeight)).toEqual([
      [0, 0, 0],
      [0, 0, 0],
    ]);
    expect(sideView([], grid, maxHeight)).toEqual([
      [0, 0],
      [0, 0],
    ]);

    const one = [{ x: 0, y: 0, z: 0 }];
    expect(heightMap(one, grid)).toEqual([
      [0, 0, 0],
      [1, 0, 0],
    ]);
    expect(topView(one, grid)).toEqual([
      [0, 0, 0],
      [1, 0, 0],
    ]);
    expect(frontView(one, grid, maxHeight)).toEqual([
      [0, 0, 0],
      [1, 0, 0],
    ]);
    expect(sideView(one, grid, maxHeight)).toEqual([
      [0, 0],
      [1, 0],
    ]);

    const full: { x: number; y: number; z: number }[] = [];
    for (let x = 0; x < grid[0]; x += 1) {
      for (let y = 0; y < grid[1]; y += 1) {
        for (let z = 0; z < maxHeight; z += 1) {
          full.push({ x, y, z });
        }
      }
    }
    expect(heightMap(full, grid)).toEqual([
      [2, 2, 2],
      [2, 2, 2],
    ]);
    expect(topView(full, grid)).toEqual([
      [1, 1, 1],
      [1, 1, 1],
    ]);
    expect(frontView(full, grid, maxHeight)).toEqual([
      [1, 1, 1],
      [1, 1, 1],
    ]);
    expect(sideView(full, grid, maxHeight)).toEqual([
      [1, 1],
      [1, 1],
    ]);
  });

  it('g6s2u3.A3 예시 세 투영을 동시에 만족하는 모양을 넣으면 세 투영이 그대로 나온다', () => {
    const cubes = [
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
      { x: 0, y: 1, z: 1 },
      { x: 1, y: 1, z: 0 },
      { x: 0, y: 2, z: 0 },
      { x: 1, y: 2, z: 0 },
      { x: 2, y: 2, z: 0 },
      { x: 2, y: 2, z: 1 },
      { x: 2, y: 2, z: 2 },
    ];
    const grid = [3, 3] as const;
    expect(topView(cubes, grid)).toEqual([
      [1, 1, 1],
      [1, 1, 0],
      [1, 0, 0],
    ]);
    expect(frontView(cubes, grid, 3)).toEqual([
      [0, 0, 1],
      [1, 0, 1],
      [1, 1, 1],
    ]);
    expect(sideView(cubes, grid, 3)).toEqual([
      [0, 0, 1],
      [0, 1, 1],
      [1, 1, 1],
    ]);
  });

  it('옆 투영(오른쪽): 앞 줄(y=0)만 높은 모양에서 왼쪽 열이 높다', () => {
    const cubes = [
      { x: 1, y: 0, z: 0 },
      { x: 1, y: 0, z: 1 },
      { x: 1, y: 0, z: 2 },
      { x: 1, y: 2, z: 0 },
    ];
    expect(sideView(cubes, [3, 3], 3)).toEqual([
      [1, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
    ]);
  });

  it('앞 투영: 같은 열의 낮은 앞 기둥과 높은 뒤 기둥 중 높은 것이 보인다', () => {
    const cubes = [
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 2, z: 0 },
      { x: 0, y: 2, z: 1 },
      { x: 0, y: 2, z: 2 },
    ];
    expect(frontView(cubes, [3, 3], 3)).toEqual([
      [1, 0, 0],
      [1, 0, 0],
      [1, 0, 0],
    ]);
  });
});

describe('E12 정규화·회전·연결성·가림·화가 정렬', () => {
  it('sameCells: 크기가 달라도 바닥·왼쪽 기준으로 비교하고, top만 세로 시프트를 허용한다', () => {
    const frontA = [
      [0, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 1, 1, 0],
    ];
    const frontB = [
      [1, 0],
      [1, 1],
    ];
    expect(sameCells(frontA, frontB, true, false)).toBe(true);
    expect(sameCells(frontA, frontB, false, false)).toBe(false);

    // 앞 투영은 세로(바닥)로 밀지 않는다.
    const floatingRow = [
      [1, 0],
      [1, 1],
      [0, 0],
    ];
    expect(sameCells(frontB, floatingRow, true, false)).toBe(false);
    // 위 투영은 행·열 모두 밀어 비교한다.
    expect(sameCells(frontB, floatingRow, true, true)).toBe(true);

    expect(
      sameHeights(
        [
          [0, 0, 0],
          [0, 2, 1],
          [0, 0, 0],
        ],
        [[2, 1]],
        true,
      ),
    ).toBe(true);
  });

  it('normalizeCubes: 평행이동·90° 회전은 일치하고, 거울상 L자 뒤집기는 rotate: true여도 불일치한다', () => {
    const base: CubeCoord[] = [
      [0, 0, 0],
      [0, 1, 0],
      [0, 2, 0],
      [1, 0, 0],
    ];
    const shifted: CubeCoord[] = [
      [2, 1, 0],
      [2, 2, 0],
      [2, 3, 0],
      [3, 1, 0],
    ];
    expect(normalizeCubes(shifted, false)).toEqual(normalizeCubes(base, false));

    // 90° 반시계 회전: (x, y) -> (-y, x)
    const rotated90: CubeCoord[] = base.map(([x, y, z]) => [3 - y, x, z]);
    expect(normalizeCubes(rotated90, false)).not.toEqual(normalizeCubes(base, false));
    expect(normalizeCubes(rotated90, true)).toEqual(normalizeCubes(base, true));

    // 거울상 L자
    const mirrored: CubeCoord[] = [
      [0, 0, 0],
      [1, 0, 0],
      [1, 1, 0],
      [1, 2, 0],
    ];
    expect(normalizeCubes(mirrored, true)).not.toEqual(normalizeCubes(base, true));
  });

  it('네 번 돌리면 제자리로 오고, rows ≠ cols([4, 2]) 격자 크기가 홀수 회전에서 바뀐다', () => {
    const cols = 4;
    const rows = 2;
    expect(rotatedGridSize(cols, rows, 0)).toEqual([4, 2]);
    expect(rotatedGridSize(cols, rows, 1)).toEqual([2, 4]);
    expect(rotatedGridSize(cols, rows, 2)).toEqual([4, 2]);
    expect(rotatedGridSize(cols, rows, 3)).toEqual([2, 4]);

    for (let x = 0; x < cols; x += 1) {
      for (let y = 0; y < rows; y += 1) {
        let cur: readonly [number, number] = [x, y];
        let c = cols;
        let r = rows;
        for (let step = 0; step < 4; step += 1) {
          cur = rotateCell(cur[0], cur[1], c, r, 1);
          [c, r] = [r, c];
        }
        expect(cur).toEqual([x, y]);

        for (const turn of [0, 1, 2, 3] as const) {
          const rotated = rotateCell(x, y, cols, rows, turn);
          expect(unrotateCell(rotated[0], rotated[1], cols, rows, turn)).toEqual([x, y]);
        }
      }
    }
  });

  it('isConnected: 0·1개와 맞닿은 모양은 true, 떨어진 기둥은 false다', () => {
    expect(isConnected([])).toBe(true);
    expect(isConnected([[2, 2, 0]])).toBe(true);
    expect(
      isConnected([
        [0, 0, 0],
        [0, 0, 1],
        [1, 0, 1],
      ]),
    ).toBe(true);
    expect(
      isConnected([
        [0, 0, 0],
        [2, 0, 0],
      ]),
    ).toBe(false);
    // 모서리만 닿고 면이 맞닿지 않으면 연결이 아니다.
    expect(
      isConnected([
        [0, 0, 0],
        [1, 1, 0],
      ]),
    ).toBe(false);
  });

  it('2×2×2 꽉 찬 덩어리에서 현재 시선으로 완전히 가려진 쌓기나무는 1개(맨 뒤-왼쪽-아래)다', () => {
    const block: { x: number; y: number; z: number }[] = [];
    for (let x = 0; x < 2; x += 1) {
      for (let y = 0; y < 2; y += 1) {
        for (let z = 0; z < 2; z += 1) {
          block.push({ x, y, z });
        }
      }
    }
    expect(findHiddenCubes(block, 2, 2, 0)).toEqual([[0, 1, 0]]);
    expect(findHiddenCubes(block, 2, 2, 1)).toEqual([[1, 1, 0]]);
    expect(findHiddenCubes(block, 2, 2, 2)).toEqual([[1, 0, 0]]);
    expect(findHiddenCubes(block, 2, 2, 3)).toEqual([[0, 0, 0]]);
  });

  it('2×2×2 화가 알고리즘 정렬이 rx - ry + z 오름차순이다', () => {
    const block: { x: number; y: number; z: number }[] = [];
    for (let x = 0; x < 2; x += 1) {
      for (let y = 0; y < 2; y += 1) {
        for (let z = 0; z < 2; z += 1) {
          block.push({ x, y, z });
        }
      }
    }
    const sorted = sortCubesForPainter(block, 2, 2, 0);
    expect(sorted).toHaveLength(8);
    for (let i = 1; i < sorted.length; i += 1) {
      const curr = sorted[i];
      const prev = sorted[i - 1];
      if (!curr || !prev) throw new Error('expected sorted entries');
      expect(curr.depth).toBeGreaterThanOrEqual(prev.depth);
    }
    // 가장 먼저 그리는 칸: (0, 1, 0) -> depth -1, 가장 나중: (1, 0, 1) -> depth +2
    const first = sorted[0];
    const last = sorted[7];
    if (!first || !last) throw new Error('expected 8 sorted entries');
    expect([first.cube.x, first.cube.y, first.cube.z]).toEqual([0, 1, 0]);
    expect([last.cube.x, last.cube.y, last.cube.z]).toEqual([1, 0, 1]);
  });

  it('hasFloatingCubes는 빈틈없는 기둥에서는 false, z가 건너뛰면 true다', () => {
    expect(
      hasFloatingCubes([
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: 1 },
      ]),
    ).toBe(false);
    expect(hasFloatingCubes([{ x: 0, y: 0, z: 1 }])).toBe(true);
    expect(
      hasFloatingCubes([
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: 2 },
      ]),
    ).toBe(true);
  });

  it('viewsCountRange는 명세 3×3 예시에서 min 9·max 10을 돌려준다', () => {
    const views = {
      top: [
        [1, 1, 1],
        [1, 1, 0],
        [1, 0, 0],
      ],
      front: [
        [0, 0, 1],
        [1, 0, 1],
        [1, 1, 1],
      ],
      side: [
        [0, 0, 1],
        [0, 1, 1],
        [1, 1, 1],
      ],
    };
    const range = viewsCountRange(views);
    expect(range).toEqual({ min: 9, max: 10 });
    const solutions = viewsCountSolutions(views);
    expect(solutions).not.toBeNull();
    expect(solutions?.min).toBe(9);
    expect(solutions?.max).toBe(10);
    const heightSum = (m: readonly (readonly number[])[]) =>
      m.reduce((acc, row) => acc + row.reduce((s, v) => s + v, 0), 0);
    expect(heightSum(solutions?.minHeights ?? [])).toBe(9);
    expect(heightSum(solutions?.maxHeights ?? [])).toBe(10);
  });

  it('viewsCountRange는 유일 해(L자·한 칸), 2×2×2(6/8), 해 없음, 탐색 한도 초과를 구분한다', () => {
    // 정육면체 2×2×2의 세 투영(모두 1)은 [[2,1],[1,2]] 6개부터 8개까지 가능
    expect(
      viewsCountRange({
        top: [
          [1, 1],
          [1, 1],
        ],
        front: [
          [1, 1],
          [1, 1],
        ],
        side: [
          [1, 1],
          [1, 1],
        ],
      }),
    ).toEqual({ min: 6, max: 8 });

    // 유일 해 L자(높이: (0,1)=2, (1,1)=1, (1,0)=1) -> 4/4
    expect(
      viewsCountRange({
        top: [
          [1, 1],
          [0, 1],
        ],
        front: [
          [1, 0],
          [1, 1],
        ],
        side: [
          [0, 1],
          [1, 1],
        ],
      }),
    ).toEqual({ min: 4, max: 4 });

    expect(
      viewsCountRange({
        top: [
          [0, 0],
          [1, 0],
        ],
        front: [
          [0, 0],
          [1, 0],
        ],
        side: [
          [0, 0],
          [1, 0],
        ],
      }),
    ).toEqual({ min: 1, max: 1 });

    // 뜬 칸(앞면 2층만 있고 1층이 빔)은 만들 수 없다
    expect(
      viewsCountRange({
        top: [
          [0, 0],
          [1, 0],
        ],
        front: [
          [1, 0],
          [0, 0],
        ],
        side: [
          [1, 0],
          [0, 0],
        ],
      }),
    ).toBeNull();

    // 4×4 모두 켜짐, maxHeight=3 -> 3^16 > 200,000 -> 경고 후 null
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const huge = viewsCountRange({
      top: [
        [1, 1, 1, 1],
        [1, 1, 1, 1],
        [1, 1, 1, 1],
        [1, 1, 1, 1],
      ],
      front: [
        [1, 1, 1, 1],
        [1, 1, 1, 1],
        [1, 1, 1, 1],
      ],
      side: [
        [1, 1, 1, 1],
        [1, 1, 1, 1],
        [1, 1, 1, 1],
      ],
    });
    expect(huge).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
