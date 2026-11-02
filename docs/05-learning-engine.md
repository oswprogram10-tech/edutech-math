# 05. 학습 엔진: 지식 그래프 · 숙달 추정 · 역추적 · 힌트

원 계획서의 Neo4j·BKT·LLM 튜터를 **무료·오프라인·결정론적**으로 바꾼 설계다. 모두 브라우저 안에서 돌고, 모두 단위 테스트할 수 있다.

## 1. 지식 그래프

### 파일
- `data/units.json` — 단원 노드와 단원 간 선수 관계(71개)
- `data/concepts.json` — 개념 노드. `docs/04-units/*.md`의 "개념 노드" 표에서 스크립트로 생성(`scripts/build-concepts.mjs`, 작업 카드 `T013`)

```jsonc
// data/concepts.json
{
  "concepts": [
    {
      "id": "g5s1u4.common-denominator",
      "unit": "g5s1u4",
      "label": "통분: 분모를 같게 만들기",
      "prerequisites": ["g5s1u4.equivalent-fraction", "g5s1u2"],  // 개념 ID 또는 단원 ID
      "boosters": ["g3s1u6.A1"]   // 역추적 시 보낼 마이크로 활동(선택)
    }
  ]
}
```

### 규칙
- 그래프는 **DAG**여야 한다(순환 금지). 빌드 스크립트가 순환과 존재하지 않는 ID를 검사해 실패시킨다.
- 단원 ID를 선수로 걸면 "그 단원의 모든 개념"을 뜻한다. 역추적할 때는 그 단원의 개념 중 숙달도가 가장 낮은 것부터 본다.

## 2. 숙달 추정 (단순화한 BKT)

개념마다 숙달 확률 `p`(0~1)를 기기 안에 저장한다.

```
초깃값 p0 = 0.3  (선수 개념이 모두 숙달이면 0.5에서 시작)
과제 결과가 나올 때마다:
  정답(힌트 없음):        p ← p + (1 − p) × 0.35
  정답(힌트 ① 사용):      p ← p + (1 − p) × 0.20
  정답(힌트 ② 이상):      p ← p + (1 − p) × 0.05
  오답:                   p ← p × 0.75
숙달: p ≥ 0.8 이고 서로 다른 과제 2개 이상에서 정답
```
- 계수는 상수 파일(`core/knowledge/params.ts`)에 두고 파일럿 뒤 조정한다. 정식 BKT(학습·추측·실수 확률 추정)는 데이터가 쌓인 뒤 3단계에서 검토한다.
- 학생에게 확률 숫자를 보여 주지 않는다. 별자리의 별 밝기(어둠/희미/빛남) 3단계로만 보여 준다.

## 3. 역추적 (무학년 선수 개념 부스터)

```
trigger: 같은 과제에서
  (a) 힌트 ②까지 받은 뒤에도 실패, 또는
  (b) 오개념 코드의 'backtrack' 대상이 지정되어 있고 그 코드가 2회 감지
then:
  1. 현재 과제의 concepts → 선수 개념 집합을 DAG로 거슬러 올라가며 BFS
  2. p < 0.6 인 가장 가까운(깊이가 얕은) 선수 개념 선택. 동률이면 p가 낮은 것
  3. 그 개념의 booster 활동(없으면 그 개념을 가진 활동의 첫 과제)을 "잠깐 연습" 창으로 연다
     - 학년 표시 없음. 2~3분 분량(과제 2~3개)
  4. 부스터 통과 → 원래 과제로 돌아와 힌트 ①부터 다시 시작
     부스터 실패 → 한 단계 더 거슬러 올라감(최대 깊이 3). 깊이 3에서도 실패하면
                  교사 알림 대상에 올린다(2단계) / 1단계에서는 '선생님께 도움 요청' 카드
```
- 오개념 코드마다 우선 역추적 대상을 지정할 수 있다(아래 §5 레지스트리의 `backtrack` 열).

## 4. 힌트 규칙 엔진 (규칙 기반 소크라테스식 발문)

LLM 없이 **오개념 코드 → 발문 템플릿** 매핑으로 동작한다.

