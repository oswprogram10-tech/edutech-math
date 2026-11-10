/**
 * T105 다각형 프리셋. 꼭짓점은 모두 정수 격자 좌표이고 화면에서 시계 방향이다.
 *
 * 정오각형만 유리수 좌표로 놓을 수 없어 기호(`regular`)로 둔다. 그리기는 화면
 * 좌표(number)에서만 하고, 정오각형의 점대칭 판정은 변 수가 홀수라는 정리로
 * 항상 거짓이다(근사 계산 없음).
 */
import type { PlaneMetric } from '../../core/math';
import type { Pt } from './types';

export type LinePresetId =
  'rectangle' | 'parallelogram' | 'square' | 'isosceles-trapezoid' | 'regular-hexagon';

export type PointPresetId = 'parallelogram' | 'letter-S' | 'letter-N' | 'regular-pentagon';

export type CongruencePresetId = 'quad-a' | 'quad-b' | 'rectangle';

export type PolygonPresetId = LinePresetId | PointPresetId | CongruencePresetId;

export interface RegularPolygonSpec {
  readonly sides: number;
  readonly center: Pt;
  readonly radius: number;
}

export interface PolygonPreset {
  readonly id: PolygonPresetId;
  readonly points: readonly Pt[];
  readonly metric: PlaneMetric;
  readonly board: 'square9' | 'square10' | 'square12' | 'tri';
  readonly regular?: RegularPolygonSpec;
}

const RECTANGLE: readonly Pt[] = [
  [2, 3],
  [6, 3],
  [6, 5],
  [2, 5],
];

const PARALLELOGRAM: readonly Pt[] = [
  [3, 3],
  [7, 3],
  [5, 6],
  [1, 6],
];

const ISOSCELES_TRAPEZOID: readonly Pt[] = [
  [2, 3],
  [6, 3],
  [7, 5],
  [1, 5],
];

const SQUARE: readonly Pt[] = [
  [2, 2],
  [6, 2],
  [6, 6],
  [2, 6],
];

const REGULAR_HEXAGON: readonly Pt[] = [
  [6, 3],
  [4, 5],
  [2, 5],
  [2, 3],
  [4, 1],
  [6, 1],
];

const LETTER_S: readonly Pt[] = [
  [3, 2],
  [6, 2],
  [6, 3],
  [4, 3],
  [4, 4],
  [6, 4],
  [6, 7],
  [3, 7],
  [3, 6],
  [5, 6],
  [5, 5],
  [3, 5],
];

const LETTER_N: readonly Pt[] = [
  [3, 2],
  [4, 2],
  [4, 3],
  [5, 3],
  [5, 4],
  [6, 4],
  [6, 2],
  [7, 2],
  [7, 7],
  [6, 7],
  [6, 6],
  [5, 6],
  [5, 5],
  [4, 5],
  [4, 7],
  [3, 7],
];

const QUAD_A: readonly Pt[] = [
  [0, 0],
  [4, 0],
  [5, 3],
  [1, 2],
];

const QUAD_B: readonly Pt[] = [
  [0, 0],
  [5, 0],
  [3, 2],
  [0, 3],
];

export const POLYGONS: Readonly<Record<PolygonPresetId, PolygonPreset>> = {
  rectangle: { id: 'rectangle', points: RECTANGLE, metric: 'euclid', board: 'square9' },
  parallelogram: {
    id: 'parallelogram',
    points: PARALLELOGRAM,
    metric: 'euclid',
    board: 'square9',
  },
  square: { id: 'square', points: SQUARE, metric: 'euclid', board: 'square9' },
  'isosceles-trapezoid': {
    id: 'isosceles-trapezoid',
    points: ISOSCELES_TRAPEZOID,
    metric: 'euclid',
    board: 'square9',
  },
  'regular-hexagon': {
    id: 'regular-hexagon',
    points: REGULAR_HEXAGON,
    metric: 'hex',
    board: 'tri',
  },
  'letter-S': { id: 'letter-S', points: LETTER_S, metric: 'euclid', board: 'square10' },
  'letter-N': { id: 'letter-N', points: LETTER_N, metric: 'euclid', board: 'square10' },
  'regular-pentagon': {
    id: 'regular-pentagon',
    points: [],
    metric: 'euclid',
    board: 'square10',
    regular: { sides: 5, center: [5, 5], radius: 3 },
  },
  'quad-a': { id: 'quad-a', points: QUAD_A, metric: 'euclid', board: 'square12' },
  'quad-b': { id: 'quad-b', points: QUAD_B, metric: 'euclid', board: 'square12' },
};

export const LINE_PRESET_IDS: readonly LinePresetId[] = [
  'rectangle',
  'parallelogram',
  'square',
  'isosceles-trapezoid',
  'regular-hexagon',
];

export const POINT_PRESET_IDS: readonly PointPresetId[] = [
  'parallelogram',
  'letter-S',
  'letter-N',
  'regular-pentagon',
];

export const CONGRUENCE_PRESET_IDS: readonly CongruencePresetId[] = [
  'quad-a',
  'quad-b',
  'rectangle',
];

export function isLinePresetId(value: string): value is LinePresetId {
  return (LINE_PRESET_IDS as readonly string[]).includes(value);
}

export function isPointPresetId(value: string): value is PointPresetId {
  return (POINT_PRESET_IDS as readonly string[]).includes(value);
}

export function isCongruencePresetId(value: string): value is CongruencePresetId {
  return (CONGRUENCE_PRESET_IDS as readonly string[]).includes(value);
}

export function presetPoints(id: PolygonPresetId): readonly Pt[] {
  return POLYGONS[id].points;
}

export function presetMetric(id: PolygonPresetId): PlaneMetric {
  return POLYGONS[id].metric;
}
