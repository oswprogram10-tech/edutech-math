/**
 * E05 분수 모델의 순수 reducer.
 *
 * 모든 상태 변경은 Action 하나로 기록되고, 같은 Action 목록은 같은 상태를 재생한다.
 * 수의 값은 `Rational`로 계산한 뒤 `toString()` 문자열로 저장한다.
 * 조각 넓이만 화면 기하(number)로 계산한다(T010 결정 2의 예외).
 */
import { Rational } from '../../core/math';
import { clamp } from '../../core/engine-sdk';
import type { Point } from '../../core/engine-sdk';
import {
  boundaryCandidates,
  circleCandidates,
  circleSectors,
  outlineFor,
  partitionPieces,
  polygonArea,
  polygonCentroid,
  samePoint,
} from './geometry';
import type { Piece } from './geometry';
import {
  denominatorNumber,
  gcd,
  lcm,
  numeratorNumber,
  parseFraction,
  parseRational,
} from './fractions';
import { CIRCLE_CENTER, CIRCLE_RADIUS, DEFAULT_TOLERANCE, EMPTY_COUNTS, bumpCounts } from './types';
import type {
  AddSubState,
  CompareBar,
  CompareState,
  Cut,
  DecimalGridState,
  DiscreteState,
  FractionModelAction,
  FractionModelConfig,
  FractionModelState,
  FractionMode,
  FractionShape,
  MixedState,
  OverlayState,
  PartitionState,
  ShadeState,
  SimplifyState,
} from './types';

const MAX_PARTS = 144;
const MIN_PARTS = 1;

/** 설정 키를 보고 모드를 고른다. `mode`가 있으면 그것을 따른다. */
export function inferMode(config: FractionModelConfig): FractionMode {
  if (config.mode !== undefined) return config.mode;
  if (config.bars !== undefined) return 'compare';
  if (config.items !== undefined) return 'discrete';
  if (
    config.direction !== undefined ||
    config.value !== undefined ||
    config.wholeShape !== undefined
  ) {
    return 'mixed';
  }
  if (
    config.op !== undefined ||
    config.fuseWhole !== undefined ||
    config.allowBreakWhole !== undefined ||
    config.strategyChoice !== undefined ||
    config.requireCommonGrid !== undefined
  ) {
    return 'add-sub';
  }
  if (config.challenge !== undefined || (config.a !== undefined && config.b !== undefined)) {
    return 'overlay-slicer';
  }
  if (config.whole !== undefined || config.target !== undefined || config.refine !== undefined) {
    return 'shade';
  }
  if (config.size !== undefined || config.layers !== undefined) return 'decimal-grid';
  return 'partition';
}

function partsOf(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return clamp(Math.trunc(value), MIN_PARTS, MAX_PARTS);
}

function normalizedOp(op: FractionModelConfig['op']): '+' | '-' {
  return op === '-' || op === 'sub' ? '-' : '+';
}

function validShaded(indices: readonly number[] | undefined, parts: number): number[] {
  if (!indices) return [];
  return [
    ...new Set(indices.filter((index) => Number.isInteger(index) && index >= 0 && index < parts)),
  ].sort((a, b) => a - b);
}

function toggleIndex(list: readonly number[], index: number): number[] {
  if (list.includes(index)) return list.filter((value) => value !== index);
  return [...list, index].sort((a, b) => a - b);
}