```ts
interface HintRule {
  when: GoalSpec | { misconception: string };  // Observation 조건 또는 diagnose()가 낸 오개념 코드
  level: 1 | 2 | 3;
  say?: string;          // ① 발문 (템플릿 변수: {a}, {b}, {student})
  show?: { engine: EngineId; overlay: string; args?: unknown };  // ② 시각적 반례 (엔진이 제공하는 오버레이)
  backtrack?: string;    // ③ 개념 ID 또는 단원 ID
}
```
- 같은 과제에서 실패할 때마다 level이 하나씩 오른다. 과제가 바뀌면 1로 돌아간다.
- **발문 작성 규칙:** ① 학생이 방금 만든 것을 언급한다 ② 예/아니오로 끝나는 질문보다 "어떻게/왜/몇"을 쓴다 ③ 정답 수치를 말하지 않는다 ④ 저학년은 15자 안팎, TTS로 자연스럽게 읽힌다.
- ② 단계의 시각적 반례는 각 엔진이 `overlays`로 제공한다(예: E05 `size-compare`는 학생이 만든 조각들을 겹쳐 크기 차이를 보여 줌; E08 `bar-check`는 학생 식의 양변을 막대로 그려 불균형을 보여 줌).

### 3단계(선택): LLM 발문 보조
- 예산이 생기면 규칙 엔진이 고른 *발문 의도*와 Observation만 서버 프록시로 보내 문장을 다듬는다. 학생 식별 정보, 자유 입력 텍스트는 보내지 않는다. 숫자 계산은 절대 LLM에 맡기지 않는다.

## 5. 오개념 레지스트리

모든 단원 명세의 오개념 표를 모은 목록이다. 코드 하나가 여러 단원에서 쓰일 수 있다. 구현할 때 `src/core/feedback/misconceptions.ts`로 옮긴다.
**아래 표는 단원 명세에서 자동으로 모은 것이다(`scripts/check-specs.mjs --list-mc`).**

