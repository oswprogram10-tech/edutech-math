/**
 * drag-test의 순수 reducer(T101).
 *
 * 상태에는 정수·인덱스·문자열만 넣는다. 어떤 교점이 사라지는 Action은 거절한다
 * (상태 그대로). 흔들기는 `shake.ts`의 같은 순수 함수로 계산한다.
 */
import { clamp } from '../../../../core/engine-sdk';
import type { GeoAction } from '../../types';
import {
  allRankZero,
  dependentsOf,
  definitionPoints,
  evaluate,
  figureOf,
  graphValid,
  isPointNode,
  rankOf,
  segmentValue,
} from './graph';
import {
  applyDiagonalToggles,
  applyQuadToggles,
  closeQuadToggles,
  defaultConditionParams,
  defaultDiagonalParams,
  DIAGONAL_TOGGLES,
  normalizeQuad,
  openQuadToggles,
  QUAD_TOGGLES,
  quadNodes,
  quadParamsValid,
  sanitizeQuadValue,
  validQuad,
} from './quad';
import { shakeGeometry } from './shake';
import type {
  DiagonalToggle,
  DragConstruction,
  DragNode,
  DragTestAction,
  DragTestConfig,
  DragTestSettings,
  DragTestState,
  DragTool,
  MeasureKind,
  QuadParamName,
  QuadParams,
  QuadToggle,
} from './types';

const TOOLS: readonly DragTool[] = [
  'move',
  'free-point',
  'segment',
  'compass',
  'intersection',
  'point-on-circle',
  'perpendicular',
  'parallel',
];

const DEFAULT_TOOLS: readonly DragTool[] = ['free-point', 'segment', 'compass', 'intersection'];

const MEASURES: readonly MeasureKind[] = ['sideLengths', 'angles'];
const CONSTRUCTIONS: readonly DragConstruction[] = ['free', 'from-diagonals', 'quad-conditions'];
const MAX_POINTS = 12;
const MAX_OBJECTS = 16;

function integer(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return clamp(Math.round(value), min, max);
}

function constructionOf(value: unknown): DragConstruction {
  return typeof value === 'string' && CONSTRUCTIONS.includes(value as DragConstruction)
    ? (value as DragConstruction)
    : 'free';
}

function toolsOf(config: DragTestConfig): DragTool[] {
  const requested = Array.isArray(config.tools) ? config.tools : DEFAULT_TOOLS;
  const result: DragTool[] = ['move'];
  for (const item of requested) {
    if (typeof item !== 'string') continue;
    const tool = item as DragTool;
    if (tool !== 'move' && TOOLS.includes(tool) && !result.includes(tool)) result.push(tool);
  }
  return result;
}

function measuresOf(config: DragTestConfig): MeasureKind[] {
  if (!Array.isArray(config.measure)) return [];
  const result: MeasureKind[] = [];
  for (const item of config.measure) {
    if (typeof item !== 'string') continue;
    const kind = item as MeasureKind;
    if (MEASURES.includes(kind) && !result.includes(kind)) result.push(kind);
  }
  return result;
}

function diagonalTogglesOf(config: DragTestConfig): DiagonalToggle[] {
  if (!Array.isArray(config.diagonalToggles)) return [];
  const result: DiagonalToggle[] = [];
  for (const item of config.diagonalToggles) {
    if (typeof item === 'string' && DIAGONAL_TOGGLES.includes(item as DiagonalToggle)) {
      result.push(item as DiagonalToggle);
    }
  }
  return result;
}

function quadTogglesOf(config: DragTestConfig): QuadToggle[] {
  if (!Array.isArray(config.quadToggles)) return [];
  return closeQuadToggles(
    config.quadToggles.filter((item): item is QuadToggle =>
      QUAD_TOGGLES.includes(item as QuadToggle),
    ),
  );
}

