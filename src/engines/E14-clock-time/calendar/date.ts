/**
 * 달력 날짜 계산(순수 함수). `Date`와 시간대에 기대지 않는다.
 * 요일은 Zeller 공식(그레고리력)으로 구한다. 0=일요일 … 6=토요일.
 */

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

/** year년 month월(1~12) day일의 요일. 0=일요일. */
export function weekdayOf(year: number, month: number, day: number): number {
  const m = month < 3 ? month + 12 : month;
  const y = month < 3 ? year - 1 : year;
  const k = y % 100;
  const j = Math.floor(y / 100);
  // h: 0=토요일, 1=일요일, …
  const h =
    (day + Math.floor((13 * (m + 1)) / 5) + k + Math.floor(k / 4) + Math.floor(j / 4) + 5 * j) % 7;
  return (h + 6) % 7;
}

/** "YYYY-MM"을 읽는다(1583년 이후). 틀리면 null. */
export function parseMonth(
  text: unknown,
): { readonly year: number; readonly month: number } | null {
  if (typeof text !== 'string') return null;
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(text.trim());
  if (!match) return null;
  const year = Number(match[1]);
  if (year < 1583) return null;
  return { year, month: Number(match[2]) };
}
