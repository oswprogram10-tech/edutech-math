/** E16 relation-check 단위 테스트: 오개념 네 개의 참·거짓 경계, 빈칸 정답, 열·표시. */
import { describe, expect, it } from 'vitest';
import { Rational } from '../../../core/math';
import {
  blankStatus,
  columnsOf,
  detectMisconceptions,
  hiddenOf,
  judge,
  pairsOf,
  visibleMarks,
} from '../relation-check';
import { createInitialState, reduce } from '../reduce';
import type { FunctionAction, FunctionConfig, FunctionState } from '../types';

function apply(config: FunctionConfig, actions: readonly FunctionAction[]): FunctionState {
  return actions.reduce<FunctionState>(
    (state, action) => reduce(state, action),
    createInitialState(config),
  );
}

const X3: FunctionConfig = { mode: 'black-box', rule: '□ = ○ × 3' };

function insert(x: string): FunctionAction[] {
  return [
    ...[...x].map((key): FunctionAction => ({ type: 'type', target: 'input', key })),
    { type: 'insert-input' },
  ];
}

function typeRule(text: string): FunctionAction[] {
  return [
    { type: 'clear', target: 'rule' },
    ...[...text].map((key): FunctionAction => ({ type: 'type', target: 'rule', key })),
    { type: 'test-rule' },
  ];
}

function misconceptions(state: FunctionState): string[] {
  return judge(state).misconceptions;
}

const THREE = [...insert('1'), ...insert('2'), ...insert('5')];

describe('MC-PATTERN-ONE-PAIR', () => {
  it('성립하는 쌍이 있고 전부는 아니면 참', () => {
    expect(misconceptions(apply(X3, [...THREE, ...typeRule('□ = ○ + 2')]))).toContain(
      'MC-PATTERN-ONE-PAIR',
    );
  });
  it('쌍이 1개뿐이면 거짓', () => {
    expect(misconceptions(apply(X3, [...insert('1'), ...typeRule('□ = ○ + 2')]))).toEqual([]);
  });
  it('전부 성립하면 거짓', () => {
    expect(misconceptions(apply(X3, [...THREE, ...typeRule('□ = ○ × 3')]))).toEqual([]);
  });
  it('하나도 성립하지 않으면 거짓', () => {
    expect(misconceptions(apply(X3, [...THREE, ...typeRule('□ = ○ + 9')]))).not.toContain(
      'MC-PATTERN-ONE-PAIR',
    );
  });
});

describe('MC-CORR-SWAP-VARS', () => {
  it('○와 □를 바꾼 식이 모두 성립하면 참', () => {
    expect(misconceptions(apply(X3, [...THREE, ...typeRule('○ = □ × 3')]))).toContain(
      'MC-CORR-SWAP-VARS',
    );
  });
  it('holdsAll이면 거짓', () => {
    expect(misconceptions(apply(X3, [...THREE, ...typeRule('□ = ○ × 3')]))).not.toContain(
      'MC-CORR-SWAP-VARS',
    );
  });
  it('쌍이 1개뿐이면 거짓', () => {
    expect(misconceptions(apply(X3, [...insert('1'), ...typeRule('○ = □ × 3')]))).not.toContain(
      'MC-CORR-SWAP-VARS',
    );
  });
});

describe('MC-PATTERN-RECURSIVE-ONLY', () => {
  it('□ = □ + 4(□만 있는 식)는 참', () => {
    expect(misconceptions(apply(X3, [...THREE, ...typeRule('□ = □ + 4')]))).toContain(
      'MC-PATTERN-RECURSIVE-ONLY',
    );
  });
  it('+4처럼 =가 없고 +·−로 시작하면 참', () => {
    expect(misconceptions(apply(X3, [...THREE, ...typeRule('+4')]))).toEqual([
      'MC-PATTERN-RECURSIVE-ONLY',
    ]);
    expect(misconceptions(apply(X3, [...THREE, ...typeRule('−4')]))).toEqual([
      'MC-PATTERN-RECURSIVE-ONLY',
    ]);
  });
  it('=가 있으면 거짓, 숫자로 시작하면 거짓', () => {
    expect(misconceptions(apply(X3, [...THREE, ...typeRule('+4 =')]))).toEqual([]);
    expect(misconceptions(apply(X3, [...THREE, ...typeRule('4+')]))).toEqual([]);
  });
});

