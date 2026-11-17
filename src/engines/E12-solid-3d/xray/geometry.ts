/**
 * E12 `xray` 모드 기하·투영·가시성·겨냥도 사투상·채점(순수 함수, DOM 없음).
 *
 * - 상자는 `[0, w] × [0, d] × [0, h]`: x 오른쪽, y 뒤쪽, z 위쪽.
 * - 돌려 보기 투영은 도 단위 정수 `{ yaw, pitch }`를 15° 단위로 정규화해 정사영한다.
 * - 보이는 면·숨은 모서리·겨냥도 채점은 회전 부동소수 대신 벡터 부호/정수 좌표로만 판정한다.
 */
import { clamp } from '../../../core/engine-sdk';
import type { Vec3 } from '../net/geometry';

export type XrayFaceId = 'front' | 'back' | 'left' | 'right' | 'bottom' | 'top';

export type XrayVertexId = 'v000' | 'v001' | 'v010' | 'v011' | 'v100' | 'v101' | 'v110' | 'v111';

export type XrayEdgeId =
  'x00' | 'x01' | 'x10' | 'x11' | 'y00' | 'y01' | 'y10' | 'y11' | 'z00' | 'z01' | 'z10' | 'z11';

export interface XrayViewAngle {
  readonly yaw: number;
  readonly pitch: number;
}

export type SketchDot = readonly [number, number];

export type SketchLineStyle = 'solid' | 'dashed';

export interface SketchSegment {
  readonly a: SketchDot;
  readonly b: SketchDot;
  readonly style: SketchLineStyle;
  readonly locked: boolean;
}

export interface SketchSegmentInput {
  readonly a: SketchDot;
  readonly b: SketchDot;
  readonly style: SketchLineStyle;
  readonly locked?: boolean;
}

export interface SketchGrade {
  readonly visibleMissing: number;
  readonly hiddenMissing: number;
  readonly hiddenSolid: number;
  readonly visibleDashed: number;
  readonly extra: number;
  readonly complete: boolean;
}

export const XRAY_FACE_IDS: readonly XrayFaceId[] = [
  'front',
  'back',
  'left',
  'right',
  'bottom',
  'top',
] as const;

export const XRAY_VERTEX_IDS: readonly XrayVertexId[] = [
  'v000',
  'v001',
  'v010',
  'v011',
  'v100',
  'v101',
  'v110',
  'v111',
] as const;

export const XRAY_EDGE_IDS: readonly XrayEdgeId[] = [
  'x00',
  'x01',
  'x10',
  'x11',
  'y00',
  'y01',
  'y10',
  'y11',
  'z00',
  'z01',
  'z10',
  'z11',
] as const;

const FACE_NORMALS: Readonly<Record<XrayFaceId, Vec3>> = {
  front: [0, -1, 0],
  back: [0, 1, 0],
  left: [-1, 0, 0],
  right: [1, 0, 0],
  bottom: [0, 0, -1],
  top: [0, 0, 1],
};

const OPPOSITE_FACES: Readonly<Record<XrayFaceId, XrayFaceId>> = {
  front: 'back',
  back: 'front',
  left: 'right',
  right: 'left',
  bottom: 'top',
  top: 'bottom',
};

const SKETCH_VISIBLE_FACES: readonly XrayFaceId[] = ['front', 'right', 'top'];
const SKETCH_HIDDEN_EDGES: readonly XrayEdgeId[] = ['x10', 'y00', 'z01'];

export function isXrayFaceId(value: unknown): value is XrayFaceId {
  return typeof value === 'string' && (XRAY_FACE_IDS as readonly string[]).includes(value);
}

export function isXrayEdgeId(value: unknown): value is XrayEdgeId {
  return typeof value === 'string' && (XRAY_EDGE_IDS as readonly string[]).includes(value);
}

export function isXrayVertexId(value: unknown): value is XrayVertexId {
  return typeof value === 'string' && (XRAY_VERTEX_IDS as readonly string[]).includes(value);
}

export function faceNormal(id: XrayFaceId): Vec3 {
  return FACE_NORMALS[id];
}

export function oppositeFace(id: XrayFaceId): XrayFaceId {
  return OPPOSITE_FACES[id];
}

export function perpendicularFaces(id: XrayFaceId): readonly XrayFaceId[] {
  const opp = OPPOSITE_FACES[id];
  return XRAY_FACE_IDS.filter((f) => f !== id && f !== opp);
}

