/** E15 pattern.ts·chart.ts 순수 함수 단위 테스트(경계값 포함). */
import { describe, expect, it } from 'vitest';
import {
  defaultCenter,
  drawnCells,
  neighborsOf,
  normalizeRange,
  randomHidden,
  rowColCells,
} from '../chart';
import {
  continuation,
  coreOf,
  patternMisconceptions,
  restoredFrom,
  restoredMatches,
  sameCycle,
  translatePairs,
} from '../pattern';

const C = '○';
const T = '△';
const S = '□';

describe('coreOf', () => {
  it('빈 배열과 길이 1은 단위가 없다(길이 1은 2번 되풀이되지 않는다)', () => {
    expect(coreOf([])).toBeNull();
    expect(coreOf([C])).toBeNull();
  });
  it('○○○○의 단위 길이는 1', () => {
    expect(coreOf([C, C, C, C])).toEqual([C]);
  });
  it('끝이 단위 중간에서 끊겨도 된다(○△○△○ → ○△)', () => {
    expect(coreOf([C, T, C, T, C])).toEqual([C, T]);
  });
  it('○○△○○△ → ○○△', () => {
    expect(coreOf([C, C, T, C, C, T])).toEqual([C, C, T]);
  });
  it('○△□○△는 minRepeats 2에서 null', () => {
    expect(coreOf([C, T, S, C, T])).toBeNull();
  });
  it('minRepeats 1이면 늘 자기 자신 이하의 단위가 있다(빈 배열은 null)', () => {
    expect(coreOf([C, T, S, C, T], 1)).toEqual([C, T, S]);
    expect(coreOf([C, T, S], 1)).toEqual([C, T, S]);
    expect(coreOf([C], 1)).toEqual([C]);
    expect(coreOf([], 1)).toBeNull();
  });
  it('minRepeats 3', () => {
    expect(coreOf([C, T, C, T], 3)).toBeNull();
    expect(coreOf([C, T, C, T, C, T], 3)).toEqual([C, T]);
  });
});

describe('continuation', () => {
  it('끝이 단위 중간일 때 이어지는 위치가 맞다', () => {
    expect(continuation([C, T, C, T, C], 3)).toEqual([T, C, T]);
    expect(continuation([C, C, T, C, C, T, C], 4)).toEqual([C, T, C, C]);
  });
  it('단위가 없으면 null, n이 0이면 빈 배열', () => {
    expect(continuation([C, T, S], 2)).toBeNull();
    expect(continuation([C, T, C, T], 0)).toEqual([]);
  });
});

describe('sameCycle', () => {
  it('회전으로 같으면 true', () => {
    expect(sameCycle([C, C, S], [C, S, C])).toBe(true);
    expect(sameCycle([C, C, S], [S, C, C])).toBe(true);
  });
  it('다르거나 길이가 다르면 false', () => {
    expect(sameCycle([C, C, S], [C, S, S])).toBe(false);
    expect(sameCycle([C, T], [C, T, C])).toBe(false);
  });
});

describe('patternMisconceptions', () => {
  it('MC-PATTERN-LAST-ONLY: ○△○△○ 뒤 ○○○', () => {
    expect(patternMisconceptions([C, T, C, T, C], [C, C, C])).toEqual(['MC-PATTERN-LAST-ONLY']);
  });
  it('MC-PATTERN-CORE: ○○△○○△ 뒤 ○△○', () => {
    expect(patternMisconceptions([C, C, T, C, C, T], [C, T, C])).toEqual(['MC-PATTERN-CORE']);
  });
  it('정답이면 아무것도 아니다', () => {
    expect(patternMisconceptions([C, T, C, T, C], [T, C, T])).toEqual([]);
    expect(patternMisconceptions([C, C, T, C, C, T], [C, C, T])).toEqual([]);
  });
  it('빈칸이 남으면 아무것도 감지하지 않는다', () => {
    expect(patternMisconceptions([C, T, C, T, C], [C, null, C])).toEqual([]);
    expect(patternMisconceptions([C, T, C, T, C], [null, null, null])).toEqual([]);
  });
  it('given이 비었거나 단위가 없으면 감지하지 않는다', () => {
    expect(patternMisconceptions([], [C, C, C])).toEqual([]);
    expect(patternMisconceptions([C, T, S], [C, C, C])).toEqual([]);
  });
  it('둘 다 아닌 틀린 답은 빈 목록', () => {
    expect(patternMisconceptions([C, T, C, T, C], [S, S, T])).toEqual([]);
  });
});

describe('translatePairs', () => {
  const source = ['사과', '바나나', '바나나', '사과', '바나나', '바나나'];
  it('일대일 대응이면 consistent', () => {
    const result = translatePairs(source, ['1', '2', '2', '1', '2', '2']);
    expect(result.consistent).toBe(true);
    expect(result.conflict).toBe(false);
  });
  it('한 사과에 1과 3이 붙으면 충돌', () => {
    const result = translatePairs(source, ['1', '2', '2', '3', '2', '2']);
    expect(result.conflict).toBe(true);
    expect(result.consistent).toBe(false);
  });
  it('사과와 바나나가 모두 1이면 충돌', () => {
    const result = translatePairs(source, ['1', '1', '1', '1', '1', '1']);
    expect(result.conflict).toBe(true);
  });
  it('빈칸이 있으면 consistent가 false이지만 채운 칸의 충돌은 감지한다', () => {
    const empty = translatePairs(source, ['1', '2', null, null, null, null]);
    expect(empty.consistent).toBe(false);
    expect(empty.conflict).toBe(false);
    const half = translatePairs(source, ['1', '1', null, null, null, null]);
    expect(half.conflict).toBe(true);
  });
});

