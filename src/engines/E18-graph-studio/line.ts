/**
 * E18 꺾은선그래프(line-graph)의 순수 계산. 세로 값은 모두 `Rational`이다.
 * number는 화면 좌표(논리 좌표)에만 쓴다.
 */
import { Rational } from '../../core/math';
import type { Rect } from './layout';
import type { GraphConfig, LineGraphState, LineSettings } from './types';

export const LINE_WIDTH = 1000;
export const LINE_HEIGHT = 700;

const PLOT_X = 150;
const PLOT_Y = 80;
const PLOT_HEIGHT = 450;
const RIGHT_MARGIN = 40;
/** 세로 눈금 칸 수의 안전 상한. */
const MAX_CELLS = 400;

const ZERO = Rational.of(0);
const HALF = Rational.of(1, 2);

/** 0 이상 유한 값만 받는다. 문자열("37.2", "1/2")이나 정수 number. 아니면 null. */
export function parseValue(value: unknown): Rational | null {
  try {
    const parsed =
      typeof value === 'string'
        ? Rational.parse(value)
        : typeof value === 'number' && Number.isSafeInteger(value)
          ? Rational.of(value)
          : null;
    return parsed !== null && !parsed.isNegative() ? parsed : null;
  } catch {
    return null;
  }
}

/** 화면 좌표 계산용 실수. 수학 판정에는 쓰지 않는다. */
export function ratioNumber(value: Rational): number {
  return Number(value.n) / Number(value.d);
}

/** 눈금·표에 쓰는 글자: 유한소수면 소수("36.5"), 아니면 분수. */
export function formatValue(value: Rational): string {
  try {
    return value.toDecimalString();
  } catch {
    return value.toString();
  }
}

/** 0 이상인 값의 올림(정수 Rational). */
export function ceilValue(value: Rational): Rational {
  const whole = Rational.of(value.integerPart());
  return value.equals(whole) ? whole : whole.add(Rational.of(1));
}

/** 0 이상인 값을 `step`의 가장 가까운 배수로 반올림(절반은 올림). */
export function roundToStep(value: Rational, step: Rational): Rational {
  const count = value.div(step).add(HALF).integerPart();
  return step.mul(Rational.of(count));
}

function cleanText(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

/** 설정에서 꺾은선그래프 설정을 만든다. 점이 하나도 없어도 만든다(빈 그래프). */
export function normalizeLine(record: Readonly<Record<string, unknown>>): LineSettings {
  const rawPoints = Array.isArray(record['points']) ? (record['points'] as unknown[]) : [];
  const xs: string[] = [];
  const values: Rational[] = [];
  for (const item of rawPoints) {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) continue;
    const entry = item as Readonly<Record<string, unknown>>;
    const x = cleanText(entry['x']);
    const y = parseValue(entry['y']);
    if (x === null || y === null || xs.includes(x)) continue;
    xs.push(x);
    values.push(y);
  }

  const stepRaw = parseValue(record['yStep']);
  const yStep = stepRaw !== null && stepRaw.compareTo(ZERO) > 0 ? stepRaw : Rational.of(1);
  const plotRaw = parseValue(record['plotStep']);
  const plotStep = plotRaw !== null && plotRaw.compareTo(ZERO) > 0 ? plotRaw : yStep;
  const fromRaw = parseValue(record['yFrom']);
  const yFrom = fromRaw ?? ZERO;

  // 기본 끝 값: 자료 최댓값을 yStep 배수로 올리고 한 칸을 더한 값.
  const top = values.reduce((max, value) => (value.compareTo(max) > 0 ? value : max), ZERO);
  const defaultMax = ceilValue(top.div(yStep)).mul(yStep).add(yStep);
  const maxRaw = parseValue(record['yMax']);

  const optionList = Array.isArray(record['yFromOptions'])
    ? (record['yFromOptions'] as unknown[])
        .map(parseValue)
        .filter((value): value is Rational => value !== null)
    : [];
  const options: Rational[] = [];
  for (const option of optionList) {
    if (!options.some((other) => other.equals(option))) options.push(option);
  }
  options.sort((a, b) => a.compareTo(b));

  const floor = options.reduce((max, option) => (option.compareTo(max) > 0 ? option : max), yFrom);
  // yMax는 가장 높은 시작값보다 커야 한다.
  const yMax =
    maxRaw !== null && maxRaw.compareTo(floor) > 0 ? maxRaw : maxOf(defaultMax, floor, yStep);

  const connect = record['connect'] === 'student' ? 'student' : 'auto';
  return {
    xs,
    values: values.map((value) => value.toJSON()),
    yStep: yStep.toJSON(),
    yMax: yMax.toJSON(),
    plotStep: plotStep.toJSON(),
    yFrom: yFrom.toJSON(),
    yFromOptions: options.filter((option) => option.compareTo(yMax) < 0).map((o) => o.toJSON()),
    connect,
    predict: record['predict'] === true,
  };
}

