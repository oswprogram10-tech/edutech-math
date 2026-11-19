/**
 * E16 대응 관계의 설정·상태·Action 타입. 모드별 판별 유니온이다.
 * 수학 값은 모두 Rational 문자열(`"4"`, `"1/2"`)로 둔다. 화면 좌표·슬라이더 위치만 number다.
 */

export type FunctionMode = 'black-box' | 'table' | 'covary' | 'rule-shooter';
export type Target = 'input' | 'rule';
export type SceneId = 'chairs-legs' | 'triangles-sticks' | 'dots';
export type CovaryLook = 'picture' | 'dots' | 'none';

export interface CommonConfig {
  /** 숨은(또는 장면의) 규칙. 예 "□ = ○ × 4". solvedForBox여야 한다. */
  rule?: string;
  /** 표 첫 줄 이름(기본 "○"). */
  xLabel?: string;
  /** 표 둘째 줄 이름(기본 "□"). */
  yLabel?: string;
  /** 관계식 입력 칸(기본 true). */
  ruleInput?: boolean;
  /** 정수 ○ 범위(기본 [0, 20]). 판정 sameOnDomain에 쓴다. */
  domain?: [number, number];
}

export interface BlackBoxConfig extends CommonConfig {
  mode: 'black-box';
  inputRange?: [number, number];
  maxTrials?: number;
  /** ruleFormDiffers 판정에만 쓴다. 화면에 보이지 않는다. */
  avoidForm?: string;
}

export interface TableRowConfig {
  x: string | null;
  y: string | null;
}

export interface TableConfig extends CommonConfig {
  mode: 'table';
  rows?: TableRowConfig[];
}

export interface CovaryConfig extends CommonConfig {
  mode: 'covary';
  scene?: SceneId;
  x?: { min: number; max: number };
  blankRows?: number[];
  look?: CovaryLook;
}

export type ShooterOp = '+' | '-' | '×' | '÷';
export type ShooterLook = 'grid' | 'table';

export interface ShooterConfig extends CommonConfig {
  mode: 'rule-shooter';
  /** [○, □] 보석 좌표(정수 또는 Rational 문자열). 2~8개. 빠지면 샌드박스용 기본 보석을 쓴다. */
  gems?: [string | number, string | number][];
  grid?: { xMax: number; yMax: number };
  allowedOps?: ShooterOp[];
  look?: ShooterLook;
  missPanel?: boolean;
  /** ruleFormDiffers 판정에만 쓴다. 화면에 보이지 않는다. */
  avoidForm?: string;
}

export type FunctionConfig = BlackBoxConfig | TableConfig | CovaryConfig | ShooterConfig;

/** 정규화한 설정(상태 안에 둔다. reduce가 config를 받지 않기 때문이다). */
export interface CommonSettings {
  rule: string;
  xLabel: string;
  yLabel: string;
  ruleInput: boolean;
  domain: [number, number];
  /** 설정이 잘못되면 이유 코드. 화면은 "설정 오류" 빈 판을 그린다. */
  error: string | null;
}

export interface BlackBoxSettings extends CommonSettings {
  inputRange: [number, number];
  maxTrials: number | null;
  avoidForm: string | null;
}

export interface TableSettings extends CommonSettings {
  rows: TableRowConfig[];
}

export interface CovarySettings extends CommonSettings {
  scene: SceneId;
  xMin: number;
  xMax: number;
  blankRows: number[];
  look: CovaryLook;
}

export interface ShooterSettings extends CommonSettings {
  /** [○, □] Rational 문자열. */
  gems: [string, string][];
  grid: { xMax: number; yMax: number };
  /** 식 키패드에 보일 연산 단추(키패드 글자). */
  allowedOps: string[];
  look: ShooterLook;
  missPanel: boolean;
  avoidForm: string | null;
}

/** 마지막으로 시험한 식. 표시(✓/✕)는 현재 입력과 같을 때만 그린다. */
export interface Tested {
  text: string;
  ok: boolean;
  /** 읽지 못한 자리(글자 위치). 모르면 null. */
  errorAt: number | null;
}

export type Notice = 'range' | 'no-output' | 'limit';

interface BaseState {
  ruleText: string;
  tested: Tested | null;
  /** 시험한 식(파싱된 것만) formatRelation 문자열, 최근 10개. */
  ruleHistory: string[];
  target: Target;
  notice: Notice | null;
}

export interface BlackBoxState extends BaseState {
  mode: 'black-box';
  settings: BlackBoxSettings;
  draft: string;
  /** [○, □] Rational 문자열. */
  trials: [string, string][];
  /** 마지막으로 넣은 ○(강조 열). */
  lastX: string | null;
}

export interface TableState extends BaseState {
  mode: 'table';
  settings: TableSettings;
  /** 키는 `"<행>.x"`·`"<행>.y"`. 학생이 쓴 수(문자열). */
  cells: Record<string, string>;
  active: string | null;
}

export interface CovaryState extends BaseState {
  mode: 'covary';
  settings: CovarySettings;
  /** 슬라이더의 ○. */
  x: string;
  /** 지나온 ○(오름차순). */
  visited: string[];
  /** 키는 `"<○ 값>.y"`. */
  cells: Record<string, string>;
  active: string | null;
}

export interface Shot {
  text: string;
  /** 맞힌 보석 번호(0부터). */
  hits: number[];
}

export interface ShooterState extends BaseState {
  mode: 'rule-shooter';
  settings: ShooterSettings;
  /** 발사 기록(읽힌 식만, 최근 10개). */
  shots: Shot[];
}

export type FunctionState = BlackBoxState | TableState | CovaryState | ShooterState;

export type FunctionAction =
  | { type: 'type'; target: Target; key: string }
  | { type: 'backspace'; target: Target }
  | { type: 'clear'; target: Target }
  | { type: 'insert-input' }
  | { type: 'test-rule' }
  | { type: 'fire' }
  | { type: 'focus'; target: Target }
  | { type: 'activate'; cell: string }
  | { type: 'set-x'; x: string };
