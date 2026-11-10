/**
 * classify 모드 화면(T101).
 *
 * 고무줄 화면은 geoboard와 같고, 닫은 단순 도형에 성질 표시와 옆 목록을 더한다.
 * 도형 이름은 화면에 쓰지 않는다(Observation·이벤트 전용).
 */
import type { ReactNode } from 'react';
import type { EngineViewProps, Point } from '../../../core/engine-sdk';
import { sCross, sDist2, sSub, surdEquals, surdSign } from '../../../core/math';
import type { SPoint } from '../../../core/math';
import type { BoardRect } from '../layout';
import { pegPoint, setSquareShape, surdToScreen } from '../layout';
import { classifyProps, squareFits } from '../modes/classify/observe';
import type { FigureAngleKind, FigureProps } from '../properties';
import { geoBoardStrings as S } from '../strings.ko';
import type { GeoAction, GeoBand, GeoConfig } from '../types';
import type { ClassifyState } from '../modes/classify/types';
import { GeoboardView } from './GeoboardView';
import styles from '../View.module.css';

type ClassifyViewProps = EngineViewProps<GeoConfig, ClassifyState, GeoAction>;

const MARK = '#1d4fa8';
const ORANGE = '#e8872e';
const MUTED = '#5b6577';

function sPoint(rect: BoardRect, point: SPoint): Point {
  return {
    x: rect.x + surdToScreen(point.x) * rect.spacing,
    y: rect.y + surdToScreen(point.y) * rect.spacing,
  };
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
  const large = Math.abs(delta) > Math.PI ? 1 : 0;
  const sweep = delta > 0 ? 1 : 0;
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius.toFixed(2)} ${radius.toFixed(2)} 0 ${large} ${sweep} ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