describe('MC-FUNC-ADD-ONLY', () => {
  it('숨은 규칙이 곱셈이고 덧셈식을 두 번 시험하면 참', () => {
    const state = apply(X3, [...THREE, ...typeRule('□ = ○ + 2'), ...typeRule('□ = ○ + 3')]);
    expect(misconceptions(state)).toContain('MC-FUNC-ADD-ONLY');
  });
  it('식 하나만 시험했으면 거짓', () => {
    expect(misconceptions(apply(X3, [...THREE, ...typeRule('□ = ○ + 2')]))).not.toContain(
      'MC-FUNC-ADD-ONLY',
    );
  });
  it('같은 식을 두 번 시험해도 한 번으로 센다', () => {
    const state = apply(X3, [...THREE, ...typeRule('□ = ○ + 2'), ...typeRule('□ = ○ + 2')]);
    expect(misconceptions(state)).not.toContain('MC-FUNC-ADD-ONLY');
  });
  it('숨은 규칙이 덧셈(○의 계수 1)이면 거짓', () => {
    const state = apply({ mode: 'black-box', rule: '□ = ○ + 4' }, [
      ...THREE,
      ...typeRule('□ = ○ + 2'),
      ...typeRule('□ = ○ + 3'),
    ]);
    expect(misconceptions(state)).not.toContain('MC-FUNC-ADD-ONLY');
  });
  it('마지막 두 식 가운데 하나가 곱셈식이면 거짓', () => {
    const state = apply(X3, [...THREE, ...typeRule('□ = ○ + 2'), ...typeRule('□ = ○ × 2')]);
    expect(misconceptions(state)).not.toContain('MC-FUNC-ADD-ONLY');
  });
});

describe('detectMisconceptions 직접 호출', () => {
  it('시험한 식이 없으면 빈 목록', () => {
    expect(
      detectMisconceptions({
        tested: null,
        hidden: hiddenOf('□ = ○ × 3'),
        pairs: [],
        ruleHistory: [],
      }),
    ).toEqual([]);
  });
});

describe('judge: holdsAll·matchesHidden', () => {
  it('□ = ○ × 3과 ○ × 3 = □는 모두 숨은 규칙과 같다', () => {
    const a = judge(apply(X3, [...THREE, ...typeRule('□ = ○ × 3')]));
    const b = judge(apply(X3, [...THREE, ...typeRule('○ × 3 = □')]));
    expect(a.holdsAll && a.matchesHidden).toBe(true);
    expect(b.holdsAll && b.matchesHidden).toBe(true);
  });
  it('쌍 둘에는 맞지만 숨은 규칙과 다른 식은 holdsAll이어도 matchesHidden이 아니다', () => {
    const pairsTwo = [...insert('1'), ...insert('2')];
    const same = judge(apply(X3, [...pairsTwo, ...typeRule('□ = ○ + 2 × ○')]));
    expect(same.holdsAll).toBe(true);
    expect(same.matchesHidden).toBe(true);
    // ○ = 1에서 3, ○ = 2에서 6이라 두 쌍에는 맞지만 ○ = 3부터 달라진다.
    const wrong = judge(apply(X3, [...pairsTwo, ...typeRule('□ = ○ × ○ + 2')]));
    expect(wrong.holdsAll).toBe(true);
    expect(wrong.matchesHidden).toBe(false);
  });
  it('□에 비선형인 식은 matchesHidden이 false', () => {
    const j = judge(apply(X3, [...THREE, ...typeRule('□ × □ = ○')]));
    expect(j.matchesHidden).toBe(false);
  });
  it('쌍이 하나뿐이면 holdsAll이 아니다', () => {
    const j = judge(apply(X3, [...insert('4'), ...typeRule('□ = ○ × 3')]));
    expect(j.holdsAll).toBe(false);
    expect(j.holdsCount).toBe(1);
  });
});

