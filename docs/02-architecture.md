# 02. 기술 아키텍처

> 전제: **교사 1명 + 코딩 에이전트(Claude, Codex, OpenCode)**가 만들고, **무료 서비스만** 쓰며, **크롬북·아이패드·갤럭시탭·전자칠판**에서 설치 없이 돌아가야 한다.
> 이 전제에 맞지 않는 원 계획서의 기술 선택은 `10-changes-from-original.md`에 대체안과 이유를 정리했다.

## 1. 기술 스택 (확정안)

| 영역 | 선택 | 이유 |
| --- | --- | --- |
| 언어 | **TypeScript (strict)** | 에이전트 여러 개가 같은 코드를 만질 때 타입이 계약서 역할을 한다 |
| 빌드 | **Vite** | 설정이 단순하고 빠르다 |
| UI | **React 18 + CSS Modules** | 에이전트들이 가장 안정적으로 다루는 조합. UI 라이브러리는 쓰지 않는다(번들 크기, 터치 커스터마이즈) |
| 2D 교구 | **SVG(React)** 기본, 객체가 200개를 넘는 장면만 **Canvas 2D** | SVG는 접근성·테스트·확대에 유리 |
| 물리 | **Matter.js** — 필요한 엔진(E02 셈돌 낙하, E06 저울 기울기 연출)에서만 지연 로딩 | 대부분의 교구는 물리가 아니라 *규칙*이 핵심이다. 물리는 연출용 |
| 3D | **Three.js + @react-three/fiber**(React 18용 v8, 궤도 회전은 three의 `OrbitControls`) — E12에서만, 3D를 쓰기로 정했을 때만 지연 로딩. 저사양·WebGL 없음이면 등각 2D SVG | 3D가 필요 없는 화면에서는 내려받지 않는다. drei는 번들 크기 때문에 쓰지 않는다 |
| 소리 | **Web Audio API** (필요하면 Tone.js) | E15 패턴 시퀀서 |
| 음성 | **Web Speech API `speechSynthesis`(TTS)** 기본 · STT(음성 인식)는 선택 기능 | TTS는 모든 기기에서 무료. STT는 브라우저마다 동작과 데이터 처리 방식이 달라 기본 기능으로 쓰지 않는다 |
| 상태 관리 | **Zustand** (전역) + 교구 내부는 순수 리듀서 | 교구 상태를 직렬화 가능한 JSON으로 유지 → 저장·되감기·미러링이 공짜로 따라온다 |
| 로컬 저장 | **IndexedDB (Dexie.js)** | 오프라인 우선. 학습 기록은 기본적으로 기기 밖으로 나가지 않는다 |
| 오프라인 | **PWA (vite-plugin-pwa)** | 와이파이가 끊겨도 교구는 동작 |
| 수학 코어 | **자체 구현**: 유리수(분수) 정확 연산, 초등 범위 수식 파서·AST, 동치 판정 | 초등 범위는 작다. 외부 CAS 없이 결정론적·테스트 가능하게 만든다 |
| 테스트 | **Vitest**(단위) + **Playwright**(E2E, 터치 에뮬레이션, iPad·Chromebook 뷰포트) | 에이전트가 만든 코드를 에이전트가 검증할 수 있어야 한다 |
| 린트·포맷 | ESLint + Prettier | |
| 호스팅 | **GitHub Pages 또는 Cloudflare Pages** (정적 사이트, 무료) | 서버 없이 시작 |
| 학급 실시간 (2단계) | **Supabase 무료 플랜** — Realtime Broadcast/Presence + Postgres | 무료 플랜: 동시 접속 200, 월 200만 메시지, DB 500MB, **1주일 미사용 시 프로젝트 일시정지**, 활성 프로젝트 2개 (2026-11 기준, supabase.com/pricing). 방학 뒤에는 대시보드에서 재개해야 한다 |

### 브라우저 지원 기준
- iPadOS Safari 17 이상, ChromeOS Chrome 최신 2개 버전, Android Chrome 최신 2개 버전, Windows Chrome/Edge(전자칠판·교사 PC).
- **아이패드 Safari는 WebXR(AR)을 지원하지 않는다.** 그러므로 AR은 *선택 기능*이고, 모든 AR 활동에는 3D 뷰어 대체 화면이 있어야 한다.
- 입력: 터치·마우스·펜을 모두 **Pointer Events**로 통일한다. `TouchEvent`에 직접 의존하지 않는다(크롬북 트랙패드, 전자칠판 대응).