describe('restoredFrom', () => {
  const source = ['a', 'b', 'b', 'a'];
  it('받는 토큰이 처음 나온 자리의 보내는 토큰으로 바꾼다', () => {
    expect(restoredFrom(source, ['1', '2', '2', '1'])).toEqual(['a', 'b', 'b', 'a']);
    expect(restoredMatches(source, ['1', '2', '2', '1'])).toBe(true);
  });
  it('두 보내는 토큰이 같은 받는 토큰이면 되돌린 무늬가 달라진다', () => {
    expect(restoredFrom(source, ['1', '1', '1', '1'])).toEqual(['a', 'a', 'a', 'a']);
    expect(restoredMatches(source, ['1', '1', '1', '1'])).toBe(false);
  });
  it('빈칸이 있으면 null이고 일치하지 않는다', () => {
    expect(restoredFrom(source, ['1', null, '2', '1'])).toEqual(['a', null, 'b', 'a']);
    expect(restoredMatches(source, ['1', null, '2', '1'])).toBe(false);
  });
});

describe('chart range·이웃·가운데', () => {
  it('기본 범위와 잘못된 범위', () => {
    expect(normalizeRange(undefined)).toEqual({ from: 1, count: 100 });
    expect(normalizeRange([1, 100])).toEqual({ from: 1, count: 100 });
    expect(normalizeRange([0, 99])).toEqual({ from: 0, count: 100 });
    expect(normalizeRange([11, 60])).toEqual({ from: 11, count: 50 });
    expect(normalizeRange([1, 200])).toEqual({ from: 1, count: 200 });
    // 시작 나머지가 2, 칸 수가 10의 배수가 아님, 200칸 초과
    expect(normalizeRange([2, 101])).toEqual({ from: 1, count: 100 });
    expect(normalizeRange([1, 95])).toEqual({ from: 1, count: 100 });
    expect(normalizeRange([1, 250])).toEqual({ from: 1, count: 100 });
  });
  it('가운데 기본은 46, 이웃 계산은 줄을 넘지 않는다', () => {
    const range = { from: 1, count: 100 };
    expect(defaultCenter(range, undefined)).toBe(46);
    expect(defaultCenter(range, 46)).toBe(46);
    expect(defaultCenter(range, 1)).toBe(12);
    expect(neighborsOf(range, 10)).toEqual({ up: null, down: 20, left: 9, right: null });
    expect(neighborsOf(range, 11)).toEqual({ up: 1, down: 21, left: null, right: 12 });
  });
  it('0부터 시작하는 범위의 줄·칸', () => {
    const range = { from: 0, count: 100 };
    expect(neighborsOf(range, 10)).toEqual({ up: 0, down: 20, left: null, right: 11 });
    expect(drawnCells(range, 'row', 46, 46)).toEqual([40, 41, 42, 43, 44, 45, 46, 47, 48, 49]);
  });
  it('view별 그리는 칸', () => {
    const range = { from: 1, count: 100 };
    expect(drawnCells(range, 'cross-only', 46, 46)).toEqual([36, 45, 46, 47, 56]);
    expect(drawnCells(range, 'column', 46, 46)).toEqual([6, 16, 26, 36, 46, 56, 66, 76, 86, 96]);
    expect(drawnCells(range, 'full', 46, 46)).toHaveLength(100);
  });
});

describe('randomHidden', () => {
  const range = { from: 1, count: 100 };
  it('같은 seed는 같은 칸', () => {
    expect(randomHidden(range, 6, 7, null)).toEqual(randomHidden(range, 6, 7, null));
  });
  it('가로·세로로 맞닿은 칸이 없고 범위 안이다', () => {
    for (let seed = 1; seed <= 30; seed += 1) {
      const cells = randomHidden(range, 12, seed, { from: 21, count: 60 });
      expect(cells).toHaveLength(12);
      for (const cell of cells) {
        expect(cell).toBeGreaterThanOrEqual(21);
        expect(cell).toBeLessThanOrEqual(80);
        expect(cells).not.toContain(cell + 10);
        if (cell % 10 !== 0) expect(cells).not.toContain(cell + 1);
      }
    }
  });
  it('칸이 모자라면 고를 수 있는 만큼만', () => {
    expect(randomHidden(range, 5, 3, { from: 5, count: 1 })).toEqual([5]);
    expect(randomHidden(range, 0, 3, null)).toEqual([]);
  });
});

describe('rowColCells (MC-CHART-ROW-COL)', () => {
  const range = { from: 1, count: 100 };
  it('위 칸 수에서 ±1이면 감지한다(33 아래 칸에 34)', () => {
    expect(rowColCells(range, [43], { '43': '34' })).toEqual([43]);
    expect(rowColCells(range, [46], { '46': '37' })).toEqual([46]);
    expect(rowColCells(range, [46], { '46': '55' })).toEqual([46]);
  });
  it('정답·빈칸·상관없는 값은 감지하지 않는다', () => {
    expect(rowColCells(range, [43], { '43': '43' })).toEqual([]);
    expect(rowColCells(range, [43], {})).toEqual([]);
    expect(rowColCells(range, [43], { '43': '99' })).toEqual([]);
  });
  it('첫 줄은 위 칸이 없지만 아래 칸으로 본다', () => {
    expect(rowColCells(range, [5], { '5': '16' })).toEqual([5]);
  });
});
