/** E19 설정 검사·정리. 잘못된 설정은 error 문구와 함께 안전한 기본 상태로 돌려준다. */
import { Rational } from '../../core/math';
import { E19_STRINGS as S } from './strings.ko';
import { emptyCounts, totalOf } from './device';
import {
  MAX_BATCHES,
  MAX_BATCH_SIZE,
  MAX_MARBLES,
  MAX_MARBLES_PER_COLOR,
  MAX_SECTORS,
  MAX_SECTOR_SIZE,
  MAX_WORD_CARDS,
  OUTCOMES,
  DEFAULT_DATA,
  DEFAULT_DRAG_INDEX,
  MAX_AXIS,
  MAX_COUNT,
  MAX_LEVEL_HEIGHT,
  MAX_VALUE,
  MIN_COUNT,
} from './types';
import type {
  ChanceConfig,
  ChanceState,
  Device,
  LevelingConfig,
  LevelingState,
  Outcome,
  OutlierConfig,
  SeesawConfig,
  SimulateConfig,
  SpinnerConfig,
  WordsConfig,
} from './types';

export function isInt(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

/** 문자열 Rational을 읽는다. 읽을 수 없으면 null. */
export function parseRational(value: unknown): Rational | null {
  if (typeof value !== 'string') return null;
  try {
    return Rational.parse(value.trim());
  } catch {
    return null;
  }
}

interface Common {
  readonly data: readonly number[];
  readonly label: string;
  readonly names: readonly string[];
  /** 자료를 생략해 샌드박스 기본값을 썼는가. */
  readonly sample: boolean;
}

function commonOf(config: LevelingConfig | SeesawConfig | OutlierConfig): Common | null {
  const sample = config.data === undefined;
  const data = config.data ?? [...DEFAULT_DATA];
  if (!Array.isArray(data) || data.length < MIN_COUNT || data.length > MAX_COUNT) return null;
  for (const value of data) if (!isInt(value, 0, MAX_VALUE)) return null;
  const label = config.label ?? '';
  if (typeof label !== 'string') return null;
  let names: string[];
  if (config.names === undefined) names = data.map((_, i) => S.defaultName(i));
  else {
    if (!Array.isArray(config.names) || config.names.length !== data.length) return null;
    if (config.names.some((n) => typeof n !== 'string' || n === '')) return null;
    names = [...config.names];
  }
  return { data: [...data], label, names, sample };
}

function fallback(error: string): LevelingState {
  return {
    mode: 'leveling',
    error,
    label: '',
    names: DEFAULT_DATA.map((_, i) => S.defaultName(i)),
    data: [...DEFAULT_DATA],
    maxHeight: 11,
    heights: [...DEFAULT_DATA],
    moves: 0,
  };
}

export function normalizeLeveling(config: LevelingConfig): ChanceState {
  const common = commonOf(config);
  if (common === null) return fallback(S.configError);
  const maxData = Math.max(...common.data);
  const maxHeight = config.maxHeight ?? maxData + 2;
  if (!isInt(maxHeight, Math.max(maxData, 1), MAX_LEVEL_HEIGHT)) return fallback(S.configError);
  const sum = common.data.reduce((a, b) => a + b, 0);
  // 블록을 쪼개지 않으므로 합이 자료 수로 나누어떨어져야 한다.
  if (sum % common.data.length !== 0) return fallback(S.configErrorDivide);
  return {
    mode: 'leveling',
    error: null,
    label: common.label,
    names: common.names,
    data: common.data,
    maxHeight,
    heights: [...common.data],
    moves: 0,
  };
}

export function normalizeSeesaw(config: SeesawConfig): ChanceState {
  const common = commonOf(config);
  if (common === null) return fallback(S.configError);
  const min = config.min ?? Math.min(...common.data) - 1;
  const max = config.max ?? Math.max(...common.data) + 1;
  if (!isInt(min, -1, MAX_AXIS) || !isInt(max, 1, MAX_AXIS) || max <= min) {
    return fallback(S.configError);
  }
  if (Math.min(...common.data) < min || Math.max(...common.data) > max) {
    return fallback(S.configError);
  }
  const step = parseRational(config.step ?? '1');
  if (step === null || step.isNegative() || step.isZero()) return fallback(S.configError);
  const grid = Rational.of(max - min).div(step);
  if (!grid.isInteger() || grid.compareTo(Rational.of(400)) > 0) return fallback(S.configError);
  return {
    mode: 'seesaw',
    error: null,
    label: common.label,
    names: common.names,
    data: common.data,
    min,
    max,
    step: step.toString(),
    fulcrum: Rational.of(min).toString(),
    moves: 0,
  };
}

export function normalizeOutlier(config: OutlierConfig): ChanceState {
  const common = commonOf(config);
  if (common === null) return fallback(S.configError);
  const dragIndex = config.dragIndex ?? (common.sample ? DEFAULT_DRAG_INDEX : -1);
  if (!isInt(dragIndex, 0, common.data.length - 1)) return fallback(S.configError);
  const maxData = Math.max(...common.data);
  const min = config.min ?? 0;
  const max = config.max ?? Math.max(maxData * 4, maxData + 1);
  if (!isInt(min, 0, MAX_AXIS) || !isInt(max, 1, MAX_AXIS) || max <= min) {
    return fallback(S.configError);
  }
  if (Math.min(...common.data) < min || maxData > max) return fallback(S.configError);
  const predict = config.predict ?? common.sample;
  if (typeof predict !== 'boolean') return fallback(S.configError);
  return {
    mode: 'outlier',
    error: null,
    label: common.label,
    names: common.names,
    data: common.data,
    min,
    max,
    dragIndex,
    requirePrediction: predict,
    values: [...common.data],
    dragged: false,
    prediction: null,
  };
}

export function isOutcome(value: unknown): value is Outcome {
  return typeof value === 'string' && (OUTCOMES as readonly string[]).includes(value);
}

export const DEFAULT_DEVICE: Device = {
  type: 'spinner',
  sectors: [
    { color: 'red', size: 1 },
    { color: 'blue', size: 1 },
  ],
};

/** 장치 설정을 검사해 정리한다(주머니는 네 색을 모두 가진 목록으로). 잘못이면 null. */
export function normalizeDevice(raw: unknown): Device | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const device = raw as { type?: unknown; sectors?: unknown; marbles?: unknown };
  if (device.type === 'spinner') {
    const sectors = device.sectors;
    if (!Array.isArray(sectors) || sectors.length < 1 || sectors.length > MAX_SECTORS) return null;
    const out: { color: Outcome; size: number }[] = [];
    for (const sector of sectors as unknown[]) {
      if (typeof sector !== 'object' || sector === null) return null;
      const { color, size } = sector as { color?: unknown; size?: unknown };
      if (!isOutcome(color) || !isInt(size, 1, MAX_SECTOR_SIZE)) return null;
      out.push({ color, size });
    }
    return { type: 'spinner', sectors: out };
  }
  if (device.type === 'bag') {
    if (!Array.isArray(device.marbles)) return null;
    const counts = emptyCounts();
    const seen = new Set<string>();
    for (const marble of device.marbles as unknown[]) {
      if (typeof marble !== 'object' || marble === null) return null;
      const { color, count } = marble as { color?: unknown; count?: unknown };
      if (!isOutcome(color) || seen.has(color) || !isInt(count, 0, MAX_MARBLES_PER_COLOR)) {
        return null;
      }
      seen.add(color);
      counts[color] = count;
    }
    const result: Device = {
      type: 'bag',
      marbles: OUTCOMES.map((color) => ({ color, count: counts[color] })),
    };
    const total = totalOf(result);
    return total >= 1 && total <= MAX_MARBLES ? result : null;
  }
  return null;
}

