/** E13 length `unit-train` 테스트: 길이 문자열 파싱 경계, 승격·풀기·빼기, 거절, 오개념 기록, JSON 왕복. */
import { describe, expect, it } from 'vitest';
import { assertSerializable } from '../../../core/engine-sdk';
import { createInitialState, isTrain, observe, reduce } from '../modes';
import type { E13State } from '../modes';
import { trainPredicates } from '../train/events';
import { observeTrain } from '../train/observe';
import { createTrainState, reduceTrain } from '../train/reduce';
import { formatLength, parseLength } from '../train/settings';
import type { TrainAction, TrainConfig, TrainState } from '../train/types';

function make(op: 'add' | 'sub', a: string, b: string): TrainState {
  const config: TrainConfig = { mode: 'length', variant: 'unit-train', op, a, b };
  return createTrainState(config);
}

function play(state: TrainState, ...actions: TrainAction[]): TrainState {
  return actions.reduce(reduceTrain, state);
}

const promote: TrainAction = { type: 'promote' };
const unpack: TrainAction = { type: 'unpack' };
const take: TrainAction = { type: 'take-away' };
const obs = (state: TrainState) => observeTrain(state);

describe('길이 문자열 파싱', () => {
  it.each([
    ['1m 70cm', 1, 70],
    ['205cm', 0, 205],
    ['3m', 3, 0],
    ['0cm', 0, 0],
    ['0m', 0, 0],
    ['9m 99cm', 9, 99],
    ['  2m   5cm ', 2, 5],
    ['1m70cm', 1, 70],
    ['999cm', 0, 999],
  ])('"%s"는 m=%i, cm=%i로 읽는다(정규화하지 않는다)', (text, m, cm) => {
    expect(parseLength(text)).toEqual({ m, cm });
  });

  it.each([
    '',
    '   ',
    'm',
    'cm',
    '10m',
    '1000cm',
    '9m 100cm',
    '5',
    '1.5m',
    '1cm 2m',
    '-1m',
    'abc',
    '1m 2',
    '1 m 2 cm 3 mm',
  ])('잘못된 형식·범위 "%s"는 null', (text) => {
    expect(parseLength(text)).toBeNull();
  });

  it('문자열이 아니면 null', () => {
    expect(parseLength(120)).toBeNull();
    expect(parseLength(null)).toBeNull();
    expect(parseLength(undefined)).toBeNull();
  });

  it('formatLength', () => {
    expect(formatLength({ m: 2, cm: 60 })).toBe('2m 60cm');
    expect(formatLength({ m: 3, cm: 0 })).toBe('3m');
    expect(formatLength({ m: 0, cm: 205 })).toBe('205cm');
    expect(formatLength({ m: 0, cm: 0 })).toBe('0cm');
  });
});

describe('설정', () => {
  it('add는 두 길이의 칸을 처음부터 한 기차에 합친다(정규화 전: 3m 120cm)', () => {
    const state = make('add', '1m 70cm', '2m 50cm');
    expect(state.error).toBeNull();
    expect(obs(state)).toMatchObject({
      mode: 'length',
      variant: 'unit-train',
      op: 'add',
      m: 3,
      cm: 120,
      totalCm: 420,
      normalized: false,
      promotes: 0,
      unpacks: 0,
      tookAway: false,
    });
    expect(state.rods).toBe(12);
    expect(state.blocks).toBe(0);
  });

  it('cm가 10의 배수가 아니면 1cm 블록이 생긴다(1m 75cm + 2m 8cm)', () => {
    const state = make('add', '1m 75cm', '2m 8cm');
    expect(state).toMatchObject({ m: 3, rods: 7, blocks: 13 });
    expect(obs(state)['cm']).toBe(83);
  });

  it('sub는 a만 놓고 b는 뺄 길이로 적어 둔다', () => {
    const state = make('sub', '5m 20cm', '2m 60cm');
    expect(state).toMatchObject({ m: 5, rods: 2, blocks: 0, bText: '2m 60cm' });
    expect(obs(state)).toMatchObject({ m: 5, cm: 20, totalCm: 520, op: 'sub' });
  });

  it('sub에서 a < b이면 설정 오류, a = b는 허용', () => {
    expect(make('sub', '2m', '2m 1cm').error).not.toBeNull();
    expect(make('sub', '2m', '2m').error).toBeNull();
    expect(make('sub', '0cm', '0cm').error).toBeNull();
  });

  it.each([
    ['잘못된 a', { op: 'add', a: '10m', b: '1m' }],
    ['잘못된 b', { op: 'add', a: '1m', b: 'x' }],
    ['op 없음', { a: '1m', b: '1m' }],
    ['잘못된 op', { op: 'mul', a: '1m', b: '1m' }],
    ['variant 다름', { variant: 'zoom', op: 'add', a: '1m', b: '1m' }],
  ])('설정 오류(%s)는 오류 상태이고 조작은 거절된다', (_name, partial) => {
    const state = createInitialState({
      mode: 'length',
      variant: 'unit-train',
      ...partial,
    } as never) as TrainState;
    expect(state.error).not.toBeNull();
    expect(play(state, promote, unpack, take)).toBe(state);
    expect(obs(state)).toMatchObject({ error: true, misconceptions: [] });
  });

  it('mode와 variant뿐이면 샌드박스 기본(1m 70cm + 2m 50cm)', () => {
    const state = createTrainState({ mode: 'length', variant: 'unit-train' } as TrainConfig);
    expect(state.error).toBeNull();
    expect(state).toMatchObject({ op: 'add', m: 3, rods: 12 });
  });

  it('variant가 적혀 있으면 E13 합집합이 unit-train으로 만든다', () => {
    const state = createInitialState({
      mode: 'length',
      variant: 'unit-train',
      op: 'add',
      a: '1m',
      b: '1m',
    });
    expect(isTrain(state)).toBe(true);
    expect(isTrain(createInitialState({ mode: 'length' }))).toBe(false);
  });
});

