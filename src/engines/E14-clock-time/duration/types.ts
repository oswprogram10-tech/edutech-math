/**
 * E14 `duration` 모드의 설정·상태·Action 타입. 시각은 하루 분(정수)이다.
 * 걸린 시간(분)은 상태에 저장하지 않고 Observation에서만 계산한다.
 */

export interface DurationConfig {
  readonly mode: 'duration';
  /** 띠의 시작 "H:MM". 정시여야 한다. */
  readonly from?: string;
  /** 띠의 끝 "H:MM". 정시이고 to − from은 1~4시간이다. */
  readonly to?: string;
  /** 시작 표시를 처음부터 놓을 자리. */
  readonly start?: string;
  /** true면 시작 표시를 못 움직인다(끝만 놓는다). */
  readonly startFixed?: boolean;
  /** 표시가 붙는 간격(분). 기본 5. */
  readonly step?: 1 | 5;
}

export interface DurationState {
  readonly mode: 'duration';
  /** null이 아니면 설정 오류. 화면은 오류 문구만 보인다. */
  readonly error: string | null;
  readonly from: number;
  readonly to: number;
  readonly step: number;
  readonly startFixed: boolean;
  readonly start: number | null;
  readonly end: number | null;
  readonly initialStart: number | null;
  /** 받아들인 set-mark 횟수. */
  readonly moves: number;
}

export type DurationAction =
  | { readonly type: 'set-mark'; readonly which: 'start' | 'end'; readonly minutes: number }
  | { readonly type: 'reset' };

export type MarkName = 'start' | 'end';
