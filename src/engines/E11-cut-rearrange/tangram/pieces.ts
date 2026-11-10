/**
 * 칠교·패턴 블록 조각의 기준 자세. 격자 단위, y 아래쪽.
 *
 * 한 세트의 모든 좌표·넓이는 `a + b√d` 꼴로 닫혀 있다.
 */
import { Rational } from '../../../core/math';
import type { SPoint } from './surd-geometry';
import { sAverage, sPolygonArea, sRotate } from './surd-geometry';
import type { SurdD } from './surd';
import { sAdd, sNeg, sOf } from './surd';

export type PieceSet = 'tangram' | 'pattern-blocks';

export type TangramKind =
  'large-triangle' | 'medium-triangle' | 'small-triangle' | 'square' | 'parallelogram';

export type PatternKind =
  'triangle' | 'square' | 'rhombus' | 'thin-rhombus' | 'trapezoid' | 'hexagon';

export type PieceKind = TangramKind | PatternKind;

export interface PieceDef {
  readonly kind: PieceKind;
  readonly corners: number;
  readonly base: readonly SPoint[];
}

function pt(x: ReturnType<typeof sOf>, y: ReturnType<typeof sOf>): SPoint {
  return { x, y };
}

function i(value: number, d: SurdD) {
  return sOf(Rational.of(value), Rational.of(0), d);
}

/** 패턴 블록 전용: `a + b√3` (a·b는 분수). 부동소수를 만들지 않는다. */
function s3(an: number, ad: number, bn: number, bd: number): SPointValue {
  return sOf(Rational.of(an, ad), Rational.of(bn, bd), 3);
}

/** 패턴 블록 전용 유리 좌표. */
function r3(n: number, d: number): SPointValue {
  return sOf(Rational.of(n, d), Rational.of(0), 3);
}

type SPointValue = ReturnType<typeof sOf>;

const TANGRAM_DEFS: readonly PieceDef[] = [
  {
    kind: 'large-triangle',
    corners: 3,
    base: [pt(i(0, 2), i(0, 2)), pt(i(4, 2), i(0, 2)), pt(i(2, 2), i(2, 2))],
  },
  {
    kind: 'medium-triangle',
    corners: 3,
    base: [pt(i(0, 2), i(0, 2)), pt(i(2, 2), i(0, 2)), pt(i(0, 2), i(2, 2))],
  },
  {
    kind: 'small-triangle',
    corners: 3,
    base: [pt(i(0, 2), i(0, 2)), pt(i(2, 2), i(0, 2)), pt(i(1, 2), i(1, 2))],
  },
  {
    kind: 'square',
    corners: 4,
    base: [pt(i(1, 2), i(0, 2)), pt(i(2, 2), i(1, 2)), pt(i(1, 2), i(2, 2)), pt(i(0, 2), i(1, 2))],
  },
  {
    kind: 'parallelogram',
    corners: 4,
    base: [pt(i(0, 2), i(0, 2)), pt(i(2, 2), i(0, 2)), pt(i(3, 2), i(1, 2)), pt(i(1, 2), i(1, 2))],
  },
];

const PATTERN_DEFS: readonly PieceDef[] = [
  {
    kind: 'triangle',
    corners: 3,
    base: [pt(r3(0, 1), r3(0, 1)), pt(r3(1, 1), r3(0, 1)), pt(r3(1, 2), s3(0, 1, -1, 2))],
  },
  {
    kind: 'square',
    corners: 4,
    base: [
      pt(r3(0, 1), r3(0, 1)),
      pt(r3(1, 1), r3(0, 1)),
      pt(r3(1, 1), r3(-1, 1)),
      pt(r3(0, 1), r3(-1, 1)),
    ],
  },
  {
    kind: 'rhombus',
    corners: 4,
    base: [
      pt(r3(0, 1), r3(0, 1)),
      pt(r3(1, 1), r3(0, 1)),
      pt(r3(3, 2), s3(0, 1, -1, 2)),
      pt(r3(1, 2), s3(0, 1, -1, 2)),
    ],
  },
  {
    kind: 'thin-rhombus',
    corners: 4,
    base: [
      pt(r3(0, 1), r3(0, 1)),
      pt(r3(1, 1), r3(0, 1)),
      pt(s3(1, 1, 1, 2), r3(-1, 2)),
      pt(s3(0, 1, 1, 2), r3(-1, 2)),
    ],
  },
  {
    kind: 'trapezoid',
    corners: 4,
    base: [
      pt(r3(0, 1), r3(0, 1)),
      pt(r3(2, 1), r3(0, 1)),
      pt(r3(3, 2), s3(0, 1, -1, 2)),
      pt(r3(1, 2), s3(0, 1, -1, 2)),
    ],
  },
  {
    kind: 'hexagon',
    corners: 6,
    base: [
      pt(r3(0, 1), r3(0, 1)),
      pt(r3(1, 1), r3(0, 1)),
      pt(r3(3, 2), s3(0, 1, -1, 2)),
      pt(r3(1, 1), s3(0, 1, -1, 1)),
      pt(r3(0, 1), s3(0, 1, -1, 1)),
      pt(r3(-1, 2), s3(0, 1, -1, 2)),
    ],
  },
];