describe('덧셈: 승격', () => {
  it('1m 70cm + 2m 50cm → 승격 1회 → 4m 20cm, normalized', () => {
    const start = make('add', '1m 70cm', '2m 50cm');
    expect(obs(start)['misconceptions']).toEqual(['MC-LENGTH-NO-PROMOTE']);
    const done = play(start, promote);
    expect(obs(done)).toMatchObject({
      m: 4,
      cm: 20,
      totalCm: 420,
      normalized: true,
      promotes: 1,
      misconceptions: [],
    });
  });

  it('1m 30cm + 2m 40cm는 승격이 필요 없다(3m 70cm)', () => {
    const state = make('add', '1m 30cm', '2m 40cm');
    expect(obs(state)).toMatchObject({ m: 3, cm: 70, normalized: true, misconceptions: [] });
    // 막대가 10개 미만이라 승격은 거절된다.
    expect(play(state, promote)).toBe(state);
  });

  it('경계: 막대가 정확히 10개(100cm)여야 승격한다', () => {
    const exact = make('add', '0cm', '1m'); // m 1칸
    expect(play(exact, promote)).toBe(exact);
    const ten = play(exact, unpack); // 막대 10개
    expect(ten).toMatchObject({ m: 0, rods: 10 });
    expect(play(ten, promote)).toMatchObject({ m: 1, rods: 0 });
  });

  it('99cm + 99cm 같은 큰 수: 1m 99cm + 1m 99cm → 승격 1회 → 3m 98cm', () => {
    const state = make('add', '1m 99cm', '1m 99cm');
    expect(state).toMatchObject({ m: 2, rods: 18, blocks: 18 });
    const done = play(state, promote);
    expect(obs(done)).toMatchObject({ m: 3, cm: 98 });
  });

  it('조건이 안 맞는 승격·풀기는 상태를 그대로 돌려준다', () => {
    const state = make('add', '3m', '0cm');
    expect(play(state, promote)).toBe(state);
    const none = make('add', '0cm', '30cm');
    expect(play(none, unpack)).toBe(none);
    expect(play(none, { type: 'unpack-small' })).not.toBe(none); // 막대가 있으니 풀 수 있다
  });

  it('add에서는 빼기를 거절한다', () => {
    const state = make('add', '1m', '1m');
    expect(play(state, take)).toBe(state);
  });
});

