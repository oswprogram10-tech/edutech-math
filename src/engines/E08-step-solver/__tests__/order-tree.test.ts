import { describe, expect, it } from 'vitest';
import { emit, predicates } from '../events';
import { observe } from '../observe';
import {
  buildTree,
  currentTree,
  findBin,
  isTappable,
  pressedValue,
  promisedValue,
  remainingOps,
} from '../order-tree';
import { createInitialState, reduce } from '../reduce';
import type { OrderTreeState, StepSolverAction } from '../types';

function start(expr: string, showTree = true): OrderTreeState {
  const state = createInitialState({ mode: 'order-tree', expr, showTree });
  if (state.mode !== 'order-tree') throw new Error('order-tree 상태가 아닙니다.');
  return state;
}

function play(state: OrderTreeState, ...taps: number[]): OrderTreeState {
  let current = state;
  for (const opIndex of taps) {
    const next = reduce(current, { type: 'tap', opIndex });
    if (next.mode !== 'order-tree') throw new Error('mode 변경');
    current = next;
  }
  return current;
}

function tappable(expr: string): number[] {
  const tree = buildTree(expr);
  return remainingOps(tree).filter((idx) => {
    const node = findBin(tree, idx);
    return node !== undefined && isTappable(node);
  });
}

describe('order-tree 누를 수 있는 연산', () => {
  it('명세 과제 네 식', () => {
    expect(tappable('24 − 6 × 3 + 8 ÷ 2')).toEqual([1, 3]);
    expect(tappable('48 ÷ 6 × 2')).toEqual([0]);
    expect(tappable('7 + 3 × (12 − 8) ÷ 2')).toEqual([2]);
    expect(tappable('(15 + 9) ÷ 4 − 2')).toEqual([0]);
  });

  it('괄호는 안이 수 하나가 되면 벗겨진다', () => {
    const state = play(start('(15 + 9) ÷ 4 − 2'), 0);
    expect(observe(state)).toMatchObject({ current: '24 ÷ 4 − 2' });
    expect(remainingOps(currentTree(state))).toEqual([1, 2]);
  });

  it('겹괄호와 수 하나 괄호도 벗긴다', () => {
    expect(observe(start('((1 + 2)) × (3)'))).toMatchObject({ current: '(1 + 2) × 3' });
  });
});

describe('order-tree 계산 순서와 끝값', () => {
  it('7 + 3 × (12 − 8) ÷ 2 = 13', () => {
    const state = play(start('7 + 3 × (12 − 8) ÷ 2'), 2, 1, 3, 0);
    expect(observe(state)).toMatchObject({
      done: true,
      finalValue: '13',
      reductionOrder: [2, 1, 3, 0],
      wrongTapCount: 0,
      misconceptions: [],
    });
  });

  it('(15 + 9) ÷ 4 − 2 = 4', () => {
    const state = play(start('(15 + 9) ÷ 4 − 2'), 0, 1, 2);
    expect(observe(state)).toMatchObject({ done: true, finalValue: '4' });
  });

  it('식이 끝나기 전에는 finalValue가 null이고 current에 끝값이 없다', () => {
    const state = start('36 − 4 × 5');
    expect(observe(state)).toMatchObject({
      done: false,
      finalValue: null,
      current: '36 − 4 × 5',
    });
    const mid = play(state, 1);
    expect(observe(mid)).toMatchObject({ done: false, finalValue: null, current: '36 − 20' });
  });

  it('계산 기록의 값은 Rational 문자열이다', () => {
    const state = play(start('36 − 4 × 5'), 1, 0);
    expect(state.reductions).toEqual([
      { opIndex: 1, op: '×', left: '4', right: '5', result: '20' },
      { opIndex: 0, op: '−', left: '36', right: '20', result: '16' },
    ]);
  });

  it('큰 수도 정확하게 계산한다', () => {
    const state = play(start('999999999 × 999999999 + 1'), 0, 1);
    expect(observe(state)).toMatchObject({ finalValue: '999999998000000002' });
  });

  it('같은 단계 + −는 왼쪽부터가 약속이다(오른쪽을 먼저 누르면 코드 없는 틀린 누름)', () => {
    const wrong = play(start('10 − 3 + 2'), 1);
    expect(wrong.reductions).toEqual([]);
    expect(wrong.wrongTaps).toEqual([{ opIndex: 1, code: null }]);
    expect(observe(wrong)).toMatchObject({ wrongTapCount: 1, misconceptions: [] });
  });
});

