import { describe, expect, it } from 'vitest';
import type { JsonValue } from '../../../core/engine-sdk';
import { assertSerializable } from '../../../core/engine-sdk';
import { createState, observeState, reduceState } from '../engine';
import { comparePredicates } from '../compare/events';
import { observeCompare } from '../compare/observe';
import { createCompareState, placeReason, reduceCompare } from '../compare/reduce';
import type { CompareAction, CompareConfig, CompareState } from '../compare/types';
import definition from '../index';

const THREE: CompareConfig = {
  mode: 'compare',
  items: [
    { id: 'sponge', kind: 'sponge', weight: 2, visualSize: 'large' },
    { id: 'iron', kind: 'iron-ball', weight: 9, visualSize: 'small' },
    { id: 'apple', kind: 'apple', weight: 3 },
  ],
};

function play(config: CompareConfig, actions: readonly CompareAction[]): CompareState {
  return actions.reduce<CompareState>(reduceCompare, createCompareState(config));
}

const place = (id: string, pan: 'left' | 'right' | 'shelf'): CompareAction => ({
  type: 'place',
  id,
  pan,
});

describe('compare 설정', () => {
  it('설정이 mode뿐이면 샌드박스 기본(스펀지 2 large·쇠공 9 small·사과 3)', () => {
    const state = createCompareState({ mode: 'compare' });
    expect(state.error).toBeNull();
    expect(state.items.map((item) => [item.id, item.weight, item.size])).toEqual([
      ['sponge', 2, 'large'],
      ['iron-ball', 9, 'small'],
      ['apple', 3, 'medium'],
    ]);
    expect(state.showValues).toBe(false);
    expect(state.maxPerPan).toBe(1);
  });

  it('물건 수 2~4, 무게 1~20 정수, 종류·크기·id 검사', () => {
    const base = THREE.items ?? [];
    const bad = (config: unknown) => createCompareState(config as CompareConfig).error !== null;
    expect(bad({ mode: 'compare', items: base.slice(0, 1) })).toBe(true);
    expect(bad({ mode: 'compare', items: [...base, ...base] })).toBe(true); // 6개
    expect(bad({ mode: 'compare', items: [{ ...base[0], weight: 0 }, base[1]] })).toBe(true);
    expect(bad({ mode: 'compare', items: [{ ...base[0], weight: 21 }, base[1]] })).toBe(true);
    expect(bad({ mode: 'compare', items: [{ ...base[0], weight: 2.5 }, base[1]] })).toBe(true);
    expect(bad({ mode: 'compare', items: [{ ...base[0], kind: 'car' }, base[1]] })).toBe(true);
    expect(bad({ mode: 'compare', items: [{ ...base[0], visualSize: 'huge' }, base[1]] })).toBe(
      true,
    );
    expect(bad({ mode: 'compare', items: [base[0], { ...base[1], id: 'sponge' }] })).toBe(true);
    expect(bad({ mode: 'compare', items: [{ ...base[0], id: 'a|b' }, base[1]] })).toBe(true);
    expect(bad({ ...THREE, maxPerPan: 0 })).toBe(true);
    expect(bad({ ...THREE, maxPerPan: 5 })).toBe(true);
    expect(bad({ ...THREE, showValues: 'yes' })).toBe(true);
    expect(bad({ ...THREE, maxPerPan: 4, showValues: true })).toBe(false);
    expect(
      bad({
        mode: 'compare',
        items: [
          { ...base[0], weight: 20 },
          { ...base[1], weight: 1 },
        ],
      }),
    ).toBe(false);
  });

  it('설정 오류이면 모든 Action을 거절한다', () => {
    const state = createCompareState({ mode: 'compare', items: [] });
    expect(state.error).not.toBeNull();
    expect(reduceCompare(state, place('a', 'left'))).toBe(state);
  });

  it('E06 엔진 분배: mode compare이면 compare 상태', () => {
    const state = createState(THREE);
    expect(state.mode).toBe('compare');
    expect(definition.modes).toContain('compare');
    const next = reduceState(state, place('apple', 'left'));
    expect((next as CompareState).left).toEqual(['apple']);
    expect(observeState(next, THREE)['mode']).toBe('compare');
  });
});

