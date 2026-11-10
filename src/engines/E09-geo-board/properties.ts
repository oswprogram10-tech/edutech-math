/**
 * 도형의 성질·이름 계산(T101). classify와 drag-test가 같이 쓴다.
 *
 * - 모든 계산은 `core/math`의 `Rational`·`Surd`로 정확히 한다.
 * - 근호가 맞지 않아 계산할 수 없으면 `null`(성질 "알 수 없음")이다.
 * - 이름은 Observation·이벤트에만 쓰고 학생 화면 글자로는 쓰지 않는다.
 */
import {
  sCross,
  sDist2,
  sDot,
  sSignedCos2,
  sSub,
  surdAdd,
  surdEquals,
  surdSign,
  toSPoint,
} from '../../core/math';
import type { GPoint, SPoint, Surd } from '../../core/math';
import { Rational } from '../../core/math';

export type FigureAngleKind = 'acute' | 'right' | 'obtuse' | 'reflex';

export type FigureName =
  | 'triangle'
  | 'isosceles'
  | 'equilateral'
  | 'scalene'
  | 'acute-triangle'
  | 'right-triangle'
  | 'obtuse-triangle'
  | 'quadrilateral'
  | 'trapezoid'
  | 'parallelogram'
  | 'rhombus'
  | 'rectangle'
  | 'square'
  | 'regular-polygon';

export interface FigureProps {
  /** 단순화가 끝난 꼭짓점. */
  readonly vertices: readonly SPoint[];
  readonly rightAngles: number;
  readonly acuteAngles: number;
  readonly obtuseAngles: number;
  /** 오목 꼭짓점 수. Rational 다각형만 판단하고 삼각형은 항상 0이다. */
  readonly reflexAngles: number;
  /** 이웃하지 않은 변 쌍 중 방향이 같은(평행한) 쌍의 수. */
  readonly parallelPairs: number;
  /** 같은 길이인 변 묶음 중 가장 큰 묶음의 크기. 모두 다르면 1. */
  readonly equalSides: number;
  /** 같은 각 묶음의 최대 크기. */
  readonly equalAngles: number;
  readonly convex: boolean;
  readonly regular: boolean;
  /** 꼭짓점 순서대로의 내각 종류. classify·overlay가 표시에 쓴다. */
  readonly angles: readonly FigureAngleKind[];
  readonly names: readonly FigureName[];
}

function surdKey(value: Surd): string {
  return `${value.a.toString()}|${value.b.toString()}|${value.d.toString()}`;
}

function groupCount(values: readonly Surd[]): number {
  let largest = 0;
  const used: boolean[] = values.map(() => false);
  values.forEach((value, index) => {
    if (used[index]) return;
    let count = 1;
    used[index] = true;
    for (let other = index + 1; other < values.length; other += 1) {
      const candidate = values[other];
      if (!candidate || used[other]) continue;
      if (surdEquals(value, candidate)) {
        used[other] = true;
        count += 1;
      }
    }
    if (count > largest) largest = count;
  });
  return largest;
}

function asRational(value: Surd): Rational | null {
  return value.b.isZero() ? value.a : null;
}

function rationalPoint(point: SPoint): GPoint | null {
  const x = asRational(point.x);
  const y = asRational(point.y);
  if (!x || !y) return null;
  return { x, y };
}

function signedDoubleArea(points: readonly GPoint[]): Rational {
  let total = Rational.of(0);
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    if (!current || !next) continue;
    total = total.add(current.x.mul(next.y).sub(current.y.mul(next.x)));
  }
  return total;
}

function angleKindOf(value: Surd): FigureAngleKind {
  const sign = surdSign(value);
  if (sign === 0) return 'right';
  return sign > 0 ? 'acute' : 'obtuse';
}

/**
 * 단순화가 끝난 꼭짓점 목록의 성질. 계산할 수 없으면 `null`.
 * 호출자가 단순 다각형인지 먼저 확인한다(classify는 `isSimplePolygon`).
 */
