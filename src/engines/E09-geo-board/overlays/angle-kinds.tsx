/**
 * 힌트 ②: 같은 도형의 모든 내각을 종류별 무늬로 칠한다.
 * 예각은 점, 직각은 ㄴ자, 둔각은 빗금과 굵은 테두리, 오목 각은 점선 호. 숫자는 쓰지 않는다.
 */
import type { ReactNode } from 'react';
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import type { Point } from '../../../core/engine-sdk';
import { boardRect, surdToScreen } from '../layout';
import { classifyProps } from '../modes/classify/observe';
import { currentFigure } from '../modes/drag-test/observe';
import type { FigureAngleKind, FigureProps } from '../properties';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import type { GeoConfig, GeoState } from '../types';

function figureFor(state: GeoState): FigureProps | null {
  if (state.mode === 'classify') {
    for (const band of [...state.bands].reverse()) {
      const props = classifyProps(band);
      if (props) return props;
    }
    return null;
  }
  if (state.mode === 'drag-test') return currentFigure(state).props;
  return null;
}

function gridSize(state: GeoState): readonly [number, number] {
  if (state.mode === 'drag-test') {
    return [state.settings.lattice + 1, state.settings.lattice + 1];
  }
  if (state.mode === 'classify' || state.mode === 'geoboard') return state.settings.grid;
  return [9, 9];
}

function unit(from: Point, to: Point): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return { x: 0, y: -1 };
  return { x: dx / length, y: dy / length };
}

function squareMark(vertex: Point, first: Point, second: Point, size: number): string {
  const u = unit(vertex, first);
  const v = unit(vertex, second);
  const p1 = { x: vertex.x + u.x * size, y: vertex.y + u.y * size };
  const p2 = { x: p1.x + v.x * size, y: p1.y + v.y * size };
  const p3 = { x: vertex.x + v.x * size, y: vertex.y + v.y * size };
  return `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} L ${p2.x.toFixed(2)} ${p2.y.toFixed(2)} L ${p3.x.toFixed(2)} ${p3.y.toFixed(2)}`;
}

function arcPath(
  vertex: Point,
  first: Point,
  second: Point,
  radius: number,
  reflex: boolean,
): string {
  const a1 = Math.atan2(first.y - vertex.y, first.x - vertex.x);
  const a2 = Math.atan2(second.y - vertex.y, second.x - vertex.x);
  let delta = a2 - a1;
  if (reflex) {
    if (delta > 0) delta -= Math.PI * 2;
    else delta += Math.PI * 2;
  } else {
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
  }
  const start = { x: vertex.x + radius * Math.cos(a1), y: vertex.y + radius * Math.sin(a1) };
  const end = {
    x: vertex.x + radius * Math.cos(a1 + delta),
    y: vertex.y + radius * Math.sin(a1 + delta),
  };
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius.toFixed(2)} ${radius.toFixed(2)} 0 ${Math.abs(delta) > Math.PI ? 1 : 0} ${delta > 0 ? 1 : 0} ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

function angleMark(
  vertex: Point,
  first: Point,
  second: Point,
  kind: FigureAngleKind,
  index: number,
): ReactNode {
  const size = 20;
  if (kind === 'right') {
    return (
      <path
        key={`right-${index}`}
        d={squareMark(vertex, first, second, size)}
        fill="none"
        stroke="#1d4fa8"
        strokeWidth={4}
      />
    );
  }
  const radius = kind === 'reflex' ? 22 : kind === 'obtuse' ? 28 : 25;
  const arc = arcPath(vertex, first, second, radius, kind === 'reflex');
  const mid = arcPath(vertex, first, second, radius * 0.6, false);
  const middle = {
    x: vertex.x + ((first.x + second.x) / 2 - vertex.x) * 0.28,
    y: vertex.y + ((first.y + second.y) / 2 - vertex.y) * 0.28,
  };
  if (kind === 'acute') {
    return (
      <g key={`acute-${index}`}>
        <path d={arc} fill="none" stroke="#2f9e6b" strokeWidth={3} />
        <circle cx={middle.x} cy={middle.y} r={3.5} fill="#2f9e6b" />
      </g>
    );
  }
  if (kind === 'obtuse') {
    return (
      <g key={`obtuse-${index}`}>
        <path d={arc} fill="none" stroke="#c2410c" strokeWidth={6} />
        <path d={mid} fill="none" stroke="#c2410c" strokeWidth={2} strokeDasharray="3 4" />
        <line
          x1={middle.x - 8}
          y1={middle.y - 8}
          x2={middle.x + 8}
          y2={middle.y + 8}
          stroke="#c2410c"
          strokeWidth={2}
        />
      </g>
    );
  }
  return (
    <path
      key={`reflex-${index}`}
      d={arc}
      fill="none"
      stroke="#5b6577"
      strokeWidth={3}
      strokeDasharray="5 5"
    />
  );
}

export function AngleKindsOverlay({ state }: OverlayProps<GeoConfig, GeoState>) {
  const props = figureFor(state);
  if (!props) return null;
  const [cols, rows] = gridSize(state);
  const rect = boardRect(cols, rows);
  const points = props.vertices.map((point) => ({
    x: rect.x + surdToScreen(point.x) * rect.spacing,
    y: rect.y + surdToScreen(point.y) * rect.spacing,
  }));
  if (points.length < 3) return null;
  return (
    <CanvasAlignedOverlay
      testId="angle-kinds"
      canvasSelector={'svg[data-testid="geo-canvas"]'}
      logicalWidth={LOGICAL_WIDTH}
      logicalHeight={LOGICAL_HEIGHT}
    >
      <g>
        {points.map((vertex, index) => {
          const first = points[(index - 1 + points.length) % points.length];
          const second = points[(index + 1) % points.length];
          const kind = props.angles[index];
          if (!first || !second || !kind) return null;
          return angleMark(vertex, first, second, kind, index);
        })}
      </g>
    </CanvasAlignedOverlay>
  );
}