/** 기본 끝 값이 시작값보다 크도록 올린다. */
function maxOf(defaultMax: Rational, floor: Rational, step: Rational): Rational {
  return defaultMax.compareTo(floor) > 0 ? defaultMax : floor.add(step);
}

export function lineConfigRecord(config: GraphConfig | undefined): Record<string, unknown> {
  return config !== null && typeof config === 'object'
    ? (config as unknown as Record<string, unknown>)
    : {};
}

/** 설정의 가로축 자료 값(Rational). */
export function dataValues(line: LineSettings): Rational[] {
  return line.values.map((value) => Rational.parse(value));
}

/** 점 값(Rational 문자열)을 `Rational`로 바꾼다. 잘못된 값은 null. */
export function valueOf(text: string | null | undefined): Rational | null {
  if (text === null || text === undefined) return null;
  try {
    return Rational.parse(text);
  } catch {
    return null;
  }
}

/**
 * 값을 `[yFrom, yMax]` 안의 `plotStep` 배수로 맞춘다. 맞출 수 없으면 null.
 * 반올림한 값이 범위를 벗어나면 한 칸 안쪽으로 당긴다.
 */
export function snapValue(line: LineSettings, yFrom: string, raw: Rational): Rational | null {
  const from = Rational.parse(yFrom);
  const max = Rational.parse(line.yMax);
  const step = Rational.parse(line.plotStep);
  let value = raw;
  if (value.compareTo(from) < 0) value = from;
  if (value.compareTo(max) > 0) value = max;
  let snapped = roundToStep(value, step);
  if (snapped.compareTo(max) > 0) snapped = snapped.sub(step);
  if (snapped.compareTo(from) < 0) snapped = snapped.add(step);
  if (snapped.compareTo(from) < 0 || snapped.compareTo(max) > 0) return null;
  return snapped;
}

/** 이웃한 쌍 (0,1) … (n-2,n-1). */
export function adjacentPairs(count: number): [number, number][] {
  return Array.from({ length: Math.max(0, count - 1) }, (_, index) => [index, index + 1]);
}

/** 두 점이 다 있는 이웃한 쌍(자동 잇기). */
export function autoSegments(
  xs: readonly string[],
  points: Readonly<Record<string, string | null>>,
): [number, number][] {
  return adjacentPairs(xs.length).filter(
    ([a, b]) =>
      points[xs[a] as string] !== null &&
      points[xs[a] as string] !== undefined &&
      points[xs[b] as string] !== null &&
      points[xs[b] as string] !== undefined,
  ) as [number, number][];
}

/** 선분 목록이 이웃한 쌍 전부이고 다른 쌍은 없는가. */
export function isInOrder(
  segments: readonly (readonly [number, number])[],
  count: number,
): boolean {
  const expected = adjacentPairs(count);
  if (expected.length === 0 || segments.length !== expected.length) return false;
  return expected.every(([a, b]) =>
    segments.some((segment) => segment[0] === a && segment[1] === b),
  );
}

/** 선분 쌍을 정규화(작은 쪽이 앞)한다. 범위 밖이거나 같은 점이면 null. */
export function normalizePair(a: number, b: number, count: number): [number, number] | null {
  if (!Number.isInteger(a) || !Number.isInteger(b) || a === b) return null;
  if (a < 0 || b < 0 || a >= count || b >= count) return null;
  return a < b ? [a, b] : [b, a];
}

/** 화면에 지금 보이는 점들(Rational 문자열). 예측 단계면 예측 점, 아니면 주어진 자료 또는 학생 점. */
export function shownValues(state: LineGraphState): (string | null)[] {
  const line = state.settings.line;
  if (line === null) return [];
  if (state.phase === 'predict') return line.xs.map((x) => state.prediction[x] ?? null);
  if (state.settings.graph === 'given') return [...line.values];
  return line.xs.map((x) => state.points[x] ?? null);
}

/** 학생이 조작할 수 있는 점 모음: 예측 단계면 예측, 아니면 학생 점. */
export function editableKey(state: LineGraphState): 'prediction' | 'points' {
  return state.phase === 'predict' ? 'prediction' : 'points';
}

export interface LineGeometry {
  readonly width: number;
  readonly height: number;
  readonly plot: Rect;
  readonly count: number;
  /** yFrom부터 yMax 이상까지의 눈금 칸 수. */
  readonly cells: number;
  /** 세로축 맨 아래에 0 눈금과 물결선 칸을 둔다(yFrom > 0). */
  readonly wavy: boolean;
  /** 눈금 칸 수 + 물결 칸(0 또는 1). */
  readonly units: number;
  /** 칸 하나의 논리 높이. */
  readonly unit: number;
  readonly from: Rational;
  readonly step: Rational;
  readonly max: Rational;
}