<!-- MC-REGISTRY:START -->
| 코드 | 뜻 | 단원 |
| --- | --- | --- |
| `MC-3D-HIDDEN-UNCOUNTED` | 보이지 않는 면·모서리를 세지 않음 | g5s2u5, g6s1u2, g6s2u3 |
| `MC-ADD-BRIDGE-OFF-BY-ONE` | 10을 넘긴 뒤 남은 수를 1 차이로 셈 | g1s2u6 |
| `MC-ADD-COUNT-ALL` | 모을 때 항상 처음부터 다 셈(이어 세기 미사용) | g1s1u3, g1s2u4 |
| `MC-ANGLE-SIDE-LENGTH` | 변이 길면 각이 크다고 생각 | g4s1u2 |
| `MC-ANGLE-SUM-SHAPE-DEPENDENT` | 삼각형이 크면 각의 합도 크다고 생각 | g4s1u2 |
| `MC-ANGLE-WRONG-SCALE` | 각도기 안쪽·바깥쪽 눈금 혼동 | g4s1u2 |
| `MC-ANGLE-ZERO-LINE` | 한 변을 0°에 맞추지 않고 읽음 | g4s1u2 |
| `MC-AREA-SLANT-SIDE` | 평행사변형 넓이에 옆변을 높이로 사용 | g5s1u6 |
| `MC-AREA-TRIANGLE-NO-HALF` | 삼각형 넓이에서 ÷2 누락 | g5s1u6 |
| `MC-AREA-UNIT-CONFUSION` | 길이 단위와 넓이 단위 혼동 | g5s1u6 |
| `MC-BIGNUM-FIRST-DIGIT` | 자릿수를 보지 않고 맨 앞 숫자만 비교 | g4s1u1 |
| `MC-BIGNUM-GROUP3` | 세 자리 쉼표 끊기와 혼동해 읽음 | g4s1u1 |
| `MC-BIGNUM-ZERO-PLACE` | 읽지 않는 자리의 0 누락 | g4s1u1 |
| `MC-CHANCE-GAMBLER` | 앞 결과가 다음 결과에 영향을 준다고 생각 | g5s2u6 |
| `MC-CHANCE-SMALL-SAMPLE` | 적은 시행으로 가능성을 단정 | g5s2u6 |
| `MC-CHART-ROW-COL` | 수 배열표에서 아래 칸도 1 커진다고 생각 | g1s2u1, g2s2u6 |
| `MC-CIRCLE-AREA-AS-CIRCUMFERENCE` | 원의 넓이와 원주 공식 혼동 | g6s2u5 |
| `MC-CIRCLE-AREA-RECT-WIDTH` | 재배열 직사각형의 가로를 원주 전체로 봄 | g6s2u5 |
| `MC-CIRCLE-PI-EXACT` | 원주율이 정확히 3(또는 3.14)이라고 생각 | g6s2u5 |
| `MC-CLOCK-HANDS` | 긴바늘·짧은바늘 역할 혼동 | g1s2u3 |
| `MC-CLOCK-HOUR-BETWEEN` | 짧은바늘이 두 수 사이일 때 다음 시로 읽음 | g1s2u3, g2s2u4 |
| `MC-CLOCK-MINUTE-NUMERAL` | 긴바늘이 가리키는 숫자를 그대로 분으로 읽음 | g2s2u4 |
| `MC-COMMON-DENOM-ONLY-PRODUCT` | 공통분모는 두 분모의 곱이어야만 한다 | g5s1u4 |
| `MC-COMPARE-DIGIT-COUNT` | 높은 자리부터 비교하지 않고 다른 자리로 크기 판단 | g2s2u1 |
| `MC-COMPARE-SPREAD` | 넓게 퍼진 쪽이 더 많다고 판단(수 보존 실패) | g1s1u1 |
| `MC-CONE-AS-PYRAMID` | 원뿔을 각뿔의 한 종류로 분류 | g6s2u6 |
| `MC-CONG-SIZE-ONLY` | 넓이가 같으면 합동이라고 생각 | g5s2u3 |
| `MC-CORR-SWAP-VARS` | 대응 관계식에서 두 양을 바꾸어 씀 | g5s1u3 |
| `MC-COUNT-LAST-NOT-TOTAL` | 마지막에 센 수가 전체 개수임을 모름 | g1s1u1 |
| `MC-COUNT-ONE-TO-ONE` | 같은 것을 두 번 세거나 빠뜨림(일대일 대응 실패) | g1s1u1, g1s1u5, g2s1u5, g2s2u5 |
| `MC-CYL-NET-WIDTH-DIAMETER` | 원기둥 전개도 옆면 가로를 지름으로 봄 | g6s2u6 |
| `MC-DEC-ALIGN-RIGHT` | 소수점 대신 오른쪽 끝을 맞춤 | g4s2u3 |
| `MC-DEC-DIV-SCALE-ONE-SIDE` | 소수 나눗셈에서 한쪽 수만 10배·100배 함 | g6s2u2 |
| `MC-DEC-LONGER-BIGGER` | 자릿수가 많으면 큰 소수라고 생각 | g4s2u3 |
| `MC-DEC-MULT-ALIGN-POINT` | 곱셈 세로셈에서도 소수점을 맞춰 정렬해야 한다고 생각 | g5s2u4 |
| `MC-DEC-POINT-PLACEMENT` | 곱(몫)의 소수점 위치 오류 | g5s2u4, g6s1u3 |
| `MC-DEC-POINT-SEPARATOR` | 소수점 뒤 숫자를 별개의 자연수로 봄 | g3s1u6, g4s2u3 |
| `MC-DEC-SHIFT-POINT-MOVES` | ×10 등을 '0 붙이기'로 처리해 크기를 바꾸지 않음 | g5s2u4 |
| `MC-DEC-TRAILING-ZERO` | 끝자리 0이 값을 바꾼다고 생각 | g4s2u3 |
| `MC-DIV-ALWAYS-SMALLER` | 나누면 항상 작아진다 | g6s1u1, g6s1u3, g6s2u1, g6s2u2 |
| `MC-DIV-BRING-DOWN` | 다음 자리 내림 누락 또는 남은 수를 버림 | g3s2u2 |
| `MC-DIV-CHECK-NO-REMAINDER` | 검산에서 나머지를 더하지 않음 | g3s2u2 |
| `MC-DIV-ESTIMATE-OFF` | 몫 어림이 너무 크거나 작음 | g4s1u3 |
| `MC-DIV-NO-EXTEND-ZERO` | 0을 내려 계속 나누지 않고 나머지로 멈춤 | g6s1u3 |
| `MC-DIV-ORDER-SWAP` | 나누어지는 수와 나누는 수를 바꿈 | g3s1u3 |
| `MC-DIV-QUOTIENT-ZERO` | 몫의 0 누락 | g3s2u2, g4s1u3, g6s1u3, g6s2u2 |
| `MC-DIV-REMAINDER-SCALED` | 나머지를 확대된 수 그대로 씀 | g6s2u2 |
| `MC-DIV-REMAINDER-TOO-BIG` | 나머지가 나누는 수와 같거나 큼 | g3s2u2, g4s1u3 |
| `MC-DIV-SHARE-ONLY` | 나눗셈을 등분제로만 이해 | g3s1u3 |
| `MC-DIV-UNEQUAL-SHARE` | 똑같지 않게 나눔 | g3s1u3 |
| `MC-EQUAL-ANSWER` | 등호를 "답 쓰는 곳"으로만 이해 | g1s1u3, g2s1u3 |
| `MC-FACTOR-MISSING-PAIR` | 약수를 짝으로 찾지 않아 일부 누락 | g5s1u2 |
| `MC-FACTOR-MULTIPLE-SWAP` | 약수와 배수를 혼동 | g5s1u2 |
| `MC-FRAC-ADD-DENOM` | 분모끼리도 더함 | g4s2u1, g5s1u5, g5s2u2 |
| `MC-FRAC-ADD-DENOM-HALF` | 분수 덧셈 결과의 분모를 2배로 함 | g4s2u1 |
| `MC-FRAC-ADD-NO-CONVERT-NUM` | 통분할 때 분모만 바꾸고 분자는 그대로 | g5s1u5 |
| `MC-FRAC-BIGGER-DENOM` | 분모가 크면 큰 분수라고 생각 | g3s1u6, g3s2u4, g5s1u4 |
| `MC-FRAC-BORROW-AS-TEN` | 받아내림한 1을 10/분모로 바꿈 | g4s2u1, g5s1u5 |
| `MC-FRAC-DEC-LINK` | 10분의 몇과 소수를 연결하지 못함 | g3s1u6 |
| `MC-FRAC-DISCRETE-COUNT` | 이산량 분수에서 분모를 개수로 봄 | g3s2u4 |
| `MC-FRAC-DIV-ACROSS` | 분자끼리·분모끼리 나누다 막힘 | g6s2u1 |
| `MC-FRAC-DIV-INVERT-WRONG` | 역수 곱셈에서 엉뚱한 수를 뒤집음 | g6s2u1 |
| `MC-FRAC-DIV-MULT-DENOM-WRONG` | ÷n에서 분자에 n을 곱함 | g6s1u1 |
| `MC-FRAC-DIV-REMAINDER-UNIT` | 남는 부분을 나누는 수가 아닌 전체 기준으로 읽음 | g6s2u1 |
| `MC-FRAC-DIV-WHOLE-NUMERATOR` | (분수)÷(자연수)에서 분자만 나누려다 막힘 | g6s1u1 |
| `MC-FRAC-EQUIV-ADD-SAME` | 분모·분자에 같은 수를 더해도 크기가 같다 | g5s1u4 |
| `MC-FRAC-GROUP-AS-UNIT` | 묶음 단위로 분수를 보지 못함 | g3s2u4 |
| `MC-FRAC-IMPROPER-INVALID` | 가분수는 분수가 아니라고 생각 | g3s2u4 |
| `MC-FRAC-MIXED-CONVERT` | 대분수↔가분수 변환에서 자연수 부분 처리 오류 | g3s2u4, g4s2u1 |
| `MC-FRAC-MULT-COMMON-DENOM` | 분수 곱셈에서도 통분부터 함 | g5s2u2 |
| `MC-FRAC-MULT-WHOLE-BOTH` | (자연수)×(분수)에서 분모에도 자연수를 곱함 | g5s2u2 |
| `MC-FRAC-NO-SIMPLIFY` | 계산 결과를 약분하지 않음 | g5s1u5 |
| `MC-FRAC-NUM-ONLY` | 분수를 두 개의 자연수로 봄 | g3s1u6 |
| `MC-FRAC-PART-PART` | 부분 대 부분으로 분수를 씀 | g3s1u6 |
| `MC-FRAC-SEPARATE-PARTS` | 분수 부분 합이 1을 넘어도 정리하지 않음 | g4s2u1 |
| `MC-FRAC-UNEQUAL-PARTS` | 크기가 다른 조각으로 등분했다고 생각 | g3s1u6, g5s1u4 |
| `MC-FRAC-WHOLE-COMPARE-ONLY` | 대분수 비교에서 한 부분만 봄 | g3s2u4 |
| `MC-FRAC-WHOLE-MINUS` | 자연수에서 분수를 뺄 때 자연수를 분수로 못 바꿈 | g4s2u1 |
| `MC-FUNC-ADD-ONLY` | 입출력 규칙을 덧셈으로만 찾음 | g4s1u6 |
| `MC-GCD-LCM-SWAP` | 최대공약수와 최소공배수를 바꾸어 답함 | g5s1u2 |
| `MC-GEO-ACUTE-TRI-ONE-ANGLE` | 예각이 하나라도 있으면 예각삼각형이라 생각 | g4s2u2 |
| `MC-GEO-COMPASS-WIDTH` | 컴퍼스 벌린 폭을 지름으로 생각 | g3s2u3 |
| `MC-GEO-DIAGONAL-ADJACENT` | 이웃한 꼭짓점을 이은 선분도 대각선이라 생각 | g4s2u6 |
| `MC-GEO-DIAGONAL-COUNT-DOUBLE` | 대각선을 중복해서 셈 | g4s2u6 |
| `MC-GEO-DIAMETER-ANY-CHORD` | 중심을 지나지 않는 선분도 지름이라 생각 | g3s2u3 |
| `MC-GEO-EQUI-NOT-ISO` | 정삼각형은 이등변삼각형이 아니라고 생각 | g4s2u2 |
| `MC-GEO-EYEBALL-CONSTRUCT` | 눈대중 작도로 성질이 보장된다고 생각 | g4s2u2 |
| `MC-GEO-PARALLELOGRAM-NOT-TRAPEZOID` | 평행사변형은 사다리꼴이 아니라고 생각 | g4s2u4 |
| `MC-GEO-POLYGON-CURVE` | 곡선이 있거나 열린 도형도 다각형이라 생각 | g4s2u6 |
| `MC-GEO-PROTOTYPE-ONLY` | 대표 모양만 그 도형으로 인정 | g4s2u4 |
| `MC-GEO-RADIUS-DIAMETER` | 반지름과 지름 혼동, 2배 관계 모름 | g3s2u3, g6s2u5 |
| `MC-GEO-RAY-LINE-CONFUSE` | 선분·반직선·직선 혼동 | g3s1u2 |
| `MC-GEO-REGULAR-EQUAL-SIDES` | 변의 길이만 같으면 정다각형이라 생각 | g4s2u6 |
| `MC-GEO-RHOMBUS-ORIENT` | 놓인 방향으로 마름모·정사각형을 판단 | g4s2u4 |
| `MC-GEO-RIGHT-ANGLE-ORIENT` | 기울어진 직각을 직각으로 인식하지 못함 | g3s1u2 |
| `MC-GEO-SQUARE-NOT-RECT` | 정사각형은 직사각형이 아니라고 생각 | g3s1u2, g4s2u4 |
| `MC-GEO-TRI-ISOSCELES-ORIENT` | 꼭짓각이 위에 있어야 이등변삼각형이라 생각 | g4s2u2 |
| `MC-GRAPH-AREA-AS-AMOUNT` | 전체 수가 다른 원그래프의 조각 크기를 개수로 비교 | g6s1u5 |
| `MC-GRAPH-BAR-WIDTH` | 막대 길이 대신 굵기·위치로 비교 | g4s1u5 |
| `MC-GRAPH-GAP-ORDER` | 그래프를 아래부터 빈칸 없이 채우지 않음 | g2s2u5 |
| `MC-GRAPH-HEIGHT-NOT-CHANGE` | 가장 높은 점을 가장 많이 변한 때로 생각 | g4s2u5 |
| `MC-GRAPH-ICON-COUNT-COMPARE` | 그림 개수가 많은 행이 큰 값이라 판단 | g3s2u6 |
| `MC-GRAPH-ICON-VALUE` | 그림 단위를 무시하고 그림 개수만 셈 | g3s2u6, g4s1u5 |
| `MC-GRAPH-NO-INTERPOLATE` | 측정하지 않은 중간 값을 어림하지 못함 | g4s2u5 |
| `MC-GRAPH-PERCENT-AS-COUNT` | 띠·원그래프에 개수를 칸 수로 그대로 사용 | g6s1u5 |
| `MC-GRAPH-SCALE-ONE` | 눈금 한 칸을 항상 1로 읽음 | g4s1u5, g4s2u5 |
| `MC-GRAPH-TABLE-MISMATCH` | 표와 그래프의 값이 다름 | g2s2u5 |
| `MC-GRAPH-TRUNCATED-AXIS` | 0에서 시작하지 않는 세로축의 길이 차를 그대로 믿음 | g6s1u5 |
| `MC-GRAPH-WAVY-LINE` | 물결선을 잘못 읽음 | g4s2u5 |
| `MC-JUMP-COUNT-START` | 수직선 점프에서 출발점을 1로 셈 | g1s2u2 |
| `MC-LAYER-FLOATING` | 층별 그림에서 아래층 지지 없이 위층을 칠함 | g6s2u3 |
| `MC-LCM-AS-PRODUCT` | 최소공배수는 항상 두 수의 곱이라고 생각 | g5s1u2 |
| `MC-LENGTH-NO-PROMOTE` | cm가 100 이상인데 m로 바꾸지 않음 | g2s2u3 |
| `MC-LENGTH-UNIT-MIX` | m와 cm를 변환할 때 자릿수를 이어붙임 | g2s2u3 |
| `MC-MAKE10-PAIR` | 10의 짝꿍을 1 차이로 틀림 | g1s2u4 |
| `MC-MAKE10-SPLIT` | 10 만들기 가르기 오류 | g1s2u6 |
| `MC-MEAN-MIDDLE-VALUE` | 평균을 가운데 값으로 생각 | g5s2u6 |
| `MC-MEAN-SUM-ONLY` | 합만 구하고 나누지 않음 | g5s2u6 |
| `MC-MEAS-CAPACITY-SHAPE` | 길쭉한 그릇이 들이가 많다고 생각 | g3s2u5 |
| `MC-MEAS-MIXED-UNIT-CALC` | 다른 단위가 섞인 계산에서 정리 실패 | g3s2u5 |
| `MC-MEAS-UNIT-CONVERT` | 단위 변환 배수 오류 | g3s1u5, g3s2u5 |
| `MC-MEAS-WEIGHT-SIZE` | 크면 무겁다고 생각 | g3s2u5 |
| `MC-MEASURE-CURVE` | 구부러진 것의 길이를 직선 거리로 판단 | g1s1u4 |
| `MC-MEASURE-ENDPOINT` | 끝(영점)을 맞추지 않고 길이 비교·측정 | g1s1u4, g2s1u4, g2s2u3, g3s1u5 |
| `MC-MEASURE-GAP` | 단위를 반복할 때 틈·겹침 | g2s1u4 |
| `MC-MEASURE-UNIT-SIZE` | 단위의 크기를 무시하고 단위 수만 비교 | g2s1u4 |
| `MC-MUL-ADD-CONFUSE` | 곱셈을 두 수의 덧셈으로 계산 | g2s1u6, g2s2u2 |
| `MC-MUL-CARRY-ADD-BEFORE` | 받아올림 수를 곱하기 전에 더함 | g3s1u4 |
| `MC-MUL-FACT-NEIGHBOR` | 이웃한 곱셈구구 값과 혼동 | g2s2u2 |
| `MC-MUL-GROUP-SIZE` | 묶음 크기와 묶음 수 혼동 | g2s1u6 |
| `MC-MUL-NO-PLACE-VALUE` | 십의 자리 숫자를 자릿값 없이 곱함 | g3s1u4 |
| `MC-MUL-PARTIAL-MISSING` | 부분곱 하나를 빠뜨림 | g3s1u4, g3s2u1 |
| `MC-MUL-PARTIAL-SHIFT` | 둘째 부분곱을 자릿값만큼 밀지 않음 | g3s2u1, g4s1u3 |
| `MC-MUL-SPLIT-PARTIAL-DROP` | 분할한 곱셈에서 한 부분만 계산 | g2s2u2 |
| `MC-MUL-UNEQUAL-GROUPS` | 크기가 다른 묶음도 곱셈으로 봄 | g2s1u6 |
| `MC-MUL-ZERO-ONE` | 0이나 1의 곱을 잘못 계산 | g2s2u2 |
| `MC-MULT-ALWAYS-BIGGER` | 곱하면 항상 커진다 | g5s2u2, g5s2u4 |
| `MC-NET-ADJACENT-AS-OPPOSITE` | 전개도에서 이웃한 면을 마주 보는 면으로 봄 | g5s2u5 |
| `MC-NET-ANY-SIX` | 정사각형 6개면 모두 정육면체 전개도라고 생각 | g5s2u5 |
| `MC-ODD-EVEN-SIZE` | 짝수·홀수를 수의 크기로 판단 | g1s2u1 |
| `MC-ORDER-LEFT-TO-RIGHT` | 혼합 계산에서 무조건 왼쪽부터 계산 | g5s1u1 |
| `MC-ORDER-MUL-BEFORE-DIV` | 곱셈을 나눗셈보다 항상 먼저 계산 | g5s1u1 |
| `MC-ORDER-PAREN-IGNORED` | 괄호를 무시하고 계산 | g5s1u1 |
| `MC-PATTERN-CORE` | 반복 단위를 잘못 잡음 | g1s2u5 |
| `MC-PATTERN-GROWTH-TOTAL` | 성장 패턴에서 증가분과 전체 개수 혼동 | g2s2u6 |
| `MC-PATTERN-LAST-ONLY` | 마지막 몇 개만 보고 다음을 정함 | g1s2u5, g2s2u6 |
| `MC-PATTERN-ONE-PAIR` | 한 쌍만 맞는 규칙을 일반 규칙이라 생각 | g4s1u6, g5s1u3 |
| `MC-PATTERN-RECURSIVE-ONLY` | 앞 항에서만 다음 항을 구해 먼 항 예측 실패 | g4s1u6, g5s1u3 |
| `MC-PATTERN-TRANSLATE` | 표현을 바꿀 때 대응을 섞음 | g1s2u5 |
| `MC-PERCENT-AS-NUMBER` | 백분율을 그냥 수로 계산 | g6s1u4 |
| `MC-PERIMETER-AREA-SAME` | 둘레가 같으면 넓이도 같다 | g5s1u6, g6s1u6 |
| `MC-PRISM-BASE-ORIENTATION` | 바닥에 놓인 면만 밑면이라고 생각 | g6s1u2 |
| `MC-PROPORTION-CROSS-WRONG` | 외항·내항을 잘못 짝지음 | g6s2u4 |
| `MC-PROPORTION-DIVIDE-BY-RATIO-TERM` | 비례배분에서 전체를 비의 한 항으로 나눔 | g6s2u4 |
| `MC-PV-BORROW-ACROSS-ZERO` | 0이 있는 자리를 건너는 연속 받아내림 실패 | g3s1u1 |
| `MC-PV-BORROW-NO-DECREMENT` | 받아내림 후 윗자리를 1 줄이지 않음 | g2s1u3, g3s1u1, g4s2u3 |
| `MC-PV-DIGIT-FACE` | 숫자의 자릿값을 무시하고 낱개 수로 봄 | g1s1u5, g2s1u1 |
| `MC-PV-MIXED-UNITS` | 묶음 수와 낱개 수(서로 다른 자리)를 섞어 계산 | g1s2u2 |
| `MC-PV-NO-CARRY` | 받아올림을 하지 않음 | g2s1u3, g3s1u1, g3s1u4, g3s2u1, g4s1u3 |
| `MC-PV-NONCANON` | 낱개(하위 단위) 10개 이상을 묶지 않거나 자릿수를 이어붙임 | g1s1u5, g1s2u1, g2s1u1, g2s2u1 |
| `MC-PV-ZERO` | 0 자리를 생략하거나 0의 자릿값 역할을 모름 | g2s1u1, g2s2u1 |
| `MC-PYRAMID-AS-PRISM-COUNT` | 각뿔 구성 요소에 각기둥 규칙 적용 | g6s1u2 |
| `MC-RANGE-BOUNDARY-INCLUSION` | 이상·초과·이하·미만의 경계 포함 여부 혼동 | g5s2u1 |
| `MC-RATE-DISTANCE-ONLY` | 거리(또는 시간)만 보고 빠르기 판단 | g6s1u4 |
| `MC-RATIO-ADDITIVE` | 비를 덧셈적으로 늘림 | g6s1u4, g6s2u4 |
| `MC-RATIO-ORDER` | 기준량과 비교하는 양의 순서 혼동 | g6s1u4 |
| `MC-REVOLVE-AXIS-WRONG` | 회전축 위치를 잘못 정함 | g6s2u6 |
| `MC-ROUND-CONTEXT-BLIND` | 상황과 상관없이 항상 반올림 | g5s2u1 |
| `MC-ROUND-WRONG-PLACE` | 어림할 자리가 아닌 다른 자리를 보고 판단 | g5s2u1 |
| `MC-SHAPE-BY-COLOR-SIZE` | 색·크기 등 관계없는 속성으로 모양 분류 | g1s1u2 |
| `MC-SHAPE-ORIENTATION` | 방향이 바뀌면 다른 모양이라 생각 | g1s1u2, g1s2u3, g2s1u2 |
| `MC-SHAPE-VERTEX-COUNT` | 꺾이지 않는 점까지 꼭짓점으로 셈 | g2s1u2 |
| `MC-SIMPLIFY-PARTIAL` | 약분을 끝까지 하지 않음 | g5s1u4 |
| `MC-SIZE-IS-WEIGHT` | 보이는 크기·높이로 무게·들이 판단 | g1s1u4 |
| `MC-SORT-INCONSISTENT` | 분류 도중 기준을 바꿈 | g2s1u5 |
| `MC-SORT-SUBJECTIVE` | 주관적 기준으로 분류 | g2s1u5 |
| `MC-SPATIAL-LEFT-RIGHT` | 앞·뒤·왼쪽·오른쪽 기준(보는 사람) 혼동 | g2s1u2 |
| `MC-SUB-DIRECTION` | 뺄셈 상황에서 더하거나 뺀 수를 답함 | g1s1u3, g1s2u6 |
| `MC-SUB-SMALLER-FROM-LARGER` | 자리마다 큰 수에서 작은 수를 빼거나 순서를 뒤집어 뺌 | g1s2u2, g2s1u3, g3s1u1, g4s2u1, g5s1u5 |
| `MC-SURFACE-3-FACES` | 겉넓이에서 보이는 3면만 더함 | g6s1u6 |
| `MC-SYM-DIAGONAL-AXIS` | 대각선을 대칭축으로 잘못 봄 | g5s2u3 |
| `MC-SYM-POINT-AS-LINE` | 점대칭을 선대칭(뒤집기)과 혼동 | g5s2u3 |
| `MC-THREE-ADDEND-SKIP` | 세 수 계산에서 한 수를 빠뜨림 | g1s2u4 |
| `MC-TIME-BASE-100` | 1시간을 100분처럼 십진으로 계산 | g2s2u4, g3s1u5 |
| `MC-TRANS-FLIP-TURN` | 뒤집기와 180° 돌리기 혼동 | g4s1u4 |
| `MC-TRANS-TURN-CENTER` | 돌리는 중심을 무시 | g4s1u4 |
| `MC-TRANS-TURN-DIRECTION` | 시계 방향·반대 방향 혼동 | g4s1u4 |
| `MC-VIEW-DEPTH-IGNORED` | 투영에서 앞뒤 기둥 중 높은 것이 보인다는 것을 놓침 | g6s2u3 |
| `MC-VIEW-SIDE-MIRROR` | 옆에서 본 모양을 좌우 반전으로 그림 | g6s2u3 |
| `MC-VIEWS-UNIQUE` | 투영 3장이면 모양이 하나로 정해진다고 생각 | g6s2u3 |
| `MC-VOLUME-SURFACE-CONFUSION` | 부피와 겉넓이 혼동 | g6s1u6 |
| `MC-VOLUME-UNIT-CONVERT-100` | 부피 단위 환산 오류(1m³ = 100cm³ 등) | g6s1u6 |
<!-- MC-REGISTRY:END -->