export function faceCorners(
  id: XrayFaceId,
  w: number,
  d: number,
  h: number,
): readonly [Vec3, Vec3, Vec3, Vec3] {
  switch (id) {
    case 'front':
      return [
        [0, 0, 0],
        [w, 0, 0],
        [w, 0, h],
        [0, 0, h],
      ];
    case 'back':
      return [
        [w, d, 0],
        [0, d, 0],
        [0, d, h],
        [w, d, h],
      ];
    case 'left':
      return [
        [0, d, 0],
        [0, 0, 0],
        [0, 0, h],
        [0, d, h],
      ];
    case 'right':
      return [
        [w, 0, 0],
        [w, d, 0],
        [w, d, h],
        [w, 0, h],
      ];
    case 'bottom':
      return [
        [0, d, 0],
        [w, d, 0],
        [w, 0, 0],
        [0, 0, 0],
      ];
    case 'top':
      return [
        [0, 0, h],
        [w, 0, h],
        [w, d, h],
        [0, d, h],
      ];
  }
}

export function faceCenter(id: XrayFaceId, w: number, d: number, h: number): Vec3 {
  switch (id) {
    case 'front':
      return [w / 2, 0, h / 2];
    case 'back':
      return [w / 2, d, h / 2];
    case 'left':
      return [0, d / 2, h / 2];
    case 'right':
      return [w, d / 2, h / 2];
    case 'bottom':
      return [w / 2, d / 2, 0];
    case 'top':
      return [w / 2, d / 2, h];
  }
}

export function vertexPoint(id: XrayVertexId, w: number, d: number, h: number): Vec3 {
  const i = id[1] === '1' ? 1 : 0;
  const j = id[2] === '1' ? 1 : 0;
  const k = id[3] === '1' ? 1 : 0;
  return [i * w, j * d, k * h];
}

export function vertexFaces(id: XrayVertexId): readonly [XrayFaceId, XrayFaceId, XrayFaceId] {
  const i = id[1] === '1';
  const j = id[2] === '1';
  const k = id[3] === '1';
  return [i ? 'right' : 'left', j ? 'back' : 'front', k ? 'top' : 'bottom'];
}

export function edgeFaces(id: XrayEdgeId): readonly [XrayFaceId, XrayFaceId] {
  const axis = id[0];
  const a = id[1] === '1';
  const b = id[2] === '1';
  if (axis === 'x') {
    return [a ? 'back' : 'front', b ? 'top' : 'bottom'];
  }
  if (axis === 'y') {
    return [a ? 'right' : 'left', b ? 'top' : 'bottom'];
  }
  return [a ? 'right' : 'left', b ? 'back' : 'front'];
}

export function edgeEndpoints(
  id: XrayEdgeId,
  w: number,
  d: number,
  h: number,
): readonly [Vec3, Vec3] {
  const axis = id[0];
  const a = id[1] === '1' ? 1 : 0;
  const b = id[2] === '1' ? 1 : 0;
  if (axis === 'x') {
    return [
      [0, a * d, b * h],
      [w, a * d, b * h],
    ];
  }
  if (axis === 'y') {
    return [
      [a * w, 0, b * h],
      [a * w, d, b * h],
    ];
  }
  return [
    [a * w, b * d, 0],
    [a * w, b * d, h],
  ];
}

/** 시점을 `{ yaw: 15의 배수(-165..180), pitch: 15의 배수(-75..75) }`로 정규화한다. */
export function normalizeView(view: XrayViewAngle): XrayViewAngle {
  const rawYaw = Number.isFinite(view.yaw) ? view.yaw : 30;
  const rawPitch = Number.isFinite(view.pitch) ? view.pitch : 30;
  let yaw = Math.round(rawYaw / 15) * 15;
  yaw = ((yaw % 360) + 360) % 360;
  if (yaw > 180) yaw -= 360;
  if (yaw === 0) yaw = 0;

  let pitch = clamp(Math.round(rawPitch / 15) * 15, -75, 75);
  if (pitch === 0) pitch = 0;
  return { yaw, pitch };
}

export interface ViewBasis {
  readonly eye: Vec3;
  readonly right: Vec3;
  readonly up: Vec3;
}

export function viewBasis(view: XrayViewAngle): ViewBasis {
  const phi = (view.yaw * Math.PI) / 180;
  const theta = (view.pitch * Math.PI) / 180;
  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  const sinTheta = Math.sin(theta);
  const cosTheta = Math.cos(theta);
  return {
    eye: [sinPhi * cosTheta, -cosPhi * cosTheta, sinTheta],
    right: [cosPhi, sinPhi, 0],
    up: [-sinPhi * sinTheta, cosPhi * sinTheta, cosTheta],
  };
}

