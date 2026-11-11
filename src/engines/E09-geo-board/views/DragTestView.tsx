/**
 * drag-test 모드 화면(T101).
 *
 * 작은 의존 그래프의 점·선분·원·교점을 그리고, 도구·흔들기·조건 토글을 제공한다.
 * 측정값은 `measure`가 켜졌을 때만 학생이 만든 도형에 대해 보여 준다.
 */
import { useMemo, useRef, useState } from 'react';
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from 'react';
import { clamp, minTouchRadius, pointerToLogical, useRenderedSize } from '../../../core/engine-sdk';
import type { EngineViewProps, Point } from '../../../core/engine-sdk';
import { sDist2, surdEquals } from '../../../core/math';
import type { SPoint } from '../../../core/math';
import { boardRect, extensionSegment, ratToScreen, surdToScreen } from '../layout';
import type { BoardRect } from '../layout';
import {
  allRankZero,
  definitionPoints,
  evaluate,
  isPointNode,
  lineValue,
  rankOf,
  segmentValue,
} from '../modes/drag-test/graph';
import type { GraphValue } from '../modes/drag-test/graph';
import { currentFigure } from '../modes/drag-test/observe';
import { quadGeometry } from '../modes/drag-test/quad';
import { propertyKeys } from '../properties';
import { geoBoardStrings as S } from '../strings.ko';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import type { GeoAction, GeoConfig } from '../types';
import type {
  DragNode,
  DragTestState,
  DragTool,
  QuadParamName,
  QuadToggle,
} from '../modes/drag-test/types';
import styles from '../View.module.css';

const LOGICAL = { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT };
const PAPER = '#fbfaf6';
const INK = '#1d2330';
const MUTED = '#8a93a5';
const GRID = '#d5dce8';
const BLUE = '#2f6fde';
const ORANGE = '#e8872e';
const GREEN = '#2f9e6b';

type DragTestViewProps = EngineViewProps<GeoConfig, DragTestState, GeoAction>;

interface ScreenPoint {
  readonly x: number;
  readonly y: number;
}

function toScreen(rect: BoardRect, value: SPoint): ScreenPoint {
  return {
    x: rect.x + surdToScreen(value.x) * rect.spacing,
    y: rect.y + surdToScreen(value.y) * rect.spacing,
  };
}

function valueOf(values: ReadonlyMap<string, GraphValue | null>, id: string): SPoint | null {
  const value = values.get(id) ?? null;
  if (value && 'x' in value && 'y' in value) return value;
  return null;
}

function latticeAt(rect: BoardRect, point: Point, lattice: number): readonly [number, number] {
  return [
    clamp(Math.round((point.x - rect.x) / rect.spacing), 0, lattice),
    clamp(Math.round((point.y - rect.y) / rect.spacing), 0, lattice),
  ];
}

function labelOf(nodes: readonly DragNode[], id: string): string {
  const node = nodes.find((candidate) => candidate.id === id);
  return node && isPointNode(node) ? node.label : '';
}

function tickMarks(
  first: ScreenPoint,
  second: ScreenPoint,
  count: number,
  color: string,
  keyPrefix: string,
): ReactNode[] {
  const dx = second.x - first.x;
  const dy = second.y - first.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return [];
  const direction = { x: dx / length, y: dy / length };
  const normal = { x: -direction.y, y: direction.x };
  const middle = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
  const marks: ReactNode[] = [];
  for (let index = 0; index < count; index += 1) {
    const offset = (index - (count - 1) / 2) * 6;
    const center = { x: middle.x + direction.x * offset, y: middle.y + direction.y * offset };
    marks.push(
      <line
        key={`${keyPrefix}-${index}`}
        data-testid="drag-tick"
        x1={center.x - normal.x * 8}
        y1={center.y - normal.y * 8}
        x2={center.x + normal.x * 8}
        y2={center.y + normal.y * 8}
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
      />,
    );
  }
  return marks;
}

