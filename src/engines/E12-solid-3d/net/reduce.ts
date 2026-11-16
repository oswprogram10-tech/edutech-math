/**
 * E12 `net-fold` 모드 상태 초기화·리듀서(순수 함수).
 */
import { clamp } from '../../../core/engine-sdk';
import type {
  NetCardConfig,
  NetCardFaceConfig,
  NetFace,
  NetFoldConfig,
  NetFoldSettings,
  NetFoldState,
  NetPredictConfig,
  SolidAction,
  ViewTurn,
} from '../types';
import {
  NET_DEFAULT_GRID,
  NET_DEFAULT_MAX_FACES,
  NET_MAX_FACES,
  NET_MAX_GRID,
  NET_MIN_FACES,
  NET_MIN_GRID,
} from '../types';
import {
  allowedFaceShapes,
  evaluateNet,
  isAllowedFaceShape,
  sortFaces,
  type NetTarget,
} from './geometry';

function intClamped(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return clamp(Math.round(value), min, max);
}

function firstChar(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  return Array.from(trimmed)[0] ?? null;
}

function facesOverlapRect(
  a: { readonly x: number; readonly y: number; readonly w: number; readonly h: number },
  b: { readonly x: number; readonly y: number; readonly w: number; readonly h: number },
): boolean {
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
}

function sanitizeTarget(raw: unknown): NetTarget {
  if (raw === undefined || raw === 'cube') return 'cube';
  if (raw === 'cuboid') return 'cuboid';
  console.warn(`E12 net-fold: 알 수 없는 target 값(${String(raw)})은 'cube'로 처리합니다.`);
  return 'cube';
}

function sanitizeDims(
  raw: unknown,
  target: NetTarget,
  faceSize: number,
): readonly [number, number, number] {
  if (target === 'cube') {
    return [faceSize, faceSize, faceSize];
  }
  if (!Array.isArray(raw) || raw.length !== 3) {
    return [faceSize, faceSize, faceSize];
  }
  return [
    intClamped(raw[0], 1, 4, faceSize),
    intClamped(raw[1], 1, 4, faceSize),
    intClamped(raw[2], 1, 4, faceSize),
  ];
}

function sanitizeGrid(raw: unknown): readonly [number, number] {
  if (!Array.isArray(raw) || raw.length !== 2) return NET_DEFAULT_GRID;
  return [
    intClamped(raw[0], NET_MIN_GRID, NET_MAX_GRID, NET_DEFAULT_GRID[0]),
    intClamped(raw[1], NET_MIN_GRID, NET_MAX_GRID, NET_DEFAULT_GRID[1]),
  ];
}

function sanitizePredict(raw: unknown): NetPredictConfig | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const ofChar = firstChar((raw as Readonly<Record<string, unknown>>)['of']);
  if (!ofChar) return null;
  return { of: ofChar };
}

function sanitizeNetCards(raw: unknown): readonly NetCardConfig[] {
  if (!Array.isArray(raw)) return [];
  const result: NetCardConfig[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const rec = item as Readonly<Record<string, unknown>>;
    const id = typeof rec['id'] === 'string' ? rec['id'] : null;
    const label = typeof rec['label'] === 'string' ? rec['label'] : null;
    const rawFaces = rec['faces'];
    if (!id || !label || !Array.isArray(rawFaces)) continue;
    const faces: NetCardFaceConfig[] = [];
    for (const f of rawFaces) {
      if (!f || typeof f !== 'object' || Array.isArray(f)) continue;
      const fr = f as Readonly<Record<string, unknown>>;
      const at = fr['at'];
      const w = fr['w'];
      const h = fr['h'];
      if (
        !Array.isArray(at) ||
        at.length !== 2 ||
        typeof at[0] !== 'number' ||
        typeof at[1] !== 'number' ||
        typeof w !== 'number' ||
        typeof h !== 'number' ||
        !Number.isInteger(at[0]) ||
        !Number.isInteger(at[1]) ||
        !Number.isInteger(w) ||
        !Number.isInteger(h) ||
        w <= 0 ||
        h <= 0
      ) {
        continue;
      }
      const faceLbl = firstChar(fr['label']);
      faces.push({
        at: [at[0], at[1]],
        w,
        h,
        ...(faceLbl !== null ? { label: faceLbl } : {}),
      });
    }
    if (faces.length > 0) {
      result.push({ id, label, faces });
    }
  }
  return result;
}