describe('order-tree 틀린 누름', () => {
  it('+ − 를 누르는데 × ÷ 가 남았으면 MC-ORDER-LEFT-TO-RIGHT', () => {
    const state = play(start('36 − 4 × 5'), 0);
    expect(state.reductions).toEqual([]);
    expect(state.wrongTaps).toEqual([{ opIndex: 0, code: 'MC-ORDER-LEFT-TO-RIGHT' }]);
    expect(state.shake).toEqual({ opIndex: 0, seq: 1 });
  });

  it('왼쪽에 ÷ 가 남은 × 를 누르면 MC-ORDER-MUL-BEFORE-DIV', () => {
    const state = play(start('48 ÷ 6 × 2'), 1);
    expect(state.wrongTaps).toEqual([{ opIndex: 1, code: 'MC-ORDER-MUL-BEFORE-DIV' }]);
  });

  it('괄호 밖을 누르면 MC-ORDER-PAREN-IGNORED(위 규칙보다 먼저 본다)', () => {
    const state = play(start('(15 + 9) ÷ 4 − 2'), 1, 2);
    expect(state.wrongTaps).toEqual([
      { opIndex: 1, code: 'MC-ORDER-PAREN-IGNORED' },
      { opIndex: 2, code: 'MC-ORDER-PAREN-IGNORED' },
    ]);
    expect(state.shake).toEqual({ opIndex: 2, seq: 2 });
  });

  it('틀린 누름은 식을 바꾸지 않는다', () => {
    const before = start('7 + 3 × (12 − 8) ÷ 2');
    const after = play(before, 0);
    expect(after.reductions).toEqual(before.reductions);
    expect(observe(after)).toMatchObject({ current: '7 + 3 × (12 − 8) ÷ 2' });
  });

  it('이미 계산한 연산이나 없는 번호를 누르면 상태가 그대로다', () => {
    const state = play(start('36 − 4 × 5'), 1);
    expect(reduce(state, { type: 'tap', opIndex: 1 })).toBe(state);
    expect(reduce(state, { type: 'tap', opIndex: 9 })).toBe(state);
  });

  it('오개념 목록은 중복 없이 남고 undo·reset으로 지워지지 않는다', () => {
    let state = play(start('36 − 4 × 5 + 2 × 3'), 0, 2, 1);
    expect(observe(state)['misconceptions']).toEqual(['MC-ORDER-LEFT-TO-RIGHT']);
    state = reduce(state, { type: 'undo' }) as OrderTreeState;
    state = reduce(state, { type: 'reset' }) as OrderTreeState;
    expect(observe(state)).toMatchObject({
      wrongTapCount: 2,
      misconceptions: ['MC-ORDER-LEFT-TO-RIGHT'],
    });
  });
});

describe('order-tree undo·reset', () => {
  it('undo는 마지막 계산을 되돌리고 틀린 누름 기록은 남긴다', () => {
    const state = play(start('36 − 4 × 5'), 0, 1);
    expect(state.shake).toBeNull();
    const undone = reduce(state, { type: 'undo' }) as OrderTreeState;
    expect(undone.reductions).toHaveLength(0);
    expect(undone.wrongTaps).toHaveLength(1);
    expect(observe(undone)).toMatchObject({ current: '36 − 4 × 5' });
  });

  it('undo·reset은 할 일이 없으면 같은 상태를 돌려준다', () => {
    const state = start('36 − 4 × 5');
    expect(reduce(state, { type: 'undo' })).toBe(state);
    expect(reduce(state, { type: 'reset' })).toBe(state);
  });

  it('reset은 계산을 모두 지운다', () => {
    const state = play(start('36 − 4 × 5'), 1, 0);
    const reset = reduce(state, { type: 'reset' }) as OrderTreeState;
    expect(reset.reductions).toEqual([]);
    expect(observe(reset)).toMatchObject({ done: false, finalValue: null });
  });

  it('다른 모드의 Action은 무시한다', () => {
    const state = start('36 − 4 × 5');
    expect(reduce(state, { type: 'add-line' })).toBe(state);
  });
});