function dot3(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export interface ProjectedXrayPoint {
  readonly x: number;
  readonly y: number;
  readonly depth: number;
}

export function xrayScaleForStage(
  w: number,
  d: number,
  h: number,
  stageW: number,
  stageH: number,
): number {
  const diag = Math.max(1, Math.hypot(w, d, h));
  return (Math.min(stageW, stageH) * 0.84) / diag;
}

export function projectXrayPoint(
  p: Vec3,
  w: number,
  d: number,
  h: number,
  basis: ViewBasis,
  scale: number,
  stageW: number,
  stageH: number,
): ProjectedXrayPoint {
  const rel: Vec3 = [p[0] - w / 2, p[1] - d / 2, p[2] - h / 2];
  const sx = dot3(rel, basis.right);
  const sy = -dot3(rel, basis.up);
  return {
    x: stageW / 2 + sx * scale,
    y: stageH / 2 + sy * scale,
    depth: dot3(rel, basis.eye),
  };
}

/** 현재 시점에서 보이는 면 목록(고정 순서). */
export function visibleFaces(view: XrayViewAngle): readonly XrayFaceId[] {
  const { eye } = viewBasis(view);
  return XRAY_FACE_IDS.filter((id) => dot3(FACE_NORMALS[id], eye) > 1e-9);
}

/** 현재 시점에서 숨은 모서리 목록(붙은 두 면이 모두 보이지 않음, 고정 순서). */
export function hiddenEdges(view: XrayViewAngle): readonly XrayEdgeId[] {
  const vis = new Set(visibleFaces(view));
  return XRAY_EDGE_IDS.filter((id) => {
    const [f1, f2] = edgeFaces(id);
    return !vis.has(f1) && !vis.has(f2);
  });
}

/** 현재 시점에서 숨은 꼭짓점 목록(붙은 세 면이 모두 보이지 않음, 고정 순서). */
export function hiddenVertices(view: XrayViewAngle): readonly XrayVertexId[] {
  const vis = new Set(visibleFaces(view));
  return XRAY_VERTEX_IDS.filter((id) => {
    const [f1, f2, f3] = vertexFaces(id);
    return !vis.has(f1) && !vis.has(f2) && !vis.has(f3);
  });
}

/** 사투상 겨냥도 정수 격자 좌표 `(X, Y) = (2x + y, 2z + y)`. */
export function sketchProject(p: Vec3): SketchDot {
  return [2 * p[0] + p[1], 2 * p[2] + p[1]];
}

export function sketchVisibleFaces(): readonly XrayFaceId[] {
  return SKETCH_VISIBLE_FACES;
}

export function sketchHiddenEdges(): readonly XrayEdgeId[] {
  return SKETCH_HIDDEN_EDGES;
}

export function sketchHiddenVertices(): readonly XrayVertexId[] {
  return ['v010'];
}

export function sketchGridBounds(
  w: number,
  d: number,
  h: number,
): {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
} {
  return {
    minX: -1,
    maxX: 2 * w + d + 1,
    minY: -1,
    maxY: 2 * h + d + 1,
  };
}

export function isDotInSketchBounds(dot: SketchDot, w: number, d: number, h: number): boolean {
  const [x, y] = dot;
  if (!Number.isInteger(x) || !Number.isInteger(y)) return false;
  const b = sketchGridBounds(w, d, h);
  return x >= b.minX && x <= b.maxX && y >= b.minY && y <= b.maxY;
}

export function compareSketchDots(a: SketchDot, b: SketchDot): number {
  return a[0] - b[0] || a[1] - b[1];
}

export function normalizeSketchEndpoints(
  a: SketchDot,
  b: SketchDot,
): readonly [SketchDot, SketchDot] {
  return compareSketchDots(a, b) <= 0 ? [a, b] : [b, a];
}

export function sketchSegmentEndpointKey(a: SketchDot, b: SketchDot): string {
  const [na, nb] = normalizeSketchEndpoints(a, b);
  return `${na[0]},${na[1]}-${nb[0]},${nb[1]}`;
}

export function sortSketchSegments(segments: readonly SketchSegment[]): SketchSegment[] {
  return [...segments].sort(
    (u, v) =>
      compareSketchDots(u.a, v.a) || compareSketchDots(u.b, v.b) || u.style.localeCompare(v.style),
  );
}

function segmentsCollinearPositiveOverlap(
  a1: SketchDot,
  a2: SketchDot,
  b1: SketchDot,
  b2: SketchDot,
): boolean {
  const dax = a2[0] - a1[0];
  const day = a2[1] - a1[1];
  const dbx = b2[0] - b1[0];
  const dby = b2[1] - b1[1];
  if (dax * dby - day * dbx !== 0) return false;
  if (dax * (b1[1] - a1[1]) - day * (b1[0] - a1[0]) !== 0) return false;
  const useX = Math.abs(dax) >= Math.abs(day);
  const aLo = useX ? Math.min(a1[0], a2[0]) : Math.min(a1[1], a2[1]);
  const aHi = useX ? Math.max(a1[0], a2[0]) : Math.max(a1[1], a2[1]);
  const bLo = useX ? Math.min(b1[0], b2[0]) : Math.min(b1[1], b2[1]);
  const bHi = useX ? Math.max(b1[0], b2[0]) : Math.max(b1[1], b2[1]);
  return Math.max(aLo, bLo) < Math.min(aHi, bHi);
}

/** 사투상 겨냥도에서 꼭짓점 겹침이나 모서리 양수 길이 겹침이 없으면 true. */
export function sketchProjectionOk(w: number, d: number, h: number): boolean {
  const vertexDots = new Set<string>();
  for (const id of XRAY_VERTEX_IDS) {
    const [gx, gy] = sketchProject(vertexPoint(id, w, d, h));
    const key = `${gx},${gy}`;
    if (vertexDots.has(key)) return false;
    vertexDots.add(key);
  }

  const edgeSegs = XRAY_EDGE_IDS.map((id) => {
    const [p, q] = edgeEndpoints(id, w, d, h);
    const s1 = sketchProject(p);
    const s2 = sketchProject(q);
    return normalizeSketchEndpoints(s1, s2);
  });

  for (let i = 0; i < edgeSegs.length; i += 1) {
    const ei = edgeSegs[i];
    if (!ei || (ei[0][0] === ei[1][0] && ei[0][1] === ei[1][1])) return false;
    for (let j = i + 1; j < edgeSegs.length; j += 1) {
      const ej = edgeSegs[j];
      if (!ej) continue;
      if (segmentsCollinearPositiveOverlap(ei[0], ei[1], ej[0], ej[1])) {
        return false;
      }
    }
  }
  return true;
}

/** 보이는 모서리 9개를 잠긴 실선으로 미리 채워 만든다. */
export function buildPrefillVisibleSegments(w: number, d: number, h: number): SketchSegment[] {
  const hiddenSet = new Set<XrayEdgeId>(SKETCH_HIDDEN_EDGES);
  const segs: SketchSegment[] = [];
  for (const id of XRAY_EDGE_IDS) {
    if (hiddenSet.has(id)) continue;
    const [p, q] = edgeEndpoints(id, w, d, h);
    const [a, b] = normalizeSketchEndpoints(sketchProject(p), sketchProject(q));
    segs.push({ a, b, style: 'solid', locked: true });
  }
  return sortSketchSegments(segs);
}

/** 겨냥도 선분 목록을 12개 모서리의 사투상 끝점 일치 기준으로 채점한다. */
export function gradeSketch(
  segments: readonly SketchSegmentInput[],
  w: number,
  d: number,
  h: number,
): SketchGrade {
  const hiddenSet = new Set<XrayEdgeId>(SKETCH_HIDDEN_EDGES);
  const expectedByKey = new Map<string, boolean>();
  for (const id of XRAY_EDGE_IDS) {
    const [p, q] = edgeEndpoints(id, w, d, h);
    const key = sketchSegmentEndpointKey(sketchProject(p), sketchProject(q));
    expectedByKey.set(key, hiddenSet.has(id));
  }

  const matchedStyleByKey = new Map<string, SketchLineStyle>();
  let extra = 0;
  for (const seg of segments) {
    const key = sketchSegmentEndpointKey(seg.a, seg.b);
    if (!expectedByKey.has(key) || matchedStyleByKey.has(key)) {
      extra += 1;
      continue;
    }
    matchedStyleByKey.set(key, seg.style);
  }

  let visibleMissing = 0;
  let hiddenMissing = 0;
  let hiddenSolid = 0;
  let visibleDashed = 0;

  for (const [key, isHidden] of expectedByKey) {
    const drawn = matchedStyleByKey.get(key);
    if (isHidden) {
      if (drawn !== 'dashed') {
        hiddenMissing += 1;
      }
      if (drawn === 'solid') {
        hiddenSolid += 1;
      }
    } else {
      if (drawn !== 'solid') {
        visibleMissing += 1;
      }
      if (drawn === 'dashed') {
        visibleDashed += 1;
      }
    }
  }

  return {
    visibleMissing,
    hiddenMissing,
    hiddenSolid,
    visibleDashed,
    extra,
    complete: visibleMissing === 0 && hiddenMissing === 0 && extra === 0,
  };
}
