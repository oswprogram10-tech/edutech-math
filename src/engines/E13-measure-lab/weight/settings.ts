/**
 * E13 weight 설정 검사·정리와 무게 계산(Rational). 무게는 정수 g라 부동소수가 끼지 않는다.
 */
import { Rational } from '../../../core/math';
import { rat } from '../rat';
import { E13_STRINGS as S } from '../strings.ko';
import type {
  ObjectKind,
  VisualSize,
  WeightConfig,
  WeightObject,
  WeightState,
  WeightTool,
} from './types';

const MAX_G = 99999;
/** 오른쪽 접시에 쌓을 수 있는 클립 수의 끝. */
export const MAX_CLIPS = 40;
export const MAX_OBJECTS = 6;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,24}$/;
const KINDS: readonly string[] = ['beachball', 'iron-ball', 'book', 'apple', 'pencil-case', 'bag'];
const SIZES: readonly string[] = ['small', 'medium', 'large'];
const TOOLS: readonly string[] = ['pan-balance', 'spring-scale'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 1 이상 MAX_G 이하의 정수 g(숫자 또는 정수 문자열)를 Rational로. 아니면 null. */
function grams(value: unknown): Rational | null {
  let parsed: Rational | null = null;
  if (typeof value === 'number') {
    parsed = Number.isInteger(value) ? Rational.of(value) : null;
  } else if (typeof value === 'string' && /^\d+$/.test(value)) {
    parsed = rat(value);
  }
  if (parsed === null || !parsed.isInteger() || parsed.compareTo(Rational.of(1)) < 0) return null;
  return parsed.compareTo(Rational.of(MAX_G)) > 0 ? null : parsed;
}

/** 설정이 `mode`뿐이면 샌드박스 기본(두 저울, 클립)을 쓴다. */
export function sandboxDefault(): Record<string, unknown> {
  return {
    mode: 'weight',
    tools: ['pan-balance', 'spring-scale'],
    objects: [
      { id: 'beachball', kind: 'beachball', g: 200, visualSize: 'large' },
      { id: 'iron-ball', kind: 'iron-ball', g: 700, visualSize: 'small' },
      { id: 'book', kind: 'book', g: 450, visualSize: 'medium' },
      { id: 'apple', kind: 'apple', g: 150, visualSize: 'small' },
    ],
    springMaxG: 1000,
    unitObjects: { clip: 50 },
    predict: false,
  };
}

function failure(): WeightState {
  return {
    mode: 'weight',
    error: S.configError,
    tools: [],
    objects: [],
    springMaxG: '1000',
    clipG: null,
    predict: false,
    left: null,
    right: null,
    clips: 0,
    hung: null,
    prediction: null,
    predictionLocked: false,
    pairs: [],
    moves: 0,
  };
}

export function normalizeWeight(config: WeightConfig): WeightState {
  if (!isRecord(config)) return failure();
  const bare = Object.keys(config).every((key) => key === 'mode');
  const source: Record<string, unknown> = bare ? sandboxDefault() : config;

  const toolsRaw = source['tools'];
  if (!Array.isArray(toolsRaw) || toolsRaw.length < 1 || toolsRaw.length > 2) return failure();
  const tools: WeightTool[] = [];
  for (const tool of toolsRaw as unknown[]) {
    if (typeof tool !== 'string' || !TOOLS.includes(tool) || tools.includes(tool as WeightTool)) {
      return failure();
    }
    tools.push(tool as WeightTool);
  }

  const raw = source['objects'];
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > MAX_OBJECTS) return failure();
  const ids = new Set<string>();
  const parsed: Omit<WeightObject, 'name'>[] = [];
  for (const entry of raw as unknown[]) {
    if (!isRecord(entry)) return failure();
    const id = entry['id'];
    const kind = entry['kind'];
    if (typeof id !== 'string' || !ID_PATTERN.test(id) || ids.has(id)) return failure();
    if (typeof kind !== 'string' || !KINDS.includes(kind)) return failure();
    const g = grams(entry['g']);
    if (g === null) return failure();
    const sizeRaw = entry['visualSize'] === undefined ? 'medium' : entry['visualSize'];
    if (typeof sizeRaw !== 'string' || !SIZES.includes(sizeRaw)) return failure();
    ids.add(id);
    parsed.push({
      id,
      kind: kind as ObjectKind,
      g: g.toString(),
      visualSize: sizeRaw as VisualSize,
    });
  }
  // 같은 종류가 여럿이면 가·나·다…를 붙여 구분한다.
  const objects: WeightObject[] = parsed.map((item, index) => {
    const base = S.weight.kindNames[item.kind] ?? item.kind;
    const same = parsed.filter((other) => other.kind === item.kind);
    const order = same.findIndex((other) => other.id === item.id);
    const suffix = same.length > 1 ? (S.weight.suffixes[order] ?? String(index + 1)) : '';
    return { ...item, name: suffix === '' ? base : `${base} ${suffix}` };
  });

  let springMax = Rational.of(1000);
  if (source['springMaxG'] !== undefined) {
    const value = grams(source['springMaxG']);
    if (
      value === null ||
      !value.div(Rational.of(100)).isInteger() ||
      value.compareTo(Rational.of(5000)) > 0
    ) {
      return failure();
    }
    springMax = value;
  }
  if (tools.includes('spring-scale')) {
    // 용수철저울 눈금 끝을 넘는 물건은 걸 수 없다.
    for (const item of objects) {
      if (Rational.parse(item.g).compareTo(springMax) > 0) return failure();
    }
  }

  let clipG: string | null = null;
  const unit = source['unitObjects'];
  if (unit !== undefined) {
    if (!isRecord(unit) || !tools.includes('pan-balance')) return failure();
    const clip = grams(unit['clip']);
    if (clip === null) return failure();
    clipG = clip.toString();
  }

  const predict = source['predict'] === undefined ? false : source['predict'];
  if (typeof predict !== 'boolean') return failure();
  // 예측은 "어느 쪽이 더 무거울까?"를 고르는 것이라 물건이 둘 이상 있어야 한다.
  if (predict && objects.length < 2) return failure();

  return {
    mode: 'weight',
    error: null,
    tools,
    objects,
    springMaxG: springMax.toString(),
    clipG,
    predict,
    left: null,
    right: null,
    clips: 0,
    hung: null,
    prediction: null,
    predictionLocked: false,
    pairs: [],
    moves: 0,
  };
}

