/**
 * E19 장치(회전판·주머니)와 난수. 모두 순수 함수다.
 * 시행 결과는 Action에 실린 seed로 정한다(같은 Action 목록이면 결과가 같아 되감기·미러링이 된다).
 * 확률은 Rational(기약분수 문자열)이다.
 */
import { Rational } from '../../core/math';
import { OUTCOMES } from './types';
import type { Device, Outcome, OutcomeCounts } from './types';

/** mulberry32. 호출할 때마다 0 이상 2^32 미만의 정수를 돌려준다. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
}

export function isSeed(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < 2 ** 32;
}

/** 0 이상 total 미만의 정수 하나(편향 없이 정수 곱셈·나눗셈만 쓴다). */
export function pickBelow(raw: number, total: number): number {
  return Math.floor((raw * total) / 2 ** 32);
}

/** 장치를 한 칸씩 펼친 목록: 회전판은 칸 크기만큼, 주머니는 구슬 하나씩. */
export function unitSlots(device: Device): Outcome[] {
  const out: Outcome[] = [];
  if (device.type === 'spinner') {
    for (const sector of device.sectors)
      for (let i = 0; i < sector.size; i += 1) out.push(sector.color);
  } else {
    for (const marble of device.marbles)
      for (let i = 0; i < marble.count; i += 1) out.push(marble.color);
  }
  return out;
}

export function emptyCounts(): Record<Outcome, number> {
  return { red: 0, blue: 0, yellow: 0, green: 0 };
}

/** 색별 가중치(칸 크기 합 또는 구슬 수). */
export function weightsOf(device: Device): Record<Outcome, number> {
  const weights = emptyCounts();
  for (const color of unitSlots(device)) weights[color] += 1;
  return weights;
}

export function totalOf(device: Device): number {
  return unitSlots(device).length;
}

/** 색별 가능성(기약분수 문자열). 0 → "0", 전부 → "1". */
export function probabilitiesOf(device: Device): Record<Outcome, string> {
  const weights = weightsOf(device);
  const total = Math.max(1, totalOf(device));
  const out = {} as Record<Outcome, string>;
  for (const color of OUTCOMES) out[color] = Rational.of(weights[color], total).toString();
  return out;
}

/** seed 하나로 한 번 돌린다. */
export function spinOnce(device: Device, seed: number): { pick: number; outcome: Outcome } {
  const slots = unitSlots(device);
  const pick = pickBelow(makeRng(seed)(), slots.length);
  return { pick, outcome: slots[pick] ?? 'red' };
}

/** seed 하나에서 이어지는 난수로 n번 돌려 색별 횟수를 센다. */
export function tally(device: Device, seed: number, n: number): OutcomeCounts {
  const slots = unitSlots(device);
  const counts = emptyCounts();
  if (slots.length === 0) return counts;
  const next = makeRng(seed);
  for (let i = 0; i < n; i += 1) {
    counts[slots[pickBelow(next(), slots.length)] ?? 'red'] += 1;
  }
  return counts;
}

/** 차례대로 n번 돌린 결과(오버레이 계산용). */
export function sequence(device: Device, seed: number, n: number): Outcome[] {
  const slots = unitSlots(device);
  if (slots.length === 0) return [];
  const next = makeRng(seed);
  const out: Outcome[] = [];
  for (let i = 0; i < n; i += 1) out.push(slots[pickBelow(next(), slots.length)] ?? 'red');
  return out;
}

export function sameDevice(a: Device, b: Device): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export interface SectorAngle {
  readonly index: number;
  /** 시작·끝 각도(도, 12시 = 0, 시계 방향). */
  readonly from: number;
  readonly to: number;
  readonly mid: number;
}

/** 회전판 칸별 각도. */
export function sectorAngles(device: Device): SectorAngle[] {
  if (device.type !== 'spinner') return [];
  const total = device.sectors.reduce((a, s) => a + s.size, 0);
  let acc = 0;
  return device.sectors.map((sector, index) => {
    const from = (acc / total) * 360;
    acc += sector.size;
    const to = (acc / total) * 360;
    return { index, from, to, mid: (from + to) / 2 };
  });
}

/** 장치를 펼친 목록의 pick번 자리가 회전판의 몇 번째 칸인지. */
export function sectorOfPick(device: Device, pick: number): number | null {
  if (device.type !== 'spinner') return null;
  let acc = 0;
  for (let i = 0; i < device.sectors.length; i += 1) {
    acc += device.sectors[i]?.size ?? 0;
    if (pick < acc) return i;
  }
  return null;
}
