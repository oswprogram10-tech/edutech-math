/**
 * E12 `prism-pyramid` 모드 기하(순수 함수, DOM 없음).
 *
 * - 밑면은 외접원 반지름 1인 정n각형(n 3~8)이고 z=0 평면에 놓는다. 높이 단계 h(0~4)에 0.5를 곱한 값이 입체의 높이다.
 * - 요소(면·모서리·꼭짓점) 이름과 고정 순서, 인접 관계는 정수·이름으로만 다룬다.
 *   판정에 쓰는 개수는 요소 목록의 길이로 센다(좌표로 세지 않는다).
 * - 꼭짓점의 3D 좌표와 투영 좌표는 화면용이라 number를 쓴다.
 * - xray 모드 코드는 고치지 않고, 시점 정규화·시선 기저만 가져다 쓴다. 투영·깊이순 정렬은 여기서 따로 둔다.
 */
import type { Vec3 } from '../net/geometry';
import { normalizeView, viewBasis, type ViewBasis, type XrayViewAngle } from '../xray/geometry';

export type PrismKindId = 'base' | 'prism' | 'pyramid';
export type PrismTopId = 'flat' | 'apex';
export type PrismOrientationId = 'upright' | 'lying';

export interface PrismSpec {
  readonly n: number;
  /** 높이 단계 0~4. */
  readonly height: number;
  readonly top: PrismTopId;
}

export interface PrismFace {
  readonly id: string;
  readonly points: readonly Vec3[];
  /** 바깥쪽 법선(정규화). */
  readonly normal: Vec3;
  readonly center: Vec3;
}

export interface PrismEdge {
  readonly id: string;
  readonly a: Vec3;
  readonly b: Vec3;
  /** 붙은 면. 평면도형(`base`)의 모서리만 1개, 나머지는 늘 2개다. */
  readonly faces: readonly string[];
}

export interface PrismVertex {
  readonly id: string;
  readonly p: Vec3;
  readonly faces: readonly string[];
}

export interface PrismModel {
  readonly kind: PrismKindId;
  readonly n: number;
  readonly faces: readonly PrismFace[];
  readonly edges: readonly PrismEdge[];
  readonly vertices: readonly PrismVertex[];
}

export interface TrueCounts {
  readonly faces: number;
  readonly edges: number;
  readonly vertices: number;
}

export const PRISM_HEIGHT_UNIT = 0.5;
export const PRISM_MAX_STEPS = 4;

/** 높이·n이 바뀌어도 배율이 안 바뀌게 하는 기준 경계 상자(n=8, 높이 4단계): 폭 2, 깊이 2, 높이 2. */
const REF_DIAGONAL = Math.hypot(2, 2, PRISM_MAX_STEPS * PRISM_HEIGHT_UNIT);

export function prismKind(spec: PrismSpec): PrismKindId {
  if (spec.height <= 0) return 'base';
  return spec.top === 'apex' ? 'pyramid' : 'prism';
}

export function prismHeight3d(step: number): number {
  return step * PRISM_HEIGHT_UNIT;
}

/** 요소 목록 길이로 센 참 개수. `base`는 null. */
export function trueCounts(kind: PrismKindId, n: number): TrueCounts | null {
  if (kind === 'base') return null;
  const model = buildPrismModel(
    { n, height: 1, top: kind === 'pyramid' ? 'apex' : 'flat' },
    'upright',
  );
  return {
    faces: model.faces.length,
    edges: model.edges.length,
    vertices: model.vertices.length,
  };
}

/** 고정 순서 요소 이름: 면 `bottom`,(`top`),`s0..`, 모서리 `eb..`,(`et..`),`el..`, 꼭짓점 `b..`,(`t..`|`apex`). */
export function prismElementIds(
  kind: PrismKindId,
  n: number,
): {
  readonly faces: readonly string[];
  readonly edges: readonly string[];
  readonly vertices: readonly string[];
} {
  const range = Array.from({ length: n }, (_, i) => i);
  if (kind === 'base') {
    return {
      faces: ['bottom'],
      edges: range.map((i) => `eb${i}`),
      vertices: range.map((i) => `b${i}`),
    };
  }
  if (kind === 'prism') {
    return {
      faces: ['bottom', 'top', ...range.map((i) => `s${i}`)],
      edges: [
        ...range.map((i) => `eb${i}`),
        ...range.map((i) => `et${i}`),
        ...range.map((i) => `el${i}`),
      ],
      vertices: [...range.map((i) => `b${i}`), ...range.map((i) => `t${i}`)],
    };
  }
  return {
    faces: ['bottom', ...range.map((i) => `s${i}`)],
    edges: [...range.map((i) => `eb${i}`), ...range.map((i) => `el${i}`)],
    vertices: [...range.map((i) => `b${i}`), 'apex'],
  };
}

