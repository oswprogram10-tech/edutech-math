/**
 * E12 3D 입체 엔진의 설정·상태·Action 타입.
 *
 * 뒤 카드(T131 3D 무대 및 확장 모드)가 모드를 추가할 수 있도록
 * Config·State·Action은 `mode` 판별 유니온 형태로 둔다.
 * 쌓기나무 좌표 `(x, y, z)`는 정수 격자 번호이므로 number를 사용한다.
 */

import type { NetBoxSpec, NetTarget } from './net/geometry';
import type { PrismPiece, PrismPieceType } from './prismnet/model';
import type {
  SketchDot,
  SketchLineStyle,
  SketchSegment,
  XrayEdgeId,
  XrayFaceId,
  XrayVertexId,
  XrayViewAngle,
} from './xray/geometry';

export type SolidMode = 'cubes' | 'net-fold' | 'xray' | 'prism-pyramid' | 'prism-net';

export type CubeColor = 'plain' | 'red' | 'blue' | 'yellow' | 'green';

export type ProjectionView = 'top' | 'front' | 'side';

export type CubesTool = 'add' | 'remove';

export type StageMode = 'auto' | '3d' | 'isometric';

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

export type NumberGridMode = 'input' | 'drive' | 'given';

export interface NumberGridConfig {
  readonly mode: NumberGridMode;
  readonly given?: readonly (readonly number[])[];
}

export type NumberGridSettings = NumberGridConfig;

export type LayerPanelMode = 'off' | 'live' | 'paint' | 'given';

export interface LayersConfig {
  readonly slider?: boolean;
  readonly panel?: LayerPanelMode;
  readonly given?: readonly (readonly (readonly number[])[])[];
}

export interface LayersSettings {
  readonly slider: boolean;
  readonly panel: LayerPanelMode;
  readonly given?: readonly (readonly (readonly number[])[])[];
}

export interface PaintedViewsState {
  readonly top?: readonly (readonly number[])[];
  readonly front?: readonly (readonly number[])[];
  readonly side?: readonly (readonly number[])[];
}

export type ReferenceCardKind = 'top' | 'front' | 'side' | 'layers' | 'numbers';

