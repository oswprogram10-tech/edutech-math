/**
 * E16 설정 정규화. 규칙이 읽히지 않거나 □ 하나로 풀린 꼴이 아니면 `error`를 켠다(throw하지 않는다).
 * `rule`을 아예 쓰지 않으면(샌드박스) 모드·장면에 맞는 기본 규칙을 쓴다.
 */
import { Rational } from '../../core/math';
import { domainList, hiddenOf, rationalOf, safeSolve } from './relation-check';
import type {
  BlackBoxConfig,
  BlackBoxSettings,
  CommonConfig,
  CommonSettings,
  CovaryConfig,
  CovarySettings,
  FunctionConfig,
  SceneId,
  ShooterConfig,
  ShooterOp,
  ShooterSettings,
  TableConfig,
  TableRowConfig,
  TableSettings,
} from './types';

export const DEFAULT_DOMAIN: [number, number] = [0, 20];

export const SCENE_RULES: Readonly<Record<SceneId, string>> = {
  'chairs-legs': '□ = ○ × 4',
  'triangles-sticks': '□ = ○ × 2 + 1',
  dots: '□ = ○ × 5',
};

const DEFAULT_RULE = '□ = ○ × 3';

function isInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

function range(value: unknown, fallback: [number, number]): [number, number] {
  if (Array.isArray(value) && value.length === 2) {
    const [a, b] = value as unknown[];
    if (isInt(a) && isInt(b) && a >= 0 && a <= b) return [a, b];
  }
  return fallback;
}

function warn(message: string): void {
  if (import.meta.env?.DEV) console.warn(`[E16] ${message}`);
}

function common(config: CommonConfig, defaultRule: string): CommonSettings {
  const rule = typeof config.rule === 'string' ? config.rule : defaultRule;
  const hidden = hiddenOf(rule);
  let error: string | null = null;
  if (hidden === null) {
    error = 'rule';
    warn(`rule이 읽히지 않거나 □ 하나로 풀린 꼴이 아닙니다: ${rule}`);
  }
  return {
    rule,
    xLabel: typeof config.xLabel === 'string' && config.xLabel !== '' ? config.xLabel : '○',
    yLabel: typeof config.yLabel === 'string' && config.yLabel !== '' ? config.yLabel : '□',
    ruleInput: config.ruleInput !== false,
    domain: range(config.domain, DEFAULT_DOMAIN),
    error,
  };
}

export function blackBoxSettings(config: BlackBoxConfig): BlackBoxSettings {
  const base = common(config, DEFAULT_RULE);
  return {
    ...base,
    inputRange: range(config.inputRange, base.domain),
    maxTrials: isInt(config.maxTrials) && config.maxTrials > 0 ? config.maxTrials : null,
    avoidForm: typeof config.avoidForm === 'string' ? config.avoidForm : null,
  };
}

function rationalString(value: string | null | undefined): string | null | 'bad' {
  if (value === null || value === undefined) return null;
  const parsed = rationalOf(value);
  return parsed === null ? 'bad' : parsed.toString();
}

/** 규칙으로 기본 표를 만든다(○ = 1·2·3은 □ 빈칸, ○ 빈칸 하나는 □가 주어진 줄). */
function defaultRows(rule: string): TableRowConfig[] {
  const hidden = hiddenOf(rule);
  const four = hidden === null ? null : safeSolve(hidden, Rational.of(4));
  return [
    { x: '1', y: hidden === null ? null : (safeSolve(hidden, Rational.of(1))?.toString() ?? null) },
    { x: '2', y: null },
    { x: '3', y: null },
    { x: null, y: four === null ? null : four.toString() },
  ];
}

export function tableSettings(config: TableConfig): TableSettings {
  const base = common(config, DEFAULT_RULE);
  let error = base.error;
  const source = Array.isArray(config.rows) ? config.rows : defaultRows(base.rule);
  const rows: TableRowConfig[] = [];
  for (const row of source) {
    const x = rationalString(row?.x);
    const y = rationalString(row?.y);
    if (x === 'bad' || y === 'bad' || (x === null && y === null)) {
      error = error ?? 'rows';
      warn('표의 줄은 수 문자열이어야 하고 ○·□ 중 하나만 비울 수 있습니다.');
      continue;
    }
    rows.push({ x, y });
  }
  if (rows.length === 0) error = error ?? 'rows';
  const hidden = hiddenOf(base.rule);
  if (hidden !== null && error === null) {
    // 모든 빈칸의 정답이 정해지는지 본다(○ 빈칸은 domain 정수 가운데 y가 되는 수가 있어야 한다).
    for (const row of rows) {
      if (row.x === null && row.y !== null) {
        const y = Rational.parse(row.y);
        const found = domainList(base.domain).some((x) => safeSolve(hidden, x)?.equals(y));
        if (!found) error = 'blank-x';
      } else if (row.y === null && row.x !== null) {
        if (safeSolve(hidden, Rational.parse(row.x)) === null) error = 'blank-y';
      }
    }
    if (error !== null) warn(`표의 빈칸 정답을 정할 수 없습니다(${error}).`);
  }
  return { ...base, error, rows };
}

