/** E17 secret-rule predict 변형 reduce·observe·events·predicates 단위 테스트(T217). */
import { describe, expect, it } from 'vitest';
import { assertSerializable } from '../../../core/engine-sdk';
import type { JsonValue, Observation } from '../../../core/engine-sdk';
import { deckDefinition } from '../decks';
import { emit, predicates } from '../events';
import { observe } from '../observe';
import { createInitialState, reduce } from '../reduce';
import { currentOf, matchesRule } from '../secret-rule-predict/reduce';
import type { PredictState } from '../secret-rule-predict/types';
import type { SorterAction, SorterConfig, SorterState } from '../types';

const OPTIONS = [
  { attribute: 'color', value: 'red' },
  { attribute: 'color', value: 'blue' },
  { attribute: 'color', value: 'yellow' },
  { attribute: 'shape', value: 'circle' },
  { attribute: 'holes', value: 4 },
];

function config(overrides: Record<string, unknown> = {}): SorterConfig {
  return {
    mode: 'secret-rule',
    variant: 'predict',
    deck: 'buttons-12',
    rule: { attribute: 'color', value: 'yellow' },
    guessOptions: OPTIONS,
    seed: 3,
    ...overrides,
  } as SorterConfig;
}

function make(overrides: Record<string, unknown> = {}): PredictState {
  const state = createInitialState(config(overrides));
  if (state.mode !== 'predict') throw new Error('predict 상태가 아니다');
  return state;
}

function run(state: SorterState, actions: readonly SorterAction[]): PredictState {
  const next = actions.reduce<SorterState>((now, action) => reduce(now, action), state);
  if (next.mode !== 'predict') throw new Error('predict 상태가 아니다');
  return next;
}

function seen(state: SorterState): Observation {
  return observe(state);
}

function holds(name: string, observation: Observation, args?: JsonValue): boolean {
  const fn = predicates[name];
  if (!fn) throw new Error(`predicate ${name} 없음`);
  return fn(observation, args);
}

const CARDS = deckDefinition('buttons-12').cards;

/** 지금 새 카드의 진짜 상자(테스트가 기준을 알고 있다). */
function truthOf(state: PredictState): 'yes' | 'no' {
  const id = currentOf(state);
  const card = CARDS.find((candidate) => candidate.id === id);
  if (!card) throw new Error('새 카드 없음');
  return matchesRule(card, state.settings.rule) ? 'yes' : 'no';
}

function right(state: PredictState): PredictAction {
  return { type: 'predict', bin: truthOf(state) };
}
function wrong(state: PredictState): PredictAction {
  return { type: 'predict', bin: truthOf(state) === 'yes' ? 'no' : 'yes' };
}
type PredictAction = Extract<SorterAction, { type: 'predict' }>;

/** 매 걸음 지금 새 카드의 진짜 상자를 보고 맞게(r)·틀리게(w) 예측한다. */
function play(state: PredictState, steps: string): PredictState {
  let now = state;
  for (const step of steps) now = run(now, [step === 'r' ? right(now) : wrong(now)]);
  return now;
}