## 2. 저장소 구조

```
MathExplorer/
├─ AGENTS.md                 # 모든 코딩 에이전트 공통 규칙 (필독)
├─ CLAUDE.md                 # Claude용 진입점 → AGENTS.md를 따른다
├─ README.md
├─ docs/                     # 명세 (이 폴더)
├─ data/
│  ├─ units.json             # 71개 단원 메타데이터 (단일 진실 공급원)
│  ├─ concepts.json          # 지식 그래프 개념 노드 (단원 명세에서 생성)
│  └─ content/<unitId>.json  # 단원별 활동·과제·힌트 (구현하면서 작성)
├─ tasks/                    # 에이전트 작업 카드
├─ src/
│  ├─ app/                   # 앱 셸, 라우팅, 레이아웃, 모드(학생/교사/시연)
│  ├─ core/
│  │  ├─ math/               # 유리수, 파서, AST, 동치 판정 (순수 함수, 100% 테스트)
│  │  ├─ engine-sdk/         # 교구 엔진 공통 계약(타입), 포인터 제스처, 스냅, 잔상, 되감기
│  │  ├─ runner/             # 활동 실행기 (과제 순서, CPA 단계, 완료 판정)
│  │  ├─ feedback/           # 힌트·발문 규칙 엔진
│  │  ├─ knowledge/          # 지식 그래프, 숙달 추정, 역추적
│  │  ├─ storage/            # Dexie 스키마, 이벤트 로그, 내보내기
│  │  ├─ a11y/               # TTS, 큰 타깃, 고대비, 저학년 모드
│  │  └─ ui/                 # 공통 UI 컴포넌트 (버튼, 수 키패드, 토스트, 모달)
│  ├─ engines/
│  │  ├─ E01-base-ten/       # 엔진 하나 = 폴더 하나 (에이전트 병렬 작업 단위)
│  │  ├─ E02-counters/
│  │  └─ ...
│  ├─ classroom/             # 2단계: Supabase 연동, 미러링, 일시정지, 투표
│  └─ main.tsx
├─ tests/e2e/
└─ public/
```

**규칙:** 엔진 폴더는 서로 import하지 않는다. 엔진끼리 연동(예: E01 수 모형 ↔ E07 세로셈)은 `core/runner`가 두 엔진의 공개 이벤트를 이어 붙이는 방식으로만 한다. 그래야 에이전트 여러 개가 서로 다른 엔진을 동시에 만들어도 충돌하지 않는다.

## 3. 핵심 계약 (TypeScript)

`src/core/engine-sdk/types.ts`에 둔다. 모든 엔진은 이 계약을 지킨다.

