/**
 * E12 `net-fold` `target:'cylinder'`(상태 모드 `cylinder-net`) 상태 초기화·리듀서(순수 함수).
 *
 * Action은 `cn-` 접두사를 쓴다. 상태에는 정수만 둔다(1/8바퀴, 0.1cm, 0.5cm 단위).
 * 굴리기 연출은 View가 맡는다.
 */
import { clamp } from '../../../core/engine-sdk';
import { Rational } from '../../../core/math';
import type {
  CylinderNetConfig,
  CylinderNetSettings,
  CylinderNetState,
  CylinderNetStep,
  SolidAction,
} from '../types';
import {
  CYL_DEFAULT_PI,
  isCylPi,
  PIECE_HEIGHT_MAX_HALVES,
  PIECE_HEIGHT_MIN_HALVES,
  PIECE_RADIUS_MAX_HALVES,
  PIECE_RADIUS_MIN_HALVES,
  ROLL_FULL,
  WIDTH_MAX_TENTHS,
  WIDTH_MIN_TENTHS,
} from './model';

const DEFAULT_RADIUS_HALVES = 4;
const DEFAULT_HEIGHT_HALVES = 10;
const DEFAULT_START_WIDTH_TENTHS = 60;
const DEFAULT_START_RADIUS_HALVES = 2;
const DEFAULT_START_HEIGHT_HALVES = 6;
const ALL_STEPS: readonly CylinderNetStep[] = ['roll', 'assemble'];

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** 문자열·숫자를 `Rational`로 읽는다(실패하면 null). 소수 표기만 받는다. */
function readRational(raw: unknown): Rational | null {
  if (typeof raw !== 'string' && typeof raw !== 'number') return null;
  try {
    return Rational.parse(String(raw));
  } catch {
    return null;
  }
}

/** `raw`가 1/`unit` 단위의 정수 배이고 [min, max] 안이면 그 정수, 아니면 fallback. */
function readScaled(
  raw: unknown,
  unit: number,
  min: number,
  max: number,
  fallback: number,
): number {
  const value = readRational(raw);
  if (value === null) return fallback;
  const scaled = value.mul(Rational.of(unit));
  if (!scaled.isInteger()) return fallback;
  const n = Number(scaled.integerPart());
  return n >= min && n <= max ? n : fallback;
}

function sanitizeSteps(raw: unknown): readonly CylinderNetStep[] {
  if (!Array.isArray(raw)) return ALL_STEPS;
  const out: CylinderNetStep[] = [];
  for (const item of raw) {
    if ((item === 'roll' || item === 'assemble') && !out.includes(item)) out.push(item);
  }
  return out;
}

function buildSettings(config: CylinderNetConfig): CylinderNetSettings {
  return {
    radiusHalves: readScaled(config.radius, 2, 2, 10, DEFAULT_RADIUS_HALVES),
    heightHalves: readScaled(config.height, 1, 1, 10, DEFAULT_HEIGHT_HALVES / 2) * 2,
    pi: isCylPi(config.pi) ? config.pi : CYL_DEFAULT_PI,
    steps: sanitizeSteps(config.steps),
    rollPaint: config.rollPaint !== false,
    showDims: config.showDims !== false,
  };
}

export function createCylinderNetState(config: CylinderNetConfig): CylinderNetState {
  const settings = buildSettings(config);
  const start = isRecord(config.start) ? config.start : {};
  return {
    mode: 'cylinder-net',
    settings,
    step: settings.steps[0] ?? null,
    rollEighths: 0,
    widthTenths: readScaled(
      start['width'],
      10,
      WIDTH_MIN_TENTHS,
      WIDTH_MAX_TENTHS,
      DEFAULT_START_WIDTH_TENTHS,
    ),
    pieceRadiusHalves: readScaled(
      start['radius'],
      2,
      PIECE_RADIUS_MIN_HALVES,
      PIECE_RADIUS_MAX_HALVES,
      DEFAULT_START_RADIUS_HALVES,
    ),
    pieceHeightHalves: readScaled(
      start['height'],
      2,
      PIECE_HEIGHT_MIN_HALVES,
      PIECE_HEIGHT_MAX_HALVES,
      DEFAULT_START_HEIGHT_HALVES,
    ),
    folded: false,
    viewYaw: 0,
  };
}

function isStep(value: unknown): value is CylinderNetStep {
  return value === 'roll' || value === 'assemble';
}

export function reduceCylinderNet(state: CylinderNetState, action: SolidAction): CylinderNetState {
  switch (action.type) {
    case 'cn-set-step': {
      if (!isStep(action.step) || !state.settings.steps.includes(action.step)) return state;
      return state.step === action.step ? state : { ...state, step: action.step };
    }

    case 'cn-roll': {
      if (state.step !== 'roll') return state;
      if (action.by !== 1 && action.by !== -1) return state;
      const next = clamp(state.rollEighths + action.by, 0, ROLL_FULL);
      return next === state.rollEighths ? state : { ...state, rollEighths: next };
    }

    case 'cn-roll-full': {
      if (state.step !== 'roll' || state.rollEighths === ROLL_FULL) return state;
      return { ...state, rollEighths: ROLL_FULL };
    }

    case 'cn-roll-reset': {
      return state.rollEighths === 0 ? state : { ...state, rollEighths: 0 };
    }

    case 'cn-width': {
      if (state.step !== 'assemble' || state.folded) return state;
      if (![10, 1, -1, -10].includes(action.by)) return state;
      const next = clamp(state.widthTenths + action.by, WIDTH_MIN_TENTHS, WIDTH_MAX_TENTHS);
      return next === state.widthTenths ? state : { ...state, widthTenths: next };
    }

    case 'cn-radius': {
      if (state.step !== 'assemble' || state.folded) return state;
      if (action.by !== 1 && action.by !== -1) return state;
      const next = clamp(
        state.pieceRadiusHalves + action.by,
        PIECE_RADIUS_MIN_HALVES,
        PIECE_RADIUS_MAX_HALVES,
      );
      return next === state.pieceRadiusHalves ? state : { ...state, pieceRadiusHalves: next };
    }

    case 'cn-height': {
      if (state.step !== 'assemble' || state.folded) return state;
      if (action.by !== 1 && action.by !== -1) return state;
      const next = clamp(
        state.pieceHeightHalves + action.by,
        PIECE_HEIGHT_MIN_HALVES,
        PIECE_HEIGHT_MAX_HALVES,
      );
      return next === state.pieceHeightHalves ? state : { ...state, pieceHeightHalves: next };
    }

    case 'cn-fold': {
      if (state.step !== 'assemble' || state.folded) return state;
      return { ...state, folded: true };
    }

    case 'cn-unfold': {
      if (state.step !== 'assemble' || !state.folded) return state;
      return { ...state, folded: false };
    }

    case 'cn-rotate-view': {
      if (!Number.isInteger(action.by) || action.by === 0 || action.by % 15 !== 0) return state;
      const next = (((state.viewYaw + action.by) % 360) + 360) % 360;
      return next === state.viewYaw ? state : { ...state, viewYaw: next };
    }

    default:
      return state;
  }
}
