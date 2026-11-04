/**
 * E07 세로셈 격자의 설정·상태·Action 타입.
 *
 * 자리 숫자는 문자열 한 글자(`"0"`~`"9"`), 값 계산은 `BigInt`·`Rational`로만 한다.
 * 소수는 number로 계산하지 않는다(0.1+0.2 문제). 격자 열은 자릿값 지수
 * (…, 1, 0, −1, −2 …)로 식별하고, 상태에는 `Record<string, string>`처럼
 * 문자열 키로 넣어 JSON 직렬화를 보장한다(T014 구현 결정 3).
 *
 * T046: `mul`(부분곱·받아올림)과 `estimate`(어림값 → 결과 신호등)를 더했다.
 * 기존 add·sub·decimal의 상태·Action 모양은 그대로 두고 필드만 덧붙였다.
 */
export type ColumnMode = 'add' | 'sub' | 'decimal' | 'mul' | 'estimate';

export type ColumnOp = 'add' | 'sub' | 'mul';

/** `"C-P"`면 C·P 단계에서 자석 정렬, A 단계는 자석 없음. true/false도 받는다. */
export type MagnetAlign = 'C-P' | boolean;

/** 빈 자리 0 채우기: 학생이 누름 / 자동 / 막음. */
export type PadZeros = 'optional' | 'auto' | 'off';

/** 곱셈 격자 방식. 단원 명세의 `"two-rows"`는 `carry`의 다른 이름이다. */
export type MulStyle = 'carry' | 'partial-products';
export type MulStyleInput = MulStyle | 'two-rows';

/** E01·E04 이벤트를 받을 때 자동으로 칸에 쓸지, 강조만 할지. */
export type LinkMarks = 'auto' | 'hint';

export type EstimatePhase = 'estimate' | 'calc';
export type EstimateSignal = 'green' | 'yellow' | 'red';

/** 어림값과 학생 결과의 차이 한계. 문자열·숫자 모두 받는다. */
export interface EstimateTolerance {
  readonly green?: number | string;
  readonly yellow?: number | string;
}

/** 미리 채우는 틀린 풀이(디버그 과제). */
export interface MulDebugSample {
  readonly rows?: readonly (number | string)[];
  readonly sum?: number | string;
}

export interface ColumnCalcConfig {
  readonly mode?: ColumnMode;
  /** 윗수. `"3.5"`, `"12.08"`처럼 쓴다. 곱셈·어림은 number도 받는다. */
  readonly a?: number | string;
  /** 아랫수. */
  readonly b?: number | string;
  /** decimal은 add/sub, estimate는 add/sub/mul을 고른다. */
  readonly op?: ColumnOp;
  /** `"C-P"`면 C·P 단계에서 자석 정렬, A 단계는 자석이 없다. true/false도 받는다. */
  readonly magnetAlign?: MagnetAlign;
  readonly padZeros?: PadZeros;

  // ── mul ───────────────────────────────────────────────────
  readonly style?: MulStyleInput;
  readonly showZeroPlaceholder?: boolean;
  readonly debugSample?: MulDebugSample;

  // ── estimate ──────────────────────────────────────────────
  /** 어림값이 몇 자리(10·100·1000)의 배수인지. 기본 100. */
  readonly roundTo?: number;
  readonly tolerance?: EstimateTolerance;
  /** 미리 채운 틀린 결과. `recheck`로 지우고 다시 푼다. */
  readonly sample?: number | string;

  // ── 연결(E01·E04) ─────────────────────────────────────────
  readonly linkMarks?: LinkMarks;
}

/** 학생이 고칠 수 있는 줄. 윗수·아랫수는 카드/설정으로 정해진다. */
export type EditableRow = 'result' | 'carry' | 'regroup' | 'partial' | 'partial-carry';

export interface CellRef {
  readonly row: EditableRow;
  readonly column: number;
  /** `partial`·`partial-carry` 줄 번호(0부터, 낮은 자리부터). */
  readonly index?: number;
}

/** `link-mark`가 강조만 할 칸. 키는 `"kind:column"` 꼴이다. */
export interface LinkMark {
  readonly kind: 'carry' | 'cross' | 'regroup' | 'ten';
  readonly column: number;
}

/** `link-mark`가 자동으로 쓸 값(학생이 블록으로 한 조작을 옮겨 적는 것). */
export interface LinkValue {
  readonly kind: 'carry' | 'regroup';
  readonly column: number;
  readonly digit: string;
}

