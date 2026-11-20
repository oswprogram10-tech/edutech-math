/** E13 weight 순수 로직 테스트: 설정, 기울기, 클립, 용수철 g, 예측 잠금, compared, predicates, JSON 왕복. */
import { describe, expect, it } from 'vitest';
import { assertSerializable } from '../../../core/engine-sdk';
import { weightPredicates } from '../weight/events';
import { boardHeight, dropTarget, geoOf, hookY, panOffsets, tiltDegrees } from '../weight/layout';
import { observeWeight } from '../weight/observe';
import { createWeightState, reduceWeight } from '../weight/reduce';
import { heaviestOf, readWeight } from '../weight/settings';
import type { WeightAction, WeightConfig, WeightState } from '../weight/types';
import { Rational } from '../../../core/math';
import definition from '../index';

const base: WeightConfig = {
  mode: 'weight',
  tools: ['pan-balance', 'spring-scale'],
  objects: [
    { id: 'ball', kind: 'beachball', g: 200, visualSize: 'large' },
    { id: 'iron', kind: 'iron-ball', g: 700, visualSize: 'small' },
    { id: 'book', kind: 'book', g: 450 },
  ],
  springMaxG: 1000,
  unitObjects: { clip: 50 },
};

const make = (config: WeightConfig = base) => createWeightState(config);
function play(state: WeightState, ...actions: WeightAction[]): WeightState {
  return actions.reduce(reduceWeight, state);
}
const obs = (state: WeightState) => observeWeight(state);
const place = (id: string, pan: 'left' | 'right' | 'shelf'): WeightAction => ({
  type: 'place',
  id,
  pan,
});
const hang = (id: string | null): WeightAction => ({ type: 'hang', id });
const clip = (delta: 1 | -1): WeightAction => ({ type: 'clip', delta });

describe('설정', () => {
  it('설정이 mode뿐이면 두 저울과 클립이 있는 샌드박스 기본을 쓴다', () => {
    const state = make({ mode: 'weight' });
    expect(state.error).toBeNull();
    expect(state.tools).toEqual(['pan-balance', 'spring-scale']);
    expect(state.objects).toHaveLength(4);
    expect(state.clipG).toBe('50');
    expect(state.predict).toBe(false);
  });

  it('springMaxG 기본은 1000, 같은 종류 물건에는 가·나가 붙는다', () => {
    const state = make({
      ...base,
      springMaxG: undefined,
      objects: [
        { id: 'a', kind: 'book', g: 100 },
        { id: 'b', kind: 'book', g: 300 },
        { id: 'c', kind: 'apple', g: 150 },
      ],
    });
    expect(state.springMaxG).toBe('1000');
    expect(state.objects.map((o) => o.name)).toEqual(['책 가', '책 나', '사과']);
  });

  it.each([
    ['저울이 없음', { tools: [] }],
    ['저울이 셋', { tools: ['pan-balance', 'spring-scale', 'pan-balance'] }],
    ['모르는 저울', { tools: ['digital' as never] }],
    ['물건이 없음', { objects: [] }],
    [
      '물건이 일곱',
      {
        objects: Array.from({ length: 7 }, (_, i) => ({
          id: `o${i}`,
          kind: 'book' as const,
          g: 10,
        })),
      },
    ],
    [
      'id가 같음',
      {
        objects: [
          { id: 'a', kind: 'book' as const, g: 10 },
          { id: 'a', kind: 'apple' as const, g: 20 },
        ],
      },
    ],
    ['g 0', { objects: [{ id: 'a', kind: 'book' as const, g: 0 }] }],
    ['g가 소수', { objects: [{ id: 'a', kind: 'book' as const, g: 10.5 }] }],
    ['g가 음수', { objects: [{ id: 'a', kind: 'book' as const, g: -10 }] }],
    ['모르는 물건 종류', { objects: [{ id: 'a', kind: 'car' as never, g: 10 }] }],
    [
      '모르는 크기',
      { objects: [{ id: 'a', kind: 'book' as const, g: 10, visualSize: 'huge' as never }] },
    ],
    ['용수철 끝보다 무거운 물건', { objects: [{ id: 'a', kind: 'book' as const, g: 1001 }] }],
    ['springMaxG가 100의 배수가 아님', { springMaxG: 250 }],
    ['springMaxG 0', { springMaxG: 0 }],
    ['클립 0g', { unitObjects: { clip: 0 } }],
    ['predict가 글', { predict: 'yes' as never }],
  ] as const)('잘못된 설정(%s)은 오류 상태이고 조작은 거절된다', (_n, partial) => {
    const state = make({ ...base, ...partial } as WeightConfig);
    expect(state.error).not.toBeNull();
    expect(play(state, place('ball', 'left'))).toBe(state);
    expect(obs(state)).toMatchObject({ error: true, misconceptions: [] });
  });

  it('클립은 윗접시저울이 있어야 쓴다', () => {
    expect(make({ ...base, tools: ['spring-scale'] }).error).not.toBeNull();
  });

  it('예측은 물건이 둘 이상일 때만 켠다', () => {
    expect(
      make({ ...base, predict: true, objects: [{ id: 'a', kind: 'book', g: 10 }] }).error,
    ).not.toBeNull();
    expect(make({ ...base, predict: true }).error).toBeNull();
  });

  it('경계: g 1과 99999, springMaxG 100과 5000 허용', () => {
    expect(
      make({
        ...base,
        tools: ['pan-balance'],
        unitObjects: undefined,
        objects: [
          { id: 'a', kind: 'book', g: 99999 },
          { id: 'b', kind: 'apple', g: 1 },
        ],
      }).error,
    ).toBeNull();
    expect(
      make({ ...base, springMaxG: 100, objects: [{ id: 'a', kind: 'book', g: 100 }] }).error,
    ).toBeNull();
    expect(
      make({ ...base, springMaxG: 5000, objects: [{ id: 'a', kind: 'book', g: 5000 }] }).error,
    ).toBeNull();
  });
});

