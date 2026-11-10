/**
 * E17 카드 하나 그리기 + P 단계 표시(눈금·직각·각호·평행 화살표).
 *
 * 카드에는 글자를 쓰지 않는다. 이름·각도·길이는 화면에도 Observation에도 없다.
 * 좌표만 화면 number이고, 성질은 properties.ts의 정확 계산 값을 그대로 그린다.
 */
import { angleKindScaled } from '../../../core/math';
import type { Point } from '../../../core/engine-sdk';
import type { DeckCard } from '../deck';
import { cardScreenPoints } from '../layout';
import { triangleProps, quadProps, cardScale, cardPoints } from '../properties';

const INK = '#33415c';

export function SorterDefs() {
  return (
    <defs>
      <pattern id="sorter-dots" width="12" height="12" patternUnits="userSpaceOnUse">
        <circle cx="3" cy="3" r="1.7" fill="#2f9e6b" />
      </pattern>
      <pattern id="sorter-hatch" width="10" height="10" patternUnits="userSpaceOnUse">
        <path d="M-2 2 L2 -2 M0 10 L10 0 M8 12 L12 8" stroke="#c2410c" strokeWidth="2.4" />
      </pattern>
      <pattern id="sorter-cross" width="12" height="12" patternUnits="userSpaceOnUse">
        <path d="M-2 2 L2 -2 M0 12 L12 0 M10 14 L14 10" stroke="#7c3aed" strokeWidth="2.2" />
        <path d="M-2 10 L2 14 M0 0 L12 12 M10 -2 L14 2" stroke="#7c3aed" strokeWidth="2.2" />
      </pattern>
      <pattern id="sorter-flip" width="9" height="9" patternUnits="userSpaceOnUse">
        <rect width="9" height="9" fill="#eef1f7" />
        <path d="M0 9 L9 0" stroke="#8b96ab" strokeWidth="2" />
      </pattern>
    </defs>
  );
}

function xy(point: Point): string {
  return `${point.x.toFixed(2)},${point.y.toFixed(2)}`;
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function direction(from: Point, to: Point): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  return { x: dx / length, y: dy / length };
}

function add(point: Point, dir: Point, length: number): Point {
  return { x: point.x + dir.x * length, y: point.y + dir.y * length };
}

/** 꼭짓점 v에서 a·b 쪽으로 반지름 r인 부채꼴 호의 경로. */
export function arcPath(vertex: Point, a: Point, b: Point, radius: number): string {
  const startAngle = Math.atan2(a.y - vertex.y, a.x - vertex.x);
  const endAngle = Math.atan2(b.y - vertex.y, b.x - vertex.x);
  let delta = endAngle - startAngle;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  const start = {
    x: vertex.x + radius * Math.cos(startAngle),
    y: vertex.y + radius * Math.sin(startAngle),
  };
  const end = {
    x: vertex.x + radius * Math.cos(endAngle),
    y: vertex.y + radius * Math.sin(endAngle),
  };
  const sweep = delta > 0 ? 1 : 0;
  return `M ${xy(start)} A ${radius} ${radius} 0 0 ${sweep} ${xy(end)}`;
}

/** 꼭짓점에 이웃한 두 변 사이를 칠한 부채꼴. */
export function sectorPath(vertex: Point, a: Point, b: Point, radius: number): string {
  return `${arcPath(vertex, a, b, radius)} L ${xy(vertex)} Z`;
}

interface SideMark {
  readonly side: number;
  readonly count: number;
}

function sideMarks(groups: readonly (readonly number[])[]): SideMark[] {
  const marks: SideMark[] = [];
  groups.forEach((group, index) => {
    for (const side of group) marks.push({ side, count: Math.min(3, index + 1) });
  });
  return marks;
}

