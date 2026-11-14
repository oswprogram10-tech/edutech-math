import { describe, expect, it } from 'vitest';
import {
  canonicalNetKey,
  evaluateNet,
  foldTransforms,
  type NetBoxSpec,
  type NetFaceInput,
} from '../net/geometry';

const CUBE_1: NetBoxSpec = { target: 'cube', faceSize: 1, dims: [1, 1, 1] };
const CUBE_2: NetBoxSpec = { target: 'cube', faceSize: 2, dims: [2, 2, 2] };
const CUBOID_432: NetBoxSpec = { target: 'cuboid', faceSize: 1, dims: [4, 3, 2] };

function unitCells(coords: readonly (readonly [number, number])[]): NetFaceInput[] {
  return coords.map(([x, y]) => ({ x, y, w: 1, h: 1 }));
}

function generateFreeHexominoes(): NetFaceInput[][] {
  const seen = new Set<string>();
  const unique: NetFaceInput[][] = [];

  function dfs(cells: [number, number][]): void {
    const key = canonicalNetKey(cells.map(([x, y]) => ({ x, y, w: 1, h: 1 })));
    if (cells.length === 6) {
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(cells.map(([x, y]) => ({ x, y, w: 1, h: 1 })));
      }
      return;
    }

    const occupied = new Set(cells.map(([x, y]) => `${x},${y}`));
    const frontier = new Map<string, [number, number]>();
    for (const [cx, cy] of cells) {
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nx = cx + dx;
        const ny = cy + dy;
        const k = `${nx},${ny}`;
        if (!occupied.has(k) && !frontier.has(k)) {
          frontier.set(k, [nx, ny]);
        }
      }
    }

    const candidates = [...frontier.values()];
    for (const next of candidates) {
      cells.push(next);
      dfs(cells);
      cells.pop();
    }
  }

  // 고정 5칸 정다각형 대신 전체 자유 6-폴리오미노 생성을 위해 부분 상태 중복도 줄인다.
  const visitedPartial = new Set<string>();
  function dfsFast(cells: [number, number][]): void {
    const asFaces = cells.map(([x, y]) => ({ x, y, w: 1, h: 1 }));
    const key = canonicalNetKey(asFaces);
    const tagged = `${cells.length}:${key}`;
    if (visitedPartial.has(tagged)) return;
    visitedPartial.add(tagged);

    if (cells.length === 6) {
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(asFaces);
      }
      return;
    }

    const occupied = new Set(cells.map(([x, y]) => `${x},${y}`));
    const frontier = new Map<string, [number, number]>();
    for (const [cx, cy] of cells) {
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nx = cx + dx;
        const ny = cy + dy;
        const k = `${nx},${ny}`;
        if (!occupied.has(k) && !frontier.has(k)) {
          frontier.set(k, [nx, ny]);
        }
      }
    }

    for (const next of frontier.values()) {
      cells.push(next);
      dfsFast(cells);
      cells.pop();
    }
  }

  void dfs;
  dfsFast([[0, 0]]);
  return unique;
}

