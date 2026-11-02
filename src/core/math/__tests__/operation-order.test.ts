import { describe, expect, it } from 'vitest';
import { MathError, operationOrder, parse } from '..';
import type { MathErrorCode, OperationStep } from '..';

function codeOf(action: () => unknown): MathErrorCode {
  try {
    action();
  } catch (error) {
    if (error instanceof MathError) return error.code;
    throw error;
  }
  throw new Error('MathError가 발생하지 않았습니다.');
}

function ops(steps: readonly OperationStep[]): string[] {
  return steps.map((step) => step.op);
}

describe('operationOrder 기본 순서', () => {
  it('괄호 → ×÷ → +− 순서로 한 단계씩 계산한다', () => {
    const steps = operationOrder(parse('24 - 6 * 3 + 8 / 2'));
    expect(steps).toHaveLength(4);
    expect(ops(steps)).toEqual(['×', '÷', '−', '+']);

    expect(steps[0]).toMatchObject({
      nodePath: 'root.left.right',
      before: '24 − 6 × 3 + 8 ÷ 2',
      after: '24 − 18 + 8 ÷ 2',
    });
    expect(steps[0]?.left.toString()).toBe('6');
    expect(steps[0]?.right.toString()).toBe('3');
    expect(steps[0]?.result.toString()).toBe('18');

    expect(steps[1]).toMatchObject({
      nodePath: 'root.right',
      before: '24 − 18 + 8 ÷ 2',
      after: '24 − 18 + 4',
    });
    expect(steps[2]).toMatchObject({
      nodePath: 'root.left',
      before: '24 − 18 + 4',
      after: '6 + 4',
    });
    expect(steps[3]).toMatchObject({
      nodePath: 'root',
      before: '6 + 4',
      after: '10',
    });
    expect(steps[3]?.result.toString()).toBe('10');
  });

  it('곱셈·나눗셈은 왼쪽부터 계산한다', () => {
    const steps = operationOrder(parse('8 ÷ 2 × 3'));
    expect(ops(steps)).toEqual(['÷', '×']);
    expect(steps[0]?.result.toString()).toBe('4');
    expect(steps[0]?.after).toBe('4 × 3');
    expect(steps[1]?.after).toBe('12');
  });

  it('덧셈·뺄셈은 왼쪽부터 계산한다', () => {
    const steps = operationOrder(parse('10 - 2 - 3'));
    expect(ops(steps)).toEqual(['−', '−']);
    expect(steps[0]?.nodePath).toBe('root.left');
    expect(steps[0]?.after).toBe('8 − 3');
    expect(steps[1]?.after).toBe('5');
  });
});

describe('operationOrder 괄호', () => {
  it('괄호 안을 먼저 계산하고 괄호를 정리한다', () => {
    const steps = operationOrder(parse('2 × (1 + 3)'));
    expect(ops(steps)).toEqual(['+', '×']);
    expect(steps[0]).toMatchObject({
      nodePath: 'root.right.expr',
      before: '2 × (1 + 3)',
      after: '2 × 4',
    });
    expect(steps[1]?.after).toBe('8');
  });

  it('여러 괄호는 왼쪽부터 계산한다', () => {
    const steps = operationOrder(parse('(1 + 2) × (3 + 4)'));
    expect(ops(steps)).toEqual(['+', '+', '×']);
    expect(steps[0]?.after).toBe('3 × (3 + 4)');
    expect(steps[1]?.after).toBe('3 × 7');
    expect(steps[2]?.after).toBe('21');
  });

  it('중첩 괄호는 안쪽부터 계산한다', () => {
    const steps = operationOrder(parse('2 × (1 + (3 + 4))'));
    expect(ops(steps)).toEqual(['+', '+', '×']);
    expect(steps[0]?.after).toBe('2 × (1 + 7)');
    expect(steps[1]?.after).toBe('2 × 8');
    expect(steps[2]?.after).toBe('16');
  });

  it('숫자만 남은 괄호는 단계가 없다', () => {
    expect(operationOrder(parse('(5)'))).toEqual([]);
  });
});

describe('operationOrder 리터럴과 비', () => {
  it('분수·대분수 리터럴은 단계가 아니다', () => {
    const fraction = operationOrder(parse('1/2 + 1/2'));
    expect(fraction).toHaveLength(1);
    expect(fraction[0]?.before).toBe('1/2 + 1/2');
    expect(fraction[0]?.after).toBe('1');

    const mixed = operationOrder(parse('1 2/3 - 1/3'));
    expect(mixed).toHaveLength(1);
    expect(mixed[0]?.before).toBe('1 2/3 − 1/3');
    expect(mixed[0]?.result.toString()).toBe('4/3');
    expect(mixed[0]?.after).toBe('4/3');
  });

  it('소수도 리터럴로 유지하고 결과는 정확한 분수로 쓴다', () => {
    const steps = operationOrder(parse('0.5 + 0.25'));
    expect(steps).toHaveLength(1);
    expect(steps[0]?.before).toBe('0.5 + 0.25');
    expect(steps[0]?.result.toString()).toBe('3/4');
    expect(steps[0]?.after).toBe('3/4');
  });

  it('비는 계산 단계로 세지 않는다', () => {
    expect(operationOrder(parse('6 : 3'))).toEqual([]);

    const steps = operationOrder(parse('2 + 1 : 3'));
    expect(ops(steps)).toEqual(['+']);
    expect(steps[0]?.after).toBe('3 : 3');
  });

  it('이미 수 하나면 단계가 없다', () => {
    expect(operationOrder(parse('5'))).toEqual([]);
  });
});

describe('operationOrder 오류', () => {
  it('□가 있으면 NO_BOX', () => {
    expect(codeOf(() => operationOrder(parse('□ + 1')))).toBe('NO_BOX');
  });

  it('0으로 나누면 DIV_BY_ZERO', () => {
    expect(codeOf(() => operationOrder(parse('1 ÷ 0')))).toBe('DIV_BY_ZERO');
  });
});