function buildNetSettings(config: NetFoldConfig): NetFoldSettings {
  const target = sanitizeTarget(config.target);
  const faceSize = intClamped(config.faceSize, 1, 3, 1);
  const dims = sanitizeDims(config.dims, target, faceSize);
  const grid = sanitizeGrid(config.grid);
  const maxFaces = intClamped(config.maxFaces, NET_MIN_FACES, NET_MAX_FACES, NET_DEFAULT_MAX_FACES);
  return {
    target,
    faceSize,
    dims,
    grid,
    maxFaces,
    editable: config.editable !== false,
    foldable: config.foldable !== false,
    animate: config.animate !== false,
    collisionHighlight: config.collisionHighlight !== false,
    pairColors: config.pairColors !== false,
    predict: sanitizePredict(config.predict),
    netLog: config.netLog === true,
    netCards: sanitizeNetCards(config.netCards),
  };
}

function sanitizeGivenFaces(
  rawGiven: NetFoldConfig['given'],
  settings: NetFoldSettings,
): readonly NetFace[] {
  if (!Array.isArray(rawGiven) || rawGiven.length === 0) return [];
  const [cols, rows] = settings.grid;
  const accepted: NetFace[] = [];

  for (const item of rawGiven) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const { at, w, h, label, locked } = item;
    if (
      !Array.isArray(at) ||
      at.length !== 2 ||
      !Number.isInteger(at[0]) ||
      !Number.isInteger(at[1]) ||
      !Number.isInteger(w) ||
      !Number.isInteger(h)
    ) {
      console.warn('E12 net-fold: 잘못된 given 면 좌표를 제외합니다.', item);
      continue;
    }
    const [x, y] = at;
    if (!isAllowedFaceShape(w, h, settings)) {
      console.warn(`E12 net-fold: 목표 입체 크기에 맞지 않는 given 면(${w}x${h})을 제외합니다.`);
      continue;
    }
    if (x < 0 || y < 0 || x + w > cols || y + h > rows) {
      console.warn(`E12 net-fold: 모눈 밖 given 면(${x},${y},${w},${h})을 제외합니다.`);
      continue;
    }
    const candidate: NetFace = {
      x,
      y,
      w,
      h,
      label: firstChar(label),
      locked: locked === true,
    };
    if (accepted.some((prev) => facesOverlapRect(prev, candidate))) {
      console.warn(`E12 net-fold: 다른 면과 겹치는 given 면(${x},${y},${w},${h})을 제외합니다.`);
      continue;
    }
    accepted.push(candidate);
  }

  return sortFaces(accepted);
}

/** `place-face` 가능 여부를 UI 미리보기·reduce가 함께 판정한다. */
export function canPlaceFace(state: NetFoldState, x: number, y: number): boolean {
  if (!state.settings.editable || state.folded) return false;
  if (!Number.isInteger(x) || !Number.isInteger(y)) return false;
  const [w, h] = state.shape;
  const [cols, rows] = state.settings.grid;
  if (x < 0 || y < 0 || x + w > cols || y + h > rows) return false;
  if (state.faces.length >= state.settings.maxFaces) return false;
  const candidate = { x, y, w, h };
  return !state.faces.some((f) => facesOverlapRect(f, candidate));
}

export function findFaceAtCell(faces: readonly NetFace[], x: number, y: number): NetFace | null {
  for (const face of faces) {
    if (x >= face.x && x < face.x + face.w && y >= face.y && y < face.y + face.h) {
      return face;
    }
  }
  return null;
}

