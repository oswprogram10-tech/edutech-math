/** E13 compare-direct 순수 로직 테스트: 곡선 길이·자석·reduce 거절·Observation·predicates·JSON 왕복. */
import { describe, expect, it } from 'vitest';
import { assertSerializable } from '../../../core/engine-sdk';
import { comparePredicates } from '../compare/events';
import {
  curvePoints,
  curveWidth,
  cupSize,
  halfStraightPoints,
  polylineLength,
  waterHeight,
} from '../compare/geometry';
import { observeCompare } from '../compare/observe';
import { createCompareState, reduceCompare } from '../compare/reduce';
import { boundsOf, sandboxDefault, snapPlacement } from '../compare/settings';
import type { CompareAction, CompareConfig, CompareState } from '../compare/types';
import definition from '../index';

const ropes: CompareConfig = {
  mode: 'compare-direct',
  attribute: 'length',
  items: [
    { id: 'a', label: '가', kind: 'rope', shape: 'curvy', length: 7 },
    { id: 'b', label: '나', kind: 'rope', shape: 'straight', length: 6, offset: 2 },
  ],
  baseline: true,
  straighten: true,
};

const hankies: CompareConfig = {
  mode: 'compare-direct',
  attribute: 'area',
  items: [
    { id: 'h', label: '손수건', kind: 'handkerchief', w: 4, h: 3 },
    { id: 'k', label: '책', kind: 'book', w: 3, h: 5 },
  ],
};

const cups: CompareConfig = {
  mode: 'compare-direct',
  attribute: 'capacity',
  items: [
    { id: 't', label: '키 큰 컵', kind: 'cup', shape: 'tall', capacity: 4 },
    { id: 'w', label: '넓은 컵', kind: 'cup', shape: 'wide', capacity: 6 },
  ],
  pour: true,
};

function play(state: CompareState, ...actions: CompareAction[]): CompareState {
  return actions.reduce(reduceCompare, state);
}

function make(config: CompareConfig): CompareState {
  return createCompareState(config);
}

describe('곡선 밧줄 호 길이', () => {
  it('길이 1~12칸 모두 호 길이가 길이×60px와 1% 안에서 같다', () => {
    for (let length = 1; length <= 12; length += 1) {
      const expected = length * 60;
      const points = curvePoints(length);
      expect(Math.abs(polylineLength(points) - expected) / expected).toBeLessThan(0.01);
      // 곡선이 곧게 펴진 길이보다 가로로 짧다(구불구불하다).
      expect(curveWidth(length)).toBeLessThan(expected);
      expect(points[0]).toEqual({ x: 0, y: 0 });
    }
  });

  it('앞쪽 절반을 곧게 편 미리보기도 전체 길이가 같고 앞 절반은 일직선이다', () => {
    const points = halfStraightPoints(7);
    expect(Math.abs(polylineLength(points) - 420) / 420).toBeLessThan(0.01);
    const second = points[1];
    expect(second).toBeDefined();
    expect(second?.y).toBeCloseTo(0, 5);
    expect(second?.x).toBeCloseTo(polylineLength(curvePoints(7)) / 2, 0);
  });

  it('컵 그림은 넓이가 들이에 비례하고, 같은 수조의 물 높이도 들이에 비례한다', () => {
    for (const shape of ['tall', 'wide'] as const) {
      const a = cupSize(shape, 2);
      const b = cupSize(shape, 4);
      expect((b.width * b.height) / (a.width * a.height)).toBeCloseTo(2, 5);
    }
    expect(waterHeight(6) / waterHeight(3)).toBeCloseTo(2, 5);
    expect(cupSize('tall', 4).height).toBeGreaterThan(cupSize('tall', 4).width);
    expect(cupSize('wide', 4).width).toBeGreaterThan(cupSize('wide', 4).height);
  });
});

