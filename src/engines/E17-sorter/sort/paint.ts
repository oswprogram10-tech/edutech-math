/** 카드 칠. 빨강은 꽉 찬 칠, 파랑은 빗금, 노랑은 점무늬(무늬 정의는 `art.tsx`의 `ArtDefs`). */
export const GRAY = '#c9ced8';
const RED = '#d64545';
const BLUE_URL = 'url(#sort-pat-blue)';
const YELLOW_URL = 'url(#sort-pat-yellow)';

export function paintOf(color: string, gray: boolean): string {
  if (gray) return GRAY;
  if (color === 'red') return RED;
  if (color === 'blue') return BLUE_URL;
  if (color === 'yellow') return YELLOW_URL;
  return GRAY;
}
