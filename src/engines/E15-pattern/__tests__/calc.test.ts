/** E15 calc-pattern: calc.ts 순수 계산, reduce, observe, predicates, 오개념. */
import { describe, expect, it } from 'vitest';
import { assertSerializable } from '../../../core/engine-sdk';
import {
  exprParts,
  isPyramid,
  isRecursiveBuild,
  isRecursiveExpression,
  readExpression,
  repunit,
  stepColumns,
  stepExpression,
  stepTotal,
  trimHeights,
} from '../calc';
import { predicates } from '../events';
import { observe } from '../observe';
import { createInitialState, reduce } from '../reduce';
import type { CalcPatternConfig, CalcState, PatternAction, PatternState } from '../types';

function calc(state: PatternState): CalcState {
  if (state.mode !== 'calc-pattern') throw new Error('calc-pattern 상태가 아니다');
  return state;
}

function apply(config: CalcPatternConfig, actions: readonly PatternAction[]): CalcState {
  return calc(
    actions.reduce<PatternState>(
      (state, action) => reduce(state, action),
      createInitialState(config),
    ),
  );
}

function typeText(text: string): PatternAction[] {
  return [...text].map((key) => ({ type: 'type', key }));
}

/** 높이 목록을 tap-cell로 쌓는다(0은 건너뛴다). */
function stackAll(heights: readonly number[], offset = 0): PatternAction[] {
  return heights.flatMap((h, i) =>
    h > 0 ? [{ type: 'tap-cell' as const, col: i + offset, h }] : [],
  );
}

const SYM: CalcPatternConfig = { mode: 'calc-pattern', pattern: 'symmetric-sum-square' };
const SYM4: CalcPatternConfig = { ...SYM, stepsShown: 3, workStep: 4 };

describe('calc.ts 단계 계산', () => {
  it('stepColumns: n = 1·4·9', () => {
    expect(stepColumns(1)).toEqual([1]);
    expect(stepColumns(4)).toEqual([1, 2, 3, 4, 3, 2, 1]);
    const nine = stepColumns(9);
    expect(nine).toHaveLength(17);
    expect(nine[8]).toBe(9);
    expect(nine.reduce((a, b) => a + b, 0)).toBe(81);
  });

  it('stepTotal symmetric은 n × n', () => {
    expect(stepTotal('symmetric-sum-square', 1).toString()).toBe('1');
    expect(stepTotal('symmetric-sum-square', 4).toString()).toBe('16');
    expect(stepTotal('symmetric-sum-square', 9).toString()).toBe('81');
  });

  it('repunit 9단계 111111111² = 12345678987654321 (정확)', () => {
    expect(repunit(9).toString()).toBe('111111111');
    expect(stepTotal('repunit-square', 9).toString()).toBe('12345678987654321');
    expect(stepTotal('repunit-square', 1).toString()).toBe('1');
    expect(stepTotal('repunit-square', 4).toString()).toBe('1234321');
  });

  it('stepExpression', () => {
    expect(stepExpression('symmetric-sum-square', 1)).toBe('1 = 1 × 1');
    expect(stepExpression('symmetric-sum-square', 2)).toBe('1 + 2 + 1 = 2 × 2');
    expect(stepExpression('symmetric-sum-square', 4)).toBe('1 + 2 + 3 + 4 + 3 + 2 + 1 = 4 × 4');
    expect(stepExpression('repunit-square', 2)).toBe('11 × 11 = 121');
    expect(stepExpression('repunit-square', 9)).toBe('111111111 × 111111111 = 12345678987654321');
  });
});

describe('isPyramid·trimHeights', () => {
  it('앞뒤 0을 빼고 1…n…1과 같으면 참', () => {
    expect(isPyramid([1, 2, 3, 4, 3, 2, 1], 4)).toBe(true);
    expect(isPyramid([0, 0, 1, 2, 3, 4, 3, 2, 1, 0], 4)).toBe(true);
    expect(trimHeights([0, 1, 0, 2, 0])).toEqual([1, 0, 2]);
    expect(trimHeights([0, 0])).toEqual([]);
  });

  it('비대칭·높이 초과·가운데 빈 열·다른 단계는 거짓', () => {
    expect(isPyramid([1, 2, 3, 4, 3, 2], 4)).toBe(false);
    expect(isPyramid([1, 2, 3, 5, 3, 2, 1], 4)).toBe(false);
    expect(isPyramid([1, 2, 0, 4, 3, 2, 1], 4)).toBe(false);
    expect(isPyramid([1, 2, 3, 2, 1], 4)).toBe(false);
    expect(isPyramid([], 4)).toBe(false);
    expect(isPyramid([1], 0)).toBe(false);
  });
});

