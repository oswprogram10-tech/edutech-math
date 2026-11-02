/**
 * E08 반례 상자 문장.
 *
 * 문장은 학생이 쓴 수와 앞 줄의 두 항만 쓴다. 정답 값은 절대 넣지 않는다.
 * 크기 비교("작아요/커요")는 `Rational`로 실제로 참일 때만 말한다.
 * 참인 비교가 없으면 수치를 단정하지 않고 질문으로 바꾼다.
 */
import { Rational } from '../../core/math';
import type { Diagnosis } from './analyze';
import { stepSolverStrings as S } from './strings.ko';

/** 학생 값이 `bigText`보다 작은지. 값이 없으면 거짓(단정하지 않는다). */
function shrunkBelow(diagnosis: Diagnosis, bigText: string | null): boolean {
  if (bigText === null || diagnosis.bigValue === null) return false;
  return Rational.parse(diagnosis.studentValue).compareTo(Rational.parse(diagnosis.bigValue)) < 0;
}

/** 반례 상자에 쓸 문장 하나. 참이 아닌 비교는 하지 않는다. */
export function counterexampleMessage(diagnosis: Diagnosis): string {
  const big = diagnosis.bigText;
  const shrunk = shrunkBelow(diagnosis, big);
  const question = () =>
    S.messageAddQuestion(diagnosis.leftText, diagnosis.rightText, diagnosis.studentExpr);

  switch (diagnosis.code) {
    case 'MC-FRAC-ADD-DENOM':
      return shrunk && big !== null ? S.messageAddShrunk(diagnosis.studentExpr, big) : question();
    case 'MC-FRAC-ADD-DENOM-HALF':
      return shrunk && big !== null
        ? S.messageAddShrunkHalf(diagnosis.studentExpr, big)
        : question();
    case 'MC-FRAC-ADD-NO-CONVERT-NUM':
      return shrunk && big !== null
        ? S.messageAddShrunkNoConvert(diagnosis.studentExpr, big)
        : question();
    case 'MC-FRAC-BORROW-AS-TEN':
      return S.messageBorrowAsTen(diagnosis.studentExpr);
    case 'MC-FRAC-WHOLE-MINUS':
      return S.messageWholeMinus(diagnosis.studentExpr);
    default:
      return S.messageGeneric(diagnosis.studentExpr);
  }
}