describe('order-tree 설정 오류', () => {
  const bad = (expr: string): void => {
    expect(() => createInitialState({ mode: 'order-tree', expr })).toThrow();
  };

  it('□·분수·소수·비는 설정 오류다', () => {
    bad('□ + 3');
    bad('1/2 + 3');
    bad('1.5 + 3');
    bad('3 : 4');
  });

  it('연산이 없거나 읽을 수 없는 식은 설정 오류다', () => {
    bad('5');
    bad('(5)');
    bad('');
    bad('3 +');
  });

  it('0으로 나누는 단계가 있으면 설정 오류다', () => {
    bad('5 ÷ (3 − 3)');
    bad('5 ÷ 0');
  });

  it('음수·분수가 되는 단계도 설정 오류다', () => {
    bad('3 − 5');
    bad('7 ÷ 2');
  });

  it('expr를 생략하면 기본 식으로 시작한다', () => {
    const state = createInitialState({ mode: 'order-tree' });
    expect(state.mode).toBe('order-tree');
  });
});

describe('order-tree 직렬화·판정', () => {
  it('상태는 JSON으로 왕복해도 같다', () => {
    const state = play(start('7 + 3 × (12 − 8) ÷ 2'), 0, 2, 1);
    const copy = JSON.parse(JSON.stringify(state)) as OrderTreeState;
    expect(copy).toEqual(state);
    expect(observe(copy)).toEqual(observe(state));
    expect(reduce(copy, { type: 'tap', opIndex: 3 })).toEqual(
      reduce(state, { type: 'tap', opIndex: 3 }),
    );
  });

  it('같은 Action 목록은 같은 상태를 재생한다', () => {
    const actions: StepSolverAction[] = [
      { type: 'tap', opIndex: 0 },
      { type: 'tap', opIndex: 1 },
      { type: 'undo' },
      { type: 'tap', opIndex: 1 },
    ];
    const run = () =>
      actions.reduce<OrderTreeState>((s, a) => reduce(s, a) as OrderTreeState, start('36 − 4 × 5'));
    expect(run()).toEqual(run());
  });

  it('predicate', () => {
    const done = play(start('7 + 3 × (12 − 8) ÷ 2'), 2, 1, 3, 0);
    const observation = observe(done);
    const p = predicates;
    expect(p['firstReductionIs']?.(observation, { opIndex: 2 })).toBe(true);
    expect(p['firstReductionIs']?.(observation, { opIndex: 1 })).toBe(false);
    expect(p['reductionOrderIs']?.(observation, { order: [2, 1, 3, 0] })).toBe(true);
    expect(p['reductionOrderIs']?.(observation, { order: [2, 1, 3] })).toBe(false);
    expect(p['done']?.(observation, undefined)).toBe(true);
    expect(p['finalValueIs']?.(observation, { value: '13' })).toBe(true);
    expect(p['finalValueIs']?.(observation, { value: '12' })).toBe(false);
    expect(p['wrongTapsAtMost']?.(observation, { n: 0 })).toBe(true);

    const wrong = observe(play(start('36 − 4 × 5'), 0));
    expect(p['wrongTapsAtMost']?.(wrong, { n: 0 })).toBe(false);
    expect(p['wrongTapsAtMost']?.(wrong, { n: 1 })).toBe(true);
    expect(p['hasMisconception']?.(wrong, { code: 'MC-ORDER-LEFT-TO-RIGHT' })).toBe(true);
    expect(p['hasMisconception']?.(wrong, { code: 'MC-ORDER-PAREN-IGNORED' })).toBe(false);
    expect(p['done']?.(wrong, undefined)).toBe(false);
  });

  it('이벤트 reduced·wrong-tap', () => {
    const before = start('36 − 4 × 5');
    const wrong = reduce(before, { type: 'tap', opIndex: 0 });
    expect(emit(before, wrong, { type: 'tap', opIndex: 0 })).toEqual([
      { name: 'wrong-tap', payload: { opIndex: 0, code: 'MC-ORDER-LEFT-TO-RIGHT' } },
    ]);
    const right = reduce(before, { type: 'tap', opIndex: 1 });
    expect(emit(before, right, { type: 'tap', opIndex: 1 })).toEqual([
      { name: 'reduced', payload: { opIndex: 1, result: '20' } },
    ]);
  });
});

describe('order-tree 두 줄 비교 값', () => {
  it('36 − 4 × 5에서 −를 먼저 누르면 160, 약속은 16', () => {
    const tree = buildTree('36 − 4 × 5');
    expect(pressedValue(tree, 0)?.toString()).toBe('160');
    expect(promisedValue(tree).toString()).toBe('16');
  });

  it('48 ÷ 6 × 2에서 ×를 먼저 누르면 4, 약속은 16', () => {
    const tree = buildTree('48 ÷ 6 × 2');
    expect(pressedValue(tree, 1)?.toString()).toBe('4');
    expect(promisedValue(tree).toString()).toBe('16');
  });
});
