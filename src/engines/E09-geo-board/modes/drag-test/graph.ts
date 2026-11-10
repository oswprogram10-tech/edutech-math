/**
 * drag-test의 작은 의존 그래프(T101).
 *
 * 노드를 만든 순서대로 평가해 점·선분·원·수선/평행선의 정확한 좌표를 낸다.
 * 상태에는 정수·인덱스만 있고, 좌표는 매번 여기서 `Rational`·`Surd`로 다시 계산한다.
 *
 * 계급 0은 유리수 점(free, on-circle, 선×선 교점), 계급 1은 원×원 교점이다.
 * 원·수선/평행선·on-circle·교점의 입력 정의점은 계급 0만 받는다.
 */
import {
  circleCircleIntersections,
  lineLineIntersection,
  Rational,
  sDist2,
  sSub,
  toSPoint,
} from '../../../../core/math';
import type { GPoint, SPoint, Surd } from '../../../../core/math';
import { gp } from '../../../../core/math';
import { circlePoint } from '../../rational-turns';
import type { DragNode, DragPointNode, SegmentNode } from './types';

export interface GraphSegment {
  readonly shape: 'segment';
  readonly a: SPoint;
  readonly b: SPoint;
}

export interface GraphCircle {
  readonly shape: 'circle';
  readonly center: SPoint;
  /** 반지름의 제곱. 정의점이 계급 0이라 유리수다. */
  readonly radiusSq: Rational;
  /** `to − from`. 원 위의 점을 정확히 올리려면 벡터가 필요하다. */
  readonly radiusVector: SPoint;
}

export interface GraphLine {
  readonly shape: 'line';
  readonly p: SPoint;
  readonly q: SPoint;
}

export type GraphShape = GraphSegment | GraphCircle | GraphLine;
export type GraphValue = SPoint | GraphShape;

/** 점 노드인지. */
export function isPointNode(node: DragNode): node is DragPointNode {
  return node.kind === 'free' || node.kind === 'on-circle' || node.kind === 'intersection';
}

function isSPoint(value: GraphValue | null | undefined): value is SPoint {
  return value !== null && value !== undefined && 'x' in value && 'y' in value;
}

function isShape(value: GraphValue | null | undefined): value is GraphShape {
  return value !== null && value !== undefined && 'shape' in value;
}

/** `b = 0`인 무리수를 유리수로. 아니면 null. */
export function rationalOfSurd(value: Surd): Rational | null {
  return value.b.isZero() ? value.a : null;
}

export function gpointOfSPoint(value: SPoint): GPoint | null {
  const x = rationalOfSurd(value.x);
  const y = rationalOfSurd(value.y);
  if (!x || !y) return null;
  return { x, y };
}

function add(a: SPoint, b: SPoint): SPoint | null {
  const first = gpointOfSPoint(a);
  const second = gpointOfSPoint(b);
  if (!first || !second) return null;
  return toSPoint({ x: first.x.add(second.x), y: first.y.add(second.y) });
}

function freePosition(node: DragNode & { readonly kind: 'free' }): SPoint {
  if (node.exact) {
    const x = Rational.parse(node.exact[0]);
    const y = Rational.parse(node.exact[1]);
    return toSPoint({ x, y });
  }
  return toSPoint(gp(node.at[0], node.at[1]));
}

function nodeById(nodes: readonly DragNode[], id: string): DragNode | null {
  return nodes.find((node) => node.id === id) ?? null;
}

/** 점 노드의 계급. 원×원 교점만 1이다. */
export function rankOf(nodes: readonly DragNode[], id: string): 0 | 1 {
  const node = nodeById(nodes, id);
  if (!node || !isPointNode(node)) return 0;
  if (node.kind !== 'intersection') return 0;
  const first = nodeById(nodes, node.of[0]);
  const second = nodeById(nodes, node.of[1]);
  if (first?.kind === 'circle' && second?.kind === 'circle') return 1;
  return 0;
}

/** 점 노드가 가리키는 정의점 id(자기 자신 제외). */
function dependenciesOf(node: DragNode): string[] {
  switch (node.kind) {
    case 'on-circle':
      return [node.circle];
    case 'intersection':
      return [node.of[0], node.of[1]];
    case 'segment':
      return [node.a, node.b];
    case 'circle':
      return [node.center, node.from, node.to];
    case 'perpendicular':
    case 'parallel':
      return [node.base, node.through];
    default:
      return [];
  }
}

/** `id`를 지우면 함께 지워야 하는 노드 id(의존하는 노드 전부). */
export function dependentsOf(nodes: readonly DragNode[], id: string): string[] {
  const removed = new Set<string>([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of nodes) {
      if (removed.has(node.id)) continue;
      if (dependenciesOf(node).some((dependency) => removed.has(dependency))) {
        removed.add(node.id);
        changed = true;
      }
    }
  }
  return [...removed];
}

