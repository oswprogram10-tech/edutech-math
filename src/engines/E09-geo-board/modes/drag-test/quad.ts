/**
 * 사각형 구성(T101). 자유 끌기 대신 매개변수로 정확히 유지한다.
 *
 * - `from-diagonals`: O에서 두 대각선 방향·길이를 표 값으로 정한다.
 * - `quad-conditions`: A에서 AB를 정하고 조건 토글로 C·D를 계산한다.
 * 좌표는 모두 `Rational`이고, 상태에는 정수·표 인덱스만 남긴다.
 */
import { gp, isSimplePolygon, rationalRotate, toSPoint } from '../../../../core/math';
import type { GPoint } from '../../../../core/math';
import { Rational } from '../../../../core/math';
import { S_TABLE, T_HALF, T_INDEX_90, tableRatio, turnT } from '../../rational-turns';
import type {
  ConditionQuadParams,
  DiagonalQuadParams,
  DiagonalToggle,
  DragNode,
  QuadParams,
  QuadToggle,
} from './types';

export const DIAGONAL_TOGGLES: readonly DiagonalToggle[] = [
  'bisect-each-other',
  'equal-length',
  'perpendicular',
];

export const QUAD_TOGGLES: readonly QuadToggle[] = [
  'one-parallel-pair',
  'two-parallel-pairs',
  'equal-sides',
  'right-angle',
];

const S_ONE = 3;

function add(a: GPoint, b: GPoint): GPoint {
  return { x: a.x.add(b.x), y: a.y.add(b.y) };
}

function sub(a: GPoint, b: GPoint): GPoint {
  return { x: a.x.sub(b.x), y: a.y.sub(b.y) };
}

function scale(a: GPoint, factor: Rational): GPoint {
  return { x: a.x.mul(factor), y: a.y.mul(factor) };
}

function inside(point: GPoint, lattice: number): boolean {
  const limit = Rational.of(lattice);
  return (
    point.x.compareTo(Rational.of(0)) >= 0 &&
    point.x.compareTo(limit) <= 0 &&
    point.y.compareTo(Rational.of(0)) >= 0 &&
    point.y.compareTo(limit) <= 0
  );
}

/** 표 인덱스를 범위 안으로 자른다. */
export function clampTableIndex(value: unknown, min = 0, max = 11): number {
  const number = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : min;
  return Math.min(max, Math.max(min, number));
}

/** `from-diagonals`의 기본 모양. 특별한 성질이 없는 사각형이다. */
export function defaultDiagonalParams(): DiagonalQuadParams {
  return { kind: 'from-diagonals', p: [4, 1], t: 4, beta: 5, gamma: 2, delta: 4 };
}

/**
 * `quad-conditions`의 기본 모양. 특별한 성질이 없는 사각형이고,
 * 어떤 조건 토글을 켜도 격자 안의 단순 사각형이 된다(테스트로 고정).
 */
export function defaultConditionParams(lattice = 24): ConditionQuadParams {
  const size = Math.max(4, Math.floor(lattice / 3));
  return {
    kind: 'quad-conditions',
    u: [size, 0],
    t: 4,
    s: 4,
    kappa: 1,
    c: [Math.round(size * 1.4), -Math.max(2, Math.round(size * 0.8))],
  };
}

export function applyDiagonalToggles(
  params: DiagonalQuadParams,
  toggles: readonly DiagonalToggle[],
): DiagonalQuadParams | null {
  let t = params.t;
  let beta = params.beta;
  let gamma = params.gamma;
  let delta = params.delta;
  if (toggles.includes('perpendicular')) t = T_INDEX_90;
  if (toggles.includes('bisect-each-other')) {
    gamma = S_ONE;
    delta = beta;
  }
  if (toggles.includes('equal-length')) {
    if (toggles.includes('bisect-each-other')) {
      beta = S_ONE;
      delta = S_ONE;
    } else {
      // 1 + γ = β + δ. 표는 1/4 간격이라 인덱스로 δ = γ − β + 3이다.
      delta = gamma - beta + S_ONE;
      if (delta < 0 || delta >= S_TABLE.length) return null;
    }
  }
  return { kind: 'from-diagonals', p: params.p, t, beta, gamma, delta };
}

/** 켠 조건을 함의로 닫는다. `equal-sides ⇒ two-parallel-pairs ⇒ one-parallel-pair`. */
export function closeQuadToggles(toggles: readonly QuadToggle[]): QuadToggle[] {
  let one = toggles.includes('one-parallel-pair');
  let two = toggles.includes('two-parallel-pairs');
  let equal = toggles.includes('equal-sides');
  const right = toggles.includes('right-angle');
  if (equal) two = true;
  if (two) one = true;
  if (!one) {
    two = false;
    equal = false;
  }
  if (!two) equal = false;
  const result: QuadToggle[] = [];
  if (one) result.push('one-parallel-pair');
  if (two) result.push('two-parallel-pairs');
  if (equal) result.push('equal-sides');
  if (right) result.push('right-angle');
  return result;
}

