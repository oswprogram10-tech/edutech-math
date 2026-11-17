import { describe, expect, it } from 'vitest';
import {
  boxesOfVolume,
  divisors,
  faceArea,
  faceSize,
  minSurfaceBox,
  netBounds,
  netLayout,
  paintedArea,
  pairOf,
  sameBox,
  sortedDims,
  SV_FACE_IDS,
  surfaceArea,
  volume,
} from '../sv/geometry';

describe('surface-volume 기하(정수)', () => {
  it('겉넓이와 부피: 4×3×2 = 52·24, 정육면체 5 → 150·125', () => {
    expect(surfaceArea(4, 3, 2)).toBe(52);
    expect(volume(4, 3, 2)).toBe(24);
    expect(surfaceArea(5, 5, 5)).toBe(150);
    expect(volume(5, 5, 5)).toBe(125);
    expect(surfaceArea(1, 1, 1)).toBe(6);
    expect(surfaceArea(1, 1, 24)).toBe(98);
    expect(surfaceArea(10, 10, 10)).toBe(600);
  });

  it('면 크기: front/back w×h, left/right d×h, top/bottom w×d', () => {
    expect(faceSize('front', 4, 3, 2)).toEqual([4, 2]);
    expect(faceSize('back', 4, 3, 2)).toEqual([4, 2]);
    expect(faceSize('left', 4, 3, 2)).toEqual([3, 2]);
    expect(faceSize('right', 4, 3, 2)).toEqual([3, 2]);
    expect(faceSize('top', 4, 3, 2)).toEqual([4, 3]);
    expect(faceSize('bottom', 4, 3, 2)).toEqual([4, 3]);
    const sum = SV_FACE_IDS.reduce((s, f) => s + faceArea(f, 4, 3, 2), 0);
    expect(sum).toBe(52);
  });

  it('칠한 넓이: 면 쌍이 같은 크기이고 6면이면 겉넓이', () => {
    expect(paintedArea([], 4, 3, 2)).toBe(0);
    expect(paintedArea(['front'], 4, 3, 2)).toBe(8);
    expect(paintedArea(['front', 'back'], 4, 3, 2)).toBe(16);
    expect(paintedArea([...SV_FACE_IDS], 4, 3, 2)).toBe(52);
  });

  it('마주 보는 면 쌍은 같은 쌍 이름을 가진다', () => {
    expect(pairOf('front')).toBe(pairOf('back'));
    expect(pairOf('left')).toBe(pairOf('right'));
    expect(pairOf('top')).toBe(pairOf('bottom'));
    expect(new Set(SV_FACE_IDS.map(pairOf)).size).toBe(3);
  });

  it('부피 24의 조합은 여섯 가지이고 겉넓이가 가장 작은 상자는 2×3×4', () => {
    expect(boxesOfVolume(24)).toEqual([
      [1, 1, 24],
      [1, 2, 12],
      [1, 3, 8],
      [1, 4, 6],
      [2, 2, 6],
      [2, 3, 4],
    ]);
    expect(minSurfaceBox(24)).toEqual([2, 3, 4]);
    expect(surfaceArea(2, 3, 4)).toBe(52);
  });

  it('부피 1·소수 7·완전세제곱·큰 수의 조합', () => {
    expect(boxesOfVolume(1)).toEqual([[1, 1, 1]]);
    expect(minSurfaceBox(1)).toEqual([1, 1, 1]);
    expect(boxesOfVolume(7)).toEqual([[1, 1, 7]]);
    expect(minSurfaceBox(7)).toEqual([1, 1, 7]);
    expect(boxesOfVolume(27)).toContainEqual([3, 3, 3]);
    expect(minSurfaceBox(27)).toEqual([3, 3, 3]);
    expect(minSurfaceBox(64)).toEqual([4, 4, 4]);
    expect(boxesOfVolume(0)).toEqual([]);
    expect(boxesOfVolume(-4)).toEqual([]);
    expect(boxesOfVolume(2.5)).toEqual([]);
    expect(minSurfaceBox(0)).toBeNull();
    for (const box of boxesOfVolume(64)) expect(volume(box[0], box[1], box[2])).toBe(64);
  });

  it('약수와 같은 상자 비교(세 수 정렬)', () => {
    expect(divisors(24)).toEqual([1, 2, 3, 4, 6, 8, 12, 24]);
    expect(divisors(1)).toEqual([1]);
    expect(sortedDims(4, 3, 2)).toEqual([2, 3, 4]);
    expect(sameBox([2, 3, 4], [4, 3, 2])).toBe(true);
    expect(sameBox([1, 1, 24], [1, 24, 1])).toBe(true);
    expect(sameBox([2, 3, 4], [2, 2, 6])).toBe(false);
  });

  it('전개도 배치: 십자형이고 면 넓이 합은 겉넓이, 서로 겹치지 않는다', () => {
    for (const [w, d, h] of [
      [4, 3, 2],
      [1, 1, 24],
      [5, 5, 5],
      [1, 1, 1],
      [6, 2, 3],
    ] as const) {
      const layout = netLayout(w, d, h);
      expect(layout).toHaveLength(6);
      expect(layout.reduce((s, f) => s + f.w * f.h, 0)).toBe(surfaceArea(w, d, h));
      const { cols, rows } = netBounds(w, d, h);
      expect(cols).toBe(2 * d + w);
      expect(rows).toBe(2 * d + 2 * h);
      const taken = new Set<string>();
      for (const f of layout) {
        const [fw, fh] = faceSize(f.face, w, d, h);
        expect([f.w, f.h]).toEqual([fw, fh]);
        for (let x = f.x; x < f.x + f.w; x += 1) {
          for (let y = f.y; y < f.y + f.h; y += 1) {
            const key = `${x},${y}`;
            expect(taken.has(key)).toBe(false);
            expect(x).toBeLessThan(cols);
            expect(y).toBeLessThan(rows);
            taken.add(key);
          }
        }
      }
      expect(taken.size).toBe(surfaceArea(w, d, h));
    }
  });

  it('전개도 십자형: front 가운데, 위 top, 아래 bottom과 뒤집힌 back, 좌우 left·right', () => {
    const layout = netLayout(4, 3, 2);
    const at = (name: string) => layout.find((f) => f.face === name);
    const front = at('front');
    const top = at('top');
    const bottom = at('bottom');
    const back = at('back');
    const left = at('left');
    const right = at('right');
    expect(front && top && bottom && back && left && right).toBeTruthy();
    if (!front || !top || !bottom || !back || !left || !right) return;
    expect(top.y + top.h).toBe(front.y);
    expect(bottom.y).toBe(front.y + front.h);
    expect(back.y).toBe(bottom.y + bottom.h);
    expect(back.flipped).toBe(true);
    expect(front.flipped).toBe(false);
    expect(left.x + left.w).toBe(front.x);
    expect(right.x).toBe(front.x + front.w);
    expect(left.y).toBe(front.y);
    expect(right.y).toBe(front.y);
  });
});
