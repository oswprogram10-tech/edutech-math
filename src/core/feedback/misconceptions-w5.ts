/**
 * W5 오개념 레지스트리(33개).
 *
 * `docs/05-learning-engine.md` §5 표에서 W5 13개 단원(g1s2u5, g2s2u5, g2s2u6,
 * g3s2u6, g4s1u5, g4s1u6, g4s2u5, g5s1u1, g5s1u3, g5s2u6, g6s1u4, g6s1u5,
 * g6s2u4) 중 하나라도 쓰는 코드 가운데 W1~W3에 아직 없는 것을 옮겼다.
 * `MC-COUNT-ONE-TO-ONE`·`MC-CHART-ROW-COL`은 W2에 이미 있어 다시 넣지 않는다.
 *
 * `units`는 docs/05 §5 표의 단원 열 전체다(W6 이후 단원도 포함).
 * `backtrack`은 단원 명세 오개념 표의 ③ 열에 있는 개념·단원 ID다. 한 코드가
 * 여러 단원에 나오면 카드에 적은 첫 단원의 값을 쓰고, ③ 열이 단원 이름이나
 * 설명이면 카드가 고정한 개념 ID를 쓴다.
 *
 * `detect: 'observation'` 코드는 감지 함수를 만들지 않는다. 힌트의
 * `when: {misconception}`로는 걸리지 않으므로 콘텐츠는 엔진 predicate나
 * GoalSpec을 쓴다(교사 기록·역추적용으로만 레지스트리에 둔다).
 */
import type { Misconception } from './misconceptions';

