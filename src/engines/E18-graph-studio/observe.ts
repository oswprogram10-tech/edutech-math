/**
 * E18의 관찰 결과. 판정·힌트는 이 값만 본다.
 *
 * 값은 모두 정수(number)다. 학생 그래프의 값은 칸 수 × scale로 계산한다.
 */
import type { JsonValue, Observation } from '../../core/engine-sdk';
import type { GraphState } from './types';

/** 그래프가 지금 나타내는 값(칸 × scale, given이면 data 값). */
export function graphValueOf(state: GraphState, cat: string): number {
  const { settings } = state;
  if (settings.graph === 'given') return settings.data?.[cat] ?? 0;
  return graphCellsOf(state, cat) * state.scale;
}

/** 막대 칸 수 또는 ○ 수. given이면 값 ÷ scale을 내린 값. */
export function graphCellsOf(state: GraphState, cat: string): number {
  const { settings } = state;
  if (settings.graph === 'given') return Math.floor((settings.data?.[cat] ?? 0) / state.scale);
  if (settings.graphType === 'o-mark') return (state.marks[cat] ?? []).length;
  return state.bars[cat] ?? 0;
}

/** ○ 칸이 0번부터 빈틈없이 이어지지 않은 범주(학생이 그린 ○ 그래프만). */
export function gapCategoriesOf(state: GraphState): string[] {
  const { settings } = state;
  if (settings.graph !== 'student' || settings.graphType !== 'o-mark') return [];
  return settings.categories.filter((cat) => {
    const marks = state.marks[cat] ?? [];
    if (marks.length === 0) return false;
    return marks.some((cell, index) => cell !== index);
  });
}

/** data 값이 scale로 나누어떨어지지 않는 범주. */
export function offGridCategoriesOf(state: GraphState): string[] {
  const { data, categories } = state.settings;
  if (!data) return [];
  return categories.filter((cat) => (data[cat] ?? 0) % state.scale !== 0);
}

/** 그래프와 비교할 기준 표 값: 표가 student면 학생 표, 아니면 data. 없으면 null. */
export function tableReferenceOf(state: GraphState, cat: string): number | null {
  if (state.settings.table === 'student') return state.table[cat] ?? null;
  return state.settings.data?.[cat] ?? null;
}

/** 학생 그래프를 다 그렸고(모든 범주 1칸 이상) 표와 다른 범주들. 다 그리기 전에는 빈 배열. */
export function mismatchCategoriesOf(state: GraphState): string[] {
  const { settings } = state;
  if (settings.graph !== 'student' || settings.categories.length === 0) return [];
  if (!settings.categories.every((cat) => graphCellsOf(state, cat) >= 1)) return [];
  return settings.categories.filter((cat) => {
    const reference = tableReferenceOf(state, cat);
    return reference !== null && reference !== graphValueOf(state, cat);
  });
}

function tableCompleteOf(state: GraphState): boolean {
  const { categories } = state.settings;
  return categories.length > 0 && categories.every((cat) => state.table[cat] !== null);
}

function tableTotalOf(state: GraphState): number {
  return state.settings.categories.reduce((sum, cat) => sum + (state.table[cat] ?? 0), 0);
}

export function observe(state: GraphState): Observation {
  const { settings } = state;
  const categories = settings.categories;
  const graphValues: Record<string, number> = {};
  const graphCells: Record<string, number> = {};
  const table: Record<string, number | null> = {};
  for (const cat of categories) {
    graphValues[cat] = graphValueOf(state, cat);
    graphCells[cat] = graphCellsOf(state, cat);
    table[cat] = state.table[cat] ?? null;
  }

  const data = settings.data;
  const tableComplete = tableCompleteOf(state);
  const tableTotal = tableTotalOf(state);
  const gapCategories = gapCategoriesOf(state);
  const offGridCategories = offGridCategoriesOf(state);

  const graphMatchesData =
    data !== null &&
    categories.length > 0 &&
    categories.every((cat) => graphValues[cat] === data[cat]);
  const graphMatchesTable =
    categories.length > 0 &&
    categories.every((cat) => {
      const value = table[cat];
      return value !== null && value !== undefined && graphValues[cat] === value;
    });

  const misconceptions = new Set<string>();
  if (gapCategories.length > 0) misconceptions.add('MC-GRAPH-GAP-ORDER');
  if (mismatchCategoriesOf(state).length > 0) misconceptions.add('MC-GRAPH-TABLE-MISMATCH');
  if (
    settings.rawItems.length > 0 &&
    settings.table === 'student' &&
    tableComplete &&
    tableTotal !== settings.rawItems.length
  ) {
    misconceptions.add('MC-COUNT-ONE-TO-ONE');
  }

  const result: Record<string, JsonValue> = {
    mode: state.mode,
    graphType: settings.graphType,
    graphSource: settings.graph,
    orientation: state.orientation,
    scale: state.scale,
    flipped: state.orientation !== settings.orientation,
    table,
    tableComplete,
    tableTotal,
    talliedCount: state.tallied.length,
    rawCount: settings.rawItems.length,
    graphValues,
    graphCells,
    graphMatchesData,
    graphMatchesTable,
    gapCategories,
    offGridCategories,
    misconceptions: [...misconceptions].sort(),
  };
  if (data !== null) {
    result['tableMatchesData'] =
      categories.length > 0 && categories.every((cat) => table[cat] === data[cat]);
  }
  return result;
}