describe('readExpression', () => {
  it('1+2+3+4+3+2+1=4×4: addends·factors·holds', () => {
    const r = readExpression('1+2+3+4+3+2+1=4×4');
    expect(r.valid).toBe(true);
    expect(r.holds).toBe(true);
    expect(r.left).toBe('16');
    expect(r.right).toBe('16');
    expect(r.addends).toEqual(['1', '2', '3', '4', '3', '2', '1']);
    expect(r.factors).toEqual(['4', '4']);
  });

  it('16=4×4: 덧셈 항은 수 하나, 곱은 [4, 4]', () => {
    const r = readExpression('16=4×4');
    expect(r.holds).toBe(true);
    expect(r.addends).toEqual(['16']);
    expect(r.factors).toEqual(['4', '4']);
  });

  it('4×4=16: factors가 왼쪽에 있다', () => {
    const r = readExpression('4×4=16');
    expect(r.holds).toBe(true);
    expect(r.factors).toEqual(['4', '4']);
    expect(r.addends).toEqual(['16']);
  });

  it('1=1은 성립하고 factors 없음', () => {
    const r = readExpression('1=1');
    expect(r.valid).toBe(true);
    expect(r.holds).toBe(true);
    expect(r.factors).toBeNull();
    expect(r.addends).toEqual(['1']);
  });

  it('성립하지 않는 식은 valid지만 holds가 거짓이다', () => {
    const r = readExpression('1+2+1=3×3');
    expect(r.valid).toBe(true);
    expect(r.holds).toBe(false);
    expect(r.left).toBe('4');
    expect(r.right).toBe('9');
  });

  it('덧셈 변이 두 수 이상인 쪽을 먼저 본다', () => {
    expect(readExpression('16=1+2+13').addends).toEqual(['1', '2', '13']);
  });

  it('○·□가 있으면 무효', () => {
    expect(readExpression('○+1=□').valid).toBe(false);
    expect(readExpression('□=3').valid).toBe(false);
  });

  it('빈 문자열·= 없음·0으로 나누기는 무효이고 throw하지 않는다', () => {
    expect(readExpression('').valid).toBe(false);
    expect(readExpression('   ').valid).toBe(false);
    const open = readExpression('1+2');
    expect(open.valid).toBe(false);
    expect(open.errorAt).toBe(3);
    expect(readExpression('1+=2').valid).toBe(false);
    expect(readExpression('4÷0=1').valid).toBe(false);
  });

  it('큰 수도 정확하다', () => {
    const r = readExpression('111111111×111111111=12345678987654321');
    expect(r.holds).toBe(true);
    expect(r.left).toBe('12345678987654321');
    expect(r.factors).toEqual(['111111111', '111111111']);
  });
});

describe('exprParts', () => {
  it('연산 기호 둘레를 띄운다', () => {
    const text = exprParts('1+2=3', null, true)
      .map((part) => part.text)
      .join('');
    expect(text).toBe('1 + 2 = 3');
  });

  it('읽을 수 없는 식은 문제 위치에 밑줄 조각을 둔다', () => {
    const r = readExpression('1+2');
    const parts = exprParts('1+2', r.errorAt, r.valid);
    expect(parts.some((part) => part.error)).toBe(true);
    expect(exprParts('', null, false)).toEqual([]);
  });
});