describe('뺄셈: 풀기', () => {
  it('5m 20cm − 2m 60cm → 풀기 1회 → 빼기 → 2m 60cm', () => {
    const start = make('sub', '5m 20cm', '2m 60cm');
    // 막대가 2개뿐이라 그대로는 빼지 못한다(칸이 모자람).
    expect(play(start, take)).toBe(start);
    const unpacked = play(start, unpack);
    expect(obs(unpacked)).toMatchObject({ m: 4, cm: 120, unpacks: 1, misconceptions: [] });
    const done = play(unpacked, take);
    expect(obs(done)).toMatchObject({ m: 2, cm: 60, totalCm: 260, tookAway: true, unpacks: 1 });
  });

  it('막대가 모자라면 거절하고, 1m 칸을 풀면 뺄 수 있다', () => {
    const state = make('sub', '2m 50cm', '1m 60cm');
    expect(play(state, take)).toBe(state); // 막대 5개 < 6개
    const ok = play(state, unpack, take);
    expect(obs(ok)).toMatchObject({ m: 0, cm: 90, totalCm: 90 });
  });

  it('1cm 블록이 모자라면 [작게 풀기]로 따로 푼다', () => {
    const start = make('sub', '3m 20cm', '1m 5cm');
    expect(start).toMatchObject({ m: 3, rods: 2, blocks: 0 });
    expect(play(start, take)).toBe(start); // 블록 0 < 5
    const small = play(start, { type: 'unpack-small' });
    expect(small).toMatchObject({ rods: 1, blocks: 10 });
    expect(obs(small)['cm']).toBe(20); // 값은 그대로
    const done = play(small, take);
    expect(obs(done)).toMatchObject({ m: 2, cm: 15, totalCm: 215 });
  });

  it('빼기는 한 번만 한다', () => {
    const done = play(make('sub', '5m 20cm', '2m 60cm'), unpack, take);
    expect(play(done, take)).toBe(done);
  });

  it('b가 205cm처럼 cm만 있으면 cm 줄에서 덜어낸다(풀어서 채운다)', () => {
    const start = make('sub', '3m 10cm', '205cm');
    expect(play(start, take)).toBe(start);
    const ready = play(start, unpack, unpack, { type: 'unpack-small' }, take);
    // 3m 10cm → 막대 1, 블록 0. 풀기 2번: m1, 막대 21. 작게 풀기: 막대 20, 블록 10. 빼기: 막대 0, 블록 5.
    expect(ready).toMatchObject({ m: 1, rods: 0, blocks: 5 });
    expect(obs(ready)['totalCm']).toBe(105);
  });

  it('sub에서는 cm가 100 이상이어도 MC-LENGTH-NO-PROMOTE를 기록하지 않는다', () => {
    const unpacked = play(make('sub', '5m 20cm', '2m 60cm'), unpack);
    expect(obs(unpacked)['misconceptions']).toEqual([]);
  });
});

describe('reset과 predicates', () => {
  it('reset은 처음 기차로 되돌리고 횟수를 0으로 한다', () => {
    const start = make('sub', '5m 20cm', '2m 60cm');
    const done = play(start, unpack, take);
    expect(play(done, { type: 'reset' })).toEqual(start);
    expect(play(start, { type: 'reset' })).toBe(start);
  });

  it('predicates', () => {
    const p = trainPredicates;
    const start = make('add', '1m 70cm', '2m 50cm');
    const done = play(start, promote);
    expect(p['trainIs']?.(obs(start), { m: 3, cm: 120 })).toBe(true);
    expect(p['trainIs']?.(obs(done), { m: 4, cm: 20 })).toBe(true);
    expect(p['trainIs']?.(obs(done), { m: 4 })).toBe(false);
    expect(p['trainIs']?.(obs(done), { m: 3, cm: 120 })).toBe(false);
    expect(p['normalized']?.(obs(start), undefined)).toBe(false);
    expect(p['normalized']?.(obs(done), undefined)).toBe(true);
    expect(p['promotedAtLeast']?.(obs(start), { n: 1 })).toBe(false);
    expect(p['promotedAtLeast']?.(obs(done), { n: 1 })).toBe(true);
    expect(p['promotedAtLeast']?.(obs(done), { n: 2 })).toBe(false);
    expect(p['promotedAtLeast']?.(obs(done), undefined)).toBe(false);
    const sub = play(make('sub', '5m 20cm', '2m 60cm'), unpack);
    expect(p['unpackedAtLeast']?.(obs(sub), { n: 1 })).toBe(true);
    expect(p['tookAway']?.(obs(sub), undefined)).toBe(false);
    expect(p['tookAway']?.(obs(play(sub, take)), undefined)).toBe(true);
  });

  it('E13 합집합의 reduce·observe가 unit-train으로 나뉜다', () => {
    const state: E13State = createInitialState({
      mode: 'length',
      variant: 'unit-train',
      op: 'add',
      a: '1m 70cm',
      b: '2m 50cm',
    });
    const next = reduce(state, { type: 'promote' });
    expect(observe(next)).toMatchObject({ variant: 'unit-train', m: 4, cm: 20 });
  });

  it('JSON 왕복', () => {
    const state = play(make('sub', '5m 20cm', '2m 60cm'), unpack, take);
    assertSerializable(state);
    assertSerializable(obs(state));
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
    expect(JSON.parse(JSON.stringify(obs(state)))).toEqual(obs(state));
  });
});
