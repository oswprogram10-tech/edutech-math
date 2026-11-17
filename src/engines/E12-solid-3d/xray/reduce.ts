/**
 * E12 `xray` 모드 상태 초기화·리듀서(순수 함수).
 */
import { clamp } from '../../../core/engine-sdk';
import type {
  SolidAction,
  XrayConfig,
  XrayDisplayMode,
  XrayMarkedState,
  XraySettings,
  XraySketchPrefill,
  XraySolidSpec,
  XraySolidType,
  XrayState,
  XrayTool,
} from '../types';
import { XRAY_DEFAULT_SOLID, XRAY_DEFAULT_TOOLS, XRAY_DEFAULT_VIEW } from '../types';
import {
  XRAY_EDGE_IDS,
  XRAY_FACE_IDS,
  XRAY_VERTEX_IDS,
  buildPrefillVisibleSegments,
  isDotInSketchBounds,
  isXrayEdgeId,
  isXrayFaceId,
  isXrayVertexId,
  normalizeSketchEndpoints,
  normalizeView,
  sketchProjectionOk,
  sketchSegmentEndpointKey,
  sortSketchSegments,
  type SketchSegment,
  type XrayEdgeId,
  type XrayFaceId,
  type XrayVertexId,
  type XrayViewAngle,
} from './geometry';

function intDimClamped(value: unknown, fallback: number, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  const rounded = Math.round(value);
  if (rounded < 1 || rounded > 6) {
    console.warn(`E12 xray: solid.${name}=${value} 범위 밖이라 1~6으로 자릅니다.`);
  }
  return clamp(rounded, 1, 6);
}

function sanitizeSolid(raw: unknown): XraySolidSpec {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return XRAY_DEFAULT_SOLID;
  }
  const rec = raw as Readonly<Record<string, unknown>>;
  let type: XraySolidType = 'cuboid';
  if (rec['type'] === 'cube' || rec['type'] === 'cuboid') {
    type = rec['type'];
  } else if (rec['type'] !== undefined) {
    console.warn(`E12 xray: 알 수 없는 solid.type(${String(rec['type'])})은 cuboid로 처리합니다.`);
  }
  const w = intDimClamped(rec['w'], XRAY_DEFAULT_SOLID.w, 'w');
  if (type === 'cube') {
    return { type: 'cube', w, d: w, h: w };
  }
  const d = intDimClamped(rec['d'], XRAY_DEFAULT_SOLID.d, 'd');
  const h = intDimClamped(rec['h'], XRAY_DEFAULT_SOLID.h, 'h');
  return { type: 'cuboid', w, d, h };
}

function sanitizeTools(raw: unknown): readonly XrayTool[] {
  if (raw === undefined) return XRAY_DEFAULT_TOOLS;
  if (!Array.isArray(raw)) return XRAY_DEFAULT_TOOLS;
  const out: XrayTool[] = [];
  for (const item of raw) {
    if ((item === 'face' || item === 'edge' || item === 'vertex') && !out.includes(item)) {
      out.push(item);
    }
  }
  return out;
}

function sanitizeHighlightFace(raw: unknown): XrayFaceId | null {
  if (raw === undefined || raw === null) return null;
  if (isXrayFaceId(raw)) return raw;
  console.warn(`E12 xray: 알 수 없는 highlightFace(${String(raw)})는 무시합니다.`);
  return null;
}

function sanitizeSketch(raw: unknown): false | { readonly prefill: XraySketchPrefill } {
  if (raw === undefined || raw === false || raw === null) return false;
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const prefillRaw = (raw as Readonly<Record<string, unknown>>)['prefill'];
    const prefill: XraySketchPrefill = prefillRaw === 'visible' ? 'visible' : 'none';
    return { prefill };
  }
  console.warn(`E12 xray: 잘못된 sketch 설정(${String(raw)})은 false로 처리합니다.`);
  return false;
}

