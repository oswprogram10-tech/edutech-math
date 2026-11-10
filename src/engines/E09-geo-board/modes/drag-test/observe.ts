/**
 * drag-test의 관찰 결과·판정(T101).
 *
 * 성질 목록은 Observation에만 두고, 화면에는 `classifyLive`일 때 이름 없이 수만 쓴다.
 */
import type { EnginePredicate, JsonValue, Observation } from '../../../../core/engine-sdk';
import { sSignedCos2, surdEquals } from '../../../../core/math';
import { figureProperties, propertyKeys } from '../../properties';
import type { FigureProps } from '../../properties';
import { closeQuadToggles } from './quad';
import { figureOf, isPointNode, rankOf } from './graph';
import type { GraphFigure } from './graph';
import type { DragConstruction, DragNode, DragTestState, QuadToggle } from './types';

export interface FigureResult {
  readonly figure: GraphFigure | null;
  readonly props: FigureProps | null;
}

function figureResult(nodes: readonly DragNode[], construction: DragConstruction): FigureResult {
  const figure = figureOf(nodes, construction);
  const props = figure ? figureProperties(figure.points) : null;
  return { figure, props };
}

function propertyList(props: FigureProps | null): string[] {
  return props ? propertyKeys(props) : [];
}

function angleValue(figure: GraphFigure, id: string) {
  const index = figure.ids.indexOf(id);
  if (index < 0) return null;
  const previous = figure.points[(index - 1 + figure.points.length) % figure.points.length];
  const current = figure.points[index];
  const next = figure.points[(index + 1) % figure.points.length];
  if (!previous || !current || !next) return null;
  return sSignedCos2(previous, current, next);
}

function angleEquality(figure: GraphFigure | null, picked: readonly string[]): boolean | null {
  if (!figure || picked.length !== 2) return null;
  const firstId = picked[0];
  const secondId = picked[1];
  if (!firstId || !secondId) return null;
  if (!figure.ids.includes(firstId) || !figure.ids.includes(secondId)) return null;
  const first = angleValue(figure, firstId);
  const second = angleValue(figure, secondId);
  if (!first || !second) return null;
  return surdEquals(first, second);
}

function labelsOf(nodes: readonly DragNode[], ids: readonly string[]): string[] {
  const result: string[] = [];
  for (const id of ids) {
    const node = nodes.find((candidate) => candidate.id === id);
    if (node && isPointNode(node)) result.push(node.label);
  }
  return result;
}

function pointObservations(nodes: readonly DragNode[]) {
  return nodes.filter(isPointNode).map((node) => ({
    label: node.label,
    rank: rankOf(nodes, node.id),
  }));
}

function toolsUsed(nodes: readonly DragNode[]): string[] {
  return [...new Set(nodes.map((node) => node.kind))].sort();
}

function lastShakeOf(state: DragTestState) {
  if (!state.preShake) return null;
  const before = figureResult(state.preShake.nodes, state.settings.construction);
  const after = figureResult(state.nodes, state.settings.construction);
  const beforeKeys = propertyList(before.props);
  const afterKeys = propertyList(after.props);
  const beforeSet = new Set(beforeKeys);
  const afterSet = new Set(afterKeys);
  const kept = beforeKeys.filter((key) => afterSet.has(key));
  const lost = beforeKeys.filter((key) => !afterSet.has(key));
  const gained = afterKeys.filter((key) => !beforeSet.has(key));
  // 고른 각의 비교는 흔들기 전후 두 기하에서 따로 한다.
  const pickedBefore = angleEquality(before.figure, state.pickedAngles);
  const pickedAfter = angleEquality(after.figure, state.pickedAngles);
  return {
    before: beforeKeys,
    after: afterKeys,
    kept,
    lost,
    gained,
    pickedEqual:
      pickedBefore === null || pickedAfter === null
        ? null
        : { before: pickedBefore, after: pickedAfter },
  };
}