function TickMarks({
  points,
  groups,
}: {
  readonly points: readonly Point[];
  readonly groups: readonly (readonly number[])[];
}) {
  return (
    <>
      {sideMarks(groups).map((mark, index) => {
        const a = points[mark.side];
        const b = points[(mark.side + 1) % points.length];
        if (!a || !b) return null;
        const middle = midpoint(a, b);
        const along = direction(a, b);
        const normal = { x: -along.y, y: along.x };
        const spacing = 6;
        return (
          <g key={`tick-${mark.side}-${index}`}>
            {Array.from({ length: mark.count }, (_, tick) => {
              const offset = (tick - (mark.count - 1) / 2) * spacing;
              const center = add(middle, along, offset);
              return (
                <line
                  key={tick}
                  x1={add(center, normal, -6).x}
                  y1={add(center, normal, -6).y}
                  x2={add(center, normal, 6).x}
                  y2={add(center, normal, 6).y}
                  stroke={INK}
                  strokeWidth={2.6}
                  strokeLinecap="round"
                />
              );
            })}
          </g>
        );
      })}
    </>
  );
}

export function RightAngleMarks({
  points,
  vertices,
}: {
  readonly points: readonly Point[];
  readonly vertices: readonly number[];
}) {
  return (
    <>
      {vertices.map((vertex) => {
        const current = points[vertex];
        const previous = points[(vertex - 1 + points.length) % points.length];
        const next = points[(vertex + 1) % points.length];
        if (!current || !previous || !next) return null;
        const first = direction(current, previous);
        const second = direction(current, next);
        const size = Math.min(
          16,
          Math.hypot(previous.x - current.x, previous.y - current.y) * 0.22,
          Math.hypot(next.x - current.x, next.y - current.y) * 0.22,
        );
        const p1 = add(current, first, size);
        const p2 = add(current, second, size);
        const corner = { x: p1.x + second.x * size, y: p1.y + second.y * size };
        return (
          <polyline
            key={`right-${vertex}`}
            points={`${xy(p1)} ${xy(corner)} ${xy(p2)}`}
            fill="none"
            stroke={INK}
            strokeWidth={2.6}
            strokeLinejoin="round"
          />
        );
      })}
    </>
  );
}

function AngleArcs({
  points,
  groups,
  rightVertices,
}: {
  readonly points: readonly Point[];
  readonly groups: readonly (readonly number[])[];
  readonly rightVertices: readonly number[];
}) {
  return (
    <>
      {groups.map((group, groupIndex) => {
        if (group.length < 2) return null;
        const count = Math.min(3, groupIndex + 2);
        return group.map((vertex) => {
          if (rightVertices.includes(vertex)) return null;
          const current = points[vertex];
          const previous = points[(vertex - 1 + points.length) % points.length];
          const next = points[(vertex + 1) % points.length];
          if (!current || !previous || !next) return null;
          return (
            <g key={`arc-${vertex}-${groupIndex}`}>
              {Array.from({ length: count }, (_, ring) => (
                <path
                  key={ring}
                  d={arcPath(current, previous, next, 17 + ring * 5)}
                  fill="none"
                  stroke={INK}
                  strokeWidth={2.2}
                  strokeLinecap="round"
                />
              ))}
            </g>
          );
        });
      })}
    </>
  );
}

export function ParallelArrows({
  points,
  pairs,
}: {
  readonly points: readonly Point[];
  readonly pairs: readonly (readonly [number, number])[];
}) {
  return (
    <>
      {pairs.map((pair, pairIndex) => {
        const count = Math.min(3, pairIndex + 1);
        return pair.map((side) => {
          const a = points[side];
          const b = points[(side + 1) % points.length];
          if (!a || !b) return null;
          const middle = midpoint(a, b);
          const along = direction(a, b);
          const normal = { x: -along.y, y: along.x };
          const size = 7;
          return (
            <g key={`arrow-${pairIndex}-${side}`}>
              {Array.from({ length: count }, (_, arrowIndex) => {
                const center = add(middle, along, (arrowIndex - (count - 1) / 2) * 9);
                const tip = add(center, along, size);
                const back = add(center, along, -size);
                return (
                  <polyline
                    key={arrowIndex}
                    points={`${xy(add(add(back, normal, size * 0.9), along, size * 0.6))} ${xy(tip)} ${xy(
                      add(add(back, normal, -size * 0.9), along, size * 0.6),
                    )}`}
                    fill="none"
                    stroke={INK}
                    strokeWidth={2.4}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                );
              })}
            </g>
          );
        });
      })}
    </>
  );
}

