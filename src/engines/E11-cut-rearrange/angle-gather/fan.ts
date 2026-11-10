/**
 * 각 조각의 부채꼴(angle sector) 판정. 모두 정확한 유리수 벡터 계산이다.
 *
 * 각 조각의 두 반직선은 꼭짓점 V에서 이웃 P·N으로 가는 방향 s = P−V, e = N−V다.
 * 볼록 도형의 안쪽 각은 180°보다 작으므로 `cross(s, e) > 0`이 되게 순서를 맞춘다.
 * `turned`면 두 방향을 모두 부호 바꾼다(점대칭 180°).
 */
import { Rational, cross, dot, gp, simplifyPolygon, vsub } from '../../../core/math';
import type { GPoint } from '../../../core/math';
import { fromG, toG } from '../rpoint';
import type { RPoint } from '../rpoint';
import type { AngleGatherState, Corner, Peg } from './types';

export interface Sector {
  readonly s: GPoint;
  readonly e: GPoint;
}

const ZERO = Rational.of(0);
const QUARTER = Rational.of(4);

export function pegPoint(peg: Peg): GPoint {
  return gp(peg[0], peg[1]);
}

export function cornerTriangle(vertices: readonly Peg[], index: number): RPoint[] {
  const vertex = vertices[index];
  const previous = vertices[(index - 1 + vertices.length) % vertices.length];
  const next = vertices[(index + 1) % vertices.length];
  if (!vertex || !previous || !next) return [];
  const v = pegPoint(vertex);
  const p = pegPoint(previous);
  const n = pegPoint(next);
  const quarter = (point: GPoint): GPoint => ({
    x: v.x.add(point.x.sub(v.x).div(QUARTER)),
    y: v.y.add(point.y.sub(v.y).div(QUARTER)),
  });
  return [v, quarter(p), quarter(n)].map(fromG);
}

/** 각 꼭짓점의 부채꼴. 퇴화한 각이면 null. */
export function cornerSector(
  vertices: readonly Peg[],
  index: number,
  turned: boolean,
): Sector | null {
  const vertex = vertices[index];
  const previous = vertices[(index - 1 + vertices.length) % vertices.length];
  const next = vertices[(index + 1) % vertices.length];
  if (!vertex || !previous || !next) return null;
  const v = pegPoint(vertex);
  let s = vsub(pegPoint(previous), v);
  let e = vsub(pegPoint(next), v);
  const sign = cross(s, e);
  if (sign.isZero()) return null;
  if (sign.compareTo(ZERO) < 0) {
    const swap = s;
    s = e;
    e = swap;
  }
  if (turned) {
    s = { x: s.x.neg(), y: s.y.neg() };
    e = { x: e.x.neg(), y: e.y.neg() };
  }
  return { s, e };
}

export function cornerSectors(state: AngleGatherState): (Sector | null)[] {
  return state.corners.map((corner) => cornerSector(state.vertices, corner.index, corner.turned));
}

export function sameDirection(a: GPoint, b: GPoint): boolean {
  return cross(a, b).isZero() && dot(a, b).compareTo(ZERO) > 0;
}

export function oppositeDirection(a: GPoint, b: GPoint): boolean {
  return cross(a, b).isZero() && dot(a, b).compareTo(ZERO) < 0;
}

function strictlyInside(direction: GPoint, sector: Sector): boolean {
  return (
    cross(sector.s, direction).compareTo(ZERO) > 0 && cross(direction, sector.e).compareTo(ZERO) > 0
  );
}

/**
 * 두 부채꼴이 겹치는지. 한쪽 끝이 다른 쪽 안에 엄격히 들어가거나, 시작끼리 또는
 * 끝끼리 같은 방향이면 겹친다. 앞 조각의 e와 다음 조각의 s처럼 끝과 시작이
 * 만나는 것은 겹침이 아니다.
 */
export function sectorsOverlap(first: Sector, second: Sector): boolean {
  if (
    strictlyInside(first.s, second) ||
    strictlyInside(first.e, second) ||
    strictlyInside(second.s, first) ||
    strictlyInside(second.e, first)
  ) {
    return true;
  }
  return sameDirection(first.s, second.s) || sameDirection(first.e, second.e);
}

function extendChain(remaining: readonly Sector[], end: GPoint): Sector[] | null {
  if (remaining.length === 0) return [];
  for (let index = 0; index < remaining.length; index += 1) {
    const candidate = remaining[index];
    if (!candidate || !sameDirection(end, candidate.s)) continue;
    const rest = remaining.filter((_, position) => position !== index);
    const tail = extendChain(rest, candidate.e);
    if (tail) return [candidate, ...tail];
  }
  return null;
}