export function dragTestSettings(config: DragTestConfig): DragTestSettings {
  const construction = constructionOf(config.construction);
  const seed =
    typeof config.seed === 'number' && Number.isFinite(config.seed)
      ? Math.trunc(config.seed) >>> 0
      : 1;
  return {
    lattice: integer(config.lattice, 24, 12, 36),
    tools: toolsOf(config),
    measure: measuresOf(config),
    shakeButton: config.shakeButton === true,
    construction,
    seed,
    shakeRadius: integer(config.shakeRadius, 3, 1, 6),
    diagonalToggles: diagonalTogglesOf(config),
    quadToggles: quadTogglesOf(config),
    classifyLive: config.classifyLive === true,
  };
}

function defaultParams(settings: DragTestSettings): QuadParams | null {
  if (settings.construction === 'from-diagonals') return defaultDiagonalParams();
  if (settings.construction === 'quad-conditions') {
    return defaultConditionParams(settings.lattice);
  }
  return null;
}

export function createDragTestState(config: DragTestConfig): DragTestState {
  const settings = dragTestSettings(config);
  const quad = defaultParams(settings);
  let nodes: DragNode[] = [];
  let nextId = 1;
  if (quad) {
    const built = quadNodes(quad, settings.lattice, [], nextId);
    if (built) {
      nodes = built.nodes;
      nextId = built.nextId;
    }
  }
  return {
    mode: 'drag-test',
    tool: settings.tools[0] ?? 'move',
    nodes,
    quad,
    toggles: [],
    shakeCount: 0,
    lastShakeMoved: false,
    preShake: null,
    pickedAngles: [],
    nextId,
    settings,
  };
}

function pointCount(nodes: readonly DragNode[]): number {
  return nodes.filter(isPointNode).length;
}

function objectCount(nodes: readonly DragNode[]): number {
  return nodes.length - pointCount(nodes);
}

function nodeById(nodes: readonly DragNode[], id: string): DragNode | null {
  return nodes.find((node) => node.id === id) ?? null;
}

function pointExists(nodes: readonly DragNode[], id: string): boolean {
  const node = nodeById(nodes, id);
  return node !== null && isPointNode(node);
}

function sameAt(node: DragNode, at: readonly [number, number]): boolean {
  return node.kind === 'free' && node.at[0] === at[0] && node.at[1] === at[1];
}

function segmentExists(nodes: readonly DragNode[], a: string, b: string): boolean {
  return nodes.some(
    (node) =>
      node.kind === 'segment' && ((node.a === a && node.b === b) || (node.a === b && node.b === a)),
  );
}

function circleExists(
  nodes: readonly DragNode[],
  center: string,
  from: string,
  to: string,
): boolean {
  return nodes.some(
    (node) =>
      node.kind === 'circle' && node.center === center && node.from === from && node.to === to,
  );
}

function intersectionExists(
  nodes: readonly DragNode[],
  of: readonly [string, string],
  which: 0 | 1,
): boolean {
  return nodes.some(
    (node) =>
      node.kind === 'intersection' &&
      node.which === which &&
      ((node.of[0] === of[0] && node.of[1] === of[1]) ||
        (node.of[0] === of[1] && node.of[1] === of[0])),
  );
}

function lineExists(
  nodes: readonly DragNode[],
  kind: 'perpendicular' | 'parallel',
  base: string,
  through: string,
): boolean {
  return nodes.some(
    (node) =>
      (node.kind === 'perpendicular' || node.kind === 'parallel') &&
      node.kind === kind &&
      node.base === base &&
      node.through === through,
  );
}

function objectOf(nodes: readonly DragNode[], id: string): DragNode | null {
  const node = nodeById(nodes, id);
  return node && !isPointNode(node) ? node : null;
}

function nextPointLabel(nodes: readonly DragNode[]): string {
  const labels = ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ'];
  const used = new Set(
    nodes.filter(isPointNode).map((node) => (node as { readonly label?: string }).label ?? ''),
  );
  return labels.find((label) => !used.has(label)) ?? 'ㅌ';
}

function withCleanPreShake(state: DragTestState, next: DragTestState): DragTestState {
  return next === state ? state : { ...next, preShake: null };
}

function clearPicked(nodes: readonly DragNode[], picked: readonly string[]): string[] {
  return picked.filter((id) => nodes.some((node) => node.id === id && isPointNode(node)));
}

function reject(state: DragTestState, next: DragTestState): DragTestState {
  void next;
  return state;
}

