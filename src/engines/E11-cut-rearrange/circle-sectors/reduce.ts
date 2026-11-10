/** circle-sectors의 순수 reducer. 등분 수·칸 배열만 다룬다. */
import { Rational } from '../../../core/math';
import type {
  CircleDimensionMode,
  CircleSectorsAction,
  CircleSectorsConfig,
  CircleSectorsSettings,
  CircleSectorsState,
  CircleSlot,
} from './types';

const DEFAULT_DIVISIONS = [8, 16, 32, 64, 128, 256] as const;

function rationalSetting(
  value: unknown,
  fallback: string,
  min: Rational,
  max: Rational,
  minExclusive: boolean,
): string {
  try {
    const parsed = Rational.parse(String(value));
    const belowMin = minExclusive ? parsed.compareTo(min) <= 0 : parsed.compareTo(min) < 0;
    if (belowMin || parsed.compareTo(max) > 0) return fallback;
    return parsed.toString();
  } catch {
    return fallback;
  }
}

function divisionsOf(value: unknown): number[] {
  if (!Array.isArray(value)) return [...DEFAULT_DIVISIONS];
  const result: number[] = [];
  for (const item of value) {
    if (typeof item !== 'number' || !Number.isInteger(item)) continue;
    if (item < 4 || item > 256 || item % 2 !== 0) continue;
    if (!result.includes(item)) result.push(item);
  }
  result.sort((a, b) => a - b);
  return result.length > 0 ? result : [...DEFAULT_DIVISIONS];
}

function manualOf(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 8;
  return Math.max(4, Math.min(16, Math.round(value)));
}

function dimensionsOf(value: unknown): CircleDimensionMode {
  if (value === 'named') return 'named';
  if (value === true || value === 'lines') return 'lines';
  return 'off';
}

export function circleSettings(config: CircleSectorsConfig): CircleSectorsSettings {
  return {
    radius: rationalSetting(config.radius, '5', Rational.of(0), Rational.of(100), true),
    pi: rationalSetting(config.pi, '3.14', Rational.of(3), Rational.of(4), false),
    divisions: divisionsOf(config.divisions),
    manualUpTo: manualOf(config.manualUpTo),
    showDimensions: dimensionsOf(config.showDimensions),
  };
}

export function currentDivisions(state: CircleSectorsState): number {
  return state.settings.divisions[state.level] ?? state.settings.divisions[0] ?? 8;
}

export function isManual(state: CircleSectorsState): boolean {
  return currentDivisions(state) <= state.settings.manualUpTo;
}

export function alternating(state: CircleSectorsState): boolean {
  const n = currentDivisions(state);
  if (state.slots.length !== n || n < 4) return false;
  for (let index = 0; index < n; index += 1) {
    const current = state.slots[index];
    const next = state.slots[(index + 1) % n];
    if (!current || !next) return false;
    if (current.arcUp === next.arcUp) return false;
  }
  return true;
}

export function arranged(state: CircleSectorsState): boolean {
  return isManual(state) ? alternating(state) : state.autoArranged;
}

function addArranged(state: CircleSectorsState): CircleSectorsState {
  if (!arranged(state)) return state;
  const n = currentDivisions(state);
  if (state.arrangedDivisions.includes(n)) return state;
  return {
    ...state,
    arrangedDivisions: [...state.arrangedDivisions, n].sort((a, b) => a - b),
  };
}

export function createCircleSectorsState(config: CircleSectorsConfig): CircleSectorsState {
  const settings = circleSettings(config);
  const level = 0;
  const n = settings.divisions[level] ?? 8;
  return {
    mode: 'circle-sectors',
    level,
    slots: Array.from({ length: n }, () => null),
    autoArranged: false,
    arrangedDivisions: [],
    settings,
  };
}

function setLevel(state: CircleSectorsState, level: number): CircleSectorsState {
  if (!Number.isInteger(level) || level < 0 || level >= state.settings.divisions.length)
    return state;
  const n = state.settings.divisions[level] ?? 8;
  return {
    ...state,
    level,
    slots: Array.from({ length: n }, () => null),
    autoArranged: false,
  };
}

function placeSector(
  state: CircleSectorsState,
  action: Extract<CircleSectorsAction, { type: 'place-sector' }>,
): CircleSectorsState {
  if (!isManual(state)) return state;
  const n = currentDivisions(state);
  if (!Number.isInteger(action.sector) || action.sector < 0 || action.sector >= n) return state;
  if (!Number.isInteger(action.slot) || action.slot < 0 || action.slot >= n) return state;
  const slots: (CircleSlot | null)[] = Array.from(
    { length: n },
    (_, index) => state.slots[index] ?? null,
  );
  const occupant = slots[action.slot];
  if (occupant && occupant.sector !== action.sector) return state;
  for (let index = 0; index < n; index += 1) {
    if (slots[index]?.sector === action.sector) slots[index] = null;
  }
  slots[action.slot] = { sector: action.sector, arcUp: action.arcUp };
  return addArranged({ ...state, slots });
}

function unplaceSector(
  state: CircleSectorsState,
  action: Extract<CircleSectorsAction, { type: 'unplace-sector' }>,
): CircleSectorsState {
  if (!isManual(state)) return state;
  const slots = state.slots.map((slot) => (slot?.sector === action.sector ? null : slot));
  return { ...state, slots };
}

function autoArrange(state: CircleSectorsState): CircleSectorsState {
  if (isManual(state)) return state;
  return addArranged({ ...state, autoArranged: true });
}

export function reduceCircleSectors(
  state: CircleSectorsState,
  action: CircleSectorsAction,
): CircleSectorsState {
  switch (action.type) {
    case 'set-level':
      return setLevel(state, action.level);
    case 'place-sector':
      return placeSector(state, action);
    case 'unplace-sector':
      return unplaceSector(state, action);
    case 'auto-arrange':
      return autoArrange(state);
    default:
      return state;
  }
}

export { DEFAULT_DIVISIONS };