function boundingBox(outline: readonly Point[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  const xs = outline.map((point) => point.x);
  const ys = outline.map((point) => point.y);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
}

/** 세로선과 도형 외곽선의 교점. 미리 n등분한 칼선을 만들 때 쓴다. */
function verticalSpan(outline: readonly Point[], x: number): [number, number] | null {
  const ys: number[] = [];
  for (let i = 0; i < outline.length; i += 1) {
    const a = outline[i];
    const b = outline[(i + 1) % outline.length];
    if (!a || !b) continue;
    const low = Math.min(a.x, b.x);
    const high = Math.max(a.x, b.x);
    if (x < low - 1e-6 || x > high + 1e-6) continue;
    if (Math.abs(b.x - a.x) < 1e-9) {
      ys.push(a.y, b.y);
      continue;
    }
    const t = (x - a.x) / (b.x - a.x);
    if (t < -1e-6 || t > 1 + 1e-6) continue;
    ys.push(a.y + (b.y - a.y) * t);
  }
  if (ys.length < 2) return null;
  return [Math.min(...ys), Math.max(...ys)];
}

/** `fixedParts`용 미리 n등분된 칼선. 원은 방사형, 나머지는 세로 칼선. */
function presetCuts(shape: FractionShape, outline: readonly Point[], parts: number): Cut[] {
  if (parts <= 1) return [];
  if (shape === 'circle') {
    const cuts: Cut[] = [];
    for (let k = 0; k < parts; k += 1) {
      const angle = -Math.PI / 2 + (Math.PI * 2 * k) / parts;
      cuts.push({
        id: `preset-${k + 1}`,
        tool: 'radial',
        points: [
          { ...CIRCLE_CENTER },
          {
            x: CIRCLE_CENTER.x + CIRCLE_RADIUS * Math.cos(angle),
            y: CIRCLE_CENTER.y + CIRCLE_RADIUS * Math.sin(angle),
          },
        ],
      });
    }
    return cuts;
  }
  const box = boundingBox(outline);
  const cuts: Cut[] = [];
  for (let k = 1; k < parts; k += 1) {
    const x = box.minX + ((box.maxX - box.minX) * k) / parts;
    const span = verticalSpan(outline, x);
    if (!span) continue;
    cuts.push({
      id: `preset-${k}`,
      tool: 'line',
      points: [
        { x, y: span[0] },
        { x, y: span[1] },
      ],
    });
  }
  return cuts;
}

function simplifyFrom(config: FractionModelConfig): SimplifyState | null {
  if (config.fraction === undefined) return null;
  // 약분 탐정은 "18/24"의 표기 그대로 24칸 막대를 보여 줘야 하므로
  // Rational.parse(약분됨)가 아니라 원래 분자·분모를 읽는다.
  const raw = /^(\d+)\s*\/\s*(\d+)$/.exec(config.fraction.trim());
  let numerator: number | null;
  let denominator: number | null;
  if (raw?.[1] && raw[2]) {
    numerator = Number(raw[1]);
    denominator = Number(raw[2]);
  } else {
    const fraction = parseRational(config.fraction);
    if (!fraction) return null;
    numerator = numeratorNumber(fraction);
    denominator = denominatorNumber(fraction);
  }
  if (numerator === null || denominator === null || denominator <= 0) return null;
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator)) return null;
  if (numerator < 0 || numerator > denominator) return null;
  if (denominator > MAX_PARTS) return null;
  return { numerator, denominator, groupSize: null };
}

function createPartition(config: FractionModelConfig): PartitionState {
  const hasFraction = parseRational(config.fraction) !== null;
  const shape: FractionShape = config.shape ?? (hasFraction ? 'bar' : 'rect');
  const outline = outlineFor(shape, config.polygonPoints);
  const simplify = simplifyFrom(config);
  const fixedParts = simplify
    ? simplify.denominator
    : config.fixedParts !== undefined && config.fixedParts > 1
      ? partsOf(config.fixedParts, 1)
      : null;
  const cuts = fixedParts !== null ? presetCuts(shape, outline, fixedParts) : [];
  const totalPieces = fixedParts ?? 1;
  const shaded = simplify ? validShaded(range(simplify.numerator), totalPieces) : [];
  return {
    mode: 'partition',
    shape,
    outline,
    cuts,
    shaded,
    nextCutId: cuts.length + 1,
    fixedParts,
    simplify,
    tolerance:
      config.areaTolerance !== undefined && config.areaTolerance > 0
        ? config.areaTolerance
        : DEFAULT_TOLERANCE,
    counters: EMPTY_COUNTS,
  };
}

function range(count: number): number[] {
  return Array.from({ length: Math.max(0, count) }, (_, index) => index);
}