export function objectOf(
  state: Pick<WeightState, 'objects'>,
  id: unknown,
): WeightObject | undefined {
  return state.objects.find((item) => item.id === id);
}

export function gramsOf(state: Pick<WeightState, 'objects'>, id: string | null): Rational {
  const item = id === null ? undefined : objectOf(state, id);
  return item === undefined ? Rational.of(0) : Rational.parse(item.g);
}

/** 오른쪽 접시의 무게: 물건이 있으면 그 g, 아니면 클립 수 × 클립 g. */
export function rightGrams(state: WeightState): Rational {
  if (state.right !== null) return gramsOf(state, state.right);
  if (state.clipG === null) return Rational.of(0);
  return Rational.parse(state.clipG).mul(Rational.of(state.clips));
}

export function leftGrams(state: WeightState): Rational {
  return gramsOf(state, state.left);
}

export type Tilt = 'left' | 'right' | 'level';

export interface Reading {
  readonly tilt: Tilt;
  /** 양쪽에 올린 것이 있고 무게가 같다. */
  readonly balanced: boolean;
  /** 양쪽 접시 모두 올린 것이 있다(물건 또는 클립). */
  readonly bothUsed: boolean;
}

export function readWeight(state: WeightState): Reading {
  const left = leftGrams(state);
  const right = rightGrams(state);
  const order = left.compareTo(right);
  const rightUsed = state.right !== null || state.clips > 0;
  const bothUsed = state.left !== null && rightUsed;
  return {
    tilt: order > 0 ? 'left' : order < 0 ? 'right' : 'level',
    balanced: bothUsed && order === 0,
    bothUsed,
  };
}

/** 물건이 있는 곳. */
export function placeOf(state: WeightState, id: string): 'left' | 'right' | 'spring' | 'shelf' {
  if (state.left === id) return 'left';
  if (state.right === id) return 'right';
  if (state.hung === id) return 'spring';
  return 'shelf';
}

/** 가장 무거운 물건 id. 같은 무게가 여럿이면 "". */
export function heaviestOf(state: WeightState): string {
  let best: WeightObject | undefined;
  let tie = false;
  for (const item of state.objects) {
    if (best === undefined) {
      best = item;
      continue;
    }
    const order = Rational.parse(item.g).compareTo(Rational.parse(best.g));
    if (order > 0) {
      best = item;
      tie = false;
    } else if (order === 0) {
      tie = true;
    }
  }
  return best === undefined || tie ? '' : best.id;
}

export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}
