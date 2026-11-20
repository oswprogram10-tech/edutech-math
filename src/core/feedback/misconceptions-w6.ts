/**
 * W6 오개념 레지스트리(18개).
 *
 * `docs/05-learning-engine.md` §5 표에서 W6 8개 단원(g1s1u4, g2s1u4, g2s1u5,
 * g2s2u3, g2s2u4, g3s1u5, g3s2u5, g5s2u1) 중 하나라도 쓰는 코드 가운데
 * W1~W5에 아직 없는 것을 옮겼다. `MC-CLOCK-HANDS`·`MC-CLOCK-HOUR-BETWEEN`·
 * `MC-COUNT-ONE-TO-ONE`·`MC-GEO-RADIUS-DIAMETER`는 이미 있어 다시 넣지 않는다.
 *
 * `units`는 docs/05 §5 표의 단원 열 전체다. `backtrack`은 T200 카드가 고정한
 * 개념 ID다.
 *
 * `detect: 'observation'` 코드는 감지 함수를 만들지 않는다. 힌트의
 * `when: {misconception}`로는 걸리지 않으므로 콘텐츠는 엔진 predicate나
 * GoalSpec을 쓴다(교사 기록·역추적용으로만 레지스트리에 둔다).
 */
import type { Misconception } from './misconceptions';

export const W6_MISCONCEPTIONS: readonly Misconception[] = [
  {
    code: 'MC-MEASURE-ENDPOINT',
    label: '끝(영점)을 맞추지 않고 길이 비교·측정',
    units: ['g1s1u4', 'g2s1u4', 'g2s2u3', 'g3s1u5'],
    backtrack: 'g1s1u4.length-direct',
    detect: 'diagnose',
  },
  {
    code: 'MC-MEASURE-CURVE',
    label: '구부러진 것의 길이를 직선 거리로 판단',
    units: ['g1s1u4'],
    backtrack: 'g1s1u4.length-direct',
    detect: 'diagnose',
  },
  {
    code: 'MC-SIZE-IS-WEIGHT',
    label: '보이는 크기·높이로 무게·들이 판단',
    units: ['g1s1u4'],
    backtrack: 'g1s1u4.weight-direct',
    detect: 'diagnose',
  },
  {
    code: 'MC-MEASURE-GAP',
    label: '단위를 반복할 때 틈·겹침',
    units: ['g2s1u4'],
    backtrack: 'g2s1u4.unit-iteration',
    detect: 'observation',
  },
  {
    code: 'MC-MEASURE-UNIT-SIZE',
    label: '단위의 크기를 무시하고 단위 수만 비교',
    units: ['g2s1u4'],
    backtrack: 'g2s1u4.standard-unit',
    detect: 'diagnose',
  },
  {
    code: 'MC-LENGTH-UNIT-MIX',
    label: 'm와 cm를 변환할 때 자릿수를 이어붙임',
    units: ['g2s2u3'],
    backtrack: 'g2s2u3.meter-unit',
    detect: 'diagnose',
  },
  {
    code: 'MC-LENGTH-NO-PROMOTE',
    label: 'cm가 100 이상인데 m로 바꾸지 않음',
    units: ['g2s2u3'],
    backtrack: 'g2s2u3.m-cm-convert',
    detect: 'observation',
  },
  {
    code: 'MC-CLOCK-MINUTE-NUMERAL',
    label: '긴바늘이 가리키는 숫자를 그대로 분으로 읽음',
    units: ['g2s2u4'],
    backtrack: 'g2s2u4.clock-minute',
    detect: 'diagnose',
  },
  {
    code: 'MC-TIME-BASE-100',
    label: '1시간을 100분처럼 십진으로 계산',
    units: ['g2s2u4', 'g3s1u5'],
    backtrack: 'g2s2u4.hour-60',
    detect: 'diagnose',
  },
  {
    code: 'MC-MEAS-UNIT-CONVERT',
    label: '단위 변환 배수 오류',
    units: ['g3s1u5', 'g3s2u5'],
    backtrack: 'g3s1u5.mm-unit',
    detect: 'diagnose',
  },
  {
    code: 'MC-MEAS-CAPACITY-SHAPE',
    label: '길쭉한 그릇이 들이가 많다고 생각',
    units: ['g3s2u5'],
    backtrack: 'g3s2u5.capacity-units',
    detect: 'diagnose',
  },
  {
    code: 'MC-MEAS-WEIGHT-SIZE',
    label: '크면 무겁다고 생각',
    units: ['g3s2u5'],
    backtrack: 'g3s2u5.weight-units',
    detect: 'diagnose',
  },
  {
    code: 'MC-MEAS-MIXED-UNIT-CALC',
    label: '다른 단위가 섞인 계산에서 정리 실패',
    units: ['g3s2u5'],
    backtrack: 'g3s2u5.measure-add-sub',
    detect: 'diagnose',
  },
  {
    code: 'MC-SORT-INCONSISTENT',
    label: '분류 도중 기준을 바꿈',
    units: ['g2s1u5'],
    backtrack: 'g2s1u5.clear-criterion',
    detect: 'observation',
  },
  {
    code: 'MC-SORT-SUBJECTIVE',
    label: '주관적 기준으로 분류',
    units: ['g2s1u5'],
    backtrack: 'g2s1u5.clear-criterion',
    detect: 'diagnose',
  },
  {
    code: 'MC-RANGE-BOUNDARY-INCLUSION',
    label: '이상·초과·이하·미만의 경계 포함 여부 혼동',
    units: ['g5s2u1'],
    backtrack: 'g5s2u1.inclusive-bounds',
    detect: 'observation',
  },
  {
    code: 'MC-ROUND-WRONG-PLACE',
    label: '어림할 자리가 아닌 다른 자리를 보고 판단',
    units: ['g5s2u1'],
    backtrack: 'g4s1u1.place-value-big',
    detect: 'diagnose',
  },
  {
    code: 'MC-ROUND-CONTEXT-BLIND',
    label: '상황과 상관없이 항상 반올림',
    units: ['g5s2u1'],
    backtrack: 'g5s2u1.rounding-decision',
    detect: 'diagnose',
  },
];
