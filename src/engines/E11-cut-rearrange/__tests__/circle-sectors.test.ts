/**
 * T107 circle-sectors 단위 테스트.
 *
 * `radius`·`pi`는 Rational 문자열로만 읽고, 배열 판정은 칸 방향에서 나온다.
 */
import { describe, expect, it } from 'vitest';
import { assertSerializable } from '../../../core/engine-sdk';
import { Rational } from '../../../core/math';
import { predicates } from '../events';
import { observe } from '../observe';
import { createInitialState, reduce } from '../reduce';
import { alternating, arranged, circleSettings, currentDivisions } from '../circle-sectors/reduce';
import {
  dimensionText,
  rowScale,
  rowScreenRight,
  rowScreenTop,
  ROW_SCREEN_RIGHT,
  sectorHeight,
  SLOT_BASELINE,
  SLOT_X0,
} from '../circle-sectors/layout';
import type {
  CircleSectorsAction,
  CircleSectorsConfig,
  CircleSectorsState,
} from '../circle-sectors/types';
import type { CutAction, CutState } from '../types';

function circleState(state: CutState): CircleSectorsState {
  if (state.mode !== 'circle-sectors') throw new Error('circle-sectors 상태가 아닙니다.');
  return state;
}

function apply(config: CircleSectorsConfig, actions: readonly CutAction[]): CircleSectorsState {
  let state = createInitialState(config);
  assertSerializable(state);
  for (const action of actions) {
    state = reduce(state, action);
    assertSerializable(state);
  }
  return circleState(state);
}

function fill(
  sectors: readonly number[],
  arcUp: (index: number) => boolean,
): CircleSectorsAction[] {
  return sectors.map((sector) => ({
    type: 'place-sector',
    sector,
    slot: sector,
    arcUp: arcUp(sector),
  }));
}

describe('T107 circle-sectors 설정 읽기', () => {
  it('pi는 "3.14"·3.14·"22/7"을 그대로 읽는다', () => {
    const same = (actual: string, expected: string) =>
      Rational.parse(actual).equals(Rational.parse(expected));
    expect(same(circleSettings({ pi: '3.14' }).pi, '3.14')).toBe(true);
    expect(same(circleSettings({ pi: 3.14 }).pi, '3.14')).toBe(true);
    expect(same(circleSettings({ pi: '22/7' }).pi, '22/7')).toBe(true);
  });

  it('잘못된 pi는 기본값 "3.14"', () => {
    expect(Rational.parse(circleSettings({ pi: 'abc' }).pi).equals(Rational.parse('3.14'))).toBe(
      true,
    );
    expect(Rational.parse(circleSettings({ pi: 5 }).pi).equals(Rational.parse('3.14'))).toBe(true);
  });

  it('radius는 0보다 크고 100 이하만 받는다', () => {
    expect(circleSettings({ radius: 7 }).radius).toBe('7');
    expect(circleSettings({ radius: '0' }).radius).toBe('5');
    expect(circleSettings({ radius: '101' }).radius).toBe('5');
  });

  it('divisions는 짝수만 오름차순으로 남긴다', () => {
    expect(circleSettings({ divisions: [16, 8, 7, 300, 32, 16] }).divisions).toEqual([8, 16, 32]);
    expect(circleSettings({ divisions: [7, 9] }).divisions).toEqual([8, 16, 32, 64, 128, 256]);
  });
});

describe('T107 circle-sectors 엇갈린 배열', () => {
  it('8칸을 엇갈려 놓으면 alternating·arranged, arrangedDivisions = [8]', () => {
    const state = apply(
      { mode: 'circle-sectors' },
      fill([0, 1, 2, 3, 4, 5, 6, 7], (index) => index % 2 === 0),
    );
    expect(alternating(state)).toBe(true);
    expect(arranged(state)).toBe(true);
    expect(state.arrangedDivisions).toEqual([8]);
    const observation = observe(state);
    expect(observation['arranged']).toBe(true);
    expect(predicates['sectorsArranged']?.(observation, { divisions: 8 })).toBe(true);
  });

  it('이웃 두 칸 방향이 같으면 alternating false', () => {
    const state = apply(
      { mode: 'circle-sectors' },
      fill([0, 1, 2, 3, 4, 5, 6, 7], () => true),
    );
    expect(alternating(state)).toBe(false);
    expect(arranged(state)).toBe(false);
    expect(state.arrangedDivisions).toEqual([]);
  });

  it('놓은 조각을 다른 칸으로 옮기면 원래 칸이 빈다', () => {
    let state = apply({ mode: 'circle-sectors' }, []);
    state = circleState(reduce(state, { type: 'place-sector', sector: 0, slot: 0, arcUp: true }));
    expect(state.slots[0]).toEqual({ sector: 0, arcUp: true });
    state = circleState(reduce(state, { type: 'place-sector', sector: 0, slot: 3, arcUp: true }));
    expect(state.slots[0]).toBeNull();
    expect(state.slots[3]).toEqual({ sector: 0, arcUp: true });
  });

  it('다른 조각이 있는 칸에는 놓지 않는다', () => {
    let state = apply({ mode: 'circle-sectors' }, [
      { type: 'place-sector', sector: 0, slot: 0, arcUp: true },
    ]);
    state = circleState(reduce(state, { type: 'place-sector', sector: 1, slot: 0, arcUp: false }));
    expect(state.slots[0]).toEqual({ sector: 0, arcUp: true });
  });

  it('unplace-sector는 그 조각을 뺀다', () => {
    const state = apply({ mode: 'circle-sectors' }, [
      { type: 'place-sector', sector: 2, slot: 2, arcUp: true },
      { type: 'unplace-sector', sector: 2 },
    ]);
    expect(state.slots[2]).toBeNull();
  });
});

