import { describe, expect, it } from 'vitest';
import { MathError, Rational, rationalToDisplay, toDisplay, parse } from '..';
import type { Ast, DisplayNode } from '..';

function codeOf(action: () => unknown): string {
  try {
    action();
  } catch (error) {
    if (error instanceof MathError) return error.code;
    throw error;
  }
  throw new Error('MathError가 발생하지 않았습니다.');
}

describe('toDisplay', () => {
  it('정수·소수·분수·대분수를 표시 노드로 만든다', () => {
    expect(toDisplay(parse('12'))).toEqual([{ kind: 'int', text: '12' }]);
    expect(toDisplay(parse('0.25'))).toEqual([{ kind: 'decimal', text: '0.25' }]);
    expect(toDisplay(parse('3/4'))).toEqual([{ kind: 'fraction', num: '3', den: '4' }]);
    expect(toDisplay(parse('1 2/3'))).toEqual([
      { kind: 'fraction', whole: '1', num: '2', den: '3' },
    ]);
  });

  it('□와 연산자를 표시 노드로 만든다', () => {
    expect(toDisplay(parse('□'))).toEqual([{ kind: 'box' }]);
    expect(toDisplay(parse('1 + 2'))).toEqual([
      { kind: 'int', text: '1' },
      { kind: 'op', symbol: '+' },
      { kind: 'int', text: '2' },
    ]);
  });

  it('ASCII 기호를 유니코드로 바꾼다', () => {
    const nodes = toDisplay(parse('1 - 2 * 3 / 4'));
    expect(nodes.filter((node) => node.kind === 'op')).toEqual([
      { kind: 'op', symbol: '−' },
      { kind: 'op', symbol: '×' },
      { kind: 'op', symbol: '÷' },
    ]);
  });

  it('괄호를 group 노드로 남긴다', () => {
    expect(toDisplay(parse('(1 + 2) × 3'))).toEqual([
      {
        kind: 'group',
        children: [
          { kind: 'int', text: '1' },
          { kind: 'op', symbol: '+' },
          { kind: 'int', text: '2' },
        ],
      },
      { kind: 'op', symbol: '×' },
      { kind: 'int', text: '3' },
    ]);
  });

  it('비는 콜론 연산자로 표시한다', () => {
    expect(toDisplay(parse('2:3'))).toEqual([
      { kind: 'int', text: '2' },
      { kind: 'op', symbol: ':' },
      { kind: 'int', text: '3' },
    ]);
  });

  it('JSON으로 직렬화된다', () => {
    const nodes = toDisplay(parse('1 2/3 + (4 - 5)'));
    const restored: unknown = JSON.parse(JSON.stringify(nodes));
    expect(restored).toEqual(nodes);
  });

  it('분수부 문자열이 없는 노드도 값에서 복원한다', () => {
    const manual: Ast = {
      kind: 'number',
      form: 'fraction',
      value: Rational.parse('5/4'),
      text: '5/4',
    };
    expect(toDisplay(manual)).toEqual([{ kind: 'fraction', whole: '1', num: '1', den: '4' }]);

    const manualMixed: Ast = {
      kind: 'number',
      form: 'mixed',
      value: Rational.parse('7/4'),
      text: '1 3/4',
      whole: '1',
    };
    expect(toDisplay(manualMixed)).toEqual([{ kind: 'fraction', whole: '1', num: '3', den: '4' }]);
  });
});

describe('rationalToDisplay', () => {
  it('분수 표기', () => {
    expect(rationalToDisplay(Rational.parse('3/4'), 'fraction')).toEqual({
      kind: 'fraction',
      num: '3',
      den: '4',
    });
    expect(rationalToDisplay(Rational.parse('-3/4'), 'fraction')).toEqual({
      kind: 'fraction',
      num: '-3',
      den: '4',
    });
    expect(rationalToDisplay(Rational.of(3), 'fraction')).toEqual({ kind: 'int', text: '3' });
  });

  it('대분수 표기', () => {
    expect(rationalToDisplay(Rational.parse('5/4'), 'mixed')).toEqual({
      kind: 'fraction',
      whole: '1',
      num: '1',
      den: '4',
    });
    expect(rationalToDisplay(Rational.parse('-7/4'), 'mixed')).toEqual({
      kind: 'fraction',
      whole: '-1',
      num: '3',
      den: '4',
    });
    expect(rationalToDisplay(Rational.parse('3/4'), 'mixed')).toEqual({
      kind: 'fraction',
      num: '3',
      den: '4',
    });
    expect(rationalToDisplay(Rational.of(-2), 'mixed')).toEqual({ kind: 'int', text: '-2' });
  });

  it('소수 표기', () => {
    expect(rationalToDisplay(Rational.parse('1/8'), 'decimal')).toEqual({
      kind: 'decimal',
      text: '0.125',
    });
    expect(rationalToDisplay(Rational.parse('-3/2'), 'decimal')).toEqual({
      kind: 'decimal',
      text: '-1.5',
    });
  });

  it('순환소수는 NOT_TERMINATING', () => {
    expect(codeOf(() => rationalToDisplay(Rational.parse('1/3'), 'decimal'))).toBe(
      'NOT_TERMINATING',
    );
  });

  it('표시 노드는 JSON으로 직렬화된다', () => {
    const node: DisplayNode = rationalToDisplay(Rational.parse('7/4'), 'mixed');
    expect(JSON.parse(JSON.stringify(node))).toEqual(node);
  });
});
