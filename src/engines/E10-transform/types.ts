/**
 * E10 도형 이동의 설정·상태·Action·Observation 타입.
 *
 * 모드별 판별 유니온이다. T105가 `tessellation`·`congruence`·`line-symmetry`·
 * `point-symmetry`를 더할 때 이 유니온에 줄을 더하고 `modes/`·`views/`에 파일을
 * 새로 만든다. 한 모드의 코드가 다른 모드 파일로 새지 않게 한다.
 *
 * 꼭짓점·칸은 정수 모눈점이다(x 오른쪽, y 아래쪽). E09의 못 좌표처럼 정수
 * 격자 번호라서 number를 쓴다. 연산은 정수 덧셈·뺄셈·부호 바꾸기·자리
 * 바꾸기만 하고, 나눗셈·삼각함수는 화면 좌표(layout·animation)에만 쓴다.
 */

export type TransformMode = 'slide-flip-turn' | 'predict';

/** 정수 모눈점. `[x, y]` */
export type Pt = readonly [number, number];

/** 한 칸. `[i, j]`는 왼쪽 위 꼭짓점이 `(i, j)`인 칸이다. */
export type Cell = readonly [number, number];

export type ShapeId = 'flag-L' | 'L4' | 'F5';

/** 8가지 방향. `flip-h`는 좌우 뒤집기, `flip-v`는 위아래 뒤집기다. */
export type Orientation =
  'id' | 'cw90' | 'r180' | 'ccw90' | 'flip-h' | 'flip-v' | 'flip-d' | 'flip-a';

export type Side = 'up' | 'down' | 'left' | 'right';

export type TurnDirection = 'cw' | 'ccw';

/** 정수 도. */
export type TurnAngle = 90 | 180 | 270;

export type MoveKind = 'slide' | 'flip' | 'turn';

/** 두 배 좌표로 변환하는 도형. `outline` 순서를 유지해 꼭짓점 이름표가 따라간다. */
export interface SquareFigure {
  readonly outline: readonly Pt[];
  readonly cells: readonly Cell[];
}

/** 상태·Action에 쓰는 이동. */
export type Move =
  | { readonly kind: 'slide'; readonly dx: number; readonly dy: number }
  | { readonly kind: 'flip'; readonly side: Side }
  | {
      readonly kind: 'turn';
      readonly direction: TurnDirection;
      readonly angle: TurnAngle;
      readonly center: Pt;
    };

/** 설정에 쓰는 이동 명세. 문자열 중심은 그 이동 직전 도형의 `outline[n]`이다. */
export type VertexRef = string | Pt;

export type MoveSpec =
  | { readonly type: 'slide'; readonly direction: Side; readonly cells: number }
  | { readonly type: 'flip'; readonly side: Side }
  | {
      readonly type: 'turn';
      readonly direction: TurnDirection;
      readonly angle: TurnAngle;
      readonly center: VertexRef;
    };

export interface SlideFlipTurnConfig {
  readonly mode?: 'slide-flip-turn';
  readonly shape?: ShapeId;
  /** 6~12로 자른다. 기본 10. */
  readonly grid?: number;
  /** 도형 상자의 왼쪽 위. 기본 `[4, 3]`. */
  readonly at?: Pt;
  readonly ghost?: boolean;
  readonly arcTrail?: boolean;
  readonly labels?: boolean;
  readonly allowed?: readonly MoveKind[];
  readonly turnAngles?: readonly TurnAngle[];
  /** "결과 도형을 보고 이동 찾기" 과제용 목표. 문제로 주는 그림이라 그린다. */
  readonly target?: { readonly orientation: Orientation; readonly at: Pt };
}

export interface PredictConfig {
  readonly mode?: 'predict';
  readonly shape?: ShapeId;
  readonly grid?: number;
  readonly at?: Pt;
  readonly ghost?: boolean;
  readonly arcTrail?: boolean;
  readonly labels?: boolean;
  /** 1~3개. 기본은 오른쪽으로 3칸 밀기다. */
  readonly operation?: MoveSpec | readonly MoveSpec[];
  /** 이동을 글로 보여 준다. 문제이지 답이 아니다. */
  readonly showOperation?: boolean;
}

export type TransformConfig = SlideFlipTurnConfig | PredictConfig;

export interface SlideFlipTurnSettings {
  readonly shape: ShapeId;
  readonly grid: number;
  readonly at: Pt;
  readonly ghost: boolean;
  readonly arcTrail: boolean;
  readonly labels: boolean;
  readonly allowed: readonly MoveKind[];
  readonly turnAngles: readonly TurnAngle[];
  /** `orientCells(start.cells, orientation, at)`. 목표가 없으면 null. */
  readonly target: readonly Cell[] | null;
}

export interface PredictSettings {
  readonly shape: ShapeId;
  readonly grid: number;
  readonly at: Pt;
  readonly ghost: boolean;
  readonly arcTrail: boolean;
  readonly labels: boolean;
  readonly showOperation: boolean;
}

export interface SlideFlipTurnState {
  readonly mode: 'slide-flip-turn';
  readonly start: SquareFigure;
  readonly moves: readonly Move[];
  /** 돌리기 중심으로 고른 `outline` 인덱스. */
  readonly center: number;
  readonly lastBlocked: boolean;
  readonly blockedCount: number;
  readonly settings: SlideFlipTurnSettings;
}

export interface PredictState {
  readonly mode: 'predict';
  readonly start: SquareFigure;
  readonly operations: readonly Move[];
  readonly painted: readonly Cell[];
  readonly confirmed: boolean;
  readonly attempts: number;
  readonly settings: PredictSettings;
}

export type TransformState = SlideFlipTurnState | PredictState;

export type TransformAction =
  | { readonly type: 'slide'; readonly dx: number; readonly dy: number }
  | { readonly type: 'flip'; readonly side: Side }
  | {
      readonly type: 'turn';
      readonly direction: TurnDirection;
      readonly angle: TurnAngle;
      readonly center: Pt;
    }
  | { readonly type: 'select-center'; readonly index: number }
  | { readonly type: 'undo-move' }
  | { readonly type: 'reset' }
  | { readonly type: 'toggle-cell'; readonly cell: Cell }
  | { readonly type: 'paint'; readonly cells: readonly Cell[]; readonly value: boolean }
  | { readonly type: 'clear-paint' }
  | { readonly type: 'confirm' }
  | { readonly type: 'retry' };

export type MoveObservation =
  | { readonly kind: 'slide'; readonly dx: number; readonly dy: number }
  | { readonly kind: 'flip'; readonly side: Side }
  | {
      readonly kind: 'turn';
      readonly direction: TurnDirection;
      readonly angle: TurnAngle;
      readonly center: Pt;
      readonly centerLabel: string | null;
    };

export const LOGICAL_WIDTH = 1000;
export const LOGICAL_HEIGHT = 1000;

export const MIN_GRID = 6;
export const MAX_GRID = 12;
export const DEFAULT_GRID = 10;
export const DEFAULT_AT: Pt = [4, 3];
export const DEFAULT_SHAPE: ShapeId = 'flag-L';

export const MOVE_KINDS: readonly MoveKind[] = ['slide', 'flip', 'turn'];
export const TURN_ANGLES: readonly TurnAngle[] = [90, 180, 270];
export const SIDES: readonly Side[] = ['up', 'down', 'left', 'right'];
export const ORIENTATIONS: readonly Orientation[] = [
  'id',
  'cw90',
  'r180',
  'ccw90',
  'flip-h',
  'flip-v',
  'flip-d',
  'flip-a',
];