describe('설정 검사', () => {
  it('샌드박스 기본: 곡선 7·곧은 6(offset 2), 출발선·펴기', () => {
    const state = make({ mode: 'compare-direct' });
    expect(state.error).toBeNull();
    expect(state.attribute).toBe('length');
    expect(state.baseline && state.straighten).toBe(true);
    expect(sandboxDefault().items).toHaveLength(2);
    if (state.attribute === 'length') {
      expect(state.items.map((item) => item.length)).toEqual(['7', '6']);
      expect(state.items.map((item) => item.x)).toEqual(['0', '2']);
    }
  });

  it.each([
    ['항목이 하나', { attribute: 'length', items: [ropes.items?.[0]] }],
    [
      '길이 0',
      {
        attribute: 'length',
        items: [
          { id: 'a', label: 'a', kind: 'rope', shape: 'straight', length: 0 },
          { id: 'b', label: 'b', kind: 'rope', shape: 'straight', length: 3 },
        ],
      },
    ],
    [
      '길이 13',
      {
        attribute: 'length',
        items: [
          { id: 'a', label: 'a', kind: 'rope', shape: 'straight', length: 13 },
          { id: 'b', label: 'b', kind: 'rope', shape: 'straight', length: 3 },
        ],
      },
    ],
    [
      '곡선 연필',
      {
        attribute: 'length',
        items: [
          { id: 'a', label: 'a', kind: 'pencil', shape: 'curvy', length: 4 },
          { id: 'b', label: 'b', kind: 'rope', shape: 'straight', length: 3 },
        ],
      },
    ],
    [
      'id 중복',
      {
        attribute: 'length',
        items: [
          { id: 'a', label: 'a', kind: 'rope', shape: 'straight', length: 2 },
          { id: 'a', label: 'b', kind: 'rope', shape: 'straight', length: 3 },
        ],
      },
    ],
    [
      'offset 4',
      {
        attribute: 'length',
        items: [
          { id: 'a', label: 'a', kind: 'rope', shape: 'straight', length: 2, offset: 4 },
          { id: 'b', label: 'b', kind: 'rope', shape: 'straight', length: 3 },
        ],
      },
    ],
    [
      '들이 11',
      {
        attribute: 'capacity',
        items: [
          { id: 'a', label: 'a', kind: 'cup', shape: 'tall', capacity: 11 },
          { id: 'b', label: 'b', kind: 'cup', shape: 'wide', capacity: 3 },
        ],
      },
    ],
    ['넓이 항목 셋', { attribute: 'area', items: [1, 2, 3] }],
    ['속성 없음', { items: [] }],
  ] as const)('잘못된 설정(%s)은 오류 상태가 되고 조작은 거절된다', (_name, partial) => {
    const state = make({ mode: 'compare-direct', ...(partial as object) } as CompareConfig);
    expect(state.error).not.toBeNull();
    expect(reduceCompare(state, { type: 'reset' })).toBe(state);
    expect(observeCompare(state)['error']).toBe(true);
  });
});

