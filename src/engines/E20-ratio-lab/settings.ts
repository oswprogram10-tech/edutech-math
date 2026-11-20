/** E20 설정 검사·정리. 잘못된 설정은 error 문구와 함께 안전한 기본 상태로 돌려준다. */
import { defaultStripMax } from './observe';
import { E20_STRINGS as S } from './strings.ko';
import {
  DEFAULT_BASE,
  DEFAULT_MAX_DISTANCE,
  DEFAULT_MAX_EACH,
  DEFAULT_MAX_SIZE,
  DEFAULT_MAX_TIME,
  DEFAULT_REFERENCE,
  MAX_EACH_LIMIT,
  MAX_FIXED_CUPS,
  PERCENT_CELLS,
} from './types';
import type {
  Amounts,
  FixedCup,
  MixConfig,
  MixState,
  PercentConfig,
  PercentState,
  RacerConfig,
  RacerState,
  RateConfig,
  RateState,
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

// ───────────── rate ─────────────

const DEFAULT_RACERS: readonly RacerConfig[] = [
  { id: 'rabbit', name: '토끼', distance: 120, time: 20, editable: true },
  { id: 'turtle', name: '거북', distance: 200, time: 40, editable: true },
];

function rateFallback(error: string | null): RateState {
  return {
    mode: 'rate',
    error,
    settings: {
      predictFirst: false,
      maxDistance: DEFAULT_MAX_DISTANCE,
      maxTime: DEFAULT_MAX_TIME,
      look: 'race',
    },
    racers: [],
    initialRacers: [],
    prediction: null,
    distanceOnly: false,
    runs: 0,
  };
}

function racerOf(
  raw: unknown,
  index: number,
  maxDistance: number,
  maxTime: number,
): RacerState | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { id, name, distance, time, editable } = raw as Record<string, unknown>;
  const racerId = id === undefined ? `racer-${index + 1}` : id;
  if (typeof racerId !== 'string' || racerId === '') return null;
  if (typeof name !== 'string' || name === '') return null;
  if (distance !== null && !isInt(distance, 1, maxDistance)) return null;
  if (time !== null && !isInt(time, 1, maxTime)) return null;
  if (editable !== undefined && typeof editable !== 'boolean') return null;
  return {
    id: racerId,
    name,
    distance,
    time,
    editDistance: editable === undefined ? distance === null : editable,
    editTime: editable === undefined ? time === null : editable,
  };
}

export function normalizeRate(config: RateConfig): RateState {
  const bad = (): RateState => rateFallback(S.configError);
  const maxDistance = config.maxDistance ?? DEFAULT_MAX_DISTANCE;
  const maxTime = config.maxTime ?? DEFAULT_MAX_TIME;
  if (!isInt(maxDistance, 1, 10000) || !isInt(maxTime, 1, 10000)) return bad();
  const defaulted = config.racers === undefined;
  const predictFirst = config.predictFirst ?? defaulted;
  if (typeof predictFirst !== 'boolean') return bad();
  const look = config.look ?? 'race';
  if (look !== 'race' && look !== 'table') return bad();
  const rawRacers: unknown = defaulted ? DEFAULT_RACERS : config.racers;
  if (!Array.isArray(rawRacers) || rawRacers.length !== 2) return bad();
  const racers: RacerState[] = [];
  for (let i = 0; i < 2; i += 1) {
    const racer = racerOf(rawRacers[i], i, maxDistance, maxTime);
    if (racer === null) return bad();
    racers.push(racer);
  }
  if (racers[0]?.id === racers[1]?.id) return bad();
  return {
    mode: 'rate',
    error: null,
    settings: { predictFirst, maxDistance, maxTime, look },
    racers,
    initialRacers: racers,
    prediction: null,
    distanceOnly: false,
    runs: 0,
  };
}

// ───────────── percent ─────────────

/** 앞에서부터 count칸의 번호. */
export function prefixCells(count: number): number[] {
  return Array.from({ length: count }, (_, i) => i);
}

function percentFallback(error: string | null): PercentState {
  return {
    mode: 'percent',
    error,
    settings: { layout: 'grid', editable: true, showCount: true },
    cells: [],
    initialCells: [],
  };
}

export function normalizePercent(config: PercentConfig): PercentState {
  const bad = (): PercentState => percentFallback(S.configError);
  const layout = config.layout ?? 'grid';
  if (layout !== 'grid' && layout !== 'strip') return bad();
  const shaded = config.shaded ?? 0;
  if (!isInt(shaded, 0, PERCENT_CELLS)) return bad();
  const editable = config.editable ?? true;
  const showCount = config.showCount ?? true;
  if (typeof editable !== 'boolean' || typeof showCount !== 'boolean') return bad();
  const cells = prefixCells(shaded);
  return {
    mode: 'percent',
    error: null,
    settings: { layout, editable, showCount },
    cells,
    initialCells: cells,
  };
}

export function normalizeConfig(config: RatioConfig): RatioState {
  const raw = (config ?? {}) as RatioConfig;
  switch (raw.mode) {
    case 'resize':
      return normalizeResize(raw);
    case 'rate':
      return normalizeRate(raw);
    case 'percent':
      return normalizePercent(raw);
    default:
      return normalizeMix(raw);
  }
}