describe('predict 예시', () => {
  it('기본 4장이고 예·아니요가 하나 이상씩 있다(seed 1~40)', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      for (const rule of [
        { attribute: 'color', value: 'yellow' },
        { attribute: 'holes', value: 4 },
        { attribute: 'shape', value: 'triangle' },
      ]) {
        const state = make({
          seed,
          rule,
          guessOptions: [...OPTIONS, { attribute: 'shape', value: 'triangle' }].slice(0, 6),
        });
        expect(state.examples).toHaveLength(4);
        const bins = new Set(state.examples.map((id) => state.binOf[id]));
        expect(bins, `seed ${seed} ${rule.attribute}`).toEqual(new Set(['yes', 'no']));
      }
    }
  });

  it('shownExamples를 따르고, 같은 seed는 같은 순서이며 seed가 다르면 순서가 달라질 수 있다', () => {
    const a = make({ seed: 5, shownExamples: 6 });
    const b = make({ seed: 5, shownExamples: 6 });
    expect(a.examples).toHaveLength(6);
    expect(a.examples).toEqual(b.examples);
    expect(a.queue).toHaveLength(6);
    const orders = new Set(
      Array.from({ length: 12 }, (_, seed) => make({ seed: seed + 1 }).examples.join(',')),
    );
    expect(orders.size).toBeGreaterThan(1);
  });

  it('새 카드는 예시가 아닌 카드이고, 예시는 맞는 상자에 들어 있다', () => {
    const state = make();
    const id = currentOf(state);
    expect(id).not.toBeNull();
    expect(state.examples).not.toContain(id);
    for (const example of state.examples) {
      const card = CARDS.find((candidate) => candidate.id === example);
      expect(card).toBeDefined();
      if (!card) continue;
      expect(state.binOf[example]).toBe(matchesRule(card, state.settings.rule) ? 'yes' : 'no');
    }
  });

  it('기준이 거의 모든 카드와 같아도(예 2장뿐) 예시에 둘 다 들어간다', () => {
    const state = make({
      rule: { attribute: 'color', value: 'yellow' },
      shownExamples: 2,
      seed: 7,
    });
    expect(new Set(state.examples.map((id) => state.binOf[id])).size).toBe(2);
  });
});

describe('predict 예측과 streak', () => {
  it('맞히면 streak·correctPredictions가 오르고 카드가 실제 상자로 옮겨진다', () => {
    const state = make();
    const id = currentOf(state);
    const truth = truthOf(state);
    const next = run(state, [right(state)]);
    expect(next.streak).toBe(1);
    expect(next.predictions).toBe(1);
    expect(next.correctPredictions).toBe(1);
    expect(next.lastResult).toBe('right');
    expect(id && next.binOf[id]).toBe(truth);
    expect(currentOf(next)).not.toBe(id);
  });

  it('틀려도 카드는 실제 상자로 옮겨지고 streak은 0이 된다', () => {
    const state = make();
    const id = currentOf(state);
    const truth = truthOf(state);
    const next = run(state, [wrong(state)]);
    expect(next.streak).toBe(0);
    expect(next.predictions).toBe(1);
    expect(next.correctPredictions).toBe(0);
    expect(next.lastResult).toBe('wrong');
    expect(id && next.binOf[id]).toBe(truth);
  });

  it('연속 3번 맞히면 기준 고르기가 열리고(unlocked), 2번만으로는 열리지 않는다', () => {
    let state = make();
    for (let step = 0; step < 2; step += 1) state = run(state, [right(state)]);
    expect(state.unlocked).toBe(false);
    expect(seen(state)['unlocked']).toBe(false);
    state = run(state, [right(state)]);
    expect(state.unlocked).toBe(true);
    expect(holds('streakAtLeast', seen(state), { n: 3 })).toBe(true);
    expect(holds('streakAtLeast', seen(state), { n: 4 })).toBe(false);
  });

  it('틀리면 연속이 끊겨 다시 처음부터 센다', () => {
    let state = make();
    state = play(state, 'rrwrr');
    expect(state.streak).toBe(2);
    expect(state.unlocked).toBe(false);
    state = run(state, [right(state)]);
    expect(state.unlocked).toBe(true);
  });

  it('predictionsToGuess를 1로 하면 한 번 맞히면 열린다', () => {
    const state = make({ predictionsToGuess: 1 });
    expect(run(state, [right(state)]).unlocked).toBe(true);
  });

  it('카드가 다 떨어지면 예시가 아닌 카드를 seed 순서로 다시 낸다', () => {
    let state = make({ shownExamples: 4 });
    const cycle: (string | null)[] = [];
    for (let step = 0; step < 16; step += 1) {
      cycle.push(currentOf(state));
      state = run(state, [right(state)]);
    }
    expect(cycle.slice(0, 8)).toEqual(state.queue);
    expect(cycle.slice(8, 16)).toEqual(state.queue);
    // 예시 카드는 새 카드로 나오지 않는다.
    expect(cycle.some((id) => id !== null && state.examples.includes(id))).toBe(false);
    // 다시 나온 카드는 상자에서 꺼내져 있다(새 카드가 동시에 상자에 있지 않다).
    const current = currentOf(state);
    expect(current && state.binOf[current]).toBeUndefined();
  });
});

