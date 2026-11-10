/**
 * E09 기하판의 설정·상태·Action·Observation 타입.
 *
 * 모드별 판별 유니온으로 둔다. 뒤 카드(T101 classify·drag-test, T102 circle·angle,
 * T103 diagonal·fixed-perimeter)가 모드를 더할 수 있게 하기 위해서다.
 *
 * 상태의 못 좌표는 정수 격자 번호 `[i, j]`다(i는 오른쪽, j는 아래쪽). 수학 계산은
 * `core/math/geometry`의 `gp`로 바꿔서 하고, 화면 좌표만 number다.
 */
import type { JsonValue } from '../../core/engine-sdk';
import type { ClassifyAction, ClassifyConfig, ClassifyState } from './modes/classify/types';
import type { DragTestAction, DragTestConfig, DragTestState } from './modes/drag-test/types';

export type GeoMode = 'geoboard' | 'construct' | 'classify' | 'drag-test';

/** 못·점의 정수 격자 좌표. `[i, j]` */
export type Peg = readonly [number, number];

export type ConstructTool = 'segment' | 'ray' | 'line' | 'set-square';

export type GeoObjectKind = 'segment' | 'ray' | 'line';

export interface GeoObject {
  readonly id: string;
  readonly kind: GeoObjectKind;
  readonly from: Peg;
  readonly to: Peg;
}

export interface GeoNamedPoint {
  readonly label: string;
  readonly at: Peg;
}

export interface GeoAngle {
  readonly id: string;
  readonly vertex: Peg;
  readonly a: Peg;
  readonly b: Peg;
}

export interface GeoboardConfig {
  readonly mode?: 'geoboard';
  /** `[cols, rows]`. 각 값은 3~12로 자른다. 기본 `[5, 5]`. */
  readonly grid?: readonly [number, number];
  /** `'after-submit'`은 실행기가 제출 결과를 알려 주지 않으므로 `'never'`로 본다. */
  readonly showCounts?: 'never' | 'always' | 'after-submit';
  readonly maxShapes?: number;
  /** 처음부터 놓인 고무줄(닫힌 도형). 학생이 고칠 수 있다. */
  readonly shapes?: readonly (readonly Peg[])[];
  /** 받기만 하고 무시한다(곡선은 만들지 않는다). */
  readonly allowCurves?: boolean;
}

export interface ConstructConfig {
  readonly mode?: 'construct';
  /** 정사각 못 수. 5~12, 기본 9. */
  readonly grid?: number;
  readonly tools?: readonly ConstructTool[];
  /** 이름 붙은 점(ㄱ, ㄴ …). 이름은 콘텐츠가 준다. */
  readonly points?: readonly GeoNamedPoint[];
  /** 과녁 별 좌표. */
  readonly targets?: readonly Peg[];
  readonly showExtension?: boolean;
  /** 미리 그려진 선(분류 과제용). 학생이 지울 수 없다. */
  readonly given?: readonly GeoObject[];
  /** 직각 찾기용 각. 각마다 두 변을 그린다. */
  readonly angles?: readonly GeoAngle[];
}

export type GeoConfig = GeoboardConfig | ConstructConfig | ClassifyConfig | DragTestConfig;

export interface GeoboardSettings {
  readonly grid: readonly [number, number];
  readonly showCounts: 'never' | 'always';
  readonly maxShapes: number;
}

export interface ConstructSettings {
  readonly grid: number;
  readonly tools: readonly ConstructTool[];
  readonly points: readonly GeoNamedPoint[];
  readonly targets: readonly Peg[];
  readonly showExtension: boolean;
  readonly given: readonly GeoObject[];
  readonly angles: readonly GeoAngle[];
}

export interface GeoBand {
  readonly id: string;
  /** 못 순서. 닫힌 도형도 마지막에 첫 못을 다시 넣지 않는다. */
  readonly pegs: readonly Peg[];
  readonly closed: boolean;
}

/**
 * 고무줄만 쓰는 모드(geoboard·classify)의 공통 구조.
 * `GeoboardView`가 이 구조만 보고 그리므로 두 모드가 같은 화면을 쓴다.
 */
export interface BandBoardState {
  readonly bands: readonly GeoBand[];
  readonly activeBand: string | null;
  readonly nextId: number;
  readonly settings: {
    readonly grid: readonly [number, number];
    readonly showCounts: 'never' | 'always';
    readonly maxShapes: number;
  };
}

export interface GeoboardState {
  readonly mode: 'geoboard';
  readonly bands: readonly GeoBand[];
  readonly activeBand: string | null;
  readonly nextId: number;
  readonly settings: GeoboardSettings;
}

export interface ConstructState {
  readonly mode: 'construct';
  readonly tool: ConstructTool;
  readonly pendingStart: Peg | null;
  readonly objects: readonly GeoObject[];
  /** 직각삼각자를 댄 각 id. */
  readonly squareOn: string | null;
  /** 학생이 "직각" 표시한 각 id. */
  readonly marked: readonly string[];
  readonly nextId: number;
  readonly settings: ConstructSettings;
}

export type GeoState = GeoboardState | ConstructState | ClassifyState | DragTestState;

export type GeoAction =
  | { readonly type: 'start-band'; readonly peg: Peg }
  | { readonly type: 'add-peg'; readonly peg: Peg }
  | { readonly type: 'close-band' }
  | { readonly type: 'undo-peg' }
  | { readonly type: 'delete-band'; readonly id: string }
  | { readonly type: 'move-peg'; readonly band: string; readonly index: number; readonly peg: Peg }
  | { readonly type: 'select-tool'; readonly tool: ConstructTool }
  | { readonly type: 'pick'; readonly at: Peg }
  | { readonly type: 'remove-object'; readonly id: string }
  | { readonly type: 'place-square'; readonly angle: string }
  | { readonly type: 'remove-square' }
  | { readonly type: 'toggle-mark'; readonly angle: string }
  | ClassifyAction
  | DragTestAction;

export interface GeoShapeObservation {
  readonly id: string;
  readonly closed: boolean;
  readonly simple: boolean;
  readonly vertices: number;
  readonly sides: number;
  readonly pegCount: number;
  readonly area: string;
}

export interface GeoObjectObservation {
  readonly kind: GeoObjectKind;
  readonly from: string;
  readonly to: string;
}

/** Observation에만 두는 좌표. `oneObjectHits`·`hasObject` 판정에 쓴다. */
export interface GeoObjectPointObservation {
  readonly kind: GeoObjectKind;
  readonly from: Peg;
  readonly to: Peg;
}

export type GeoObservationValue = JsonValue;

export const LOGICAL_WIDTH = 1000;
export const LOGICAL_HEIGHT = 1000;

/** 격자 크기 허용 범위(카드 결정 3). */
export const MIN_GRID = 3;
export const MAX_GRID = 12;
export const DEFAULT_GEOBOARD_GRID: readonly [number, number] = [5, 5];
export const DEFAULT_CONSTRUCT_GRID = 9;
export const DEFAULT_MAX_SHAPES = 4;
export const DEFAULT_CONSTRUCT_TOOLS: readonly ConstructTool[] = ['segment', 'ray', 'line'];
