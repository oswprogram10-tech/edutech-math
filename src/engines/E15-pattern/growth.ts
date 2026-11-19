/**
 * E15 growth 모드의 순수 계산. 쌓기나무 모양, 표 빈칸, 판정, 오개념.
 *
 * 좌표·개수는 격자 인덱스라 number를 쓴다(AGENTS 규칙 2의 화면·격자 예외와 같다).
 * 정답(단계별 개수·늘어난 수)은 여기서만 계산하고 View·Observation에는 내보내지 않는다.
 */
import type { GrowthDir, GrowthSettings, GrowthShape } from './types';

/** `[x, y, z]`: x 오른쪽, y 안쪽, z 위쪽. 모든 모양이 y = 0 평면에 있다(앞에서 본 그림이 1:1). */
export type Cube = readonly [number, number, number];

export const MAX_STAGE = 8;
export const MAX_DIGITS = 3;

/** n단계(n ≥ 1)의 쌓기나무. 앞 단계를 모두 포함한다. */
export function stageCubes(shape: GrowthShape, stage: number): Cube[] {
  const n = Math.max(1, Math.trunc(stage));
  const cubes: Cube[] = [];
  if (shape === 'L') {
    for (let x = 0; x < n; x += 1) cubes.push([x, 0, 0]);
    for (let z = 1; z < n; z += 1) cubes.push([0, 0, z]);
  } else if (shape === 'stairs') {
    for (let i = 0; i < n; i += 1) {
      for (let z = 0; z < n - i; z += 1) cubes.push([i, 0, z]);
    }
  } else {
    for (let x = 0; x < 2; x += 1) {
      for (let z = 0; z < n; z += 1) cubes.push([x, 0, z]);
    }
  }
  return cubes;
}

export function stageCount(shape: GrowthShape, stage: number): number {
  return stageCubes(shape, stage).length;
}

export function cubeKey(cube: Cube): string {
  return `${cube[0]},${cube[1]},${cube[2]}`;
}

/** n단계에서 n-1단계에 없는 쌓기나무. 1단계는 앞 단계가 없어 모두 돌려준다. */
export function newCubes(shape: GrowthShape, stage: number): Cube[] {
  const now = stageCubes(shape, stage);
  if (stage <= 1) return now;
  const before = new Set(stageCubes(shape, stage - 1).map(cubeKey));
  return now.filter((cube) => !before.has(cubeKey(cube)));
}

/** 늘어난 수(2단계부터). 1단계는 늘어난 것이 없어 null. */
export function incrementOf(shape: GrowthShape, stage: number): number | null {
  if (stage < 2) return null;
  return stageCount(shape, stage) - stageCount(shape, stage - 1);
}

export type GrowthRow = 'count' | 'inc';

export function cellKey(stage: number, row: GrowthRow): string {
  return `${stage}.${row}`;
}

export function parseCellKey(key: string): { stage: number; row: GrowthRow } | null {
  const match = /^(\d+)\.(count|inc)$/.exec(key);
  if (!match) return null;
  const stage = Number(match[1]);
  const row = match[2] as GrowthRow;
  if (stage < 1 || stage > MAX_STAGE) return null;
  if (row === 'inc' && stage < 2) return null;
  return { stage, row };
}

/** 학생이 채우는 빈칸 키. 단계 순서, 같은 단계에서는 count → inc. */
export function blankKeys(settings: GrowthSettings): string[] {
  const table = settings.table;
  if (table === null) return [];
  const keys: string[] = [];
  for (let stage = 1; stage <= table.upTo; stage += 1) {
    if (stage > settings.stepsShown || table.counts === 'blank') keys.push(cellKey(stage, 'count'));
    if (stage >= 2 && table.increments === 'blank') keys.push(cellKey(stage, 'inc'));
  }
  return keys;
}