export function figureProperties(points: readonly SPoint[]): FigureProps | null {
  const count = points.length;
  if (count < 3) return null;
  const sides: Surd[] = [];
  for (let index = 0; index < count; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % count];
    if (!current || !next) return null;
    const length = sDist2(current, next);
    if (!length || surdSign(length) === 0) return null;
    sides.push(length);
  }

  const angles: Surd[] = [];
  for (let index = 0; index < count; index += 1) {
    const previous = points[(index - 1 + count) % count];
    const current = points[index];
    const next = points[(index + 1) % count];
    if (!previous || !current || !next) return null;
    const value = sSignedCos2(previous, current, next);
    if (!value) return null;
    angles.push(value);
  }

  const rationals = points.map(rationalPoint);
  const allRational = rationals.every((point): point is GPoint => point !== null);
  let orientation: -1 | 0 | 1 = 0;
  if (allRational) {
    const area = signedDoubleArea(rationals);
    if (area.isZero()) return null;
    orientation = area.isNegative() ? -1 : 1;
  }

  let rightAngles = 0;
  let acuteAngles = 0;
  let obtuseAngles = 0;
  let reflexAngles = 0;
  const kinds: FigureAngleKind[] = [];
  for (let index = 0; index < count; index += 1) {
    const previous = points[(index - 1 + count) % count];
    const current = points[index];
    const next = points[(index + 1) % count];
    const angle = angles[index];
    if (!previous || !current || !next || !angle) return null;
    let reflex = false;
    if (allRational && orientation !== 0) {
      const turn = sCross(sSub(previous, current) ?? current, sSub(next, current) ?? current);
      if (turn && surdSign(turn) !== 0) {
        const sign = surdSign(turn);
        reflex = sign === orientation;
      }
    }
    if (reflex) {
      reflexAngles += 1;
      kinds.push('reflex');
      continue;
    }
    const kind = angleKindOf(angle);
    kinds.push(kind);
    if (kind === 'right') rightAngles += 1;
    else if (kind === 'acute') acuteAngles += 1;
    else obtuseAngles += 1;
  }

  const edges: SPoint[] = [];
  for (let index = 0; index < count; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % count];
    if (!current || !next) return null;
    const edge = sSub(next, current);
    if (!edge) return null;
    edges.push(edge);
  }
  let parallelPairs = 0;
  for (let first = 0; first < count; first += 1) {
    for (let second = first + 1; second < count; second += 1) {
      const adjacent = second === first + 1 || (first === 0 && second === count - 1);
      if (adjacent) continue;
      const u = edges[first];
      const v = edges[second];
      if (!u || !v) continue;
      const product = sCross(u, v);
      if (!product) return null;
      if (surdSign(product) === 0) parallelPairs += 1;
    }
  }

  const equalSides = groupCount(sides);
  const equalAngles = groupCount(angles);
  const convex = reflexAngles === 0;
  const regular = equalSides === count && equalAngles === count;

  const names: FigureName[] = [];
  if (count === 3) {
    names.push('triangle');
    if (equalSides >= 3) names.push('equilateral');
    if (equalSides >= 2) names.push('isosceles');
    if (equalSides === 1) names.push('scalene');
    if (rightAngles > 0) names.push('right-triangle');
    else if (obtuseAngles > 0) names.push('obtuse-triangle');
    else names.push('acute-triangle');
  } else if (count === 4) {
    names.push('quadrilateral');
    if (parallelPairs >= 1) names.push('trapezoid');
    if (parallelPairs >= 2) names.push('parallelogram');
    if (equalSides === 4) names.push('rhombus');
    if (rightAngles === 4) names.push('rectangle');
    if (equalSides === 4 && rightAngles === 4) names.push('square');
  }
  if (regular) names.push('regular-polygon');

  return {
    vertices: points,
    rightAngles,
    acuteAngles,
    obtuseAngles,
    reflexAngles,
    parallelPairs,
    equalSides,
    equalAngles,
    convex,
    regular,
    angles: kinds,
    names,
  };
}

