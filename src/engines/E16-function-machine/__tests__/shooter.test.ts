/** E16 rule-shooter 단위 테스트: shooter.ts 순수 계산, reduce·observe·predicates·events. */
import { describe, expect, it } from 'vitest';
import { assertSerializable } from '../../../core/engine-sdk';
import { Rational, parseRelation } from '../../../core/math';
import definition from '../index';
import { emit, predicates } from '../events';
import { observe } from '../observe';
import { createInitialState, reduce } from '../reduce';
import {
  gemHits,
  gemsOf,
  laserPoints,
  missInfo,
  pointX,
  pointY,
  shooterLayout,
  tickStep,
} from '../shooter';
import type { FunctionAction, FunctionConfig, FunctionState, ShooterState } from '../types';

const R = Rational.of;
const GEMS = [
  { x: R(1), y: R(4) },
  { x: R(2), y: R(7) },
  { x: R(3), y: R(10) },
  { x: R(5), y: R(16) },
];

function sh(state: FunctionState): ShooterState {
  if (state.mode !== 'rule-shooter') throw new Error('rule-shooter 상태가 아니다');
  return state;
}

function reduceAll(state: FunctionState, actions: readonly FunctionAction[]): FunctionState {
  return actions.reduce<FunctionState>((s, a) => reduce(s, a), state);
}

function typed(text: string): FunctionAction[] {
  return [...text].map((key): FunctionAction => ({ type: 'type', target: 'rule', key }));
}

function write(text: string): FunctionAction[] {
  return [{ type: 'clear', target: 'rule' }, ...typed(text), { type: 'fire' }];
}

function play(config: FunctionConfig, actions: readonly FunctionAction[]): FunctionState {
  return reduceAll(createInitialState(config), actions);
}

const CONFIG: FunctionConfig = {
  mode: 'rule-shooter',
  gems: [
    [1, 3],
    [2, 6],
    [4, 12],
  ],
};

describe('laserPoints', () => {
  const grid = { xMax: 6, yMax: 10 };
  it('□ = ○ × 3 + 1: 범위 안의 점만 남긴다(○ = 0 포함, □ > 10 제외)', () => {
    const points = laserPoints(parseRelation('□ = ○ × 3 + 1'), grid);
    expect(points.map((p) => [p.x.toString(), p.y.toString()])).toEqual([
      ['0', '1'],
      ['1', '4'],
      ['2', '7'],
      ['3', '10'],
    ]);
  });
  it('분수 □는 남긴다', () => {
    const points = laserPoints(parseRelation('□ = ○ ÷ 2'), grid);
    expect(points.map((p) => p.y.toString())).toEqual(['0', '1/2', '1', '3/2', '2', '5/2', '3']);
  });
  it('음수 □는 뺀다', () => {
    const points = laserPoints(parseRelation('□ = ○ − 2'), grid);
    expect(points[0]?.x.toString()).toBe('2');
  });
  it('NONLINEAR·해가 하나로 정해지지 않는 식은 빈 목록', () => {
    expect(laserPoints(parseRelation('□ × □ = ○'), grid)).toEqual([]);
    expect(laserPoints(parseRelation('□ × 0 = ○'), grid)).toEqual([]);
  });
});

describe('gemHits·missInfo', () => {
  it('□ = ○ × 3 + 1은 모두 맞고 □ = ○ + 3은 첫 보석만 맞는다', () => {
    expect(gemHits(parseRelation('□ = ○ × 3 + 1'), GEMS)).toEqual([true, true, true, true]);
    expect(gemHits(parseRelation('□ = ○ + 3'), GEMS)).toEqual([true, false, false, false]);
  });
  it('missInfo: 내 식의 □와 보석의 □', () => {
    const info = missInfo(parseRelation('□ = ○ + 9'), { x: R(4), y: R(13) });
    expect([info.x.toString(), info.gemY.toString(), info.ruleY?.toString()]).toEqual([
      '4',
      '13',
      '13',
    ]);
    const none = missInfo(parseRelation('□ × 0 = ○'), { x: R(4), y: R(13) });
    expect(none.ruleY).toBeNull();
  });
});

describe('layout', () => {
  it('보석 좌표가 격자 안쪽 화면 좌표로 간다', () => {
    const layout = shooterLayout({ xMax: 7, yMax: 19 });
    expect(pointX(layout, R(0))).toBe(layout.left);
    expect(pointY(layout, R(0))).toBe(layout.top + layout.plotH);
    expect(pointY(layout, Rational.parse('1/2'))).toBeCloseTo(
      layout.top + layout.plotH - layout.cellY / 2,
    );
  });
  it('눈금 간격: 칸이 14px 이상이면 1, 작으면 건너뛴다', () => {
    expect(tickStep(14)).toBe(1);
    expect(tickStep(13)).toBe(2);
    expect(tickStep(5)).toBe(3);
  });
});