function createShade(config: FractionModelConfig): ShadeState {
  const whole = config.whole;
  const shape: FractionShape = whole?.shape ?? config.shape ?? 'bar';
  const parts = partsOf(whole?.partsX ?? config.targetParts, 4);
  return {
    mode: 'shade',
    shape,
    parts,
    shaded: validShaded(whole?.shaded, parts),
    counters: EMPTY_COUNTS,
  };
}

function createCompare(config: FractionModelConfig): CompareState {
  const bars: CompareBar[] =
    config.bars && config.bars.length > 0
      ? config.bars.map((bar) => {
          const parts = partsOf(bar.parts, 1);
          return {
            parts,
            shaded: validShaded(bar.shaded, parts),
            ...(bar.label !== undefined ? { label: bar.label } : {}),
          };
        })
      : [
          { parts: 2, shaded: [0] },
          { parts: 3, shaded: [0, 1] },
        ];
  return {
    mode: 'compare',
    bars,
    align: config.align ?? 'left',
    selectedBar: null,
    counters: EMPTY_COUNTS,
  };
}

function createOverlay(config: FractionModelConfig): OverlayState {
  const a = parseFraction(config.a, '1/2');
  const b = parseFraction(config.b, '1/3');
  return {
    mode: 'overlay-slicer',
    a: a.toString(),
    b: b.toString(),
    shape: config.shape ?? 'square',
    orientation: {
      a: config.orientation?.a ?? 'horizontal',
      b: config.orientation?.b ?? 'vertical',
    },
    overlaid: false,
    grid: null,
    counters: EMPTY_COUNTS,
  };
}

function createDiscrete(config: FractionModelConfig): DiscreteState {
  const items = partsOf(config.items, 12);
  const options = config.groupSizeOptions ?? [2, 3, 4, 6];
  const groupSize = options.find((size) => size > 0 && items % size === 0) ?? items;
  return {
    mode: 'discrete',
    items,
    groupSize,
    selectedGroups: [],
    icon: config.itemIcon ?? 'candy',
    showFractionOf: config.showFractionOf ?? true,
    counters: EMPTY_COUNTS,
  };
}

function createMixed(config: FractionModelConfig): MixedState {
  const isProblem =
    config.a !== undefined && config.b !== undefined && config.direction === undefined;
  if (isProblem) {
    const a = parseFraction(config.a, '1/2');
    const b = parseFraction(config.b, '1/3');
    const wholePart = Number(a.integerPart());
    const fractionPart = a.sub(Rational.of(a.integerPart()));
    return {
      mode: 'mixed',
      kind: 'problem',
      shape: config.wholeShape ?? 'bar',
      denominator: denominatorNumber(a) ?? 2,
      wholes: wholePart,
      pieces: numeratorNumber(fractionPart) ?? 0,
      allowBreakWhole: config.allowBreakWhole ?? config.breakWhole ?? false,
      a: a.toString(),
      b: b.toString(),
      op: normalizedOp(config.op),
      commonGrid: config.commonGrid ?? null,
      combined: false,
      result: null,
      borrowed: false,
      naturalPart: null,
      pieceCount: null,
      pieceDenominator: null,
      counters: EMPTY_COUNTS,
    };
  }

  const direction = config.direction ?? 'improper-to-mixed';
  const value = parseFraction(config.value, direction === 'improper-to-mixed' ? '11/4' : '2 1/3');
  const denominator = denominatorNumber(value) ?? 4;
  if (direction === 'improper-to-mixed') {
    const numerator = numeratorNumber(value) ?? denominator;
    return {
      mode: 'mixed',
      kind: 'convert',
      shape: config.wholeShape ?? 'circle',
      denominator,
      wholes: 0,
      pieces: numerator,
      allowBreakWhole: false,
      a: null,
      b: null,
      op: null,
      commonGrid: null,
      combined: false,
      result: null,
      borrowed: false,
      naturalPart: null,
      pieceCount: null,
      pieceDenominator: null,
      counters: EMPTY_COUNTS,
    };
  }

  const mixed = value.toMixed();
  return {
    mode: 'mixed',
    kind: 'convert',
    shape: config.wholeShape ?? 'circle',
    denominator,
    wholes: Number(mixed.whole),
    pieces: Number(mixed.num),
    allowBreakWhole: config.allowBreakWhole ?? config.breakWhole ?? true,
    a: null,
    b: null,
    op: null,
    commonGrid: null,
    combined: false,
    result: null,
    borrowed: false,
    naturalPart: null,
    pieceCount: null,
    pieceDenominator: null,
    counters: EMPTY_COUNTS,
  };
}

