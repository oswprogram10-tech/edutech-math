/**
 * W3 오개념 레지스트리(39개).
 *
 * `docs/05-learning-engine.md` §5 표에서 W3 12개 단원(g1s2u3, g2s1u2, g3s1u2,
 * g3s2u3, g4s1u2, g4s1u4, g4s2u2, g4s2u4, g4s2u6, g5s1u6, g5s2u3, g6s2u5) 중
 * 하나라도 쓰는 코드를 옮겼다. W4·W6로 미룬 활동(시계, 쌓기나무, 굴렁쇠)의
 * 코드도 함께 등록한다.
 *
 * `units`는 docs/05 §5 표의 단원 열 전체다(W4 이후 단원도 포함).
 * `backtrack`은 단원 명세 오개념 표의 ③ 열에 있는 개념·단원 ID다. 한 코드가
 * 여러 단원에 나오면 카드에 적은 첫 단원의 값을 쓴다.
 *
 * `detect: 'observation'` 코드는 감지 함수를 만들지 않는다. 힌트의
 * `when: {misconception}`로는 걸리지 않으므로 콘텐츠는 엔진 predicate나
 * GoalSpec을 쓴다(교사 기록·역추적용으로만 레지스트리에 둔다).
 */
import type { Misconception } from './misconceptions';

