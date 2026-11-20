/**
 * E13 `compare-direct` 모드의 설정·상태·Action 타입.
 * 길이·들이·위치는 Rational 문자열이다(단위: 칸). 화면 좌표(px)는 상태에 두지 않는다.
 * 설정에 "어느 쪽이 더 긴가"는 없다. 판정은 콘텐츠가 Observation으로 한다.
 */

export type Attribute = 'length' | 'area' | 'capacity';

export interface LengthItemConfig {
  id: string;
  label: string;
  kind: 'rope' | 'pencil' | 'ribbon';
  shape: 'curvy' | 'straight';
  /** 정수 1~12 칸. */
  length: number;
  /** 왼쪽 끝이 출발선에서 떨어진 칸 수(정수 0~3). */
  offset?: number;
}

export interface AreaItemConfig {
  id: string;
  label: string;
  kind: 'handkerchief' | 'book' | 'paper';
  w: number;
  h: number;
}

export interface CapacityItemConfig {
  id: string;
  label: string;
  kind: 'cup';
  shape: 'tall' | 'wide';
  /** 정수 1~10(컵). */
  capacity: number;
}

export interface CompareConfig {
  mode?: 'compare-direct';
  attribute?: Attribute;
  items?: unknown[];
  baseline?: boolean;
  straighten?: boolean;
  pour?: boolean;
}

export interface LengthItem {
  readonly id: string;
  readonly label: string;
  readonly kind: 'rope' | 'pencil' | 'ribbon';
  readonly shape: 'curvy' | 'straight';
  /** Rational 문자열(칸). */
  readonly length: string;
  /** 처음 출발선에서 떨어진 칸 수(reset이 돌아갈 곳). */
  readonly offset: string;
  /** 왼쪽 끝 위치(칸, 출발선이 0). */
  readonly x: string;
  readonly y: string;
}

export interface AreaItem {
  readonly id: string;
  readonly label: string;
  readonly kind: 'handkerchief' | 'book' | 'paper';
  readonly w: string;
  readonly h: string;
  /** 왼쪽 위 모서리 위치(칸). */
  readonly x: string;
  readonly y: string;
}

export interface CapacityItem {
  readonly id: string;
  readonly label: string;
  readonly kind: 'cup';
  readonly shape: 'tall' | 'wide';
  /** Rational 문자열(컵). */
  readonly capacity: string;
}

interface CompareBase {
  readonly mode: 'compare-direct';
  /** null이 아니면 설정 오류. 화면은 오류 문구만 보인다. */
  readonly error: string | null;
  readonly baseline: boolean;
  readonly straighten: boolean;
  readonly pour: boolean;
  /** 받아들인 Action 수. */
  readonly moves: number;
}

export interface LengthCompareState extends CompareBase {
  readonly attribute: 'length';
  readonly items: readonly LengthItem[];
  /** 펴기 Action으로 곧게 편 곡선 물건 id. */
  readonly straightened: readonly string[];
}

export interface AreaCompareState extends CompareBase {
  readonly attribute: 'area';
  readonly items: readonly AreaItem[];
  /** 가장 나중에 옮긴 물건 id(겹쳤을 때 위에 그린다). */
  readonly last: string | null;
}

export interface CapacityCompareState extends CompareBase {
  readonly attribute: 'capacity';
  readonly items: readonly CapacityItem[];
  readonly poured: readonly string[];
}

export type CompareState = LengthCompareState | AreaCompareState | CapacityCompareState;

export type CompareAction =
  | { readonly type: 'straighten'; readonly id: string }
  | { readonly type: 'place'; readonly id: string; readonly x: string; readonly y: string }
  | { readonly type: 'pour'; readonly id: string }
  | { readonly type: 'reset' };

export const COMPARE_CANVAS_SELECTOR = 'svg[data-testid="compare-canvas"]';
