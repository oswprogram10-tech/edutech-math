/**
 * E13 capacity 설정 검사·정리와 물 계산(Rational). 들이·물의 양은 정수 mL이라 부동소수가 끼지 않는다.
 */
import { Rational } from '../../../core/math';
import { rat } from '../rat';
import { E13_STRINGS as S } from '../strings.ko';
import type {
  CapacityConfig,
  CapacityContainer,
  CapacityState,
  CapacityVariant,
  ContainerKind,
  ContainerShape,
} from './types';

const MAX_ML = 99999;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,24}$/;
const KINDS: readonly string[] = ['bottle', 'bowl', 'beaker'];
const SHAPES: readonly string[] = ['tall', 'wide'];
const SUFFIX = ['가', '나'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 1 이상 MAX_ML 이하의 정수 mL(숫자 또는 정수 문자열)을 Rational로. 아니면 null. */
function ml(value: unknown): Rational | null {
  let parsed: Rational | null = null;
  if (typeof value === 'number') {
    parsed = Number.isInteger(value) ? Rational.of(value) : null;
  } else if (typeof value === 'string' && /^\d+$/.test(value)) {
    parsed = rat(value);
  }
  if (parsed === null || !parsed.isInteger() || parsed.compareTo(Rational.of(1)) < 0) return null;
  return parsed.compareTo(Rational.of(MAX_ML)) > 0 ? null : parsed;
}

/** 설정이 `mode`(와 `variant`)뿐이면 샌드박스 기본을 쓴다. */
export function sandboxDefault(variant: CapacityVariant): Record<string, unknown> {
  if (variant === 'puzzle') {
    return {
      mode: 'capacity',
      variant,
      containers: [
        { id: 'beaker-a', capacityMl: 300, marks: false },
        { id: 'beaker-b', capacityMl: 500, marks: false },
      ],
      source: 'infinite',
      targetMl: 100,
    };
  }
  return {
    mode: 'capacity',
    variant,
    containers: [
      { id: 'bottle', kind: 'bottle', shape: 'tall', capacityMl: 600 },
      { id: 'bowl', kind: 'bowl', shape: 'wide', capacityMl: 500 },
    ],
    cupMl: 100,
  };
}

function failure(variant: CapacityVariant = 'cup-count'): CapacityState {
  return {
    mode: 'capacity',
    error: S.configError,
    variant,
    containers: [],
    cupMl: '0',
    targetMl: '0',
    amounts: {},
    steps: 0,
    moves: 0,
  };
}

export function normalizeCapacity(config: CapacityConfig): CapacityState {
  if (!isRecord(config)) return failure();
  const variantRaw = config['variant'] === undefined ? 'cup-count' : config['variant'];
  if (variantRaw !== 'cup-count' && variantRaw !== 'puzzle') return failure();
  const variant: CapacityVariant = variantRaw;
  const bare = Object.keys(config).every((key) => key === 'mode' || key === 'variant');
  const source: Record<string, unknown> = bare ? sandboxDefault(variant) : config;

  const raw = source['containers'];
  if (!Array.isArray(raw)) return failure(variant);
  const count = raw.length;
  if (variant === 'puzzle' ? count !== 2 : count < 1 || count > 2) return failure(variant);

  const ids = new Set<string>();
  const parsed: Omit<CapacityContainer, 'label'>[] = [];
  const labels: (string | undefined)[] = [];
  for (const entry of raw as unknown[]) {
    if (!isRecord(entry)) return failure(variant);
    const id = entry['id'];
    if (typeof id !== 'string' || !ID_PATTERN.test(id) || ids.has(id)) return failure(variant);
    ids.add(id);
    const capacity = ml(entry['capacityMl']);
    if (capacity === null) return failure(variant);
    const kindRaw = entry['kind'] === undefined ? 'beaker' : entry['kind'];
    const shapeRaw = entry['shape'] === undefined ? 'tall' : entry['shape'];
    if (typeof kindRaw !== 'string' || !KINDS.includes(kindRaw)) return failure(variant);
    if (typeof shapeRaw !== 'string' || !SHAPES.includes(shapeRaw)) return failure(variant);
    if (variant === 'puzzle' && entry['marks'] !== undefined && entry['marks'] !== false) {
      return failure(variant);
    }
    const label = entry['label'];
    if (label !== undefined && (typeof label !== 'string' || label === '' || label.length > 12)) {
      return failure(variant);
    }
    labels.push(typeof label === 'string' ? label : undefined);
    parsed.push({
      id,
      kind: kindRaw as ContainerKind,
      shape: shapeRaw as ContainerShape,
      capacityMl: capacity.toString(),
    });
  }
  // 이름이 없으면 종류 이름. 같은 종류가 둘이면 가·나를 붙인다.
  const containers: CapacityContainer[] = parsed.map((item, index) => {
    const given = labels[index];
    if (given !== undefined) return { ...item, label: given };
    const base = S.capacity.kindNames[item.kind] ?? item.kind;
    const same = parsed.filter((other) => other.kind === item.kind).length > 1;
    return { ...item, label: same ? `${base} ${SUFFIX[index] ?? ''}`.trim() : base };
  });
  if (new Set(containers.map((c) => c.label)).size !== containers.length) return failure(variant);

  let cupMl = '0';
  let targetMl = '0';
  if (variant === 'cup-count') {
    const cup = ml(source['cupMl'] === undefined ? 100 : source['cupMl']);
    if (cup === null) return failure(variant);
    // 마지막 컵이 넘치는 경우는 다루지 않는다: 들이는 컵의 배수여야 한다.
    for (const c of containers) {
      if (!Rational.parse(c.capacityMl).div(cup).isInteger()) return failure(variant);
    }
    cupMl = cup.toString();
  } else {
    if (source['source'] !== undefined && source['source'] !== 'infinite') return failure(variant);
    const target = ml(source['targetMl']);
    if (target === null) return failure(variant);
    let biggest = Rational.of(0);
    for (const c of containers) {
      const cap = Rational.parse(c.capacityMl);
      if (cap.compareTo(biggest) > 0) biggest = cap;
    }
    if (target.compareTo(biggest) > 0) return failure(variant);
    targetMl = target.toString();
  }

  return {
    mode: 'capacity',
    error: null,
    variant,
    containers,
    cupMl,
    targetMl,
    amounts: Object.fromEntries(containers.map((c) => [c.id, '0'])),
    steps: 0,
    moves: 0,
  };
}

export function containerOf(
  state: Pick<CapacityState, 'containers'>,
  id: unknown,
): CapacityContainer | undefined {
  return state.containers.find((c) => c.id === id);
}

export function amountOf(state: Pick<CapacityState, 'amounts'>, id: string): Rational {
  return Rational.parse(state.amounts[id] ?? '0');
}

export function capacityOf(c: CapacityContainer): Rational {
  return Rational.parse(c.capacityMl);
}

export function isFull(state: CapacityState, c: CapacityContainer): boolean {
  return amountOf(state, c.id).compareTo(capacityOf(c)) >= 0;
}

export function isEmpty(state: CapacityState, id: string): boolean {
  return amountOf(state, id).isZero();
}

/** 그릇의 물 높이 비율(0~1). 화면 그림용 number. */
export function fillRatio(state: CapacityState, c: CapacityContainer): number {
  const amount = amountOf(state, c.id);
  const cap = capacityOf(c);
  return Number(amount.n * cap.d) / Number(amount.d * cap.n);
}

/** 컵으로 부은 횟수(cup-count). 들이가 컵의 배수라 정수다. */
export function cupsOf(state: CapacityState, id: string): number {
  const cup = Rational.parse(state.cupMl);
  if (cup.isZero()) return 0;
  return Number(amountOf(state, id).div(cup).integerPart());
}
