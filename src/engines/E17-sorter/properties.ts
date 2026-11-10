/**
 * E17 카드 성질의 정확 계산. 모두 `core/math/geometry`의 y 배율 도우미를 쓴다.
 *
 * - 삼각형: 변 종류, 각 종류, 같은 변·같은 각 묶음, 가장 큰 각.
 * - 사각형: 평행한 변 쌍, 같은 변, 직각, 가장 좁은 이름.
 */
import { angleKindScaled, compareAngles, dist2Scaled, parallel } from '../../core/math';
import type { GPoint } from '../../core/math';
import { Rational } from '../../core/math';
import { gp } from '../../core/math';
import type { DeckCard } from './deck';
import { hierarchyPoints } from './layout';
import type {
  AngleCondition,
  CellKey,
  ConstraintToggle,
  QuadName,
  QuadNode,
  QuestionId,
  SideCondition,
} from './types';

export type SideKind = 'equilateral' | 'isosceles-only' | 'scalene';

export interface TriangleProps {
  readonly sides: SideKind;
  readonly angles: 'acute' | 'right' | 'obtuse';
  readonly equalSideGroups: readonly (readonly number[])[];
  readonly equalAngleGroups: readonly (readonly number[])[];
  /** 가장 큰 각의 꼭짓점 번호(같으면 앞 번호). */
  readonly largestAngle: number;
}

export interface QuadProps {
  readonly parallelPairs: 0 | 1 | 2;
  readonly parallelSidePairs: readonly (readonly [number, number])[];
  readonly allSidesEqual: boolean;
  readonly oppositeSidesEqual: boolean;
  readonly rightAngles: readonly number[];
  readonly allAnglesRight: boolean;
  readonly equalSideGroups: readonly (readonly number[])[];
}

export function cardPoints(card: DeckCard): GPoint[] {
  return card.points.map(([x, y]) => gp(x, y));
}

export function cardScale(card: DeckCard): Rational {
  return Rational.of(card.yScale2);
}

function sideLengths(points: readonly GPoint[], yScale2: Rational): Rational[] {
  const result: Rational[] = [];
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    if (!current || !next) continue;
    result.push(dist2Scaled(current, next, yScale2));
  }
  return result;
}

function groupEquals(values: readonly Rational[]): number[][] {
  const groups: number[][] = [];
  const used = new Set<number>();
  values.forEach((value, index) => {
    if (used.has(index)) return;
    const group = [index];
    used.add(index);
    for (let other = index + 1; other < values.length; other += 1) {
      const candidate = values[other];
      if (!candidate || used.has(other)) continue;
      if (candidate.equals(value)) {
        group.push(other);
        used.add(other);
      }
    }
    if (group.length > 1) groups.push(group);
  });
  return groups;
}

function angleAt(
  points: readonly GPoint[],
  vertex: number,
): {
  readonly previous: GPoint;
  readonly vertexPoint: GPoint;
  readonly next: GPoint;
} | null {
  const previous = points[(vertex - 1 + points.length) % points.length];
  const current = points[vertex];
  const next = points[(vertex + 1) % points.length];
  if (!previous || !current || !next) return null;
  return { previous, vertexPoint: current, next };
}

