/**
 * E18 distortion(그래프 왜곡) 모드의 순수 계산: 설정 정리, 막대 묶기, 눈금·막대 높이, 비.
 *
 * 값은 0~1000 정수다. 화면 좌표(논리 1000×700)만 실수이고, 비(`visualRatio`·`valueRatio`)는 `Rational`로 구한다.
 * 막대 높이는 "화면 칸" 단위다: 값 축 한 칸은 `yStep`이고, 물결선을 보이면 맨 아래에 물결 칸 하나가 더 있어
 * 막대는 그 칸을 지나 자란다(축을 자른 자리를 막대가 이어 그린다).
 */
import { Rational } from '../../core/math';
import { frameOf } from './layout';
import type { Frame } from './layout';
import { ratioNumber } from './line';
import { CHECKLIST_ITEMS, DISTORTION_MAX, HEADLINE_MAX } from './types';
import type {
  ChecklistItem,
  DistortionControl,
  DistortionExample,
  DistortionGroup,
  DistortionSettings,
  DistortionState,
} from './types';

const CONTROLS: readonly DistortionControl[] = ['yStart', 'yStep', 'wavyLine', 'groupItems'];
const DEFAULT_CONTROLS: readonly DistortionControl[] = ['yStart', 'yStep'];
const STEP_CANDIDATES: readonly number[] = [1, 2, 5, 10];
const WIDE_STEP_CANDIDATES: readonly number[] = [1, 2, 5, 10, 20, 50, 100, 200, 500];
const MIN_STEP_CELLS = 2;
const MAX_STEP_CELLS = 25;
/** 눈금 칸이 이보다 많아지는 눈금 간격은 옵션에서 뺀다(안전 장치). */
const MAX_CELLS = 200;
const EXAMPLE_NICE_STEPS: readonly number[] = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];

function recordOf(value: unknown): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Readonly<Record<string, unknown>>;
}

