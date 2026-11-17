import { describe, expect, it } from 'vitest';
import {
  allowedPoses,
  canStackOn,
  cluesOf,
  defaultLook,
  defaultPose,
  hasFlatBottom,
  hasFlatTop,
  isAllowedPose,
  rampResult,
  shadowOf,
  type ShapePart,
} from '../shapes/rules';

const BOX: ShapePart = { kind: 'box', pose: 'flat' };
const STANDING: ShapePart = { kind: 'cylinder', pose: 'standing' };
const LYING: ShapePart = { kind: 'cylinder', pose: 'lying' };
const SPHERE: ShapePart = { kind: 'sphere', pose: 'any' };

describe('E12 shapes-sort 규칙: 모양과 방향', () => {
  it('허용 방향: 상자 flat, 둥근기둥 standing·lying, 공 any', () => {
    expect(allowedPoses('box')).toEqual(['flat']);
    expect(allowedPoses('cylinder')).toEqual(['standing', 'lying']);
    expect(allowedPoses('sphere')).toEqual(['any']);
    expect(defaultPose('cylinder')).toBe('standing');
    expect(isAllowedPose('cylinder', 'lying')).toBe(true);
    expect(isAllowedPose('box', 'lying')).toBe(false);
    expect(isAllowedPose('sphere', 'standing')).toBe(false);
    expect(isAllowedPose('sphere', 7)).toBe(false);
  });

  it('종류만 줄 때 색·크기: 빨강 큰 것부터 차례로', () => {
    expect(defaultLook(0)).toEqual({ color: 'red', size: 'large' });
    expect(defaultLook(1)).toEqual({ color: 'blue', size: 'small' });
    expect(defaultLook(2)).toEqual({ color: 'yellow', size: 'large' });
    expect(defaultLook(4)).toEqual({ color: 'red', size: 'large' });
  });
});

describe('E12 shapes-sort 규칙: 경사로 결과 4가지', () => {
  it('공은 어느 방향이든 구른다', () => {
    expect(rampResult('sphere', 'any')).toBe('roll');
  });
  it('눕힌 둥근기둥은 구르고 세운 둥근기둥은 머문다', () => {
    expect(rampResult('cylinder', 'lying')).toBe('roll');
    expect(rampResult('cylinder', 'standing')).toBe('stay');
  });
  it('상자는 머문다', () => {
    expect(rampResult('box', 'flat')).toBe('stay');
  });
});

describe('E12 shapes-sort 규칙: 쌓기 표(받침 × 물건)', () => {
  const items: readonly (readonly [string, ShapePart])[] = [
    ['상자', BOX],
    ['세운 둥근기둥', STANDING],
    ['눕힌 둥근기둥', LYING],
    ['공', SPHERE],
  ];
  const bases: readonly (readonly [string, ShapePart | null, readonly boolean[]])[] = [
    // 물건 순서: 상자, 세운 둥근기둥, 눕힌 둥근기둥, 공
    ['바닥', null, [true, true, true, true]],
    ['상자 위', BOX, [true, true, true, false]],
    ['세운 둥근기둥 위', STANDING, [true, true, true, false]],
    ['눕힌 둥근기둥 위', LYING, [false, false, false, false]],
    ['공 위', SPHERE, [false, false, false, false]],
  ];

  for (const [baseName, base, expected] of bases) {
    it(`${baseName}: 상자·세운 둥근기둥·눕힌 둥근기둥·공을 올리면 ${expected.join('/')}`, () => {
      items.forEach(([name, item], i) => {
        expect(canStackOn(base, item), `${baseName} 위 ${name}`).toBe(expected[i]);
      });
    });
  }

  it('받침과 아랫면 판정 도우미', () => {
    expect(hasFlatTop(BOX)).toBe(true);
    expect(hasFlatTop(STANDING)).toBe(true);
    expect(hasFlatTop(LYING)).toBe(false);
    expect(hasFlatTop(SPHERE)).toBe(false);
    expect(hasFlatBottom(LYING)).toBe(true);
    expect(hasFlatBottom(SPHERE)).toBe(false);
  });
});

describe('E12 shapes-sort 규칙: 만져 보기 단서와 그림자', () => {
  it('단서는 순서가 정해진 목록이다', () => {
    expect(cluesOf('box')).toEqual(['flat', 'pointy']);
    expect(cluesOf('cylinder')).toEqual(['flat', 'round']);
    expect(cluesOf('sphere')).toEqual(['round']);
  });

  it('그림자: 위에서는 상자만 사각형, 옆에서는 공만 원', () => {
    expect(shadowOf('box', 'top')).toBe('square');
    expect(shadowOf('cylinder', 'top')).toBe('circle');
    expect(shadowOf('sphere', 'top')).toBe('circle');
    expect(shadowOf('box', 'side')).toBe('square');
    expect(shadowOf('cylinder', 'side')).toBe('square');
    expect(shadowOf('sphere', 'side')).toBe('circle');
  });

  it('그림자 하나만으로는 모양이 하나로 정해지지 않는다(어느 보기에서도 같은 그림자가 둘 이상)', () => {
    const kinds = ['box', 'cylinder', 'sphere'] as const;
    for (const view of ['top', 'side'] as const) {
      const forms = kinds.map((k) => shadowOf(k, view));
      expect(new Set(forms).size).toBeLessThan(kinds.length);
    }
  });
});