/** 키 칸의 정답. 화면에는 내보내지 않는다(판정 전용). */
export function expectedValue(shape: GrowthShape, key: string): number | null {
  const cell = parseCellKey(key);
  if (cell === null) return null;
  return cell.row === 'count' ? stageCount(shape, cell.stage) : incrementOf(shape, cell.stage);
}

/** 입력 글자를 정수로. 빈 글자·숫자 아닌 글자는 null. */
export function entryNumber(text: string | undefined): number | null {
  if (text === undefined || !/^\d{1,3}$/.test(text)) return null;
  return Number(text);
}

export function cellIsCorrect(
  shape: GrowthShape,
  cells: Readonly<Record<string, string>>,
  key: string,
): boolean {
  const want = expectedValue(shape, key);
  return want !== null && entryNumber(cells[key]) === want;
}

export function allBlanksCorrect(
  shape: GrowthShape,
  blanks: readonly string[],
  cells: Readonly<Record<string, string>>,
): boolean {
  return blanks.length > 0 && blanks.every((key) => cellIsCorrect(shape, cells, key));
}

export function incrementsAllCorrect(
  shape: GrowthShape,
  blanks: readonly string[],
  cells: Readonly<Record<string, string>>,
): boolean {
  const incs = blanks.filter((key) => key.endsWith('.inc'));
  return incs.length > 0 && incs.every((key) => cellIsCorrect(shape, cells, key));
}

export const MC_GROWTH_TOTAL = 'MC-PATTERN-GROWTH-TOTAL';

/**
 * MC-PATTERN-GROWTH-TOTAL: 개수 칸(2단계부터)에 그 단계의 늘어난 수를 썼다.
 * 맞는 개수와 같은 수이면(tower2 1단계처럼 우연히 같을 때) 걸지 않는다.
 */
export function growthMisconceptions(
  settings: GrowthSettings,
  cells: Readonly<Record<string, string>>,
): string[] {
  for (const key of blankKeys(settings)) {
    const cell = parseCellKey(key);
    if (cell === null || cell.row !== 'count' || cell.stage < 2) continue;
    const typed = entryNumber(cells[key]);
    if (typed === null) continue;
    const total = stageCount(settings.shape, cell.stage);
    const increment = incrementOf(settings.shape, cell.stage);
    if (typed !== total && typed === increment) return [MC_GROWTH_TOTAL];
  }
  return [];
}

/**
 * 방향키 이동: 빈칸만 지난다. 갈 칸이 없으면 지금 칸을 돌려준다.
 * 지금 칸이 없으면 첫 빈칸으로 간다. 위는 개수 줄, 아래는 늘어난 수 줄이다.
 */
export function moveBlank(
  blanks: readonly string[],
  current: string | null,
  dir: GrowthDir,
): string | null {
  if (blanks.length === 0) return current;
  if (current === null || !blanks.includes(current)) return blanks[0] ?? null;
  const here = parseCellKey(current);
  if (here === null) return current;
  const parsed: { key: string; stage: number; row: GrowthRow }[] = [];
  for (const key of blanks) {
    const cell = parseCellKey(key);
    if (cell !== null) parsed.push({ key, stage: cell.stage, row: cell.row });
  }
  if (dir === 'left' || dir === 'right') {
    const sign = dir === 'right' ? 1 : -1;
    const same = parsed
      .filter((item) => item.row === here.row && (item.stage - here.stage) * sign > 0)
      .sort((a, b) => Math.abs(a.stage - here.stage) - Math.abs(b.stage - here.stage));
    return same[0]?.key ?? current;
  }
  const otherRow: GrowthRow = here.row === 'count' ? 'inc' : 'count';
  if ((dir === 'up') !== (otherRow === 'count')) return current;
  const other = parsed
    .filter((item) => item.row === otherRow)
    .sort(
      (a, b) =>
        Math.abs(a.stage - here.stage) - Math.abs(b.stage - here.stage) || a.stage - b.stage,
    );
  return other[0]?.key ?? current;
}