function createAddSub(config: FractionModelConfig): AddSubState {
  const a = parseFraction(config.a, '2/5');
  const b = parseFraction(config.b, config.op === 'sub' || config.op === '-' ? '1/5' : '4/5');
  return {
    mode: 'add-sub',
    op: normalizedOp(config.op),
    a: a.toString(),
    b: b.toString(),
    shape: config.shape ?? 'bar',
    commonGrid: config.commonGrid ?? null,
    combined: false,
    result: null,
    strategy: null,
    allowBreakWhole: config.allowBreakWhole ?? false,
    requireCommonGrid: config.requireCommonGrid ?? false,
    borrowed: false,
    counters: EMPTY_COUNTS,
  };
}

function createDecimalGrid(config: FractionModelConfig): DecimalGridState {
  const size = clamp(Math.trunc(config.size ?? 10), 2, 20);
  const layers = clamp(Math.trunc(config.layers ?? 2), 1, 3);
  return {
    mode: 'decimal-grid',
    size,
    layers,
    shaded: [],
    layer: 0,
    overlayAlpha:
      config.overlayAlpha !== undefined && config.overlayAlpha >= 0 && config.overlayAlpha <= 1
        ? config.overlayAlpha
        : 0.35,
    counters: EMPTY_COUNTS,
  };
}

export function createInitialState(config: FractionModelConfig): FractionModelState {
  switch (inferMode(config)) {
    case 'partition':
      return createPartition(config);
    case 'shade':
      return createShade(config);
    case 'compare':
      return createCompare(config);
    case 'overlay-slicer':
      return createOverlay(config);
    case 'discrete':
      return createDiscrete(config);
    case 'mixed':
      return createMixed(config);
    case 'add-sub':
      return createAddSub(config);
    case 'decimal-grid':
      return createDecimalGrid(config);
  }
}

/** partition 모드의 현재 조각들. 원은 부채꼴 넓이로 계산한다. */
export function piecesOf(state: PartitionState): Piece[] {
  if (state.shape === 'circle' && state.cuts.length > 0) {
    return circleSectors(CIRCLE_CENTER, CIRCLE_RADIUS, state.cuts);
  }
  if (state.cuts.length === 0) {
    return [
      {
        points: state.outline,
        area: polygonArea(state.outline),
        centroid: polygonCentroid(state.outline),
      },
    ];
  }
  return partitionPieces(state.outline, state.cuts, state.shape);
}

function reducePartition(state: PartitionState, action: FractionModelAction): PartitionState {
  if (state.simplify) {
    if (action.type === 'set-group-size') {
      const size = Math.max(1, Math.trunc(action.size));
      return {
        ...state,
        simplify: { ...state.simplify, groupSize: size },
        counters: bumpCounts(state.counters, 'valueChanged'),
      };
    }
    if (action.type === 'shade-piece') {
      // 약분 탐정은 칸을 칠하는 과제가 아니다. 무시한다.
      return state;
    }
  }

  switch (action.type) {
    case 'cut': {
      if (action.points.length !== 2) return state;
      if (samePoint(action.points[0], action.points[1])) return state;
      const cut: Cut = {
        id: `c${state.nextCutId}`,
        tool: action.tool,
        points: action.points,
      };
      return {
        ...state,
        cuts: [...state.cuts, cut],
        nextCutId: state.nextCutId + 1,
        counters: bumpCounts(state.counters, 'partitioned'),
      };
    }
    case 'clear-cuts':
      return {
        ...state,
        cuts: [],
        shaded: [],
      };
    case 'shade-piece': {
      if (!Number.isInteger(action.index) || action.index < 0) return state;
      return {
        ...state,
        shaded: toggleIndex(state.shaded, action.index),
        counters: bumpCounts(bumpCounts(state.counters, 'shaded'), 'valueChanged'),
      };
    }
    default:
      return state;
  }
}