describe('길이 비교: 펴기·출발선', () => {
  it('곡선 밧줄만 펴고, 이미 편 것을 다시 펴면 거절한다', () => {
    const start = make(ropes);
    const once = play(start, { type: 'straighten', id: 'a' });
    expect(once.attribute === 'length' && once.straightened).toEqual(['a']);
    expect(once.moves).toBe(1);
    expect(reduceCompare(once, { type: 'straighten', id: 'a' })).toBe(once);
    // 곧은 밧줄·없는 id도 거절
    expect(reduceCompare(start, { type: 'straighten', id: 'b' })).toBe(start);
    expect(reduceCompare(start, { type: 'straighten', id: 'zzz' })).toBe(start);
  });

  it('straighten 옵션이 꺼져 있으면 펴지지 않는다', () => {
    const state = make({ ...ropes, straighten: false });
    expect(reduceCompare(state, { type: 'straighten', id: 'a' })).toBe(state);
  });

  it('출발선 자석: 1칸 안이면 0에 붙고 2칸부터는 그대로 둔다', () => {
    const state = make(ropes);
    expect(snapPlacement(state, 'b', 1, 4)).toEqual({ x: 0, y: 4 });
    expect(snapPlacement(state, 'b', 0.6, 4)).toEqual({ x: 0, y: 4 });
    expect(snapPlacement(state, 'b', 2, 4)).toEqual({ x: 2, y: 4 });
    expect(snapPlacement(state, 'b', 3.4, 4.4)).toEqual({ x: 3, y: 4 });
    // 판 밖은 안으로 당긴다(길이 6이면 x는 9까지, y는 9까지)
    expect(snapPlacement(state, 'b', 99, 99)).toEqual({ x: 9, y: 9 });
    expect(snapPlacement(state, 'b', -5, -5)).toEqual({ x: 0, y: 0 });
    // 출발선이 없으면 자석도 없다
    const free = make({ ...ropes, baseline: false });
    expect(snapPlacement(free, 'b', 1, 4)).toEqual({ x: 1, y: 4 });
  });

  it('place: 판 밖·같은 자리·소수 칸은 거절, 맞으면 위치가 바뀐다', () => {
    const state = make(ropes);
    const moved = play(state, { type: 'place', id: 'b', x: '0', y: '4' });
    expect(moved.attribute === 'length' && moved.items[1]?.x).toBe('0');
    expect(reduceCompare(moved, { type: 'place', id: 'b', x: '0', y: '4' })).toBe(moved);
    expect(reduceCompare(state, { type: 'place', id: 'b', x: '10', y: '4' })).toBe(state);
    expect(reduceCompare(state, { type: 'place', id: 'b', x: '-1', y: '4' })).toBe(state);
    expect(reduceCompare(state, { type: 'place', id: 'b', x: '1/2', y: '4' })).toBe(state);
    expect(reduceCompare(state, { type: 'place', id: 'b', x: 'x', y: '4' })).toBe(state);
    expect(boundsOf(state, 'a')).toEqual({ maxX: 8, maxY: 9 });
  });

  it('Observation: 펴기·출발선 상태와 긴 것부터의 순서(같으면 id 순서)', () => {
    const start = observeCompare(make(ropes));
    expect(start).toMatchObject({
      attribute: 'length',
      straightened: ['b'],
      aligned: ['a'],
      allStraight: false,
      allAligned: false,
      longest: 'a',
      order: ['a', 'b'],
      misconceptions: [],
    });
    const done = observeCompare(
      play(
        make(ropes),
        { type: 'straighten', id: 'a' },
        { type: 'place', id: 'a', x: '0', y: '2' },
        { type: 'place', id: 'b', x: '0', y: '4' },
      ),
    );
    expect(done).toMatchObject({ allStraight: true, allAligned: true, aligned: ['a', 'b'] });
    // 길이가 같으면 id 순서
    const tie = observeCompare(
      make({
        ...ropes,
        items: [
          { id: 'z', label: 'z', kind: 'pencil', shape: 'straight', length: 5 },
          { id: 'c', label: 'c', kind: 'pencil', shape: 'straight', length: 5 },
          { id: 'm', label: 'm', kind: 'pencil', shape: 'straight', length: 8 },
        ],
      }),
    );
    expect(tie['order']).toEqual(['m', 'c', 'z']);
    expect(tie['longest']).toBe('m');
  });

  it('출발선이 없으면 왼쪽 끝이 모두 같은 칸일 때만 맞춘 것으로 본다', () => {
    const free = make({ ...ropes, baseline: false });
    expect(observeCompare(free)['allAligned']).toBe(false);
    const aligned = play(free, { type: 'place', id: 'a', x: '2', y: '2' });
    expect(observeCompare(aligned)['allAligned']).toBe(true);
  });

  it('reset은 처음 자리·펴기를 되돌리고, 처음이면 같은 객체', () => {
    const start = make(ropes);
    expect(reduceCompare(start, { type: 'reset' })).toBe(start);
    const changed = play(
      start,
      { type: 'straighten', id: 'a' },
      { type: 'place', id: 'b', x: '0', y: '5' },
    );
    expect(reduceCompare(changed, { type: 'reset' })).toEqual(start);
  });
});