/** 객체 하나를 정의하는 점 id 전부. */
export function definitionPoints(nodes: readonly DragNode[], id: string): string[] {
  const node = nodeById(nodes, id);
  if (!node) return [];
  switch (node.kind) {
    case 'segment':
      return [node.a, node.b];
    case 'circle':
      return [node.center, node.from, node.to];
    case 'perpendicular':
    case 'parallel': {
      const base = nodeById(nodes, node.base);
      if (base?.kind === 'segment') return [base.a, base.b, node.through];
      return [node.through];
    }
    case 'on-circle':
      return [node.circle];
    case 'intersection':
      return [...node.of];
    default:
      return [];
  }
}

/** 주어진 점 id가 모두 계급 0인지. */
export function allRankZero(nodes: readonly DragNode[], ids: readonly string[]): boolean {
  return ids.every((id) => rankOf(nodes, id) === 0);
}

function pointValue(value: GraphValue | null | undefined): SPoint | null {
  return isSPoint(value) ? value : null;
}

/** 모든 노드를 만든 순서대로 평가한다. 계산할 수 없으면 null. */
export function evaluate(nodes: readonly DragNode[]): Map<string, GraphValue | null> {
  const values = new Map<string, GraphValue | null>();
  for (const node of nodes) {
    values.set(node.id, evaluateNode(node, values));
  }
  return values;
}

function evaluateNode(node: DragNode, values: Map<string, GraphValue | null>): GraphValue | null {
  switch (node.kind) {
    case 'free':
      return freePosition(node);
    case 'on-circle': {
      const circle = values.get(node.circle);
      if (!circle || !isShape(circle) || circle.shape !== 'circle') return null;
      const center = gpointOfSPoint(circle.center);
      const vector = gpointOfSPoint(circle.radiusVector);
      if (!center || !vector) return null;
      // 중심에서 반지름 벡터를 `pos`만큼 정확히 회전한다. 회전이 유리수라 계급 0이다.
      return toSPoint(circlePoint(center, vector, node.pos));
    }
    case 'intersection': {
      const first = values.get(node.of[0]);
      const second = values.get(node.of[1]);
      if (!first || !second || !isShape(first) || !isShape(second)) return null;
      if (first.shape === 'circle' && second.shape === 'circle') {
        const c1 = gpointOfSPoint(first.center);
        const c2 = gpointOfSPoint(second.center);
        if (!c1 || !c2) return null;
        const points = circleCircleIntersections(c1, first.radiusSq, c2, second.radiusSq);
        return points[node.which] ?? null;
      }
      if (first.shape === 'line' && second.shape === 'line') {
        const p1 = gpointOfSPoint(first.p);
        const p2 = gpointOfSPoint(first.q);
        const q1 = gpointOfSPoint(second.p);
        const q2 = gpointOfSPoint(second.q);
        if (!p1 || !p2 || !q1 || !q2) return null;
        const point = lineLineIntersection(p1, p2, q1, q2);
        return point ? toSPoint(point) : null;
      }
      return null;
    }
    case 'segment': {
      const a = pointValue(values.get(node.a));
      const b = pointValue(values.get(node.b));
      if (!a || !b) return null;
      return { shape: 'segment', a, b } satisfies GraphSegment;
    }
    case 'circle': {
      const center = pointValue(values.get(node.center));
      const from = pointValue(values.get(node.from));
      const to = pointValue(values.get(node.to));
      if (!center || !from || !to) return null;
      const radius = sDist2(from, to);
      if (!radius) return null;
      const radiusSq = rationalOfSurd(radius);
      if (!radiusSq || radiusSq.isZero()) return null;
      const radiusVector = sSub(to, from);
      if (!radiusVector) return null;
      return { shape: 'circle', center, radiusSq, radiusVector } satisfies GraphCircle;
    }
    case 'perpendicular':
    case 'parallel': {
      const base = values.get(node.base);
      const through = pointValue(values.get(node.through));
      if (!base || !isShape(base) || base.shape !== 'segment' || !through) return null;
      const direction = sSub(base.b, base.a);
      if (!direction) return null;
      const used: SPoint =
        node.kind === 'perpendicular' ? { x: negate(direction.y), y: direction.x } : direction;
      const second = add(through, used);
      if (!second) return null;
      return { shape: 'line', p: through, q: second } satisfies GraphLine;
    }
    default:
      return null;
  }
}

function negate(value: Surd): Surd {
  return { a: value.a.neg(), b: value.b.neg(), d: value.d };
}

export function segmentValue(
  values: Map<string, GraphValue | null>,
  id: string,
): GraphSegment | null {
  const value = values.get(id);
  return value && isShape(value) && value.shape === 'segment' ? value : null;
}

export function circleValue(
  values: Map<string, GraphValue | null>,
  id: string,
): GraphCircle | null {
  const value = values.get(id);
  return value && isShape(value) && value.shape === 'circle' ? value : null;
}