export interface ReferenceCardConfig {
  readonly id: string;
  readonly label: string;
  readonly kind: ReferenceCardKind;
  readonly cells?: readonly (readonly number[])[];
  readonly layers?: readonly (readonly (readonly number[])[])[];
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
  /** false면 쌓기·빼기·모두 빼기·커서 이동을 막는 보기 전용 모드. 기본 true. */
  readonly editable?: boolean;
  /** 무대 렌더러 선택. 기본 `'auto'`. */
  readonly stage?: StageMode;
  /** 과제 보기 모양(조작 불가 작은 등각 그림). */
  readonly reference?: ReferenceShapeConfig;
  /** 과제 보기 투영. */
  readonly referenceViews?: ReferenceViewsConfig;
  /** 위에서 본 모양에 수 쓰기 격자. */
  readonly numberGrid?: NumberGridConfig;
  /** 층별 슬라이더 및 층별 그림 패널. */
  readonly layers?: LayersConfig;
  /** 학생이 직접 칠하는 투영 판 목록. */
  readonly paintViews?: readonly ProjectionView[];
  /** true면 3D·등각 무대와 무대 도구를 숨기고 2D 패널만 보여 준다. */
  readonly stageHidden?: boolean;
  /** true면 referenceViews를 만족하는 쌓기나무 개수를 기록하고 맞을 때 초록 테두리를 띄운다. */
  readonly attemptLog?: boolean;
  /** 고르기 과제용 읽기 전용 보기 카드 목록(2~4장 권장). */
  readonly referenceCards?: readonly ReferenceCardConfig[];
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

export interface NetFaceConfig {
  readonly at: GridCoord;
  readonly w: number;
  readonly h: number;
  readonly label?: string;
  readonly locked?: boolean;
}

export interface NetCardFaceConfig {
  readonly at: GridCoord;
  readonly w: number;
  readonly h: number;
  readonly label?: string;
}

export interface NetCardConfig {
  readonly id: string;
  readonly label: string;
  readonly faces: readonly NetCardFaceConfig[];
}

export interface NetPredictConfig {
  readonly of: string;
}

export interface NetFoldConfig {
  readonly mode: 'net-fold';
  readonly target?: NetTarget;
  readonly faceSize?: number;
  readonly dims?: readonly [number, number, number];
  readonly grid?: readonly [number, number];
  readonly maxFaces?: number;
  readonly given?: readonly NetFaceConfig[];
  readonly editable?: boolean;
  readonly foldable?: boolean;
  readonly animate?: boolean;
  readonly collisionHighlight?: boolean;
  readonly pairColors?: boolean;
  readonly predict?: NetPredictConfig;
  readonly netLog?: boolean;
  readonly netCards?: readonly NetCardConfig[];
  readonly stage?: StageMode;
  readonly fallback?: unknown;
  readonly variant?: unknown;
}

export type XraySolidType = 'cuboid' | 'cube';

export type XrayDisplayMode = 'solid' | 'sketch';

export type XrayTool = 'face' | 'edge' | 'vertex';

export type XrayActiveTool = XrayTool | 'query';

export type XraySketchPrefill = 'visible' | 'none';

export interface XraySolidConfig {
  readonly type?: XraySolidType;
  readonly w?: number;
  readonly d?: number;
  readonly h?: number;
}

export interface XraySketchConfig {
  readonly prefill?: XraySketchPrefill;
}

export interface XrayConfig {
  readonly mode: 'xray';
  readonly solid?: XraySolidConfig;
  readonly display?: XrayDisplayMode;
  readonly rotate?: boolean;
  readonly view?: Partial<XrayViewAngle>;
  readonly xray?: boolean;
  readonly xrayToggle?: boolean;
  readonly tools?: readonly XrayTool[];
  readonly faceQuery?: boolean;
  readonly highlightFace?: XrayFaceId | null;
  readonly sketch?: false | XraySketchConfig;
  readonly stage?: StageMode;
  readonly fallback?: unknown;
  readonly variant?: unknown;
  readonly sketchGrid?: unknown;
}

export type PrismTop = 'flat' | 'apex';

export type PrismHandle = 'extrude' | 'apex';

export type PrismOrientation = 'upright' | 'lying';

export type PrismKind = 'base' | 'prism' | 'pyramid';

export interface PrismSidesRangeConfig {
  readonly min?: number;
  readonly max?: number;
}

export interface PrismInitialConfig {
  readonly sides?: number;
  readonly height?: number;
  readonly top?: PrismTop;
}

export interface PrismConfig {
  readonly mode: 'prism-pyramid';
  /** 고를 수 있는 밑면의 변의 수(3~8). 수 하나면 고정이고 n 단추를 숨긴다. */
  readonly baseSides?: number | PrismSidesRangeConfig;
  readonly initial?: PrismInitialConfig;
  readonly handles?: readonly PrismHandle[];
  readonly orientation?: PrismOrientation;
  readonly counterTable?: boolean;
  readonly showName?: boolean;
  readonly rotate?: boolean;
  readonly view?: Partial<XrayViewAngle>;
  readonly xray?: boolean;
  readonly xrayToggle?: boolean;
  readonly tools?: readonly XrayTool[];
  readonly stage?: StageMode;
  readonly fallback?: unknown;
  readonly variant?: unknown;
}

export interface PrismNetPiecesConfig {
  readonly base?: number;
  readonly rect?: number;
}

export interface PrismNetGivenConfig {
  readonly type: PrismPieceType;
  /** `given` 목록 안의 앞 항목 번호. 첫 항목(뿌리)은 null. */
  readonly parent: number | null;
  readonly parentEdge?: number;
  readonly locked?: boolean;
}

export interface PrismNetCardStep {
  readonly parent: number;
  readonly parentEdge: number;
  readonly type: PrismPieceType;
}

export interface PrismNetCardConfig {
  readonly id: string;
  readonly label: string;
  readonly n?: number;
  readonly root: PrismPieceType;
  readonly steps: readonly PrismNetCardStep[];
}

/** 각기둥 전개도(`mode:'net-fold'`, `target:'prism'`). 상태·관찰의 `mode`는 `'prism-net'`이다. */
export interface PrismNetConfig {
  readonly mode: 'net-fold';
  readonly target: 'prism';
  readonly baseSides?: number;
  readonly sideLen?: number;
  readonly height?: number;
  /** 쓸 수 있는 조각 수. 명세의 배열 형식(`["triangle","rect",…]`)도 받아 개수로 바꾼다. */
  readonly pieces?: PrismNetPiecesConfig | readonly string[];
  readonly given?: readonly PrismNetGivenConfig[];
  readonly editable?: boolean;
  readonly foldable?: boolean;
  readonly showLengths?: boolean;
  readonly collisionHighlight?: boolean;
  readonly netCards?: readonly PrismNetCardConfig[];
  readonly stage?: StageMode;
  readonly fallback?: unknown;
  readonly variant?: unknown;
}

export type SolidConfig = CubesConfig | NetFoldConfig | XrayConfig | PrismConfig | PrismNetConfig;

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
  readonly editable: boolean;
  readonly stage: StageMode;
  readonly reference: ReferenceShapeConfig | null;
  readonly referenceViews: ReferenceViewsConfig | null;
  readonly numberGrid: NumberGridSettings | null;
  readonly layers: LayersSettings;
  readonly paintViews: readonly ProjectionView[];
  readonly stageHidden: boolean;
  readonly attemptLog: boolean;
  readonly referenceCards: readonly ReferenceCardConfig[];
  readonly viewsMin: number | null;
  readonly viewsMax: number | null;
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
  /** `numberGrid.mode === 'input'`일 때만 쓰는 학생 수 행렬(`top` 방향). */
  readonly numbers: readonly (readonly number[])[] | null;
  /** 수 쓰기 격자의 선택 칸 `[row, col]`. */
  readonly numberCursor: GridCoord;
  /** 층 슬라이더에서 고른 층 번호(1..maxHeight). null이면 전체 보기. */
  readonly layerFocus: number | null;
  /** `layers.panel === 'paint'`일 때 쓰는 층별 0/1 행렬(`maxHeight`장, `top` 방향). */
  readonly layerPaint: readonly (readonly (readonly number[])[])[] | null;
  /** `paintViews`에 지정한 투영별 0/1 행렬. */
  readonly painted: PaintedViewsState | null;
  /** `attemptLog`가 켜졌을 때 `referenceViews`를 만족한 쌓기나무 개수 목록(오름차순·중복 없음). */
  readonly matchedCounts: readonly number[];
}

