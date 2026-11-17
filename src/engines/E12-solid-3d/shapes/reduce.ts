/**
 * E12 `shapes-sort` 모드 상태 초기화·리듀서(순수 함수).
 *
 * Action은 모두 `ss-` 접두사를 쓴다. 상태는 JSON으로 직렬화할 수 있다.
 * 결과(구른다·멈춘다)는 상태에 `trials`로만 남고, 화면 연출은 View가 맡는다.
 */
import { clamp } from '../../../core/engine-sdk';
import type {
  ShapeFall,
  ShapesSettings,
  ShapesSortConfig,
  ShapesState,
  ShapeTrial,
  SolidAction,
} from '../types';
import {
  canStackOn,
  cluesOf,
  defaultLook,
  defaultPose,
  isAllowedPose,
  isShapeColor,
  isShapeKind,
  isShapeSize,
  rampResult,
  SHAPES_DEFAULT_TOWER,
  SHAPES_MAX_RECORDS,
  SHAPES_MAX_TOWER,
  SHAPES_MIN_TOWER,
  type ShapeItem,
  type ShapeKind,
  type ShapePart,
  type ShadowView,
  type ShapePose,
} from './rules';

const DEFAULT_OBJECTS: readonly ShapeKind[] = ['box', 'cylinder', 'sphere'];
const MAX_OBJECTS = 9;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** 설정의 물건 목록을 `ShapeItem[]`로 바꾼다. 알 수 없는 항목은 무시하고, 겹치는 id는 번호를 붙여 구분한다. */
export function sanitizeObjects(raw: unknown): readonly ShapeItem[] {
  const list: readonly unknown[] = Array.isArray(raw) && raw.length > 0 ? raw : DEFAULT_OBJECTS;
  const out: ShapeItem[] = [];
  const used = new Set<string>();
  const uniqueId = (wanted: string): string => {
    let id = wanted;
    let n = 2;
    while (used.has(id)) {
      id = `${wanted}-${n}`;
      n += 1;
    }
    used.add(id);
    return id;
  };
  for (const item of list) {
    if (out.length >= MAX_OBJECTS) break;
    const index = out.length;
    if (isShapeKind(item)) {
      out.push({ id: uniqueId(item), kind: item, ...defaultLook(index) });
    } else if (isRecord(item) && isShapeKind(item['kind'])) {
      const look = defaultLook(index);
      const wanted =
        typeof item['id'] === 'string' && item['id'].length > 0 ? item['id'] : item['kind'];
      out.push({
        id: uniqueId(wanted),
        kind: item['kind'],
        color: isShapeColor(item['color']) ? item['color'] : look.color,
        size: isShapeSize(item['size']) ? item['size'] : look.size,
      });
    } else {
      console.warn('E12 shapes-sort: 알 수 없는 물건은 무시합니다.');
    }
  }
  return out.length > 0 ? out : sanitizeObjects(undefined);
}

function buildSettings(config: ShapesSortConfig): ShapesSettings {
  const scene =
    config.scene === 'ramp' ||
    config.scene === 'tower' ||
    config.scene === 'mystery' ||
    config.scene === 'ramp-and-tower'
      ? config.scene
      : 'ramp-and-tower';
  const towerMax =
    typeof config.towerMax === 'number' && Number.isFinite(config.towerMax)
      ? clamp(Math.round(config.towerMax), SHAPES_MIN_TOWER, SHAPES_MAX_TOWER)
      : SHAPES_DEFAULT_TOWER;
  const rawMystery: unknown = config.mystery;
  const shadowRaw = isRecord(rawMystery) ? rawMystery['shadow'] : undefined;
  const shadow: ShadowView | null = shadowRaw === 'top' || shadowRaw === 'side' ? shadowRaw : null;
  const mystery =
    isRecord(rawMystery) && isShapeKind(rawMystery['kind'])
      ? { kind: rawMystery['kind'], shadow }
      : null;
  return { scene, objects: sanitizeObjects(config.objects), towerMax, mystery };
}

export function createShapesState(config: ShapesSortConfig): ShapesState {
  const settings = buildSettings(config);
  const pose: Record<string, ShapePose> = {};
  for (const item of settings.objects) pose[item.id] = defaultPose(item.kind);
  return {
    mode: 'shapes-sort',
    settings,
    selected: null,
    pose,
    rampItem: null,
    rampPlayed: false,
    trials: [],
    tower: [],
    fallen: [],
    cluesShown: 0,
  };
}

export function hasRamp(settings: ShapesSettings): boolean {
  return settings.scene === 'ramp' || settings.scene === 'ramp-and-tower';
}