/**
 * 조건을 하나 끌 때 함께 꺼야 하는 토글을 뺀다.
 * `two-parallel-pairs`를 끄면 `equal-sides`도 꺼지고, `one-parallel-pair`를 끄면 둘 다 꺼진다.
 */
export function openQuadToggles(toggles: readonly QuadToggle[], removed: QuadToggle): QuadToggle[] {
  const drop = new Set<QuadToggle>([removed]);
  if (removed === 'one-parallel-pair') {
    drop.add('two-parallel-pairs');
    drop.add('equal-sides');
  } else if (removed === 'two-parallel-pairs') {
    drop.add('equal-sides');
  }
  return toggles.filter((toggle) => !drop.has(toggle));
}

export function applyQuadToggles(
  params: ConditionQuadParams,
  toggles: readonly QuadToggle[],
): ConditionQuadParams {
  const closed = closeQuadToggles(toggles);
  let t = params.t;
  let s = params.s;
  if (closed.includes('right-angle')) t = T_INDEX_90;
  if (closed.includes('equal-sides')) s = S_ONE;
  return { ...params, t, s };
}

/** 사각형의 네 꼭짓점. 계산할 수 없으면 null. */
export function quadGeometry(
  params: QuadParams,
  lattice: number,
  toggles: readonly QuadToggle[] = [],
): GPoint[] | null {
  if (params.kind === 'from-diagonals') {
    const center = gp(Math.round(lattice / 2), Math.round(lattice / 2));
    const p = gp(params.p[0], params.p[1]);
    const rotation = rationalRotate(p, turnT(params.t));
    const a = add(center, p);
    const c = add(center, scale(p, tableRatio(params.gamma).neg()));
    const b = add(center, scale(rotation, tableRatio(params.beta)));
    const d = add(center, scale(rotation, tableRatio(params.delta).neg()));
    return [a, b, c, d];
  }

  const a = gp(Math.floor(lattice / 4), Math.floor((lattice * 3) / 4));
  const u = gp(params.u[0], params.u[1]);
  const rotation = rationalRotate(u, turnT(params.t).neg());
  const d = add(a, scale(rotation, tableRatio(params.s)));
  const b = add(a, u);
  const closed = closeQuadToggles(toggles);
  let c: GPoint;
  if (closed.includes('two-parallel-pairs')) {
    c = add(b, sub(d, a));
  } else if (closed.includes('one-parallel-pair')) {
    c = add(d, scale(u, tableRatio(params.kappa)));
  } else {
    c = add(a, gp(params.c[0], params.c[1]));
  }
  return [a, b, c, d];
}

/** 조건을 적용한 뒤 격자 안의 단순 사각형인지. */
export function validQuad(
  params: QuadParams,
  lattice: number,
  toggles: readonly QuadToggle[],
): boolean {
  const points = quadGeometry(params, lattice, toggles);
  if (!points) return false;
  if (!points.every((point) => inside(point, lattice))) return false;
  return isSimplePolygon(points) && quadAreaNonZero(points);
}

function quadAreaNonZero(points: readonly GPoint[]): boolean {
  let total = Rational.of(0);
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    if (!current || !next) return false;
    total = total.add(current.x.mul(next.y).sub(current.y.mul(next.x)));
  }
  return !total.isZero();
}

/** 사각형 꼭짓점을 자유점 4개와 선분 4개로 만든다. */
export function quadNodes(
  params: QuadParams,
  lattice: number,
  toggles: readonly QuadToggle[],
  startId: number,
): { readonly nodes: DragNode[]; readonly nextId: number } | null {
  const points = quadGeometry(params, lattice, toggles);
  if (!points) return null;
  const labels = ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ'];
  const nodes: DragNode[] = [];
  let nextId = startId;
  const pointIds: string[] = [];
  points.forEach((point, index) => {
    const id = `n${nextId}`;
    nextId += 1;
    pointIds.push(id);
    const at = [
      Math.min(lattice, Math.max(0, Math.round(Number(point.x.n) / Number(point.x.d)))),
      Math.min(lattice, Math.max(0, Math.round(Number(point.y.n) / Number(point.y.d)))),
    ] as const;
    nodes.push({
      id,
      kind: 'free',
      label: labels[index] ?? '?',
      at,
      exact: [point.x.toString(), point.y.toString()],
    });
  });
  for (let index = 0; index < pointIds.length; index += 1) {
    const a = pointIds[index];
    const b = pointIds[(index + 1) % pointIds.length];
    if (!a || !b) continue;
    nodes.push({ id: `n${nextId}`, kind: 'segment', a, b });
    nextId += 1;
  }
  return { nodes, nextId };
}

