/**
 * circle 모드의 설정·상태·Action(T102).
 *
 * - 밧줄 길이·반지름·격자 좌표는 정수로만 저장한다. 컴퍼스 중심·폭과 그린 원은
 *   반 칸 단위 정수(1 = 0.5칸)로 저장해 0.5칸 무늬까지 정확히 맞춘다.
 * - 원 위의 점은 `rational-turns.ts`의 `circlePoint`로 매번 정확히 다시 계산한다.
 *   상태에는 `pos`(0~47)만 넣고 좌표·Rational은 넣지 않는다.
 * - 화면 궤적 좌표는 저장하지 않는다. 밧줄이 지나간 부채꼴 번호(0~71, 5°씩)만 남긴다.
 */
import type { Peg } from '../../types';

export type CircleTool = 'rope' | 'radius' | 'chord' | 'compass';

export type CircleScene = 'playground' | 'plain';

export interface CirclePatternCircle {
  readonly center: readonly [number, number];
  readonly radius: number;
}

export interface CircleCompassConfig {
  readonly enabled: boolean;
  /** 0.5 또는 1. 기본 1. */
  readonly gridSnap?: number;
}

export interface CircleConfig {
  readonly mode: 'circle';
  /** 정사각 못 수. 9~15, 기본 13. */
  readonly grid?: number;
  /** 기본 `plain`. `playground`는 풀밭 색 배경과 말뚝 그림만 더한다. */
  readonly scene?: CircleScene;
  /** 말뚝(중심). 기본 격자 가운데. */
  readonly stake?: readonly [number, number];
  /** 밧줄 길이(칸). 1~(grid−1)/2 정수. 기본 3. */
  readonly ropeLength?: number;
  /** 고를 수 있는 밧줄 길이. 기본 `[ropeLength]`. */
  readonly ropeLengths?: readonly number[];
  /** 지나간 자리에 점을 찍는다. 기본 true. */
  readonly traceDots?: boolean;
  /** 반지름 긋기·길이 재기 도구. 기본 false. */
  readonly measureTool?: boolean;
  /** 주어진 원의 반지름. 1~(grid−1)/2 정수. */
  readonly radius?: number;
  readonly chordExplorer?: boolean;
  /** 현 끝이 반대 자리에 가까우면 지름 자리로 붙이고 "지름" 이름표를 단다. */
  readonly snapDiameter?: boolean;
  /** 기본 꺼짐. */
  readonly compass?: CircleCompassConfig;
  /** 무늬. 있으면 본 원과 현 탐색기를 그리지 않는다. */
  readonly targetPattern?:
    'three-circles-in-row' | { readonly circles: readonly CirclePatternCircle[] };
}

/** 반 칸 단위 원. `center`·`radius` 모두 1 = 0.5칸. */
export interface CirclePattern {
  readonly center: Peg;
  readonly radius: number;
}

export interface CircleSettings {
  readonly grid: number;
  readonly scene: CircleScene;
  readonly stake: Peg;
  readonly ropeLength: number;
  readonly ropeLengths: readonly number[];
  readonly traceDots: boolean;
  readonly measureTool: boolean;
  readonly radius: number | null;
  readonly chordExplorer: boolean;
  readonly snapDiameter: boolean;
  readonly compass: { readonly enabled: boolean; readonly gridSnap: 0.5 | 1 };
  /** 반 칸 단위 제시 원. 비어 있으면 무늬 없음. */
  readonly targetPattern: readonly CirclePattern[];
}

/** 상태의 컴퍼스. `center`·`width` 모두 반 칸 단위 정수. */
export interface CircleCompassState {
  readonly center: Peg;
  readonly width: number;
}

/** 학생이 그린 원. 반 칸 단위 정수. */
export interface CircleShape {
  readonly id: string;
  readonly center: Peg;
  readonly radius: number;
}

export interface CircleState {
  readonly mode: 'circle';
  readonly tool: CircleTool;
  readonly ropeLength: number;
  /** 밧줄 길이(문자열 키) → 지나간 부채꼴 번호(0~71, 정렬·중복 없음). */
  readonly traces: Readonly<Record<string, readonly number[]>>;
  /** 반지름 끝의 `pos`(0~47). */
  readonly radii: readonly number[];
  /** 길이를 잰 반지름의 `pos`. */
  readonly measured: readonly number[];
  /** 현의 두 끝 `pos`. 없으면 null. */
  readonly chord: readonly [number, number] | null;
  readonly compass: CircleCompassState;
  readonly circles: readonly CircleShape[];
  readonly nextId: number;
  readonly settings: CircleSettings;
}

export type CircleAction =
  | { readonly type: 'select-circle-tool'; readonly tool: CircleTool }
  | { readonly type: 'set-rope'; readonly length: number }
  | { readonly type: 'trace'; readonly sector: number }
  | { readonly type: 'clear-trace' }
  | { readonly type: 'add-radius'; readonly pos: number }
  | { readonly type: 'measure-radius'; readonly pos: number }
  | { readonly type: 'set-chord'; readonly end: 0 | 1; readonly pos: number }
  | { readonly type: 'set-compass'; readonly center?: Peg; readonly width?: number }
  | { readonly type: 'draw-circle' }
  | { readonly type: 'remove-circle'; readonly id: string };
