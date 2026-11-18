/** band-circle 조각 색. 색만으로 구별하지 않도록 조각 글자와 표 머리글에 이름을 함께 쓴다. */
export const SLICE_COLORS: readonly string[] = [
  '#3b6fd4',
  '#e8872e',
  '#2a9d6f',
  '#8a5cc2',
  '#d0485a',
  '#19a7b8',
  '#b8901e',
  '#6b7686',
];

export function sliceColor(index: number): string {
  return SLICE_COLORS[index % SLICE_COLORS.length] as string;
}