describe('윗접시저울', () => {
  it('접시에 놓으면 무거운 쪽으로 기운다(공 200 vs 쇠 700)', () => {
    const state = play(make(), place('ball', 'left'), place('iron', 'right'));
    expect(obs(state)).toMatchObject({
      left: 'ball',
      right: 'iron',
      tilt: 'right',
      balanced: false,
    });
    const flipped = play(make(), place('iron', 'left'), place('ball', 'right'));
    expect(obs(flipped)).toMatchObject({ tilt: 'left' });
  });

  it('한쪽만 올리면 그쪽으로 기운다', () => {
    const state = play(make(), place('ball', 'left'));
    expect(readWeight(state)).toMatchObject({ tilt: 'left', bothUsed: false, balanced: false });
    expect(readWeight(make())).toMatchObject({ tilt: 'level', bothUsed: false });
  });

  it('한 접시에는 물건 하나만: 찬 접시에는 거절된다', () => {
    const state = play(make(), place('ball', 'left'));
    expect(play(state, place('iron', 'left'))).toBe(state);
    expect(play(state, place('ball', 'left'))).toBe(state);
  });

  it('물건은 한 곳에만 있다: 다른 접시로 옮기면 원래 접시가 비고, 선반으로 내릴 수 있다', () => {
    let state = play(make(), place('ball', 'left'), place('ball', 'right'));
    expect(state.left).toBeNull();
    expect(state.right).toBe('ball');
    state = play(state, place('ball', 'shelf'));
    expect(state.right).toBeNull();
    expect(play(state, place('ball', 'shelf'))).toBe(state);
  });

  it('같은 물건이 같은 접시, 모르는 물건·모르는 접시는 거절', () => {
    const state = make();
    expect(play(state, place('jar', 'left'))).toBe(state);
    expect(play(state, { type: 'place', id: 'ball', pan: 'top' as never })).toBe(state);
  });

  it('무게가 같으면 balanced(두 접시 모두 올렸을 때만)', () => {
    const state = make({
      ...base,
      objects: [
        { id: 'a', kind: 'book', g: 300 },
        { id: 'b', kind: 'apple', g: 300 },
      ],
    });
    const done = play(state, place('a', 'left'), place('b', 'right'));
    expect(obs(done)).toMatchObject({ tilt: 'level', balanced: true });
    expect(weightPredicates['balanced']?.(obs(done), undefined)).toBe(true);
    expect(weightPredicates['balanced']?.(obs(play(state, place('a', 'left'))), undefined)).toBe(
      false,
    );
  });

  it('클립: 하나씩 더·빼고, 클립 n개가 물건과 같으면 balanced(450g 책 = 클립 9개)', () => {
    let state = play(make(), place('book', 'left'));
    for (let i = 0; i < 8; i += 1) state = play(state, clip(1));
    expect(obs(state)).toMatchObject({ clips: 8, tilt: 'left', balanced: false });
    state = play(state, clip(1));
    expect(obs(state)).toMatchObject({ clips: 9, tilt: 'level', balanced: true });
    expect(weightPredicates['clipsIs']?.(obs(state), { n: 9 })).toBe(true);
    expect(weightPredicates['clipsIs']?.(obs(state), { n: 8 })).toBe(false);
    expect(weightPredicates['clipsIs']?.(obs(state), { n: 0 })).toBe(false);
    state = play(state, clip(1));
    expect(obs(state)).toMatchObject({ clips: 10, tilt: 'right', balanced: false });
    expect(play(state, clip(-1)).clips).toBe(9);
  });

  it('클립 경계: 0 아래·40 위·클립 없는 설정·오른쪽 접시에 물건이 있을 때는 거절', () => {
    const start = make();
    expect(play(start, clip(-1))).toBe(start);
    let state = start;
    for (let i = 0; i < 40; i += 1) state = play(state, clip(1));
    expect(state.clips).toBe(40);
    expect(play(state, clip(1))).toBe(state);
    const noClip = make({ ...base, unitObjects: undefined });
    expect(play(noClip, clip(1))).toBe(noClip);
    const withObject = play(start, place('ball', 'right'));
    expect(play(withObject, clip(1))).toBe(withObject);
    // 클립이 쌓인 오른쪽 접시에는 물건을 놓지 못한다.
    const withClips = play(start, clip(1));
    expect(play(withClips, place('ball', 'right'))).toBe(withClips);
  });

  it('compared: 서로 반대 접시에 하나씩 올린 쌍을 기억하고 reset해도 남는다', () => {
    let state = play(make(), place('ball', 'left'), place('iron', 'right'));
    expect(weightPredicates['compared']?.(obs(state), { a: 'iron', b: 'ball' })).toBe(true);
    expect(weightPredicates['compared']?.(obs(state), { a: 'ball', b: 'book' })).toBe(false);
    expect(weightPredicates['compared']?.(obs(state), { a: 'ball', b: 'ball' })).toBe(false);
    state = play(state, { type: 'reset' });
    expect(state.left).toBeNull();
    expect(weightPredicates['compared']?.(obs(state), { a: 'ball', b: 'iron' })).toBe(true);
    expect(obs(state)['pairsCompared']).toEqual(['ball|iron']);
  });

  it('heaviest는 가장 무거운 물건, 같으면 빈 문자열', () => {
    expect(heaviestOf(make())).toBe('iron');
    const tie = make({
      ...base,
      objects: [
        { id: 'a', kind: 'book', g: 300 },
        { id: 'b', kind: 'apple', g: 300 },
      ],
    });
    expect(heaviestOf(tie)).toBe('');
  });
});