describe('넓이 비교: 겹치기', () => {
  it('왼쪽 위 모서리가 1칸 안이면 모서리를 맞춰 붙는다', () => {
    const state = make(hankies);
    // 처음 자리: 손수건 (1,3), 책 (1+4+2=7, 3)
    expect(state.attribute === 'area' && state.items.map((item) => item.x)).toEqual(['1', '7']);
    expect(snapPlacement(state, 'h', 7, 3)).toEqual({ x: 7, y: 3 });
    expect(snapPlacement(state, 'h', 7.9, 3.8)).toEqual({ x: 7, y: 3 });
    expect(snapPlacement(state, 'h', 6, 3)).toEqual({ x: 7, y: 3 });
    expect(snapPlacement(state, 'h', 5, 3)).toEqual({ x: 5, y: 3 });
    expect(snapPlacement(state, 'h', 3, 6)).toEqual({ x: 3, y: 6 });
  });

  it('겹치면 overlapped이고 위에 놓은 것이 last가 된다', () => {
    const state = make(hankies);
    expect(observeCompare(state)['overlapped']).toBe(false);
    const stacked = play(state, { type: 'place', id: 'h', x: '7', y: '3' });
    expect(observeCompare(stacked)['overlapped']).toBe(true);
    expect(stacked.attribute === 'area' && stacked.last).toBe('h');
    const apart = play(stacked, { type: 'place', id: 'h', x: '2', y: '3' });
    expect(observeCompare(apart)['overlapped']).toBe(false);
  });

  it('larger는 넓이가 큰 쪽, 같으면 빈 문자열', () => {
    expect(observeCompare(make(hankies))['larger']).toBe('k');
    const same = make({
      ...hankies,
      items: [
        { id: 'h', label: 'h', kind: 'handkerchief', w: 4, h: 3 },
        { id: 'k', label: 'k', kind: 'paper', w: 6, h: 2 },
      ],
    });
    expect(observeCompare(same)['larger']).toBe('');
  });

  it('판 밖으로는 놓을 수 없다(왼쪽 위 칸 기준)', () => {
    const state = make(hankies);
    expect(boundsOf(state, 'h')).toEqual({ maxX: 16, maxY: 9 });
    expect(reduceCompare(state, { type: 'place', id: 'h', x: '17', y: '3' })).toBe(state);
    expect(reduceCompare(state, { type: 'place', id: 'h', x: '16', y: '3' })).not.toBe(state);
  });
});

describe('들이 비교: 붓기', () => {
  it('붓기는 한 번만, 둘 다 부으면 pouredAll', () => {
    const state = make(cups);
    const once = play(state, { type: 'pour', id: 't' });
    expect(reduceCompare(once, { type: 'pour', id: 't' })).toBe(once);
    expect(reduceCompare(state, { type: 'pour', id: 'x' })).toBe(state);
    expect(observeCompare(once)).toMatchObject({ poured: ['t'], pouredAll: false, more: 'w' });
    const both = play(once, { type: 'pour', id: 'w' });
    expect(observeCompare(both)['pouredAll']).toBe(true);
  });

  it('pour 옵션이 꺼져 있으면 붓지 못한다', () => {
    const state = make({ ...cups, pour: false });
    expect(reduceCompare(state, { type: 'pour', id: 't' })).toBe(state);
  });

  it('들이가 같으면 more는 빈 문자열이고, place는 들이 컵에 쓸 수 없다', () => {
    const same = make({
      ...cups,
      items: [
        { id: 't', label: 't', kind: 'cup', shape: 'tall', capacity: 5 },
        { id: 'w', label: 'w', kind: 'cup', shape: 'wide', capacity: 5 },
      ],
    });
    expect(observeCompare(same)['more']).toBe('');
    expect(reduceCompare(same, { type: 'place', id: 't', x: '1', y: '1' })).toBe(same);
  });

  it('reset은 부은 기록을 지운다', () => {
    const poured = play(make(cups), { type: 'pour', id: 't' });
    expect(reduceCompare(poured, { type: 'reset' })).toEqual(make(cups));
  });
});