describe('설정', () => {
  it('기본 보석을 쓰고 격자는 최댓값 + 여유다', () => {
    const state = sh(createInitialState({ mode: 'rule-shooter' }));
    expect(state.settings.error).toBeNull();
    expect(state.settings.gems).toHaveLength(4);
    expect(state.settings.grid).toEqual({ xMax: 7, yMax: 19 });
    expect(state.target).toBe('rule');
  });
  it('보석이 2개 미만·9개 이상·읽히지 않거나 음수면 설정 오류', () => {
    const errorOf = (gems: unknown) =>
      createInitialState({ mode: 'rule-shooter', gems } as unknown as FunctionConfig).settings
        .error;
    expect(errorOf([[1, 2]])).toBe('gems');
    expect(errorOf(Array.from({ length: 9 }, (_, i) => [i, i]))).toBe('gems');
    expect(
      errorOf([
        ['a', 1],
        [1, 2],
      ]),
    ).toBe('gems');
    expect(
      errorOf([
        [-1, 2],
        [1, 2],
      ]),
    ).toBe('gems');
  });
  it('격자가 보석을 담지 못하면 설정 오류, 숨은 규칙이 읽히지 않아도 오류', () => {
    expect(
      createInitialState({ ...CONFIG, grid: { xMax: 2, yMax: 20 } } as FunctionConfig).settings
        .error,
    ).toBe('grid');
    expect(createInitialState({ ...CONFIG, rule: '○ +' } as FunctionConfig).settings.error).toBe(
      'rule',
    );
  });
  it('분수 보석과 allowedOps', () => {
    const state = sh(
      createInitialState({
        mode: 'rule-shooter',
        gems: [
          ['1/2', '3/2'],
          [1, 3],
        ],
        allowedOps: ['+', '-'],
      }),
    );
    expect(state.settings.gems[0]).toEqual(['1/2', '3/2']);
    expect(state.settings.allowedOps).toEqual(['+', '−']);
    expect(gemsOf(state.settings)[0]?.x.toString()).toBe('1/2');
  });
  it('모르는 키는 무시한다', () => {
    const state = createInitialState({ ...CONFIG, symbols: 'x' } as unknown as FunctionConfig);
    expect(state.settings.error).toBeNull();
  });
});

describe('reduce', () => {
  it('발사하면 읽힌 식만 shots에 쌓고, 맞힌 보석 번호를 적는다', () => {
    const s = sh(play(CONFIG, write('□ = ○ + 2')));
    expect(s.shots).toEqual([{ text: '□=○+2', hits: [0] }]);
    expect(s.tested?.ok).toBe(true);
  });
  it('읽히지 않는 식은 tested만 바뀌고 shots는 그대로다', () => {
    const s = sh(play(CONFIG, write('+3')));
    expect(s.tested?.ok).toBe(false);
    expect(s.shots).toEqual([]);
  });
  it('빈 식·같은 식 다시 발사는 같은 상태 객체를 돌려준다', () => {
    const start = createInitialState(CONFIG);
    expect(reduce(start, { type: 'fire' })).toBe(start);
    const fired = play(CONFIG, write('□ = ○ × 3'));
    expect(reduce(fired, { type: 'fire' })).toBe(fired);
  });
  it('test-rule도 발사로 다룬다', () => {
    const s = sh(play(CONFIG, [...typed('□=○×3'), { type: 'test-rule' }]));
    expect(s.shots).toHaveLength(1);
  });
  it('수 입력 Action과 input 포커스는 무시한다(target은 늘 rule)', () => {
    const start = createInitialState(CONFIG);
    expect(reduce(start, { type: 'type', target: 'input', key: '5' })).toBe(start);
    expect(reduce(start, { type: 'focus', target: 'input' })).toBe(start);
    expect(reduce(start, { type: 'insert-input' })).toBe(start);
  });
  it('shots는 최근 10개만 둔다', () => {
    let state: FunctionState = createInitialState(CONFIG);
    for (let n = 0; n < 12; n += 1) state = reduceAll(state, write(`□ = ○ + ${n}`));
    expect(sh(state).shots).toHaveLength(10);
  });
  it('JSON으로 직렬화된다', () => {
    const state = play(CONFIG, write('□ = ○ × 3'));
    expect(() => assertSerializable(state)).not.toThrow();
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });
});