export function setD(set: PieceSet): SurdD {
  return set === 'tangram' ? 2 : 3;
}

export function defaultRotationStep(set: PieceSet): number {
  return set === 'tangram' ? 45 : 30;
}

export function pieceDefinitions(set: PieceSet): readonly PieceDef[] {
  return set === 'tangram' ? TANGRAM_DEFS : PATTERN_DEFS;
}

export function defaultKinds(set: PieceSet): readonly PieceKind[] {
  if (set === 'pattern-blocks') return PATTERN_DEFS.map((def) => def.kind);
  return [
    'large-triangle',
    'large-triangle',
    'medium-triangle',
    'small-triangle',
    'small-triangle',
    'square',
    'parallelogram',
  ];
}

export function kindDefinition(set: PieceSet, kind: string): PieceDef | null {
  return pieceDefinitions(set).find((def) => def.kind === kind) ?? null;
}

export function isKindOf(set: PieceSet, kind: string): kind is PieceKind {
  return kindDefinition(set, kind) !== null;
}

/** 뒤집은 다음 돌린 기준 자세. */
export function orientedBase(def: PieceDef, rot: number, flip: boolean, step: number): SPoint[] {
  return def.base.map((point) =>
    sRotate({ x: flip ? sNeg(point.x) : point.x, y: point.y }, rot, step),
  );
}

/** 화면 꼭짓점 = at + R(rot·step)·F(flip)·기준 꼭짓점. */
export function pieceVertices(
  set: PieceSet,
  kind: string,
  at: SPoint,
  rot: number,
  flip: boolean,
  step: number,
): SPoint[] {
  const def = kindDefinition(set, kind);
  if (!def) return [];
  return orientedBase(def, rot, flip, step).map((point) => ({
    x: sAdd(point.x, at.x),
    y: sAdd(point.y, at.y),
  }));
}

export function pieceCenter(
  set: PieceSet,
  kind: string,
  at: SPoint,
  rot: number,
  flip: boolean,
  step: number,
): SPoint {
  return sAverage(pieceVertices(set, kind, at, rot, flip, step));
}

export function pieceArea(set: PieceSet, kind: string): ReturnType<typeof sPolygonArea> | null {
  const def = kindDefinition(set, kind);
  if (!def) return null;
  return sPolygonArea(def.base);
}

/** tangram 판: 28×18칸, 한 칸 40, 원점 화면 (40, 40). */
export const TANGRAM_COLS = 28;
export const TANGRAM_ROWS = 18;
export const TANGRAM_CELL = 40;
export const TANGRAM_ORIGIN = { x: 40, y: 40 } as const;

export const PIECE_COLORS = [
  '#2f6fde',
  '#c2410c',
  '#2f9e6b',
  '#7c3aed',
  '#b08900',
  '#0e7490',
  '#be185d',
] as const;

export function pieceColor(index: number): string {
  return PIECE_COLORS[index % PIECE_COLORS.length] ?? PIECE_COLORS[0];
}

/** 화면 좌표 계산용. 조각의 대략적 크기(격자 단위). */
export function pieceScale(set: PieceSet, kind: string): number {
  const def = kindDefinition(set, kind);
  if (!def) return 1;
  const xs = def.base.map(
    (point) =>
      Number(point.x.a.n) / Number(point.x.a.d) +
      (Number(point.x.b.n) / Number(point.x.b.d)) * Math.sqrt(point.x.d),
  );
  const ys = def.base.map(
    (point) =>
      Number(point.y.a.n) / Number(point.y.a.d) +
      (Number(point.y.b.n) / Number(point.y.b.d)) * Math.sqrt(point.y.d),
  );
  return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
}