export function covarySettings(config: CovaryConfig): CovarySettings {
  const scene: SceneId =
    config.scene === 'triangles-sticks' || config.scene === 'dots' ? config.scene : 'chairs-legs';
  const base = common(config, SCENE_RULES[scene]);
  let error = base.error;
  let xMin = 1;
  let xMax = 10;
  const given = config.x;
  if (given !== undefined) {
    if (isInt(given.min) && isInt(given.max) && given.min >= 0 && given.min < given.max) {
      xMin = given.min;
      xMax = given.max;
    } else {
      error = error ?? 'x';
      warn('x 범위는 0 이상 정수이고 min < max여야 합니다.');
    }
  }
  const blankRows = Array.isArray(config.blankRows)
    ? [
        ...new Set(config.blankRows.filter((n): n is number => isInt(n) && n >= xMin && n <= xMax)),
      ].sort((a, b) => a - b)
    : [];
  const hidden = hiddenOf(base.rule);
  if (hidden !== null && error === null) {
    for (let n = xMin; n <= xMax; n += 1) {
      if (safeSolve(hidden, Rational.of(n)) === null) error = 'x-output';
    }
  }
  const look =
    config.look === 'dots' || config.look === 'none' ? config.look : ('picture' as const);
  return { ...base, error, scene, xMin, xMax, blankRows, look };
}

export const DEFAULT_GEMS: [number, number][] = [
  [1, 4],
  [2, 7],
  [3, 10],
  [5, 16],
];
export const MIN_GEMS = 2;
export const MAX_GEMS = 8;
const OP_KEYS: Readonly<Record<ShooterOp, string>> = { '+': '+', '-': '−', '×': '×', '÷': '÷' };

function ceilInt(value: Rational): number {
  const whole = Number(value.integerPart());
  return value.isInteger() ? whole : whole + 1;
}

/**
 * rule-shooter 설정. `rule`은 선택(없으면 판정은 보석을 모두 맞혔는가). 보석은 2~8개이고
 * 0 이상 수여야 한다. `gems`를 아예 쓰지 않으면(샌드박스) 기본 보석을 쓴다.
 */
export function shooterSettings(config: ShooterConfig): ShooterSettings {
  const ruleGiven = typeof config.rule === 'string' && config.rule !== '';
  let error: string | null = null;
  if (ruleGiven && hiddenOf(config.rule as string) === null) {
    error = 'rule';
    warn(`rule이 읽히지 않거나 □ 하나로 풀린 꼴이 아닙니다: ${config.rule}`);
  }
  const source: readonly unknown[] = Array.isArray(config.gems) ? config.gems : DEFAULT_GEMS;
  const gems: [string, string][] = [];
  let maxX = Rational.of(0);
  let maxY = Rational.of(0);
  for (const gem of source) {
    const a = Array.isArray(gem) && gem.length === 2 ? gem[0] : undefined;
    const b = Array.isArray(gem) && gem.length === 2 ? gem[1] : undefined;
    const x = typeof a === 'number' || typeof a === 'string' ? rationalOf(String(a)) : null;
    const y = typeof b === 'number' || typeof b === 'string' ? rationalOf(String(b)) : null;
    if (x === null || y === null || x.isNegative() || y.isNegative()) {
      error = error ?? 'gems';
      warn('보석 좌표는 0 이상 수(정수 또는 분수 문자열) 쌍이어야 합니다.');
      continue;
    }
    gems.push([x.toString(), y.toString()]);
    if (x.compareTo(maxX) > 0) maxX = x;
    if (y.compareTo(maxY) > 0) maxY = y;
  }
  if (gems.length < MIN_GEMS || gems.length > MAX_GEMS) {
    error = error ?? 'gems';
    warn(`보석은 ${MIN_GEMS}~${MAX_GEMS}개여야 합니다.`);
  }
  let grid = { xMax: ceilInt(maxX) + 2, yMax: ceilInt(maxY) + 3 };
  const given = config.grid;
  if (given !== undefined) {
    if (
      given !== null &&
      isInt(given.xMax) &&
      isInt(given.yMax) &&
      given.xMax >= 1 &&
      given.yMax >= 1 &&
      Rational.of(given.xMax).compareTo(maxX) >= 0 &&
      Rational.of(given.yMax).compareTo(maxY) >= 0
    ) {
      grid = { xMax: given.xMax, yMax: given.yMax };
    } else {
      error = error ?? 'grid';
      warn('grid는 1 이상 정수이고 모든 보석을 담아야 합니다.');
    }
  }
  const ops = Array.isArray(config.allowedOps)
    ? config.allowedOps.filter((op): op is ShooterOp => op in OP_KEYS)
    : (Object.keys(OP_KEYS) as ShooterOp[]);
  return {
    rule: ruleGiven ? (config.rule as string) : '',
    xLabel: typeof config.xLabel === 'string' && config.xLabel !== '' ? config.xLabel : '○',
    yLabel: typeof config.yLabel === 'string' && config.yLabel !== '' ? config.yLabel : '□',
    ruleInput: true,
    domain: range(config.domain, DEFAULT_DOMAIN),
    error,
    gems,
    grid,
    allowedOps: [...new Set(ops)].map((op) => OP_KEYS[op]),
    look: config.look === 'table' ? 'table' : 'grid',
    missPanel: config.missPanel !== false,
    avoidForm: typeof config.avoidForm === 'string' ? config.avoidForm : null,
  };
}

export function settingsFor(config: FunctionConfig | undefined) {
  const mode = (config as { mode?: unknown } | undefined)?.mode;
  if (mode === 'table') return { mode, settings: tableSettings(config as TableConfig) } as const;
  if (mode === 'covary') return { mode, settings: covarySettings(config as CovaryConfig) } as const;
  if (mode === 'rule-shooter') {
    return { mode, settings: shooterSettings(config as ShooterConfig) } as const;
  }
  return {
    mode: 'black-box',
    settings: blackBoxSettings((config ?? { mode: 'black-box' }) as BlackBoxConfig),
  } as const;
}