describe('설정', () => {
  it('기본값: stepsShown 3, workStep 4, symmetric이면 build·expression·link', () => {
    const s = calc(createInitialState(SYM)).settings;
    expect(s).toMatchObject({
      pattern: 'symmetric-sum-square',
      stepsShown: 3,
      workStep: 4,
      build: true,
      expression: true,
      linkHighlight: true,
      look: 'blocks',
      error: null,
    });
  });

  it('repunit은 build가 true여도 무시하고 link도 없다', () => {
    const s = calc(
      createInitialState({ mode: 'calc-pattern', pattern: 'repunit-square', build: true }),
    ).settings;
    expect(s.build).toBe(false);
    expect(s.linkHighlight).toBe(false);
  });

  it('look picture는 build 꺼짐, none은 build·link 꺼짐', () => {
    expect(calc(createInitialState({ ...SYM, look: 'picture' })).settings.build).toBe(false);
    const none = calc(createInitialState({ ...SYM, look: 'none' })).settings;
    expect(none.build).toBe(false);
    expect(none.linkHighlight).toBe(false);
  });

  it('pattern이 없으면 symmetric, 모르는 pattern·범위 밖 단계는 설정 오류', () => {
    expect(
      calc(createInitialState({ mode: 'calc-pattern' } as unknown as CalcPatternConfig)).settings
        .error,
    ).toBeNull();
    const bad = (extra: Record<string, unknown>) =>
      calc(createInitialState({ ...SYM, ...extra } as unknown as CalcPatternConfig)).settings.error;
    expect(bad({ pattern: 'nope' })).not.toBeNull();
    expect(bad({ stepsShown: 0 })).not.toBeNull();
    expect(bad({ stepsShown: 9 })).not.toBeNull();
    expect(bad({ stepsShown: 2.5 })).not.toBeNull();
    expect(bad({ workStep: 10 })).not.toBeNull();
    expect(bad({ stepsShown: 8, workStep: 9 })).toBeNull();
  });

  it('heights는 2 × workStep + 1칸이고 처음엔 모두 0이다', () => {
    const state = calc(createInitialState(SYM4));
    expect(state.heights).toEqual(Array.from({ length: 9 }, () => 0));
    expect(state.cursor).toEqual({ col: 0, h: 1 });
    expect(state.exprText).toBe('');
    expect(state.link).toBeNull();
  });
});