describe('predicates·JSON 왕복·엔진 정의', () => {
  it('allStraight·straightened·allAligned·overlapped·pouredAll·poured', () => {
    const p = comparePredicates;
    const done = observeCompare(
      play(
        make(ropes),
        { type: 'straighten', id: 'a' },
        { type: 'place', id: 'a', x: '0', y: '2' },
        { type: 'place', id: 'b', x: '0', y: '4' },
      ),
    );
    expect(p['allStraight']?.(done, undefined)).toBe(true);
    expect(p['allAligned']?.(done, undefined)).toBe(true);
    expect(p['straightened']?.(done, { id: 'a' })).toBe(true);
    expect(p['straightened']?.(observeCompare(make(ropes)), { id: 'a' })).toBe(false);
    expect(p['straightened']?.(done, {})).toBe(false);
    const stacked = observeCompare(play(make(hankies), { type: 'place', id: 'h', x: '7', y: '3' }));
    expect(p['overlapped']?.(stacked, undefined)).toBe(true);
    const poured = observeCompare(
      play(make(cups), { type: 'pour', id: 't' }, { type: 'pour', id: 'w' }),
    );
    expect(p['pouredAll']?.(poured, undefined)).toBe(true);
    expect(p['poured']?.(poured, { id: 'w' })).toBe(true);
    expect(p['poured']?.(observeCompare(make(cups)), { id: 'w' })).toBe(false);
  });

  it('상태와 Observation은 JSON 직렬화가 되고 왕복해도 같다', () => {
    for (const config of [ropes, hankies, cups]) {
      const state = play(make(config), { type: 'reset' });
      assertSerializable(state);
      assertSerializable(observeCompare(state));
      expect(JSON.parse(JSON.stringify(state))).toEqual(state);
    }
  });

  it('엔진 정의: id E13, 모드 여섯(T213), 오버레이 열다섯(T215), emit은 상태가 바뀔 때만', () => {
    expect(definition.id).toBe('E13');
    expect(definition.modes).toEqual([
      'compare-direct',
      'length',
      'estimate',
      'map-route',
      'capacity',
      'weight',
    ]);
    expect(definition.layout).toBe('fit');
    expect(Object.keys(definition.overlays ?? {}).sort()).toEqual([
      'count-cells',
      'diameter-column',
      'endpoint-lines',
      'gap-marks',
      'half-straighten',
      'liter-cups',
      'meter-100',
      'meter-outline',
      'ml-merge',
      'mm-count',
      'pi-precision',
      'same-beaker',
      'same-tank',
      'size-weight-bars',
      'span-compare',
    ]);
    const a = definition.createInitialState({ mode: 'compare-direct' });
    const b = definition.reduce(a, { type: 'straighten', id: 'rope-a' });
    expect(b).not.toBe(a);
    expect(definition.emit?.(a, a, { type: 'reset' })).toEqual([]);
    const events = definition.emit?.(a, b, { type: 'straighten', id: 'rope-a' }) ?? [];
    expect(events).toEqual([{ name: 'measure-changed', payload: { moved: true } }]);
    // 이벤트에 비교 결과가 없다
    expect(JSON.stringify(events)).not.toMatch(/longest|order|more|larger/);
    expect(definition.events).toContain('measure-changed');
    expect(definition.events).toContain('merged');
  });
});