function reduceShade(state: ShadeState, action: FractionModelAction): ShadeState {
  switch (action.type) {
    case 'toggle-part': {
      if (!Number.isInteger(action.index) || action.index < 0 || action.index >= state.parts) {
        return state;
      }
      return {
        ...state,
        shaded: toggleIndex(state.shaded, action.index),
        counters: bumpCounts(bumpCounts(state.counters, 'shaded'), 'valueChanged'),
      };
    }
    case 'refine': {
      const factor = action.factor;
      if (factor <= 1) return state;
      const parts = state.parts * factor;
      if (parts > MAX_PARTS) return state;
      const shaded = state.shaded.flatMap((index) => range(factor).map((k) => index * factor + k));
      return {
        ...state,
        parts,
        shaded: validShaded(shaded, parts),
        counters: bumpCounts(bumpCounts(state.counters, 'refined'), 'valueChanged'),
      };
    }
    case 'coarsen': {
      const factor = Math.trunc(action.factor);
      if (factor <= 1 || state.parts % factor !== 0) return state;
      const parts = state.parts / factor;
      const next: number[] = [];
      for (let group = 0; group < parts; group += 1) {
        const cells = range(factor).map((k) => group * factor + k);
        const shadedCount = cells.filter((cell) => state.shaded.includes(cell)).length;
        if (shadedCount === 0) continue;
        if (shadedCount !== factor) return state;
        next.push(group);
      }
      return {
        ...state,
        parts,
        shaded: next,
        counters: bumpCounts(bumpCounts(state.counters, 'coarsened'), 'valueChanged'),
      };
    }
    case 'set-shade-value': {
      const value = parseRational(action.value);
      if (!value || value.isNegative() || value.compareTo(Rational.of(1)) > 0) return state;
      const denominator = denominatorNumber(value);
      if (denominator === null || state.parts % denominator !== 0) return state;
      const cells = (numeratorNumber(value) ?? 0) * (state.parts / denominator);
      if (cells < 0 || cells > state.parts) return state;
      return {
        ...state,
        shaded: range(cells).slice(0, state.parts),
        counters: bumpCounts(state.counters, 'valueChanged'),
      };
    }
    default:
      return state;
  }
}

function reduceCompare(state: CompareState, action: FractionModelAction): CompareState {
  switch (action.type) {
    case 'select-bar': {
      if (
        !Number.isInteger(action.index) ||
        action.index < 0 ||
        action.index >= state.bars.length
      ) {
        return state;
      }
      return { ...state, selectedBar: action.index };
    }
    case 'toggle-bar-part': {
      const bar = state.bars[action.bar];
      if (!bar) return state;
      if (!Number.isInteger(action.index) || action.index < 0 || action.index >= bar.parts) {
        return state;
      }
      const bars = state.bars.map((candidate, index) =>
        index === action.bar
          ? { ...candidate, shaded: toggleIndex(candidate.shaded, action.index) }
          : candidate,
      );
      return {
        ...state,
        bars,
        counters: bumpCounts(bumpCounts(state.counters, 'shaded'), 'valueChanged'),
      };
    }
    case 'set-bar-value': {
      const bar = state.bars[action.bar];
      const value = parseRational(action.value);
      if (!bar || !value || value.isNegative() || value.compareTo(Rational.of(1)) > 0) {
        return state;
      }
      const denominator = denominatorNumber(value);
      if (denominator === null || bar.parts % denominator !== 0) return state;
      const cells = (numeratorNumber(value) ?? 0) * (bar.parts / denominator);
      if (cells < 0 || cells > bar.parts) return state;
      const bars = state.bars.map((candidate, index) =>
        index === action.bar
          ? { ...candidate, shaded: Array.from({ length: cells }, (_, cell) => cell) }
          : candidate,
      );
      return {
        ...state,
        bars,
        counters: bumpCounts(bumpCounts(state.counters, 'shaded'), 'valueChanged'),
      };
    }
    case 'set-align':
      return { ...state, align: action.align };
    default:
      return state;
  }
}

