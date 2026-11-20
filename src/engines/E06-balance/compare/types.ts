/**
 * E06 `compare` 모드(물건 무게 비교 저울)의 설정·상태·Action 타입.
 * 물건의 무게(정수 1~20)는 상태 안에 있지만 `showValues`가 false이면 화면 어디에도 쓰지 않는다.
 * 엔진은 "무거운 것 고르기"를 하지 않는다. 고르기·순서는 콘텐츠 응답(choice·order)이 맡는다.
 */

export const COMPARE_KINDS = [
  'apple',
  'feather',
  'balloon',
  'stone',
  'sponge',
  'iron-ball',
  'book',
  'eraser',
] as const;
export type CompareKind = (typeof COMPARE_KINDS)[number];

export type VisualSize = 'small' | 'medium' | 'large';
export type CompareSide = 'left' | 'right';
export type CompareTilt = 'left' | 'right' | 'level';
export type CompareTarget = CompareSide | 'shelf';

export interface CompareItemConfig {
  id: string;
  kind: CompareKind;
  /** 정수 1~20 */
  weight: number;
  /** 기본은 kind별 기본 크기 */
  visualSize?: VisualSize;
}

export interface CompareConfig {
  mode: 'compare';
  /** 2~4개. 없으면 샌드박스 기본(스펀지·쇠공·사과). */
  items?: CompareItemConfig[];
  /** 기본 false: true일 때만 물건 아래에 무게 숫자를 쓴다. */
  showValues?: boolean;
  /** 기본 1: 한 접시에 올릴 수 있는 물건 수(1~4). */
  maxPerPan?: number;
}

export interface CompareItem {
  readonly id: string;
  readonly kind: CompareKind;
  readonly weight: number;
  readonly size: VisualSize;
}

export interface CompareState {
  readonly mode: 'compare';
  /** null이 아니면 설정 오류. 화면은 오류 문구만 보인다. */
  readonly error: string | null;
  readonly items: readonly CompareItem[];
  readonly showValues: boolean;
  readonly maxPerPan: number;
  /** 각 접시에 올라간 물건 id(올린 순서). */
  readonly left: readonly string[];
  readonly right: readonly string[];
  /** 이미 센 (왼쪽 집합, 오른쪽 집합) 조합. 길이가 weighings다. 처음으로를 눌러도 지우지 않는다. */
  readonly seen: readonly string[];
  /** 한 물건씩 마주 올려 비교한 쌍("a|b", a < b). 처음으로를 눌러도 지우지 않는다. */
  readonly pairs: readonly string[];
}

export type CompareAction =
  | { readonly type: 'place'; readonly id: string; readonly pan: CompareTarget }
  | { readonly type: 'reset' };

export const MAX_WEIGHT = 20;
export const MIN_ITEMS = 2;
export const MAX_ITEMS = 4;
export const MAX_PER_PAN = 4;