describe('predict 기준 맞히기', () => {
  function unlocked(): PredictState {
    let state = make();
    for (let step = 0; step < 3; step += 1) state = run(state, [right(state)]);
    return state;
  }

  it('열리기 전의 guess는 무시한다', () => {
    const state = make();
    expect(reduce(state, { type: 'guess', attribute: 'color', value: 'yellow' })).toBe(state);
  });

  it('맞는 기준을 고르면 guessedRight, 시도 수 1', () => {
    const state = run(unlocked(), [{ type: 'guess', attribute: 'color', value: 'yellow' }]);
    expect(state.guessedRight).toBe(true);
    expect(state.guesses).toBe(1);
    expect(holds('guessedRight', seen(state))).toBe(true);
    // 맞힌 뒤에는 예측이 더 늘지 않는다.
    expect(reduce(state, { type: 'predict', bin: 'yes' })).toBe(state);
  });

  it('틀린 기준을 고르면 streak 0, 다시 잠기고 예측을 이어 간다', () => {
    const base = unlocked();
    const state = run(base, [{ type: 'guess', attribute: 'color', value: 'blue' }]);
    expect(state.guessedRight).toBe(false);
    expect(state.guesses).toBe(1);
    expect(state.streak).toBe(0);
    expect(state.unlocked).toBe(false);
    expect(state.lastGuessWrong).toBe(true);
    expect(holds('guessedRight', seen(state))).toBe(false);
    expect(holds('streakAtLeast', seen(state), { n: 1 })).toBe(false);

    // 예측을 이어 가 3번 연속 맞히면 다시 열린다.
    let again: PredictState = state;
    for (let step = 0; step < 3; step += 1) again = run(again, [right(again)]);
    expect(again.unlocked).toBe(true);
    const done = run(again, [{ type: 'guess', attribute: 'color', value: 'yellow' }]);
    expect(done.guessedRight).toBe(true);
    expect(done.guesses).toBe(2);
  });

  it('guessOptions에 없는 기준은 무시한다', () => {
    const state = unlocked();
    expect(reduce(state, { type: 'guess', attribute: 'shape', value: 'triangle' })).toBe(state);
  });

  it('값이 숫자인 기준(구멍 4개)도 문자열과 같이 다룬다', () => {
    const base = make({ rule: { attribute: 'holes', value: 4 }, seed: 2 });
    let state: PredictState = base;
    for (let step = 0; step < 3; step += 1) state = run(state, [right(state)]);
    expect(run(state, [{ type: 'guess', attribute: 'holes', value: 4 }]).guessedRight).toBe(true);
    expect(run(state, [{ type: 'guess', attribute: 'holes', value: '4' }]).guessedRight).toBe(true);
  });

  it('reset은 streak·예측·잠금만 처음으로 돌리고 기준 시도 기록은 남긴다', () => {
    const state = run(unlocked(), [
      { type: 'guess', attribute: 'color', value: 'blue' },
      { type: 'reset' },
    ]);
    expect(state.streak).toBe(0);
    expect(state.predictions).toBe(0);
    expect(state.correctPredictions).toBe(0);
    expect(state.unlocked).toBe(false);
    expect(state.guesses).toBe(1);
    expect(state.examples).toEqual(make().examples);
  });
});

