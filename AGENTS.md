# AGENTS.md — MathExplorer 개발 규칙 (모든 코딩 에이전트 공통)

이 파일은 Codex, OpenCode, Claude Code가 모두 따른다. 규칙을 바꿀 때는 이 파일만 고친다.

## 프로젝트
초등 1~6학년 수학 디지털 교구 웹 앱(PWA). 콘텐츠 제공자(운영자 1명)가 코딩 에이전트와 함께 만들어 여러 학교·학급에 제공한다. 목표는 1~6학년 71개 단원 전체이고, 첫 웨이브부터 운영자가 직접 시범 운영하며 고친다.
교과서(출판사)마다 단원 이름·학년·학기 배치가 다를 수 있으므로 단원 ID(`g3s1u6`)는 내부 이름표로만 쓰고, 출판사별 표시는 `data/units.json`의 `textbookAlias`로 맞춘다.
무료 서비스만 쓰고, 크롬북·아이패드(Safari)·갤럭시탭·전자칠판에서 설치 없이 동작해야 한다.

## 먼저 읽을 문서
1. `docs/02-architecture.md` — 스택, 폴더 구조, 핵심 타입 계약
2. `docs/03-engines.md` — 20개 교구 엔진
3. 작업 카드(`tasks/Txxx.md`)가 가리키는 단원 명세(`docs/04-units/*.md`)
4. 힌트·역추적 작업이면 `docs/05-learning-engine.md`

## 명령
```
npm install
npm run dev          # 개발 서버 (같은 와이파이 태블릿에서 접속: --host)
npm test             # Vitest 단위 테스트
npm run test:e2e     # Playwright (iPad·Chromebook·전자칠판 뷰포트)
npm run lint
npm run check:specs  # docs/04-units 와 data/units.json 일치 검사
npm run build
```

## 절대 규칙
1. **엔진끼리 import 금지.** `src/engines/Exx-*/` 안의 코드는 다른 엔진 폴더를 import하지 않는다. 연동은 `src/core/runner`의 이벤트 연결로만 한다.
2. **수학 값에 부동소수(number) 금지.** 분수·소수·위치·측정값은 `src/core/math`의 `Rational`을 쓴다. 화면 좌표만 number.
3. **정답 노출 금지.** 학생 화면에 정답을 보여 주는 버튼·텍스트·애니메이션을 만들지 않는다. 힌트는 발문 → 시각적 반례 → 역추적 사다리만.
4. **판정은 Observation으로.** 과제 채점을 정답 문자열 비교로 하지 않는다. 엔진의 `observe()` 결과에 대한 `GoalSpec`으로 한다.
5. **reduce는 순수 함수.** 엔진 상태 변경은 Action → `reduce`로만. 상태는 JSON 직렬화 가능해야 한다(되감기·미러링·저장).
6. **입력은 Pointer Events.** `TouchEvent`·`MouseEvent`에 직접 의존하지 않는다. 키보드 대체 조작을 제공한다.
7. **아이패드 Safari에서 안 되는 API를 필수 경로에 쓰지 않는다.** (WebXR, 일부 Web Speech 인식, `requestIdleCallback` 등) 쓰려면 기능 감지 + 대체 화면.
8. **외부 네트워크 의존 금지(1단계).** CDN 스크립트·폰트·분석 도구를 넣지 않는다. 모든 자산은 번들에 포함.
9. **개인정보:** 이름·사진·생년월일 입력란을 만들지 않는다. 화면 좌표 궤적을 저장하지 않는다(Action만).
10. **학년 표시 금지(학생 화면).** 별자리·부스터 등 학생 화면에 "○학년"을 표시하지 않는다.
11. **점수·랭킹·꾸미기 보상 금지.**

## 작업 방식
- 작업 카드 하나 = 브랜치 하나(`task/Txxx`). 카드의 범위를 넘는 수정은 하지 말고, 필요하면 카드 끝 '메모'에 적는다.
- 카드의 **건드리지 말 것** 목록을 지킨다. 특히 `src/core/`와 `data/units.json`은 카드에 명시된 경우에만 수정한다.
- 새 기능에는 테스트를 같이 쓴다. 수학 코어는 경계값(0, 1, 약분, 대분수, 큰 수)을 반드시 테스트한다.
- 라이선스: 코드는 MIT, `docs/`·`data/`는 CC BY 4.0(`LICENSE`, `LICENSE-CONTENT.md`). 새 의존성은 MIT·Apache-2.0·BSD·ISC 같은 허용형만 쓴다(GPL 계열 금지). 교과서 본문·그림은 저장소에 넣지 않는다.
- 명세가 모호하거나 구현이 불가능하면 추측으로 진행하지 말고 질문하거나, `docs/`를 고치는 제안을 먼저 한다.
- 끝나면 `npm test`, `npm run test:e2e`, `npm run lint`, `npm run check:specs` 결과와 카드의 '완료 확인' 체크 결과를 보고한다.

## 코드 스타일
- TypeScript strict. `any` 금지(불가피하면 `unknown` + 좁히기).
- 컴포넌트·파일 이름 영어, 학생에게 보이는 문구는 한국어. 문구는 `src/engines/Exx/strings.ko.ts` 또는 단원 콘텐츠 JSON에 둔다(하드코딩 금지).
- 엔진 폴더 구조:
  ```
  src/engines/E05-fraction-model/
    index.ts          # EngineDefinition default export
    types.ts          # Config, State, Action, Observation
    reduce.ts         # 순수 함수
    observe.ts        # 순수 함수
    View.tsx          # 화면
    overlays/         # 힌트 ② 시각적 반례
    strings.ko.ts
    __tests__/
  ```
- 터치 타깃 최소 48px(저학년 모드 64px). 색만으로 정보를 전달하지 않는다.

## 용어
- 단원 ID `g5s1u4` = 5학년 1학기 4단원 / 활동 ID `g5s1u4.A1` / 개념 ID `g5s1u4.common-denominator` / 오개념 코드 `MC-FRAC-ADD-DENOM`
- CPA: C 구체물, P 반구체 그림, A 기호