export interface NetFace {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly label: string | null;
  readonly locked: boolean;
}

export interface NetFoldSettings extends NetBoxSpec {
  readonly grid: readonly [number, number];
  readonly maxFaces: number;
  readonly editable: boolean;
  readonly foldable: boolean;
  readonly animate: boolean;
  readonly collisionHighlight: boolean;
  readonly pairColors: boolean;
  readonly predict: NetPredictConfig | null;
  readonly netLog: boolean;
  readonly netCards: readonly NetCardConfig[];
}

export interface NetFoldState {
  readonly mode: 'net-fold';
  readonly settings: NetFoldSettings;
  /** 늘 `(y, x)` 순으로 정렬되어 있다. */
  readonly faces: readonly NetFace[];
  readonly shape: readonly [number, number];
  readonly cursor: GridCoord;
  readonly folded: boolean;
  readonly viewTurn: ViewTurn;
  readonly prediction: string | null;
  readonly predictedBeforeFold: boolean;
  /** 정규형 키(오름차순·중복 없음). */
  readonly foundNets: readonly string[];
}

export interface XraySolidSpec {
  readonly type: XraySolidType;
  readonly w: number;
  readonly d: number;
  readonly h: number;
}

export interface XraySettings {
  readonly solid: XraySolidSpec;
  readonly display: XrayDisplayMode;
  readonly rotate: boolean;
  readonly view: XrayViewAngle;
  readonly xray: boolean;
  readonly xrayToggle: boolean;
  readonly tools: readonly XrayTool[];
  readonly faceQuery: boolean;
  readonly highlightFace: XrayFaceId | null;
  readonly sketch: false | { readonly prefill: XraySketchPrefill };
}

export interface XrayMarkedState {
  readonly faces: readonly XrayFaceId[];
  readonly edges: readonly XrayEdgeId[];
  readonly vertices: readonly XrayVertexId[];
}