function gridFor(a: Rational, b: Rational, preferMinimum: boolean): number | null {
  const da = denominatorNumber(a);
  const db = denominatorNumber(b);
  if (da === null || db === null) return null;
  if (preferMinimum) return lcm(da, db);
  const product = da * db;
  return Number.isSafeInteger(product) && product > 0 ? product : null;
}

function greatestCommonGrid(a: Rational, b: Rational): number | null {
  return gridFor(a, b, false);
}

function reduceOverlay(state: OverlayState, action: FractionModelAction): OverlayState {
  const a = parseFraction(state.a, '1/2');
  const b = parseFraction(state.b, '1/3');
  switch (action.type) {
    case 'overlay': {
      if (state.overlaid) {
        return { ...state, overlaid: false, grid: null };
      }
      const grid = greatestCommonGrid(a, b);
      return {
        ...state,
        overlaid: true,
        grid,
        counters: bumpCounts(bumpCounts(state.counters, 'overlaid'), 'valueChanged'),
      };
    }
    case 'set-grid': {
      const size = Math.trunc(action.size);
      const da = denominatorNumber(a);
      const db = denominatorNumber(b);
      if (da === null || db === null || size <= 0) return state;
      if (size % da !== 0 || size % db !== 0) return state;
      const wasOverlaid = state.overlaid;
      return {
        ...state,
        overlaid: true,
        grid: size,
        counters: wasOverlaid
          ? bumpCounts(state.counters, 'valueChanged')
          : bumpCounts(bumpCounts(state.counters, 'overlaid'), 'valueChanged'),
      };
    }
    default:
      return state;
  }
}

function reduceDiscrete(state: DiscreteState, action: FractionModelAction): DiscreteState {
  switch (action.type) {
    case 'set-group-size': {
      const size = Math.trunc(action.size);
      if (size <= 0 || size > state.items || state.items % size !== 0) return state;
      return { ...state, groupSize: size, selectedGroups: [] };
    }
    case 'toggle-group': {
      const groups = Math.floor(state.items / state.groupSize);
      if (!Number.isInteger(action.index) || action.index < 0 || action.index >= groups) {
        return state;
      }
      return {
        ...state,
        selectedGroups: toggleIndex(state.selectedGroups, action.index),
        counters: bumpCounts(bumpCounts(state.counters, 'shaded'), 'valueChanged'),
      };
    }
    default:
      return state;
  }
}

function reduceMixedConvert(state: MixedState, action: FractionModelAction): MixedState {
  switch (action.type) {
    case 'fuse': {
      if (state.pieces < state.denominator) return state;
      return {
        ...state,
        wholes: state.wholes + 1,
        pieces: state.pieces - state.denominator,
        counters: bumpCounts(bumpCounts(state.counters, 'fused'), 'valueChanged'),
      };
    }
    case 'break-whole': {
      if (!state.allowBreakWhole || state.wholes <= 0) return state;
      return {
        ...state,
        wholes: state.wholes - 1,
        pieces: state.pieces + state.denominator,
        counters: bumpCounts(bumpCounts(state.counters, 'brokeWhole'), 'valueChanged'),
      };
    }
    default:
      return state;
  }
}

