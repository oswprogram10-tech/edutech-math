/**
 * E04 넓이 모델의 부분곱 색을 그대로 복사한 값(T046 결정 6).
 *
 * 엔진끼리 import하지 않는다는 규칙 때문에 `PARTIAL_PALETTE` 값을 여기에
 * 복사한다. 순서가 E04 `types.ts`와 같아야 같은 `colorIndex`가 같은 색이 된다.
 */
export const PARTIAL_PALETTE = [
  { fill: '#dbe7ff', ink: '#1d4fa8', pattern: 'right' },
  { fill: '#e2f3e5', ink: '#215c2a', pattern: 'left' },
  { fill: '#fdeedd', ink: '#8a4b00', pattern: 'dots' },
  { fill: '#efe4fb', ink: '#3f2a7a', pattern: 'cross' },
] as const;

export type PartialPaletteEntry = (typeof PARTIAL_PALETTE)[number];

export function paletteAt(index: number): PartialPaletteEntry {
  const length = PARTIAL_PALETTE.length;
  return PARTIAL_PALETTE[((index % length) + length) % length] ?? PARTIAL_PALETTE[0];
}
