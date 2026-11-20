/**
 * E14 time-calc 설정 검사·정리. 값은 모두 정수라 부동소수가 끼지 않는다.
 * 분·초는 60 미만(정규형)이어야 하고, 큰 단위 블록은 어느 상태에서든 9개를 넘지 않는다.
 */
import { E14_MODE_STRINGS } from '../strings-modes.ko';
import type { BigSmall, TimeCalcConfig, TimeCalcState, UnitPair } from './types';

const S = E14_MODE_STRINGS.timeCalc;

/** 큰 단위 블록 한 줄에 그릴 수 있는 한계(3칸 × 3줄). */
export const MAX_BIG = 9;
export const BASE = 60;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonNegativeInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/** 설정이 `mode`뿐이면 샌드박스 기본(1시간 45분 + 30분)을 쓴다. */
export function sandboxDefault(): TimeCalcConfig {
  return {
    mode: 'time-calc',
    op: 'add',
    a: { h: 1, m: 45, s: 0 },
    b: { h: 0, m: 30, s: 0 },
    units: ['h', 'm'],
  };
}

function failure(): TimeCalcState {
  return {
    mode: 'time-calc',
    error: S.configError,
    op: 'add',
    units: 'hm',
    b: { big: 0, small: 0 },
    bText: '',
    initial: { big: 0, small: 0 },
    big: 0,
    small: 0,
    maxBig: 1,
    bundles: 0,
    unbundles: 0,
    tookAway: false,
    moves: 0,
  };
}

function unitsOf(value: unknown): UnitPair | null {
  if (!Array.isArray(value) || value.length !== 2) return null;
  if (value[0] === 'h' && value[1] === 'm') return 'hm';
  if (value[0] === 'm' && value[1] === 's') return 'ms';
  return null;
}

/** {h,m,s}를 (큰 단위, 작은 단위)로. 쓰지 않는 단위가 0이 아니거나, 분·초가 60 이상이면 null. */
function readParts(value: unknown, units: UnitPair): BigSmall | null {
  if (!isRecord(value)) return null;
  for (const key of Object.keys(value)) if (key !== 'h' && key !== 'm' && key !== 's') return null;
  const part = (key: string): number | null => {
    const raw = value[key];
    if (raw === undefined) return 0;
    return nonNegativeInt(raw) ? raw : null;
  };
  const h = part('h');
  const m = part('m');
  const s = part('s');
  if (h === null || m === null || s === null) return null;
  if (m >= BASE || s >= BASE) return null;
  if (units === 'hm') return s === 0 ? { big: h, small: m } : null;
  return h === 0 ? { big: m, small: s } : null;
}

export function normalizeTimeCalc(config: TimeCalcConfig): TimeCalcState {
  const source: unknown =
    isRecord(config) && Object.keys(config).every((key) => key === 'mode')
      ? sandboxDefault()
      : config;
  if (!isRecord(source)) return failure();
  const op = source['op'];
  if (op !== 'add' && op !== 'sub') return failure();
  const units = unitsOf(source['units']);
  if (units === null) return failure();
  const a = readParts(source['a'], units);
  const b = readParts(source['b'], units);
  if (a === null || b === null) return failure();
  if (op === 'sub' && a.big * BASE + a.small < b.big * BASE + b.small) return failure();
  // add는 두 시간의 칸을 처음부터 한 줄에 합쳐 놓는다(정규화 전: 1시간 75분).
  const initial: BigSmall =
    op === 'add'
      ? { big: a.big + b.big, small: a.small + b.small }
      : { big: a.big, small: a.small };
  const maxBig = initial.big + (op === 'add' ? Math.floor(initial.small / BASE) : 0);
  if (maxBig > MAX_BIG) return failure();
  return {
    mode: 'time-calc',
    error: null,
    op,
    units,
    b,
    bText: op === 'sub' ? S.units[units].format(b.big, b.small) : '',
    initial,
    ...initial,
    maxBig: Math.max(1, maxBig),
    bundles: 0,
    unbundles: 0,
    tookAway: false,
    moves: 0,
  };
}

/** 작은 단위 칸을 10개 막대(rods)와 낱개(singles)로 나눈다. */
export function splitSmall(small: number): { rods: number; singles: number } {
  return { rods: Math.floor(small / 10), singles: small % 10 };
}
