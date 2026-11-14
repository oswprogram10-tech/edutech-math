/**
 * E12 `net-fold` 전개도 접기 판정·정규형·3D 변환 (순수 정수/기하 함수, React·DOM 없음).
 *
 * 접기 판정(`evaluateNet`)은 정수 사상과 정수 축 정렬 직사각형 교차만 사용한다.
 * 애니메이션용 `foldTransforms` / `foldTransformsWith`만 `cos`/`sin` 실수를 쓴다.
 */

export type NetTarget = 'cube' | 'cuboid';

export type Vec3 = readonly [number, number, number];

export interface NetFaceInput {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly label?: string | null;
}

export interface NetBoxSpec {
  readonly target: NetTarget;
  readonly faceSize: number;
  readonly dims: readonly [number, number, number];
}

export interface Box3D {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
  readonly minZ: number;
  readonly maxZ: number;
}

export interface HingeEdge {
  readonly parent: number;
  readonly child: number;
  readonly axis: 'x' | 'y';
  readonly coord: number;
  /** 자식이 경첩선의 `+` 방향(`+1`)인지 `−` 방향(`−1`)인지. */
  readonly side: 1 | -1;
}

export interface SharedEdgeSegment {
  readonly axis: 'x' | 'y';
  readonly coord: number;
  readonly lo: number;
  readonly hi: number;
}

export interface TornEdgeInfo {
  readonly a: number;
  readonly b: number;
  readonly segment: SharedEdgeSegment;
}

export interface NetEvaluation {
  readonly connected: boolean;
  readonly rootIndex: number;
  readonly faceCount: number;
  readonly overlapPairs: number;
  readonly overlapFaceIndices: readonly number[];
  readonly tornEdges: number;
  readonly tornEdgeList: readonly TornEdgeInfo[];
  readonly outsideFaces: number;
  readonly missingSlots: readonly number[];
  readonly slotOf: readonly (number | null)[];
  readonly valid: boolean;
  readonly netKey: string | null;
  readonly opposites: Readonly<Record<string, string>>;
  readonly hinges: readonly HingeEdge[];
  readonly boxes3D: readonly (Box3D | null)[];
  readonly slotBoxes: readonly Box3D[];
}

export interface FaceTransform3D {
  readonly corners: readonly [Vec3, Vec3, Vec3, Vec3];
  readonly center: Vec3;
  readonly normal: Vec3;
  readonly connected: boolean;
}

interface IntFrame {
  readonly origin: Vec3;
  readonly ax: Vec3;
  readonly ay: Vec3;
  readonly n: Vec3;
}

interface NeighborLink {
  readonly neighbor: number;
  readonly axis: 'x' | 'y';
  readonly coord: number;
  readonly side: 1 | -1;
  readonly segment: SharedEdgeSegment;
}

const SLOT_COUNT = 6;

function add3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function sub3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function scale3(v: Vec3, s: number): Vec3 {
  return [v[0] * s, v[1] * s, v[2] * s];
}

function eq3(a: Vec3, b: Vec3): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

function mapIntPoint(frame: IntFrame, px: number, py: number): Vec3 {
  return add3(add3(frame.origin, scale3(frame.ax, px)), scale3(frame.ay, py));
}

export function sortFaces<T extends NetFaceInput>(faces: readonly T[]): T[] {
  return [...faces].sort((a, b) => a.y - b.y || a.x - b.x || a.w - b.w || a.h - b.h);
}

