/** E18 그래프 스튜디오의 학생 문구. 범주 이름·축 제목은 설정에서 온다. */
import type { Orientation } from './types';

export const graphStrings = {
  name: '그래프 스튜디오',

  table: {
    label: '표',
    categoryHeader: '종류',
    valueHeader: '수',
    empty: '–',
    increase: (cat: string) => `${cat} 늘리기`,
    decrease: (cat: string) => `${cat} 줄이기`,
    plus: '+',
    minus: '−',
  },

  tally: {
    label: '센 것 표시',
    item: (index: number, name: string, checked: boolean) =>
      `${index}번 ${name}${checked ? ', 센 것으로 표시함' : ''}`,
    mark: '✓',
  },

  graph: {
    label: '그래프',
    flip: '가로·세로 바꾸기',
    reset: '그래프 지우기',
    scaleGroup: '눈금 한 칸',
    scaleOption: (scale: number, unit: string) => `${scale}${unit}`,
    orientation: {
      vertical: '세로 그래프',
      horizontal: '가로 그래프',
    } as Readonly<Record<Orientation, string>>,
    barLabel: (cat: string) => `${cat} 막대`,
    barCells: (cat: string, cells: number) => `${cat} 막대, ${cells}칸`,
    barValue: (cat: string, value: number, unit: string) => `${cat} 막대, ${value}${unit}`,
    cellLabel: (cat: string, cell: number, filled: boolean) =>
      `${cat} ${cell + 1}번째 칸${filled ? ', 채움' : ''}`,
    tooltip: (cat: string, value: number, unit: string) => `${cat}: ${value}${unit}`,
    cellMark: '○',
  },

  overlay: {
    tableValue: (value: number) => `표: ${value}`,
    more: '…↑',
    moreHorizontal: '…→',
  },
} as const;
