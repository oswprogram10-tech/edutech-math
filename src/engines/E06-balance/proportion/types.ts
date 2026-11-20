/**
 * E06 `proportion` 모드(외항·내항 격자 넓이 저울)의 설정·상태·Action 타입.
 * 비례식 a : b = c : d의 외항 a·d는 왼쪽 접시의 격자(a×d칸), 내항 b·c는 오른쪽 접시의 격자(b×c칸)다.
 * 항은 1~30의 정수 문자열이다. 설정에 □의 정답은 없다. 기울기는 학생이 놓은 값으로만 계산한다.
 */

export type ProportionLook = 'scale' | 'grid' | 'symbols';

export interface ProportionConfig {
  mode: 'proportion';
  /** "3 : 5 = □ : 20" — 네 항, □는 0개 또는 1개. cards와 함께 쓰지 않는다. */
  equation?: string;
  /** □ 없는 비례식 후보 2~4장. equation과 함께 쓰지 않는다. */
  cards?: string[];
  /** □에 넣어 볼 수의 범위. 기본 {min:1, max:20}. */
  unknownSlider?: { min: number; max: number };
  /** 기본 'scale' (C 저울+격자 / P 격자 두 개 나란히 / A 식만) */
  look?: ProportionLook;
  /** 기본 false: true면 학생이 네 항 중 두 개를 골라 왼쪽 직사각형을 만든다. */
  pairSelect?: boolean;
}

export interface ProportionSettings {
  readonly look: ProportionLook;
  readonly pairSelect: boolean;
  readonly slider: { readonly min: number; readonly max: number };
}

export interface ProportionState {
  readonly mode: 'proportion';
  /** null이 아니면 설정 오류. 화면은 오류 문구만 보인다. */
  readonly error: string | null;
  readonly settings: ProportionSettings;
  /** 카드 모드의 후보(각각 네 항). equation 모드는 빈 배열. */
  readonly cards: readonly (readonly string[])[];
  /** 저울에 올라온 식의 네 항. □ 자리는 null. 카드를 고르기 전에는 빈 배열. */
  readonly terms: readonly (string | null)[];
  readonly boxIndex: number | null;
  readonly tryValue: string | null;
  readonly tries: readonly string[];
  readonly cardIndex: number | null;
  /** pairSelect: 학생이 고른 두 항의 번호(고른 순서). 왼쪽 격자의 가로·세로가 된다. */
  readonly pair: readonly [number, number] | null;
}

export type ProportionAction =
  | { readonly type: 'try'; readonly value: string }
  | { readonly type: 'select-card'; readonly index: number }
  | { readonly type: 'pick-pair'; readonly indices: readonly [number, number] }
  | { readonly type: 'reset' };

/** 항의 범위(1~30 정수). */
export const MIN_TERM = 1;
export const MAX_TERM = 30;
/** 슬라이더 범위의 한계. 칸 하나가 최소 4논리px이도록 가장 큰 변을 45칸 이하로 한다. */
export const MAX_SLIDER = 45;
export const DEFAULT_SLIDER = { min: 1, max: 20 } as const;
export const MIN_CARDS = 2;
export const MAX_CARDS = 4;