export function triangleProps(card: DeckCard): TriangleProps {
  const points = cardPoints(card);
  const scale = cardScale(card);
  const lengths = sideLengths(points, scale);
  const equalSideGroups = groupEquals(lengths);
  const allSame = equalSideGroups.some((group) => group.length === 3);
  const anySame = equalSideGroups.length > 0;
  const sides: SideKind = allSame ? 'equilateral' : anySame ? 'isosceles-only' : 'scalene';

  const kinds = points.map((_, index) => {
    const angle = angleAt(points, index);
    return angle ? angleKindScaled(angle.previous, angle.vertexPoint, angle.next, scale) : 'acute';
  });
  const angles = kinds.includes('obtuse') ? 'obtuse' : kinds.includes('right') ? 'right' : 'acute';

  const equalAngleGroups: number[][] = [];
  const used = new Set<number>();
  kinds.forEach((_, index) => {
    if (used.has(index)) return;
    const group = [index];
    used.add(index);
    for (let other = index + 1; other < kinds.length; other += 1) {
      if (used.has(other)) continue;
      const angle = angleAt(points, index);
      const otherAngle = angleAt(points, other);
      if (!angle || !otherAngle) continue;
      const order = compareAngles(
        angle.previous,
        angle.vertexPoint,
        angle.next,
        otherAngle.previous,
        otherAngle.vertexPoint,
        otherAngle.next,
        scale,
      );
      if (order === 0) {
        group.push(other);
        used.add(other);
      }
    }
    if (group.length > 1) equalAngleGroups.push(group);
  });

  let largestAngle = 0;
  for (let index = 1; index < points.length; index += 1) {
    const current = angleAt(points, largestAngle);
    const candidate = angleAt(points, index);
    if (!current || !candidate) continue;
    const order = compareAngles(
      candidate.previous,
      candidate.vertexPoint,
      candidate.next,
      current.previous,
      current.vertexPoint,
      current.next,
      scale,
    );
    if (order > 0) largestAngle = index;
  }

  return { sides, angles, equalSideGroups, equalAngleGroups, largestAngle };
}

export function quadPropsFromPoints(points: readonly GPoint[], yScale2: Rational): QuadProps {
  const lengths = sideLengths(points, yScale2);
  const equalSideGroups = groupEquals(lengths);
  const allSidesEqual = equalSideGroups.some((group) => group.length === points.length);
  const first = lengths[0];
  const second = lengths[1];
  const third = lengths[2];
  const fourth = lengths[3];
  const oppositeSidesEqual =
    first !== undefined &&
    third !== undefined &&
    first.equals(third) &&
    second !== undefined &&
    fourth !== undefined &&
    second.equals(fourth);

  const parallelSidePairs: [number, number][] = [];
  for (let index = 0; index < points.length; index += 1) {
    const other = index + 2;
    if (other >= points.length) continue;
    const a = points[index];
    const b = points[(index + 1) % points.length];
    const c = points[other];
    const d = points[(other + 1) % points.length];
    if (a && b && c && d && parallel(a, b, c, d)) parallelSidePairs.push([index, other]);
  }

  const rightAngles: number[] = [];
  points.forEach((_, index) => {
    const angle = angleAt(points, index);
    if (!angle) return;
    if (angleKindScaled(angle.previous, angle.vertexPoint, angle.next, yScale2) === 'right') {
      rightAngles.push(index);
    }
  });

  return {
    parallelPairs: parallelSidePairs.length === 2 ? 2 : parallelSidePairs.length === 1 ? 1 : 0,
    parallelSidePairs,
    allSidesEqual,
    oppositeSidesEqual,
    rightAngles,
    allAnglesRight: rightAngles.length === points.length,
    equalSideGroups,
  };
}

export function quadProps(card: DeckCard): QuadProps {
  return quadPropsFromPoints(cardPoints(card), cardScale(card));
}

export function quadNames(props: QuadProps, definition: 'inclusive' | 'exclusive'): QuadName[] {
  const names: QuadName[] = ['quadrilateral'];
  const hasTrapezoid =
    definition === 'inclusive' ? props.parallelPairs >= 1 : props.parallelPairs === 1;
  if (hasTrapezoid) names.push('trapezoid');
  if (props.parallelPairs === 2) names.push('parallelogram');
  if (props.allSidesEqual) names.push('rhombus');
  if (props.allAnglesRight) names.push('rectangle');
  if (props.allSidesEqual && props.allAnglesRight) names.push('square');
  return names;
}

export function quadNode(props: QuadProps, definition: 'inclusive' | 'exclusive'): QuadName {
  const names = quadNames(props, definition);
  return names[names.length - 1] ?? 'quadrilateral';
}

export function sideMatches(sides: SideKind, condition: SideCondition): boolean {
  switch (condition) {
    case 'equilateral':
      return sides === 'equilateral';
    case 'isosceles':
      return sides !== 'scalene';
    case 'isosceles-only':
      return sides === 'isosceles-only';
    case 'scalene':
      return sides === 'scalene';
    default:
      return false;
  }
}

export function angleMatches(angles: TriangleProps['angles'], condition: AngleCondition): boolean {
  return angles === condition;
}