export function CardMarks({
  card,
  points,
}: {
  readonly card: DeckCard;
  readonly points: readonly Point[];
}) {
  if (points.length === 3) {
    const props = triangleProps(card);
    const scale = cardScale(card);
    const source = cardPoints(card);
    const rightVertices: number[] = [];
    source.forEach((_, index) => {
      const previous = source[(index - 1 + source.length) % source.length];
      const current = source[index];
      const next = source[(index + 1) % source.length];
      if (!previous || !current || !next) return;
      if (angleKindScaled(previous, current, next, scale) === 'right') rightVertices.push(index);
    });
    return (
      <>
        <TickMarks points={points} groups={props.equalSideGroups} />
        <RightAngleMarks points={points} vertices={rightVertices} />
        <AngleArcs points={points} groups={props.equalAngleGroups} rightVertices={rightVertices} />
      </>
    );
  }
  const props = quadProps(card);
  return (
    <>
      <TickMarks points={points} groups={props.equalSideGroups} />
      <RightAngleMarks points={points} vertices={props.rightAngles} />
      <ParallelArrows points={points} pairs={props.parallelSidePairs} />
    </>
  );
}

export interface CardShapeProps {
  readonly card: DeckCard;
  readonly unit: number;
  readonly center: Point;
  readonly showMarks: boolean;
  /** 지운 카드: 뒤집힌 무늬 + X. */
  readonly erased?: boolean;
  /** 반투명하게 겹쳐 그리는 고스트 카드. */
  readonly ghost?: boolean;
  readonly tone?: string;
}

export function CardShape({
  card,
  unit,
  center,
  showMarks,
  erased = false,
  ghost = false,
  tone = INK,
}: CardShapeProps) {
  const points = cardScreenPoints(card, unit, center);
  if (points.length < 3) return null;
  const polygon = points.map(xy).join(' ');
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return (
    <g opacity={ghost ? 0.42 : 1}>
      <polygon
        points={polygon}
        fill={erased ? 'url(#sorter-flip)' : '#ffffff'}
        stroke={erased ? '#8b96ab' : tone}
        strokeWidth={ghost ? 6 : 3}
        strokeLinejoin="round"
        strokeDasharray={ghost ? '12 7' : undefined}
      />
      {showMarks && !erased ? <CardMarks card={card} points={points} /> : null}
      {erased ? (
        <g stroke="#566078" strokeWidth={3} strokeLinecap="round">
          <line x1={minX} y1={minY} x2={maxX} y2={maxY} />
          <line x1={minX} y1={maxY} x2={maxX} y2={minY} />
        </g>
      ) : null}
    </g>
  );
}

/**
 * 바닥에 놓인 변 aseIndex가 수평 아래로 가도록 돌려 ox 안에 맞춘다.
 * 오버레이 upright-card가 쓴다(화면 좌표 계산만).
 */
export function uprightPolygon(
  points: readonly Point[],
  baseIndex: number,
  box: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
  padding = 18,
): Point[] {
  const a = points[baseIndex];
  const b = points[(baseIndex + 1) % points.length];
  if (!a || !b || points.length < 3) return [];
  const angle = Math.atan2(b.y - a.y, b.x - a.x);
  const cos = Math.cos(-angle);
  const sin = Math.sin(-angle);
  const origin = midpoint(a, b);
  const rotated = points.map((point) => {
    const dx = point.x - origin.x;
    const dy = point.y - origin.y;
    return { x: dx * cos - dy * sin, y: dx * sin + dy * cos };
  });
  const xs = rotated.map((point) => point.x);
  const ys = rotated.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const scale = Math.min(
    (box.width - padding * 2) / Math.max(1, maxX - minX),
    (box.height - padding * 2) / Math.max(1, maxY - minY),
  );
  const centerX = box.x + box.width / 2;
  const bottom = box.y + box.height - padding;
  const offsetX = centerX - ((minX + maxX) / 2) * scale;
  const offsetY = bottom - maxY * scale;
  return rotated.map((point) => ({ x: offsetX + point.x * scale, y: offsetY + point.y * scale }));
}
