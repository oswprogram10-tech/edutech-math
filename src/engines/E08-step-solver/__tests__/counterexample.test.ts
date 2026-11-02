import { describe, expect, it } from 'vitest';
import { Rational } from '../../../core/math';
import { firstDiagnosis } from '../analyze';
import type { Diagnosis } from '../analyze';
import { counterexampleMessage } from '../counterexample';
import { tokensFromText } from '../expression';
import { createInitialState } from '../reduce';

/** 시작 식과 학생이 쓴 둘째 줄로 첫 진단을 만든다. */
function diagnosisOf(start: string, line: string): Diagnosis {
  let state = createInitialState({ mode: 'lines', start });
  state = {
    ...state,
    lines: state.lines.map((item, index) =>
      index === 1 ? { ...item, tokens: tokensFromText(line) } : item,
    ),
  };
  const diagnosis = firstDiagnosis(state);
  if (!diagnosis) throw new Error(`진단이 없습니다: ${start} → ${line}`);
  return diagnosis;
}

/**
 * 문장이 실제로 참인지 확인한다.
 * "…보다 작아요"라고 말하면 그 비교를 `Rational`로 다시 계산해 참이어야 한다.
 */
function claimOf(message: string): { kind: 'shrunk'; student: Rational; big: Rational } | null {
  const shrunk = /^(.+?)는 더한 수 (.+?)보다 작아요/.exec(message);
  if (!shrunk?.[1] || !shrunk[2]) return null;
  return {
    kind: 'shrunk',
    student: Rational.parse(shrunk[1]),
    big: Rational.parse(shrunk[2]),
  };
}

describe('E08 반례 문장은 참인 말만 한다', () => {
  it('1/3 + 1/2 = 2/5는 2/5 < 1/2일 때만 "작아요"라고 말한다', () => {
    const diagnosis = diagnosisOf('1/3 + 1/2', '2/5');
    expect(diagnosis.code).toBe('MC-FRAC-ADD-DENOM');
    expect(diagnosis.bigText).toBe('1/2');

    const message = counterexampleMessage(diagnosis);
    const claim = claimOf(message);
    // 1/3보다 크지만 더 큰 수인 1/2보다는 작다. 두 수 중 큰 수와 비교해야 참이다.
    expect(claim).not.toBeNull();
    if (!claim) return;
    expect(claim.student.compareTo(claim.big)).toBe(-1);
    expect(claim.big.equals(Rational.parse('1/2'))).toBe(true);
    expect(message).not.toContain('1/3보다 작');
  });

  it('2/7 + 3/7 = 5/14는 5/14 < 3/7일 때만 "작아요"라고 말한다', () => {
    const diagnosis = diagnosisOf('2/7 + 3/7', '5/14');
    expect(diagnosis.bigText).toBe('3/7');

    const message = counterexampleMessage(diagnosis);
    const claim = claimOf(message);
    expect(claim).not.toBeNull();
    if (!claim) return;
    expect(claim.student.compareTo(claim.big)).toBe(-1);
    expect(claim.big.equals(Rational.parse('3/7'))).toBe(true);
    // 정답 5/7은 문장에 없다.
    expect(message).not.toContain('5/7');
  });

  it('1/2 + 1/3 = 2/5는 "1/2보다 작아요"가 참이라 그대로 말한다', () => {
    const diagnosis = diagnosisOf('1/2 + 1/3', '2/5');
    const message = counterexampleMessage(diagnosis);
    expect(message).toContain('1/2보다 작아요');
    expect(message).not.toContain('5/6');

    const claim = claimOf(message);
    expect(claim).not.toBeNull();
    expect(claim?.student.equals(Rational.parse('2/5'))).toBe(true);
    expect(claim?.student.compareTo(claim?.big ?? Rational.of(0))).toBe(-1);
  });

  it('학생 답이 더 큰 수보다 작지 않으면 수치를 단정하지 않고 질문한다', () => {
    // 오개념 감지로는 나오기 어려운 모양이지만, 문장 함수는 어떤 입력에도 참인 말만 해야 한다.
    const diagnosis: Diagnosis = {
      line: 1,
      code: 'MC-FRAC-ADD-DENOM',
      previousValue: '5/6',
      studentValue: '3/4',
      studentExpr: '3/4',
      leftText: '1/2',
      rightText: '1/3',
      bigText: '1/2',
      bigValue: '1/2',
      op: 'add',
    };
    const message = counterexampleMessage(diagnosis);
    expect(claimOf(message)).toBeNull();
    expect(message).not.toContain('작아요');
    expect(message).not.toContain('커졌어요');
    expect(message).toContain('1/2');
    expect(message).toContain('1/3');
    expect(message).toContain('3/4');
    expect(message).toContain('커졌나요');
    // 단정하려던 비교가 실제로 거짓임을 확인한다.
    expect(Rational.parse('3/4').compareTo(Rational.parse('1/2'))).toBe(1);
  });

  it('"학생이 쓴" 같은 3인칭 표현 없이 학생에게 말한다', () => {
    const messages = [
      counterexampleMessage(diagnosisOf('1/2 + 1/3', '2/5')),
      counterexampleMessage(diagnosisOf('1/5 + 2/5', '3/10')),
      counterexampleMessage(diagnosisOf('1/2 + 1/3', '1/3')),
      counterexampleMessage(diagnosisOf('3 1/4 - 1 3/4', '2 2/4')),
    ];
    for (const message of messages) {
      expect(message).not.toContain('학생이 쓴');
      expect(message).not.toContain('학생은');
    }
  });

  it('뺄셈 오개념 문장에는 비교 단정이 없다', () => {
    const diagnosis = diagnosisOf('3 1/4 - 1 3/4', '2 2/4');
    expect(diagnosis.code).toBe('MC-SUB-SMALLER-FROM-LARGER');
    const message = counterexampleMessage(diagnosis);
    expect(claimOf(message)).toBeNull();
    expect(message).not.toContain('작아요');
    expect(message).not.toContain('3/2');
  });
});