describe('predict 설정', () => {
  it.each<[string, Record<string, unknown>]>([
    ['rule이 guessOptions 밖', { rule: { attribute: 'shape', value: 'square' } }],
    ['guessOptions 1개', { guessOptions: [{ attribute: 'color', value: 'yellow' }] }],
    [
      'guessOptions 7개',
      {
        guessOptions: [
          ...OPTIONS,
          { attribute: 'shape', value: 'square' },
          { attribute: 'shape', value: 'triangle' },
        ],
      },
    ],
    ['rule 값이 묶음에 없음', { rule: { attribute: 'color', value: 'green' } }],
    ['guessOptions 없음', { guessOptions: undefined }],
    ['shownExamples 1', { shownExamples: 1 }],
    ['shownExamples 9', { shownExamples: 9 }],
    ['predictionsToGuess 0', { predictionsToGuess: 0 }],
    ['사물 묶음', { deck: 'classroom-objects-12' }],
  ])('설정 오류: %s', (_name, overrides) => {
    const state = make(overrides);
    expect(state.settings.error).not.toBeNull();
    expect(reduce(state, { type: 'predict', bin: 'yes' })).toBe(state);
  });

  it('올바른 설정은 오류가 없다', () => {
    expect(make().settings.error).toBeNull();
  });

  it('샌드박스처럼 기준을 안 준 설정은 기본 예(빨강)로 열린다', () => {
    const state = createInitialState({ mode: 'predict' } as SorterConfig);
    expect(state.mode).toBe('predict');
    expect(state.mode === 'predict' && state.settings.error).toBeNull();
  });

  it('mode가 predict이거나 variant가 predict이면 같은 변형이다', () => {
    const viaVariant = createInitialState({ variant: 'predict' } as SorterConfig);
    const viaMode = createInitialState({ mode: 'predict' } as SorterConfig);
    expect(viaVariant.mode).toBe('predict');
    expect(viaMode.mode).toBe('predict');
    // 기존 스무고개는 그대로다.
    expect(createInitialState({ mode: 'secret-rule', variant: 'twenty-questions' }).mode).toBe(
      'secret-rule',
    );
  });
});

describe('predict 관찰·직렬화·이벤트', () => {
  it('관찰 결과에 비밀 기준이 없다', () => {
    const state = make();
    const observation = seen(state);
    expect(observation['mode']).toBe('secret-rule');
    expect(observation['variant']).toBe('predict');
    expect(Object.keys(observation).sort()).toEqual(
      [
        'correctPredictions',
        'guessedRight',
        'guesses',
        'misconceptions',
        'mode',
        'predictions',
        'streak',
        'unlocked',
        'variant',
      ].sort(),
    );
    const text = JSON.stringify(observation);
    expect(text).not.toContain('yellow');
    expect(text).not.toContain('"rule"');
    expect(observation['misconceptions']).toEqual([]);
  });

  it('JSON 왕복 뒤에도 같은 결과', () => {
    let state = make();
    state = play(state, 'rw');
    assertSerializable(state);
    const copy = JSON.parse(JSON.stringify(state)) as SorterState;
    expect(copy).toEqual(state);
    expect(seen(copy)).toEqual(seen(state));
    expect(reduce(copy, { type: 'predict', bin: 'yes' })).toEqual(
      reduce(state, { type: 'predict', bin: 'yes' }),
    );
  });

  it('이벤트: 예측하면 predicted, 기준을 맞히면 rule-guessed', () => {
    const state = make();
    const action = right(state);
    const next = reduce(state, action);
    expect(emit(state, next, action)).toEqual([{ name: 'predicted', payload: { correct: true } }]);
    const missed = wrong(state);
    expect(emit(state, reduce(state, missed), missed)).toEqual([
      { name: 'predicted', payload: { correct: false } },
    ]);

    let open: PredictState = state;
    for (let step = 0; step < 3; step += 1) open = run(open, [right(open)]);
    const guess = { type: 'guess', attribute: 'color', value: 'yellow' } as const;
    expect(emit(open, reduce(open, guess), guess)).toEqual([
      { name: 'rule-guessed', payload: { correct: true } },
    ]);
    expect(emit(state, state, action)).toEqual([]);
  });
});
