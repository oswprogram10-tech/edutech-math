/**
 * W6 오개념 감지(순수 함수).
 *
 * 수 함정은 콘텐츠 작성자가 오답 값을 계산해 args `trap`으로 넘기고
 * (`diagnose-shared.ts`의 `trapValue`), 고르기는 `trapChoice`를 쓴다.
 * args가 없거나 읽을 수 없으면 false이고 예외를 던지지 않는다.
 *
 * `detect: 'observation'` 코드 4개(MC-MEASURE-GAP, MC-LENGTH-NO-PROMOTE,
 * MC-SORT-INCONSISTENT, MC-RANGE-BOUNDARY-INCLUSION)는 여기에 없다.
 */
import type { DiagnoseDetector } from './diagnose-shared';
import { trapChoice, trapValue } from './diagnose-shared';

/** `detect: 'diagnose'`인 W6 코드의 감지 함수(14개). */
export const diagnoseDetectorsW6: Readonly<Record<string, DiagnoseDetector>> = {
  // 수 함정
  'MC-MEASURE-ENDPOINT': trapValue,
  'MC-LENGTH-UNIT-MIX': trapValue,
  'MC-CLOCK-MINUTE-NUMERAL': trapValue,
  'MC-TIME-BASE-100': trapValue,
  'MC-MEAS-UNIT-CONVERT': trapValue,
  'MC-MEAS-MIXED-UNIT-CALC': trapValue,
  'MC-ROUND-WRONG-PLACE': trapValue,
  // 고르기 감지
  'MC-MEASURE-CURVE': trapChoice,
  'MC-SIZE-IS-WEIGHT': trapChoice,
  'MC-MEASURE-UNIT-SIZE': trapChoice,
  'MC-MEAS-CAPACITY-SHAPE': trapChoice,
  'MC-MEAS-WEIGHT-SIZE': trapChoice,
  'MC-SORT-SUBJECTIVE': trapChoice,
  'MC-ROUND-CONTEXT-BLIND': trapChoice,
};