describe('E12 net/geometry', () => {
  it('5-⑧ 정육면체 검산 예 6가지를 정확히 판정한다', () => {
    // 1. 1-4-1 십자 -> valid
    const cross = unitCells([
      [1, 0],
      [0, 1],
      [1, 1],
      [2, 1],
      [3, 1],
      [1, 2],
    ]);
    const crossEval = evaluateNet(cross, CUBE_1);
    expect(crossEval.valid).toBe(true);
    expect(crossEval.connected).toBe(true);
    expect(crossEval.overlapPairs).toBe(0);
    expect(crossEval.tornEdges).toBe(0);
    expect(crossEval.outsideFaces).toBe(0);
    expect(crossEval.missingSlots).toEqual([]);

    // 2. 일렬 6 -> overlapPairs 2, missing 2, torn 0
    const line6 = unitCells([
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
      [4, 0],
      [5, 0],
    ]);
    const lineEval = evaluateNet(line6, CUBE_1);
    expect(lineEval.valid).toBe(false);
    expect(lineEval.overlapPairs).toBe(2);
    expect(lineEval.missingSlots).toHaveLength(2);
    expect(lineEval.tornEdges).toBe(0);

    // 3. 2×3 직사각형 -> overlapPairs 3, torn 2, missing 2
    const rect2x3 = unitCells([
      [0, 0],
      [1, 0],
      [2, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ]);
    const rectEval = evaluateNet(rect2x3, CUBE_1);
    expect(rectEval.valid).toBe(false);
    expect(rectEval.overlapPairs).toBe(3);
    expect(rectEval.tornEdges).toBe(2);
    expect(rectEval.missingSlots).toHaveLength(2);

    // 4. 십자에서 (1,2) 뺀 5면 -> missing 1, overlap 0
    const fiveFaces = cross.filter((f) => !(f.x === 1 && f.y === 2));
    const fiveEval = evaluateNet(fiveFaces, CUBE_1);
    expect(fiveEval.valid).toBe(false);
    expect(fiveEval.missingSlots).toHaveLength(1);
    expect(fiveEval.overlapPairs).toBe(0);

    // 5. 십자 + (2,2) 7면 -> overlap 1, torn 1, missing 0
    const sevenFaces = [...cross, { x: 2, y: 2, w: 1, h: 1 }];
    const sevenEval = evaluateNet(sevenFaces, CUBE_1);
    expect(sevenEval.valid).toBe(false);
    expect(sevenEval.overlapPairs).toBe(1);
    expect(sevenEval.tornEdges).toBe(1);
    expect(sevenEval.missingSlots).toHaveLength(0);

    // 6. 십자 + (5,5) 떨어진 면 -> connected false, missing 1? 아니지, 잠깐: 십자 자체 6면+떨어진 면이면 missing 0!
    // 카드 표기: "십자 + (5,5) 떨어진 면 | connected false, missing 1" -> 바닥 포함 5면에 (5,5)가 떨어진 경우를 포함해 둘 다 점검한다.
    const disconnected6 = [...fiveFaces, { x: 5, y: 5, w: 1, h: 1 }];
    const discEval = evaluateNet(disconnected6, CUBE_1);
    expect(discEval.valid).toBe(false);
    expect(discEval.connected).toBe(false);
    expect(discEval.missingSlots).toHaveLength(1);
  });

  it('5-⑧ 자유 6칸 도형 35가지 중 valid 정확히 11가지, 정규형 키 11가지', () => {
    const hexominoes = generateFreeHexominoes();
    expect(hexominoes).toHaveLength(35);

    const validNets = hexominoes.filter((net) => evaluateNet(net, CUBE_1).valid);
    expect(validNets).toHaveLength(11);

    const validKeys = new Set(validNets.map((net) => evaluateNet(net, CUBE_1).netKey));
    expect(validKeys.size).toBe(11);

    const invalidCounts = hexominoes.filter((net) => !evaluateNet(net, CUBE_1).valid);
    expect(invalidCounts).toHaveLength(24);
  });

  it('5-⑨ 직육면체 4×3×2 검산 예', () => {
    const validCuboid: NetFaceInput[] = [
      { x: 2, y: 2, w: 4, h: 3 }, // 바닥
      { x: 2, y: 0, w: 4, h: 2 }, // 뒤
      { x: 2, y: 5, w: 4, h: 2 }, // 앞
      { x: 0, y: 2, w: 2, h: 3 }, // 왼
      { x: 6, y: 2, w: 2, h: 3 }, // 오른
      { x: 2, y: 7, w: 4, h: 3 }, // 위
    ];
    const validEval = evaluateNet(validCuboid, CUBOID_432);
    expect(validEval.valid).toBe(true);
    expect(validEval.overlapPairs).toBe(0);
    expect(validEval.tornEdges).toBe(0);
    expect(validEval.outsideFaces).toBe(0);
    expect(validEval.missingSlots).toEqual([]);

    const badCuboid: NetFaceInput[] = [
      { x: 2, y: 2, w: 4, h: 3 },
      { x: 2, y: 0, w: 4, h: 2 },
      { x: 2, y: 5, w: 4, h: 2 },
      { x: 0, y: 2, w: 2, h: 3 },
      { x: 6, y: 2, w: 2, h: 3 },
      { x: 6, y: 5, w: 4, h: 3 }, // 위 면을 옮김
    ];
    const badEval = evaluateNet(badCuboid, CUBOID_432);
    expect(badEval.valid).toBe(false);
    expect(badEval.overlapPairs).toBe(1);
    expect(badEval.tornEdges).toBe(1);
    expect(badEval.outsideFaces).toBe(1);
    expect(badEval.missingSlots).toHaveLength(1);
  });

  it('5-⑩ 마주 보는 면(label 기준) 검산 예 2가지', () => {
    const net1: NetFaceInput[] = [
      { x: 0, y: 0, w: 1, h: 1, label: '★' },
      { x: 0, y: 1, w: 1, h: 1, label: 'ㄱ' },
      { x: 1, y: 1, w: 1, h: 1, label: 'ㄴ' },
      { x: 2, y: 1, w: 1, h: 1, label: 'ㄷ' },
      { x: 3, y: 1, w: 1, h: 1, label: 'ㄹ' },
      { x: 2, y: 2, w: 1, h: 1, label: 'ㅁ' },
    ];
    const eval1 = evaluateNet(net1, CUBE_1);
    expect(eval1.valid).toBe(true);
    expect(eval1.opposites).toEqual({
      '★': 'ㅁ',
      ㅁ: '★',
      ㄱ: 'ㄷ',
      ㄷ: 'ㄱ',
      ㄴ: 'ㄹ',
      ㄹ: 'ㄴ',
    });

    const net2: NetFaceInput[] = [
      { x: 1, y: 0, w: 1, h: 1, label: '★' },
      { x: 1, y: 1, w: 1, h: 1, label: 'ㄱ' },
      { x: 0, y: 1, w: 1, h: 1, label: 'ㄴ' },
      { x: 1, y: 2, w: 1, h: 1, label: 'ㄷ' },
      { x: 2, y: 2, w: 1, h: 1, label: 'ㄹ' },
      { x: 2, y: 3, w: 1, h: 1, label: 'ㅁ' },
    ];
    const eval2 = evaluateNet(net2, CUBE_1);
    expect(eval2.valid).toBe(true);
    expect(eval2.opposites).toEqual({
      '★': 'ㄷ',
      ㄷ: '★',
      ㄱ: 'ㅁ',
      ㅁ: 'ㄱ',
      ㄴ: 'ㄹ',
      ㄹ: 'ㄴ',
    });
  });

  it('정규형 키가 회전·뒤집기·평행이동에 불변이다', () => {
    const cuboid: NetFaceInput[] = [
      { x: 2, y: 2, w: 4, h: 3, label: '★' },
      { x: 2, y: 0, w: 4, h: 2 },
      { x: 2, y: 5, w: 4, h: 2 },
      { x: 0, y: 2, w: 2, h: 3 },
      { x: 6, y: 2, w: 2, h: 3 },
      { x: 2, y: 7, w: 4, h: 3 },
    ];
    const baseKey = canonicalNetKey(cuboid);

    // 평행이동
    const shifted = cuboid.map((f) => ({ ...f, x: f.x + 5, y: f.y + 3 }));
    expect(canonicalNetKey(shifted)).toBe(baseKey);

    // 90° 회전 + 뒤집기
    const rotated = cuboid.map((f) => ({ x: f.y, y: -(f.x + f.w), w: f.h, h: f.w }));
    expect(canonicalNetKey(rotated)).toBe(baseKey);

    const flipped = cuboid.map((f) => ({ x: -(f.x + f.w), y: f.y, w: f.w, h: f.h }));
    expect(canonicalNetKey(flipped)).toBe(baseKey);
  });

  it('foldTransforms(π/2)가 정수 결과와 1e-9 안에서 일치한다', () => {
    const cuboid: NetFaceInput[] = [
      { x: 2, y: 2, w: 4, h: 3 },
      { x: 2, y: 0, w: 4, h: 2 },
      { x: 2, y: 5, w: 4, h: 2 },
      { x: 0, y: 2, w: 2, h: 3 },
      { x: 6, y: 2, w: 2, h: 3 },
      { x: 2, y: 7, w: 4, h: 3 },
    ];
    const evalRes = evaluateNet(cuboid, CUBOID_432);
    const transforms = foldTransforms(cuboid, Math.PI / 2);
    expect(transforms).toHaveLength(cuboid.length);

    transforms.forEach((tr, i) => {
      const box = evalRes.boxes3D[i];
      expect(box).not.toBeNull();
      if (!box) return;
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      let minZ = Infinity;
      let maxZ = -Infinity;
      for (const [cx, cy, cz] of tr.corners) {
        minX = Math.min(minX, cx);
        maxX = Math.max(maxX, cx);
        minY = Math.min(minY, cy);
        maxY = Math.max(maxY, cy);
        minZ = Math.min(minZ, cz);
        maxZ = Math.max(maxZ, cz);
      }
      expect(Math.abs(minX - box.minX)).toBeLessThan(1e-9);
      expect(Math.abs(maxX - box.maxX)).toBeLessThan(1e-9);
      expect(Math.abs(minY - box.minY)).toBeLessThan(1e-9);
      expect(Math.abs(maxY - box.maxY)).toBeLessThan(1e-9);
      expect(Math.abs(minZ - box.minZ)).toBeLessThan(1e-9);
      expect(Math.abs(maxZ - box.maxZ)).toBeLessThan(1e-9);
    });
  });

  it('faceSize 2 십자가 valid다', () => {
    const cross2: NetFaceInput[] = [
      { x: 2, y: 0, w: 2, h: 2 },
      { x: 0, y: 2, w: 2, h: 2 },
      { x: 2, y: 2, w: 2, h: 2 },
      { x: 4, y: 2, w: 2, h: 2 },
      { x: 6, y: 2, w: 2, h: 2 },
      { x: 2, y: 4, w: 2, h: 2 },
    ];
    const res = evaluateNet(cross2, CUBE_2);
    expect(res.valid).toBe(true);
    expect(res.connected).toBe(true);
    expect(res.overlapPairs).toBe(0);
    expect(res.tornEdges).toBe(0);
    expect(res.outsideFaces).toBe(0);
    expect(res.missingSlots).toEqual([]);
  });
});
