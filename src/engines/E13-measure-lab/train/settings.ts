/**
 * E13 unit-train 설정 검사·정리. 길이 문자열("1m 70cm", "205cm", "3m")을 파싱하고
 * 처음 기차를 만든다. 값은 모두 정수라 부동소수가 끼지 않는다.
 */
import { E13_STRINGS as S } from '../strings.ko';
import type { Length, TrainConfig, TrainState } from './types';

/** 길이는 10m 미만이다(0 ≤ 값 < 10m). */
export const MAX_TOTAL_CM = 1000;

const LENGTH_PATTERN = /^\s*(?:(\d{1,4})\s*m)?\s*(?:(\d{1,4})\s*cm)?\s*$/;

/** "1m 70cm"·"205cm"·"3m"을 읽는다. 형식이 틀리거나 10m 이상이면 null. */
export function parseLength(text: unknown): Length | null {
  if (typeof text !== 'string') return null;
  const match = LENGTH_PATTERN.exec(text);
  if (match === null || (match[1] === undefined && match[2] === undefined)) return null;
  const m = match[1] === undefined ? 0 : Number(match[1]);
  const cm = match[2] === undefined ? 0 : Number(match[2]);
  if (100 * m + cm >= MAX_TOTAL_CM) return null;
  return { m, cm };
}

export function totalCm(length: Length): number {
  return 100 * length.m + length.cm;
}

/** 화면에 쓰는 길이 글: "2m 60cm", "3m", "205cm". */
export function formatLength(length: Length): string {
  if (length.m > 0 && length.cm > 0) return `${length.m}m ${length.cm}cm`;
  if (length.m > 0) return `${length.m}m`;
  return `${length.cm}cm`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 설정이 `mode`·`variant`뿐이면 샌드박스 기본(1m 70cm + 2m 50cm)을 쓴다. */
export function sandboxDefault(): TrainConfig {
  return { mode: 'length', variant: 'unit-train', op: 'add', a: '1m 70cm', b: '2m 50cm' };
}

function failure(): TrainState {
  return {
    mode: 'length',
    variant: 'unit-train',
    error: S.configError,
    op: 'add',
    b: { m: 0, cm: 0 },
    bText: '',
    initial: { m: 0, rods: 0, blocks: 0 },
    m: 0,
    rods: 0,
    blocks: 0,
    promotes: 0,
    unpacks: 0,
    tookAway: false,
    moves: 0,
  };
}

export function normalizeTrain(config: TrainConfig): TrainState {
  const source: unknown =
    isRecord(config) && Object.keys(config).every((key) => key === 'mode' || key === 'variant')
      ? sandboxDefault()
      : config;
  if (!isRecord(source) || source['variant'] !== 'unit-train') return failure();
  const op = source['op'];
  if (op !== 'add' && op !== 'sub') return failure();
  const a = parseLength(source['a']);
  const b = parseLength(source['b']);
  if (a === null || b === null) return failure();
  if (op === 'sub' && totalCm(a) < totalCm(b)) return failure();
  // add는 두 길이의 칸을 처음부터 한 기차에 합쳐 놓는다(m과 cm를 따로 더한, 정규화 전 상태).
  const parts = op === 'add' ? [a, b] : [a];
  const initial = {
    m: parts.reduce((sum, part) => sum + part.m, 0),
    rods: parts.reduce((sum, part) => sum + Math.floor(part.cm / 10), 0),
    blocks: parts.reduce((sum, part) => sum + (part.cm % 10), 0),
  };
  return {
    mode: 'length',
    variant: 'unit-train',
    error: null,
    op,
    b,
    bText: op === 'sub' ? formatLength(b) : '',
    initial,
    ...initial,
    promotes: 0,
    unpacks: 0,
    tookAway: false,
    moves: 0,
  };
}

/** 현재 cm 줄의 값(10 × 막대 + 블록). */
export function cmOf(state: Pick<TrainState, 'rods' | 'blocks'>): number {
  return 10 * state.rods + state.blocks;
}