describe('reduce', () => {
  it('tap-cell: 높이를 h로 두고 같은 h를 다시 누르면 h−1', () => {
    const a = apply(SYM4, [{ type: 'tap-cell', col: 2, h: 3 }]);
    expect(a.heights[2]).toBe(3);
    const b = apply(SYM4, [
      { type: 'tap-cell', col: 2, h: 3 },
      { type: 'tap-cell', col: 2, h: 3 },
    ]);
    expect(b.heights[2]).toBe(2);
    const c = apply(SYM4, [
      { type: 'tap-cell', col: 2, h: 1 },
      { type: 'tap-cell', col: 2, h: 1 },
    ]);
    expect(c.heights[2]).toBe(0);
  });

  it('tap-cell 범위 밖·build 꺼짐은 같은 상태 객체', () => {
    const initial = createInitialState(SYM4);
    expect(reduce(initial, { type: 'tap-cell', col: 9, h: 1 })).toBe(initial);
    expect(reduce(initial, { type: 'tap-cell', col: -1, h: 1 })).toBe(initial);
    expect(reduce(initial, { type: 'tap-cell', col: 0, h: 0 })).toBe(initial);
    expect(reduce(initial, { type: 'tap-cell', col: 0, h: 6 })).toBe(initial); // 행은 workStep + 1 = 5
    expect(reduce(initial, { type: 'tap-cell', col: 0, h: 1.5 })).toBe(initial);
    const noBuild = createInitialState({ ...SYM4, build: false });
    expect(reduce(noBuild, { type: 'tap-cell', col: 0, h: 1 })).toBe(noBuild);
  });

  it('쌓기 칸 높이는 workStep + 1까지 받는다', () => {
    expect(apply(SYM4, [{ type: 'tap-cell', col: 0, h: 5 }]).heights[0]).toBe(5);
  });

  it('clear-build', () => {
    const state = apply(SYM4, [...stackAll([1, 2, 3]), { type: 'clear-build' }]);
    expect(state.heights.every((h) => h === 0)).toBe(true);
    const initial = createInitialState(SYM4);
    expect(reduce(initial, { type: 'clear-build' })).toBe(initial);
  });

  it('move-cursor는 칸 안에 갇히고 toggle-at-cursor는 그 칸을 누른 것과 같다', () => {
    const state = apply(SYM4, [
      { type: 'move-cursor', dx: 2, dy: 2 },
      { type: 'toggle-at-cursor' },
    ]);
    expect(state.cursor).toEqual({ col: 2, h: 3 });
    expect(state.heights[2]).toBe(3);
    const edge = apply(SYM4, [
      { type: 'move-cursor', dx: -5, dy: -5 },
      { type: 'move-cursor', dx: 99, dy: 99 },
    ]);
    expect(edge.cursor).toEqual({ col: 8, h: 5 });
    const initial = createInitialState(SYM4);
    expect(reduce(initial, { type: 'move-cursor', dx: -1, dy: -1 })).toBe(initial);
  });

  it('type은 0-9 + × =만 받고 backspace·clear-expr', () => {
    const a = apply(SYM4, typeText('1+2=3'));
    expect(a.exprText).toBe('1+2=3');
    expect(apply(SYM4, [...typeText('12'), { type: 'type', key: 'a' }]).exprText).toBe('12');
    expect(apply(SYM4, [...typeText('12'), { type: 'type', key: '−' }]).exprText).toBe('12');
    expect(apply(SYM4, [...typeText('12'), { type: 'backspace' }]).exprText).toBe('1');
    expect(apply(SYM4, [...typeText('12'), { type: 'clear-expr' }]).exprText).toBe('');
    const empty = createInitialState(SYM4);
    expect(reduce(empty, { type: 'backspace' })).toBe(empty);
    expect(reduce(empty, { type: 'clear-expr' })).toBe(empty);
  });

  it('식은 60자까지만 받는다', () => {
    const state = apply(SYM4, typeText('1'.repeat(80)));
    expect(state.exprText).toHaveLength(60);
  });

  it('expression이 꺼져 있으면 type을 무시한다', () => {
    const initial = createInitialState({ ...SYM4, expression: false });
    expect(reduce(initial, { type: 'type', key: '1' })).toBe(initial);
  });

  it('set-focus', () => {
    expect(apply(SYM4, [{ type: 'set-focus', focus: 'expr' }]).focus).toBe('expr');
    const initial = createInitialState(SYM4);
    expect(reduce(initial, { type: 'set-focus', focus: 'build' })).toBe(initial);
  });

  it('link: 범위를 보고, null로 거둔다. 판정에는 안 쓰인다', () => {
    const a = apply(SYM4, [{ type: 'link', step: 3, col: 4 }]);
    expect(a.link).toEqual({ step: 3, col: 4 });
    expect(apply(SYM4, [{ type: 'link', step: 3, col: 5 }]).link).toBeNull();
    expect(apply(SYM4, [{ type: 'link', step: 4, col: 0 }]).link).toBeNull();
    expect(
      apply(SYM4, [
        { type: 'link', step: 3, col: 4 },
        { type: 'link', step: null },
      ]).link,
    ).toBeNull();
    const before = observe(createInitialState(SYM4));
    expect(observe(a)).toEqual(before);
    const off = createInitialState({ ...SYM4, linkHighlight: false });
    expect(reduce(off, { type: 'link', step: 1, col: 0 })).toBe(off);
  });

  it('설정 오류 상태는 아무 Action도 받지 않는다', () => {
    const initial = createInitialState({ ...SYM, pattern: 'nope' } as unknown as CalcPatternConfig);
    expect(reduce(initial, { type: 'type', key: '1' })).toBe(initial);
  });

  it('상태는 JSON으로 직렬화되고 reduce는 입력을 바꾸지 않는다', () => {
    const initial = createInitialState(SYM4);
    const frozen = JSON.stringify(initial);
    const next = reduce(initial, { type: 'tap-cell', col: 0, h: 2 });
    expect(JSON.stringify(initial)).toBe(frozen);
    assertSerializable(initial);
    assertSerializable(next);
    assertSerializable(observe(next));
  });

  it('다른 모드 Action(sequence place 등)은 calc 상태를 바꾸지 않는다', () => {
    const initial = createInitialState(SYM4);
    expect(reduce(initial, { type: 'place', slot: 0, token: 'x' })).toBe(initial);
    expect(reduce(initial, { type: 'activate', cell: 3 })).toBe(initial);
  });
});

