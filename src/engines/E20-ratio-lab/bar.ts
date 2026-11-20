/**
 * E20 bar-model 모드의 설정 검사·판정 계산(순수 함수).
 * 엔진은 설정으로 정답(한 칸 크기·몫·전체)을 계산할 수 있지만, 그 값은 Observation의 맞았는지(boolean)에만 쓰고
 * 화면·DOM·aria에는 절대 내보내지 않는다. 식 값은 core Rational, 나머지는 나누어떨어짐을 확인한 정수다.
 */
import { evaluate, parse, Rational } from '../../core/math';
import { MC_PROPORTION_DIVIDE_BY_RATIO_TERM, E20_STRINGS as S } from './strings.ko';
import { BAR_MAX_DIGITS, BAR_MAX_EXPR, BAR_MAX_TERM, BAR_MAX_TOKENS } from './types';
import type { BarModelConfig, BarSettings, BarState } from './types';

const MAX_VALUE = 10 ** BAR_MAX_DIGITS - 1;

function int(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

// ───────────── 문장 토큰 ─────────────

/** 띄어쓰기 덩어리별 토큰. 수는 붙은 조사·단위와 따로 나눈다("35개를" → "35", "개를"). */
export function splitChunks(problem: string): string[][] {
  return problem
    .split(/\s+/)
    .filter((chunk) => chunk !== '')
    .map((chunk) => chunk.match(/\d+|\D+/g) ?? []);
}

export function splitTokens(problem: string): string[] {
  return splitChunks(problem).flat();
}

// ───────────── 기본 장면 · 설정 ─────────────

export const DEFAULT_BAR_PROBLEM =
  '사탕 35개를 형과 동생이 3 : 4로 나누어 가집니다. 각각 몇 개일까요?';

function barFallback(error: string | null): BarState {
  return {
    mode: 'bar-model',
    error,
    settings: {
      look: 'bars',
      problem: '',
      tokens: [],
      chunkSizes: [],
      highlight: null,
      parts: ['', ''],
      ratio: [1, 1],
      total: 2,
      known: null,
    },
    marks: {},
    tool: 'total',
    unit: null,
    partValues: [null, null],
    totalValue: null,
    expr: null,
  };
}

interface Scene {
  readonly problem?: unknown;
  readonly highlight?: BarModelConfig['highlight'];
  readonly parts?: unknown;
  readonly ratio?: unknown;
  readonly total?: unknown;
  readonly known?: unknown;
}

export function normalizeBar(config: BarModelConfig): BarState {
  const bad = (): BarState => barFallback(S.configError);
  const look = config.look ?? 'bars';
  if (look !== 'bars' && look !== 'symbols') return bad();
  const omitted =
    config.problem === undefined &&
    config.parts === undefined &&
    config.ratio === undefined &&
    config.total === undefined &&
    config.known === undefined &&
    config.highlight === undefined;
  // 장면을 모두 생략하면 샌드박스 기본: 사탕 35개 3 : 4, 형광펜 있음.
  const scene: Scene = omitted
    ? {
        problem: DEFAULT_BAR_PROBLEM,
        highlight: { total: '35', ratio: ['3', '4'] },
        parts: ['형', '동생'],
        ratio: [3, 4],
        total: 35,
        known: null,
      }
    : config;

  const { problem, parts, ratio } = scene;
  if (typeof problem !== 'string' || problem.trim() === '') return bad();
  const tokens = splitTokens(problem);
  if (tokens.length === 0 || tokens.length > BAR_MAX_TOKENS) return bad();
  if (!Array.isArray(parts) || parts.length < 2 || parts.length > 3) return bad();
  if (!parts.every((p) => typeof p === 'string' && p.trim() !== '')) return bad();
  if (!Array.isArray(ratio) || ratio.length !== parts.length) return bad();
  if (!ratio.every((t) => int(t, 1, BAR_MAX_TERM))) return bad();
  const terms = ratio as number[];
  const sum = terms.reduce((a, b) => a + b, 0);

  const hasTotal = scene.total !== undefined && scene.total !== null;
  const hasKnown = scene.known !== undefined && scene.known !== null;
  if (hasTotal === hasKnown) return bad();
  let total: number | null = null;
  let known: { part: number; value: number } | null = null;
  if (hasTotal) {
    if (!int(scene.total, 1, MAX_VALUE) || scene.total % sum !== 0) return bad();
    total = scene.total;
  } else {
    const k = scene.known;
    if (typeof k !== 'object' || k === null) return bad();
    const { part, value } = k as { part?: unknown; value?: unknown };
    if (!int(part, 0, parts.length - 1) || !int(value, 1, MAX_VALUE)) return bad();
    const term = terms[part] ?? 1;
    if (value % term !== 0 || (value / term) * sum > MAX_VALUE) return bad();
    known = { part, value };
  }

  let highlight: BarSettings['highlight'] = null;
  const raw = scene.highlight;
  if (raw !== undefined && raw !== null) {
    if (typeof raw !== 'object') return bad();
    const hTotal = raw.total ?? null;
    const hRatio = raw.ratio ?? [];
    if (hTotal !== null && (typeof hTotal !== 'string' || !tokens.includes(hTotal))) return bad();
    if (!Array.isArray(hRatio)) return bad();
    if (!hRatio.every((t) => typeof t === 'string' && tokens.includes(t))) return bad();
    highlight = { total: hTotal, ratio: [...hRatio] };
  }

  return {
    mode: 'bar-model',
    error: null,
    settings: {
      look,
      problem,
      tokens,
      chunkSizes: splitChunks(problem).map((c) => c.length),
      highlight,
      parts: [...(parts as string[])],
      ratio: [...terms],
      total,
      known,
    },
    marks: {},
    tool: 'total',
    unit: null,
    partValues: (parts as string[]).map((_, i) =>
      known !== null && known.part === i ? String(known.value) : null,
    ),
    totalValue: null,
    expr: null,
  };
}

// ───────────── 입력 검사 ─────────────

const EXPR_CHARS = /^[0-9×÷+−()/\s]*$/;

/** 정수 칸 글자: 빈 글자는 null(지움), 숫자 1~6자리만 받는다. 아니면 undefined(거절). */
export function cleanInteger(value: unknown): string | null | undefined {
  if (typeof value !== 'string') return undefined;
  if (value === '') return null;
  return new RegExp(`^[0-9]{1,${BAR_MAX_DIGITS}}$`).test(value) ? value : undefined;
}

/** 식 칸 글자: 숫자·`× ÷ + − ( ) /`와 띄어쓰기만. 빈 글자는 null. 아니면 undefined. */
export function cleanExpr(value: unknown): string | null | undefined {
  if (typeof value !== 'string') return undefined;
  if (value.trim() === '') return null;
  if (value.length > BAR_MAX_EXPR || !EXPR_CHARS.test(value)) return undefined;
  return value;
}

/** 식 값(Rational). 문법이 틀렸거나 0으로 나누면 null. */
export function exprValueOf(expr: string | null): Rational | null {
  if (expr === null) return null;
  try {
    return evaluate(parse(expr));
  } catch {
    return null;
  }
}

// ───────────── 판정(정답은 이 안에서만 쓴다) ─────────────

interface Truth {
  readonly unit: number;
  readonly total: number;
  readonly shares: readonly number[];
}

function truthOf(settings: BarSettings): Truth {
  const sum = settings.ratio.reduce((a, b) => a + b, 0);
  const { known } = settings;
  // 설정 검사가 나누어떨어짐을 이미 확인했다.
  const unit =
    known === null ? (settings.total ?? 0) / sum : known.value / (settings.ratio[known.part] ?? 1);
  return { unit, total: unit * sum, shares: settings.ratio.map((t) => unit * t) };
}

function num(text: string | null): number | null {
  return text === null ? null : Number(text);
}

function sameSet(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  return a.size === b.size && [...a].every((x) => b.has(x));
}

export interface BarReading {
  readonly highlightCorrect: boolean | null;
  readonly unitCorrect: boolean | null;
  readonly partsCorrect: boolean[];
  readonly totalCorrect: boolean | null;
  readonly exprValue: Rational | null;
  readonly exprMatchesPart: number | null;
  readonly partsSumMatches: boolean | null;
  readonly misconceptions: string[];
}

export function readBar(state: BarState): BarReading {
  const { settings } = state;
  const truth = truthOf(settings);

  // 형광펜: 칠한 토큰 글자 집합이 목표 글자 집합과 같다(전체·비 따로).
  let highlightCorrect: boolean | null = null;
  if (settings.highlight !== null) {
    const marked = (kind: 'total' | 'ratio') =>
      new Set(
        Object.entries(state.marks)
          .filter(([, mark]) => mark === kind)
          .map(([index]) => settings.tokens[Number(index)] ?? ''),
      );
    const wantTotal = new Set(settings.highlight.total === null ? [] : [settings.highlight.total]);
    highlightCorrect =
      sameSet(marked('total'), wantTotal) &&
      sameSet(marked('ratio'), new Set(settings.highlight.ratio));
  }

  const unit = num(state.unit);
  const unitCorrect = settings.look === 'symbols' ? null : unit === truth.unit;
  const partsCorrect = settings.ratio.map(
    (_, i) => num(state.partValues[i] ?? null) === truth.shares[i],
  );
  const totalCorrect = settings.total !== null ? null : num(state.totalValue) === truth.total;

  const expr = exprValueOf(state.expr);
  let exprMatchesPart: number | null = null;
  if (expr !== null) {
    const found = truth.shares.findIndex((share) => expr.equals(Rational.of(share)));
    exprMatchesPart = found < 0 ? null : found;
  }

  const values = state.partValues.map(num);
  const partsSumMatches = values.every((v) => v !== null)
    ? values.reduce<number>((a, v) => a + (v ?? 0), 0) === truth.total
    : null;

  // MC-PROPORTION-DIVIDE-BY-RATIO-TERM: 전체를 비의 한 항으로 나눈 값(정수 부분 포함)을 쓰거나 몫의 합이 어긋난다.
  const quotients = settings.ratio.map((t) => Rational.of(truth.total, t));
  const floors = settings.ratio.map((t) => (truth.total - (truth.total % t)) / t);
  let divideByTerm = false;
  if (unit !== null && unit !== truth.unit && floors.includes(unit)) divideByTerm = true;
  if (partsSumMatches === false) divideByTerm = true;
  if (expr !== null) {
    const correct =
      expr.equals(Rational.of(truth.unit)) || truth.shares.some((s) => expr.equals(Rational.of(s)));
    if (!correct && quotients.some((q) => expr.equals(q))) divideByTerm = true;
  }

  return {
    highlightCorrect,
    unitCorrect,
    partsCorrect,
    totalCorrect,
    exprValue: expr,
    exprMatchesPart,
    partsSumMatches,
    misconceptions: divideByTerm ? [MC_PROPORTION_DIVIDE_BY_RATIO_TERM] : [],
  };
}

/** 막대를 열 때인가(형광펜 단계가 없거나 형광펜 목표를 맞혔다). */
export function barOpen(state: BarState): boolean {
  return state.settings.highlight === null || readBar(state).highlightCorrect === true;
}