## 6. 문장제 관심사 바꾸기 (템플릿 방식)

LLM 대신 **수치 구조는 고정하고 이야기 틀만 바꾸는 템플릿**을 쓴다.

```jsonc
{
  "id": "ratio.mix",
  "structure": "a : b, 전체 n배",
  "slots": { "a": 2, "b": 3, "k": 4 },
  "skins": {
    "cooking":  "초코 우유를 만들 때 초코 시럽 {a}숟가락에 우유 {b}컵을 섞어요. 같은 맛으로 {k}배 만들려면…",
    "space":    "우주선 연료를 A 연료 {a}통, B 연료 {b}통 비율로 섞어요. 같은 비율로 {k}배 채우려면…",
    "baseball": "타자가 {a}번 안타를 칠 때 {b}번 아웃되는 비율로…",
    "game":     "아이템 조합에 빨간 보석 {a}개, 파란 보석 {b}개가 필요해요. {k}번 조합하려면…"
  }
}
```
- 관심사는 학생이 처음에 고른다(야구, 요리, 우주, 게임, 동물, 음악). 실존 인물·아이돌 실명은 쓰지 않는다.
- 스킨 문장은 교사가 검수한다. 수치와 질문 구조가 모든 스킨에서 같아야 한다(테스트로 검사: 스킨마다 `{slot}` 집합이 같은지).

## 7. 이벤트 로그와 교사용 요약

- 이벤트 형식은 `02-architecture.md` §3.
- 교사용 요약(1단계: 내보내기 파일을 교사 PC에서 열기, 2단계: 대시보드):
  - 단원별 개념 숙달 분포(별자리 밝기 3단계별 학생 수)
  - 오개념 코드별 감지 학생 수와 최근 감지 시각
  - 부스터로 간 학생과 그 후 성공 여부
  - "토론에 쓸 만한 서로 다른 전략" 후보: 같은 과제를 다른 Action 순서/다른 엔진 모드로 푼 학생 쌍
