/** E19 설정 검사·정리. 잘못된 설정은 error 문구와 함께 안전한 기본 상태로 돌려준다. */
import { Rational } from '../../core/math';
import { E19_STRINGS as S } from './strings.ko';
import {
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
  LevelingConfig,
  LevelingState,
  OutlierConfig,
  SeesawConfig,
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

function commonOf(config: ChanceConfig): Common | null {
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

export function normalizeConfig(config: ChanceConfig): ChanceState {
  const raw = (config ?? {}) as ChanceConfig;
  if (raw.mode === 'seesaw') return normalizeSeesaw(raw);
  if (raw.mode === 'outlier') return normalizeOutlier(raw);
  return normalizeLeveling(raw);
}
