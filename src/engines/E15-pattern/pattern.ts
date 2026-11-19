/**
 * E15 sequence 모드의 순수 계산: 반복 단위·이어 가기·오개념·암호 대응.
 * 토큰은 문자열이다. 수학 값(분수·소수)은 이 파일에 없다.
 */

export type Slot = string | null;

/**
 * `seq`가 길이 p인 단위로 처음부터 되풀이되는 가장 작은 p의 단위(앞 p칸)를 돌려준다.
 * 모든 i ≥ p에서 `seq[i] === seq[i-p]`이고 `seq.length >= p * minRepeats`여야 한다.
 * 끝이 단위 중간에서 끊겨도 된다. 그런 p가 없거나 빈 배열이면 null.
 */
export function coreOf(seq: readonly string[], minRepeats = 2): string[] | null {
  const n = seq.length;
  if (n === 0) return null;
  for (let p = 1; p <= n; p += 1) {
    if (n < p * minRepeats) break;
    let ok = true;
    for (let i = p; i < n; i += 1) {
      if (seq[i] !== seq[i - p]) {
        ok = false;
        break;
      }
    }
    if (ok) return seq.slice(0, p);
  }
  return null;
}

/** `coreOf(given)`로 다음 n칸을 이어 간 배열. 단위가 없으면 null. */
export function continuation(given: readonly string[], n: number): string[] | null {
  const core = coreOf(given);
  if (core === null) return null;
  const result: string[] = [];
  for (let k = 0; k < n; k += 1) {
    result.push(core[(given.length + k) % core.length] ?? '');
  }
  return result;
}

/** 두 단위가 회전으로 같은가(○○□ ≡ ○□○). */
export function sameCycle(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  if (a.length === 0) return true;
  for (let shift = 0; shift < a.length; shift += 1) {
    let same = true;
    for (let i = 0; i < a.length; i += 1) {
      if (a[(i + shift) % a.length] !== b[i]) {
        same = false;
        break;
      }
    }
    if (same) return true;
  }
  return false;
}

export function isFilled(slots: readonly Slot[]): slots is string[] {
  return slots.every((slot) => slot !== null);
}

function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/**
 * 오개념 판정. 빈칸을 모두 채웠고 `filled`가 `continuation`과 다를 때만 본다.
 * - MC-PATTERN-LAST-ONLY: 채운 칸이 모두 `given`의 마지막 토큰과 같다.
 * - MC-PATTERN-CORE: LAST-ONLY가 아니면서, 2 ≤ L ≤ min(4, given 길이)인 L 가운데
 *   실제 단위 길이가 아닌 L을 단위로 이어 간 것과 같은 것이 있다.
 */
export function patternMisconceptions(given: readonly string[], filled: readonly Slot[]): string[] {
  if (given.length === 0 || filled.length === 0 || !isFilled(filled)) return [];
  const core = coreOf(given);
  if (core === null) return [];
  const expected = continuation(given, filled.length);
  if (expected === null || sameList(expected, filled)) return [];

  const last = given[given.length - 1];
  if (filled.every((token) => token === last)) return ['MC-PATTERN-LAST-ONLY'];

  const limit = Math.min(4, given.length);
  for (let length = 2; length <= limit; length += 1) {
    if (length === core.length) continue;
    // 끝 L칸을 단위로 이어 간 것
    const tail = given.slice(-length);
    const fromEnd = filled.every((token, k) => token === tail[k % length]);
    // 앞 L칸을 단위로 처음부터 되풀이했을 때 그 자리의 토큰
    const head = given.slice(0, length);
    const fromStart = filled.every((token, k) => token === head[(given.length + k) % length]);
    if (fromEnd || fromStart) return ['MC-PATTERN-CORE'];
  }
  return [];
}

export interface TranslateResult {
  /** 같은 자리의 (보내는 토큰, 받는 토큰). 빈칸이면 받는 토큰은 null. */
  readonly pairs: readonly (readonly [string, string | null])[];
  /** 일대일 대응이고 빈칸이 없다. */
  readonly consistent: boolean;
  /** 채운 칸만 볼 때 한 보내는 토큰에 받는 토큰이 둘 이상이거나 그 반대. */
  readonly conflict: boolean;
}

export function translatePairs(
  source: readonly string[],
  target: readonly Slot[],
): TranslateResult {
  const pairs: (readonly [string, string | null])[] = [];
  const forward = new Map<string, Set<string>>();
  const backward = new Map<string, Set<string>>();
  let blank = false;
  for (let i = 0; i < source.length; i += 1) {
    const from = source[i] ?? '';
    const to = target[i] ?? null;
    pairs.push([from, to]);
    if (to === null) {
      blank = true;
      continue;
    }
    forward.set(from, (forward.get(from) ?? new Set<string>()).add(to));
    backward.set(to, (backward.get(to) ?? new Set<string>()).add(from));
  }
  const conflict =
    [...forward.values()].some((set) => set.size > 1) ||
    [...backward.values()].some((set) => set.size > 1);
  return { pairs, consistent: !blank && !conflict, conflict };
}

/**
 * '보내기' 뒤 되돌린 무늬: 받는 토큰마다 그 토큰이 처음 나온 자리의 보내는 토큰으로 바꾼다.
 * 빈칸은 null.
 */
export function restoredFrom(source: readonly string[], target: readonly Slot[]): Slot[] {
  return source.map((_, index) => {
    const token = target[index] ?? null;
    if (token === null) return null;
    const first = target.indexOf(token);
    return source[first] ?? null;
  });
}

export function restoredMatches(source: readonly string[], target: readonly Slot[]): boolean {
  if (!isFilled(target)) return false;
  const restored = restoredFrom(source, target);
  return restored.every((token, index) => token === source[index]);
}