export function lineValue(values: Map<string, GraphValue | null>, id: string): GraphLine | null {
  const value = values.get(id);
  return value && isShape(value) && value.shape === 'line' ? value : null;
}

/** 모든 점·객체가 존재하고 선분 길이·원 반지름이 0이 아닌지. */
export function graphValid(nodes: readonly DragNode[]): boolean {
  const values = evaluate(nodes);
  for (const node of nodes) {
    const value = values.get(node.id);
    if (!value) return false;
    if (node.kind === 'segment') {
      const segment = segmentValue(values, node.id);
      if (!segment) return false;
      const length = sDist2(segment.a, segment.b);
      if (!length || (length.a.isZero() && length.b.isZero())) return false;
    }
    if (node.kind === 'circle') {
      const circle = circleValue(values, node.id);
      if (!circle || circle.radiusSq.isZero()) return false;
    }
    if (node.kind === 'perpendicular' || node.kind === 'parallel') {
      const line = lineValue(values, node.id);
      if (!line) return false;
      const direction = sSub(line.q, line.p);
      if (
        !direction ||
        (direction.x.a.isZero() &&
          direction.x.b.isZero() &&
          direction.y.a.isZero() &&
          direction.y.b.isZero())
      ) {
        return false;
      }
    }
  }
  return true;
}

export interface GraphFigure {
  readonly kind: 'triangle' | 'quad';
  readonly ids: readonly string[];
  readonly labels: string;
  readonly points: readonly SPoint[];
}

function segmentBetween(nodes: readonly DragNode[], a: string, b: string): SegmentNode | null {
  for (const node of nodes) {
    if (node.kind !== 'segment') continue;
    if ((node.a === a && node.b === b) || (node.a === b && node.b === a)) return node;
  }
  return null;
}

function labelOrder(nodes: readonly DragNode[], ids: readonly string[]): string[] {
  const labelIndex = (id: string): number => {
    const node = nodeById(nodes, id);
    return node && isPointNode(node) ? node.label.charCodeAt(0) : 0;
  };
  return [...ids].sort((a, b) => labelIndex(a) - labelIndex(b));
}

function figureFromIds(
  nodes: readonly DragNode[],
  ids: readonly string[],
  kind: 'triangle' | 'quad',
): GraphFigure | null {
  const values = evaluate(nodes);
  const points: SPoint[] = [];
  for (const id of ids) {
    const point = pointValue(values.get(id));
    if (!point) return null;
    points.push(point);
  }
  const labels = ids
    .map((id) => {
      const node = nodeById(nodes, id);
      return node && isPointNode(node) ? node.label : '';
    })
    .join('');
  return { kind, ids, labels, points };
}

/** 마지막에 만든 선분을 포함하는 삼각형. 없으면 null. */
export function triangleFigure(nodes: readonly DragNode[]): GraphFigure | null {
  const points = nodes.filter(isPointNode).filter((node) => rankOf(nodes, node.id) <= 1);
  if (points.length < 3) return null;
  const lastSegment = [...nodes].reverse().find((node) => node.kind === 'segment') ?? null;
  const candidates: { ids: string[]; hasLast: boolean }[] = [];
  for (let first = 0; first < points.length; first += 1) {
    for (let second = first + 1; second < points.length; second += 1) {
      for (let third = second + 1; third < points.length; third += 1) {
        const a = points[first];
        const b = points[second];
        const c = points[third];
        if (!a || !b || !c) continue;
        const ab = segmentBetween(nodes, a.id, b.id);
        const bc = segmentBetween(nodes, b.id, c.id);
        const ca = segmentBetween(nodes, c.id, a.id);
        if (!ab || !bc || !ca) continue;
        const ids = labelOrder(nodes, [a.id, b.id, c.id]);
        candidates.push({
          ids,
          hasLast:
            lastSegment !== null && [ab, bc, ca].some((segment) => segment.id === lastSegment.id),
        });
      }
    }
  }
  const chosen = candidates.find((candidate) => candidate.hasLast) ?? candidates[0] ?? null;
  if (!chosen) return null;
  return figureFromIds(nodes, chosen.ids, 'triangle');
}

/** 도형. free 구성은 삼각형, 7번 구성은 자유점 4개가 이루는 사각형이다. */
export function figureOf(
  nodes: readonly DragNode[],
  construction: 'free' | 'from-diagonals' | 'quad-conditions',
): GraphFigure | null {
  if (construction !== 'free') {
    const quads = nodes.filter(
      (node): node is Extract<DragNode, { readonly kind: 'free' }> => node.kind === 'free',
    );
    if (quads.length < 4) return null;
    const ids = labelOrder(
      nodes,
      quads.slice(0, 4).map((node) => node.id),
    );
    return figureFromIds(nodes, ids, 'quad');
  }
  return triangleFigure(nodes);
}
