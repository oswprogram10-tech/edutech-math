/**
 * E07 키보드 입력 범위(순수 함수).
 *
 * 격자 뷰는 `window`의 keydown을 듣는다. 실행기 응답 칸(NumberWidget)은
 * `tabIndex`가 있는 `div`라 입력 요소 검사만으로는 걸러지지 않는다.
 * 엔진 바깥에 초점이 있는 키는 격자에 쓰지 않는다.
 */

const TEXT_ENTRY_TAGS: ReadonlySet<string> = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/** 글자를 직접 받는 입력 요소인가. */
export function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return TEXT_ENTRY_TAGS.has(target.tagName) || target.isContentEditable === true;
}

/**
 * 엔진 바깥 요소에 초점이 있는가.
 *
 * - target이 `Element`가 아니면(초점 없음·window) false
 * - body·documentElement는 "엔진 바깥"으로 보지 않는다
 * - root가 없으면 판단할 수 없으므로 false
 * - root가 target을 포함하지 않으면 true
 */
export function isForeignKeyTarget(target: EventTarget | null, root: HTMLElement | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target === document.body || target === document.documentElement) return false;
  if (root === null) return false;
  return !root.contains(target);
}
