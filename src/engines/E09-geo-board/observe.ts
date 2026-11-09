/**
 * E09의 관찰 결과. 판정·힌트는 이 값만 본다.
 *
 * - geoboard: 도형마다 닫힘·단순성·꼭짓점·변·못 수·넓이(Rational 문자열).
 * - construct: 객체(이름/좌표), 과녁 맞힘, 삼각자를 댄 각, 표시한 각, 실제 직각.
 *
 * `rightAngles`는 Observation에만 있고 화면 문구에는 쓰지 않는다(정답 노출 금지).
 */
import type { Observation } from '../../core/engine-sdk';
import {
  congruentPolygons,
  gp,
  isRightAngle,
  isSimplePolygon,
  pointOnLine,
  pointOnRay,
  pointOnSegment,
  polygonArea,
  simplifyPolygon,
} from '../../core/math';
import type { GPoint } from '../../core/math';
import type {
  ConstructState,
  GeoAngle,
  GeoBand,
  GeoNamedPoint,
  GeoObject,
  GeoObjectKind,
  GeoObjectObservation,
  GeoObjectPointObservation,
  GeoShapeObservation,
  GeoState,
  GeoboardState,
  Peg,
} from './types';

function gpoint(peg: Peg): GPoint {
  return gp(peg[0], peg[1]);
}

function polygonPoints(pegs: readonly Peg[]): GPoint[] {
  return pegs.map(gpoint);
}

export function shapeObservation(band: GeoBand): GeoShapeObservation {
  const points = polygonPoints(band.pegs);
  const simplified = band.closed ? simplifyPolygon(points) : [];
  const simple = band.closed && isSimplePolygon(points);
  return {
    id: band.id,
    closed: band.closed,
    simple,
    vertices: band.closed ? simplified.length : 0,
    sides: band.closed ? simplified.length : 0,
    pegCount: band.pegs.length,
    area: band.closed ? polygonArea(points).toString() : '0',
  };
}

function distinctOf(
  shapes: readonly GeoShapeObservation[],
  bands: readonly GeoBand[],
): Record<string, number> {
  const groups = new Map<string, GPoint[][]>();
  for (const shape of shapes) {
    if (!shape.simple) continue;
    const band = bands.find((candidate) => candidate.id === shape.id);
    if (!band) continue;
    const key = String(shape.vertices);
    const bucket = groups.get(key) ?? [];
    const points = polygonPoints(band.pegs);
    if (!bucket.some((existing) => congruentPolygons(existing, points))) bucket.push(points);
    groups.set(key, bucket);
  }
  const result: Record<string, number> = {};
  for (const [key, value] of groups) result[key] = value.length;
  return result;
}

function observeGeoboard(state: GeoboardState): Observation {
  const shapes = state.bands.map(shapeObservation);
  return {
    mode: state.mode,
    shapes: shapes.map((shape) => ({ ...shape })),
    closedShapes: shapes.filter((shape) => shape.closed && shape.simple).length,
    distinctBy: distinctOf(shapes, state.bands),
  };
}

function labelOf(point: Peg, named: readonly GeoNamedPoint[]): string {
  const found = named.find((entry) => entry.at[0] === point[0] && entry.at[1] === point[1]);
  return found ? found.label : `${point[0]},${point[1]}`;
}

export function objectHitsTarget(object: GeoObject, target: Peg): boolean {
  const p = gpoint(target);
  const from = gpoint(object.from);
  const to = gpoint(object.to);
  if (object.kind === 'segment') return pointOnSegment(p, from, to);
  if (object.kind === 'ray') return pointOnRay(p, from, to);
  return pointOnLine(p, from, to);
}

function hitNumbers(object: GeoObject, targets: readonly Peg[]): number[] {
  const result: number[] = [];
  targets.forEach((target, index) => {
    if (objectHitsTarget(object, target)) result.push(index + 1);
  });
  return result;
}

function longestHit(objects: readonly GeoObject[], targets: readonly Peg[]): number[] {
  let best: number[] = [];
  for (const object of objects) {
    const hits = hitNumbers(object, targets);
    if (hits.length > best.length) best = hits;
  }
  return best;
}

function allHits(objects: readonly GeoObject[], targets: readonly Peg[]): number[] {
  const found = new Set<number>();
  for (const object of objects) {
    for (const hit of hitNumbers(object, targets)) found.add(hit);
  }
  return [...found].sort((a, b) => a - b);
}

function observeConstruct(state: ConstructState): Observation {
  const { settings } = state;
  const objects: GeoObjectObservation[] = state.objects.map((object) => ({
    kind: object.kind,
    from: labelOf(object.from, settings.points),
    to: labelOf(object.to, settings.points),
  }));
  const objectPoints: GeoObjectPointObservation[] = state.objects.map((object) => ({
    kind: object.kind,
    from: object.from,
    to: object.to,
  }));
  const rightAngles = settings.angles
    .filter((angle: GeoAngle) =>
      isRightAngle(gpoint(angle.a), gpoint(angle.vertex), gpoint(angle.b)),
    )
    .map((angle) => angle.id);

  return {
    mode: state.mode,
    objects: objects.map((object) => ({ ...object })),
    objectPoints: objectPoints.map((object) => ({
      kind: object.kind,
      from: [object.from[0], object.from[1]],
      to: [object.to[0], object.to[1]],
    })),
    targetPoints: settings.targets.map((target) => [target[0], target[1]]),
    targetsHit: longestHit(state.objects, settings.targets),
    allTargetsHit: allHits(state.objects, settings.targets),
    squareOn: state.squareOn,
    marked: [...state.marked].sort(),
    rightAngles,
  };
}

export function observe(state: GeoState): Observation {
  if (state.mode === 'geoboard') return observeGeoboard(state);
  return observeConstruct(state);
}

/** 판정 함수가 Observation의 객체 종류를 읽을 때 쓴다. */
export function kindOf(value: unknown): GeoObjectKind | null {
  return value === 'segment' || value === 'ray' || value === 'line' ? value : null;
}