```ts
export type UnitId = string;        // 예: "g5s1u4" (5학년 1학기 4단원)
export type EngineId = `E${string}`; // 예: "E05"
export type CPA = 'C' | 'P' | 'A';  // 구체물 / 반구체 그림 / 기호
export type TargetSize = 48 | 64;   // 조작 요소 최소 터치 영역(저학년 64)

/** Observation에는 JSON 값만 넣는다. Rational은 toJSON() 문자열로 넣는다. */
export type JsonValue =
  | string | number | boolean | null
  | JsonValue[]
  | { readonly [key: string]: JsonValue };
export type Observation = Readonly<Record<string, JsonValue>>;

/** 다른 엔진·러너에게 알리는 사건. name은 엔진의 events 목록 중 하나다. */
export interface EngineEvent { name: string; payload?: JsonValue }
export type EnginePredicate = (observation: Observation, args: JsonValue | undefined) => boolean;

/** 엔진 정의: 엔진 폴더의 index.ts가 default export 한다 */
export interface EngineDefinition<Config, State, Action> {
  id: EngineId;
  name: string;                         // "분수 모델"
  modes: string[];                      // ["bar", "area", "overlay-slicer", ...]
  /** 실행기 판 크기 방식. 'fit'(기본): 남는 높이에 맞춰 줄어든다. 'content': 내용 높이보다 작아지지 않는다 */
  layout?: 'fit' | 'content';
  createInitialState(config: Config): State;
  reduce(state: State, action: Action): State;   // 순수 함수. 모든 조작은 Action으로 기록
  View: React.ComponentType<EngineViewProps<Config, State, Action>>;
  /** 현재 상태에서 판정 가능한 수학적 사실을 뽑는다. 과제 채점과 힌트 규칙이 이것만 본다 */
  observe(state: State, config: Config): Observation;
  /** 다른 엔진·러너가 구독하는 이벤트 (예: 'group-formed', 'regrouped', 'step-entered') */
  events: readonly string[];
  /** 힌트 ② 시각적 반례 레이어. HintRule.show.overlay가 이름으로 가리킨다 */
  overlays?: Readonly<Record<string, React.ComponentType<OverlayProps<Config, State>>>>;
  /** reduce 직후 러너가 호출한다. 순수 함수. name은 events 중 하나여야 한다 */
  emit?(prev: State, next: State, action: Action): EngineEvent[];
  /** 다른 엔진의 이벤트를 이 엔진의 Action으로 바꾼다. null이면 무시 */
  receive?(state: State, event: EngineEvent, config: Config): Action | null;
  /** GoalSpec predicate가 이름으로 찾는 판정 함수 */
  predicates?: Readonly<Record<string, EnginePredicate>>;
}

export interface EngineViewProps<Config, State, Action> {
  config: Config;
  state: State;
  dispatch(action: Action): void;
  cpa: CPA;                 // 같은 엔진이 C/P/A 단계에 따라 다르게 그린다
  mode: string;             // EngineDefinition.modes 중 하나
  readOnly?: boolean;       // 교사 미러링·익명 비교 화면
  scale?: number;           // 전자칠판 확대
  targetSize: TargetSize;   // 48 | 64(저학년). 모든 조작 요소가 이 값 이상
}

export interface OverlayProps<Config, State> {
  config: Config;
  state: State;
  args?: unknown;
  scale?: number;
}

/** 과제 = 엔진 설정 + 목표 + 판정 규칙 */
export interface Task {
  id: string;
  prompt: string;              // 학생에게 보이는 발문 (TTS로 읽어줄 수 있게 짧게)
  engine: EngineId;
  mode: string;
  cpa: CPA;
  config: unknown;             // 엔진별 설정
  goal: GoalSpec;              // observe() 결과에 대한 조건식 (아래)
  hints: HintRule[];           // 05-learning-engine.md
  concepts: string[];          // 지식 그래프 개념 ID
}

/** hint 규칙: 오개념 코드 → 발문 템플릿 (05-learning-engine.md §4) */
export interface HintRule {
  when: GoalSpec | { misconception: string };
  level: 1 | 2 | 3;
  say?: string;                // ① 발문 (템플릿 변수: {a}, {b}, {student})
  show?: { engine: EngineId; overlay: string; args?: JsonValue };
  backtrack?: string;          // ③ 개념 ID 또는 단원 ID
}

/** 판정은 "정답 문자열 비교"가 아니라 Observation에 대한 조건식으로 한다 */
export type GoalSpec =
  | { kind: 'equals'; path: string; value: JsonValue }
  | { kind: 'equivalent-expr'; path: string; expr: string }  // 수식 동치
  | { kind: 'predicate'; name: string; args?: JsonValue }     // 엔진이 제공하는 이름 있는 판정
  | { kind: 'all'; of: GoalSpec[] } | { kind: 'any'; of: GoalSpec[] };
```

### 이벤트 로그 (xAPI 비슷한 최소 형태)
```ts
interface LearningEvent {
  t: number;              // epoch ms
  learner: string;        // 기기 로컬 ID 또는 "학급코드-번호" (실명 금지)
  unit: UnitId; task: string; engine: EngineId;
  verb: 'started'|'acted'|'submitted'|'passed'|'failed'|'hinted'|'backtracked'|'self-corrected'|'completed';
  data?: Record<string, unknown>;  // 예: { action: 'lasso', count: 10 } — 화면 좌표 원본은 저장하지 않는다
}
```
- 조작 궤적 전체(좌표)는 저장하지 않는다. **Action(의미 단위 조작)만** 저장한다. 용량·개인정보·분석 모두 이게 낫다.
- `reduce`가 순수 함수이므로 Action 목록으로 학생의 풀이 과정을 그대로 재생(되감기, 교사 확인)할 수 있다.

## 4. 수학 코어 (`src/core/math`)

외부 CAS를 쓰지 않는다. 초등 범위에서 필요한 것은 아래가 전부다.