export function hasTower(settings: ShapesSettings): boolean {
  return settings.scene === 'tower' || settings.scene === 'ramp-and-tower';
}

export function itemOf(state: ShapesState, id: string | null): ShapeItem | null {
  if (id === null) return null;
  return state.settings.objects.find((item) => item.id === id) ?? null;
}

export function poseOf(state: ShapesState, item: ShapeItem): ShapePose {
  return state.pose[item.id] ?? defaultPose(item.kind);
}

export function partOf(state: ShapesState, id: string): ShapePart | null {
  const item = itemOf(state, id);
  return item ? { kind: item.kind, pose: poseOf(state, item) } : null;
}

/** 오래된 기록부터 버려 최대 20개만 남긴다. */
function capped<T>(list: readonly T[], added: T): readonly T[] {
  const next = [...list, added];
  return next.length > SHAPES_MAX_RECORDS ? next.slice(next.length - SHAPES_MAX_RECORDS) : next;
}

export function reduceShapes(state: ShapesState, action: SolidAction): ShapesState {
  const { settings } = state;
  switch (action.type) {
    case 'ss-select': {
      const item = itemOf(state, action.id);
      if (!item) return state;
      return { ...state, selected: state.selected === item.id ? null : item.id };
    }

    case 'ss-set-pose': {
      const item = itemOf(state, action.id);
      if (!item || !isAllowedPose(item.kind, action.pose)) return state;
      if (poseOf(state, item) === action.pose) return state;
      // 탑에 올라간 물건은 돌려 놓을 수 없다(쌓인 모양이 바뀌지 않게).
      if (state.tower.includes(item.id)) return state;
      const next = { ...state, pose: { ...state.pose, [item.id]: action.pose } };
      return state.rampItem === item.id ? { ...next, rampPlayed: false } : next;
    }

    case 'ss-place-ramp': {
      if (!hasRamp(settings)) return state;
      const item = itemOf(state, state.selected);
      if (!item) return state;
      const onTower = state.tower.indexOf(item.id);
      // 탑에 있는 물건은 맨 위일 때만 경사로로 옮긴다.
      if (onTower >= 0 && onTower !== state.tower.length - 1) return state;
      if (state.rampItem === item.id && !state.rampPlayed && onTower < 0) return state;
      return {
        ...state,
        rampItem: item.id,
        rampPlayed: false,
        tower: onTower >= 0 ? state.tower.slice(0, onTower) : state.tower,
      };
    }

    case 'ss-play': {
      if (!hasRamp(settings)) return state;
      const item = itemOf(state, state.rampItem);
      if (!item) return state;
      const pose = poseOf(state, item);
      const trial: ShapeTrial = {
        id: item.id,
        kind: item.kind,
        pose,
        result: rampResult(item.kind, pose),
      };
      return { ...state, rampPlayed: true, trials: capped(state.trials, trial) };
    }

    case 'ss-reset-ramp': {
      if (state.rampItem === null && !state.rampPlayed) return state;
      return { ...state, rampItem: null, rampPlayed: false };
    }

    case 'ss-stack': {
      if (!hasTower(settings)) return state;
      const item = itemOf(state, state.selected);
      if (!item) return state;
      if (state.tower.includes(item.id)) return state;
      if (state.tower.length >= settings.towerMax) return state;
      const part: ShapePart = { kind: item.kind, pose: poseOf(state, item) };
      const topId = state.tower[state.tower.length - 1];
      const below = topId === undefined ? null : partOf(state, topId);
      const base =
        state.rampItem === item.id ? { ...state, rampItem: null, rampPlayed: false } : state;
      if (canStackOn(below, part)) {
        return { ...base, tower: [...state.tower, item.id] };
      }
      const fell: ShapeFall = { id: item.id, kind: part.kind, pose: part.pose };
      return { ...base, fallen: capped(state.fallen, fell) };
    }

    case 'ss-unstack': {
      if (state.tower.length === 0) return state;
      return { ...state, tower: state.tower.slice(0, -1) };
    }

    case 'ss-clear-tower': {
      if (state.tower.length === 0 && state.fallen.length === 0) return state;
      return { ...state, tower: [], fallen: [] };
    }

    case 'ss-touch': {
      if (settings.scene !== 'mystery' || settings.mystery === null) return state;
      if (state.cluesShown >= cluesOf(settings.mystery.kind).length) return state;
      return { ...state, cluesShown: state.cluesShown + 1 };
    }

    default:
      return state;
  }
}