function sanitizeViewAngle(raw: unknown): XrayViewAngle {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return XRAY_DEFAULT_VIEW;
  }
  const rec = raw as Readonly<Record<string, unknown>>;
  const rawYaw = typeof rec['yaw'] === 'number' && Number.isFinite(rec['yaw']) ? rec['yaw'] : 30;
  const rawPitch =
    typeof rec['pitch'] === 'number' && Number.isFinite(rec['pitch']) ? rec['pitch'] : 30;
  if (rawPitch < -75 || rawPitch > 75) {
    console.warn(`E12 xray: view.pitch=${rawPitch} 범위 밖이라 -75~75로 자릅니다.`);
  }
  return normalizeView({ yaw: rawYaw, pitch: rawPitch });
}

function buildXraySettings(config: XrayConfig): XraySettings {
  const solid = sanitizeSolid(config.solid);
  let display: XrayDisplayMode = config.display === 'sketch' ? 'sketch' : 'solid';
  if (config.display !== undefined && config.display !== 'solid' && config.display !== 'sketch') {
    console.warn(`E12 xray: 알 수 없는 display(${String(config.display)})는 'solid'로 처리합니다.`);
  }
  let sketch = sanitizeSketch(config.sketch);

  if (
    (sketch !== false || display === 'sketch') &&
    !sketchProjectionOk(solid.w, solid.d, solid.h)
  ) {
    console.warn(
      `E12 xray: 크기 ${solid.w}×${solid.d}×${solid.h}는 사투상 겨냥도 점이 겹쳐 sketch/display:'sketch'를 끕니다.`,
    );
    sketch = false;
    display = 'solid';
  }

  return {
    solid,
    display,
    rotate: display === 'sketch' ? false : config.rotate !== false,
    view: sanitizeViewAngle(config.view),
    xray: config.xray === true,
    xrayToggle: config.xrayToggle !== false,
    tools: sanitizeTools(config.tools),
    faceQuery: config.faceQuery === true,
    highlightFace: sanitizeHighlightFace(config.highlightFace),
    sketch,
  };
}

function sortByFixedOrder<T extends string>(items: readonly T[], order: readonly T[]): T[] {
  const set = new Set(items);
  return order.filter((id) => set.has(id));
}

function toggleInOrder<T extends string>(
  list: readonly T[],
  id: T,
  order: readonly T[],
): readonly T[] {
  const exists = list.includes(id);
  const next = exists ? list.filter((x) => x !== id) : [...list, id];
  return sortByFixedOrder(next, order);
}

export function createXrayState(config: XrayConfig): XrayState {
  const settings = buildXraySettings(config);
  const segments: readonly SketchSegment[] =
    settings.sketch && settings.sketch.prefill === 'visible'
      ? buildPrefillVisibleSegments(settings.solid.w, settings.solid.d, settings.solid.h)
      : [];

  return {
    mode: 'xray',
    settings,
    view: settings.view,
    xray: settings.xray,
    xrayUsed: false,
    tool: settings.tools[0] ?? null,
    marked: { faces: [], edges: [], vertices: [] },
    queryFace: null,
    segments,
    lineStyle: 'solid',
  };
}

