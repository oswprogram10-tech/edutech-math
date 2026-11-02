import { describe, expect, it } from 'vitest';
import { classifyColumn, uniqueCodes } from '../classify';
import type { ClassifyInput } from '../classify';
import type { AlignmentResult, ColumnComputation } from '../grid';

const POINT: AlignmentResult = { aligned: true, alignment: 'point', pointColumn: 0 };
const RIGHT_EDGE: AlignmentResult = { aligned: false, alignment: 'right-edge', pointColumn: null };

function computation(overrides: Partial<ColumnComputation> = {}): ColumnComputation {
  return {
    column: 0,
    top: 0,
    bottom: 0,
    carryIn: 0,
    carryOut: 0,
    borrowFromHigher: 0,
    decrement: 0,
    expected: 0,
    noCarryDigit: null,
    originalTopDigit: null,
    ...overrides,
  };
}

function input(overrides: Partial<ClassifyInput> = {}): ClassifyInput {
  return {
    mode: 'add',
    op: 'add',
    alignment: POINT,
    computation: computation(),
    studentDigit: '0',
    ...overrides,
  };
}

describe('E07 오류 분류', () => {
  it('MC-PV-NO-CARRY: 받아올림을 더하지 않은 값', () => {
    const code = classifyColumn(
      input({
        computation: computation({
          top: 4,
          bottom: 2,
          carryIn: 1,
          expected: 7,
          noCarryDigit: 6,
        }),
        studentDigit: '6',
      }),
    );
    expect(code).toBe('MC-PV-NO-CARRY');
  });

  it('MC-PV-NO-CARRY: 받아올림 수를 결과 칸에 그대로 쓴 값', () => {
    const code = classifyColumn(
      input({
        computation: computation({
          top: 4,
          bottom: 2,
          carryIn: 1,
          expected: 7,
          noCarryDigit: 6,
        }),
        studentDigit: '1',
      }),
    );
    expect(code).toBe('MC-PV-NO-CARRY');
  });

  it('MC-PV-BORROW-NO-DECREMENT: 받아내림 뒤 윗수를 그대로 쓴 값', () => {
    const code = classifyColumn(
      input({
        op: 'sub',
        mode: 'sub',
        computation: computation({
          top: 5,
          bottom: 1,
          decrement: 1,
          expected: 3,
          originalTopDigit: 4,
        }),
        studentDigit: '4',
      }),
    );
    expect(code).toBe('MC-PV-BORROW-NO-DECREMENT');
  });

  it('MC-SUB-SMALLER-FROM-LARGER: 작은 수에서 큰 수를 뺀 값', () => {
    const code = classifyColumn(
      input({
        op: 'sub',
        mode: 'sub',
        computation: computation({
          top: 1,
          bottom: 7,
          borrowFromHigher: 1,
          expected: 4,
        }),
        studentDigit: '6',
      }),
    );
    expect(code).toBe('MC-SUB-SMALLER-FROM-LARGER');
  });

  it('MC-DEC-ALIGN-RIGHT: 소수점을 오른쪽 끝에 맞춘 상태', () => {
    const code = classifyColumn(
      input({
        mode: 'decimal',
        alignment: RIGHT_EDGE,
        computation: computation({ top: 3, bottom: 2, expected: 5 }),
        studentDigit: '7',
      }),
    );
    expect(code).toBe('MC-DEC-ALIGN-RIGHT');
  });

  it('MC-DEC-ALIGN-RIGHT가 다른 규칙보다 먼저다', () => {
    const code = classifyColumn(
      input({
        mode: 'decimal',
        op: 'sub',
        alignment: RIGHT_EDGE,
        computation: computation({
          top: 1,
          bottom: 7,
          borrowFromHigher: 1,
          expected: 4,
        }),
        studentDigit: '6',
      }),
    );
    expect(code).toBe('MC-DEC-ALIGN-RIGHT');
  });

  it('바른 값은 어떤 규칙에도 걸리지 않는다', () => {
    expect(
      classifyColumn(
        input({
          computation: computation({
            top: 4,
            bottom: 2,
            carryIn: 1,
            expected: 7,
            noCarryDigit: 6,
          }),
          studentDigit: '7',
        }),
      ),
    ).toBe('unknown');

    expect(
      classifyColumn(
        input({
          op: 'sub',
          mode: 'sub',
          computation: computation({
            top: 5,
            bottom: 1,
            decrement: 1,
            expected: 3,
            originalTopDigit: 4,
          }),
          studentDigit: '3',
        }),
      ),
    ).toBe('unknown');
  });

  it('모호한 값은 unknown이다', () => {
    expect(
      classifyColumn(
        input({
          computation: computation({
            top: 4,
            bottom: 2,
            carryIn: 1,
            expected: 7,
            noCarryDigit: 6,
          }),
          studentDigit: '9',
        }),
      ),
    ).toBe('unknown');
  });

  it('오개념 코드를 중복 없이 모은다', () => {
    expect(
      uniqueCodes([
        { column: 0, code: 'MC-PV-NO-CARRY' },
        { column: 1, code: 'MC-PV-NO-CARRY' },
        { column: 2, code: 'unknown' },
      ]),
    ).toEqual(['MC-PV-NO-CARRY', 'unknown']);
  });
});