function stringOf(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** 0 이상 1000 이하 정수만 값으로 인정하고, 나머지는 0으로 본다. */
export function toLargeCount(value: unknown): number {
  return typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= DISTORTION_MAX
    ? value
    : 0;
}

function intInRange(value: unknown, min: number): number | null {
  return typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= min &&
    value <= DISTORTION_MAX
    ? value
    : null;
}

function sortedUniqueInts(values: unknown, min: number): number[] {
  if (!Array.isArray(values)) return [];
  const result = new Set<number>();
  for (const item of values as unknown[]) {
    const value = intInRange(item, min);
    if (value !== null) result.add(value);
  }
  return [...result].sort((a, b) => a - b);
}

/** 명세의 `[[이름, 값], …]` 배열 모양 자료를 객체로 바꾼다. 객체는 그대로, 그 밖은 빈 객체. */
export function pairsOf(value: unknown): Readonly<Record<string, unknown>> {
  if (Array.isArray(value)) {
    const result: Record<string, unknown> = {};
    for (const item of value as unknown[]) {
      if (Array.isArray(item) && typeof item[0] === 'string') result[item[0]] = item[1];
    }
    return result;
  }
  return recordOf(value);
}

/** 자료 최댓값까지 덮는 눈금 칸 수: 가장 큰 값 위에 적어도 한 칸이 남는다. */
export function axisCellsFor(max: number, yStart: number, yStep: number): number {
  if (!(yStep > 0) || max <= yStart) return 1;
  return Math.max(1, Math.floor((max - yStart) / yStep) + 1);
}

function stepOptionsFor(
  record: Readonly<Record<string, unknown>>,
  values: readonly number[],
  starts: readonly number[],
): number[] {
  const explicit = sortedUniqueInts(record['yStepOptions'], 1);
  const max = Math.max(0, ...values);
  const lowest = Math.min(...starts);
  if (explicit.length > 0) {
    const sane = explicit.filter((step) => axisCellsFor(max, lowest, step) <= MAX_CELLS);
    return sane.length > 0 ? sane : [explicit[explicit.length - 1] as number];
  }
  const fits = (step: number) =>
    starts.some((start) => {
      const cells = axisCellsFor(max, start, step);
      return cells >= MIN_STEP_CELLS && cells <= MAX_STEP_CELLS;
    });
  const base = STEP_CANDIDATES.filter(fits);
  if (base.length > 0) return base;
  const wide = WIDE_STEP_CANDIDATES.filter(fits);
  return wide.length > 0 ? wide : [...STEP_CANDIDATES];
}

function startOptionsFor(
  record: Readonly<Record<string, unknown>>,
  values: readonly number[],
  initial: number | null,
): number[] {
  const explicit = sortedUniqueInts(record['yStartOptions'], 0);
  const result = new Set<number>(explicit);
  if (explicit.length === 0) {
    result.add(0);
    if (values.length > 0) {
      // 최솟값 아래의 10의 배수 두 개(0보다 큰 것만).
      const top = Math.floor((Math.min(...values) - 1) / 10) * 10;
      for (const candidate of [top, top - 10]) if (candidate > 0) result.add(candidate);
    }
  }
  if (initial !== null) result.add(initial);
  return [...result].sort((a, b) => a - b);
}

function normalizeGroups(raw: unknown, categories: readonly string[]): DistortionGroup[] {
  if (!Array.isArray(raw)) return [];
  const groups: DistortionGroup[] = [];
  for (const item of raw as unknown[]) {
    const entry = recordOf(item);
    const label = stringOf(entry['label']);
    const members = Array.isArray(entry['members'])
      ? [
          ...new Set(
            (entry['members'] as unknown[]).filter(
              (member): member is string =>
                typeof member === 'string' && categories.includes(member),
            ),
          ),
        ]
      : [];
    if (label === '' || members.length < 2 || groups.some((group) => group.label === label)) {
      continue;
    }
    groups.push({ label, members });
  }
  return groups;
}

function checklistOf(raw: unknown): ChecklistItem[] {
  if (!Array.isArray(raw)) return [...CHECKLIST_ITEMS];
  const result: ChecklistItem[] = [];
  for (const item of raw as unknown[]) {
    const found = CHECKLIST_ITEMS.find((candidate) => candidate === item);
    if (found !== undefined && !result.includes(found)) result.push(found);
  }
  return result;
}

/** 눈금은 0~1000 정수이고 처음 쓴 순서 그대로 오름차순일 때만 쓴다(2개 이상). */
function ticksOf(raw: unknown): number[] | null {
  if (!Array.isArray(raw) || raw.length < 2) return null;
  const values: number[] = [];
  for (const item of raw as unknown[]) {
    const value = intInRange(item, 0);
    if (value === null || (values.length > 0 && value <= (values[values.length - 1] as number))) {
      return null;
    }
    values.push(value);
  }
  return values;
}

function normalizeExamples(raw: unknown): DistortionExample[] {
  if (!Array.isArray(raw)) return [];
  const result: DistortionExample[] = [];
  for (const item of raw as unknown[]) {
    const entry = recordOf(item);
    const data = pairsOf(entry['data']);
    const categories = Object.keys(data);
    if (categories.length === 0) continue;
    const given = entry['id'];
    const id =
      typeof given === 'string' && given !== '' && !result.some((example) => example.id === given)
        ? given
        : `e${result.length + 1}`;
    if (result.some((example) => example.id === id)) continue;
    const flawList = Array.isArray(entry['flaws']) ? (entry['flaws'] as unknown[]) : [];
    result.push({
      id,
      title: stringOf(entry['title']),
      kind: entry['kind'] === 'circle' ? 'circle' : 'bar',
      categories,
      data: Object.fromEntries(categories.map((cat) => [cat, toLargeCount(data[cat])])),
      yStart: intInRange(entry['yStart'], 0) ?? 0,
      ticks: ticksOf(entry['ticks']),
      grouped: stringOf(entry['grouped']),
      flaws: CHECKLIST_ITEMS.filter((candidate) => flawList.includes(candidate)),
    });
  }
  return result;
}

/** distortion 모드 설정을 정리한다. `categories`·`data`는 이미 0~1000 정수로 정리된 자료다. */
export function normalizeDistortion(
  record: Readonly<Record<string, unknown>>,
  data: Readonly<Record<string, number>> | null,
  categories: readonly string[],
): DistortionSettings {
  const values = categories.map((cat) => data?.[cat] ?? 0);
  const controlsRaw = record['controls'];
  const controls = Array.isArray(controlsRaw)
    ? CONTROLS.filter((control) => (controlsRaw as unknown[]).includes(control))
    : [...DEFAULT_CONTROLS];
  const configuredStart = intInRange(record['yStart'], 0);
  const yStartOptions = startOptionsFor(record, values, configuredStart);
  const yStart = configuredStart ?? (yStartOptions[0] as number);
  const yStepOptions = stepOptionsFor(record, values, yStartOptions);
  const max = Math.max(0, ...values);
  const configuredStep = intInRange(record['yStep'], 1);
  const preferred = yStepOptions.find((step) => {
    const cells = axisCellsFor(max, yStart, step);
    return cells >= 4 && cells <= 14;
  });
  const yStep =
    configuredStep !== null && yStepOptions.includes(configuredStep)
      ? configuredStep
      : (preferred ?? (yStepOptions[0] as number));
  const cards = Array.isArray(record['headlineCards'])
    ? [
        ...new Set(
          (record['headlineCards'] as unknown[]).filter(
            (card): card is string => typeof card === 'string' && card !== '',
          ),
        ),
      ].slice(0, HEADLINE_MAX)
    : [];
  return {
    controls,
    yStartOptions,
    yStepOptions,
    yStart,
    yStep,
    wavy: record['wavyLine'] === true,
    groupOptions: normalizeGroups(record['groupOptions'], categories),
    headlineCards: cards,
    examples: normalizeExamples(record['examples']),
    checklist: checklistOf(record['checklist']),
  };
}

export interface DistortionBar {
  readonly cat: string;
  readonly value: number;
}

/** 켠 묶음을 적용한 막대 목록. 묶음은 첫 구성원 자리에 놓이고 값은 구성원의 합이다. 겹치는 구성원이 있는 묶음은 건너뛴다. */
export function groupedBars(
  categories: readonly string[],
  data: Readonly<Record<string, number>> | null,
  options: readonly DistortionGroup[],
  on: readonly string[],
): DistortionBar[] {
  const used = new Set<string>();
  const applied: DistortionGroup[] = [];
  for (const group of options.filter((candidate) => on.includes(candidate.label))) {
    if (group.members.some((member) => used.has(member))) continue;
    for (const member of group.members) used.add(member);
    applied.push(group);
  }
  const bars: DistortionBar[] = [];
  const placed = new Set<string>();
  for (const cat of categories) {
    const group = applied.find((candidate) => candidate.members.includes(cat));
    if (group === undefined) {
      bars.push({ cat, value: data?.[cat] ?? 0 });
    } else if (!placed.has(group.label)) {
      placed.add(group.label);
      bars.push({
        cat: group.label,
        value: group.members.reduce((sum, member) => sum + (data?.[member] ?? 0), 0),
      });
    }
  }
  return bars;
}

/** 묶음을 켤 수 있는가(이미 켠 다른 묶음과 구성원이 겹치면 안 된다). */
export function canToggleGroupOn(
  options: readonly DistortionGroup[],
  on: readonly string[],
  label: string,
): boolean {
  const target = options.find((group) => group.label === label);
  if (target === undefined) return false;
  return !options.some(
    (group) =>
      group.label !== label &&
      on.includes(group.label) &&
      group.members.some((member) => target.members.includes(member)),
  );
}

export function barsOf(state: DistortionState): DistortionBar[] {
  const options = state.settings.distortion?.groupOptions ?? [];
  return groupedBars(state.settings.categories, state.settings.data, options, state.groups);
}

/** 물결선을 지금 보이는가: 켜 있고 세로축이 0보다 위에서 시작한다. */
export function wavyShownOf(state: Pick<DistortionState, 'wavy' | 'yStart'>): boolean {
  return state.wavy && state.yStart > 0;
}

/** 막대 하나의 화면 칸 높이(정확한 값). 시작값 아래는 0, 물결선을 보이면 물결 칸 1이 더해진다. */
export function barHeightOf(
  value: number,
  yStart: number,
  yStep: number,
  wavyShown: boolean,
): Rational {
  const above = Rational.of(Math.max(0, value - yStart), yStep);
  return wavyShown ? above.add(Rational.of(1)) : above;
}

/** 가장 긴 막대 높이 ÷ 가장 짧은 막대 높이. 막대가 없거나 가장 짧은 막대가 0이면 null. */
export function visualRatioOf(
  values: readonly number[],
  yStart: number,
  yStep: number,
  wavyShown: boolean,
): Rational | null {
  if (values.length === 0) return null;
  const heights = values.map((value) => barHeightOf(value, yStart, yStep, wavyShown));
  let longest = heights[0] as Rational;
  let shortest = heights[0] as Rational;
  for (const height of heights) {
    if (height.compareTo(longest) > 0) longest = height;
    if (height.compareTo(shortest) < 0) shortest = height;
  }
  return shortest.isZero() ? null : longest.div(shortest);
}

/** 가장 큰 값 ÷ 가장 작은 값. 막대가 없거나 가장 작은 값이 0이면 null. */
export function valueRatioOf(values: readonly number[]): Rational | null {
  if (values.length === 0) return null;
  const least = Math.min(...values);
  return least === 0 ? null : Rational.of(Math.max(...values), least);
}

/** 막대그래프 한 장을 그리는 데 필요한 모양. 그래프와 오버레이가 같이 쓴다. */
export interface BarScene {
  readonly frame: Frame;
  /** 막대마다 축 밑에서 막대 끝까지의 화면 칸 수(실수). */
  readonly bars: readonly {
    readonly cat: string;
    readonly units: number;
    readonly value: number;
  }[];
  /** 눈금: 칸 위치(0은 축 맨 아래)와 값. */
  readonly ticks: readonly { readonly unit: number; readonly value: number }[];
  /** 물결 칸(맨 아래 한 칸)이 있는가. */
  readonly wavy: boolean;
  /** 축 맨 위 눈금의 값. */
  readonly topValue: number;
  /** 눈금 칸 수(물결 칸 제외). */
  readonly cells: number;
}

/** 눈금 값 `ticks`(오름차순) 위에서 `value`의 칸 위치. 눈금 사이는 직선으로 잇고, 범위 밖은 끝에 붙인다. */
export function unitsOnTicks(ticks: readonly number[], value: number): number {
  const first = ticks[0] ?? 0;
  const last = ticks[ticks.length - 1] ?? first;
  if (value <= first) return 0;
  if (value >= last) return ticks.length - 1;
  for (let index = 0; index < ticks.length - 1; index += 1) {
    const low = ticks[index] as number;
    const high = ticks[index + 1] as number;
    if (value <= high) return index + (value - low) / (high - low);
  }
  return ticks.length - 1;
}

/** 예시 그래프의 눈금 값. `ticks`가 없으면 `yStart`부터 알맞은 간격으로 자료 최댓값을 덮을 때까지. */
export function exampleTicks(example: DistortionExample): number[] {
  if (example.ticks !== null) return [...example.ticks];
  const max = Math.max(0, ...Object.values(example.data));
  const start = example.yStart;
  const step =
    EXAMPLE_NICE_STEPS.find((candidate) => axisCellsFor(max, start, candidate) <= 8) ?? 1000;
  const cells = axisCellsFor(max, start, step);
  return Array.from({ length: cells + 1 }, (_, index) => start + index * step);
}

/** "내 그래프" 막대 장면. */
export function ownScene(state: DistortionState): BarScene {
  const bars = barsOf(state);
  const wavy = wavyShownOf(state);
  const max = Math.max(0, ...bars.map((bar) => bar.value));
  const cells = axisCellsFor(max, state.yStart, state.yStep);
  const base = wavy ? 1 : 0;
  return {
    frame: frameOf('vertical', bars.length, cells + base),
    bars: bars.map((bar) => ({
      cat: bar.cat,
      value: bar.value,
      units: Math.min(
        cells + base,
        ratioNumber(barHeightOf(bar.value, state.yStart, state.yStep, wavy)),
      ),
    })),
    ticks: Array.from({ length: cells + 1 }, (_, index) => ({
      unit: base + index,
      value: state.yStart + index * state.yStep,
    })),
    wavy,
    topValue: state.yStart + cells * state.yStep,
    cells,
  };
}

/** 예시(막대) 장면. 원그래프 예시는 null이다. */
export function exampleScene(example: DistortionExample): BarScene | null {
  if (example.kind !== 'bar') return null;
  const tickValues = exampleTicks(example);
  const cells = Math.max(1, tickValues.length - 1);
  return {
    frame: frameOf('vertical', example.categories.length, cells),
    bars: example.categories.map((cat) => {
      const value = example.data[cat] ?? 0;
      return { cat, value, units: unitsOnTicks(tickValues, value) };
    }),
    ticks: tickValues.map((value, index) => ({ unit: index, value })),
    wavy: false,
    topValue: tickValues[tickValues.length - 1] ?? 0,
    cells,
  };
}

/** 지금 화면에 보이는 막대 장면(내 그래프 또는 막대 예시). 없으면 null. */
export function currentScene(state: DistortionState): BarScene | null {
  if (state.exampleIndex <= 0) return ownScene(state);
  const example = state.settings.distortion?.examples[state.exampleIndex - 1];
  return example === undefined ? null : exampleScene(example);
}