/** 앞 조각의 e = 다음 조각의 s로 이어지는 순서를 찾는다. */
export function findChain(sectors: readonly Sector[]): Sector[] | null {
  if (sectors.length === 0) return null;
  for (let index = 0; index < sectors.length; index += 1) {
    const first = sectors[index];
    if (!first) continue;
    const rest = sectors.filter((_, position) => position !== index);
    const tail = extendChain(rest, first.e);
    if (tail) return [first, ...tail];
  }
  return null;
}

export interface FanSummary {
  readonly state: 'none' | 'partial' | 'gap' | 'overlap' | 'straight' | 'full';
  readonly chain: readonly Sector[] | null;
}

export function fanSummary(state: AngleGatherState): FanSummary {
  const gathered = state.corners.filter((corner) => corner.gathered);
  if (gathered.length === 0) return { state: 'none', chain: null };
  const sectors: Sector[] = [];
  for (const corner of gathered) {
    const sector = cornerSector(state.vertices, corner.index, corner.turned);
    if (sector) sectors.push(sector);
  }
  if (sectors.length !== gathered.length) return { state: 'gap', chain: null };
  for (let first = 0; first < sectors.length; first += 1) {
    const a = sectors[first];
    if (!a) continue;
    for (let second = first + 1; second < sectors.length; second += 1) {
      const b = sectors[second];
      if (b && sectorsOverlap(a, b)) return { state: 'overlap', chain: null };
    }
  }
  const chain = findChain(sectors);
  if (!chain) return { state: 'gap', chain: null };
  if (gathered.length < state.vertices.length) return { state: 'partial', chain };
  const first = chain[0];
  const last = chain[chain.length - 1];
  if (!first || !last) return { state: 'gap', chain };
  if (oppositeDirection(first.s, last.e)) return { state: 'straight', chain };
  if (sameDirection(last.e, first.s)) return { state: 'full', chain };
  return { state: 'gap', chain };
}

export function fanState(state: AngleGatherState): FanSummary['state'] {
  return fanSummary(state).state;
}

export function fanTrialSum(state: AngleGatherState): 180 | 360 | null {
  const fan = fanState(state);
  if (fan === 'straight') return 180;
  if (fan === 'full') return 360;
  return null;
}

function isUsable(
  candidate: Sector,
  gathered: readonly Sector[],
): {
  readonly noOverlap: boolean;
  readonly chained: boolean;
} {
  const noOverlap = gathered.every((sector) => !sectorsOverlap(candidate, sector));
  if (!noOverlap) return { noOverlap: false, chained: false };
  return { noOverlap: true, chained: findChain([...gathered, candidate]) !== null };
}

/**
 * 이미 모은 조각과 겹치지 않으면서 반직선 하나를 나누는 turned 값을 고른다.
 * 지금 값이 되면 지금 값, 아니면 반대 값, 둘 다 안 되면 지금 값을 쓴다.
 */
export function bestTurn(state: AngleGatherState, index: number): boolean {
  const corner = state.corners.find((candidate) => candidate.index === index);
  if (!corner) return false;
  if (corner.gathered) return corner.turned;

  const gathered: Sector[] = [];
  for (const other of state.corners) {
    if (!other.gathered) continue;
    const sector = cornerSector(state.vertices, other.index, other.turned);
    if (sector) gathered.push(sector);
  }

  const currentSector = cornerSector(state.vertices, index, corner.turned);
  const oppositeSector = cornerSector(state.vertices, index, !corner.turned);
  const current = currentSector ? isUsable(currentSector, gathered) : null;
  const opposite = oppositeSector ? isUsable(oppositeSector, gathered) : null;

  if (current?.noOverlap && current.chained) return corner.turned;
  if (opposite?.noOverlap && opposite.chained) return !corner.turned;
  if (current?.noOverlap) return corner.turned;
  if (opposite?.noOverlap) return !corner.turned;
  return corner.turned;
}

/** 자른 뒤 남는 가운데 도형(각 조각을 뺀 다각형). 그리기용 정확한 점. */
export function remainingPolygon(vertices: readonly Peg[]): RPoint[] {
  const points: GPoint[] = [];
  for (let index = 0; index < vertices.length; index += 1) {
    const triangle = cornerTriangle(vertices, index);
    const previousCut = triangle[1];
    const nextCut = triangle[2];
    if (previousCut) points.push(toG(previousCut));
    if (nextCut) points.push(toG(nextCut));
  }
  return simplifyPolygon(points).map(fromG);
}

/** 각 조각의 색·무늬 번호(0~3)와 호 줄 수(1~4). 색만으로 구분하지 않는다. */
export function cornerStyle(corner: Corner): { readonly tone: number; readonly arcs: number } {
  return { tone: corner.index % 4, arcs: (corner.index % 4) + 1 };
}
