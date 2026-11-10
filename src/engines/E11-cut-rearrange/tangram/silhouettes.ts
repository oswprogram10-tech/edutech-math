/**
 * 실루엣은 그 세트 조각의 정답 배치 목록이다. 실루엣 다각형은 배치들의
 * 합집합이고, 채움 판정의 볼록 조각(part)도 이 배치들이다. 그래서 언제나 풀 수 있다.
 *
 * 이 파일의 배치는 학생 화면에 직접 쓰지 않는다(정답 노출 금지). 판정에만 쓴다.
 */
import { Rational } from '../../../core/math';
import { pieceDefinitions, setD } from './pieces';
import type { PieceSet } from './pieces';
import { sAdd, sOf } from './surd';
import type { SurdD } from './surd';
import type { SPoint } from './surd-geometry';
import { pieceVertices } from './pieces';

export interface SilhouettePlacement {
  readonly kind: string;
  readonly rot: number;
  readonly flip: boolean;
  readonly at: SPoint;
}

export interface SilhouetteDef {
  readonly id: string;
  readonly label: string;
  readonly placements: readonly SilhouettePlacement[];
}

export const SILHOUETTE_ORIGIN: SPoint = {
  x: sOf(Rational.of(2), Rational.of(0), 2),
  y: sOf(Rational.of(2), Rational.of(0), 2),
};

function num(value: number): Rational {
  if (Number.isInteger(value)) return Rational.of(value);
  const doubled = Math.round(value * 2);
  if (Math.abs(value * 2 - doubled) < 1e-9) return Rational.of(doubled, 2);
  throw new Error(`실루엣 좌표는 정수나 반칸만 씁니다: ${value}`);
}

function d2(a: number, b = 0) {
  return sOf(num(a), num(b), 2);
}

function d3(a: number, b = 0) {
  return sOf(num(a), num(b), 3);
}

function p2(xa: number, xb: number, ya: number, yb: number): SPoint {
  return { x: d2(xa, xb), y: d2(ya, yb) };
}

function p3(xa: number, xb: number, ya: number, yb: number): SPoint {
  return { x: d3(xa, xb), y: d3(ya, yb) };
}

const TANGRAM: readonly SilhouetteDef[] = [
  {
    id: 'square',
    label: '정사각형',
    placements: [
      { kind: 'small-triangle', rot: 4, flip: false, at: p2(2, 0, 1, 0) },
      { kind: 'small-triangle', rot: 0, flip: false, at: p2(0, 0, 1, 0) },
    ],
  },
  {
    id: 'house',
    label: '집',
    placements: [
      { kind: 'large-triangle', rot: 1, flip: false, at: p2(0, 0, 2, 0) },
      { kind: 'large-triangle', rot: 5, flip: true, at: p2(0, 0, 2, 0) },
      { kind: 'medium-triangle', rot: 1, flip: false, at: p2(0, 1, 2, -2) },
      { kind: 'small-triangle', rot: 1, flip: false, at: p2(0, 1, 2, -1) },
      { kind: 'small-triangle', rot: 7, flip: false, at: p2(0, -1, 2, 0) },
      { kind: 'square', rot: 1, flip: false, at: p2(0, 0.5, 2, -1.5) },
      { kind: 'parallelogram', rot: 1, flip: true, at: p2(0, 3, 2, 0) },
    ],
  },
  {
    id: 'cat',
    label: '고양이',
    placements: [
      { kind: 'large-triangle', rot: 1, flip: false, at: p2(0, 0, 2, 0) },
      { kind: 'large-triangle', rot: 5, flip: true, at: p2(0, 0, 2, 0) },
      { kind: 'square', rot: 0, flip: false, at: p2(-1, 1, 0, 0) },
      { kind: 'small-triangle', rot: 6, flip: false, at: p2(-1, 1, 1, 0) },
      { kind: 'small-triangle', rot: 2, flip: false, at: p2(1, 1, -1, 0) },
      { kind: 'medium-triangle', rot: 0, flip: false, at: p2(0, 0, 2, 2) },
      { kind: 'parallelogram', rot: 0, flip: false, at: p2(0, 2, 2, 2) },
    ],
  },
  {
    id: 'boat',
    label: '배',
    placements: [
      { kind: 'large-triangle', rot: 1, flip: false, at: p2(0, 0, 2, 0) },
      { kind: 'large-triangle', rot: 5, flip: true, at: p2(0, 0, 2, 0) },
      { kind: 'medium-triangle', rot: 6, flip: false, at: p2(0, 0, 2, 0) },
      { kind: 'small-triangle', rot: 6, flip: false, at: p2(1, 0, 1, 0) },
      { kind: 'small-triangle', rot: 4, flip: false, at: p2(4, 0, 2, 0) },
      { kind: 'square', rot: 6, flip: false, at: p2(1, 0, 2, 0) },
      { kind: 'parallelogram', rot: 6, flip: true, at: p2(0, 0, -2, 0) },
    ],
  },
];

