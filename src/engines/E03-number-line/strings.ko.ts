/** E03 수직선의 학생 화면 문구. 하드코딩하지 않고 여기서만 쓴다. */
import type { NumberLineMode } from './types';

export const numberLineStrings = {
  name: '수직선',
  canvasLabel: '수직선',
  instructions: {
    integer: '눈금을 눌러 점을 찍고, 점을 끌어 옮겨 보세요.',
    fraction: '눈금을 눌러 분수의 자리를 찾아보세요. 카드는 끌어다 꽂을 수 있어요.',
    decimal: '확대하면 더 잘게 나뉜 눈금이 보여요. 점을 눌러 자리를 찾아보세요.',
  } satisfies Record<NumberLineMode, string>,
  zoomOut: '축소',
  zoomIn: '확대',
  zoomOutLabel: '수직선 축소',
  zoomInLabel: '수직선 확대',
  zoomTick: (tick: string) => `눈금 ${tick}`,
  jumpMode: '점프 그리기',
  jumpModeOn: '점프 그리기 켜짐',
  clearJumps: '점프 지우기',
  removePoint: '점 지우기',
  cardTray: '분수 카드',
  cardHint: '카드를 눌러 고른 뒤 수직선을 누르세요.',
  selectedCard: (card: string) => `${card} 카드 선택됨`,
  pointLabel: (value: string) => `점 ${value}`,
  cardLabel: (card: string) => `카드 ${card}`,
  linkedPoint: '연결된 점',
  samePoint: '같은 수',
  distanceFromZero: '0부터의 거리',
  cursorLabel: (value: string) => `놓을 자리 ${value}`,
  tickRow: (parts: number) => `${parts}등분 눈금`,
  emptyPoints: '아직 찍은 점이 없어요.',
  jumpSize: (size: string) => `점프 ${size}`,
  overlayDistance: (value: string, distance: string) => `${value}까지 ${distance}`,
} as const;