/** 화면 표시용 꼭짓점(정확한 유리수). */
export function quadSPoints(
  params: QuadParams,
  lattice: number,
  toggles: readonly QuadToggle[] = [],
): ReturnType<typeof toSPoint>[] | null {
  const points = quadGeometry(params, lattice, toggles);
  if (!points) return null;
  return points.map(toSPoint);
}

/** 상태의 사각형 매개변수를 조건과 함께 정규화한다. */
export function normalizeQuad(
  params: QuadParams,
  toggles: readonly (QuadToggle | DiagonalToggle)[],
  construction: 'free' | 'from-diagonals' | 'quad-conditions',
): QuadParams | null {
  if (construction === 'from-diagonals' && params.kind === 'from-diagonals') {
    return applyDiagonalToggles(params, toggles as readonly DiagonalToggle[]);
  }
  if (construction === 'quad-conditions' && params.kind === 'quad-conditions') {
    return applyQuadToggles(params, toggles as readonly QuadToggle[]);
  }
  return params;
}

/** 조건 없이 표 범위만 검사한다. */
export function sanitizeQuadValue(
  params: QuadParams,
  param: string,
  value: number | readonly [number, number],
): QuadParams | null {
  if (params.kind === 'from-diagonals') {
    if (param === 'p') {
      if (!Array.isArray(value) || value.length < 2) return null;
      const [i, j] = value;
      if (typeof i !== 'number' || typeof j !== 'number') return null;
      if (!Number.isInteger(i) || !Number.isInteger(j)) return null;
      if (Math.abs(i) > 6 || Math.abs(j) > 6 || i * i + j * j < 4) return null;
      return { ...params, p: [i, j] };
    }
    if (typeof value !== 'number' || !Number.isInteger(value)) return null;
    if (param === 't') {
      if (value < 1 || value > 23) return null;
      return { ...params, t: value };
    }
    if (param === 'beta' || param === 'gamma' || param === 'delta') {
      if (value < 0 || value >= S_TABLE.length) return null;
      return { ...params, [param]: value };
    }
    return null;
  }

  if (params.kind !== 'quad-conditions') return null;
  if (param === 'u') {
    if (!Array.isArray(value) || value.length < 2) return null;
    const [i, j] = value;
    if (typeof i !== 'number' || typeof j !== 'number') return null;
    if (!Number.isInteger(i) || !Number.isInteger(j)) return null;
    if (Math.abs(i) > 12 || Math.abs(j) > 12 || i * i + j * j < 4) return null;
    return { ...params, u: [i, j] };
  }
  if (param === 'c') {
    if (!Array.isArray(value) || value.length < 2) return null;
    const [i, j] = value;
    if (typeof i !== 'number' || typeof j !== 'number') return null;
    if (!Number.isInteger(i) || !Number.isInteger(j)) return null;
    return { ...params, c: [i, j] };
  }
  if (typeof value !== 'number' || !Number.isInteger(value)) return null;
  if (param === 't') {
    if (value < 2 || value > 22) return null;
    return { ...params, t: value };
  }
  if (param === 's' || param === 'kappa') {
    if (value < 0 || value >= S_TABLE.length) return null;
    return { ...params, [param]: value };
  }
  return null;
}

/** 사각형 매개변수가 표 범위 안인지. */
export function quadParamsValid(params: QuadParams): boolean {
  if (params.kind === 'from-diagonals') {
    return (
      Number.isInteger(params.p[0]) &&
      Number.isInteger(params.p[1]) &&
      params.t >= 0 &&
      params.t < T_HALF.length &&
      params.beta >= 0 &&
      params.beta < S_TABLE.length &&
      params.gamma >= 0 &&
      params.gamma < S_TABLE.length &&
      params.delta >= 0 &&
      params.delta < S_TABLE.length
    );
  }
  return (
    Number.isInteger(params.u[0]) &&
    Number.isInteger(params.u[1]) &&
    Number.isInteger(params.c[0]) &&
    Number.isInteger(params.c[1]) &&
    params.t >= 0 &&
    params.t < T_HALF.length &&
    params.s >= 0 &&
    params.s < S_TABLE.length &&
    params.kappa >= 0 &&
    params.kappa < S_TABLE.length
  );
}