describe('빈칸 정답', () => {
  const table = (rows: { x: string | null; y: string | null }[], rule = '□ = ○ × 3') =>
    ({ mode: 'table', rule, rows }) as FunctionConfig;

  it('□ 빈칸은 solveBox, ○ 빈칸은 domain 정수 역산', () => {
    const config = table([
      { x: '2', y: null },
      { x: null, y: '12' },
    ]);
    let state = apply(config, [
      { type: 'activate', cell: '0.y' },
      { type: 'type', target: 'input', key: '6' },
      { type: 'activate', cell: '1.x' },
      { type: 'type', target: 'input', key: '4' },
    ]);
    expect(blankStatus(state)).toEqual({ total: 2, filled: 2, correct: 2 });
    state = reduce(state, { type: 'backspace', target: 'input' });
    state = reduce(state, { type: 'type', target: 'input', key: '5' });
    expect(blankStatus(state).correct).toBe(1);
  });

  it('분수 결과 □ 빈칸 (□ = ○ ÷ 2, ○ = 1 → 1/2)', () => {
    const config = table([{ x: '1', y: null }], '□ = ○ ÷ 2');
    const keys = ['1', '/', '2'];
    const state = apply(config, [
      { type: 'activate', cell: '0.y' },
      ...keys.map((key): FunctionAction => ({ type: 'type', target: 'input', key })),
    ]);
    expect(columnsOf(state)[0]?.y.value).toBe('1/2');
    expect(blankStatus(state).correct).toBe(1);
    const wrong = apply(config, [
      { type: 'activate', cell: '0.y' },
      { type: 'type', target: 'input', key: '1' },
    ]);
    expect(blankStatus(wrong).correct).toBe(0);
  });

  it('○ 빈칸 정답이 domain 밖이면 틀린 것으로 센다', () => {
    const config = { ...table([{ x: null, y: '12' }]), domain: [0, 3] } as FunctionConfig;
    // domain [0,3]에는 3×○ = 12인 ○가 없으므로 설정 오류
    expect(createInitialState(config).settings.error).toBe('blank-x');
  });

  it('covary: 지나지 않은 빈칸 줄도 빈칸으로 센다', () => {
    const config: FunctionConfig = {
      mode: 'covary',
      scene: 'chairs-legs',
      x: { min: 1, max: 6 },
      blankRows: [5],
    };
    const start = createInitialState(config);
    expect(blankStatus(start)).toEqual({ total: 1, filled: 0, correct: 0 });
    const state = apply(config, [
      { type: 'set-x', x: '5' },
      { type: 'type', target: 'input', key: '2' },
      { type: 'type', target: 'input', key: '0' },
    ]);
    expect(blankStatus(state)).toEqual({ total: 1, filled: 1, correct: 1 });
  });
});

describe('열과 표시', () => {
  it('pairsOf는 빈칸이 있는 열을 제외한다', () => {
    const state = apply(
      {
        mode: 'table',
        rows: [
          { x: '1', y: '3' },
          { x: '2', y: null },
        ],
      },
      [],
    );
    expect(pairsOf(columnsOf(state))).toHaveLength(1);
  });
  it('식을 고치면 표시가 사라진다', () => {
    const tested = apply(X3, [...THREE, ...typeRule('□ = ○ × 3')]);
    expect(visibleMarks(tested, columnsOf(tested))).toEqual([true, true, true]);
    const edited = reduce(tested, { type: 'backspace', target: 'rule' });
    expect(visibleMarks(edited, columnsOf(edited))).toBeNull();
  });
  it('□ = ○ ÷ 2처럼 분수 결과는 표에 분수 문자열로 쌓인다', () => {
    const state = apply({ mode: 'black-box', rule: '□ = ○ ÷ 2' }, insert('1'));
    expect(state.mode === 'black-box' && state.trials).toEqual([['1', '1/2']]);
    expect(pairsOf(columnsOf(state))[0]?.[1].equals(Rational.of(1, 2))).toBe(true);
  });
});