export function createNetState(config: NetFoldConfig): NetFoldState {
  const settings = buildNetSettings(config);
  const shapes = allowedFaceShapes(settings);
  const initialShape: readonly [number, number] = shapes[0] ?? [
    settings.faceSize,
    settings.faceSize,
  ];
  const faces = sanitizeGivenFaces(config.given, settings);

  return {
    mode: 'net-fold',
    settings,
    faces,
    shape: initialShape,
    cursor: [0, 0],
    folded: false,
    viewTurn: 0,
    prediction: null,
    predictedBeforeFold: false,
    foundNets: [],
  };
}

export function reduceNet(state: NetFoldState, action: SolidAction): NetFoldState {
  const { settings } = state;
  const [cols, rows] = settings.grid;

  switch (action.type) {
    case 'place-face': {
      if (!canPlaceFace(state, action.x, action.y)) return state;
      const [w, h] = state.shape;
      const added: NetFace = {
        x: action.x,
        y: action.y,
        w,
        h,
        label: null,
        locked: false,
      };
      return {
        ...state,
        faces: sortFaces([...state.faces, added]),
      };
    }

    case 'remove-face': {
      if (!settings.editable || state.folded) return state;
      if (!Number.isInteger(action.x) || !Number.isInteger(action.y)) return state;
      const hit = findFaceAtCell(state.faces, action.x, action.y);
      if (!hit || hit.locked) return state;
      const nextFaces = state.faces.filter((f) => f !== hit);
      const nextPrediction =
        hit.label !== null && state.prediction === hit.label ? null : state.prediction;
      return {
        ...state,
        faces: nextFaces,
        prediction: nextPrediction,
      };
    }

    case 'select-shape': {
      if (!settings.editable) return state;
      if (!Number.isInteger(action.w) || !Number.isInteger(action.h)) return state;
      if (!isAllowedFaceShape(action.w, action.h, settings)) return state;
      if (state.shape[0] === action.w && state.shape[1] === action.h) return state;
      return { ...state, shape: [action.w, action.h] };
    }

    case 'rotate-shape': {
      if (!settings.editable) return state;
      const [w, h] = state.shape;
      if (w === h) return state;
      if (!isAllowedFaceShape(h, w, settings)) return state;
      return { ...state, shape: [h, w] };
    }

    case 'move-cursor': {
      const [rawX, rawY] = action.to;
      if (!Number.isFinite(rawX) || !Number.isFinite(rawY)) return state;
      const nx = clamp(Math.round(rawX), 0, cols - 1);
      const ny = clamp(Math.round(rawY), 0, rows - 1);
      if (nx === state.cursor[0] && ny === state.cursor[1]) return state;
      return { ...state, cursor: [nx, ny] };
    }

    case 'fold': {
      if (!settings.foldable || state.folded) return state;
      let nextFoundNets = state.foundNets;
      if (settings.netLog) {
        const evalRes = evaluateNet(state.faces, settings);
        if (evalRes.valid && evalRes.netKey && !state.foundNets.includes(evalRes.netKey)) {
          nextFoundNets = [...state.foundNets, evalRes.netKey].sort();
        }
      }
      return {
        ...state,
        folded: true,
        foundNets: nextFoundNets,
      };
    }

    case 'unfold': {
      if (!state.folded) return state;
      return { ...state, folded: false };
    }

    case 'turn': {
      const delta = action.dir === 'right' ? 1 : 3;
      const nextTurn = ((state.viewTurn + delta) % 4) as ViewTurn;
      return { ...state, viewTurn: nextTurn };
    }

    case 'predict': {
      if (!settings.predict || state.folded) return state;
      const label = firstChar(action.label);
      if (!label || label === settings.predict.of) return state;
      if (!state.faces.some((f) => f.label === label)) return state;
      if (state.prediction === label) return state;
      return {
        ...state,
        prediction: label,
        predictedBeforeFold: true,
      };
    }

    case 'clear': {
      if (!settings.editable) return state;
      const lockedFaces = state.faces.filter((f) => f.locked);
      if (lockedFaces.length === state.faces.length && !state.folded && state.prediction === null) {
        return state;
      }
      return {
        ...state,
        faces: lockedFaces,
        folded: false,
        prediction: null,
      };
    }

    default:
      return state;
  }
}
