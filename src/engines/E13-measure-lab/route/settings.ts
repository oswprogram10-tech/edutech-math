/**
 * E13 map-route 설정 검사·정리와 경로 계산. 길이는 모두 정수 m라 부동소수가 끼지 않는다.
 * bestDiff는 지도의 단순 경로(같은 노드를 두 번 지나지 않는 경로)를 모두 훑어 구한다.
 */
import { E13_STRINGS as S } from '../strings.ko';
import { DEFAULT_MAP, MAPS } from './maps';
import type { RouteConfig, RouteSegment, RouteState } from './types';

const MAX_SEGMENT_M = 9999;
const MAX_TARGET_M = 99999;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function positiveInt(value: unknown, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= max;
}

/** 설정이 `mode`뿐이면 샌드박스 기본(명세 예시의 세 구간, 출발·도착 없음)을 쓴다. */
export function sandboxDefault(): RouteConfig {
  return {
    mode: 'map-route',
    map: DEFAULT_MAP,
    segmentsM: { 'school-library': 450, 'library-park': 620, 'school-park': 980 },
    targetM: 1000,
  };
}

function failure(): RouteState {
  return {
    mode: 'map-route',
    error: S.configError,
    map: DEFAULT_MAP,
    segments: [],
    from: null,
    to: null,
    targetM: 1000,
    path: [],
    used: [],
    moves: 0,
  };
}

export function normalizeRoute(config: RouteConfig): RouteState {
  const source: unknown =
    isRecord(config) && Object.keys(config).every((key) => key === 'mode')
      ? sandboxDefault()
      : config;
  if (!isRecord(source)) return failure();
  const mapName = source['map'] === undefined ? DEFAULT_MAP : source['map'];
  if (typeof mapName !== 'string') return failure();
  const map = MAPS[mapName];
  if (map === undefined) return failure();
  const raw = source['segmentsM'];
  if (!isRecord(raw)) return failure();

  const segments: RouteSegment[] = [];
  const pairs = new Set<string>();
  for (const [key, value] of Object.entries(raw)) {
    const parts = key.split('-');
    const a = parts[0];
    const b = parts[1];
    if (parts.length !== 2 || a === undefined || b === undefined || a === b) return failure();
    if (map.nodes[a] === undefined || map.nodes[b] === undefined) return failure();
    if (!positiveInt(value, MAX_SEGMENT_M)) return failure();
    const pair = [a, b].sort().join('|');
    if (pairs.has(pair)) return failure();
    pairs.add(pair);
    segments.push({ key, a, b, m: value });
  }
  if (segments.length === 0) return failure();

  const touched = (node: string) => segments.some((seg) => seg.a === node || seg.b === node);
  const endpoint = (value: unknown): string | null | undefined => {
    if (value === undefined) return null;
    if (typeof value !== 'string' || map.nodes[value] === undefined || !touched(value)) {
      return undefined;
    }
    return value;
  };
  const from = endpoint(source['from']);
  const to = endpoint(source['to']);
  if (from === undefined || to === undefined) return failure();
  if (from !== null && from === to) return failure();

  const target = source['targetM'] === undefined ? 1000 : source['targetM'];
  if (!positiveInt(target, MAX_TARGET_M)) return failure();

  return {
    mode: 'map-route',
    error: null,
    map: mapName,
    segments,
    from,
    to,
    targetM: target,
    path: from === null ? [] : [from],
    used: [],
    moves: 0,
  };
}

/** 처음 경로(from이 있으면 거기서 시작). reset이 되돌아가는 자리. */
export function initialPath(state: Pick<RouteState, 'from'>): readonly string[] {
  return state.from === null ? [] : [state.from];
}

export function segmentByKey(
  state: Pick<RouteState, 'segments'>,
  key: string,
): RouteSegment | undefined {
  return state.segments.find((seg) => seg.key === key);
}

/** 경로에 붙은 구간 길이의 합(m). */
export function totalOf(state: Pick<RouteState, 'segments' | 'used'>): number {
  return state.used.reduce((sum, key) => sum + (segmentByKey(state, key)?.m ?? 0), 0);
}

/** 구간 끝에서 반대쪽 노드. 이 구간에 닿지 않으면 null. */
export function otherEnd(segment: RouteSegment, node: string): string | null {
  if (segment.a === node) return segment.b;
  if (segment.b === node) return segment.a;
  return null;
}

/**
 * 조건에 맞는 단순 경로(구간 1개 이상)의 |합 − targetM| 중 최솟값.
 * from이 있으면 거기서 시작하는 경로만, to가 있으면 거기서 끝나는 경로만 센다. 경로가 없으면 null.
 */
export function bestDiffOf(
  state: Pick<RouteState, 'segments' | 'from' | 'to' | 'targetM'>,
): number | null {
  let best: number | null = null;
  const nodes = new Set<string>();
  for (const seg of state.segments) {
    nodes.add(seg.a);
    nodes.add(seg.b);
  }
  const walk = (node: string, visited: ReadonlySet<string>, sum: number, steps: number): void => {
    if (steps > 0 && (state.to === null || node === state.to)) {
      const diff = Math.abs(sum - state.targetM);
      if (best === null || diff < best) best = diff;
    }
    for (const seg of state.segments) {
      const next = otherEnd(seg, node);
      if (next === null || visited.has(next)) continue;
      walk(next, new Set([...visited, next]), sum + seg.m, steps + 1);
    }
  };
  for (const start of nodes) {
    if (state.from !== null && start !== state.from) continue;
    walk(start, new Set([start]), 0, 0);
  }
  return best;
}