function reduceMixedProblem(state: MixedState, action: FractionModelAction): MixedState {
  if (action.type === 'break-whole') {
    if (!state.allowBreakWhole || state.borrowed || state.wholes <= 0) return state;
    const a = parseFraction(state.a ?? undefined, '1/2');
    const b = parseFraction(state.b ?? undefined, '1/3');
    const grid =
      state.commonGrid !== null && state.commonGrid > 0
        ? state.commonGrid
        : lcm(denominatorNumber(a) ?? 1, denominatorNumber(b) ?? 1);
    if (grid <= 0) return state;
    const fractionPart = a.sub(Rational.of(a.integerPart()));
    const scaled = fractionPart.mul(Rational.of(grid));
    const fractionDen = denominatorNumber(scaled);
    const fractionNum = numeratorNumber(scaled);
    if (fractionDen !== 1 || fractionNum === null || fractionNum < 0) return state;
    const fractionPieces = fractionNum;
    return {
      ...state,
      commonGrid: grid,
      borrowed: true,
      naturalPart: state.wholes - 1,
      pieceCount: grid + fractionPieces,
      pieceDenominator: grid,
      counters: bumpCounts(bumpCounts(state.counters, 'brokeWhole'), 'valueChanged'),
    };
  }
  if (action.type !== 'combine') return state;
  const a = parseFraction(state.a ?? undefined, '1/2');
  const b = parseFraction(state.b ?? undefined, '1/3');
  const op = state.op ?? '+';
  const result = op === '-' ? a.sub(b) : a.add(b);
  const fractionA = a.sub(Rational.of(a.integerPart()));
  const fractionB = b.sub(Rational.of(b.integerPart()));
  const carry = op === '+' && fractionA.add(fractionB).compareTo(Rational.of(1)) >= 0;
  return {
    ...state,
    combined: true,
    result: result.toString(),
    counters: bumpCounts(
      carry ? bumpCounts(state.counters, 'fused') : state.counters,
      'valueChanged',
    ),
  };
}

function reduceMixed(state: MixedState, action: FractionModelAction): MixedState {
  return state.kind === 'problem'
    ? reduceMixedProblem(state, action)
    : reduceMixedConvert(state, action);
}

function reduceAddSub(state: AddSubState, action: FractionModelAction): AddSubState {
  const a = parseFraction(state.a, '0');
  const b = parseFraction(state.b, '0');
  switch (action.type) {
    case 'overlay': {
      const grid = lcm(denominatorNumber(a) ?? 1, denominatorNumber(b) ?? 1);
      if (grid <= 0) return state;
      return {
        ...state,
        commonGrid: grid,
        counters: bumpCounts(bumpCounts(state.counters, 'overlaid'), 'valueChanged'),
      };
    }
    case 'set-grid': {
      const size = Math.trunc(action.size);
      const da = denominatorNumber(a);
      const db = denominatorNumber(b);
      if (da === null || db === null || size <= 0 || size % da !== 0 || size % db !== 0) {
        return state;
      }
      const wasOverlaid = state.commonGrid !== null;
      return {
        ...state,
        commonGrid: size,
        counters: wasOverlaid
          ? bumpCounts(state.counters, 'valueChanged')
          : bumpCounts(bumpCounts(state.counters, 'overlaid'), 'valueChanged'),
      };
    }
    case 'break-whole': {
      if (!state.allowBreakWhole) return state;
      return {
        ...state,
        borrowed: true,
        counters: bumpCounts(bumpCounts(state.counters, 'brokeWhole'), 'valueChanged'),
      };
    }
    case 'set-strategy':
      return { ...state, strategy: action.strategy };
    case 'combine': {
      if (state.requireCommonGrid && state.commonGrid === null) return state;
      const result = state.op === '-' ? a.sub(b) : a.add(b);
      const fractionA = a.sub(Rational.of(a.integerPart()));
      const fractionB = b.sub(Rational.of(b.integerPart()));
      const carry = state.op === '+' && fractionA.add(fractionB).compareTo(Rational.of(1)) >= 0;
      return {
        ...state,
        combined: true,
        result: result.toString(),
        counters: bumpCounts(
          carry ? bumpCounts(state.counters, 'fused') : state.counters,
          'valueChanged',
        ),
      };
    }
    default:
      return state;
  }
}

function cellIndex(state: DecimalGridState, layer: number, row: number, column: number): number {
  return layer * state.size * state.size + row * state.size + column;
}

