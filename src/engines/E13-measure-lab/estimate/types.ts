/**
 * E13 `estimate` 모드(영점 어긋난 자·어림 먼저)의 설정·상태·Action 타입.
 * 길이·눈금은 Rational 문자열(cm)이다. 화면 좌표(px)는 상태에 두지 않는다.
 * 설정의 `object.lengthCm`는 재서 나오는 값(정답)이라 화면에 길이 글을 쓰지 않는다.
 */

export interface EstimateConfig {
  mode?: 'estimate';
  /** lengthCm는 0.1 격자 Rational(문자열 또는 숫자), 1~20cm. */
  object?: { name: string; lengthCm: string | number };
  ruler?: { offsetCm?: number | string; draggable?: boolean };
  estimateFirst?: boolean;
}

export interface EstimateState {
  readonly mode: 'estimate';
  /** null이 아니면 설정 오류. 화면은 오류 문구만 보인다. */
  readonly error: string | null;
  readonly objectName: string;
  /** Rational 문자열(cm). */
  readonly lengthCm: string;
  /** 처음 놓인 자 눈금(정수 0~5, Rational 문자열). reset이 되돌아가는 자리. */
  readonly initialOffset: string;
  /** 물건 왼쪽 끝이 놓인 자 눈금(Rational 문자열, 0.5 격자, 0~5). */
  readonly rulerOffset: string;
  readonly draggable: boolean;
  readonly estimateFirst: boolean;
  /** 잠긴 어림(정수 1~99). 넣기 전에는 null. */
  readonly estimate: number | null;
  readonly estimateLocked: boolean;
  /** reset 뒤 자를 옮긴 횟수(rulerMoved 판정용). */
  readonly rulerMoves: number;
  readonly moves: number;
}

export type EstimateAction =
  | { readonly type: 'move-ruler'; readonly offsetCm: string }
  | { readonly type: 'estimate'; readonly value: number }
  | { readonly type: 'reset' };

/** 자는 0~25cm. */
export const RULER_CM = 25;
export const MAX_OFFSET_CM = 5;
export const ESTIMATE_CANVAS_SELECTOR = 'svg[data-testid="estimate-canvas"]';
