/**
 * E13 capacity 판 좌표(논리 너비 1000). 본 판과 힌트 ② 오버레이가 같은 식을 쓴다.
 * 높이는 변형마다 정해진다(둘 다 600 이하). 화면 좌표만 number다.
 */
import { capacityOf } from './settings';
import type { CapacityContainer, CapacityState } from './types';

export const BOARD = { width: 1000 } as const;

/** 그릇 바닥 y. */
export function baseY(state: Pick<CapacityState, 'variant'>): number {
  return state.variant === 'puzzle' ? 350 : 290;
}

/** 같은 모양 비커 윤곽(힌트 ② same-beaker) 자리: 그릇 바닥에서 아래로 띄운 거리와 크기. */
export const GUIDE = { gap: 108, size: 110, pad: 12 } as const;

/** 그릇 이름(·컵 횟수) 글 아래 끝 y. 오버레이 화살표가 여기서 시작한다. */
export function labelBottom(state: Pick<CapacityState, 'variant'>): number {
  return baseY(state) + (state.variant === 'puzzle' ? 40 : 72);
}

/**
 * 변형마다 판의 논리 높이: 그릇 바닥 + 힌트 ② 점선 비커 자리 + 여백.
 * 설정과 무관하게 변형마다 일정하다(600 이하). cup-count 520, puzzle 580.
 */
export function boardHeight(state: Pick<CapacityState, 'variant'>): number {
  return baseY(state) + GUIDE.gap + GUIDE.size + GUIDE.pad;
}

export interface ContainerGeo {
  /** 가운데 x. */
  readonly cx: number;
  /** 바닥 y. */
  readonly base: number;
  readonly w: number;
  readonly h: number;
}

const CUP_COUNT_SIZE = { tall: { w: 120, h: 250 }, wide: { w: 240, h: 130 } } as const;
const PUZZLE_W = 110;
const PUZZLE_MAX_H = 280;
const PUZZLE_MIN_H = 90;

/** 그릇 하나의 자리와 크기. puzzle 비커는 들이에 비례해 높다(눈금은 없다). */
export function containerGeo(
  state: Pick<CapacityState, 'variant' | 'containers'>,
  index: number,
): ContainerGeo {
  const container: CapacityContainer | undefined = state.containers[index];
  const base = baseY(state);
  if (state.variant === 'puzzle') {
    let biggest = 1;
    for (const c of state.containers) biggest = Math.max(biggest, Number(capacityOf(c).n));
    const own = container === undefined ? biggest : Number(capacityOf(container).n);
    return {
      cx: index === 0 ? 300 : 640,
      base,
      w: PUZZLE_W,
      h: Math.max(PUZZLE_MIN_H, (PUZZLE_MAX_H * own) / biggest),
    };
  }
  const size = CUP_COUNT_SIZE[container?.shape ?? 'tall'];
  const cx = state.containers.length === 1 ? 420 : index === 0 ? 240 : 600;
  return { cx, base, ...size };
}

/** puzzle: 수도꼭지·개수대 자리. */
export const FAUCET = { x: 150, y: 40 } as const;
export const SINK = { x: 800, y: 270, w: 150, h: 80 } as const;

/** cup-count: 컵 그림 자리(바닥 가운데). */
export const CUP_ICON = { cx: 880, w: 74, h: 84 } as const;

/** 그릇 바깥선(위가 열린 선). 병은 목이 좁고, 그릇은 바닥이 둥글다. */
export function outlinePath(kind: CapacityContainer['kind'], g: ContainerGeo): string {
  const l = g.cx - g.w / 2;
  const r = g.cx + g.w / 2;
  const top = g.base - g.h;
  if (kind === 'bottle') {
    const neck = g.w * 0.25;
    return `M${g.cx - neck},${top} V${top + g.h * 0.2} L${l},${top + g.h * 0.34} V${g.base} H${r} V${top + g.h * 0.34} L${g.cx + neck},${top + g.h * 0.2} V${top}`;
  }
  if (kind === 'bowl') {
    return `M${l},${top} V${top + g.h * 0.3} Q${l},${g.base} ${g.cx},${g.base} Q${r},${g.base} ${r},${top + g.h * 0.3} V${top}`;
  }
  return `M${l},${top} V${g.base} H${r} V${top}`;
}

/** 물을 자르는 닫힌 모양(바깥선의 윗변을 이은 것). */
export function closedPath(kind: CapacityContainer['kind'], g: ContainerGeo): string {
  return `${outlinePath(kind, g)} Z`;
}

/** 그림 좌표는 소수점 둘째 자리까지만 쓴다. */
export function r2(value: number): number {
  return Math.round(value * 100) / 100;
}