/** 정n각형 꼭짓점 각도(라디안). 옆면 `s0`이 앞(y가 음수 쪽)을 향하도록 반 칸 돌려 놓는다. */
function baseAngle(n: number, i: number): number {
  return ((-90 - 180 / n + (360 * i) / n) * Math.PI) / 180;
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function normalize(v: Vec3): Vec3 {
  const len = Math.hypot(v[0], v[1], v[2]);
  if (len < 1e-12) return [0, 0, 1];
  return [v[0] / len, v[1] / len, v[2] / len];
}

function mean(points: readonly Vec3[]): Vec3 {
  const sum = points.reduce<Vec3>(
    (acc, p) => [acc[0] + p[0], acc[1] + p[1], acc[2] + p[2]],
    [0, 0, 0],
  );
  const k = Math.max(1, points.length);
  return [sum[0] / k, sum[1] / k, sum[2] / k];
}

/** 눕히기: x축으로 −90° 돌린다. 높이 방향(z)이 뒤쪽(y)으로 간다. */
function orient(p: Vec3, orientation: PrismOrientationId): Vec3 {
  if (orientation === 'upright') return p;
  return [p[0], p[2], -p[1]];
}

/** 입체가 늘 같은 점을 중심으로 그려지게 하는 고정 중심(세운 입체 기준 `(0, 0, 1)`). */
function fixedCenter(orientation: PrismOrientationId): Vec3 {
  return orient([0, 0, (PRISM_MAX_STEPS * PRISM_HEIGHT_UNIT) / 2], orientation);
}

/**
 * 입체 모델을 만든다. 좌표는 방향(`orientation`)을 적용하고 고정 중심을 뺀 값이다.
 *
 * `topScale`이 있으면(모으기 애니메이션 중) 각기둥 짜임새로 만들되 윗면 꼭짓점을
 * 꼭대기 쪽으로 `topScale`배만큼 오므린다(1: 각기둥, 0: 한 점). 없으면 `spec.top`의 짜임새를 쓴다.
 */
export function buildPrismModel(
  spec: PrismSpec,
  orientation: PrismOrientationId,
  topScale?: number,
): PrismModel {
  const { n } = spec;
  const range = Array.from({ length: n }, (_, i) => i);
  const H = prismHeight3d(spec.height);
  const center = fixedCenter(orientation);
  const place = (p: Vec3): Vec3 => sub(orient(p, orientation), center);
  const placeNormal = (v: Vec3): Vec3 => orient(v, orientation);

  const bottomPts: Vec3[] = range.map((i) => [
    Math.cos(baseAngle(n, i)),
    Math.sin(baseAngle(n, i)),
    0,
  ]);

  const kind = prismKind(spec);
  if (kind === 'base') {
    return {
      kind,
      n,
      faces: [
        {
          id: 'bottom',
          points: bottomPts.map(place),
          normal: placeNormal([0, 0, -1]),
          center: place([0, 0, 0]),
        },
      ],
      edges: range.map((i) => ({
        id: `eb${i}`,
        a: place(bottomPts[i] as Vec3),
        b: place(bottomPts[(i + 1) % n] as Vec3),
        faces: ['bottom'],
      })),
      vertices: range.map((i) => ({
        id: `b${i}`,
        p: place(bottomPts[i] as Vec3),
        faces: ['bottom'],
      })),
    };
  }

  const animating = topScale !== undefined;
  const isApexTopology = !animating && spec.top === 'apex';
  const scale = animating ? Math.min(1, Math.max(0, topScale)) : 1;
  const topPts: Vec3[] = range.map((i) => {
    const b = bottomPts[i] as Vec3;
    return [b[0] * scale, b[1] * scale, H];
  });
  const apexPt: Vec3 = [0, 0, H];
  const bodyCentroid = mean([...bottomPts, isApexTopology ? apexPt : [0, 0, H]]);

  /** 옆면 법선: 세 점의 외적을 입체 중심에서 먼 쪽으로 맞춘다. */
  const sideNormal = (p0: Vec3, p1: Vec3, p2: Vec3, c: Vec3): Vec3 => {
    const raw = normalize(cross(sub(p1, p0), sub(p2, p0)));
    return dot(raw, sub(c, bodyCentroid)) < 0 ? [-raw[0], -raw[1], -raw[2]] : raw;
  };

  const faces: PrismFace[] = [
    {
      id: 'bottom',
      points: bottomPts.map(place),
      normal: placeNormal([0, 0, -1]),
      center: place([0, 0, 0]),
    },
  ];
  if (!isApexTopology) {
    faces.push({
      id: 'top',
      points: topPts.map(place),
      normal: placeNormal([0, 0, 1]),
      center: place([0, 0, H]),
    });
  }
  for (const i of range) {
    const j = (i + 1) % n;
    const b0 = bottomPts[i] as Vec3;
    const b1 = bottomPts[j] as Vec3;
    const pts: Vec3[] = isApexTopology
      ? [b0, b1, apexPt]
      : [b0, b1, topPts[j] as Vec3, topPts[i] as Vec3];
    const c = mean(pts);
    faces.push({
      id: `s${i}`,
      points: pts.map((p) => place(p)),
      normal: placeNormal(sideNormal(b0, b1, isApexTopology ? apexPt : (topPts[i] as Vec3), c)),
      center: place(c),
    });
  }

  const edges: PrismEdge[] = [];
  for (const i of range) {
    edges.push({
      id: `eb${i}`,
      a: place(bottomPts[i] as Vec3),
      b: place(bottomPts[(i + 1) % n] as Vec3),
      faces: ['bottom', `s${i}`],
    });
  }
  if (!isApexTopology) {
    for (const i of range) {
      edges.push({
        id: `et${i}`,
        a: place(topPts[i] as Vec3),
        b: place(topPts[(i + 1) % n] as Vec3),
        faces: ['top', `s${i}`],
      });
    }
  }
  for (const i of range) {
    edges.push({
      id: `el${i}`,
      a: place(bottomPts[i] as Vec3),
      b: place(isApexTopology ? apexPt : (topPts[i] as Vec3)),
      faces: [`s${(i + n - 1) % n}`, `s${i}`],
    });
  }

  const vertices: PrismVertex[] = range.map((i) => ({
    id: `b${i}`,
    p: place(bottomPts[i] as Vec3),
    faces: ['bottom', `s${(i + n - 1) % n}`, `s${i}`],
  }));
  if (isApexTopology) {
    vertices.push({ id: 'apex', p: place(apexPt), faces: range.map((i) => `s${i}`) });
  } else {
    for (const i of range) {
      vertices.push({
        id: `t${i}`,
        p: place(topPts[i] as Vec3),
        faces: ['top', `s${(i + n - 1) % n}`, `s${i}`],
      });
    }
  }

  return { kind, n, faces, edges, vertices };
}

/** 한 시점에서 보이는 면 목록(모델의 면 순서). 평면도형(`base`)은 양면이라 늘 보인다. */
export function visiblePrismFaces(model: PrismModel, view: XrayViewAngle): readonly string[] {
  if (model.kind === 'base') return ['bottom'];
  const { eye } = viewBasis(view);
  return model.faces.filter((f) => dot(f.normal, eye) > 1e-9).map((f) => f.id);
}

/** 붙은 면이 모두 안 보이는 모서리(고정 순서). 평면도형은 숨은 모서리가 없다. */
export function hiddenPrismEdges(model: PrismModel, view: XrayViewAngle): readonly string[] {
  if (model.kind === 'base') return [];
  const vis = new Set(visiblePrismFaces(model, view));
  return model.edges.filter((e) => e.faces.every((f) => !vis.has(f))).map((e) => e.id);
}

/** 붙은 면이 모두 안 보이는 꼭짓점(고정 순서). */
export function hiddenPrismVertices(model: PrismModel, view: XrayViewAngle): readonly string[] {
  if (model.kind === 'base') return [];
  const vis = new Set(visiblePrismFaces(model, view));
  return model.vertices.filter((v) => v.faces.every((f) => !vis.has(f))).map((v) => v.id);
}

export interface ProjectedPrismPoint {
  readonly x: number;
  readonly y: number;
  readonly depth: number;
}

/** 무대 짧은 변의 84%를 기준 경계 상자 대각선으로 나눈 배율. n·높이·시점이 바뀌어도 변하지 않는다. */
export function prismScaleForStage(stageW: number, stageH: number): number {
  return (Math.min(stageW, stageH) * 0.84) / REF_DIAGONAL;
}

/** 정사영 투영. 점은 이미 고정 중심 기준(`buildPrismModel`의 좌표)이다. */
export function projectPrismPoint(
  p: Vec3,
  basis: ViewBasis,
  scale: number,
  stageW: number,
  stageH: number,
): ProjectedPrismPoint {
  return {
    x: stageW / 2 + dot(p, basis.right) * scale,
    y: stageH / 2 - dot(p, basis.up) * scale,
    depth: dot(p, basis.eye),
  };
}

export function polygonPoints(points: readonly ProjectedPrismPoint[]): string {
  return points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}

export { normalizeView, viewBasis };
export type { ViewBasis, XrayViewAngle };

/** 지금 입체에 있는 요소 id인가. */
export function isPrismElementId(
  kind: 'face' | 'edge' | 'vertex',
  id: string,
  solid: PrismModel,
): boolean {
  const list = kind === 'face' ? solid.faces : kind === 'edge' ? solid.edges : solid.vertices;
  return list.some((e) => e.id === id);
}
