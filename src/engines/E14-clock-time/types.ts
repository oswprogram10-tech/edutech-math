/**
 * E14 시계·시간 `clock` 모드의 설정·상태·Action 타입.
 * 상태는 12시간 시계의 분 `minutes`(0~719 정수)다. 0은 12:00이다.
 * 설정에 정답 시각은 없다. 판정은 콘텐츠 goal이 Observation으로 한다.
 */

export type Granularity = 'hour' | 'half-hour' | 'five-minute' | 'minute';
export type DigitalReadout = 'never' | 'always';

export interface ClockConfig {
  mode?: 'clock';
  /** 처음 시각 "H:MM". 기본 "12:00"(샌드박스 기본은 "3:00"). */
  start?: string;
  /** 허용 분 간격. 기본 'minute'. */
  granularity?: Granularity;
  /** 배열이면 그 분들만 허용(granularity보다 우선). '5-weak'면 1분 단위 + 손을 뗄 때 5의 배수 ±1분에 붙음. */
  snapMinuteTo?: number[] | '5-weak';
  showGears?: boolean;
  hideMinuteHand?: boolean;
  readOnly?: boolean;
  /** 기본 'never'. 'after-submit'은 지원하지 않아 'never'로 읽는다. */
  digitalReadout?: DigitalReadout | 'after-submit';
  /** true면 [펼치기] 단추를 보인다. */
  unroll?: boolean;
}

export interface ClockState {
  readonly mode: 'clock';
  /** null이 아니면 설정 오류. 화면은 오류 문구만 보인다. */
  readonly error: string | null;
  /** 12시간 분 0~719. */
  readonly minutes: number;
  /** 처음 분(reset이 돌아갈 곳). */
  readonly initial: number;
  /** 허용하는 '시 안의 분'(0~59) 오름차순. */
  readonly allowed: readonly number[];
  /** '5-weak': 끌다 놓을 때 5의 배수 ±1분에서 붙는다. */
  readonly weakSnap: boolean;
  readonly showGears: boolean;
  readonly hideMinuteHand: boolean;
  readonly readOnly: boolean;
  readonly digitalReadout: DigitalReadout;
  /** 펼치기 단추를 보이는가. */
  readonly unroll: boolean;
  readonly unrolled: boolean;
  /** 받아들인 set-time·step 횟수. */
  readonly moves: number;
}

export type ClockAction =
  | { readonly type: 'set-time'; readonly minutes: number }
  | { readonly type: 'step'; readonly delta: number }
  | { readonly type: 'toggle-unroll' }
  | { readonly type: 'reset' };

export const LOGICAL_WIDTH = 1000;
export const LOGICAL_HEIGHT = 600;
export const CANVAS_SELECTOR = 'svg[data-testid="clock-canvas"]';
export const MINUTES_PER_HALF_DAY = 720;