export const W5_MISCONCEPTIONS: readonly Misconception[] = [
  {
    code: 'MC-CHANCE-GAMBLER',
    label: '앞 결과가 다음 결과에 영향을 준다고 생각',
    units: ['g5s2u6'],
    backtrack: 'g5s2u6.likelihood',
    detect: 'diagnose',
  },
  {
    code: 'MC-CHANCE-SMALL-SAMPLE',
    label: '적은 시행으로 가능성을 단정',
    units: ['g5s2u6'],
    backtrack: 'g5s2u6.likelihood',
    detect: 'diagnose',
  },
  {
    code: 'MC-CORR-SWAP-VARS',
    label: '대응 관계식에서 두 양을 바꾸어 씀',
    units: ['g5s1u3'],
    backtrack: 'g5s1u3.correspondence-table',
    detect: 'observation',
  },
  {
    code: 'MC-FUNC-ADD-ONLY',
    label: '입출력 규칙을 덧셈으로만 찾음',
    units: ['g4s1u6'],
    backtrack: 'g4s1u6.number-pattern',
    detect: 'observation',
  },
  {
    code: 'MC-GRAPH-AREA-AS-AMOUNT',
    label: '전체 수가 다른 원그래프의 조각 크기를 개수로 비교',
    units: ['g6s1u5'],
    backtrack: 'g6s1u5.band-graph',
    detect: 'diagnose',
  },
  {
    code: 'MC-GRAPH-BAR-WIDTH',
    label: '막대 길이 대신 굵기·위치로 비교',
    units: ['g4s1u5'],
    backtrack: 'g4s1u5.bar-graph-make',
    detect: 'diagnose',
  },
  {
    code: 'MC-GRAPH-GAP-ORDER',
    label: '그래프를 아래부터 빈칸 없이 채우지 않음',
    units: ['g2s2u5'],
    backtrack: 'g2s2u5.simple-graph',
    detect: 'observation',
  },
  {
    code: 'MC-GRAPH-HEIGHT-NOT-CHANGE',
    label: '가장 높은 점을 가장 많이 변한 때로 생각',
    units: ['g4s2u5'],
    backtrack: 'g4s2u5.read-change',
    detect: 'diagnose',
  },
  {
    code: 'MC-GRAPH-ICON-COUNT-COMPARE',
    label: '그림 개수가 많은 행이 큰 값이라 판단',
    units: ['g3s2u6'],
    backtrack: 'g3s2u6.pictograph-units',
    detect: 'diagnose',
  },
  {
    code: 'MC-GRAPH-ICON-VALUE',
    label: '그림 단위를 무시하고 그림 개수만 셈',
    units: ['g3s2u6', 'g4s1u5'],
    backtrack: 'g3s2u6.pictograph-units',
    detect: 'diagnose',
  },
  {
    code: 'MC-GRAPH-NO-INTERPOLATE',
    label: '측정하지 않은 중간 값을 어림하지 못함',
    units: ['g4s2u5'],
    backtrack: 'g4s2u5.interpolate-predict',
    detect: 'diagnose',
  },
  {
    code: 'MC-GRAPH-PERCENT-AS-COUNT',
    label: '띠·원그래프에 개수를 칸 수로 그대로 사용',
    units: ['g6s1u5'],
    backtrack: 'g6s1u4.percent',
    detect: 'observation',
  },
  {
    code: 'MC-GRAPH-SCALE-ONE',
    label: '눈금 한 칸을 항상 1로 읽음',
    units: ['g4s1u5', 'g4s2u5'],
    backtrack: 'g4s1u5.scale-unit',
    detect: 'diagnose',
  },
  {
    code: 'MC-GRAPH-TABLE-MISMATCH',
    label: '표와 그래프의 값이 다름',
    units: ['g2s2u5'],
    backtrack: 'g2s2u5.collect-table',
    detect: 'observation',
  },
  {
    code: 'MC-GRAPH-TRUNCATED-AXIS',
    label: '0에서 시작하지 않는 세로축의 길이 차를 그대로 믿음',
    units: ['g6s1u5'],
    backtrack: 'g4s1u5.scale-unit',
    detect: 'diagnose',
  },
  {
    code: 'MC-GRAPH-WAVY-LINE',
    label: '물결선을 잘못 읽음',
    units: ['g4s2u5'],
    backtrack: 'g4s2u5.wavy-line',
    detect: 'diagnose',
  },
  {
    code: 'MC-MEAN-MIDDLE-VALUE',
    label: '평균을 가운데 값으로 생각',
    units: ['g5s2u6'],
    backtrack: 'g5s2u6.mean-as-leveling',
    detect: 'diagnose',
  },
  {
    code: 'MC-MEAN-SUM-ONLY',
    label: '합만 구하고 나누지 않음',
    units: ['g5s2u6'],
    backtrack: 'g5s2u6.mean-compute',
    detect: 'diagnose',
  },
  {
    code: 'MC-ORDER-LEFT-TO-RIGHT',
    label: '혼합 계산에서 무조건 왼쪽부터 계산',
    units: ['g5s1u1'],
    backtrack: 'g5s1u1.order-mul-div-first',
    detect: 'diagnose',
  },
  {
    code: 'MC-ORDER-MUL-BEFORE-DIV',
    label: '곱셈을 나눗셈보다 항상 먼저 계산',
    units: ['g5s1u1'],
    backtrack: 'g5s1u1.same-level-left-to-right',
    detect: 'diagnose',
  },
  {
    code: 'MC-ORDER-PAREN-IGNORED',
    label: '괄호를 무시하고 계산',
    units: ['g5s1u1'],
    backtrack: 'g5s1u1.parentheses-first',
    detect: 'diagnose',
  },
  {
    code: 'MC-PATTERN-CORE',
    label: '반복 단위를 잘못 잡음',
    units: ['g1s2u5'],
    backtrack: 'g1s2u5.repeat-core',
    detect: 'observation',
  },
  {
    code: 'MC-PATTERN-GROWTH-TOTAL',
    label: '성장 패턴에서 증가분과 전체 개수 혼동',
    units: ['g2s2u6'],
    backtrack: 'g2s2u6.growth-pattern',
    detect: 'diagnose',
  },
  {
    code: 'MC-PATTERN-LAST-ONLY',
    label: '마지막 몇 개만 보고 다음을 정함',
    units: ['g1s2u5', 'g2s2u6'],
    backtrack: 'g1s2u5.repeat-core',
    detect: 'diagnose',
  },
  {
    code: 'MC-PATTERN-ONE-PAIR',
    label: '한 쌍만 맞는 규칙을 일반 규칙이라 생각',
    units: ['g4s1u6', 'g5s1u3'],
    backtrack: 'g4s1u6.io-rule',
    detect: 'observation',
  },
  {
    code: 'MC-PATTERN-RECURSIVE-ONLY',
    label: '앞 항에서만 다음 항을 구해 먼 항 예측 실패',
    units: ['g4s1u6', 'g5s1u3'],
    backtrack: 'g4s1u6.shape-calc-link',
    detect: 'observation',
  },
  {
    code: 'MC-PATTERN-TRANSLATE',
    label: '표현을 바꿀 때 대응을 섞음',
    units: ['g1s2u5'],
    backtrack: 'g1s2u5.translate-pattern',
    detect: 'observation',
  },
  {
    code: 'MC-PERCENT-AS-NUMBER',
    label: '백분율을 그냥 수로 계산',
    units: ['g6s1u4'],
    backtrack: 'g6s1u4.percent',
    detect: 'diagnose',
  },
  {
    code: 'MC-PROPORTION-CROSS-WRONG',
    label: '외항·내항을 잘못 짝지음',
    units: ['g6s2u4'],
    backtrack: 'g6s2u4.extremes-means',
    detect: 'diagnose',
  },
  {
    code: 'MC-PROPORTION-DIVIDE-BY-RATIO-TERM',
    label: '비례배분에서 전체를 비의 한 항으로 나눔',
    units: ['g6s2u4'],
    backtrack: 'g6s2u4.proportional-distribution',
    detect: 'observation',
  },
  {
    code: 'MC-RATE-DISTANCE-ONLY',
    label: '거리(또는 시간)만 보고 빠르기 판단',
    units: ['g6s1u4'],
    backtrack: 'g6s1u4.ratio-value',
    detect: 'diagnose',
  },
  {
    code: 'MC-RATIO-ADDITIVE',
    label: '비를 덧셈적으로 늘림',
    units: ['g6s1u4', 'g6s2u4'],
    backtrack: 'g6s1u4.difference-vs-ratio',
    detect: 'diagnose',
  },
  {
    code: 'MC-RATIO-ORDER',
    label: '기준량과 비교하는 양의 순서 혼동',
    units: ['g6s1u4'],
    backtrack: 'g6s1u4.ratio-notation',
    detect: 'diagnose',
  },
];