describe('observe·predicates·events', () => {
  it('□ = ○ + 2: 1개 맞힘, ONE-PAIR, allHit 아님', () => {
    const o = observe(play(CONFIG, write('□ = ○ + 2')));
    expect(o.hits).toEqual([0]);
    expect(o.hitCount).toBe(1);
    expect(o.allHit).toBe(false);
    expect(o.shotCount).toBe(1);
    expect(o.misconceptions).toEqual(['MC-PATTERN-ONE-PAIR']);
    expect(predicates.allHit?.(o, {})).toBe(false);
    expect(predicates.hitCountAtLeast?.(o, { n: 1 })).toBe(true);
    expect(predicates.hitCountAtLeast?.(o, { n: 2 })).toBe(false);
  });
  it('□ = ○ × 3: allHit이고 숨은 rule이 없으면 matchesHidden도 true', () => {
    const o = observe(play(CONFIG, [...write('□ = ○ + 2'), ...write('□ = ○ × 3')]));
    expect(o.allHit).toBe(true);
    expect(o.matchesHidden).toBe(true);
    expect(o.shotCount).toBe(2);
    expect(predicates.allHit?.(o, {})).toBe(true);
    expect(predicates.shotsAtMost?.(o, { n: 2 })).toBe(true);
    expect(predicates.shotsAtMost?.(o, { n: 1 })).toBe(false);
    expect(predicates.shotsAtMost?.(o, {})).toBe(false);
    expect(Array.isArray(o.gems)).toBe(true);
  });
  it('읽히지 않는 식은 hits가 비고 allHit이 아니다', () => {
    const o = observe(play(CONFIG, [...write('□ = ○ × 3'), ...write('□ =')]));
    expect(o.hits).toEqual([]);
    expect(o.allHit).toBe(false);
  });
  it('SWAP: ○ = □ × 3', () => {
    const o = observe(play(CONFIG, write('○ = □ × 3')));
    expect(o.misconceptions).toContain('MC-CORR-SWAP-VARS');
  });
  it('ADD-ONLY는 숨은 rule이 있을 때만 걸린다', () => {
    const twice = [...write('□ = ○ + 2'), ...write('□ = ○ + 3')];
    expect(observe(play(CONFIG, twice)).misconceptions).not.toContain('MC-FUNC-ADD-ONLY');
    const withRule = { ...CONFIG, rule: '□ = ○ × 3' } as FunctionConfig;
    expect(observe(play(withRule, twice)).misconceptions).toContain('MC-FUNC-ADD-ONLY');
  });
  it('rule이 있으면 matchesHidden은 식 동치로 본다(allHit과 따로)', () => {
    const withRule = { ...CONFIG, rule: '□ = ○ × 3' } as FunctionConfig;
    expect(observe(play(withRule, write('□ = ○ × 3'))).matchesHidden).toBe(true);
    expect(observe(play(withRule, write('□ = ○ × 4'))).matchesHidden).toBe(false);
  });
  it('ruleFormDiffers: allHit이고 모양이 다르다', () => {
    const shifted = observe(play(CONFIG, write('□ − 0 = ○ × 3')));
    expect(shifted.allHit).toBe(true);
    expect(predicates.ruleFormDiffers?.(shifted, { from: '□ = ○ × 3' })).toBe(true);
    const same = observe(play(CONFIG, write('□ = ○ × 3')));
    expect(predicates.ruleFormDiffers?.(same, { from: '□ = ○ × 3' })).toBe(false);
    expect(predicates.ruleFormDiffers?.(shifted, { from: '(' })).toBe(false);
    // allHit이 아니면 모양이 달라도 false
    const miss = observe(play(CONFIG, write('□ − 1 = ○ × 3')));
    expect(miss.allHit).toBe(false);
    expect(predicates.ruleFormDiffers?.(miss, { from: '□ = ○ × 3' })).toBe(false);
  });
  it('laser-fired 이벤트: 읽힌 식과 읽히지 않는 식', () => {
    const start = createInitialState(CONFIG);
    const fire: FunctionAction = { type: 'fire' };
    const ok = reduceAll(start, typed('□=○+2'));
    const fired = reduce(ok, fire);
    expect(emit(ok, fired, fire)).toEqual([
      { name: 'laser-fired', payload: { valid: true, hitCount: 1, allHit: false } },
    ]);
    const bad = reduceAll(start, typed('+3'));
    const badFired = reduce(bad, fire);
    expect(emit(bad, badFired, fire)).toEqual([
      { name: 'laser-fired', payload: { valid: false, hitCount: 0, allHit: false } },
    ]);
    expect(emit(fired, fired, fire)).toEqual([]);
    expect(definition.events).toContain('laser-fired');
    expect(definition.modes).toContain('rule-shooter');
  });
  it('기존 모드의 ruleFormDiffers는 matchesHidden 기준 그대로다', () => {
    const o = observe(
      play({ mode: 'black-box', rule: '□ = ○ × 3' }, [...typed('□=○×3'), { type: 'test-rule' }]),
    );
    expect(predicates.ruleFormDiffers?.(o, { from: '□ = ○ × 3' })).toBe(false);
    expect(predicates.ruleFormDiffers?.(o, { from: '□ = 3 × ○' })).toBe(true);
  });
});