1. `Rational` — BigInt 기반 분자/분모, 약분, 사칙연산, 비교, 소수↔분수 변환(유한소수만), 대분수 표기.
2. `parse(expr)` — 토큰: 자연수, 소수, 분수(`3/4`, 대분수 `1 2/3`), `+ − × ÷`, 괄호, `□`(미지수), `:`(비). 결과는 AST.
3. `evaluate(ast)` → `Rational` (□가 있으면 미지수 하나짜리 일차식으로 취급해 풀이).
4. `equivalent(a, b)` — 두 식의 값이 같은지(정확 연산). 줄 단위 풀이 검증에 사용.
5. `diagnose(prevLine, nextLine)` — 두 줄 사이에서 흔한 오류 패턴을 찾는다: 분모끼리 더하기, 연산 순서 무시, 받아내림 누락, 소수점 위치, 0 누락 등. 결과는 오개념 코드(`MC-FRAC-ADD-DENOM` 등, `05-learning-engine.md`의 목록).

> 생성형 AI가 계산하는 곳은 없다. 그러므로 "AI 연산 환각 0%"는 지표가 아니라 **설계상 보장**이다.

## 5. 입력 방식: 필기 인식 대신 "칸 입력"

유료 필기 인식(MyScript, Mathpix) 대신 아래를 쓴다. 교육적으로도 더 낫다: 자릿값 열이 화면에서 강제되기 때문에 "열 정렬 오류"를 인식 오류와 구분할 필요가 없다.

- **E07 세로셈 격자:** 칸을 누르면 숫자 키패드가 뜬다. 받아올림·받아내림 칸, 소수점 칸이 따로 있다.
- **E08 단계 풀이:** 한 줄씩 수식 키패드(분수 버튼, □ 버튼)로 입력. 줄마다 동치 판정.
- **선택(후순위):** 손글씨 숫자 한 칸 인식 — TensorFlow.js 소형 모델(MNIST 계열)을 브라우저에서 돌림. 칸 입력 위에 얹는 부가 기능.

## 6. 성능 예산

| 항목 | 목표 | 측정 |
| --- | --- | --- |
| 조작 반응 | 드래그 중 60fps, 입력→화면 반영 16ms 이내 | Playwright + Performance API, 저가 크롬북 실기기 |
| 첫 화면 | 셸 JS 200KB(gzip) 이하, 엔진은 경로별 지연 로딩 | `vite build` 리포트 |
| 3D | 쌓기나무 100개까지 30fps 이상(저가 크롬북) | 실기기 |
| 오프라인 | 한 번 연 단원은 비행기 모드에서 동작 | 수동 점검표 |

## 7. 화면 모드

| 모드 | 기기 | 특징 |
| --- | --- | --- |
| 학생 모드 | 태블릿·크롬북 | 단원 지도 → 활동. 저학년(1~2)은 글 대신 아이콘+TTS, 터치 타깃 64px |
| 교사 시연 모드 | 전자칠판·교사 PC | 아무 엔진이나 바로 열기(과제 없이 자유 조작), 2배 확대, 펜 주석 레이어, 화면 2분할 비교 |
| 교사 관리 모드 | 교사 PC | 단원 켜기/끄기, 학생 진도(2단계부터 서버), 내보내기 |
| 학급 실시간 (2단계) | 전체 | 학급 코드로 입장, 교사 화면에 학생 썸네일, 일시정지, 익명 전략 비교, 투표 |

## 8. 단계별 데이터 흐름

- **1단계(로그인 없음):** 학생이 처음 열 때 `학급 번호(1~30)`만 고른다. 기록은 그 기기의 IndexedDB에만 저장. 교사는 기기별 "내보내기 QR/파일"로 필요할 때만 모은다. 공용 기기라면 번호별 프로필을 기기 안에 여러 개 둔다.
- **2단계(학급 코드):** 교사가 Supabase에 학급을 만들고 6자리 코드를 받는다. 학생은 `코드 + 번호 + (선택)별명`으로 입장. 실명·생년월일·사진은 저장하지 않는다. 미러링은 화면 영상이 아니라 **교구 상태 JSON**을 1초에 최대 1번, 바뀔 때만 보낸다.
  - 대략적 사용량: 30명 × 1회/초 × 40분 ≈ 72,000건/차시. 월 12차시면 약 86만 건 — 무료 한도(월 200만) 안이지만 Supabase의 메시지 계산 방식(수신자 수 포함 여부)을 실제로 측정해 확인한다.
- **3단계(선택):** 예산이 생기면 LLM 발문 보조. 학생 식별 정보 없이 *현재 과제와 Observation*만 보낸다. 규칙 기반 힌트가 항상 먼저다.