export function observeDragTest(state: DragTestState): Observation {
  const current = figureResult(state.nodes, state.settings.construction);
  const lastShake = lastShakeOf(state);
  const pickedAngles = labelsOf(state.nodes, state.pickedAngles);
  const figure = current.figure;
  const props = current.props;

  return {
    mode: state.mode,
    construction: state.settings.construction,
    points: pointObservations(state.nodes),
    toolsUsed: toolsUsed(state.nodes),
    figure:
      figure === null
        ? null
        : {
            kind: figure.kind,
            labels: figure.labels,
            exact: props !== null,
            props: propertyList(props),
            names: props ? [...props.names] : [],
          },
    toggles: [...state.toggles].sort(),
    shakeCount: state.shakeCount,
    lastShakeMoved: state.lastShakeMoved,
    lastShake:
      lastShake === null
        ? null
        : {
            before: lastShake.before,
            after: lastShake.after,
            kept: lastShake.kept,
            lost: lastShake.lost,
            gained: lastShake.gained,
          },
    pickedAngles,
    pickedAnglesEqual: lastShake?.pickedEqual ?? null,
  };
}

function argsRecord(args: JsonValue | undefined): Readonly<Record<string, JsonValue>> {
  if (args === null || typeof args !== 'object' || Array.isArray(args)) return {};
  return args;
}

function stringsOf(value: JsonValue | undefined): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function figureOfObservation(observation: Observation): Readonly<Record<string, JsonValue>> | null {
  const value = observation['figure'];
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  return value;
}

function allIncluded(actual: readonly string[], expected: readonly string[]): boolean {
  const set = new Set(actual);
  return expected.every((value) => set.has(value));
}

function closedToggleSet(observation: Observation, values: readonly string[]): Set<string> {
  const construction = observation['construction'];
  if (construction === 'quad-conditions') {
    return new Set(closeQuadToggles(values as QuadToggle[]));
  }
  return new Set(values);
}

export const dragTestPredicates: Readonly<Record<string, EnginePredicate>> = {
  figureHas: (observation, args) => {
    const figure = figureOfObservation(observation);
    if (!figure) return false;
    const props = stringsOf(figure['props']);
    return allIncluded(props, stringsOf(argsRecord(args)['props']));
  },

  figureNamed: (observation, args) => {
    const figure = figureOfObservation(observation);
    if (!figure) return false;
    const name = argsRecord(args)['name'];
    if (typeof name !== 'string') return false;
    return stringsOf(figure['names']).includes(name);
  },

  figureNotNamed: (observation, args) => {
    const figure = figureOfObservation(observation);
    if (!figure) return false;
    const name = argsRecord(args)['name'];
    if (typeof name !== 'string') return false;
    return !stringsOf(figure['names']).includes(name);
  },

  keptAfterShake: (observation, args) => {
    const last = observation['lastShake'];
    if (last === null || typeof last !== 'object' || Array.isArray(last)) return false;
    return allIncluded(stringsOf(last['kept']), stringsOf(argsRecord(args)['props']));
  },

  lostAfterShake: (observation, args) => {
    const last = observation['lastShake'];
    if (last === null || typeof last !== 'object' || Array.isArray(last)) return false;
    return allIncluded(stringsOf(last['lost']), stringsOf(argsRecord(args)['props']));
  },

  shaken: (observation, args) => {
    const count = argsRecord(args)['min'];
    const shakes = observation['shakeCount'];
    return typeof count === 'number' && typeof shakes === 'number' && shakes >= count;
  },

  usedTools: (observation, args) => {
    const kinds = stringsOf(observation['toolsUsed']);
    const expected = stringsOf(argsRecord(args)['kinds']);
    return expected.length > 0 && allIncluded(kinds, expected);
  },

  togglesAre: (observation, args) => {
    const expected = stringsOf(argsRecord(args)['toggles']);
    const actual = stringsOf(observation['toggles']);
    const wanted = closedToggleSet(observation, expected);
    const have = closedToggleSet(observation, actual);
    if (wanted.size !== have.size) return false;
    return [...wanted].every((value) => have.has(value));
  },

  pickedAnglesInvariant: (observation) => {
    const picked = stringsOf(observation['pickedAngles']);
    if (picked.length !== 2) return false;
    const equal = observation['pickedAnglesEqual'];
    if (equal === null || typeof equal !== 'object' || Array.isArray(equal)) return false;
    return equal['before'] === true && equal['after'] === true;
  },
};

/** E17 연동용. 이름·토글이 바뀔 때만 낸다. */
export function figureChangedPayload(state: DragTestState): {
  readonly names: string[];
  readonly toggles: string[];
} {
  const { props } = figureResult(state.nodes, state.settings.construction);
  return {
    names: props ? [...props.names] : [],
    toggles: [...state.toggles].sort(),
  };
}

/** overlay가 쓰는 현재 도형. */
export function currentFigure(state: DragTestState): FigureResult {
  return figureResult(state.nodes, state.settings.construction);
}