describe('놓기·거절', () => {
  it('선반 → 왼쪽 → 오른쪽 → 선반', () => {
    let state = play(THREE, [place('apple', 'left')]);
    expect(state.left).toEqual(['apple']);
    state = reduceCompare(state, place('apple', 'right'));
    expect(state.left).toEqual([]);
    expect(state.right).toEqual(['apple']);
    state = reduceCompare(state, place('apple', 'shelf'));
    expect(state.right).toEqual([]);
  });

  it('같은 자리·없는 물건·잘못된 자리·가득 찬 접시는 같은 객체를 돌려준다', () => {
    const state = play(THREE, [place('apple', 'left')]);
    expect(reduceCompare(state, place('apple', 'left'))).toBe(state);
    expect(reduceCompare(state, place('sponge', 'shelf'))).toBe(state);
    expect(reduceCompare(state, place('nothing', 'left'))).toBe(state);
    expect(reduceCompare(state, { type: 'place', id: 'iron', pan: 'top' as 'left' })).toBe(state);
    // maxPerPan 1: 이미 찬 왼쪽에 다른 물건
    expect(reduceCompare(state, place('iron', 'left'))).toBe(state);
    expect(placeReason(state, 'iron', 'left')).toBe('full');
    expect(placeReason(state, 'iron', 'right')).toBe('ok');
    expect(placeReason(state, 'apple', 'left')).toBe('same');
  });

  it('maxPerPan 2: 두 개까지 올리고 셋째는 거절', () => {
    const config = { ...THREE, maxPerPan: 2 };
    const state = play(config, [place('apple', 'left'), place('iron', 'left')]);
    expect(state.left).toEqual(['apple', 'iron']);
    expect(reduceCompare(state, place('sponge', 'left'))).toBe(state);
  });

  it('[처음으로]는 접시를 비우고 비교 기록은 남긴다', () => {
    const state = play(THREE, [place('apple', 'left'), place('iron', 'right')]);
    const cleared = reduceCompare(state, { type: 'reset' });
    expect(cleared.left).toEqual([]);
    expect(cleared.right).toEqual([]);
    expect(observeCompare(cleared)['weighings']).toBe(1);
    expect(observeCompare(cleared)['pairsCompared']).toEqual(['apple|iron']);
    expect(reduceCompare(cleared, { type: 'reset' })).toBe(cleared);
  });
});

describe('기울기', () => {
  it('무거운 쪽으로 기울고 같으면 수평(maxPerPan 2: 합으로 견줌)', () => {
    const obs = (state: CompareState) => observeCompare(state);
    expect(obs(play(THREE, [place('apple', 'left'), place('iron', 'right')]))['tilt']).toBe(
      'right',
    );
    expect(obs(play(THREE, [place('iron', 'left'), place('apple', 'right')]))['tilt']).toBe('left');
    const config: CompareConfig = {
      mode: 'compare',
      maxPerPan: 2,
      items: [
        { id: 'a', kind: 'apple', weight: 3 },
        { id: 'b', kind: 'book', weight: 4 },
        { id: 'c', kind: 'stone', weight: 7 },
      ],
    };
    const level = play(config, [place('a', 'left'), place('b', 'left'), place('c', 'right')]);
    expect(obs(level)['tilt']).toBe('level');
    expect(obs(level)['balanced']).toBe(true);
  });

  it('한쪽만 비었으면 물건이 있는 쪽으로 기울고 balanced는 거짓, 둘 다 비면 수평', () => {
    const left = observeCompare(play(THREE, [place('sponge', 'left')]));
    expect(left['tilt']).toBe('left');
    expect(left['balanced']).toBe(false);
    const right = observeCompare(play(THREE, [place('sponge', 'right')]));
    expect(right['tilt']).toBe('right');
    const empty = observeCompare(createCompareState(THREE));
    expect(empty['tilt']).toBe('level');
    expect(empty['balanced']).toBe(false);
  });

  it('같은 무게 두 물건은 balanced', () => {
    const config: CompareConfig = {
      mode: 'compare',
      items: [
        { id: 'a', kind: 'apple', weight: 5 },
        { id: 'b', kind: 'stone', weight: 5 },
      ],
    };
    const state = play(config, [place('a', 'left'), place('b', 'right')]);
    expect(observeCompare(state)['balanced']).toBe(true);
  });
});