/** 논리 크기(가로 `width`, 세로 700)와 현재 시작값으로 그림 칸을 정한다. */
export function lineGeometry(
  line: LineSettings,
  yFrom: string,
  width: number = LINE_WIDTH,
): LineGeometry {
  const from = valueOf(yFrom) ?? ZERO;
  const step = Rational.parse(line.yStep);
  const max = Rational.parse(line.yMax);
  const span = max.sub(from);
  const rawCells = span.compareTo(ZERO) > 0 ? Number(ceilValue(span.div(step)).integerPart()) : 1;
  const cells = Math.min(MAX_CELLS, Math.max(1, rawCells));
  const wavy = from.compareTo(ZERO) > 0;
  const units = cells + (wavy ? 1 : 0);
  const plot: Rect = {
    x: PLOT_X,
    y: PLOT_Y,
    width: Math.max(1, width - PLOT_X - RIGHT_MARGIN),
    height: PLOT_HEIGHT,
  };
  return {
    width,
    height: LINE_HEIGHT,
    plot,
    count: Math.max(1, line.xs.length),
    cells,
    wavy,
    units,
    unit: PLOT_HEIGHT / units,
    from,
    step,
    max,
  };
}

export function laneWidth(g: LineGeometry): number {
  return g.plot.width / g.count;
}

export function laneCenter(g: LineGeometry, index: number): number {
  return g.plot.x + (index + 0.5) * laneWidth(g);
}

/** 가로 좌표가 속한 레인 번호. 그림판 밖이면 null. */
export function laneAt(g: LineGeometry, x: number): number | null {
  if (x < g.plot.x || x > g.plot.x + g.plot.width) return null;
  return Math.min(g.count - 1, Math.max(0, Math.floor((x - g.plot.x) / laneWidth(g))));
}

export function plotBottom(g: LineGeometry): number {
  return g.plot.y + g.plot.height;
}

/** 값의 세로 화면 좌표. 시작값 아래는 물결선 칸 안으로 두지 않고 시작값 줄에 붙인다. */
export function yOfValue(g: LineGeometry, value: Rational): number {
  const cells = Math.max(0, ratioNumber(value.sub(g.from).div(g.step)));
  return plotBottom(g) - g.unit * ((g.wavy ? 1 : 0) + cells);
}

/** 눈금 칸 번호 k(0은 yFrom 줄)의 세로 좌표. */
export function yOfCell(g: LineGeometry, k: number): number {
  return plotBottom(g) - g.unit * ((g.wavy ? 1 : 0) + k);
}

/** 세로 화면 좌표를 `plotStep` 단위 개수(정수 k, ≥ 0)로 바꾼다. 값은 `plotStep × k`다. */
export function plotStepCountAt(g: LineGeometry, plotStep: Rational, y: number): number {
  const cells = (plotBottom(g) - y) / g.unit - (g.wavy ? 1 : 0);
  const value = ratioNumber(g.from) + cells * ratioNumber(g.step);
  const count = Math.round(value / ratioNumber(plotStep));
  return Number.isFinite(count) ? Math.max(0, count) : 0;
}

/** 눈금 칸 번호 k(0 … cells) 목록. 글자가 겹치면 `skip`칸마다. */
export function lineTickCells(cells: number, skip: number): number[] {
  const every = Math.max(1, skip);
  const result: number[] = [];
  for (let k = 0; k <= cells; k += every) result.push(k);
  return result;
}

const ONE = Rational.of(1);
const TEN = Rational.of(10);

/** 값이 1·2·5 × 10ⁿ(n은 음수도 가능) 꼴인가. 0 이하는 아니다. */
export function isNiceStep(value: Rational): boolean {
  if (value.compareTo(ZERO) <= 0) return false;
  let rest = value;
  // 10ⁿ 곱으로 [1, 10) 안에 넣는다. 유한소수·정수가 아니면 곧 끝나지 않으므로 반복을 제한한다.
  for (let i = 0; i < 40 && rest.compareTo(TEN) >= 0; i += 1) rest = rest.div(TEN);
  for (let i = 0; i < 40 && rest.compareTo(ONE) < 0; i += 1) rest = rest.mul(TEN);
  return [1, 2, 5].some((digit) => rest.equals(Rational.of(digit)));
}

/**
 * 눈금 글자를 건너뛰는 칸 수. `minSkip`(글자가 겹치지 않는 최소 칸 수) 이상이면서
 * `skip × yStep`이 1·2·5 × 10ⁿ 꼴이 되는 가장 작은 정수. 그런 값이 없으면 `minSkip`.
 */
export function tickSkip(yStep: Rational, minSkip: number): number {
  const start = Math.max(1, Math.ceil(minSkip));
  const limit = start + 1000;
  for (let skip = start; skip <= limit; skip += 1) {
    if (isNiceStep(yStep.mul(Rational.of(skip)))) return skip;
  }
  return start;
}

/** 눈금 칸 번호 k의 값. */
export function tickValueOf(g: LineGeometry, k: number): Rational {
  return g.from.add(g.step.mul(Rational.of(k)));
}
