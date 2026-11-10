/** angle 모드의 순수 reducer. 각 크기·읽은 값·어림값은 모두 정수 도다. */
import { clamp } from '../../../../core/engine-sdk';
import type { GeoAction } from '../../types';
import { alignmentFor, normalizeDegrees } from './observe';
import type {
  AngleAction,
  AngleConfig,
  AngleEntry,
  AnglePuzzleSetting,
  AngleSetting,
  AngleSettings,
  AngleState,
} from './types';

function integer(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return clamp(Math.round(value), min, max);
}

function angleValue(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return clamp(Math.round(value), 0, 360);
}

function ratio(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(1, Math.max(0.4, value));
}

function anglesOf(config: AngleConfig): AngleSetting[] {
  const raw = config.angles;
  if (!Array.isArray(raw) || raw.length === 0) {
    return [{ id: 'a1', degrees: 50, base: 0, arms: [1, 1] }];
  }
  const result: AngleSetting[] = [];
  for (const item of raw.slice(0, 6)) {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) continue;
    const record = item as Readonly<Record<string, unknown>>;
    const degrees = integer(record['degrees'], 50, 1, 180);
    const base = Number.isFinite(record['base']) ? normalizeDegrees(record['base'] as number) : 0;
    const rawArms = record['arms'];
    const arms: readonly [number, number] =
      Array.isArray(rawArms) && rawArms.length >= 2
        ? [ratio(rawArms[0], 1), ratio(rawArms[1], 1)]
        : [1, 1];
    const rawId = record['id'];
    const baseId = typeof rawId === 'string' && rawId.length > 0 ? rawId : `a${result.length + 1}`;
    let id = baseId;
    let suffix = 2;
    while (result.some((angle) => angle.id === id)) {
      id = `${baseId}-${suffix}`;
      suffix += 1;
    }
    result.push({ id, degrees, base, arms });
  }
  return result.length > 0 ? result : [{ id: 'a1', degrees: 50, base: 0, arms: [1, 1] }];
}

function puzzleOf(config: AngleConfig): AnglePuzzleSetting | null {
  const raw = config.puzzle;
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  if (raw.type !== 'laser-mirror') return null;
  if (typeof raw.targetAngle !== 'number' || !Number.isFinite(raw.targetAngle)) return null;
  return { type: 'laser-mirror', targetAngle: integer(raw.targetAngle, 90, 1, 179) };
}

export function angleSettings(config: AngleConfig): AngleSettings {
  return {
    tool: 'protractor',
    angles: anglesOf(config),
    highlightActiveScale: config.highlightActiveScale === true,
    estimateFirst: config.estimateFirst === true,
    puzzle: puzzleOf(config),
  };
}

function emptyEntry(): AngleEntry {
  return { estimate: null, reading: null, readingAligned: null };
}

export function createAngleState(config: AngleConfig): AngleState {
  const settings = angleSettings(config);
  const entries: Record<string, AngleEntry> = {};
  for (const angle of settings.angles) entries[angle.id] = emptyEntry();
  return {
    mode: 'angle',
    current: 0,
    protractor: { on: null, rotation: 0 },
    entries,
    puzzle: settings.puzzle ? { estimate: null, fired: [] } : null,
    settings,
  };
}

function withEntry(state: AngleState, id: string, entry: AngleEntry): AngleState {
  return { ...state, entries: { ...state.entries, [id]: entry } };
}

export function reduceAngle(state: AngleState, action: GeoAction): AngleState {
  switch (action.type) {
    case 'select-angle': {
      if (!Number.isInteger(action.index)) return state;
      if (action.index < 0 || action.index >= state.settings.angles.length) return state;
      if (state.current === action.index) return state;
      return { ...state, current: action.index };
    }

    case 'place-protractor': {
      const valid =
        action.on === 'launcher'
          ? state.puzzle !== null
          : state.settings.angles.some((angle) => angle.id === action.on);
      if (!valid) return state;
      if (state.protractor.on === action.on) return state;
      return { ...state, protractor: { ...state.protractor, on: action.on } };
    }

    case 'lift-protractor': {
      if (state.protractor.on === null) return state;
      return { ...state, protractor: { ...state.protractor, on: null } };
    }

    case 'rotate-protractor': {
      if (typeof action.rotation !== 'number' || !Number.isFinite(action.rotation)) return state;
      const rotation = normalizeDegrees(action.rotation);
      if (state.protractor.rotation === rotation) return state;
      return { ...state, protractor: { ...state.protractor, rotation } };
    }

    case 'set-estimate': {
      const angle = state.settings.angles.find((candidate) => candidate.id === action.angle);
      if (!angle) return state;
      const value = angleValue(action.value);
      if (value === null) return state;
      const entry = state.entries[angle.id] ?? emptyEntry();
      if (entry.estimate === value) return state;
      return withEntry(state, angle.id, { ...entry, estimate: value });
    }

    case 'set-reading': {
      const angle = state.settings.angles.find((candidate) => candidate.id === action.angle);
      if (!angle) return state;
      const entry = state.entries[angle.id] ?? emptyEntry();
      if (state.settings.estimateFirst && entry.estimate === null) return state;
      const value = angleValue(action.value);
      if (value === null) return state;
      const aligned =
        state.protractor.on === angle.id && alignmentFor(angle, state.protractor.rotation).aligned;
      if (entry.reading === value && entry.readingAligned === aligned) return state;
      return withEntry(state, angle.id, { ...entry, reading: value, readingAligned: aligned });
    }

    case 'set-launch-estimate': {
      if (!state.puzzle) return state;
      const value = angleValue(action.value);
      if (value === null) return state;
      if (state.puzzle.estimate === value) return state;
      return { ...state, puzzle: { ...state.puzzle, estimate: value } };
    }

    case 'fire': {
      if (!state.puzzle) return state;
      if (state.settings.estimateFirst && state.puzzle.estimate === null) return state;
      const value = angleValue(action.angle);
      if (value === null) return state;
      return { ...state, puzzle: { ...state.puzzle, fired: [...state.puzzle.fired, value] } };
    }

    default:
      return state;
  }
}

export type { AngleAction };