const PATTERN: readonly SilhouetteDef[] = [
  {
    id: 'house',
    label: '집',
    placements: [
      { kind: 'square', rot: 0, flip: false, at: p3(0, 0, 0, 0) },
      { kind: 'square', rot: 0, flip: false, at: p3(1, 0, 0, 0) },
      { kind: 'trapezoid', rot: 0, flip: false, at: p3(0, 0, -1, 0) },
    ],
  },
  {
    id: 'boat',
    label: '배',
    placements: [
      { kind: 'trapezoid', rot: 4, flip: false, at: p3(2, 0, 2, 0) },
      { kind: 'triangle', rot: 0, flip: false, at: p3(0.5, 0, 2, 0.5) },
    ],
  },
];

export function silhouetteDefinitions(set: PieceSet): readonly SilhouetteDef[] {
  return set === 'tangram' ? TANGRAM : PATTERN;
}

export function silhouetteOf(set: PieceSet, id: string): SilhouetteDef | null {
  if (id === 'none') return null;
  const definitions = silhouetteDefinitions(set);
  return (
    definitions.find((definition) => definition.id === id) ??
    definitions.find((definition) => definition.id === 'house') ??
    null
  );
}

export function silhouetteIds(set: PieceSet): string[] {
  return silhouetteDefinitions(set).map((definition) => definition.id);
}

/** 실루엣 원점을 더한 판 위 배치. */
export function boardPlacement(placement: SilhouettePlacement, d: SurdD): SilhouettePlacement {
  const originX = d === 2 ? SILHOUETTE_ORIGIN.x : d3(2);
  const originY = d === 2 ? SILHOUETTE_ORIGIN.y : d3(2);
  return {
    ...placement,
    at: {
      x: sAdd(placement.at.x, originX),
      y: sAdd(placement.at.y, originY),
    },
  };
}

/** 실루엣 part의 화면 꼭짓점. 판정과 그리기에 함께 쓴다. */
export function silhouettePartPolygons(set: PieceSet, id: string): SPoint[][] {
  const definition = silhouetteOf(set, id);
  if (!definition) return [];
  const d = setD(set);
  return definition.placements.map((placement) => {
    const board = boardPlacement(placement, d);
    return pieceVertices(
      set,
      placement.kind,
      board.at,
      placement.rot,
      placement.flip,
      set === 'tangram' ? 45 : 30,
    );
  });
}

export function silhouettePieceCount(set: PieceSet, id: string): number {
  return silhouetteOf(set, id)?.placements.length ?? 0;
}

export function silhouetteKinds(set: PieceSet, id: string): string[] {
  const definition = silhouetteOf(set, id);
  if (!definition) return [];
  return definition.placements.map((placement) => placement.kind);
}

/** 조각 세트가 실루엣의 모든 part를 채울 수 있는지(설정 검증용). */
export function silhouetteUsesSetPieces(set: PieceSet, id: string): boolean {
  const supported = new Set<string>(pieceDefinitions(set).map((definition) => definition.kind));
  const definition = silhouetteOf(set, id);
  return (
    definition !== null && definition.placements.every((placement) => supported.has(placement.kind))
  );
}