function normalizeWords(config: WordsConfig): ChanceState {
  const cards = config.cards ?? S.words.defaultCards.map((text, i) => ({ id: `c${i + 1}`, text }));
  if (!Array.isArray(cards) || cards.length < 1 || cards.length > MAX_WORD_CARDS) {
    return fallback(S.configError);
  }
  const ids = new Set<string>();
  for (const card of cards) {
    if (typeof card !== 'object' || card === null) return fallback(S.configError);
    if (typeof card.id !== 'string' || card.id === '' || ids.has(card.id)) {
      return fallback(S.configError);
    }
    if (typeof card.text !== 'string' || card.text === '') return fallback(S.configError);
    ids.add(card.id);
  }
  const slots = config.slots ?? 'five';
  if (slots !== 'five' && slots !== 'three') return fallback(S.configError);
  const labels = config.slotLabels ?? 'both';
  if (labels !== 'words' && labels !== 'numbers' && labels !== 'both') {
    return fallback(S.configError);
  }
  return {
    mode: 'words',
    error: null,
    cards: cards.map((c) => ({ id: c.id, text: c.text })),
    slotValues: slots === 'five' ? ['0', '1/4', '1/2', '3/4', '1'] : ['0', '1/2', '1'],
    slotLabels: labels,
    placements: Object.fromEntries(cards.map((c) => [c.id, null])),
  };
}

function normalizeDeviceFields(config: SpinnerConfig | SimulateConfig) {
  const device = config.device === undefined ? DEFAULT_DEVICE : normalizeDevice(config.device);
  const editable = config.editable ?? true;
  if (device === null || typeof editable !== 'boolean') return null;
  return { device, initialDevice: device, editable, edits: 0 };
}

function normalizeSpinner(config: SpinnerConfig): ChanceState {
  const fields = normalizeDeviceFields(config);
  if (fields === null) return fallback(S.configError);
  return {
    mode: 'spinner',
    error: null,
    ...fields,
    trials: 0,
    counts: emptyCounts(),
    last: [],
    lastPick: null,
  };
}

function normalizeSimulate(config: SimulateConfig): ChanceState {
  const fields = normalizeDeviceFields(config);
  if (fields === null) return fallback(S.configError);
  const batches = config.batches ?? [10, 1000, 10000];
  if (!Array.isArray(batches) || batches.length < 1 || batches.length > MAX_BATCHES) {
    return fallback(S.configError);
  }
  for (const batch of batches) if (!isInt(batch, 1, MAX_BATCH_SIZE)) return fallback(S.configError);
  if (new Set(batches).size !== batches.length) return fallback(S.configError);
  const showExpected = config.showExpected ?? true;
  if (typeof showExpected !== 'boolean') return fallback(S.configError);
  return {
    mode: 'simulate',
    error: null,
    ...fields,
    batches: [...batches],
    showExpected,
    results: [],
    runs: 0,
  };
}

export function normalizeConfig(config: ChanceConfig): ChanceState {
  const raw = (config ?? {}) as ChanceConfig;
  if (raw.mode === 'seesaw') return normalizeSeesaw(raw);
  if (raw.mode === 'outlier') return normalizeOutlier(raw);
  if (raw.mode === 'words') return normalizeWords(raw);
  if (raw.mode === 'spinner') return normalizeSpinner(raw);
  if (raw.mode === 'simulate') return normalizeSimulate(raw);
  return normalizeLeveling(raw);
}