describe('weighings', () => {
  it('(왼쪽 집합, 오른쪽 집합) 조합이 새로 생길 때만 센다', () => {
    const obs = (state: CompareState) => observeCompare(state)['weighings'];
    let state = play(THREE, [place('apple', 'left')]);
    expect(obs(state)).toBe(0); // 한쪽만
    state = reduceCompare(state, place('iron', 'right'));
    expect(obs(state)).toBe(1);
    // 오른쪽을 비웠다가 같은 물건을 다시 올려도 같은 조합
    state = reduceCompare(state, place('iron', 'shelf'));
    state = reduceCompare(state, place('iron', 'right'));
    expect(obs(state)).toBe(1);
    // 좌우를 바꾸면 다른 조합
    state = reduceCompare(state, place('apple', 'shelf'));
    state = reduceCompare(state, place('iron', 'left'));
    state = reduceCompare(state, place('apple', 'right'));
    expect(obs(state)).toBe(2);
    // 다른 물건
    state = reduceCompare(state, place('apple', 'shelf'));
    state = reduceCompare(state, place('sponge', 'right'));
    expect(obs(state)).toBe(3);
  });

  it('거절된 Action은 세지 않는다', () => {
    let state = play(THREE, [place('apple', 'left'), place('iron', 'right')]);
    state = reduceCompare(state, place('iron', 'right'));
    state = reduceCompare(state, place('sponge', 'left'));
    expect(observeCompare(state)['weighings']).toBe(1);
  });

  it('maxPerPan 2: 집합이 같으면 올린 순서가 달라도 같은 조합', () => {
    const config = { ...THREE, maxPerPan: 2 };
    let state = play(config, [place('apple', 'left'), place('iron', 'right')]);
    state = reduceCompare(state, place('sponge', 'left')); // {apple,sponge} | {iron}
    expect(observeCompare(state)['weighings']).toBe(2);
    state = reduceCompare(state, place('apple', 'shelf')); // {sponge} | {iron}: 새 조합
    expect(observeCompare(state)['weighings']).toBe(3);
    state = reduceCompare(state, place('apple', 'left')); // {sponge,apple} | {iron}: 이미 센 조합
    expect(observeCompare(state)['weighings']).toBe(3);
  });
});

describe('observe·순서·pairsCompared', () => {
  it('세 물건 두 번 비교: 쌍은 사전 순 a|b', () => {
    const state = play(THREE, [
      place('iron', 'left'),
      place('apple', 'right'),
      place('apple', 'shelf'),
      place('sponge', 'right'),
    ]);
    const obs = observeCompare(state);
    expect(obs['pairsCompared']).toEqual(['apple|iron', 'iron|sponge']);
    expect(obs['weighings']).toBe(2);
    expect(obs['misconceptions']).toEqual([]);
  });

  it('여럿을 올린 상태는 pairsCompared에 넣지 않는다', () => {
    const config = { ...THREE, maxPerPan: 2 };
    const state = play(config, [
      place('apple', 'left'),
      place('sponge', 'left'),
      place('iron', 'right'),
    ]);
    expect(observeCompare(state)['pairsCompared']).toEqual([]);
  });

  it('orderHeavyFirst는 모든 items 기준이고 같은 무게는 id 순', () => {
    const config: CompareConfig = {
      mode: 'compare',
      items: [
        { id: 'zed', kind: 'apple', weight: 5 },
        { id: 'amy', kind: 'stone', weight: 5 },
        { id: 'mid', kind: 'book', weight: 9 },
        { id: 'low', kind: 'feather', weight: 1 },
      ],
    };
    const obs = observeCompare(createCompareState(config));
    expect(obs['orderHeavyFirst']).toEqual(['mid', 'amy', 'zed', 'low']);
    expect(obs['heaviest']).toBe('mid');
  });

  it('Observation에 무게 숫자 키가 없다', () => {
    const keys = Object.keys(observeCompare(createCompareState(THREE)));
    expect(keys).toEqual([
      'mode',
      'left',
      'right',
      'tilt',
      'balanced',
      'weighings',
      'pairsCompared',
      'heaviest',
      'orderHeavyFirst',
      'misconceptions',
    ]);
  });
});