export const W3_MISCONCEPTIONS: readonly Misconception[] = [
  {
    code: 'MC-ANGLE-SIDE-LENGTH',
    label: '변이 길면 각이 크다고 생각',
    units: ['g4s1u2'],
    backtrack: 'g3s1u2.angle-right-angle',
    detect: 'diagnose',
  },
  {
    code: 'MC-ANGLE-SUM-SHAPE-DEPENDENT',
    label: '삼각형이 크면 각의 합도 크다고 생각',
    units: ['g4s1u2'],
    backtrack: 'g4s1u2.triangle-sum',
    detect: 'diagnose',
  },
  {
    code: 'MC-ANGLE-WRONG-SCALE',
    label: '각도기 안쪽·바깥쪽 눈금 혼동',
    units: ['g4s1u2'],
    backtrack: 'g4s1u2.angle-measure',
    detect: 'diagnose',
  },
  {
    code: 'MC-ANGLE-ZERO-LINE',
    label: '한 변을 0°에 맞추지 않고 읽음',
    units: ['g4s1u2'],
    backtrack: 'g4s1u2.angle-measure',
    detect: 'observation',
  },
  {
    code: 'MC-AREA-SLANT-SIDE',
    label: '평행사변형 넓이에 옆변을 높이로 사용',
    units: ['g5s1u6'],
    backtrack: 'g5s1u6.area-conservation',
    detect: 'diagnose',
  },
  {
    code: 'MC-AREA-TRIANGLE-NO-HALF',
    label: '삼각형 넓이에서 ÷2 누락',
    units: ['g5s1u6'],
    backtrack: 'g5s1u6.derive-formulas',
    detect: 'diagnose',
  },
  {
    code: 'MC-AREA-UNIT-CONFUSION',
    label: '길이 단위와 넓이 단위 혼동',
    units: ['g5s1u6'],
    backtrack: 'g5s1u6.unit-area-rectangle',
    detect: 'diagnose',
  },
  {
    code: 'MC-CIRCLE-AREA-AS-CIRCUMFERENCE',
    label: '원의 넓이와 원주 공식 혼동',
    units: ['g6s2u5'],
    backtrack: 'g5s1u6.perimeter-vs-area',
    detect: 'diagnose',
  },
  {
    code: 'MC-CIRCLE-AREA-RECT-WIDTH',
    label: '재배열 직사각형의 가로를 원주 전체로 봄',
    units: ['g6s2u5'],
    backtrack: 'g6s2u5.area-by-rearrange',
    detect: 'diagnose',
  },
  {
    code: 'MC-CIRCLE-PI-EXACT',
    label: '원주율이 정확히 3(또는 3.14)이라고 생각',
    units: ['g6s2u5'],
    backtrack: 'g6s2u5.circumference-diameter-ratio',
    detect: 'diagnose',
  },
  {
    code: 'MC-CLOCK-HANDS',
    label: '긴바늘·짧은바늘 역할 혼동',
    units: ['g1s2u3'],
    backtrack: 'g1s2u3.clock-hour',
    detect: 'observation',
  },
  {
    code: 'MC-CLOCK-HOUR-BETWEEN',
    label: '짧은바늘이 두 수 사이일 때 다음 시로 읽음',
    units: ['g1s2u3', 'g2s2u4'],
    backtrack: 'g1s2u3.clock-hour',
    detect: 'diagnose',
  },
  {
    code: 'MC-CONG-SIZE-ONLY',
    label: '넓이가 같으면 합동이라고 생각',
    units: ['g5s2u3'],
    backtrack: 'g5s2u3.congruence',
    detect: 'diagnose',
  },
  {
    code: 'MC-GEO-ACUTE-TRI-ONE-ANGLE',
    label: '예각이 하나라도 있으면 예각삼각형이라 생각',
    units: ['g4s2u2'],
    backtrack: 'g4s2u2.classify-by-angles',
    detect: 'observation',
  },
  {
    code: 'MC-GEO-COMPASS-WIDTH',
    label: '컴퍼스 벌린 폭을 지름으로 생각',
    units: ['g3s2u3'],
    backtrack: 'g3s2u3.compass-construct',
    detect: 'observation',
  },
  {
    code: 'MC-GEO-DIAGONAL-ADJACENT',
    label: '이웃한 꼭짓점을 이은 선분도 대각선이라 생각',
    units: ['g4s2u6'],
    backtrack: 'g4s2u6.diagonal',
    detect: 'observation',
  },
  {
    code: 'MC-GEO-DIAGONAL-COUNT-DOUBLE',
    label: '대각선을 중복해서 셈',
    units: ['g4s2u6'],
    backtrack: 'g4s2u6.diagonal',
    detect: 'diagnose',
  },
  {
    code: 'MC-GEO-DIAMETER-ANY-CHORD',
    label: '중심을 지나지 않는 선분도 지름이라 생각',
    units: ['g3s2u3'],
    backtrack: 'g3s2u3.circle-definition',
    detect: 'observation',
  },
  {
    code: 'MC-GEO-EQUI-NOT-ISO',
    label: '정삼각형은 이등변삼각형이 아니라고 생각',
    units: ['g4s2u2'],
    backtrack: 'g4s2u2.classify-by-sides',
    detect: 'diagnose',
  },
  {
    code: 'MC-GEO-EYEBALL-CONSTRUCT',
    label: '눈대중 작도로 성질이 보장된다고 생각',
    units: ['g4s2u2'],
    backtrack: 'g4s2u2.construct-isosceles',
    detect: 'observation',
  },
  {
    code: 'MC-GEO-PARALLELOGRAM-NOT-TRAPEZOID',
    label: '평행사변형은 사다리꼴이 아니라고 생각',
    units: ['g4s2u4'],
    backtrack: 'g4s2u4.quad-definitions',
    detect: 'diagnose',
  },
  {
    code: 'MC-GEO-POLYGON-CURVE',
    label: '곡선이 있거나 열린 도형도 다각형이라 생각',
    units: ['g4s2u6'],
    backtrack: 'g4s2u6.polygon-definition',
    detect: 'observation',
  },
  {
    code: 'MC-GEO-PROTOTYPE-ONLY',
    label: '대표 모양만 그 도형으로 인정',
    units: ['g4s2u4'],
    backtrack: 'g4s2u4.quad-definitions',
    detect: 'observation',
  },
  {
    code: 'MC-GEO-RADIUS-DIAMETER',
    label: '반지름과 지름 혼동, 2배 관계 모름',
    units: ['g3s2u3', 'g6s2u5'],
    backtrack: 'g3s2u3.radius-diameter',
    detect: 'diagnose',
  },
  {
    code: 'MC-GEO-RAY-LINE-CONFUSE',
    label: '선분·반직선·직선 혼동',
    units: ['g3s1u2'],
    backtrack: 'g2s1u2',
    detect: 'observation',
  },
  {
    code: 'MC-GEO-REGULAR-EQUAL-SIDES',
    label: '변의 길이만 같으면 정다각형이라 생각',
    units: ['g4s2u6'],
    backtrack: 'g4s2u6.polygon-definition',
    detect: 'observation',
  },
  {
    code: 'MC-GEO-RHOMBUS-ORIENT',
    label: '놓인 방향으로 마름모·정사각형을 판단',
    units: ['g4s2u4'],
    backtrack: 'g4s2u4.quad-definitions',
    detect: 'observation',
  },
  {
    code: 'MC-GEO-RIGHT-ANGLE-ORIENT',
    label: '기울어진 직각을 직각으로 인식하지 못함',
    units: ['g3s1u2'],
    backtrack: 'g3s1u2.angle-right-angle',
    detect: 'observation',
  },
  {
    code: 'MC-GEO-SQUARE-NOT-RECT',
    label: '정사각형은 직사각형이 아니라고 생각',
    units: ['g3s1u2', 'g4s2u4'],
    backtrack: 'g3s1u2.rect-square',
    detect: 'diagnose',
  },
  {
    code: 'MC-GEO-TRI-ISOSCELES-ORIENT',
    label: '꼭짓각이 위에 있어야 이등변삼각형이라 생각',
    units: ['g4s2u2'],
    backtrack: 'g4s2u2.classify-by-sides',
    detect: 'observation',
  },
  {
    code: 'MC-PERIMETER-AREA-SAME',
    label: '둘레가 같으면 넓이도 같다',
    units: ['g5s1u6', 'g6s1u6'],
    backtrack: 'g3s2u1',
    detect: 'diagnose',
  },
  {
    code: 'MC-SHAPE-ORIENTATION',
    label: '방향이 바뀌면 다른 모양이라 생각',
    units: ['g1s1u2', 'g1s2u3', 'g2s1u2'],
    backtrack: 'g1s1u2.ignore-irrelevant',
    detect: 'diagnose',
  },
  {
    code: 'MC-SHAPE-VERTEX-COUNT',
    label: '꺾이지 않는 점까지 꼭짓점으로 셈',
    units: ['g2s1u2'],
    backtrack: 'g2s1u2.side-vertex',
    detect: 'diagnose',
  },
  {
    code: 'MC-SPATIAL-LEFT-RIGHT',
    label: '앞·뒤·왼쪽·오른쪽 기준(보는 사람) 혼동',
    units: ['g2s1u2'],
    backtrack: 'g2s1u2.cube-building',
    detect: 'observation',
  },
  {
    code: 'MC-SYM-DIAGONAL-AXIS',
    label: '대각선을 대칭축으로 잘못 봄',
    units: ['g5s2u3'],
    backtrack: 'g4s1u4',
    detect: 'observation',
  },
  {
    code: 'MC-SYM-POINT-AS-LINE',
    label: '점대칭을 선대칭(뒤집기)과 혼동',
    units: ['g5s2u3'],
    backtrack: 'g4s1u4',
    detect: 'observation',
  },
  {
    code: 'MC-TRANS-FLIP-TURN',
    label: '뒤집기와 180° 돌리기 혼동',
    units: ['g4s1u4'],
    backtrack: 'g4s1u4.flip',
    detect: 'observation',
  },
  {
    code: 'MC-TRANS-TURN-CENTER',
    label: '돌리는 중심을 무시',
    units: ['g4s1u4'],
    backtrack: 'g4s1u4.turn',
    detect: 'observation',
  },
  {
    code: 'MC-TRANS-TURN-DIRECTION',
    label: '시계 방향·반대 방향 혼동',
    units: ['g4s1u4'],
    backtrack: 'g4s1u4.turn',
    detect: 'observation',
  },
];