export function parseCell(cell: CellKey): { readonly row: string; readonly col: string } | null {
  const [row, col] = cell.split('|');
  if (row === undefined || col === undefined || row.length === 0 || col.length === 0) return null;
  return { row, col };
}

export function cellKey(row: string, col: string): CellKey {
  return `${row}|${col}`;
}

/** 카드가 칸 조건과 맞는지. venn 화면·Observation이 함께 쓴다. */
export function fitsCell(
  card: DeckCard,
  cell: CellKey,
  rows: readonly AngleCondition[],
  cols: readonly SideCondition[],
): boolean {
  const parsed = parseCell(cell);
  if (!parsed) return false;
  if (!rows.includes(parsed.row as AngleCondition)) return false;
  if (!cols.includes(parsed.col as SideCondition)) return false;
  const props = triangleProps(card);
  return (
    angleMatches(props.angles, parsed.row as AngleCondition) &&
    sideMatches(props.sides, parsed.col as SideCondition)
  );
}

export function answerQuestion(question: QuestionId, props: QuadProps): boolean {
  switch (question) {
    case 'parallel-pairs>=1':
      return props.parallelPairs >= 1;
    case 'parallel-pairs==2':
      return props.parallelPairs === 2;
    case 'all-sides-equal':
      return props.allSidesEqual;
    case 'has-right-angle':
      return props.rightAngles.length > 0;
    case 'all-angles-right':
      return props.allAnglesRight;
    case 'opposite-sides-equal':
      return props.oppositeSidesEqual;
    default:
      return false;
  }
}

/** 질문 순서대로의 참·거짓 열. 같은 서명은 그 질문들로 구별할 수 없다. */
export function signature(card: DeckCard, bank: readonly QuestionId[]): boolean[] {
  const props = quadProps(card);
  return bank.map((question) => answerQuestion(question, props));
}

/** 토글에서 만든 사각형의 계산 결과. */
export function hierarchyProps(toggles: readonly ConstraintToggle[]): {
  readonly points: readonly GPoint[];
  readonly props: QuadProps;
  readonly node: QuadName;
} {
  const points = hierarchyPoints(toggles).map(([x, y]) => gp(x, y));
  const props = quadPropsFromPoints(points, Rational.of(1));
  return { points, props, node: quadNode(props, 'inclusive') };
}

/** 빈칸이 모두 맞는지. rhombus·rectangle 둘 다 빈칸이면 서로 바꿔도 맞다. */
export function blanksCorrect(
  blanks: Readonly<Partial<Record<QuadName, QuadName | null>>>,
  blankNodes: readonly QuadNode[],
): boolean {
  const filled = blankNodes.every((node) => blanks[node] !== null && blanks[node] !== undefined);
  if (!filled) return false;
  const rhombus = blanks.rhombus;
  const rectangle = blanks.rectangle;
  const swapAllowed =
    blankNodes.includes('rhombus') &&
    blankNodes.includes('rectangle') &&
    rhombus === 'rectangle' &&
    rectangle === 'rhombus';
  return blankNodes.every((node) => {
    if (node === 'rhombus' && swapAllowed) return true;
    if (node === 'rectangle' && swapAllowed) return true;
    return blanks[node] === node;
  });
}

/** 빈칸 중 채웠지만 틀린 노드(정렬). */
export function wrongBlankNodes(
  blanks: Readonly<Partial<Record<QuadName, QuadName | null>>>,
  blankNodes: readonly QuadNode[],
): QuadNode[] {
  if (blanksCorrect(blanks, blankNodes)) return [];
  const rhombus = blanks.rhombus;
  const rectangle = blanks.rectangle;
  const swapAllowed =
    blankNodes.includes('rhombus') &&
    blankNodes.includes('rectangle') &&
    rhombus === 'rectangle' &&
    rectangle === 'rhombus';
  const result: QuadNode[] = [];
  for (const node of blankNodes) {
    const value = blanks[node];
    if (value === null || value === undefined) continue;
    if (node === 'rhombus' && swapAllowed) continue;
    if (node === 'rectangle' && swapAllowed) continue;
    if (value !== node) result.push(node);
  }
  return result.sort();
}
