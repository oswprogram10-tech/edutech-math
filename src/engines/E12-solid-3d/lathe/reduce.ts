/**
 * E12 `lathe` 모드 상태 초기화·리듀서(순수 함수).
 *
 * Action은 `lt-` 접두사를 쓴다(`set-view`·`rotate-view`만 xray·prism과 같은 이름이고 모드로 나뉜다).
 * 상태는 JSON으로 직렬화할 수 있다. 회전 연출(잔상이 쌓이는 모습)은 View가 맡는다.
 */
import { clamp } from '../../../core/engine-sdk';
import { normalizeView, type XrayViewAngle } from '../xray/geometry';
import type { LatheConfig, LatheSettings, LatheState, SolidAction } from '../types';
import {
  FULL_TURN,
  isEdgeOf,
  isLatheEdge,
  isLathePlane,
  isLatheProfile,
  LASER_MAX_STEP,
  LATHE_PLANES,
  LATHE_PROFILES,
  snapAngle,
  solidOf,
  type LatheProfile,
  type LathePlane,
  type LatheSolid,
} from './profiles';

export const LATHE_DEFAULT_VIEW: XrayViewAngle = { yaw: 0, pitch: 15 };
export const LATHE_PITCH_MIN = -30;
export const LATHE_PITCH_MAX = 60;
/** 수평 레이저를 처음 켤 때 슬라이더의 시작 높이. */
export const LATHE_DEFAULT_T = 5;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeProfiles(raw: unknown): readonly LatheProfile[] {
  if (!Array.isArray(raw)) return LATHE_PROFILES;
  const out: LatheProfile[] = [];
  for (const item of raw) {
    if (isLatheProfile(item)) {
      if (!out.includes(item)) out.push(item);
    } else if (item === 'custom') {
      console.warn('E12 lathe: custom 도형은 받기만 하고 무시합니다.');
    } else {
      console.warn('E12 lathe: 알 수 없는 도형은 무시합니다.');
    }
  }
  return out.length > 0 ? out : LATHE_PROFILES;
}

function sanitizePlanes(raw: LatheConfig['crossSection']): readonly LathePlane[] {
  if (!isRecord(raw)) return [];
  const planes = raw['planes'];
  if (!Array.isArray(planes)) return LATHE_PLANES;
  // 고정 순서(수평, 수직)로 모은다.
  return LATHE_PLANES.filter((plane) => planes.includes(plane));
}

function sanitizePreset(raw: unknown): LatheSettings['preset'] {
  if (raw === null || raw === undefined) return null;
  if (!isRecord(raw)) return null;
  const { profile, edge } = raw;
  if (!isLatheProfile(profile) || !isLatheEdge(edge) || !isEdgeOf(profile, edge)) {
    console.warn('E12 lathe: 맞지 않는 preset은 무시합니다.');
    return null;
  }
  return { profile, edge };
}

function buildSettings(config: LatheConfig): LatheSettings {
  return {
    profiles: sanitizeProfiles(config.profiles),
    preset: sanitizePreset(config.preset),
    planes: sanitizePlanes(config.crossSection),
    showSection: config.showSection !== false,
    rotateHandle: config.rotateHandle !== false,
  };
}

function presetState(settings: LatheSettings, view: XrayViewAngle): LatheState {
  const { preset } = settings;
  return {
    mode: 'lathe',
    settings,
    profile: preset ? preset.profile : null,
    edge: preset ? preset.edge : null,
    angle: preset ? FULL_TURN : 0,
    laser: null,
    view,
  };
}

export function createLatheState(config: LatheConfig): LatheState {
  return presetState(buildSettings(config), LATHE_DEFAULT_VIEW);
}

export function isComplete(state: LatheState): boolean {
  return state.profile !== null && state.edge !== null && state.angle === FULL_TURN;
}

/** 완성된 입체. 아직 다 돌리지 않았으면 null. */
export function solidOfState(state: LatheState): LatheSolid | null {
  if (!isComplete(state) || state.profile === null || state.edge === null) return null;
  return solidOf(state.profile, state.edge);
}

function clampView(view: XrayViewAngle): XrayViewAngle {
  const next = normalizeView(view);
  const pitch = clamp(next.pitch, LATHE_PITCH_MIN, LATHE_PITCH_MAX);
  return pitch === next.pitch ? next : { yaw: next.yaw, pitch };
}

function sameView(a: XrayViewAngle, b: XrayViewAngle): boolean {
  return a.yaw === b.yaw && a.pitch === b.pitch;
}

export function reduceLathe(state: LatheState, action: SolidAction): LatheState {
  const { settings } = state;
  switch (action.type) {
    case 'lt-pick-profile': {
      if (!isLatheProfile(action.profile) || !settings.profiles.includes(action.profile)) {
        return state;
      }
      if (state.profile === action.profile && state.edge === null && state.angle === 0) {
        return state;
      }
      return { ...state, profile: action.profile, edge: null, angle: 0, laser: null };
    }

    case 'lt-attach': {
      if (state.profile === null || !isEdgeOf(state.profile, action.edge)) return state;
      if (state.edge === action.edge && state.angle === 0) return state;
      return { ...state, edge: action.edge, angle: 0, laser: null };
    }

    case 'lt-set-angle': {
      if (state.profile === null || state.edge === null) return state;
      const next = snapAngle(action.angle);
      if (next === null || next === state.angle) return state;
      return { ...state, angle: next, laser: next === FULL_TURN ? state.laser : null };
    }

    case 'lt-reset': {
      const initial = presetState(settings, state.view);
      if (
        state.profile === initial.profile &&
        state.edge === initial.edge &&
        state.angle === initial.angle &&
        state.laser === null
      ) {
        return state;
      }
      return initial;
    }

    case 'lt-set-laser': {
      if (!isLathePlane(action.plane) || !settings.planes.includes(action.plane)) return state;
      if (!isComplete(state)) return state;
      if (typeof action.t !== 'number' || !Number.isFinite(action.t)) return state;
      const prevT = state.laser ? state.laser.t : LATHE_DEFAULT_T;
      // 축을 포함하는 레이저는 높이를 쓰지 않으므로 슬라이더 값을 그대로 둔다.
      const t =
        action.plane === 'through-axis' ? prevT : clamp(Math.round(action.t), 0, LASER_MAX_STEP);
      if (state.laser && state.laser.plane === action.plane && state.laser.t === t) return state;
      return { ...state, laser: { plane: action.plane, t } };
    }

    case 'lt-clear-laser': {
      return state.laser === null ? state : { ...state, laser: null };
    }

    case 'set-view': {
      if (!isComplete(state)) return state;
      const next = clampView({ yaw: action.yaw, pitch: action.pitch });
      return sameView(next, state.view) ? state : { ...state, view: next };
    }

    case 'rotate-view': {
      if (!isComplete(state)) return state;
      const dYaw = Number.isFinite(action.dYaw) ? action.dYaw : 0;
      const dPitch = Number.isFinite(action.dPitch) ? action.dPitch : 0;
      const next = clampView({ yaw: state.view.yaw + dYaw, pitch: state.view.pitch + dPitch });
      return sameView(next, state.view) ? state : { ...state, view: next };
    }

    default:
      return state;
  }
}