describe('용수철저울', () => {
  it('걸면 그 물건의 g가 springG(문자열)에 나타난다', () => {
    const state = play(make(), hang('iron'));
    expect(obs(state)).toMatchObject({ hung: 'iron', springG: '700' });
    expect(weightPredicates['hungIs']?.(obs(state), { id: 'iron' })).toBe(true);
    expect(weightPredicates['hungIs']?.(obs(state), { id: 'ball' })).toBe(false);
    expect(obs(make())).toMatchObject({ hung: null, springG: null });
  });

  it('다른 물건을 걸면 바꿔 걸리고, 같은 물건은 거절, 내리기는 hang null', () => {
    let state = play(make(), hang('iron'));
    expect(play(state, hang('iron'))).toBe(state);
    state = play(state, hang('ball'));
    expect(state.hung).toBe('ball');
    state = play(state, hang(null));
    expect(state.hung).toBeNull();
    expect(play(state, hang(null))).toBe(state);
  });

  it('접시에 있던 물건을 걸면 접시가 비고, 걸린 물건을 접시에 놓으면 고리가 빈다', () => {
    let state = play(make(), place('ball', 'left'), hang('ball'));
    expect(state.left).toBeNull();
    state = play(state, place('ball', 'right'));
    expect(state.hung).toBeNull();
    expect(state.right).toBe('ball');
  });

  it('저울 종류가 없으면 거절(용수철만 있으면 접시에 못 놓는다)', () => {
    const springOnly = make({ ...base, tools: ['spring-scale'], unitObjects: undefined });
    expect(play(springOnly, place('ball', 'left'))).toBe(springOnly);
    const panOnly = make({ ...base, tools: ['pan-balance'] });
    expect(play(panOnly, hang('ball'))).toBe(panOnly);
  });

  it('늘어난 길이는 g에 비례한다(고리 y)', () => {
    const geo = geoOf(make());
    const spring = geo.spring;
    if (spring === null) throw new Error('spring geo');
    const max = Rational.of(1000);
    expect(hookY(spring, null, max)).toBe(spring.zeroY);
    expect(hookY(spring, Rational.of(500), max)).toBe(spring.zeroY + spring.len / 2);
    expect(hookY(spring, Rational.of(1000), max)).toBe(spring.zeroY + spring.len);
    expect(hookY(spring, Rational.of(250), max) - spring.zeroY).toBeCloseTo(spring.len / 4, 6);
  });
});