describe('오개념 MC-PATTERN-RECURSIVE-ONLY', () => {
  it('쌓은 모양: 3단계 피라미드에 한 열만 붙이면 참(뒤·앞 모두)', () => {
    expect(isRecursiveBuild([1, 2, 3, 2, 1, 4], 4)).toBe(true);
    expect(isRecursiveBuild([0, 1, 2, 3, 2, 1, 4, 0], 4)).toBe(true);
    expect(isRecursiveBuild([4, 1, 2, 3, 2, 1], 4)).toBe(true);
    expect(isRecursiveBuild([1, 2, 3, 2, 1, 1], 4)).toBe(true);
  });

  it('쌓은 모양: 올바른 피라미드·비어 있음·두 열 이상 붙임·workStep 1은 거짓', () => {
    expect(isRecursiveBuild([1, 2, 3, 4, 3, 2, 1], 4)).toBe(false);
    expect(isRecursiveBuild([], 4)).toBe(false);
    expect(isRecursiveBuild([1, 2, 3, 2, 1, 4, 4], 4)).toBe(false);
    expect(isRecursiveBuild([1, 2, 3, 2], 4)).toBe(false);
    expect(isRecursiveBuild([1, 1], 1)).toBe(false);
  });

  it('식: 9 + 7 = 16 (4단계)은 참, 올바른 식·다른 수·성립 안 하는 식은 거짓', () => {
    const sym = 'symmetric-sum-square';
    expect(isRecursiveExpression(readExpression('9+7=16'), sym, 4)).toBe(true);
    expect(isRecursiveExpression(readExpression('7+9=16'), sym, 4)).toBe(true);
    expect(isRecursiveExpression(readExpression('16=9+7'), sym, 4)).toBe(true);
    expect(isRecursiveExpression(readExpression('1+2+3+4+3+2+1=4×4'), sym, 4)).toBe(false);
    expect(isRecursiveExpression(readExpression('9+8=16'), sym, 4)).toBe(false);
    expect(isRecursiveExpression(readExpression('9+7=17'), sym, 4)).toBe(false);
    expect(isRecursiveExpression(readExpression('9+7=16'), sym, 5)).toBe(false);
    expect(isRecursiveExpression(readExpression('9+7=16'), 'repunit-square', 4)).toBe(false);
    expect(isRecursiveExpression(readExpression('1+3=4'), sym, 2)).toBe(true);
    expect(isRecursiveExpression(readExpression('1+3=4'), sym, 1)).toBe(false);
  });

  it('Observation의 misconceptions에 걸린다', () => {
    const code = { code: 'MC-PATTERN-RECURSIVE-ONLY' };
    const build = apply(SYM4, stackAll([1, 2, 3, 2, 1, 4]));
    expect(observe(build)['misconceptions']).toEqual(['MC-PATTERN-RECURSIVE-ONLY']);
    const expr = apply(SYM4, typeText('9+7=16'));
    expect(observe(expr)['misconceptions']).toEqual(['MC-PATTERN-RECURSIVE-ONLY']);
    const right = apply(SYM4, [
      ...stackAll([1, 2, 3, 4, 3, 2, 1]),
      ...typeText('1+2+3+4+3+2+1=4×4'),
    ]);
    expect(observe(right)['misconceptions']).toEqual([]);
    expect(predicates['hasMisconception']?.(observe(build), code)).toBe(true);
    expect(predicates['hasMisconception']?.(observe(right), code)).toBe(false);
  });
});

