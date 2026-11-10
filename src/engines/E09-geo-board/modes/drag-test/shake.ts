/**
 * 흔들기(T101). 모든 난수는 seed와 shakeCount로 정해지므로 되감기·재생·미러링이
 * 같은 결과를 낸다. 시간·`Math.random`을 쓰지 않는다.
 */
import { propertiesOfGPolygon } from '../../properties';
import type { FigureProps } from '../../properties';
import { gpointOfSPoint, figureOf, graphValid } from './graph';
import type { GraphFigure } from './graph';
import {
  applyDiagonalToggles,
  applyQuadToggles,
  closeQuadToggles,
  quadNodes,
  quadParamsValid,
  validQuad,
} from './quad';
import type { DiagonalToggle, DragNode, QuadParams, QuadToggle, DragTestSettings } from './types';

const GOLDEN = 0x9e3779b1;

/** mulberry32. 32비트 정수만 쓴다. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return (value ^ (value >>> 14)) >>> 0;
  };
}

/** `nextUint32() % n`. 부동소수 나눗셈을 쓰지 않는다. */
export function nextInt(random: () => number, n: number): number {
  const size = Math.max(1, Math.floor(n));
  return random() % size;
}

export function shakeSeed(seed: number, shakeCount: number): number {
  return (seed + Math.imul(shakeCount + 1, GOLDEN)) >>> 0;
}

function moveFree(node: DragNode, random: () => number, radius: number, lattice: number): DragNode {
  if (node.kind !== 'free') return node;
  let dx: number;
  let dy: number;
  do {
    dx = nextInt(random, radius * 2 + 1) - radius;
    dy = nextInt(random, radius * 2 + 1) - radius;
  } while (dx === 0 && dy === 0);
  const at = [
    Math.min(lattice, Math.max(0, node.at[0] + dx)),
    Math.min(lattice, Math.max(0, node.at[1] + dy)),
  ] as const;
  return { id: node.id, kind: 'free', label: node.label, at };
}

function moveOnCircle(node: DragNode, random: () => number): DragNode {
  if (node.kind !== 'on-circle') return node;
  const step = 1 + nextInt(random, 4);
  const direction = nextInt(random, 2) === 0 ? -1 : 1;
  return { ...node, pos: (((node.pos + direction * step) % 48) + 48) % 48 };
}

/** 도형이 넓이 0이 아닌지. 정확히 계산할 수 없으면 통과시킨다(그래프가 이미 검사). */
export function figureAreaNonZero(figure: GraphFigure | null): boolean {
  if (!figure) return true;
  const rational = figure.points.map(gpointOfSPoint);
  if (rational.some((point) => point === null)) return true;
  const points = rational.filter((point): point is NonNullable<typeof point> => point !== null);
  const props = propertiesOfGPolygon(points);
  return props !== null;
}

function figureProps(figure: GraphFigure | null): FigureProps | null {
  if (!figure) return null;
  const rational = figure.points.map(gpointOfSPoint);
  if (rational.some((point) => point === null)) return null;
  const points = rational.filter((point): point is NonNullable<typeof point> => point !== null);
  return propertiesOfGPolygon(points);
}

export interface ShakeResult {
  readonly nodes: readonly DragNode[];
  readonly quad: QuadParams | null;
  readonly moved: boolean;
}

function randomVector(random: () => number): readonly [number, number] | null {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const x = nextInt(random, 13) - 6;
    const y = nextInt(random, 13) - 6;
    if (x * x + y * y >= 4) return [x, y];
  }
  return null;
}

function shakeQuadParams(
  quad: QuadParams,
  toggles: readonly (DiagonalToggle | QuadToggle)[],
  lattice: number,
  random: () => number,
): QuadParams | null {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (quad.kind === 'from-diagonals') {
      const p = randomVector(random);
      if (!p) continue;
      const candidate: QuadParams = {
        kind: 'from-diagonals',
        p,
        t: 2 + nextInt(random, 21),
        beta: nextInt(random, 12),
        gamma: nextInt(random, 12),
        delta: nextInt(random, 12),
      };
      const normalized = applyDiagonalToggles(candidate, toggles as readonly DiagonalToggle[]);
      if (!normalized) continue;
      if (!quadParamsValid(normalized)) continue;
      if (!validQuad(normalized, lattice, [])) continue;
      return normalized;
    }
    const u = randomVector(random);
    if (!u) continue;
    const candidate: QuadParams = {
      kind: 'quad-conditions',
      u,
      t: 2 + nextInt(random, 21),
      s: nextInt(random, 12),
      kappa: nextInt(random, 12),
      c: [nextInt(random, 13) - 6, nextInt(random, 13) - 6],
    };
    const normalized = applyQuadToggles(
      candidate,
      closeQuadToggles(toggles as readonly QuadToggle[]),
    );
    if (!validQuad(normalized, lattice, toggles as readonly QuadToggle[])) continue;
    return normalized;
  }
  return null;
}

/** 다음 흔들기 결과. 성공하면 moved true, 10번 모두 실패하면 원래 그대로. */
export function shakeGeometry(
  nodes: readonly DragNode[],
  quad: QuadParams | null,
  settings: DragTestSettings,
  shakeCount: number,
  activeToggles: readonly (DiagonalToggle | QuadToggle)[] = [],
  quadStartId = 1,
): ShakeResult {
  const random = mulberry32(shakeSeed(settings.seed, shakeCount));
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (quad) {
      const nextQuad = shakeQuadParams(quad, activeToggles, settings.lattice, random);
      if (!nextQuad) continue;
      const built = quadNodes(
        nextQuad,
        settings.lattice,
        activeToggles as readonly QuadToggle[],
        quadStartId,
      );
      if (!built) continue;
      if (!graphValid(built.nodes)) continue;
      const figure = figureOf(built.nodes, settings.construction);
      if (!figureAreaNonZero(figure)) continue;
      return { nodes: built.nodes, quad: nextQuad, moved: true };
    }

    const moved = nodes.map((node) => {
      if (node.kind === 'free')
        return moveFree(node, random, settings.shakeRadius, settings.lattice);
      if (node.kind === 'on-circle') return moveOnCircle(node, random);
      return node;
    });
    if (!graphValid(moved)) continue;
    const figure = figureOf(moved, settings.construction);
    if (!figureAreaNonZero(figure)) continue;
    if (figure && figureProps(figure) === null && figure.kind === 'triangle') {
      // 근호가 섞여 성질을 계산할 수 없어도, 꼭짓점이 일직선이면 실패로 본다.
      const [a, b, c] = figure.points;
      if (a && b && c) {
        const ab = gpointOfSPoint(a);
        const bc = gpointOfSPoint(b);
        const ca = gpointOfSPoint(c);
        if (ab && bc && ca) {
          const cross = ab.x
            .sub(bc.x)
            .mul(ca.y.sub(bc.y))
            .sub(ab.y.sub(bc.y).mul(ca.x.sub(bc.x)));
          if (cross.isZero()) continue;
        }
      }
    }
    return { nodes: moved, quad: null, moved: true };
  }
  return { nodes, quad, moved: false };
}

export function previewShake(
  nodes: readonly DragNode[],
  quad: QuadParams | null,
  settings: DragTestSettings,
  shakeCount: number,
  activeToggles: readonly (DiagonalToggle | QuadToggle)[] = [],
): ShakeResult {
  return shakeGeometry(nodes, quad, settings, shakeCount, activeToggles);
}
