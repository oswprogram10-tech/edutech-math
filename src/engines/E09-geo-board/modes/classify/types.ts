/**
 * classify 모드의 설정·상태·Action(T101).
 *
 * 고무줄 구조는 geoboard와 같고, 닫은 단순 도형의 성질을 자동으로 판정해 보여 준다.
 * 도형 이름은 Observation·이벤트에만 쓰고 화면 글자로는 쓰지 않는다.
 */
import type { GeoBand } from '../../types';

export type ClassifyProperty = 'rightAngles' | 'parallelSides' | 'equalSides' | 'angles';

export type ClassifyTool = 'geoboard-band' | 'set-square';

export interface ClassifyConfig {
  readonly mode: 'classify';
  readonly grid?: readonly [number, number];
  readonly maxShapes?: number;
  readonly shapes?: readonly (readonly (readonly [number, number])[])[];
  /** `geoboard-band`는 항상 켜진다. */
  readonly tools?: readonly ClassifyTool[];
  readonly showProperties?: readonly ClassifyProperty[];
  /** 받기만 하고 무시한다. 판정은 방향과 무관하다. */
  readonly rotatedShapes?: boolean;
}

export interface ClassifySettings {
  readonly grid: readonly [number, number];
  readonly maxShapes: number;
  readonly showCounts: 'never';
  readonly tools: readonly ClassifyTool[];
  readonly showProperties: readonly ClassifyProperty[];
}

export interface ClassifyState {
  readonly mode: 'classify';
  readonly bands: readonly GeoBand[];
  readonly activeBand: string | null;
  readonly nextId: number;
  readonly squareOn: { readonly band: string; readonly index: number } | null;
  readonly settings: ClassifySettings;
}

export type ClassifyAction =
  | { readonly type: 'place-square-at'; readonly band: string; readonly index: number }
  | { readonly type: 'remove-square' };
