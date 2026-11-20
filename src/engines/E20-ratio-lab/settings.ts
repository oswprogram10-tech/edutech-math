/** E20 설정 검사·정리. 잘못된 설정은 error 문구와 함께 안전한 기본 상태로 돌려준다. */
import { defaultStripMax } from './observe';
import { E20_STRINGS as S } from './strings.ko';
import {
  DEFAULT_BASE,
  DEFAULT_MAX_EACH,
  DEFAULT_MAX_SIZE,
  DEFAULT_REFERENCE,
  MAX_EACH_LIMIT,
  MAX_FIXED_CUPS,
} from './types';
import type {
  Amounts,
  FixedCup,
  MixConfig,
  MixState,
  RatioConfig,
  RatioState,
  ResizeConfig,
  ResizeState,
  Size,
} from './types';

export function isInt(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

function factorsOf(raw: unknown): number[] | null {
  if (raw === undefined) return [2, 3];
  if (!Array.isArray(raw) || raw.length > 4) return null;
  const list: number[] = [];
  for (const k of raw) {
    if (!isInt(k, 2, 10) || list.includes(k)) return null;
    list.push(k);
  }
  return list;
}

function amountsOf(raw: unknown, limit: number): Amounts | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { milk, syrup } = raw as { milk?: unknown; syrup?: unknown };
  if (!isInt(milk, 0, limit) || !isInt(syrup, 0, limit)) return null;
  return { milk, syrup };
}

function mixFallback(error: string | null): MixState {
  return {
    mode: 'mix',
    error,
    settings: {
      look: 'blocks',
      showStrip: true,
      stripMax: 0.5,
      scaleFactors: [2, 3],
      maxEach: DEFAULT_MAX_EACH,
      hasCup: true,
    },
    reference: DEFAULT_REFERENCE,
    fixedCups: [],
    cup: { milk: 0, syrup: 0 },
    initialCup: { milk: 0, syrup: 0 },
    addOps: 0,
    scaleOps: 0,
  };
}

export function normalizeMix(config: MixConfig): MixState {
  const bad = (): MixState => mixFallback(S.configError);
  const look = config.look ?? 'blocks';
  if (look !== 'blocks' && look !== 'strip' && look !== 'ratio') return bad();
  const showStrip = config.showStrip ?? true;
  if (typeof showStrip !== 'boolean') return bad();
  const scaleFactors = factorsOf(config.scaleFactors);
  if (scaleFactors === null) return bad();

  const make = config.make === undefined ? {} : config.make;
  const hasCup = make !== null;
  const makeObject = make ?? {};
  const maxEach = makeObject.maxEach ?? DEFAULT_MAX_EACH;
  if (!isInt(maxEach, 1, MAX_EACH_LIMIT)) return bad();
  const cup = hasCup
    ? amountsOf({ milk: makeObject.milk ?? 0, syrup: makeObject.syrup ?? 0 }, maxEach)
    : { milk: 0, syrup: 0 };
  if (cup === null) return bad();

  let reference: Amounts | null;
  if (config.reference === undefined) reference = DEFAULT_REFERENCE;
  else if (config.reference === null) reference = null;
  else {
    reference = amountsOf(config.reference, MAX_EACH_LIMIT);
    if (reference === null || reference.milk + reference.syrup === 0) return bad();
  }

  const rawFixed = config.fixedCups ?? [];
  if (!Array.isArray(rawFixed) || rawFixed.length > MAX_FIXED_CUPS) return bad();
  const fixedCups: FixedCup[] = [];
  for (const item of rawFixed) {
    const amounts = amountsOf(item, MAX_EACH_LIMIT);
    const { id, label } = (item ?? {}) as { id?: unknown; label?: unknown };
    if (amounts === null || amounts.milk + amounts.syrup === 0) return bad();
    if (typeof id !== 'string' || id === '' || typeof label !== 'string' || label === '') {
      return bad();
    }
    if (fixedCups.some((c) => c.id === id)) return bad();
    fixedCups.push({ id, label, ...amounts });
  }

  let stripMax: number;
  if (config.stripMax === undefined) {
    stripMax = defaultStripMax([...(reference === null ? [] : [reference]), ...fixedCups]);
  } else {
    stripMax = config.stripMax;
    if (typeof stripMax !== 'number' || !(stripMax > 0 && stripMax <= 1)) return bad();
  }

  return {
    mode: 'mix',
    error: null,
    settings: { look, showStrip, stripMax, scaleFactors, maxEach, hasCup },
    reference,
    fixedCups,
    cup,
    initialCup: cup,
    addOps: 0,
    scaleOps: 0,
  };
}

function resizeFallback(error: string | null): ResizeState {
  return {
    mode: 'resize',
    error,
    settings: {
      addStep: 2,
      scaleFactors: [2, 3],
      max: DEFAULT_MAX_SIZE,
      showVerdict: true,
      look: 'picture',
    },
    base: DEFAULT_BASE,
    size: DEFAULT_BASE,
    saved: [],
    addOps: 0,
    scaleOps: 0,
  };
}

export function normalizeResize(config: ResizeConfig): ResizeState {
  const bad = (): ResizeState => resizeFallback(S.configError);
  const max = config.max ?? DEFAULT_MAX_SIZE;
  if (!isInt(max, 2, 60)) return bad();
  const base: Size = config.base ?? DEFAULT_BASE;
  if (typeof base !== 'object' || base === null) return bad();
  if (!isInt(base.w, 1, max) || !isInt(base.h, 1, max)) return bad();
  const addStep = config.addStep ?? 2;
  if (!isInt(addStep, 1, 10)) return bad();
  const scaleFactors = factorsOf(config.scaleFactors);
  if (scaleFactors === null) return bad();
  const showVerdict = config.showVerdict ?? true;
  if (typeof showVerdict !== 'boolean') return bad();
  const look = config.look ?? 'picture';
  if (look !== 'picture' && look !== 'table') return bad();
  return {
    mode: 'resize',
    error: null,
    settings: { addStep, scaleFactors, max, showVerdict, look },
    base: { w: base.w, h: base.h },
    size: { w: base.w, h: base.h },
    saved: [],
    addOps: 0,
    scaleOps: 0,
  };
}

export function normalizeConfig(config: RatioConfig): RatioState {
  const raw = (config ?? {}) as RatioConfig;
  return raw.mode === 'resize' ? normalizeResize(raw) : normalizeMix(raw);
}