function addPoint(a: SPoint, b: SPoint): SPoint | null {
  const x = surdAdd(a.x, b.x);
  const y = surdAdd(a.y, b.y);
  if (!x || !y) return null;
  return { x, y };
}

/** 사각형 대각선 성질 키. 대각선은 0-2, 1-3이다. */
function diagonalKeys(props: FigureProps): string[] {
  const points = props.vertices;
  if (points.length !== 4) return [];
  const first = points[0];
  const second = points[1];
  const third = points[2];
  const fourth = points[3];
  if (!first || !second || !third || !fourth) return [];
  const keys: string[] = [];

  const firstMid = addPoint(first, third);
  const secondMid = addPoint(second, fourth);
  if (
    firstMid &&
    secondMid &&
    surdEquals(firstMid.x, secondMid.x) &&
    surdEquals(firstMid.y, secondMid.y)
  ) {
    keys.push('diagonals-bisect');
  }

  const firstLength = sDist2(first, third);
  const secondLength = sDist2(second, fourth);
  if (firstLength && secondLength && surdEquals(firstLength, secondLength)) {
    keys.push('diagonals-equal');
  }

  const firstDirection = sSub(third, first);
  const secondDirection = sSub(fourth, second);
  if (firstDirection && secondDirection) {
    const product = sDot(firstDirection, secondDirection);
    if (product && surdSign(product) === 0) keys.push('diagonals-perpendicular');
  }
  return keys;
}

/** 흔들기 전후에 유지된 성질을 비교하는 키. */
export function propertyKeys(props: FigureProps): string[] {
  const keys: string[] = [];
  if (props.equalSides >= 2) keys.push('equal-sides-2');
  if (props.equalSides >= 3) keys.push('equal-sides-3');
  if (props.equalSides >= 4) keys.push('equal-sides-4');
  if (props.equalAngles >= 2) keys.push('equal-angles-2');
  if (props.equalAngles >= 3) keys.push('equal-angles-3');
  if (props.rightAngles >= 1) keys.push('right-angle');
  if (props.rightAngles === 4) keys.push('right-angles-4');
  if (props.obtuseAngles >= 1) keys.push('obtuse-angle');
  if (props.vertices.length > 0 && props.acuteAngles === props.vertices.length) {
    keys.push('all-acute');
  }
  if (props.parallelPairs >= 1) keys.push('parallel-1');
  if (props.parallelPairs >= 2) keys.push('parallel-2');
  if (oppositeSidesEqual(props)) keys.push('opposite-sides-equal');
  return [...keys, ...diagonalKeys(props)];
}

/** 사각형의 마주 보는 두 변이 각각 같은 길이인지. 이웃한 변이 같아도 참이 되지 않는다. */
function oppositeSidesEqual(props: FigureProps): boolean {
  const points = props.vertices;
  if (points.length !== 4) return false;
  const [a, b, c, d] = points;
  if (!a || !b || !c || !d) return false;
  const first = sDist2(a, b);
  const opposite = sDist2(c, d);
  const second = sDist2(b, c);
  const secondOpposite = sDist2(d, a);
  if (!first || !opposite || !second || !secondOpposite) return false;
  return surdEquals(first, opposite) && surdEquals(second, secondOpposite);
}

/** 합동 판정 대신 쓰는 정확한 서명. 꼭짓점 사이 거리²의 정렬된 목록이다. */
export function congruenceKey(points: readonly SPoint[]): string {
  const distances: string[] = [];
  for (let first = 0; first < points.length; first += 1) {
    for (let second = first + 1; second < points.length; second += 1) {
      const a = points[first];
      const b = points[second];
      if (!a || !b) continue;
      const value = sDist2(a, b);
      if (value) distances.push(surdKey(value));
    }
  }
  distances.sort();
  return `${points.length}:${distances.join(',')}`;
}

/** 정수 격자 다각형의 성질. classify·E2E가 쓴다. */
export function propertiesOfGPolygon(points: readonly GPoint[]): FigureProps | null {
  return figureProperties(points.map(toSPoint));
}
