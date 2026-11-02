# MathExplorer (가칭)

초등 1~6학년 학생이 **디지털 교구를 직접 만지며 수학 원리를 발견**하고, 교사는 그 과정을 보며 **토론 수업**을 이끄는 웹 앱.
설치 없이 크롬북·아이패드·갤럭시탭·전자칠판에서 동작하고, 무료 서비스만으로 운영한다.

이 폴더는 원 계획서를 **코딩 에이전트(Claude, Codex, OpenCode)가 바로 구현할 수 있는 개발 명세**로 구체화한 것이다. 아직 코드는 없다. 첫 작업 카드(`tasks/T001.md`)부터 시작한다.

## 문서 지도

| 문서 | 내용 | 주로 읽는 사람 |
| --- | --- | --- |
| `docs/10-changes-from-original.md` | 원 계획서에서 무엇을 왜 바꿨나 | 선생님 (먼저 읽기) |
| `docs/01-product.md` | 제품 요구사항: 원칙, 수업 시나리오, 단계별 범위, 측정 가능한 성공 지표 | 선생님, 에이전트 |
| `docs/02-architecture.md` | 기술 스택, 폴더 구조, 타입 계약, 데이터 흐름, 성능 예산 | 에이전트 |
| `docs/03-engines.md` | 20개 교구 엔진 (71개 단원은 이 엔진들의 조합) | 에이전트 |
| `docs/04-units/` | **71개 단원 명세** (학기별 12개 파일): 활동, 설정 예시, 과제와 판정, 오개념과 힌트 사다리, 완료 기준 | 선생님(수학 검토), 에이전트 |
| `docs/05-learning-engine.md` | 지식 그래프, 숙달 추정, 무학년 역추적, 힌트 규칙, 오개념 레지스트리, 문장제 스킨 | 에이전트 |
| `docs/06-screens.md` | 화면 명세(학생·교사 시연·관리·학급 실시간) | 선생님, 에이전트 |
| `docs/07-roadmap.md` | 엔진 웨이브 로드맵, 단원 완료 기준 | 선생님 |
| `docs/08-agent-workflow.md` | 세 에이전트로 일하는 방법, 복사해 쓰는 지시문 | 선생님 |
| `docs/09-privacy-safety.md` | 개인정보·아동 안전 설계, 학교에서 확인할 것 | 선생님 |
| `AGENTS.md` / `CLAUDE.md` | 에이전트가 자동으로 읽는 개발 규칙 | 에이전트 |
| `data/units.json` | 71개 단원 메타데이터(엔진·선수 단원) — 단일 진실 공급원 | 에이전트 |
| `tasks/` | 작업 카드(W0 기반, W1 분수) | 선생님 → 에이전트 |
| `scripts/check-specs.mjs` | 명세와 units.json 일치 검사, 오개념·개념 목록 생성 | 에이전트 |

## 시작하기 (선생님)
1. `docs/10-changes-from-original.md` → `docs/07-roadmap.md` 순서로 읽는다.
2. 내가 수업할 단원의 명세(`docs/04-units/g?s?.md`)를 읽고 수학적으로 이상한 곳을 고친다.
3. `docs/08-agent-workflow.md` §1대로 GitHub 저장소를 만들고 이 폴더를 올린다.
4. 에이전트에게: `tasks/T001.md를 수행해 줘.`

## 개발 시작 (에이전트)
`AGENTS.md`를 먼저 읽는다. Node.js 24를 쓴다.

```
npm install
npx playwright install chromium webkit   # E2E용 브라우저 (처음 한 번)
```

| 명령 | 하는 일 |
| --- | --- |
| `npm run dev` | 개발 서버. `--host`가 켜져 있어 같은 와이파이의 태블릿에서 터미널에 찍힌 `Network:` 주소로 접속한다 |
| `npm test` | Vitest 단위 테스트 (`src/**/*.test.ts(x)`, `eslint/**/*.test.js`) |
| `npm run test:e2e` | Playwright. 프로젝트 3개: `ipad`(768×1024 WebKit 터치), `chromebook`(1366×768), `board`(1920×1080). 빌드본으로 오프라인 새로고침도 검사한다 |
| `npm run lint` | ESLint + Prettier 검사. 엔진 폴더끼리 import하면 `mathexplorer/no-cross-engine-imports` 오류 |
| `npm run format` | Prettier로 코드 정리 (`docs/`, `data/`, `tasks/`, `*.md`는 건드리지 않음) |
| `npm run check:specs` | `docs/04-units`와 `data/units.json` 일치 검사 |
| `npm run build` | 타입 검사 + 배포용 빌드(`dist/`, PWA 서비스 워커 포함) |
| `npm run preview` | 빌드 결과를 로컬에서 띄워 본다 (오프라인 동작 확인용) |

### 배포
GitHub에 push하면 Actions(`.github/workflows/ci.yml`)가 lint·test·check:specs·build를 돌리고, `main` 브랜치면 GitHub Pages에 배포한다.
처음 한 번 저장소의 **Settings → Pages → Source를 'GitHub Actions'**로 바꿔야 한다. 주소는 `https://<사용자>.github.io/<저장소 이름>/`이며, 빌드 경로(`BASE_PATH`)는 저장소 이름에서 자동으로 정해진다.