export function reduceXray(state: XrayState, action: SolidAction): XrayState {
  const { settings } = state;
  const { w, d, h } = settings.solid;

  switch (action.type) {
    case 'set-view': {
      if (!settings.rotate) return state;
      const nextView = normalizeView({ yaw: action.yaw, pitch: action.pitch });
      if (nextView.yaw === state.view.yaw && nextView.pitch === state.view.pitch) {
        return state;
      }
      return { ...state, view: nextView };
    }

    case 'rotate-view': {
      if (!settings.rotate) return state;
      const dYaw = Number.isFinite(action.dYaw) ? action.dYaw : 0;
      const dPitch = Number.isFinite(action.dPitch) ? action.dPitch : 0;
      const nextView = normalizeView({
        yaw: state.view.yaw + dYaw,
        pitch: state.view.pitch + dPitch,
      });
      if (nextView.yaw === state.view.yaw && nextView.pitch === state.view.pitch) {
        return state;
      }
      return { ...state, view: nextView };
    }

    case 'toggle-xray': {
      if (!settings.xrayToggle || settings.display === 'sketch') return state;
      const nextXray = !state.xray;
      return {
        ...state,
        xray: nextXray,
        xrayUsed: state.xrayUsed || nextXray,
      };
    }

    case 'set-tool': {
      const allowed =
        action.tool === 'query' ? settings.faceQuery : settings.tools.includes(action.tool);
      if (!allowed || state.tool === action.tool) return state;
      return { ...state, tool: action.tool };
    }

    case 'toggle-mark': {
      if (!settings.tools.includes(action.kind)) return state;
      if (action.kind === 'face') {
        if (!isXrayFaceId(action.id)) return state;
        const faces = toggleInOrder<XrayFaceId>(state.marked.faces, action.id, XRAY_FACE_IDS);
        return { ...state, marked: { ...state.marked, faces } };
      }
      if (action.kind === 'edge') {
        if (!isXrayEdgeId(action.id)) return state;
        const edges = toggleInOrder<XrayEdgeId>(state.marked.edges, action.id, XRAY_EDGE_IDS);
        return { ...state, marked: { ...state.marked, edges } };
      }
      if (!isXrayVertexId(action.id)) return state;
      const vertices = toggleInOrder<XrayVertexId>(
        state.marked.vertices,
        action.id,
        XRAY_VERTEX_IDS,
      );
      return { ...state, marked: { ...state.marked, vertices } };
    }

    case 'query-face': {
      if (!settings.faceQuery || !isXrayFaceId(action.face)) return state;
      const nextQuery = state.queryFace === action.face ? null : action.face;
      return { ...state, queryFace: nextQuery };
    }

    case 'clear-marks': {
      const { faces, edges, vertices } = state.marked;
      if (
        faces.length === 0 &&
        edges.length === 0 &&
        vertices.length === 0 &&
        state.queryFace === null
      ) {
        return state;
      }
      return {
        ...state,
        marked: { faces: [], edges: [], vertices: [] },
        queryFace: null,
      };
    }

    case 'set-line-style': {
      if (!settings.sketch) return state;
      if (action.style !== 'solid' && action.style !== 'dashed') return state;
      if (state.lineStyle === action.style) return state;
      return { ...state, lineStyle: action.style };
    }

    case 'add-segment': {
      if (!settings.sketch) return state;
      if (action.style !== 'solid' && action.style !== 'dashed') return state;
      if (!isDotInSketchBounds(action.a, w, d, h) || !isDotInSketchBounds(action.b, w, d, h)) {
        return state;
      }
      if (action.a[0] === action.b[0] && action.a[1] === action.b[1]) return state;

      const [na, nb] = normalizeSketchEndpoints(action.a, action.b);
      const targetKey = sketchSegmentEndpointKey(na, nb);
      const existingIdx = state.segments.findIndex(
        (seg) => sketchSegmentEndpointKey(seg.a, seg.b) === targetKey,
      );
      if (existingIdx >= 0) {
        const existing = state.segments[existingIdx];
        if (!existing || existing.locked || existing.style === action.style) {
          return state;
        }
        const nextSegments = state.segments.map((seg, i) =>
          i === existingIdx ? { ...seg, style: action.style } : seg,
        );
        return { ...state, segments: sortSketchSegments(nextSegments) };
      }

      const added: SketchSegment = {
        a: na,
        b: nb,
        style: action.style,
        locked: false,
      };
      return { ...state, segments: sortSketchSegments([...state.segments, added]) };
    }

    case 'remove-segment': {
      if (!settings.sketch) return state;
      const targetKey = sketchSegmentEndpointKey(action.a, action.b);
      const existing = state.segments.find(
        (seg) => sketchSegmentEndpointKey(seg.a, seg.b) === targetKey,
      );
      if (!existing || existing.locked) return state;
      return {
        ...state,
        segments: state.segments.filter(
          (seg) => sketchSegmentEndpointKey(seg.a, seg.b) !== targetKey,
        ),
      };
    }

    case 'clear-sketch': {
      if (!settings.sketch) return state;
      const remaining = state.segments.filter((seg) => seg.locked);
      if (remaining.length === state.segments.length) return state;
      return { ...state, segments: remaining };
    }

    default:
      return state;
  }
}

export type XrayMarkedKey = keyof XrayMarkedState;