function equalSideGroups(points: readonly SPoint[]): number[][] {
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

function angleDegrees(points: readonly SPoint[], index: number): number | null {
  const previous = points[(index - 1 + points.length) % points.length];
  const current = points[index];
  const next = points[(index + 1) % points.length];
  if (!previous || !current || !next) return null;
  const ax = surdToScreen(previous.x) - surdToScreen(current.x);
  const ay = surdToScreen(previous.y) - surdToScreen(current.y);
  const bx = surdToScreen(next.x) - surdToScreen(current.x);
  const by = surdToScreen(next.y) - surdToScreen(current.y);
  const length = Math.hypot(ax, ay) * Math.hypot(bx, by);
  if (length === 0) return null;
  const cosine = clamp((ax * bx + ay * by) / length, -1, 1);
  return Math.round((Math.acos(cosine) * 180) / Math.PI);
}

export function DragTestView({
  state,
  dispatch,
  cpa,
  readOnly = false,
  targetSize,
}: DragTestViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const rendered = useRenderedSize(svgRef);
  const hitRadius = Math.max(16, Math.ceil(minTouchRadius(targetSize, rendered, LOGICAL)));
  const lattice = state.settings.lattice;
  const rect = boardRect(lattice + 1, lattice + 1);
  const [cursor, setCursor] = useState<readonly [number, number]>([0, 0]);
  const [keyPoint, setKeyPoint] = useState<string | null>(null);
  const [pending, setPending] = useState<string[]>([]);
  const [lineBase, setLineBase] = useState<string | null>(null);
  const [grabbed, setGrabbed] = useState<string | null>(null);
  const [quadHandle, setQuadHandle] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const dragRef = useRef<{
    readonly pointerId: number;
    readonly node: string | null;
    readonly handle: number | null;
  } | null>(null);

  const values = useMemo(() => evaluate(state.nodes), [state.nodes]);
  const points = state.nodes.filter(isPointNode);
  const figureResult = useMemo(() => currentFigure(state), [state]);
  const figure = figureResult.figure;
  const props = figureResult.props;
  const reduced =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const screenOf = (value: SPoint): ScreenPoint => toScreen(rect, value);

  const pointScreen = (id: string): ScreenPoint | null => {
    const value = valueOf(values, id);
    return value ? screenOf(value) : null;
  };

  const nearestPoint = (point: Point): string | null => {
    let best: { id: string; distance: number } | null = null;
    for (const node of points) {
      const screen = pointScreen(node.id);
      if (!screen) continue;
      const distance = Math.hypot(screen.x - point.x, screen.y - point.y);
      if (distance <= hitRadius && (!best || distance < best.distance)) {
        best = { id: node.id, distance };
      }
    }
    return best?.id ?? null;
  };

  const pointAtCursor = (): string | null => {
    if (keyPoint && pointScreen(keyPoint)) return keyPoint;
    const screen = { x: rect.x + cursor[0] * rect.spacing, y: rect.y + cursor[1] * rect.spacing };
    return nearestPoint(screen);
  };

  const resetPending = () => {
    setPending([]);
    setLineBase(null);
    setMessage('');
  };

  const chooseTool = (tool: DragTool) => {
    if (readOnly) return;
    resetPending();
    setGrabbed(null);
    dispatch({ type: 'select-drag-tool', tool });
  };

  const rejectedRank = (id: string): boolean => {
    if (rankOf(state.nodes, id) === 0) return false;
    setMessage(S.dragTest.rejected);
    return true;
  };

  const pressPoint = (id: string) => {
    if (readOnly) return;
    setQuadHandle(null);
    setKeyPoint(id);
    setMessage('');
    const tool = state.tool;
    if (tool === 'move') {
      setGrabbed((current) => (current === id ? null : id));
      return;
    }
    if (tool === 'segment') {
      if (pending.length === 0) {
        setPending([id]);
        return;
      }
      const first = pending[0];
      if (first && first !== id) dispatch({ type: 'add-segment', a: first, b: id });
      setPending([]);
      return;
    }
    if (tool === 'compass') {
      if (pending.length === 0 || pending.length === 1) {
        if (rejectedRank(id)) return;
        setPending([...pending, id]);
        return;
      }
      const from = pending[0];
      const to = pending[1];
      if (!from || !to) return;
      if (rejectedRank(id)) return;
      dispatch({ type: 'add-circle', center: id, from, to });
      setPending([]);
      return;
    }
    if (tool === 'perpendicular' || tool === 'parallel') {
      if (!lineBase) {
        setMessage(S.dragTest.pending(1));
        return;
      }
      if (rejectedRank(id)) return;
      dispatch({ type: 'add-line', kind: tool, base: lineBase, through: id });
      setLineBase(null);
    }
  };

  const addFreePoint = () => {
    if (readOnly) return;
    dispatch({ type: 'add-point', at: [cursor[0], cursor[1]] });
    setMessage('');
  };

  const jumpPoint = (direction: 1 | -1) => {
    if (points.length === 0) return;
    const currentIndex = keyPoint ? points.findIndex((node) => node.id === keyPoint) : -1;
    const nextIndex = (currentIndex + direction + points.length) % points.length;
    const node = points[nextIndex];
    if (!node) return;
    const value = valueOf(values, node.id);
    if (!value) return;
    setKeyPoint(node.id);
    setCursor([
      clamp(Math.round(surdToScreen(value.x)), 0, lattice),
      clamp(Math.round(surdToScreen(value.y)), 0, lattice),
    ]);
  };

  const onCanvasKeyDown = (event: ReactKeyboardEvent<SVGSVGElement>) => {
    if (readOnly) return;
    const key = event.key;
    if (state.quad && key >= '1' && key <= '4') {
      event.preventDefault();
      setQuadHandle(Number(key) - 1);
      setKeyPoint(null);
      return;
    }
    if (key === 'Escape' && quadHandle !== null) {
      event.preventDefault();
      setQuadHandle(null);
      return;
    }
    if (key === ' ' || key === 'Spacebar') {
      event.preventDefault();
      if (event.shiftKey) jumpPoint(-1);
      else jumpPoint(1);
      return;
    }
    if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight') {
      event.preventDefault();
      const node = grabbed ? state.nodes.find((candidate) => candidate.id === grabbed) : null;
      if (node?.kind === 'free') {
        const next: readonly [number, number] = [
          clamp(node.at[0] + (key === 'ArrowRight' ? 1 : key === 'ArrowLeft' ? -1 : 0), 0, lattice),
          clamp(node.at[1] + (key === 'ArrowDown' ? 1 : key === 'ArrowUp' ? -1 : 0), 0, lattice),
        ];
        dispatch({ type: 'move-point', id: node.id, at: next });
        setCursor(next);
        return;
      }
      if (node?.kind === 'on-circle' && (key === 'ArrowLeft' || key === 'ArrowRight')) {
        dispatch({
          type: 'move-point',
          id: node.id,
          pos: node.pos + (key === 'ArrowRight' ? 1 : -1),
        });
        return;
      }
      if (quadHandle !== null && adjustQuadHandle(quadHandle, key)) return;
      setKeyPoint(null);
      setCursor([
        clamp(cursor[0] + (key === 'ArrowRight' ? 1 : key === 'ArrowLeft' ? -1 : 0), 0, lattice),
        clamp(cursor[1] + (key === 'ArrowDown' ? 1 : key === 'ArrowUp' ? -1 : 0), 0, lattice),
      ]);
      return;
    }
    if (key === 'Enter') {
      event.preventDefault();
      const id = pointAtCursor();
      if (state.tool === 'free-point') {
        if (id) pressPoint(id);
        else addFreePoint();
        return;
      }
      if (state.tool === 'move') {
        if (id) pressPoint(id);
        return;
      }
      if (id) pressPoint(id);
      return;
    }
    if (key === 'Backspace' || key === 'Delete') {
      event.preventDefault();
      const id = pointAtCursor() ?? state.nodes[state.nodes.length - 1]?.id ?? null;
      if (id) dispatch({ type: 'remove-node', id });
      setPending([]);
      setKeyPoint(null);
    }
  };

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (readOnly) return;
    const point = pointerToLogical(event, svgRef.current, LOGICAL);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // jsdom·이미 끝난 포인터.
    }
    const handle = quadHandleAt(point);
    if (handle !== null) {
      setQuadHandle(handle);
      dragRef.current = { pointerId: event.pointerId, node: null, handle };
      return;
    }
    setQuadHandle(null);
    const id = nearestPoint(point);
    dragRef.current = { pointerId: event.pointerId, node: id, handle: null };
    if (id) {
      pressPoint(id);
      return;
    }
    if (state.tool === 'free-point') {
      const at = latticeAt(rect, point, lattice);
      dispatch({ type: 'add-point', at });
      setCursor(at);
    }
  };

  const onPointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag || readOnly || drag.pointerId !== event.pointerId) return;
    const point = pointerToLogical(event, svgRef.current, LOGICAL);
    if (drag.handle !== null) {
      applyQuadHandle(drag.handle, point);
      return;
    }
    if (!drag.node) return;
    const node = state.nodes.find((candidate) => candidate.id === drag.node);
    if (!node) return;
    if (node.kind === 'free') {
      const at = latticeAt(rect, point, lattice);
      if (at[0] !== node.at[0] || at[1] !== node.at[1]) {
        dispatch({ type: 'move-point', id: node.id, at });
      }
    } else if (node.kind === 'on-circle') {
      const circle = state.nodes.find((candidate) => candidate.id === node.circle);
      if (!circle || circle.kind !== 'circle') return;
      const center = pointScreen(circle.center);
      const from = pointScreen(circle.from);
      const to = pointScreen(circle.to);
      if (!center || !from || !to) return;
      const base = Math.atan2(to.y - from.y, to.x - from.x);
      const angle = Math.atan2(point.y - center.y, point.x - center.x);
      const step = (Math.PI * 2) / 48;
      const pos = ((Math.round((angle - base) / step) % 48) + 48) % 48;
      dispatch({ type: 'move-point', id: node.id, pos });
    }
  };

  const quadPoints = state.quad
    ? quadGeometry(state.quad, lattice, state.toggles as readonly QuadToggle[])
    : null;

  const quadScreen = (): ScreenPoint[] => {
    if (!quadPoints) return [];
    return quadPoints.map((value) => ({
      x: rect.x + ratToScreen(value.x) * rect.spacing,
      y: rect.y + ratToScreen(value.y) * rect.spacing,
    }));
  };

  const quadHandleAt = (point: Point): number | null => {
    const handles = quadScreen();
    for (let index = 0; index < handles.length; index += 1) {
      const handle = handles[index];
      if (!handle) continue;
      if (Math.hypot(handle.x - point.x, handle.y - point.y) <= hitRadius) return index;
    }
    return null;
  };

  const setParams = (
    params: readonly {
      readonly param: QuadParamName;
      readonly value: number | readonly [number, number];
    }[],
  ) => {
    dispatch({ type: 'set-quad-params', params });
  };

  const setParam = (param: QuadParamName, value: number | readonly [number, number]) => {
    setParams([{ param, value }]);
  };

  const applyQuadHandle = (index: number, point: Point) => {
    if (!state.quad) return;
    const at = latticeAt(rect, point, lattice);
    const handles = quadScreen();
    const center = {
      x: rect.x + (lattice / 2) * rect.spacing,
      y: rect.y + (lattice / 2) * rect.spacing,
    };
    if (state.quad.kind === 'from-diagonals') {
      if (index === 0) {
        setParam('p', [at[0] - Math.round(lattice / 2), at[1] - Math.round(lattice / 2)]);
        return;
      }
      const aScreen = handles[0];
      if (!aScreen) return;
      const pLength = Math.hypot(aScreen.x - center.x, aScreen.y - center.y);
      if (pLength === 0) return;
      if (index === 2) {
        const gamma =
          ((center.x - point.x) * (aScreen.x - center.x) +
            (center.y - point.y) * (aScreen.y - center.y)) /
          (pLength * pLength);
        setParam('gamma', clamp(Math.round(gamma * 4 - 1), 0, 11));
        return;
      }
      // B·D 손잡이는 지금 손잡이 위치가 아니라 포인터 위치로 비율·각을 잰다.
      const ratio = Math.hypot(point.x - center.x, point.y - center.y) / pLength;
      if (index === 1) {
        const angle =
          Math.atan2(point.y - center.y, point.x - center.x) -
          Math.atan2(aScreen.y - center.y, aScreen.x - center.x);
        const normalized = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        setParams([
          {
            param: 't',
            value: clamp(Math.round(normalized / ((Math.PI * 2) / 48)) % 24 || 1, 1, 23),
          },
          { param: 'beta', value: clamp(Math.round(ratio * 4 - 1), 0, 11) },
        ]);
      } else {
        setParam('delta', clamp(Math.round(ratio * 4 - 1), 0, 11));
      }
      return;
    }
    if (index === 1) {
      setParam('u', [at[0] - Math.floor(lattice / 4), at[1] - Math.floor((lattice * 3) / 4)]);
      return;
    }
    const aScreen = handles[0];
    const bScreen = handles[1];
    const dScreen = handles[3];
    if (!aScreen || !bScreen || !dScreen) return;
    if (index === 3) {
      const ab = Math.hypot(aScreen.x - bScreen.x, aScreen.y - bScreen.y);
      const ad = Math.hypot(point.x - aScreen.x, point.y - aScreen.y);
      if (ab === 0) return;
      const baseAngle = Math.atan2(bScreen.y - aScreen.y, bScreen.x - aScreen.x);
      const angle = Math.atan2(point.y - aScreen.y, point.x - aScreen.x) - baseAngle;
      const normalized = ((-angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      // 길이(s)와 방향(t)을 한 Action으로 보내 중간 모양에서 거절되지 않게 한다.
      setParams([
        { param: 's', value: clamp(Math.round((ad / ab) * 4 - 1), 0, 11) },
        { param: 't', value: clamp(Math.round(normalized / ((Math.PI * 2) / 48)) || 2, 2, 22) },
      ]);
      return;
    }
    if (index === 2) {
      if (state.toggles.includes('two-parallel-pairs')) return;
      if (state.toggles.includes('one-parallel-pair')) {
        const ab = Math.hypot(bScreen.x - aScreen.x, bScreen.y - aScreen.y) || 1;
        setParam(
          'kappa',
          clamp(
            Math.round((Math.hypot(point.x - dScreen.x, point.y - dScreen.y) / ab) * 4 - 1),
            0,
            11,
          ),
        );
      } else {
        setParam('c', [at[0] - Math.floor(lattice / 4), at[1] - Math.floor((lattice * 3) / 4)]);
      }
    }
  };

  /** 손잡이를 고른 뒤 방향키로 매개변수를 한 단계씩 바꾼다(AGENTS 6). */
  const adjustQuadHandle = (index: number, key: string): boolean => {
    if (!state.quad) return false;
    const dx = key === 'ArrowRight' ? 1 : key === 'ArrowLeft' ? -1 : 0;
    const dy = key === 'ArrowDown' ? 1 : key === 'ArrowUp' ? -1 : 0;
    // 벡터는 화면 방향(dx, dy), 단계 값은 ↑/→ +1, ↓/← −1이다.
    const step = dx !== 0 ? dx : key === 'ArrowUp' ? 1 : key === 'ArrowDown' ? -1 : 0;
    if (step === 0) return false;
    if (state.quad.kind === 'from-diagonals') {
      if (index === 0) {
        setParam('p', [state.quad.p[0] + dx, state.quad.p[1] + dy]);
        return true;
      }
      if (index === 1) {
        setParam(dx !== 0 ? 't' : 'beta', (dx !== 0 ? state.quad.t : state.quad.beta) + step);
        return true;
      }
      if (index === 2) {
        setParam('gamma', state.quad.gamma + step);
        return true;
      }
      if (index === 3) {
        setParam('delta', state.quad.delta + step);
        return true;
      }
      return false;
    }
    if (index === 1) {
      setParam('u', [state.quad.u[0] + dx, state.quad.u[1] + dy]);
      return true;
    }
    if (index === 2) {
      if (state.toggles.includes('two-parallel-pairs')) return false;
      if (state.toggles.includes('one-parallel-pair')) {
        setParam('kappa', state.quad.kappa + step);
      } else {
        setParam('c', [state.quad.c[0] + dx, state.quad.c[1] + dy]);
      }
      return true;
    }
    if (index === 3) {
      setParam(dx !== 0 ? 't' : 's', (dx !== 0 ? state.quad.t : state.quad.s) + step);
      return true;
    }
    return false;
  };

  const intersectionCandidates = useMemo(() => {
    const result: { of: readonly [string, string]; which: 0 | 1 }[] = [];
    const objects = state.nodes.filter((node) => !isPointNode(node));
    for (let first = 0; first < objects.length; first += 1) {
      for (let second = first + 1; second < objects.length; second += 1) {
        const a = objects[first];
        const b = objects[second];
        if (!a || !b) continue;
        const bothCircles = a.kind === 'circle' && b.kind === 'circle';
        const lineKinds = new Set(['segment', 'perpendicular', 'parallel']);
        const bothLines = lineKinds.has(a.kind) && lineKinds.has(b.kind);
        if (!bothCircles && !bothLines) continue;
        const definitions = [
          ...definitionPoints(state.nodes, a.id),
          ...definitionPoints(state.nodes, b.id),
        ];
        if (!allRankZero(state.nodes, definitions)) continue;
        const of = [a.id, b.id] as const;
        if (bothCircles) {
          for (const which of [0, 1] as const) {
            const tentative: DragNode = {
              id: '__candidate__',
              kind: 'intersection',
              label: '',
              of,
              which,
            };
            const value = evaluate([...state.nodes, tentative]).get('__candidate__');
            if (value) result.push({ of, which });
          }
        } else {
          const tentative: DragNode = {
            id: '__candidate__',
            kind: 'intersection',
            label: '',
            of,
            which: 0,
          };
          const value = evaluate([...state.nodes, tentative]).get('__candidate__');
          if (value) result.push({ of, which: 0 });
        }
      }
    }
    return result;
  }, [state.nodes]);

  const circleCandidates = state.nodes.filter(
    (node) =>
      node.kind === 'circle' && allRankZero(state.nodes, definitionPoints(state.nodes, node.id)),
  );

  const liveProps = props ? propertyKeys(props) : [];

  const renderPoint = (node: DragNode) => {
    if (!isPointNode(node)) return null;
    const value = valueOf(values, node.id);
    if (!value) return null;
    const screen = screenOf(value);
    const rank = rankOf(state.nodes, node.id);
    const picked = state.pickedAngles.includes(node.id);
    const chosen = keyPoint === node.id || grabbed === node.id;
    return (
      <g key={node.id}>
        <circle
          cx={screen.x}
          cy={screen.y}
          r={chosen ? 11 : 7}
          fill={rank === 1 ? PAPER : node.kind === 'free' ? INK : BLUE}
          stroke={chosen ? ORANGE : node.kind === 'free' ? INK : BLUE}
          strokeWidth={chosen ? 4 : 2.5}
          strokeDasharray={rank === 1 ? '3 2' : undefined}
          style={{ transition: reduced ? 'none' : 'cx 600ms ease, cy 600ms ease' }}
          pointerEvents="none"
        />
        {picked ? (
          <circle
            cx={screen.x}
            cy={screen.y}
            r={18}
            fill="none"
            stroke={GREEN}
            strokeWidth={3}
            pointerEvents="none"
          />
        ) : null}
        <text
          x={screen.x + 12}
          y={screen.y - 12}
          fontSize={17}
          fontWeight={700}
          fill={INK}
          pointerEvents="none"
        >
          {node.label}
        </text>
      </g>
    );
  };

  const renderObject = (node: DragNode) => {
    if (isPointNode(node)) return null;
    if (node.kind === 'segment') {
      const segment = segmentValue(values, node.id);
      if (!segment) return null;
      const a = screenOf(segment.a);
      const b = screenOf(segment.b);
      return (
        <line
          key={node.id}
          x1={a.x}
          y1={a.y}
          x2={b.x}
          y2={b.y}
          stroke={INK}
          strokeWidth={3.5}
          strokeLinecap="round"
          pointerEvents="none"
        />
      );
    }
    if (node.kind === 'circle') {
      const value = values.get(node.id);
      if (!value || !('shape' in value) || value.shape !== 'circle') return null;
      const center = screenOf(value.center);
      return (
        <circle
          key={node.id}
          cx={center.x}
          cy={center.y}
          r={Math.sqrt(ratToScreen(value.radiusSq)) * rect.spacing}
          fill="none"
          stroke={BLUE}
          strokeWidth={2.5}
          strokeDasharray="7 5"
          pointerEvents="none"
        />
      );
    }
    const line = lineValue(values, node.id);
    if (!line) return null;
    const p = screenOf(line.p);
    const q = screenOf(line.q);
    const extension = extensionSegment(p, q, 'line');
    return (
      <line
        key={node.id}
        x1={extension.start.x}
        y1={extension.start.y}
        x2={extension.end.x}
        y2={extension.end.y}
        stroke={MUTED}
        strokeWidth={2.5}
        strokeDasharray={node.kind === 'parallel' ? '10 6' : '3 7'}
        pointerEvents="none"
      />
    );
  };

  const figureTicks = (): ReactNode[] => {
    if (!figure || state.settings.measure.length === 0) return [];
    const screens = figure.points.map(screenOf);
    const groups = equalSideGroups(figure.points);
    return groups.flatMap((group, number) =>
      group.flatMap((edge) => {
        const first = screens[edge];
        const second = screens[(edge + 1) % screens.length];
        if (!first || !second) return [];
        return tickMarks(first, second, Math.min(3, number + 1), GREEN, `tick-${number}-${edge}`);
      }),
    );
  };

  const measureRows = (): ReactNode[] => {
    if (!figure || !props) return [];
    const rows: ReactNode[] = [];
    if (state.settings.measure.includes('sideLengths')) {
      figure.points.forEach((point, index) => {
        const next = figure.points[(index + 1) % figure.points.length];
        if (!next) return;
        const square = sDist2(point, next);
        if (!square) return;
        const value = Math.sqrt(surdToScreen(square)) / 2;
        const labels = `${figure.labels[index] ?? ''}${figure.labels[(index + 1) % figure.labels.length] ?? ''}`;
        rows.push(
          <tr key={`side-${index}`}>
            <th scope="row">{labels}</th>
            <td>{value.toFixed(1)}</td>
          </tr>,
        );
      });
    }
    if (state.settings.measure.includes('angles')) {
      figure.points.forEach((_, index) => {
        const value = angleDegrees(figure.points, index);
        if (value === null) return;
        rows.push(
          <tr key={`angle-${index}`}>
            <th scope="row">{`∠${figure.labels[index] ?? ''}`}</th>
            <td>{value}°</td>
          </tr>,
        );
      });
    }
    return rows;
  };

  const liveLines: string[] = [];
  if (props) {
    liveLines.push(S.dragTest.liveRight(props.rightAngles));
    liveLines.push(S.dragTest.liveParallel(props.parallelPairs));
    liveLines.push(S.dragTest.liveEqual(props.equalSides));
    if (liveProps.includes('diagonals-bisect')) liveLines.push(S.dragTest.liveDiagonalBisect);
    if (liveProps.includes('diagonals-equal')) liveLines.push(S.dragTest.liveDiagonalEqual);
    if (liveProps.includes('diagonals-perpendicular')) {
      liveLines.push(S.dragTest.liveDiagonalPerpendicular);
    }
  }

  const toggleList =
    state.settings.construction === 'from-diagonals'
      ? state.settings.diagonalToggles
      : state.settings.construction === 'quad-conditions'
        ? state.settings.quadToggles
        : [];

  return (
    <div className={styles.wrap} data-target-size={targetSize}>
      <div className={styles.toolbar} role="toolbar" aria-label={S.dragTest.toolGroup}>
        {state.settings.tools.map((tool) => (
          <button
            key={tool}
            type="button"
            className={styles.button}
            aria-pressed={state.tool === tool}
            aria-label={S.dragTest.toolAria(S.dragTest.tools[tool])}
            onClick={() => chooseTool(tool)}
            disabled={readOnly}
          >
            {S.dragTest.tools[tool]}
          </button>
        ))}
      </div>

      <div className={styles.toolbar}>
        {toggleList.map((toggle) => (
          <button
            key={toggle}
            type="button"
            className={styles.button}
            aria-pressed={state.toggles.includes(toggle)}
            onClick={() => dispatch({ type: 'toggle-condition', condition: toggle })}
            disabled={readOnly}
          >
            {S.dragTest.toggles[toggle]}
          </button>
        ))}
        {state.settings.shakeButton ? (
          <button
            type="button"
            className={styles.button}
            onClick={() => dispatch({ type: 'shake' })}
            disabled={readOnly}
          >
            {S.dragTest.shake}
          </button>
        ) : null}
        <span className={styles.badge}>{S.dragTest.shakeCount(state.shakeCount)}</span>
        {state.settings.classifyLive && props ? (
          <span className={styles.hint}>{liveLines.join(' · ')}</span>
        ) : null}
      </div>

      <p className={styles.instructions}>{S.dragTest.instructions}</p>
      <p className={styles.status} role="status">
        {message || (pending.length > 0 ? S.dragTest.pending(pending.length) : '')}
      </p>

      <div className={styles.dragRow}>
        <div className={styles.boardArea}>
          <svg
            ref={svgRef}
            className={styles.canvas}
            viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`}
            role="group"
            aria-label={S.dragTest.canvasLabel}
            tabIndex={readOnly ? -1 : 0}
            data-testid="geo-canvas"
            data-cpa={cpa}
            onKeyDown={onCanvasKeyDown}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerCancel={() => {
              dragRef.current = null;
            }}
          >
            <rect width={LOGICAL_WIDTH} height={LOGICAL_HEIGHT} fill={PAPER} />
            <g stroke={GRID} strokeWidth={1} pointerEvents="none">
              {Array.from({ length: Math.floor(lattice / 2) + 1 }, (_, index) => {
                const offset = index * 2 * rect.spacing;
                return (
                  <g key={`grid-${index}`}>
                    <line
                      x1={rect.x + offset}
                      y1={rect.y}
                      x2={rect.x + offset}
                      y2={rect.y + rect.height}
                    />
                    <line
                      x1={rect.x}
                      y1={rect.y + offset}
                      x2={rect.x + rect.width}
                      y2={rect.y + offset}
                    />
                  </g>
                );
              })}
            </g>

            {figure ? (
              <polygon
                points={figure.points
                  .map((point) => {
                    const screen = screenOf(point);
                    return `${screen.x.toFixed(2)},${screen.y.toFixed(2)}`;
                  })
                  .join(' ')}
                fill="none"
                stroke={GREEN}
                strokeWidth={2}
                strokeOpacity={0.5}
                pointerEvents="none"
              />
            ) : null}

            {state.nodes.map(renderObject)}
            {figureTicks()}
            {state.nodes.map(renderPoint)}

            {quadScreen().map((handle, index) => (
              <g key={`handle-${index}`}>
                <rect
                  data-testid={`quad-handle-${index}`}
                  x={handle.x - 9}
                  y={handle.y - 9}
                  width={18}
                  height={18}
                  rx={4}
                  fill={ORANGE}
                  fillOpacity={0.75}
                  stroke={quadHandle === index ? INK : ORANGE}
                  strokeWidth={quadHandle === index ? 4 : 2}
                  pointerEvents="none"
                />
                <text x={handle.x + 12} y={handle.y - 10} fontSize={16} fontWeight={700} fill={INK}>
                  {S.dragTest.quadHandleLabels[index] ?? ''}
                </text>
              </g>
            ))}

            <circle
              cx={rect.x + cursor[0] * rect.spacing}
              cy={rect.y + cursor[1] * rect.spacing}
              r={Math.max(14, hitRadius * 0.55)}
              fill="none"
              stroke={ORANGE}
              strokeWidth={2}
              strokeDasharray="6 4"
              pointerEvents="none"
              data-testid="drag-cursor"
            />
          </svg>
        </div>

        <aside className={styles.dragAside}>
          {state.tool === 'intersection' ? (
            <div>
              <strong>{S.dragTest.candidates}</strong>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {intersectionCandidates.map((candidate, index) => (
                  <button
                    key={`candidate-${index}`}
                    type="button"
                    className={styles.button}
                    onClick={() =>
                      dispatch({
                        type: 'add-intersection',
                        of: candidate.of,
                        which: candidate.which,
                      })
                    }
                  >
                    {S.dragTest.candidate(index + 1)}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {state.tool === 'point-on-circle' ? (
            <div>
              <strong>{S.dragTest.circleCandidates}</strong>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {circleCandidates.map((circle, index) => (
                  <button
                    key={`circle-${circle.id}`}
                    type="button"
                    className={styles.button}
                    onClick={() => dispatch({ type: 'add-on-circle', circle: circle.id, pos: 0 })}
                  >
                    {S.dragTest.circleCandidate(index + 1)}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {state.tool === 'perpendicular' || state.tool === 'parallel' ? (
            <div>
              <strong>{S.dragTest.tools.segment}</strong>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {state.nodes
                  .filter((node) => node.kind === 'segment')
                  .map((node, index) => (
                    <button
                      key={`base-${node.id}`}
                      type="button"
                      className={styles.button}
                      aria-pressed={lineBase === node.id}
                      onClick={() => setLineBase(node.id)}
                    >
                      {`${S.dragTest.tools.segment} ${index + 1}`}
                    </button>
                  ))}
              </div>
            </div>
          ) : null}

          {state.settings.measure.length > 0 ? (
            <table
              data-testid="drag-measure"
              aria-label={S.dragTest.measureAria}
              style={{ borderCollapse: 'collapse' }}
            >
              <tbody>
                {measureRows().length > 0 ? (
                  measureRows()
                ) : (
                  <tr>
                    <td className={styles.hint}>{S.dragTest.measureEmpty}</td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : null}

          {state.settings.classifyLive ? (
            <section data-testid="drag-classify-live" aria-label={S.dragTest.liveAria}>
              {liveLines.map((line) => (
                <p key={line} className={styles.hint} style={{ margin: '0.2rem 0' }}>
                  {line}
                </p>
              ))}
            </section>
          ) : null}

          {figure && figure.ids.length > 0 ? (
            <div>
              <strong>{S.dragTest.pickHint}</strong>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {figure.ids.map((id) => (
                  <button
                    key={`pick-${id}`}
                    type="button"
                    className={styles.button}
                    aria-pressed={state.pickedAngles.includes(id)}
                    onClick={() => dispatch({ type: 'toggle-angle-pick', point: id })}
                  >
                    {labelOf(state.nodes, id)}
                  </button>
                ))}
              </div>
              {state.pickedAngles.length > 0 ? (
                <p className={styles.hint}>
                  {S.dragTest.picked(
                    state.pickedAngles.map((id) => labelOf(state.nodes, id)).join(', '),
                  )}
                </p>
              ) : null}
            </div>
          ) : null}
        </aside>
      </div>

      <div className={styles.hintBlock}>
        <p className={styles.hint}>{S.dragTest.canvasHint}</p>
        {state.quad ? <p className={styles.hint}>{S.dragTest.quadKeyHint}</p> : null}
        <p className={styles.hint}>
          {state.settings.construction === 'from-diagonals'
            ? S.dragTest.fromDiagonalsHint
            : state.settings.construction === 'quad-conditions'
              ? S.dragTest.quadConditionsHint
              : S.dragTest.instructions}
        </p>
      </div>
    </div>
  );
}
