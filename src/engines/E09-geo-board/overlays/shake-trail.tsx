/**
 * 힌트 ②: 흔들기 전(또는 다음 흔들기) 도형을 점선 유령으로 그리고 움직인 점에 화살표를 그린다.
 * 유령에도 정확히 같은 변에만 눈금을 그린다.
 */
import type { ReactNode } from 'react';
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import { sDist2, surdEquals } from '../../../core/math';
import type { SPoint } from '../../../core/math';
import { boardRect, surdToScreen } from '../layout';
import { evaluate, figureOf, isPointNode } from '../modes/drag-test/graph';
import { previewShake } from '../modes/drag-test/shake';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import type { GeoConfig, GeoState } from '../types';
import type { DragNode } from '../modes/drag-test/types';

function pointMap(nodes: readonly DragNode[]): Map<string, SPoint> {
  const values = evaluate(nodes);
  const result = new Map<string, SPoint>();
  for (const node of nodes) {
    if (!isPointNode(node)) continue;
    const value = values.get(node.id);
    if (value && 'x' in value && 'y' in value) result.set(node.id, value);
  }
  return result;
}

function equalGroups(points: readonly SPoint[]): number[][] {
  const sides = points.map((point, index) => {
    const next = points[(index + 1) % points.length];
    return next ? sDist2(point, next) : null;
  });
  const groups: number[][] = [];
  const used = new Set<number>();
  sides.forEach((side, index) => {
    if (used.has(index) || !side) return;
    const group = [index];
    used.add(index);
    for (let other = index + 1; other < sides.length; other += 1) {
      const candidate = sides[other];
      if (used.has(other) || !candidate) continue;
      if (surdEquals(side, candidate)) {
        used.add(other);
        group.push(other);
      }
    }
    if (group.length >= 2) groups.push(group);
  });
  return groups;
}

export function ShakeTrailOverlay({ state }: OverlayProps<GeoConfig, GeoState>) {
  if (state.mode !== 'drag-test') return null;
  const lattice = state.settings.lattice;
  const rect = boardRect(lattice + 1, lattice + 1);
  const screen = (point: SPoint) => ({
    x: rect.x + surdToScreen(point.x) * rect.spacing,
    y: rect.y + surdToScreen(point.y) * rect.spacing,
  });

  let ghostNodes: readonly DragNode[];
  let fromNodes: readonly DragNode[];
  let toNodes: readonly DragNode[];
  if (state.preShake) {
    ghostNodes = state.preShake.nodes;
    fromNodes = state.preShake.nodes;
    toNodes = state.nodes;
  } else {
    const preview = previewShake(
      state.nodes,
      state.quad,
      state.settings,
      state.shakeCount,
      state.toggles,
    );
    if (!preview.moved) return null;
    ghostNodes = preview.nodes;
    fromNodes = state.nodes;
    toNodes = preview.nodes;
  }

  const ghostFigure = figureOf(ghostNodes, state.settings.construction);
  if (!ghostFigure) return null;
  const ghostPoints = ghostFigure.points.map(screen);
  const path = ghostPoints
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ');

  const from = pointMap(fromNodes);
  const to = pointMap(toNodes);
  const arrows: ReactNode[] = [];
  for (const node of fromNodes) {
    if (node.kind !== 'free') continue;
    const start = from.get(node.id);
    const end = to.get(node.id);
    if (!start || !end) continue;
    const a = screen(start);
    const b = screen(end);
    if (Math.hypot(a.x - b.x, a.y - b.y) < 1) continue;
    arrows.push(
      <g key={`arrow-${node.id}`}>
        <line
          x1={a.x}
          y1={a.y}
          x2={b.x}
          y2={b.y}
          stroke="#e8872e"
          strokeWidth={3}
          markerEnd="url(#shake-arrow)"
        />
      </g>,
    );
  }

  const tickNodes: ReactNode[] = [];
  equalGroups(ghostFigure.points).forEach((group, number) => {
    for (const edge of group) {
      const first = ghostPoints[edge];
      const second = ghostPoints[(edge + 1) % ghostPoints.length];
      if (!first || !second) continue;
      const dx = second.x - first.x;
      const dy = second.y - first.y;
      const length = Math.hypot(dx, dy);
      if (length === 0) continue;
      const direction = { x: dx / length, y: dy / length };
      const normal = { x: -direction.y, y: direction.x };
      const middle = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
      for (let index = 0; index < Math.min(3, number + 1); index += 1) {
        const offset = (index - (Math.min(3, number + 1) - 1) / 2) * 6;
        const center = { x: middle.x + direction.x * offset, y: middle.y + direction.y * offset };
        tickNodes.push(
          <line
            key={`ghost-tick-${number}-${edge}-${index}`}
            x1={center.x - normal.x * 8}
            y1={center.y - normal.y * 8}
            x2={center.x + normal.x * 8}
            y2={center.y + normal.y * 8}
            stroke="#7c3aed"
            strokeWidth={2.5}
            strokeLinecap="round"
          />,
        );
      }
    }
  });

  return (
    <CanvasAlignedOverlay
      testId="shake-trail"
      canvasSelector={'svg[data-testid="geo-canvas"]'}
      logicalWidth={LOGICAL_WIDTH}
      logicalHeight={LOGICAL_HEIGHT}
    >
      <defs>
        <marker id="shake-arrow" markerWidth="10" markerHeight="10" refX="7" refY="3" orient="auto">
          <path d="M 0 0 L 7 3 L 0 6 Z" fill="#e8872e" />
        </marker>
      </defs>
      <path
        d={`${path} Z`}
        fill="#7c3aed"
        fillOpacity={0.08}
        stroke="#7c3aed"
        strokeWidth={3}
        strokeDasharray="12 8"
        strokeLinejoin="round"
      />
      {tickNodes}
      {arrows}
    </CanvasAlignedOverlay>
  );
}