describe('T107 circle-sectors 단계와 자동 배열', () => {
  it('set-level은 칸을 비우고 autoArranged를 끈다', () => {
    let state = apply({ mode: 'circle-sectors' }, [
      { type: 'place-sector', sector: 0, slot: 0, arcUp: true },
    ]);
    state = circleState(reduce(state, { type: 'set-level', level: 1 }));
    expect(currentDivisions(state)).toBe(16);
    expect(state.slots).toHaveLength(16);
    expect(state.slots.every((slot) => slot === null)).toBe(true);
    expect(state.autoArranged).toBe(false);
  });

  it('손 단계에서 auto-arrange는 무시한다', () => {
    const state = apply({ mode: 'circle-sectors' }, [{ type: 'auto-arrange' }]);
    expect(currentDivisions(state)).toBe(8);
    expect(state.autoArranged).toBe(false);
    expect(state.arrangedDivisions).toEqual([]);
  });

  it('16등분에서 auto-arrange면 arrangedAtLeast {divisions: 16}', () => {
    const state = apply({ mode: 'circle-sectors' }, [
      { type: 'set-level', level: 1 },
      { type: 'auto-arrange' },
    ]);
    expect(state.autoArranged).toBe(true);
    const observation = observe(state);
    expect(predicates['arrangedAtLeast']?.(observation, { divisions: 16 })).toBe(true);
    expect(predicates['sectorsArranged']?.(observation, { divisions: 16 })).toBe(true);
    expect(predicates['arrangedAtLeast']?.(observation, { divisions: 32 })).toBe(false);
  });

  it('16등분 손 단계에서는 place-sector를 받는다(manualUpTo 16)', () => {
    const state = apply({ mode: 'circle-sectors', manualUpTo: 16 }, [
      { type: 'set-level', level: 1 },
      { type: 'place-sector', sector: 5, slot: 0, arcUp: false },
    ]);
    expect(state.slots[0]).toEqual({ sector: 5, arcUp: false });
  });

  it('8등분 Observation은 radius·pi를 문자열로만 준다', () => {
    const observation = observe(apply({ mode: 'circle-sectors', radius: 5, pi: '22/7' }, []));
    expect(observation['radius']).toBe('5');
    expect(observation['pi']).toBe('22/7');
    expect(observation['divisions']).toBe(8);
    expect(observation['manual']).toBe(true);
  });
});

describe('T107 circle-sectors 줄 배율', () => {
  it('줄 너비는 (n+1)·c/2라 배율이 1이고 줄 높이가 반지름 크기 그대로다', () => {
    for (const divisions of [4, 8, 16, 32, 64, 128, 256]) {
      expect(rowScale(divisions)).toBe(1);
      // 화면의 줄 높이 = arc의 높이(작은 n에서는 반지름에 가깝다).
      expect(rowScreenTop(divisions)).toBeCloseTo(SLOT_BASELINE - sectorHeight(divisions), 9);
      // 줄의 오른쪽 끝이 화면 한계를 넘지 않는다.
      expect(rowScreenRight(divisions)).toBeLessThanOrEqual(ROW_SCREEN_RIGHT);
      expect(rowScreenRight(divisions)).toBeGreaterThan(SLOT_X0);
    }
  });

  it('64등분이면 줄 높이가 반지름과 1% 안쪽으로 같아진다', () => {
    expect(sectorHeight(64)).toBeCloseTo(150, 0);
    expect(150 / sectorHeight(64)).toBeLessThan(1.01);
  });

  it('표시선 이름은 named일 때만 반지름·원주를 말한다', () => {
    expect(dimensionText(true)).toEqual({ horizontal: '원주의 반', vertical: '반지름' });
    expect(dimensionText(false)).toEqual({ horizontal: '가로', vertical: '세로' });
  });
});
