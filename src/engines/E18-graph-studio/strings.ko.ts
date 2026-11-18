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

  pictograph: {
    label: '그림그래프',
    board: '그림그래프 그리기',
    addSmall: '+ 작은 그림',
    compress: '묶기',
    expand: '펼치기',
    resetRows: '그림 지우기',
    legendLabel: '범례',
    legendGroup: '큰 그림 하나가 나타내는 수',
    legendBig: (n: number, unit: string) => `큰 그림 = ${n}${unit}`,
    legendSmall: (unit: string) => `작은 그림 = 1${unit}`,
    lassoToggle: '올가미로 묶기',
    lassoHint: (n: number) => `작은 그림 ${n}개를 한 줄에서 묶어요`,
    rowLabel: (cat: string) => `${cat} 줄`,
    controlsGroup: (cat: string) => `${cat} 그림 조작`,
    addSmallLabel: (cat: string) => `${cat} 작은 그림 놓기`,
    compressLabel: (cat: string, n: number) => `${cat} 작은 그림 ${n}개를 큰 그림 1개로 묶기`,
    expandLabel: (cat: string) => `${cat} 큰 그림 1개를 작은 그림으로 펼치기`,
    smallIcon: (cat: string, index: number) => `${cat} 작은 그림 ${index + 1}번, 누르면 뺍니다`,
    bigIcon: (cat: string, index: number) =>
      `${cat} 큰 그림 ${index + 1}번, 엔터를 누르면 펼칩니다`,
    tooltip: (cat: string, value: number, unit: string) => `${cat}: ${value}${unit}`,
  },

  scroll: {
    moreAbove: '▲ 위에 칸이 더 있어요',
    moreSide: '▶ 옆에 칸이 더 있어요',
  },

  vote: {
    stampGroup: '스탬프',
    stamp: (option: string) => `${option} 스탬프 찍기`,
    undo: '하나 지우기',
    tableLabel: '투표 결과',
    graphLabel: '투표 그래프',
  },

  overlay: {
    equals: '=',
    tableValue: (value: number) => `표: ${value}`,
    more: '…↑',
    moreHorizontal: '…→',
  },
} as const;