/** 목표 입체 설정에 맞는 허용 `[w, h]` 면 크기 목록을 돌려준다. */
export function allowedFaceShapes(spec: NetBoxSpec): readonly (readonly [number, number])[] {
  if (spec.target === 'cube') {
    return [[spec.faceSize, spec.faceSize]];
  }
  const [a, b, c] = spec.dims;
  const candidates: readonly (readonly [number, number])[] = [
    [a, b],
    [b, a],
    [a, c],
    [c, a],
    [b, c],
    [c, b],
  ];
  const seen = new Set<string>();
  const unique: (readonly [number, number])[] = [];
  for (const [w, h] of candidates) {
    const key = `${w}x${h}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push([w, h]);
    }
  }
  return unique;
}

/** `[w, h]`가 목표 입체에 허용되는 면 크기인지 검사한다. */
export function isAllowedFaceShape(w: number, h: number, spec: NetBoxSpec): boolean {
  return allowedFaceShapes(spec).some(([aw, ah]) => aw === w && ah === h);
}

/** 바닥 면 `(w, h)`를 제외한 직육면체 높이 `H`를 구한다. 맞지 않으면 null. */
export function remainingBoxHeight(w: number, h: number, spec: NetBoxSpec): number | null {
  if (spec.target === 'cube') {
    return w === spec.faceSize && h === spec.faceSize ? spec.faceSize : null;
  }
  const pool = [...spec.dims];
  const iW = pool.indexOf(w);
  if (iW === -1) return null;
  pool.splice(iW, 1);
  const iH = pool.indexOf(h);
  if (iH === -1) return null;
  pool.splice(iH, 1);
  return pool[0] ?? null;
}

function findNeighborLink(
  a: NetFaceInput,
  b: NetFaceInput,
  neighborIdx: number,
): NeighborLink | null {
  if (a.x + a.w === b.x || b.x + b.w === a.x) {
    const yLo = Math.max(a.y, b.y);
    const yHi = Math.min(a.y + a.h, b.y + b.h);
    if (yHi > yLo) {
      const side: 1 | -1 = a.x + a.w === b.x ? 1 : -1;
      const coord = side === 1 ? a.x + a.w : a.x;
      return {
        neighbor: neighborIdx,
        axis: 'x',
        coord,
        side,
        segment: { axis: 'x', coord, lo: yLo, hi: yHi },
      };
    }
  }
  if (a.y + a.h === b.y || b.y + b.h === a.y) {
    const xLo = Math.max(a.x, b.x);
    const xHi = Math.min(a.x + a.w, b.x + b.w);
    if (xHi > xLo) {
      const side: 1 | -1 = a.y + a.h === b.y ? 1 : -1;
      const coord = side === 1 ? a.y + a.h : a.y;
      return {
        neighbor: neighborIdx,
        axis: 'y',
        coord,
        side,
        segment: { axis: 'y', coord, lo: xLo, hi: xHi },
      };
    }
  }
  return null;
}

function pickRootIndex(sortedFaces: readonly NetFaceInput[]): number {
  let bestIdx = 0;
  let bestArea = -1;
  for (let i = 0; i < sortedFaces.length; i += 1) {
    const f = sortedFaces[i];
    if (!f) continue;
    const area = f.w * f.h;
    if (area > bestArea) {
      bestArea = area;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function stepIntFrame(parent: IntFrame, hinge: HingeEdge): IntFrame {
  if (hinge.axis === 'x') {
    const axNext = scale3(parent.n, hinge.side);
    const ayNext = parent.ay;
    const nNext = scale3(parent.ax, -hinge.side);
    const oNext = sub3(
      add3(parent.origin, scale3(parent.ax, hinge.coord)),
      scale3(axNext, hinge.coord),
    );
    return { origin: oNext, ax: axNext, ay: ayNext, n: nNext };
  }
  const ayNext = scale3(parent.n, hinge.side);
  const axNext = parent.ax;
  const nNext = scale3(parent.ay, -hinge.side);
  const oNext = sub3(
    add3(parent.origin, scale3(parent.ay, hinge.coord)),
    scale3(ayNext, hinge.coord),
  );
  return { origin: oNext, ax: axNext, ay: ayNext, n: nNext };
}

function faceBox3D(frame: IntFrame, face: NetFaceInput): Box3D {
  const first = mapIntPoint(frame, face.x, face.y);
  const corners = [
    first,
    mapIntPoint(frame, face.x + face.w, face.y),
    mapIntPoint(frame, face.x + face.w, face.y + face.h),
    mapIntPoint(frame, face.x, face.y + face.h),
  ];
  let minX = first[0];
  let maxX = first[0];
  let minY = first[1];
  let maxY = first[1];
  let minZ = first[2];
  let maxZ = first[2];
  for (let i = 1; i < corners.length; i += 1) {
    const corner = corners[i];
    if (!corner) continue;
    const [cx, cy, cz] = corner;
    if (cx < minX) minX = cx;
    if (cx > maxX) maxX = cx;
    if (cy < minY) minY = cy;
    if (cy > maxY) maxY = cy;
    if (cz < minZ) minZ = cz;
    if (cz > maxZ) maxZ = cz;
  }
  return { minX, maxX, minY, maxY, minZ, maxZ };
}

function box3DEquals(a: Box3D, b: Box3D): boolean {
  return (
    a.minX === b.minX &&
    a.maxX === b.maxX &&
    a.minY === b.minY &&
    a.maxY === b.maxY &&
    a.minZ === b.minZ &&
    a.maxZ === b.maxZ
  );
}

function flatBoxesOverlapPositiveArea(a: Box3D, b: Box3D): boolean {
  if (a.minZ === a.maxZ && b.minZ === b.maxZ && a.minZ === b.minZ) {
    return (
      Math.min(a.maxX, b.maxX) > Math.max(a.minX, b.minX) &&
      Math.min(a.maxY, b.maxY) > Math.max(a.minY, b.minY)
    );
  }
  if (a.minX === a.maxX && b.minX === b.maxX && a.minX === b.minX) {
    return (
      Math.min(a.maxY, b.maxY) > Math.max(a.minY, b.minY) &&
      Math.min(a.maxZ, b.maxZ) > Math.max(a.minZ, b.minZ)
    );
  }
  if (a.minY === a.maxY && b.minY === b.maxY && a.minY === b.minY) {
    return (
      Math.min(a.maxX, b.maxX) > Math.max(a.minX, b.minX) &&
      Math.min(a.maxZ, b.maxZ) > Math.max(a.minZ, b.minZ)
    );
  }
  return false;
}

function buildSlotBoxes(root: NetFaceInput, height: number): readonly Box3D[] {
  const x0 = root.x;
  const x1 = root.x + root.w;
  const y0 = root.y;
  const y1 = root.y + root.h;
  return [
    { minX: x0, maxX: x1, minY: y0, maxY: y1, minZ: 0, maxZ: 0 },
    { minX: x0, maxX: x1, minY: y0, maxY: y1, minZ: height, maxZ: height },
    { minX: x0, maxX: x0, minY: y0, maxY: y1, minZ: 0, maxZ: height },
    { minX: x1, maxX: x1, minY: y0, maxY: y1, minZ: 0, maxZ: height },
    { minX: x0, maxX: x1, minY: y0, maxY: y0, minZ: 0, maxZ: height },
    { minX: x0, maxX: x1, minY: y1, maxY: y1, minZ: 0, maxZ: height },
  ];
}

function segmentEndpoints(
  seg: SharedEdgeSegment,
): readonly [readonly [number, number], readonly [number, number]] {
  if (seg.axis === 'x') {
    return [
      [seg.coord, seg.lo],
      [seg.coord, seg.hi],
    ];
  }
  return [
    [seg.lo, seg.coord],
    [seg.hi, seg.coord],
  ];
}

function buildBfsTree(
  sortedFaces: readonly NetFaceInput[],
  rootIndex: number,
): {
  readonly visited: boolean[];
  readonly hinges: HingeEdge[];
  readonly treeEdgeKeys: Set<string>;
  readonly adjacency: NeighborLink[][];
} {
  const n = sortedFaces.length;
  const adjacency: NeighborLink[][] = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i += 1) {
    const fi = sortedFaces[i];
    const adjI = adjacency[i];
    if (!fi || !adjI) continue;
    for (let j = i + 1; j < n; j += 1) {
      const fj = sortedFaces[j];
      const adjJ = adjacency[j];
      if (!fj || !adjJ) continue;
      const linkIJ = findNeighborLink(fi, fj, j);
      if (linkIJ) {
        adjI.push(linkIJ);
        const linkJI = findNeighborLink(fj, fi, i);
        if (linkJI) adjJ.push(linkJI);
      }
    }
  }

  const visited = Array<boolean>(n).fill(false);
  const hinges: HingeEdge[] = [];
  const treeEdgeKeys = new Set<string>();
  if (n === 0 || rootIndex < 0 || rootIndex >= n) {
    return { visited, hinges, treeEdgeKeys, adjacency };
  }

  visited[rootIndex] = true;
  const queue: number[] = [rootIndex];
  while (queue.length > 0) {
    const u = queue.shift();
    if (u === undefined) break;
    for (const link of adjacency[u] ?? []) {
      if (visited[link.neighbor]) continue;
      visited[link.neighbor] = true;
      hinges.push({
        parent: u,
        child: link.neighbor,
        axis: link.axis,
        coord: link.coord,
        side: link.side,
      });
      const key = u < link.neighbor ? `${u},${link.neighbor}` : `${link.neighbor},${u}`;
      treeEdgeKeys.add(key);
      queue.push(link.neighbor);
    }
  }

  return { visited, hinges, treeEdgeKeys, adjacency };
}

/** 전개도 면 집합의 대칭(회전 4 × 뒤집기 2)·평행이동 불변 정규형 키를 만든다. */
export function canonicalNetKey(faces: readonly NetFaceInput[]): string {
  if (faces.length === 0) return '';
  let best: string | null = null;
  for (let flip = 0; flip < 2; flip += 1) {
    for (let rot = 0; rot < 4; rot += 1) {
      const transformed = faces.map((face) => {
        let x = flip === 1 ? -(face.x + face.w) : face.x;
        let y = face.y;
        let w = face.w;
        let h = face.h;
        for (let r = 0; r < rot; r += 1) {
          const nx = y;
          const ny = -(x + w);
          const nw = h;
          const nh = w;
          x = nx;
          y = ny;
          w = nw;
          h = nh;
        }
        return { x, y, w, h };
      });
      const firstRect = transformed[0];
      let minX = firstRect ? firstRect.x : 0;
      let minY = firstRect ? firstRect.y : 0;
      for (const rect of transformed) {
        if (rect.x < minX) minX = rect.x;
        if (rect.y < minY) minY = rect.y;
      }
      const key = transformed
        .map((r) => `${r.x - minX},${r.y - minY},${r.w},${r.h}`)
        .sort()
        .join(';');
      if (best === null || key < best) {
        best = key;
      }
    }
  }
  return best ?? '';
}

/**
 * 전개도 면 목록을 받아 정수 사상으로 90° 접기를 판정한다.
 * `faces`가 정렬되지 않았더라도 내부에서 `(y, x)` 순으로 정렬해 처리한다
 * (인덱스 기준 결과 `slotOf`, `tornEdgeList`, `hinges`도 정렬 순서를 따른다).
 */
export function evaluateNet(faces: readonly NetFaceInput[], spec: NetBoxSpec): NetEvaluation {
  const sorted = sortFaces(faces);
  const n = sorted.length;

  if (n === 0) {
    return {
      connected: false,
      rootIndex: -1,
      faceCount: 0,
      overlapPairs: 0,
      overlapFaceIndices: [],
      tornEdges: 0,
      tornEdgeList: [],
      outsideFaces: 0,
      missingSlots: [0, 1, 2, 3, 4, 5],
      slotOf: [],
      valid: false,
      netKey: null,
      opposites: {},
      hinges: [],
      boxes3D: [],
      slotBoxes: [],
    };
  }

  const rootIndex = pickRootIndex(sorted);
  const root = sorted[rootIndex];
  if (!root) {
    return {
      connected: false,
      rootIndex: -1,
      faceCount: 0,
      overlapPairs: 0,
      overlapFaceIndices: [],
      tornEdges: 0,
      tornEdgeList: [],
      outsideFaces: 0,
      missingSlots: [0, 1, 2, 3, 4, 5],
      slotOf: [],
      valid: false,
      netKey: null,
      opposites: {},
      hinges: [],
      boxes3D: [],
      slotBoxes: [],
    };
  }
  const height = remainingBoxHeight(root.w, root.h, spec);
  const { visited, hinges, treeEdgeKeys, adjacency } = buildBfsTree(sorted, rootIndex);
  const connected = visited.every(Boolean);

  const frames: (IntFrame | null)[] = Array<IntFrame | null>(n).fill(null);
  frames[rootIndex] = {
    origin: [0, 0, 0],
    ax: [1, 0, 0],
    ay: [0, 1, 0],
    n: [0, 0, 1],
  };
  for (const hinge of hinges) {
    const pFrame = frames[hinge.parent];
    if (pFrame) {
      frames[hinge.child] = stepIntFrame(pFrame, hinge);
    }
  }

  const boxes3D: (Box3D | null)[] = frames.map((f, i) => {
    const face = sorted[i];
    return f && face ? faceBox3D(f, face) : null;
  });
  const slotBoxes = height !== null ? buildSlotBoxes(root, height) : [];
  const slotOf: (number | null)[] = Array<number | null>(n).fill(null);
  const coveredSlots = new Set<number>();
  let outsideFaces = 0;

  for (let i = 0; i < n; i += 1) {
    if (!visited[i]) continue;
    const box = boxes3D[i];
    if (!box || slotBoxes.length !== SLOT_COUNT) {
      outsideFaces += 1;
      continue;
    }
    let matched: number | null = null;
    for (let s = 0; s < SLOT_COUNT; s += 1) {
      const slotBox = slotBoxes[s];
      if (slotBox && box3DEquals(box, slotBox)) {
        matched = s;
        break;
      }
    }
    slotOf[i] = matched;
    if (matched === null) {
      outsideFaces += 1;
    } else {
      coveredSlots.add(matched);
    }
  }

  const overlapFaceSet = new Set<number>();
  let overlapPairs = 0;
  for (let i = 0; i < n; i += 1) {
    const boxI = boxes3D[i];
    if (!visited[i] || !boxI) continue;
    for (let j = i + 1; j < n; j += 1) {
      const boxJ = boxes3D[j];
      if (!visited[j] || !boxJ) continue;
      if (flatBoxesOverlapPositiveArea(boxI, boxJ)) {
        overlapPairs += 1;
        overlapFaceSet.add(i);
        overlapFaceSet.add(j);
      }
    }
  }

  const tornEdgeList: TornEdgeInfo[] = [];
  for (let i = 0; i < n; i += 1) {
    const frameI = frames[i];
    if (!visited[i] || !frameI) continue;
    for (const link of adjacency[i] ?? []) {
      const j = link.neighbor;
      const frameJ = frames[j];
      if (j <= i || !visited[j] || !frameJ) continue;
      const edgeKey = `${i},${j}`;
      if (treeEdgeKeys.has(edgeKey)) continue;
      const [pA, pB] = segmentEndpoints(link.segment);
      const a1 = mapIntPoint(frameI, pA[0], pA[1]);
      const b1 = mapIntPoint(frameI, pB[0], pB[1]);
      const a2 = mapIntPoint(frameJ, pA[0], pA[1]);
      const b2 = mapIntPoint(frameJ, pB[0], pB[1]);
      const same = (eq3(a1, a2) && eq3(b1, b2)) || (eq3(a1, b2) && eq3(b1, a2));
      if (!same) {
        tornEdgeList.push({ a: i, b: j, segment: link.segment });
      }
    }
  }

  const missingSlots: number[] = [];
  for (let s = 0; s < SLOT_COUNT; s += 1) {
    if (!coveredSlots.has(s)) missingSlots.push(s);
  }

  const tornEdges = tornEdgeList.length;
  const allShapesAllowed = sorted.every((f) => isAllowedFaceShape(f.w, f.h, spec));
  const valid =
    n === SLOT_COUNT &&
    connected &&
    allShapesAllowed &&
    overlapPairs === 0 &&
    tornEdges === 0 &&
    outsideFaces === 0 &&
    missingSlots.length === 0;

  const opposites: Record<string, string> = {};
  if (valid) {
    const labelBySlot = new Map<number, string>();
    for (let i = 0; i < n; i += 1) {
      const s = slotOf[i];
      const face = sorted[i];
      const lbl = face?.label;
      if (s !== null && s !== undefined && lbl) {
        labelBySlot.set(s, lbl);
      }
    }
    for (let s = 0; s < SLOT_COUNT; s += 1) {
      const a = labelBySlot.get(s);
      const b = labelBySlot.get(s ^ 1);
      if (a && b) {
        opposites[a] = b;
      }
    }
  }

  return {
    connected,
    rootIndex,
    faceCount: n,
    overlapPairs,
    overlapFaceIndices: [...overlapFaceSet].sort((a, b) => a - b),
    tornEdges,
    tornEdgeList,
    outsideFaces,
    missingSlots,
    slotOf,
    valid,
    netKey: valid ? canonicalNetKey(sorted) : null,
    opposites,
    hinges,
    boxes3D,
    slotBoxes,
  };
}

function add3f(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function sub3f(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function scale3f(v: Vec3, s: number): Vec3 {
  return [v[0] * s, v[1] * s, v[2] * s];
}

function mapFloatPoint(frame: IntFrame, px: number, py: number): Vec3 {
  return add3f(add3f(frame.origin, scale3f(frame.ax, px)), scale3f(frame.ay, py));
}

function stepFloatFrame(parent: IntFrame, hinge: HingeEdge, angleRad: number): IntFrame {
  const c = Math.cos(angleRad);
  const sn = Math.sin(angleRad) * hinge.side;
  if (hinge.axis === 'x') {
    const axNext = add3f(scale3f(parent.ax, c), scale3f(parent.n, sn));
    const ayNext = parent.ay;
    const nNext = sub3f(scale3f(parent.n, c), scale3f(parent.ax, sn));
    const oNext = sub3f(
      add3f(parent.origin, scale3f(parent.ax, hinge.coord)),
      scale3f(axNext, hinge.coord),
    );
    return { origin: oNext, ax: axNext, ay: ayNext, n: nNext };
  }
  const ayNext = add3f(scale3f(parent.ay, c), scale3f(parent.n, sn));
  const axNext = parent.ax;
  const nNext = sub3f(scale3f(parent.n, c), scale3f(parent.ay, sn));
  const oNext = sub3f(
    add3f(parent.origin, scale3f(parent.ay, hinge.coord)),
    scale3f(ayNext, hinge.coord),
  );
  return { origin: oNext, ax: axNext, ay: ayNext, n: nNext };
}

/**
 * 지정한 뿌리(`rootIndex`)에서 `targetIndex`까지의 BFS 트리 경로에 속한 면 인덱스 집합을 돌려준다.
 * 경로상의 경첩만 접을 때(`fold-path` 오버레이) 사용한다.
 */
export function bfsPathToFace(
  faces: readonly NetFaceInput[],
  rootIndex: number,
  targetIndex: number,
): Set<number> {
  const result = new Set<number>();
  const n = faces.length;
  if (rootIndex < 0 || rootIndex >= n || targetIndex < 0 || targetIndex >= n) {
    return result;
  }
  const { hinges } = buildBfsTree(faces, rootIndex);
  const parentOf = new Map<number, number>();
  for (const h of hinges) {
    parentOf.set(h.child, h.parent);
  }
  let cur: number | undefined = targetIndex;
  while (cur !== undefined && cur !== rootIndex) {
    result.add(cur);
    cur = parentOf.get(cur);
  }
  if (cur === rootIndex) {
    result.add(rootIndex);
  } else {
    result.clear();
  }
  return result;
}

/**
 * 지정한 뿌리(`root`)에서 BFS 트리를 만들고, 각 자식 면의 경첩 각도(`angleOf(faceIndex)`)만큼
 * 연속 회전시킨 각 면의 3D 꼭짓점 4개를 돌려준다. `faces`는 이미 정렬되어 있거나 정렬 뒤 인덱스를 쓴다.
 */
export function foldTransformsWith(
  faces: readonly NetFaceInput[],
  root: number,
  angleOf: (faceIndex: number) => number,
): FaceTransform3D[] {
  const n = faces.length;
  if (n === 0) return [];
  const rootIndex = root >= 0 && root < n ? root : pickRootIndex(faces);
  const { visited, hinges } = buildBfsTree(faces, rootIndex);

  const flatRoot: IntFrame = {
    origin: [0, 0, 0],
    ax: [1, 0, 0],
    ay: [0, 1, 0],
    n: [0, 0, 1],
  };
  const frames: IntFrame[] = Array.from({ length: n }, () => flatRoot);
  for (const hinge of hinges) {
    const pFrame = frames[hinge.parent] ?? flatRoot;
    frames[hinge.child] = stepFloatFrame(pFrame, hinge, angleOf(hinge.child));
  }

  return faces.map((face, i) => {
    const f = frames[i] ?? flatRoot;
    const p0: Vec3 = mapFloatPoint(f, face.x, face.y);
    const p1: Vec3 = mapFloatPoint(f, face.x + face.w, face.y);
    const p2: Vec3 = mapFloatPoint(f, face.x + face.w, face.y + face.h);
    const p3: Vec3 = mapFloatPoint(f, face.x, face.y + face.h);
    const center: Vec3 = [
      (p0[0] + p1[0] + p2[0] + p3[0]) / 4,
      (p0[1] + p1[1] + p2[1] + p3[1]) / 4,
      (p0[2] + p1[2] + p2[2] + p3[2]) / 4,
    ];
    return {
      corners: [p0, p1, p2, p3],
      center,
      normal: f.n,
      connected: visited[i] === true,
    };
  });
}

/** 모든 경첩을 같은 각도(`angleRad`)로 접었을 때 각 면의 3D 꼭짓점 4개를 돌려준다. */
export function foldTransforms(
  faces: readonly NetFaceInput[],
  angleRad: number,
): FaceTransform3D[] {
  const sorted = sortFaces(faces);
  if (sorted.length === 0) return [];
  const root = pickRootIndex(sorted);
  return foldTransformsWith(sorted, root, () => angleRad);
}