/** 여러 매개변수를 한 Action으로 바꾼다. 중간 모양이 거절되어도 원래 상태를 지킨다. */
function applyQuadParamUpdates(
  state: DragTestState,
  updates: readonly {
    readonly param: QuadParamName;
    readonly value: number | readonly [number, number];
  }[],
): DragTestState {
  const { settings } = state;
  if (!state.quad || settings.construction === 'free' || updates.length === 0) return state;
  let updated: QuadParams | null = state.quad;
  for (const update of updates) {
    updated = sanitizeQuadValue(updated, update.param, update.value);
    if (!updated) return state;
  }
  const normalized = normalizeQuad(updated, state.toggles, settings.construction);
  if (!normalized) return state;
  if (!quadParamsValid(normalized)) return state;
  if (!validQuad(normalized, settings.lattice, state.toggles as readonly QuadToggle[])) {
    return state;
  }
  const built = quadNodes(normalized, settings.lattice, state.toggles as readonly QuadToggle[], 1);
  if (!built) return state;
  return withCleanPreShake(state, {
    ...state,
    nodes: built.nodes,
    quad: normalized,
    nextId: built.nextId,
    pickedAngles: clearPicked(built.nodes, state.pickedAngles),
  });
}

export function reduceDragTest(
  state: DragTestState,
  action: GeoAction | DragTestAction,
): DragTestState {
  const { settings } = state;
  const pointActions = new Set([
    'add-point',
    'add-segment',
    'add-circle',
    'add-on-circle',
    'add-intersection',
    'add-line',
    'move-point',
    'remove-node',
    'set-quad-param',
    'toggle-condition',
  ]);
  if (settings.construction !== 'free' && pointActions.has(action.type)) {
    if (action.type !== 'set-quad-param' && action.type !== 'toggle-condition') return state;
  }

  switch (action.type) {
    case 'select-drag-tool': {
      if (!settings.tools.includes(action.tool)) return state;
      return state.tool === action.tool ? state : { ...state, tool: action.tool };
    }

    case 'add-point': {
      if (pointCount(state.nodes) >= MAX_POINTS) return state;
      const x = action.at[0];
      const y = action.at[1];
      if (!Number.isInteger(x) || !Number.isInteger(y)) return state;
      if (x < 0 || x > settings.lattice || y < 0 || y > settings.lattice) return state;
      if (state.nodes.some((node) => sameAt(node, [x, y]))) return state;
      const node: DragNode = {
        id: `n${state.nextId}`,
        kind: 'free',
        label: nextPointLabel(state.nodes),
        at: [x, y],
      };
      return withCleanPreShake(state, {
        ...state,
        nodes: [...state.nodes, node],
        nextId: state.nextId + 1,
      });
    }

    case 'add-segment': {
      if (objectCount(state.nodes) >= MAX_OBJECTS) return state;
      if (!pointExists(state.nodes, action.a) || !pointExists(state.nodes, action.b)) return state;
      if (action.a === action.b) return state;
      if (segmentExists(state.nodes, action.a, action.b)) return state;
      const nodes = [
        ...state.nodes,
        { id: `n${state.nextId}`, kind: 'segment' as const, a: action.a, b: action.b },
      ];
      if (!graphValid(nodes)) return state;
      return withCleanPreShake(state, { ...state, nodes, nextId: state.nextId + 1 });
    }

    case 'add-circle': {
      if (objectCount(state.nodes) >= MAX_OBJECTS) return state;
      if (
        !pointExists(state.nodes, action.center) ||
        !pointExists(state.nodes, action.from) ||
        !pointExists(state.nodes, action.to)
      ) {
        return state;
      }
      if (action.from === action.to) return state;
      if (!allRankZero(state.nodes, [action.center, action.from, action.to])) return state;
      if (circleExists(state.nodes, action.center, action.from, action.to)) return state;
      const nodes = [
        ...state.nodes,
        {
          id: `n${state.nextId}`,
          kind: 'circle' as const,
          center: action.center,
          from: action.from,
          to: action.to,
        },
      ];
      if (!graphValid(nodes)) return state;
      return withCleanPreShake(state, { ...state, nodes, nextId: state.nextId + 1 });
    }

    case 'add-on-circle': {
      if (pointCount(state.nodes) >= MAX_POINTS) return state;
      const circle = objectOf(state.nodes, action.circle);
      if (!circle || circle.kind !== 'circle') return state;
      if (!allRankZero(state.nodes, [circle.center, circle.from, circle.to])) return state;
      if (!Number.isInteger(action.pos) || action.pos < 0 || action.pos > 47) return state;
      if (
        state.nodes.some(
          (node) =>
            node.kind === 'on-circle' && node.circle === action.circle && node.pos === action.pos,
        )
      ) {
        return state;
      }
      const nodes = [
        ...state.nodes,
        {
          id: `n${state.nextId}`,
          kind: 'on-circle' as const,
          label: nextPointLabel(state.nodes),
          circle: action.circle,
          pos: action.pos,
        },
      ];
      if (!graphValid(nodes)) return state;
      return withCleanPreShake(state, { ...state, nodes, nextId: state.nextId + 1 });
    }

    case 'add-intersection': {
      if (pointCount(state.nodes) >= MAX_POINTS) return state;
      const first = objectOf(state.nodes, action.of[0]);
      const second = objectOf(state.nodes, action.of[1]);
      if (!first || !second || first.id === second.id) return state;
      const bothCircles = first.kind === 'circle' && second.kind === 'circle';
      const bothLines =
        first.kind === 'segment' || first.kind === 'perpendicular' || first.kind === 'parallel'
          ? second.kind === 'segment' ||
            second.kind === 'perpendicular' ||
            second.kind === 'parallel'
          : false;
      if (!bothCircles && !bothLines) return state;
      if (action.which !== 0 && action.which !== 1) return state;
      if (!bothCircles && action.which !== 0) return state;
      const definitions = [
        ...definitionPoints(state.nodes, first.id),
        ...definitionPoints(state.nodes, second.id),
      ];
      if (!allRankZero(state.nodes, definitions)) return state;
      if (intersectionExists(state.nodes, action.of, action.which)) return state;
      const nodes = [
        ...state.nodes,
        {
          id: `n${state.nextId}`,
          kind: 'intersection' as const,
          label: nextPointLabel(state.nodes),
          of: [action.of[0], action.of[1]] as const,
          which: action.which,
        },
      ];
      if (!graphValid(nodes)) return state;
      return withCleanPreShake(state, { ...state, nodes, nextId: state.nextId + 1 });
    }

    case 'add-line': {
      if (objectCount(state.nodes) >= MAX_OBJECTS) return state;
      if (action.kind !== 'perpendicular' && action.kind !== 'parallel') return state;
      const baseNode = nodeById(state.nodes, action.base);
      if (!baseNode || baseNode.kind !== 'segment') return state;
      if (!pointExists(state.nodes, action.through)) return state;
      if (!allRankZero(state.nodes, [baseNode.a, baseNode.b, action.through])) return state;
      if (lineExists(state.nodes, action.kind, action.base, action.through)) return state;
      const nodes = [
        ...state.nodes,
        {
          id: `n${state.nextId}`,
          kind: action.kind,
          base: action.base,
          through: action.through,
        },
      ];
      if (!graphValid(nodes)) return state;
      return withCleanPreShake(state, { ...state, nodes, nextId: state.nextId + 1 });
    }

    case 'move-point': {
      const node = nodeById(state.nodes, action.id);
      if (!node || !isPointNode(node)) return state;
      let moved: DragNode | null = null;
      if (node.kind === 'free' && 'at' in action) {
        const x = action.at[0];
        const y = action.at[1];
        if (!Number.isInteger(x) || !Number.isInteger(y)) return state;
        if (x < 0 || x > settings.lattice || y < 0 || y > settings.lattice) return state;
        if (node.at[0] === x && node.at[1] === y) return state;
        moved = { id: node.id, kind: 'free', label: node.label, at: [x, y] };
      } else if (node.kind === 'on-circle' && 'pos' in action) {
        if (!Number.isInteger(action.pos)) return state;
        const pos = ((Math.round(action.pos) % 48) + 48) % 48;
        if (pos === node.pos) return state;
        moved = { ...node, pos };
      }
      if (!moved) return state;
      const nodes = state.nodes.map((candidate) => (candidate.id === node.id ? moved : candidate));
      if (!graphValid(nodes)) return state;
      return withCleanPreShake(state, { ...state, nodes });
    }

    case 'remove-node': {
      if (!nodeById(state.nodes, action.id)) return state;
      const removed = new Set(dependentsOf(state.nodes, action.id));
      const nodes = state.nodes.filter((node) => !removed.has(node.id));
      return withCleanPreShake(state, {
        ...state,
        nodes,
        pickedAngles: clearPicked(nodes, state.pickedAngles),
      });
    }

    case 'shake': {
      if (state.quad && settings.construction !== 'free') {
        // 조건을 유지한 채 매개변수를 다시 뽑는다.
        const result = shakeGeometry(
          state.nodes,
          state.quad,
          settings,
          state.shakeCount,
          state.toggles,
        );
        return {
          ...state,
          nodes: result.nodes,
          quad: result.quad,
          shakeCount: state.shakeCount + 1,
          lastShakeMoved: result.moved,
          preShake: result.moved ? { nodes: state.nodes, quad: state.quad } : null,
        };
      }
      const result = shakeGeometry(state.nodes, null, settings, state.shakeCount, state.toggles);
      return {
        ...state,
        nodes: result.nodes,
        shakeCount: state.shakeCount + 1,
        lastShakeMoved: result.moved,
        preShake: result.moved ? { nodes: state.nodes, quad: null } : null,
      };
    }

    case 'toggle-angle-pick': {
      if (!pointExists(state.nodes, action.point)) return state;
      const figure = figureOf(state.nodes, settings.construction);
      if (!figure || !figure.ids.includes(action.point)) return state;
      let picked: string[];
      if (state.pickedAngles.includes(action.point)) {
        picked = state.pickedAngles.filter((id) => id !== action.point);
      } else {
        picked = [...state.pickedAngles, action.point];
        if (picked.length > 2) picked = picked.slice(-2);
      }
      return { ...state, pickedAngles: picked };
    }

    case 'set-quad-param': {
      return applyQuadParamUpdates(state, [{ param: action.param, value: action.value }]);
    }

    case 'set-quad-params': {
      return applyQuadParamUpdates(state, action.params);
    }

    case 'toggle-condition': {
      if (!state.quad) return state;
      const available: readonly string[] =
        settings.construction === 'from-diagonals'
          ? settings.diagonalToggles
          : settings.quadToggles;
      if (!available.includes(action.condition)) return state;
      let nextToggles: (DiagonalToggle | QuadToggle)[];
      if (state.toggles.includes(action.condition)) {
        nextToggles =
          settings.construction === 'quad-conditions'
            ? openQuadToggles(state.toggles as QuadToggle[], action.condition as QuadToggle)
            : state.toggles.filter((toggle) => toggle !== action.condition);
      } else {
        nextToggles = [...state.toggles, action.condition];
      }
      if (settings.construction === 'quad-conditions') {
        nextToggles = closeQuadToggles(nextToggles as QuadToggle[]);
      }
      const normalized = normalizeQuad(state.quad, nextToggles, settings.construction);
      if (!normalized || !quadParamsValid(normalized)) return state;
      if (!validQuad(normalized, settings.lattice, nextToggles as readonly QuadToggle[])) {
        return state;
      }
      const built = quadNodes(
        normalized,
        settings.lattice,
        nextToggles as readonly QuadToggle[],
        1,
      );
      if (!built) return state;
      return withCleanPreShake(state, {
        ...state,
        nodes: built.nodes,
        quad: normalized,
        toggles: nextToggles,
        nextId: built.nextId,
        pickedAngles: clearPicked(built.nodes, state.pickedAngles),
      });
    }

    default:
      return reject(state, state);
  }
}

/** 7번 구성에서 화면이 끄는 손잡이의 기준점. */
export function quadHandles(state: DragTestState): ReturnType<typeof evaluate> | null {
  if (!state.quad) return null;
  return evaluate(state.nodes);
}

export { rankOf, segmentValue, applyDiagonalToggles, applyQuadToggles };
export type { DragTestAction };