describe('JSON 왕복·이벤트·predicates', () => {
  it('상태와 Observation은 JSON으로 왕복해도 같다', () => {
    const state = play(THREE, [place('apple', 'left'), place('iron', 'right')]);
    assertSerializable(state);
    assertSerializable(observeCompare(state));
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
    const again = JSON.parse(JSON.stringify(state)) as CompareState;
    expect(reduceCompare(again, place('sponge', 'left'))).toEqual(
      reduceCompare(state, place('sponge', 'left')),
    );
  });

  it('emit: 바뀔 때만 balance-changed', () => {
    const prev = createCompareState(THREE);
    const next = reduceCompare(prev, place('apple', 'left'));
    const events = definition.emit?.(prev, next, place('apple', 'left')) ?? [];
    expect(events).toEqual([
      { name: 'balance-changed', payload: { balanced: false, tilt: 'left' } },
    ]);
    for (const event of events) expect(definition.events).toContain(event.name);
    expect(definition.emit?.(next, next, place('apple', 'left'))).toEqual([]);
  });

  const check = (name: string, state: CompareState, args?: JsonValue) => {
    const predicate = definition.predicates?.[name] ?? comparePredicates[name];
    expect(predicate).toBeTypeOf('function');
    return predicate?.(observeCompare(state) as never, args) ?? false;
  };

  it('onPans: 집합이 같은지(순서 무관), 준 쪽만 본다', () => {
    const config = { ...THREE, maxPerPan: 2 };
    const state = play(config, [
      place('apple', 'left'),
      place('sponge', 'left'),
      place('iron', 'right'),
    ]);
    expect(check('onPans', state, { left: ['sponge', 'apple'] })).toBe(true);
    expect(check('onPans', state, { left: ['sponge', 'apple'], right: ['iron'] })).toBe(true);
    expect(check('onPans', state, { right: ['iron'] })).toBe(true);
    expect(check('onPans', state, { left: ['apple'] })).toBe(false);
    expect(check('onPans', state, { left: ['apple', 'sponge'], right: ['apple'] })).toBe(false);
    expect(check('onPans', state, {})).toBe(false);
    expect(check('onPans', state, undefined)).toBe(false);
    expect(check('onPans', state, { left: 'apple' })).toBe(false);
  });

  it('bothPansUsed·balanced·weighingsAtLeast', () => {
    const empty = createCompareState(THREE);
    const one = play(THREE, [place('apple', 'left')]);
    const both = play(THREE, [place('apple', 'left'), place('iron', 'right')]);
    expect(check('bothPansUsed', empty)).toBe(false);
    expect(check('bothPansUsed', one)).toBe(false);
    expect(check('bothPansUsed', both)).toBe(true);
    expect(check('balanced', both)).toBe(false);
    expect(check('weighingsAtLeast', both, { n: 1 })).toBe(true);
    expect(check('weighingsAtLeast', both, { n: 2 })).toBe(false);
    expect(check('weighingsAtLeast', both, { n: 0 })).toBe(true);
    expect(check('weighingsAtLeast', both, {})).toBe(false);
  });

  it('compared: 반대 접시에 하나씩 올린 쌍(순서 무관), 같은 접시·여럿은 아니다', () => {
    const state = play(THREE, [place('apple', 'left'), place('iron', 'right')]);
    expect(check('compared', state, { a: 'apple', b: 'iron' })).toBe(true);
    expect(check('compared', state, { a: 'iron', b: 'apple' })).toBe(true);
    expect(check('compared', state, { a: 'apple', b: 'sponge' })).toBe(false);
    expect(check('compared', state, { a: 'apple', b: 'apple' })).toBe(false);
    expect(check('compared', state, { a: 'apple' })).toBe(false);
    const kept = reduceCompare(state, { type: 'reset' });
    expect(check('compared', kept, { a: 'apple', b: 'iron' })).toBe(true);
  });
});