describe('예측', () => {
  const predicting: WeightConfig = { ...base, predict: true };

  it('예측하기 전에는 놓기·걸기·클립이 거절된다', () => {
    const state = make(predicting);
    expect(play(state, place('ball', 'left'))).toBe(state);
    expect(play(state, hang('ball'))).toBe(state);
    expect(play(state, clip(1))).toBe(state);
    expect(obs(state)).toMatchObject({ predictionLocked: false, prediction: null });
  });

  it('예측하면 잠기고 놓기가 열리며, 두 번째 예측은 거절된다', () => {
    let state = play(make(predicting), { type: 'predict', id: 'iron' });
    expect(obs(state)).toMatchObject({ predictionLocked: true, prediction: 'iron' });
    expect(weightPredicates['predictionLocked']?.(obs(state), undefined)).toBe(true);
    expect(weightPredicates['predictionIs']?.(obs(state), { id: 'iron' })).toBe(true);
    expect(weightPredicates['predictionIs']?.(obs(state), { id: 'ball' })).toBe(false);
    expect(play(state, { type: 'predict', id: 'ball' })).toBe(state);
    state = play(state, place('ball', 'left'));
    expect(state.left).toBe('ball');
  });

  it('모르는 물건 예측과 예측이 꺼진 설정의 예측은 거절된다', () => {
    const state = make(predicting);
    expect(play(state, { type: 'predict', id: 'jar' })).toBe(state);
    const off = make();
    expect(play(off, { type: 'predict', id: 'ball' })).toBe(off);
    expect(weightPredicates['predictionIs']?.(obs(state), { id: 'ball' })).toBe(false);
  });

  it('reset은 예측을 남긴다', () => {
    const state = play(make(predicting), { type: 'predict', id: 'iron' }, place('ball', 'left'), {
      type: 'reset',
    });
    expect(state.left).toBeNull();
    expect(state.prediction).toBe('iron');
    expect(state.predictionLocked).toBe(true);
  });
});

