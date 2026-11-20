/**
 * E14 `calendar` 모드의 설정·상태·Action 타입.
 * 가려진 날짜의 값은 상태·Observation(`hiddenCorrect` 판정)에만 있고 화면 DOM에는 쓰지 않는다.
 */

export interface CalendarConfig {
  readonly mode: 'calendar';
  /** "YYYY-MM". */
  readonly month?: string;
  /** 가려진 날짜(그 달에 있는 날). */
  readonly hidden?: readonly number[];
  /** 기본 true. false면 요일 줄을 그리지 않는다. */
  readonly showWeekdayHeader?: boolean;
  /** 날짜를 눌러 고르기/풀기. 기본 false. */
  readonly select?: boolean;
  /** 가려진 칸에 수 넣기. 기본 false. */
  readonly fill?: boolean;
  /** 세로줄 쓸기로 +7 화살표 그리기. 기본 false. */
  readonly arrows?: boolean;
}

export interface CalendarState {
  readonly mode: 'calendar';
  /** null이 아니면 설정 오류. 화면은 오류 문구만 보인다. */
  readonly error: string | null;
  readonly year: number;
  readonly month: number;
  readonly days: number;
  /** 1일의 요일(0=일요일). */
  readonly first: number;
  /** 가려진 날짜(오름차순). */
  readonly hidden: readonly number[];
  readonly weekdayHeader: boolean;
  readonly canSelect: boolean;
  readonly canFill: boolean;
  readonly canArrow: boolean;
  /** 고른 날(오름차순). */
  readonly selected: readonly number[];
  /** 가려진 칸에 학생이 넣은 수(키는 날짜 문자열). */
  readonly filled: Readonly<Record<string, number>>;
  /** 그린 화살표 마디 "열:위쪽 줄"(오름차순). 마디 하나가 화살표 하나다. */
  readonly segments: readonly string[];
  readonly moves: number;
}

export type CalendarAction =
  | { readonly type: 'toggle'; readonly day: number }
  | { readonly type: 'fill'; readonly day: number; readonly value: number }
  | {
      readonly type: 'draw-arrows';
      readonly col: number;
      readonly fromRow: number;
      readonly toRow: number;
    }
  | { readonly type: 'reset' };
