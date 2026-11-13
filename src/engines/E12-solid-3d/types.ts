/**
 * E12 3D 입체 엔진의 설정·상태·Action 타입.
 *
 * 뒤 카드(T131 3D 무대 및 확장 모드)가 모드를 추가할 수 있도록
 * Config·State·Action은 `mode` 판별 유니온 형태로 둔다.
 * 쌓기나무 좌표 `(x, y, z)`는 정수 격자 번호이므로 number를 사용한다.
 */

export type SolidMode = 'cubes';

export type CubeColor = 'plain' | 'red' | 'blue' | 'yellow' | 'green';

export type ProjectionView = 'top' | 'front' | 'side';

export type CubesTool = 'add' | 'remove';

export type ViewTurn = 0 | 1 | 2 | 3;

export type GridCoord = readonly [number, number];

export type CubeCoord = readonly [number, number, number];

export interface InitialCubeConfig {
  readonly at: CubeCoord;
  readonly color?: CubeColor;
  readonly locked?: boolean;
}

export interface ReferenceShapeConfig {
  readonly cubes: readonly CubeCoord[];
}

export interface ReferenceViewsConfig {
  readonly top?: readonly (readonly number[])[];
  readonly front?: readonly (readonly number[])[];
  readonly side?: readonly (readonly number[])[];
}

export interface CubesConfig {
  readonly mode?: 'cubes';
  /** `[cols, rows]`. 각 값은 1~8로 자른다. 기본 `[5, 5]`. */
  readonly grid?: readonly [number, number];
  /** 최대 높이(층). 1~8, 기본 5. */
  readonly maxHeight?: number;
  /** 놓을 수 있는 최대 쌓기나무 수(1 이상). 기본 `cols * rows * maxHeight`. */
  readonly maxCubes?: number;
  readonly initial?: readonly InitialCubeConfig[];
  /** false면 initial의 색을 모두 plain으로 그린다. 기본 true. */
  readonly colorHints?: boolean;
  /** 실시간 투영 뷰 목록. 기본 `['top', 'front', 'side']`. */
  readonly views?: readonly ProjectionView[];
  /** 이 카드에서는 `'right'`만 지원한다(`'left'`는 `'right'`로 취급). */
  readonly sideDirection?: 'right' | 'left';
  /** 바닥 앞쪽 가장자리에 "앞" 표시. 기본 true. */
  readonly frontMarker?: boolean;
  /** "반투명" 단추 표시. 기본 true. */
  readonly translucentToggle?: boolean;
  /** 회전 잠금. true면 회전 단추를 숨기고 turn Action을 무시한다. 기본 false. */
  readonly rotationLocked?: boolean;
  /** 과제 보기 모양(조작 불가 작은 등각 그림). */
  readonly reference?: ReferenceShapeConfig;
  /** 과제 보기 투영. */
  readonly referenceViews?: ReferenceViewsConfig;
  /** 뒤 카드·단원 카드 몫(받기만 하고 무시). */
  readonly fallback?: unknown;
  readonly variant?: unknown;
  readonly layerSlider?: unknown;
  readonly bidirectional?: unknown;
  readonly givenViews?: unknown;
  readonly challenge?: unknown;
  readonly verbalInstructions?: unknown;
  readonly targetFromStage?: unknown;
}

export type SolidConfig = CubesConfig;

export interface CubeItem {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly color: CubeColor;
  readonly locked: boolean;
}

export interface FocusCell {
  readonly view: ProjectionView;
  readonly row: number;
  readonly col: number;
}

export interface CubesSettings {
  readonly grid: readonly [number, number];
  readonly maxHeight: number;
  readonly maxCubes: number;
  readonly colorHints: boolean;
  readonly views: readonly ProjectionView[];
  readonly sideDirection: 'right';
  readonly frontMarker: boolean;
  readonly translucentToggle: boolean;
  readonly rotationLocked: boolean;
  readonly reference: ReferenceShapeConfig | null;
  readonly referenceViews: ReferenceViewsConfig | null;
}

export interface CubesState {
  readonly mode: 'cubes';
  readonly settings: CubesSettings;
  /** 늘 `(x, y, z)` 사전순으로 정렬되어 있다. */
  readonly cubes: readonly CubeItem[];
  readonly viewTurn: ViewTurn;
  readonly translucent: boolean;
  readonly tool: CubesTool;
  readonly cursor: GridCoord;
  readonly focus: FocusCell | null;
}

export type SolidState = CubesState;

export type CubesAction =
  | { readonly type: 'add'; readonly x: number; readonly y: number }
  | { readonly type: 'remove'; readonly x: number; readonly y: number }
  | { readonly type: 'select-tool'; readonly tool: CubesTool }
  | { readonly type: 'move-cursor'; readonly to: GridCoord }
  | { readonly type: 'turn'; readonly dir: 'left' | 'right' }
  | { readonly type: 'set-translucent'; readonly on: boolean }
  | { readonly type: 'focus-cell'; readonly cell: FocusCell | null }
  | { readonly type: 'clear' };

export type SolidAction = CubesAction;

export const DEFAULT_GRID: readonly [number, number] = [5, 5];
export const DEFAULT_MAX_HEIGHT = 5;
export const MIN_GRID_DIM = 1;
export const MAX_GRID_DIM = 8;
export const DEFAULT_VIEWS: readonly ProjectionView[] = ['top', 'front', 'side'];