export interface XrayState {
  readonly mode: 'xray';
  readonly settings: XraySettings;
  readonly view: XrayViewAngle;
  readonly xray: boolean;
  readonly xrayUsed: boolean;
  readonly tool: XrayActiveTool | null;
  readonly marked: XrayMarkedState;
  readonly queryFace: XrayFaceId | null;
  readonly segments: readonly SketchSegment[];
  readonly lineStyle: SketchLineStyle;
}

export interface PrismSettings {
  readonly sidesMin: number;
  readonly sidesMax: number;
  readonly handles: readonly PrismHandle[];
  readonly orientation: PrismOrientation;
  readonly counterTable: boolean;
  readonly showName: boolean;
  readonly rotate: boolean;
  readonly view: XrayViewAngle;
  readonly xray: boolean;
  readonly xrayToggle: boolean;
  readonly tools: readonly XrayTool[];
}

export interface PrismMarkedState {
  readonly faces: readonly string[];
  readonly edges: readonly string[];
  readonly vertices: readonly string[];
}

export type PrismTableCol = 'faces' | 'edges' | 'vertices';

export interface PrismTableRow {
  readonly kind: 'prism' | 'pyramid';
  readonly n: number;
  readonly faces: number | null;
  readonly edges: number | null;
  readonly vertices: number | null;
}

export interface PrismState {
  readonly mode: 'prism-pyramid';
  readonly settings: PrismSettings;
  readonly sides: number;
  readonly height: number;
  readonly top: PrismTop;
  readonly view: XrayViewAngle;
  readonly xray: boolean;
  readonly xrayUsed: boolean;
  readonly tool: XrayTool | null;
  readonly marked: PrismMarkedState;
  readonly apexPlayed: boolean;
  readonly table: readonly PrismTableRow[];
}

export interface PrismNetCardSettings {
  readonly id: string;
  readonly label: string;
  readonly n: number;
  readonly root: PrismPieceType;
  readonly steps: readonly PrismNetCardStep[];
}

export interface PrismNetSettings {
  readonly n: number;
  readonly sideLen: number;
  readonly height: number;
  /** 쓸 수 있는 조각 수(처음 놓인 조각 포함). */
  readonly total: { readonly base: number; readonly rect: number };
  readonly editable: boolean;
  readonly foldable: boolean;
  readonly showLengths: boolean;
  readonly collisionHighlight: boolean;
  readonly netCards: readonly PrismNetCardSettings[];
}

export interface PrismNetState {
  readonly mode: 'prism-net';
  readonly settings: PrismNetSettings;
  readonly pieces: readonly PrismPiece[];
  readonly selectedType: PrismPieceType | null;
  readonly folded: boolean;
  readonly foldCount: number;
}

export type SolidState = CubesState | NetFoldState | XrayState | PrismState | PrismNetState;

export type CubesAction =
  | { readonly type: 'add'; readonly x: number; readonly y: number }
  | { readonly type: 'remove'; readonly x: number; readonly y: number }
  | { readonly type: 'select-tool'; readonly tool: CubesTool }
  | { readonly type: 'move-cursor'; readonly to: GridCoord }
  | { readonly type: 'turn'; readonly dir: 'left' | 'right' }
  | { readonly type: 'set-translucent'; readonly on: boolean }
  | { readonly type: 'focus-cell'; readonly cell: FocusCell | null }
  | {
      readonly type: 'set-number';
      readonly row: number;
      readonly col: number;
      readonly value: number;
    }
  | { readonly type: 'move-number-cursor'; readonly to: GridCoord }
  | { readonly type: 'set-height'; readonly x: number; readonly y: number; readonly h: number }
  | { readonly type: 'focus-layer'; readonly layer: number | null }
  | {
      readonly type: 'toggle-layer-cell';
      readonly layer: number;
      readonly row: number;
      readonly col: number;
    }
  | { readonly type: 'clear-layer-paint' }
  | {
      readonly type: 'toggle-paint-cell';
      readonly view: ProjectionView;
      readonly row: number;
      readonly col: number;
    }
  | { readonly type: 'clear-paint'; readonly view: ProjectionView }
  | { readonly type: 'clear' };

