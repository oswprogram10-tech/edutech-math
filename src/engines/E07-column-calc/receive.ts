/**
 * 다른 엔진 이벤트를 E07 Action으로 바꾸는 표(T046 결정 6).
 *
 * 엔진끼리 직접 import하지 않는다. 러너가 이벤트 payload를 넘기면
 * 여기서 `link-mark`·`link-colors` Action을 만들어 돌려준다.
 * T047이 `div`와 `divide-progress`를 더할 수 있도록 이벤트 이름별 표로 둔다.
 */
import type { EngineEvent, JsonValue } from '../../core/engine-sdk';
import { computeGrid } from './grid';
import { digitAt, parseNumber } from './grid';
import { computeMulPlan } from './grid-mul';
import type {
  ColumnCalcAction,
  ColumnCalcConfig,
  ColumnCalcState,
  LinkMark,
  LinkValue,
} from './types';

type Receiver = (
  state: ColumnCalcState,
  payload: JsonValue | undefined,
  config: ColumnCalcConfig,
) => ColumnCalcAction | null;

function recordOf(value: JsonValue | undefined): Readonly<Record<string, JsonValue>> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  return value;
}

function integerOf(record: Readonly<Record<string, JsonValue>>, key: string): number | null {
  const value = record[key];
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

function addGrid(state: ColumnCalcState): boolean {
  return state.op === 'add' && state.mode !== 'decimal';
}

function subGrid(state: ColumnCalcState): boolean {
  return state.op === 'sub' && state.mode !== 'decimal';
}

const grouped: Receiver = (state, payload) => {
  if (!addGrid(state)) return null;
  const record = recordOf(payload);
  if (!record) return null;
  const column = integerOf(record, 'column');
  if (column === null) return null;
  const grid = computeGrid(state);
  const target = column + 1;
  if (target < grid.low || target > grid.high) return null;

  if (state.linkMarks === 'auto') {
    const fill: LinkValue[] = [{ kind: 'carry', column: target, digit: '1' }];
    return {
      type: 'link-mark',
      marks: [],
      fill,
      crosses: [],
      tens: [],
    };
  }
  const marks: LinkMark[] = [{ kind: 'carry', column: target }];
  return { type: 'link-mark', marks, fill: [], crosses: [], tens: [] };
};

function topDigitNow(state: ColumnCalcState, column: number): string {
  const existing = state.regroups[String(column)];
  if (existing !== undefined) return existing;
  const a = parseNumber(state.aText);
  if (!a) return '0';
  return digitAt(a, state.aPoint ?? 0, column, state.aPads) ?? '0';
}

const broken: Receiver = (state, payload) => {
  if (!subGrid(state)) return null;
  const record = recordOf(payload);
  if (!record) return null;
  const column = integerOf(record, 'column');
  if (column === null) return null;
  const grid = computeGrid(state);
  if (column < grid.low || column > grid.high) return null;

  if (state.linkMarks === 'auto') {
    let top = Number(topDigitNow(state, column));
    if (state.tens.includes(column)) top += 10;
    const regroupDigit = String(Math.max(0, top - 1));
    return {
      type: 'link-mark',
      marks: [],
      fill: [{ kind: 'regroup', column, digit: regroupDigit }],
      crosses: [column],
      tens: [column - 1],
    };
  }

  const marks: LinkMark[] = [
    { kind: 'cross', column },
    { kind: 'regroup', column },
    { kind: 'ten', column: column - 1 },
  ];
  return { type: 'link-mark', marks, fill: [], crosses: [], tens: [] };
};

function partialProducts(
  state: ColumnCalcState,
  payload: JsonValue | undefined,
): ColumnCalcAction | null {
  if (state.op !== 'mul') return null;
  const record = recordOf(payload);
  if (!record) return null;
  const parts = record['parts'];
  if (!Array.isArray(parts)) return null;
  const plan = computeMulPlan(state);
  if (!plan || plan.rows.length === 0) return null;

  const used = new Set<number>();
  const colors: Record<string, number> = {};
  for (const part of parts) {
    if (part === null || typeof part !== 'object' || Array.isArray(part)) continue;
    const product = part['product'];
    const colorIndex = part['colorIndex'];
    if (typeof product !== 'number' || !Number.isFinite(product)) continue;
    if (typeof colorIndex !== 'number' || !Number.isInteger(colorIndex)) continue;
    const magnitude = BigInt(Math.abs(Math.trunc(product)));
    const row = plan.rows.find(
      (candidate) =>
        !used.has(candidate.index) &&
        (candidate.shiftedValue === magnitude || candidate.value === magnitude),
    );
    if (!row) continue;
    used.add(row.index);
    colors[String(row.index)] = colorIndex;
  }

  if (Object.keys(colors).length === 0) return null;
  return { type: 'link-colors', colors };
}

const divideProgress: Receiver = (state, payload) => {
  if (state.op !== 'div') return null;
  const record = recordOf(payload);
  if (!record) return null;
  const columns = record['columns'];
  if (!Array.isArray(columns)) return null;
  const top = state.aText.replace(/\D/g, '').length - 1;

  const marks: LinkMark[] = [];
  const fill: LinkValue[] = [];
  for (const entry of columns) {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const column = integerOf(entry, 'column');
    const perPlate = integerOf(entry, 'perPlate');
    const pile = integerOf(entry, 'pile');
    if (column === null || perPlate === null || pile === null) continue;
    if (pile !== 0) continue;
    if (column < 0 || column > top) continue;
    if (perPlate < 0 || perPlate > 9) continue;
    const digit = String(perPlate);
    if (state.linkMarks === 'auto') {
      if (state.quotient[String(column)] === digit) continue;
      fill.push({ kind: 'quotient', column, digit });
    } else {
      marks.push({ kind: 'quotient', column });
    }
  }

  if (marks.length === 0 && fill.length === 0) return null;
  return { type: 'link-mark', marks, fill, crosses: [], tens: [] };
};

export const receivers: Readonly<Record<string, Receiver>> = {
  grouped,
  broken,
  'partial-product-changed': partialProducts,
  'divide-progress': divideProgress,
};

/** `${kind}:${column}` 꼴 강조 키. predicate와 같은 규칙을 쓴다. */
function markKey(kind: LinkMark['kind'], column: number): string {
  return `${kind}:${column}`;
}

export function receive(
  state: ColumnCalcState,
  event: EngineEvent,
  _config?: ColumnCalcConfig,
): ColumnCalcAction | null {
  const handler = receivers[event.name];
  if (!handler) return null;
  return handler(state, event.payload, _config ?? {});
}

// 강조 키 규칙을 한 곳에서 내보내 View·predicate가 같은 값을 쓴다.
export { markKey };