describe('reset·JSON·판 높이', () => {
  it('reset은 접시·클립·고리를 비우고, 이미 비었으면 거절한다', () => {
    const state = play(make(), place('ball', 'left'), clip(1), hang('iron'));
    const reset = play(state, { type: 'reset' });
    expect(reset).toMatchObject({ left: null, right: null, clips: 0, hung: null });
    expect(play(reset, { type: 'reset' })).toBe(reset);
  });

  it('상태와 Observation은 JSON 직렬화가 되고 왕복해도 같다', () => {
    const state = play(make(), place('ball', 'left'), place('iron', 'right'), clip(-1));
    assertSerializable(state);
    assertSerializable(obs(state));
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it('Observation에 오개념 목록이 있고 hasMisconception이 작동한다', () => {
    expect(obs(make())['misconceptions']).toEqual([]);
    const predicate = definition.predicates?.['hasMisconception'];
    expect(predicate?.(obs(make()), { code: 'MC-MEAS-WEIGHT-SIZE' })).toBe(false);
  });

  it('엔진 정의가 weight 모드와 새 predicates·오버레이를 갖는다', () => {
    expect(definition.modes).toContain('weight');
    for (const name of [
      'predictionLocked',
      'predictionIs',
      'compared',
      'hungIs',
      'balanced',
      'clipsIs',
    ]) {
      expect(definition.predicates?.[name]).toBeTypeOf('function');
    }
    expect(definition.overlays?.['size-weight-bars']).toBeTypeOf('function');
  });

  it('논리 높이: 윗접시저울만 560, 용수철저울이 있으면 600(모두 600 이하)', () => {
    expect(boardHeight({ tools: ['pan-balance'] })).toBe(560);
    expect(boardHeight({ tools: ['spring-scale'] })).toBe(600);
    expect(boardHeight({ tools: ['pan-balance', 'spring-scale'] })).toBe(600);
  });

  it('용수철 눈금: springMaxG 500이면 10g 간격 ≥ 8 논리 px, 1000은 판 안 최대(간격이 8보다 작다)', () => {
    const both = ['pan-balance', 'spring-scale'] as const;
    for (const tools of [['spring-scale'], both] as const) {
      const g500 = geoOf({ tools, springMaxG: '500' }).spring;
      const g1000 = geoOf({ tools, springMaxG: '1000' }).spring;
      if (g500 === null || g1000 === null) throw new Error('spring geo');
      expect(g500.len / 50).toBeGreaterThanOrEqual(8);
      expect(g500.len).toBe(400);
      expect(g1000.len / 100).toBeLessThan(8);
      // 눈금 끝에 큰 물건(96 × 배율)이 걸려도 판(600) 안에 있다.
      for (const g of [g500, g1000]) {
        expect(g.zeroY + g.len + 16 + 96 * g.itemScale).toBeLessThanOrEqual(600);
      }
    }
  });

  it('기울기 각도: 같으면 0, 다르면 4~12도', () => {
    const level = play(make(), place('ball', 'left'));
    expect(tiltDegrees(level)).toBeGreaterThanOrEqual(4);
    expect(tiltDegrees(level)).toBeLessThanOrEqual(12);
    expect(tiltDegrees(make())).toBe(0);
    expect(panOffsets(190, 'level', 0).left).toEqual({ dx: 0, dy: 0 });
    expect(panOffsets(190, 'left', 8).left.dy).toBeGreaterThan(0);
    expect(panOffsets(190, 'left', 8).right.dy).toBeLessThan(0);
  });

  it('놓은 자리: 선반 아래는 선반, 접시 위는 그 접시, 고리 근처는 걸기, 빈 곳은 null', () => {
    const both = { tools: ['pan-balance', 'spring-scale'] } as const;
    const geo = geoOf(both);
    const balance = geo.balance;
    const spring = geo.spring;
    if (balance === null || spring === null) throw new Error('geo');
    expect(dropTarget(both, 500, geo.shelfTop + 20)).toBe('shelf');
    expect(dropTarget(both, balance.cx - balance.beamHalf, balance.surfaceY)).toBe('left');
    expect(dropTarget(both, balance.cx + balance.beamHalf, balance.surfaceY)).toBe('right');
    expect(dropTarget(both, spring.x, 200)).toBe('spring');
    expect(dropTarget(both, 640, 60)).toBeNull();
    expect(dropTarget({ tools: ['pan-balance'] }, 500, 200)).toBeNull();
  });
});