describe('Observation·predicates', () => {
  const pyramid = [1, 2, 3, 4, 3, 2, 1];

  it('4단계를 쌓으면 builtIsPyramid·builtTotalIs 16', () => {
    const state = apply(SYM4, stackAll(pyramid, 1));
    const o = observe(state);
    expect(o['heights']).toEqual(pyramid);
    expect(o['builtTotal']).toBe(16);
    expect(o['builtIsPyramid']).toBe(true);
    expect(o['workStep']).toBe(4);
    expect(predicates['builtIsPyramid']?.(o, {})).toBe(true);
    expect(predicates['builtTotalIs']?.(o, { n: 16 })).toBe(true);
    expect(predicates['builtTotalIs']?.(o, { n: 15 })).toBe(false);
  });

  it('덜 쌓거나 한 열이 더 있으면 builtIsPyramid가 거짓', () => {
    const short = observe(apply(SYM4, stackAll([1, 2, 3, 4, 3, 2])));
    expect(short['builtIsPyramid']).toBe(false);
    const extra = observe(
      apply(SYM4, [...stackAll(pyramid, 1), { type: 'tap-cell', col: 0, h: 1 }]),
    );
    expect(extra['builtIsPyramid']).toBe(false);
  });

  it('식 predicate들', () => {
    const o = observe(apply(SYM4, typeText('1+2+3+4+3+2+1=4×4')));
    expect(o['exprValid']).toBe(true);
    expect(predicates['exprHolds']?.(o, {})).toBe(true);
    expect(predicates['exprAddendsAre']?.(o, { terms: [1, 2, 3, 4, 3, 2, 1] })).toBe(true);
    expect(predicates['exprAddendsAre']?.(o, { terms: [1, 2, 3, 4, 3, 2] })).toBe(false);
    expect(predicates['exprFactorsAre']?.(o, { a: 4, b: 4 })).toBe(true);
    expect(predicates['exprFactorsAre']?.(o, { a: 2, b: 8 })).toBe(false);
    expect(predicates['exprValueIs']?.(o, { n: 16 })).toBe(true);
    expect(predicates['exprValueIs']?.(o, { n: 15 })).toBe(false);
  });

  it('exprFactorsAre는 순서가 상관없다', () => {
    const o = observe(apply(SYM4, typeText('3×5=15')));
    expect(predicates['exprFactorsAre']?.(o, { a: 5, b: 3 })).toBe(true);
    expect(predicates['exprFactorsAre']?.(o, { a: 3, b: 5 })).toBe(true);
  });

  it('성립하지 않는 식은 exprHolds·exprValueIs가 거짓', () => {
    const o = observe(apply(SYM4, typeText('1+2+1=3×3')));
    expect(o['exprValid']).toBe(true);
    expect(predicates['exprHolds']?.(o, {})).toBe(false);
    expect(predicates['exprValueIs']?.(o, { n: 4 })).toBe(false);
  });

  it('읽을 수 없는 식·빈 식은 모두 거짓이고 값은 null', () => {
    const o = observe(apply(SYM4, typeText('1+')));
    expect(o['exprValid']).toBe(false);
    expect(o['exprLeft']).toBeNull();
    expect(o['exprAddends']).toBeNull();
    expect(predicates['exprHolds']?.(o, {})).toBe(false);
    expect(predicates['exprAddendsAre']?.(o, { terms: [1] })).toBe(false);
  });

  it('repunit 9단계: 값이 12345678987654321이고 큰 수는 글자열 인자로 비교한다', () => {
    const config: CalcPatternConfig = {
      mode: 'calc-pattern',
      pattern: 'repunit-square',
      stepsShown: 8,
      workStep: 9,
    };
    const o = observe(apply(config, typeText('111111111×111111111=12345678987654321')));
    expect(o['exprHolds']).toBe(true);
    expect(o['exprLeft']).toBe('12345678987654321');
    expect(predicates['exprValueIs']?.(o, { n: '12345678987654321' })).toBe(true);
    expect(predicates['exprValueIs']?.(o, { n: '12345678987654320' })).toBe(false);
    expect(predicates['exprFactorsAre']?.(o, { a: 111111111, b: '111111111' })).toBe(true);
    expect(o['heights']).toEqual([]);
    expect(o['builtIsPyramid']).toBe(false);
  });

  it('repunit에서는 쌓기가 없으므로 tap-cell을 무시한다', () => {
    const config: CalcPatternConfig = { mode: 'calc-pattern', pattern: 'repunit-square' };
    const initial = createInitialState(config);
    expect(reduce(initial, { type: 'tap-cell', col: 0, h: 1 })).toBe(initial);
  });

  it('인자가 잘못되면 거짓', () => {
    const o = observe(apply(SYM4, typeText('4×4=16')));
    expect(predicates['exprValueIs']?.(o, { n: 1.5 })).toBe(false);
    expect(predicates['exprValueIs']?.(o, {})).toBe(false);
    expect(predicates['exprAddendsAre']?.(o, { terms: 'x' })).toBe(false);
    expect(predicates['builtTotalIs']?.(o, {})).toBe(false);
  });
});