function reduceDecimalGrid(state: DecimalGridState, action: FractionModelAction): DecimalGridState {
  const total = state.size * state.size * state.layers;
  switch (action.type) {
    case 'toggle-cell': {
      if (!Number.isInteger(action.index) || action.index < 0 || action.index >= total)
        return state;
      return {
        ...state,
        shaded: toggleIndex(state.shaded, action.index),
        counters: bumpCounts(bumpCounts(state.counters, 'shaded'), 'valueChanged'),
      };
    }
    case 'shade-row': {
      const row = Math.trunc(action.row);
      if (row < 0 || row >= state.size) return state;
      const cells = range(state.size).map((column) => cellIndex(state, state.layer, row, column));
      const allSelected = cells.every((cell) => state.shaded.includes(cell));
      const shaded = allSelected
        ? state.shaded.filter((cell) => !cells.includes(cell))
        : [...new Set([...state.shaded, ...cells])].sort((left, right) => left - right);
      return {
        ...state,
        shaded,
        counters: bumpCounts(bumpCounts(state.counters, 'shaded'), 'valueChanged'),
      };
    }
    case 'set-layer':
      return { ...state, layer: clamp(Math.trunc(action.layer), 0, state.layers - 1) };
    case 'clear-cells':
      return { ...state, shaded: [] };
    default:
      return state;
  }
}

export function reduce(state: FractionModelState, action: FractionModelAction): FractionModelState {
  switch (state.mode) {
    case 'partition':
      return reducePartition(state, action);
    case 'shade':
      return reduceShade(state, action);
    case 'compare':
      return reduceCompare(state, action);
    case 'overlay-slicer':
      return reduceOverlay(state, action);
    case 'discrete':
      return reduceDiscrete(state, action);
    case 'mixed':
      return reduceMixed(state, action);
    case 'add-sub':
      return reduceAddSub(state, action);
    case 'decimal-grid':
      return reduceDecimalGrid(state, action);
  }
}

/** predicate·View가 쓰는 파생값. 상태를 바꾸지 않는다. */
export function simplifyView(state: PartitionState): {
  groupSize: number | null;
  groupCount: number;
  groupedNumerator: number | null;
  groupedDenominator: number | null;
  irreducible: boolean;
} {
  const simplify = state.simplify;
  if (!simplify) {
    const parts = Math.max(1, piecesOf(state).length);
    return {
      groupSize: null,
      groupCount: 0,
      groupedNumerator: null,
      groupedDenominator: null,
      irreducible: gcd(state.shaded.length, parts) === 1,
    };
  }
  const base = gcd(simplify.numerator, simplify.denominator);
  if (
    simplify.groupSize !== null &&
    simplify.groupSize > 1 &&
    simplify.numerator % simplify.groupSize === 0 &&
    simplify.denominator % simplify.groupSize === 0
  ) {
    const numerator = simplify.numerator / simplify.groupSize;
    const denominator = simplify.denominator / simplify.groupSize;
    return {
      groupSize: simplify.groupSize,
      groupCount: simplify.groupSize,
      groupedNumerator: numerator,
      groupedDenominator: denominator,
      irreducible: gcd(numerator, denominator) === 1,
    };
  }
  return {
    groupSize: simplify.groupSize,
    groupCount: base,
    groupedNumerator: null,
    groupedDenominator: null,
    irreducible: base === 1,
  };
}

export function overlayCells(state: OverlayState): { a: number; b: number } | null {
  if (state.grid === null) return null;
  const a = parseFraction(state.a, '1/2');
  const b = parseFraction(state.b, '1/3');
  const aDen = denominatorNumber(a);
  const bDen = denominatorNumber(b);
  const aNum = numeratorNumber(a);
  const bNum = numeratorNumber(b);
  if (aDen === null || bDen === null || aNum === null || bNum === null) return null;
  if (state.grid % aDen !== 0 || state.grid % bDen !== 0) return null;
  return {
    a: aNum * (state.grid / aDen),
    b: bNum * (state.grid / bDen),
  };
}

export { boundaryCandidates, circleCandidates };
