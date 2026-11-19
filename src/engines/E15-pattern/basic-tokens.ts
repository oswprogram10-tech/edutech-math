/** E15 기본 토큰 이름. 이 밖의 문자열은 글자 카드로 그린다. */
export const BASIC_TOKENS: readonly string[] = [
  'circle',
  'triangle',
  'square',
  'star',
  'heart',
  'apple',
  'banana',
  'grape',
  'strawberry',
  'clap',
  'jump',
  'hands-up',
];

export function isBasicToken(token: string): boolean {
  return BASIC_TOKENS.includes(token);
}