function equalLengthGroups(props: FigureProps): number[][] {
  const sides: ReturnType<typeof sDist2>[] = [];
  for (let index = 0; index < props.vertices.length; index += 1) {
    const current = props.vertices[index];
    const next = props.vertices[(index + 1) % props.vertices.length];
    sides.push(current && next ? sDist2(current, next) : null);
  }
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

function parallelPairs(props: FigureProps): number[][] {
  const edges: (SPoint | null)[] = [];
  for (let index = 0; index < props.vertices.length; index += 1) {
    const current = props.vertices[index];
    const next = props.vertices[(index + 1) % props.vertices.length];
    edges.push(current && next ? sSub(next, current) : null);
  }
  const pairs: number[][] = [];
  for (let first = 0; first < edges.length; first += 1) {
    for (let second = first + 1; second < edges.length; second += 1) {
      const adjacent = second === first + 1 || (first === 0 && second === edges.length - 1);
      if (adjacent) continue;
      const u = edges[first];
      const v = edges[second];
      if (!u || !v) continue;
      const cross = sCross(u, v);
      if (cross && surdSign(cross) === 0) pairs.push([first, second]);
    }
  }
  return pairs;
}

function tickMarks(
  first: Point,
  second: Point,
  count: number,
  color: string,
  keyPrefix: string,
): ReactNode[] {
  const direction = unit(first, second);
  const normal = { x: -direction.y, y: direction.x };
  const middle = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
  const marks: ReactNode[] = [];
  for (let index = 0; index < count; index += 1) {
    const offset = (index - (count - 1) / 2) * 7;
    const center = { x: middle.x + direction.x * offset, y: middle.y + direction.y * offset };
    marks.push(
      <line
        key={`${keyPrefix}-${index}`}
        x1={center.x - normal.x * 11}
        y1={center.y - normal.y * 11}
        x2={center.x + normal.x * 11}
        y2={center.y + normal.y * 11}
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
      />,
    );
  }
  return marks;
}

function chevrons(first: Point, second: Point, count: number, keyPrefix: string): ReactNode[] {
  const direction = unit(first, second);
  const normal = { x: -direction.y, y: direction.x };
  const middle = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
  const marks: ReactNode[] = [];
  for (let index = 0; index < count; index += 1) {
    const offset = (index - (count - 1) / 2) * 10;
    const center = { x: middle.x + direction.x * offset, y: middle.y + direction.y * offset };
    const tip = { x: center.x + direction.x * 5, y: center.y + direction.y * 5 };
    marks.push(
      <path
        key={`${keyPrefix}-${index}`}
        d={`M ${(center.x - normal.x * 9).toFixed(2)} ${(center.y - normal.y * 9).toFixed(2)} L ${tip.x.toFixed(2)} ${tip.y.toFixed(2)} L ${(center.x + normal.x * 9).toFixed(2)} ${(center.y + normal.y * 9).toFixed(2)}`}
        fill="none"
        stroke={MUTED}
        strokeWidth={2.6}
        strokeLinejoin="round"
      />,
    );
  }
  return marks;
}

function propertyMarks(
  band: GeoBand,
  props: FigureProps,
  rect: BoardRect,
  show: readonly string[],
): ReactNode[] {
  const points = props.vertices.map((point) => sPoint(rect, point));
  const result: ReactNode[] = [];
  const size = Math.min(22, rect.spacing * 0.24);

  if (show.includes('rightAngles')) {
    props.angles.forEach((kind, index) => {
      if (kind !== 'right') return;
      const vertex = points[index];
      const first = points[(index - 1 + points.length) % points.length];
      const second = points[(index + 1) % points.length];
      if (!vertex || !first || !second) return;
      result.push(
        <path
          key={`right-${band.id}-${index}`}
          d={squareMark(vertex, first, second, size)}
          fill="none"
          stroke={MARK}
          strokeWidth={3}
        />,
      );
    });
  }

  if (show.includes('parallelSides')) {
    parallelPairs(props).forEach((pair, number) => {
      for (const edge of pair) {
        const first = points[edge];
        const second = points[(edge + 1) % points.length];
        if (!first || !second) continue;
        result.push(
          ...chevrons(first, second, Math.min(3, number + 1), `par-${band.id}-${number}-${edge}`),
        );
      }
    });
  }

  if (show.includes('equalSides')) {
    equalLengthGroups(props).forEach((group, number) => {
      for (const edge of group) {
        const first = points[edge];
        const second = points[(edge + 1) % points.length];
        if (!first || !second) continue;
        result.push(
          ...tickMarks(
            first,
            second,
            Math.min(3, number + 1),
            MARK,
            `eq-${band.id}-${number}-${edge}`,
          ),
        );
      }
    });
  }

  if (show.includes('angles')) {
    result.push(...angleMarks(band.id, points, props.angles, size));
  }
  return result;
}

function angleMarks(
  band: string,
  points: readonly Point[],
  kinds: readonly FigureAngleKind[],
  size: number,
): ReactNode[] {
  const result: ReactNode[] = [];
  kinds.forEach((kind, index) => {
    const vertex = points[index];
    const first = points[(index - 1 + points.length) % points.length];
    const second = points[(index + 1) % points.length];
    if (!vertex || !first || !second) return;
    if (kind === 'right') {
      result.push(
        <path
          key={`angle-${band}-${index}`}
          d={squareMark(vertex, first, second, size)}
          fill="none"
          stroke={ORANGE}
          strokeWidth={2.5}
        />,
      );
      return;
    }
    const radius = size * 1.25;
    const lines = kind === 'obtuse' ? 2 : 1;
    for (let line = 0; line < lines; line += 1) {
      result.push(
        <path
          key={`angle-${band}-${index}-${line}`}
          d={arcPath(vertex, first, second, radius - line * 5, kind === 'reflex')}
          fill="none"
          stroke={kind === 'reflex' ? MUTED : ORANGE}
          strokeWidth={kind === 'obtuse' ? 3.5 : 2.5}
          strokeDasharray={kind === 'reflex' ? '5 4' : undefined}
        />,
      );
    }
  });
  return result;
}

function setSquareMark(band: GeoBand, rect: BoardRect, state: ClassifyState): ReactNode | null {
  if (!state.settings.tools.includes('set-square')) return null;
  const chosen = state.squareOn;
  if (!chosen || chosen.band !== band.id) return null;
  const previous = band.pegs[(chosen.index - 1 + band.pegs.length) % band.pegs.length];
  const current = band.pegs[chosen.index];
  const next = band.pegs[(chosen.index + 1) % band.pegs.length];
  if (!previous || !current || !next) return null;
  const shape = setSquareShape(
    pegPoint(rect, current),
    pegPoint(rect, previous),
    pegPoint(rect, next),
    Math.min(96, rect.spacing * 1.3),
    squareFits(state) === true,
  );
  return (
    <g key={`square-${band.id}`} opacity={0.85}>
      <polygon
        points={`${shape.vertex.x},${shape.vertex.y} ${shape.legA.x},${shape.legA.y} ${shape.legB.x},${shape.legB.y}`}
        fill="#dbe7ff"
        fillOpacity={0.45}
        stroke={MARK}
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
      {shape.gapPath ? (
        <path d={shape.gapPath} fill={ORANGE} fillOpacity={0.22} stroke={ORANGE} strokeWidth={2} />
      ) : null}
    </g>
  );
}

export function ClassifyView({
  state,
  dispatch,
  cpa,
  readOnly = false,
  targetSize,
}: ClassifyViewProps) {
  const show = state.settings.showProperties;
  const rows = state.bands
    .map((band) => ({ band, props: classifyProps(band) }))
    .filter((row): row is { band: GeoBand; props: FigureProps } => row.props !== null);

  const decorate = (rect: BoardRect): ReactNode => (
    <g pointerEvents="none">
      {rows.map(({ band, props }) => (
        <g key={`marks-${band.id}`}>
          {propertyMarks(band, props, rect, show)}
          {setSquareMark(band, rect, state)}
        </g>
      ))}
    </g>
  );

  const onVertexKey = (band: string, index: number, key: string): boolean => {
    if (readOnly) return false;
    if (key === 'S') {
      dispatch({ type: 'place-square-at', band, index });
      return true;
    }
    if (key === 'Shift+S') {
      dispatch({ type: 'remove-square' });
      return true;
    }
    return false;
  };

  return (
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', height: '100%' }}>
      <div style={{ flex: '1 1 auto', minWidth: 0, height: '100%' }}>
        <GeoboardView
          config={{ mode: 'classify' }}
          state={state}
          dispatch={dispatch}
          cpa={cpa}
          mode="classify"
          readOnly={readOnly}
          targetSize={targetSize}
          decorate={decorate}
          onVertexKey={onVertexKey}
        />
      </div>
      {show.length > 0 ? (
        <section
          aria-label={S.classify.propertiesAria}
          data-testid="classify-properties"
          style={{ width: 210, flex: '0 0 auto', display: 'grid', gap: '0.75rem' }}
        >
          {rows.length === 0 ? <p className={styles.hint}>{S.classify.propertiesEmpty}</p> : null}
          {rows.map(({ band, props }, index) => {
            const lines: string[] = [];
            if (show.includes('rightAngles')) lines.push(S.classify.rightAngles(props.rightAngles));
            if (show.includes('parallelSides')) {
              lines.push(S.classify.parallelSides(props.parallelPairs));
            }
            if (show.includes('equalSides')) lines.push(S.classify.equalSides(props.equalSides));
            if (show.includes('angles') && lines.length === 0) {
              lines.push(S.classify.anglesOnly);
            }
            return (
              <div key={`props-${band.id}`}>
                <strong>{S.classify.bandName(index + 1)}</strong>
                {lines.map((line) => (
                  <p key={line} className={styles.hint} style={{ margin: '0.2rem 0' }}>
                    {line}
                  </p>
                ))}
              </div>
            );
          })}
          {state.settings.tools.includes('set-square') ? (
            <p className={styles.hint}>
              {S.classify.squareHint}
              {state.squareOn
                ? ` ${squareFits(state) ? S.classify.squareFit : S.classify.squareGap}`
                : ''}
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
