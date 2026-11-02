/**
 * E07 세로셈 격자의 설정·상태·Action 타입.
 *
 * 자리 숫자는 문자열 한 글자(`"0"`~`"9"`), 값 계산은 `BigInt`·`Rational`로만 한다.
 * 소수는 number로 계산하지 않는다(0.1+0.2 문제). 격자 열은 자릿값 지수
 * (…, 1, 0, −1, −2 …)로 식별하고, 상태에는 `Record<string, string>`처럼
 * 문자열 키로 넣어 JSON 직렬화를 보장한다(T014 구현 결정 3).
 */
export type ColumnMode = 'add' | 'sub' | 'decimal';

export type ColumnOp = 'add' | 'sub';

/** `"C-P"`면 C·P 단계에서 자석 정렬, A 단계는 자석 없음. true/false도 받는다. */
export type MagnetAlign = 'C-P' | boolean;

/** 빈 자리 0 채우기: 학생이 누름 / 자동 / 막음. */
export type PadZeros = 'optional' | 'auto' | 'off';

export interface ColumnCalcConfig {
  readonly mode?: ColumnMode;
  /** 윗수. `"3.5"`, `"12.08"`처럼 쓴다. */
  readonly a?: string;
  /** 아랫수. */
  readonly b?: string;
  /** decimal 모드에서만 쓴다. add/sub 모드에서는 mode가 연산이다. */
  readonly op?: ColumnOp;
  /** `"C-P"`면 C·P 단계에서 자석 정렬, A 단계는 자석이 없다. true/false도 받는다. */
  readonly magnetAlign?: MagnetAlign;
  readonly padZeros?: PadZeros;
}

/** 학생이 고칠 수 있는 줄. 윗수·아랫수는 카드/설정으로 정해진다. */
export type EditableRow = 'result' | 'carry' | 'regroup';

export interface CellRef {
  readonly row: EditableRow;
  readonly column: number;
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
}

export type ColumnCalcAction =
  | { readonly type: 'place'; readonly number: 'a' | 'b'; readonly pointColumn: number }
  | { readonly type: 'select'; readonly row: EditableRow; readonly column: number }
  | {
      readonly type: 'enter';
      readonly row: EditableRow;
      readonly column: number;
      readonly digit: string | null;
    }
  | { readonly type: 'pad-zero'; readonly number: 'a' | 'b'; readonly column: number }
  | { readonly type: 'toggle-cross'; readonly column: number }
  | { readonly type: 'toggle-ten'; readonly column: number };

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