export interface ColumnCalcState {
  readonly mode: ColumnMode;
  readonly op: ColumnOp;
  readonly aText: string;
  readonly bText: string;
  readonly padZeros: PadZeros;
  /** 소수점 왼쪽(일의 자리) 열의 지수. decimal에서 카드를 놓기 전에는 null. */
  readonly aPoint: number | null;
  readonly bPoint: number | null;
  /** 학생이 누른 0 채우기 열. 그 열의 숫자는 0으로 읽는다. */
  readonly aPads: readonly number[];
  readonly bPads: readonly number[];
  readonly result: Readonly<Record<string, string>>;
  readonly carries: Readonly<Record<string, string>>;
  readonly regroups: Readonly<Record<string, string>>;
  readonly crosses: readonly number[];
  readonly tens: readonly number[];
  readonly selected: CellRef | null;

  // ── mul ───────────────────────────────────────────────────
  readonly style: MulStyle;
  readonly showZeroPlaceholder: boolean;
  readonly hasDebugSample: boolean;
  /** 부분곱 줄 index → 열 → 숫자. */
  readonly partials: readonly Readonly<Record<string, string>>[];
  /** 부분곱 줄 index → 받아올림 열 → 숫자. */
  readonly partialCarries: readonly Readonly<Record<string, string>>[];
  /** 학생이 표시한 틀린 칸(다시 누르면 해제). */
  readonly flagged: readonly CellRef[];
  /** E04 부분곱 색: 줄 index → 팔레트 번호. */
  readonly rowColors: Readonly<Record<string, number>>;

  // ── 연결 ──────────────────────────────────────────────────
  readonly linkMarks: LinkMarks;
  /** E01 이벤트로 강조만 한 칸. 다음 입력에서 지운다. */
  readonly linkHighlights: readonly string[];

  // ── estimate ──────────────────────────────────────────────
  readonly estimate: string | null;
  readonly phase: EstimatePhase;
  readonly rechecked: boolean;
  readonly hasSample: boolean;
  readonly roundTo: number;
  /** `Rational`로 읽을 수 있는 한계 문자열. */
  readonly toleranceGreen: string;
  readonly toleranceYellow: string;
}

export type ColumnCalcAction =
  | { readonly type: 'place'; readonly number: 'a' | 'b'; readonly pointColumn: number }
  | {
      readonly type: 'select';
      readonly row: EditableRow;
      readonly column: number;
      readonly index?: number;
    }
  | {
      readonly type: 'enter';
      readonly row: EditableRow;
      readonly column: number;
      readonly digit: string | null;
      readonly index?: number;
    }
  | { readonly type: 'pad-zero'; readonly number: 'a' | 'b'; readonly column: number }
  | { readonly type: 'toggle-cross'; readonly column: number }
  | { readonly type: 'toggle-ten'; readonly column: number }
  | {
      readonly type: 'flag-cell';
      readonly row: EditableRow;
      readonly column: number;
      readonly index?: number;
    }
  | {
      readonly type: 'link-mark';
      readonly marks: readonly LinkMark[];
      readonly fill: readonly LinkValue[];
      /** `auto`에서 함께 켜는 표시(빼기 줄·10 표시). 없으면 빈 배열. */
      readonly crosses: readonly number[];
      readonly tens: readonly number[];
    }
  | { readonly type: 'link-colors'; readonly colors: Readonly<Record<string, number>> }
  | { readonly type: 'enter-estimate'; readonly digit: string | null }
  | { readonly type: 'lock-estimate' }
  | { readonly type: 'unlock-estimate' }
  | { readonly type: 'recheck' };

/** 격자 위쪽에 그리는 자릿값 이름. C 단계에서만 보여 준다. */
export const PLACE_NAMES_KO: Readonly<Record<number, string>> = {
  0: '일',
  1: '십',
  2: '백',
  3: '천',
  4: '만',
  5: '십만',
};

export function placeNameKo(column: number): string {
  if (column >= 0) return PLACE_NAMES_KO[column] ?? `${column}자리`;
  return `소수 ${['첫째', '둘째', '셋째', '넷째', '다섯째', '여섯째'][-column - 1] ?? `${-column}째`}`;
}

/** 링크 강조 키. 상태·Observation·predicate가 같은 규칙을 쓴다. */
export function linkKey(kind: LinkMark['kind'], column: number): string {
  return `${kind}:${column}`;
}