export type NetFoldAction =
  | { readonly type: 'place-face'; readonly x: number; readonly y: number }
  | { readonly type: 'remove-face'; readonly x: number; readonly y: number }
  | { readonly type: 'select-shape'; readonly w: number; readonly h: number }
  | { readonly type: 'rotate-shape' }
  | { readonly type: 'move-cursor'; readonly to: GridCoord }
  | { readonly type: 'fold' }
  | { readonly type: 'unfold' }
  | { readonly type: 'turn'; readonly dir: 'left' | 'right' }
  | { readonly type: 'predict'; readonly label: string }
  | { readonly type: 'clear' };

export type XrayAction =
  | { readonly type: 'set-view'; readonly yaw: number; readonly pitch: number }
  | { readonly type: 'rotate-view'; readonly dYaw: number; readonly dPitch: number }
  | { readonly type: 'toggle-xray' }
  | { readonly type: 'set-tool'; readonly tool: XrayActiveTool }
  | { readonly type: 'toggle-mark'; readonly kind: XrayTool; readonly id: string }
  | { readonly type: 'query-face'; readonly face: XrayFaceId }
  | { readonly type: 'clear-marks' }
  | { readonly type: 'set-line-style'; readonly style: SketchLineStyle }
  | {
      readonly type: 'add-segment';
      readonly a: SketchDot;
      readonly b: SketchDot;
      readonly style: SketchLineStyle;
    }
  | { readonly type: 'remove-segment'; readonly a: SketchDot; readonly b: SketchDot }
  | { readonly type: 'clear-sketch' };

export type PrismAction =
  | Extract<
      XrayAction,
      {
        readonly type:
          'set-view' | 'rotate-view' | 'toggle-xray' | 'set-tool' | 'toggle-mark' | 'clear-marks';
      }
    >
  | { readonly type: 'set-sides'; readonly n: number }
  | { readonly type: 'set-height'; readonly h: number }
  | { readonly type: 'set-top'; readonly top: PrismTop }
  | { readonly type: 'add-table-row' }
  | {
      readonly type: 'set-table-cell';
      readonly row: number;
      readonly col: PrismTableCol;
      readonly value: number | null;
    }
  | { readonly type: 'remove-table-row'; readonly row: number };

export type PrismNetAction =
  | { readonly type: 'select-piece-type'; readonly pieceType: PrismPieceType | null }
  | { readonly type: 'attach'; readonly parent: number | null; readonly parentEdge: number }
  | { readonly type: 'remove-piece'; readonly id: number }
  | { readonly type: 'clear' }
  | { readonly type: 'toggle-fold' };

export type SolidAction = CubesAction | NetFoldAction | XrayAction | PrismAction | PrismNetAction;

export const XRAY_DEFAULT_SOLID: XraySolidSpec = { type: 'cuboid', w: 4, d: 3, h: 2 };
export const XRAY_DEFAULT_VIEW: XrayViewAngle = { yaw: 30, pitch: 30 };
export const XRAY_DEFAULT_TOOLS: readonly XrayTool[] = ['face', 'edge', 'vertex'];

export const PRISM_MIN_SIDES = 3;
export const PRISM_MAX_SIDES = 8;
export const PRISM_MAX_HEIGHT = 4;
export const PRISM_MAX_TABLE_ROWS = 12;
export const PRISM_DEFAULT_VIEW: XrayViewAngle = { yaw: 30, pitch: 30 };
export const PRISM_DEFAULT_TOOLS: readonly XrayTool[] = ['face', 'edge', 'vertex'];
export const PRISM_DEFAULT_HANDLES: readonly PrismHandle[] = ['extrude', 'apex'];

export const NET_DEFAULT_GRID: readonly [number, number] = [6, 6];
export const NET_MIN_GRID = 3;
export const NET_MAX_GRID = 10;
export const NET_MIN_FACES = 6;
export const NET_MAX_FACES = 10;
export const NET_DEFAULT_MAX_FACES = 8;

export const DEFAULT_GRID: readonly [number, number] = [5, 5];
export const DEFAULT_MAX_HEIGHT = 5;
export const MIN_GRID_DIM = 1;
export const MAX_GRID_DIM = 8;
export const DEFAULT_VIEWS: readonly ProjectionView[] = ['top', 'front', 'side'];
