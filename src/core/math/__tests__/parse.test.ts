import { describe, expect, it } from 'vitest';
import { MathError, evaluate, parse } from '..';
import type { Ast, MathErrorCode } from '..';

function codeOf(action: () => unknown): MathErrorCode {
  try {
    action();
  } catch (error) {
    if (error instanceof MathError) return error.code;
    throw error;
  }
  throw new Error('MathError가 발생하지 않았습니다.');
}

function valueOf(source: string): string {
  return evaluate(parse(source)).toString();
}

describe('parse 수 리터럴', () => {
  it('자연수', () => {
    const ast = parse('12');
    expect(ast.kind).toBe('number');
    if (ast.kind !== 'number') throw new Error('number 노드가 아닙니다.');
    expect(ast.form).toBe('integer');
    expect(ast.text).toBe('12');
    expect(ast.value.toString()).toBe('12');
  });

  it('소수', () => {
    const ast = parse('0.25');
    expect(ast.kind).toBe('number');
    if (ast.kind !== 'number') throw new Error('number 노드가 아닙니다.');
    expect(ast.form).toBe('decimal');
    expect(ast.text).toBe('0.25');
    expect(ast.value.toString()).toBe('1/4');
  });

  it('분수', () => {
    const ast = parse('3/4');
    expect(ast.kind).toBe('number');
    if (ast.kind !== 'number') throw new Error('number 노드가 아닙니다.');
    expect(ast.form).toBe('fraction');
    expect(ast.num).toBe('3');
    expect(ast.den).toBe('4');
    expect(ast.value.toString()).toBe('3/4');
  });

  it('대분수', () => {
    const ast = parse('1 2/3');
    expect(ast.kind).toBe('number');
    if (ast.kind !== 'number') throw new Error('number 노드가 아닙니다.');
    expect(ast.form).toBe('mixed');
    expect(ast.text).toBe('1 2/3');
    expect(ast.whole).toBe('1');
    expect(ast.num).toBe('2');
    expect(ast.den).toBe('3');
    expect(ast.value.toString()).toBe('5/3');
  });

  it('공백이 없는 8/2는 분수 리터럴(=4)이다', () => {
    const ast = parse('8/2');
    expect(ast.kind).toBe('number');
    if (ast.kind !== 'number') throw new Error('number 노드가 아닙니다.');
    expect(ast.form).toBe('fraction');
    expect(ast.value.toString()).toBe('4');
  });

  it('공백이 있는 8 / 2는 나눗셈이다', () => {
    const ast = parse('8 / 2');
    expect(ast.kind).toBe('binary');
    if (ast.kind !== 'binary') throw new Error('binary 노드가 아닙니다.');
    expect(ast.op).toBe('div');
  });

  it('3/ 4처럼 한쪽만 붙으면 나눗셈이다', () => {
    expect(valueOf('3/ 4')).toBe('3/4');
  });
});

describe('parse 연산자와 우선순위', () => {
  it('유니코드 기호를 모두 읽는다', () => {
    expect(valueOf('2 + 3 − 1 × 4 ÷ 2')).toBe('3');
  });

  it('ASCII 기호를 모두 읽는다', () => {
    expect(valueOf('24 - 6 * 3 + 8 / 2')).toBe('10');
  });

  it('곱셈·나눗셈을 덧셈·뺄셈보다 먼저 계산한다', () => {
    expect(valueOf('1 + 2 × 3')).toBe('7');
    expect(valueOf('2 × 3 + 4')).toBe('10');
  });

  it('괄호를 먼저 계산한다', () => {
    const ast = parse('2 × (1 + 3)');
    expect(ast.kind).toBe('binary');
    if (ast.kind !== 'binary') throw new Error('binary 노드가 아닙니다.');
    expect(ast.right.kind).toBe('group');
    expect(valueOf('2 × (1 + 3)')).toBe('8');
  });

  it('왼쪽부터 계산한다', () => {
    expect(valueOf('10 - 2 - 3')).toBe('5');
    expect(valueOf('8 ÷ 2 × 3')).toBe('12');
  });

  it('대분수와 분수도 식 안에서 쓴다', () => {
    expect(valueOf('2 × 1 2/3')).toBe('10/3');
    expect(valueOf('1/2 + 1/3')).toBe('5/6');
  });
});

describe('parse 비와 □', () => {
  it('비는 최상위 노드 ratio가 된다', () => {
    const ast = parse('2:3');
    expect(ast.kind).toBe('ratio');
    expect(evaluate(ast).toString()).toBe('2/3');
  });

  it('비는 최상위에 하나만 쓸 수 있다', () => {
    expect(codeOf(() => parse('1:2:3'))).toBe('PARSE');
    expect(codeOf(() => parse('(1:2)'))).toBe('PARSE');
  });

  it('□를 box 노드로 읽는다', () => {
    const ast = parse('□ + 2');
    expect(ast.kind).toBe('binary');
    if (ast.kind !== 'binary') throw new Error('binary 노드가 아닙니다.');
    expect(ast.left.kind).toBe('box');
    expect(codeOf(() => evaluate(ast))).toBe('NO_BOX');
    expect(parse('□').kind).toBe('box');
  });
});

describe('parse 오류', () => {
  it('빈 식과 남는 기호를 거부한다', () => {
    expect(codeOf(() => parse(''))).toBe('PARSE');
    expect(codeOf(() => parse('   '))).toBe('PARSE');
    expect(codeOf(() => parse('%'))).toBe('PARSE');
  });

  it('위치를 알려 준다', () => {
    try {
      parse('.5');
    } catch (error) {
      expect(error).toBeInstanceOf(MathError);
      if (error instanceof MathError) expect(error.position).toBe(0);
    }
    try {
      parse('1,000');
    } catch (error) {
      if (error instanceof MathError) expect(error.position).toBe(1);
    }
  });

  it('단항 마이너스를 받지 않는다', () => {
    expect(codeOf(() => parse('-3'))).toBe('PARSE');
    expect(codeOf(() => parse('−(2)'))).toBe('PARSE');
  });

  it('잘못된 대분수·괄호·식을 거부한다', () => {
    expect(codeOf(() => parse('1 4/3'))).toBe('PARSE');
    expect(codeOf(() => parse('1 2 / 3'))).toBe('PARSE');
    expect(codeOf(() => parse('1 2/3 4/5'))).toBe('PARSE');
    expect(codeOf(() => parse('()'))).toBe('PARSE');
    expect(codeOf(() => parse('1+'))).toBe('PARSE');
    expect(codeOf(() => parse('(1+2'))).toBe('PARSE');
    expect(codeOf(() => parse('2 3'))).toBe('PARSE');
  });

  it('분모 0은 DIV_BY_ZERO', () => {
    expect(codeOf(() => parse('1/0'))).toBe('DIV_BY_ZERO');
    expect(codeOf(() => parse('1 2/0'))).toBe('DIV_BY_ZERO');
  });

  it('괄호 안 그룹 AST를 만든다', () => {
    const ast: Ast = parse('(1 + 2)');
    expect(ast.kind).toBe('group');
  });
});
