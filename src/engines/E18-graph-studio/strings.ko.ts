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

  dataset: {
    group: '자료 묶음',
    checked: '✓ ',
    pickHint: '자료를 하나 골라요',
    source: (text: string) => `자료: ${text}`,
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

  line: {
    board: '꺾은선그래프',
    tableLabel: '표',
    xHeader: '구분',
    yHeader: '값',
    wavyGroup: '물결선',
    wavyOption: (value: string) => `${value}부터`,
    finishPredict: '실제 자료 보기',
    legendGroup: '그래프 범례',
    legendPrediction: '예측',
    legendActual: '실제',
    reset: '점 지우기',
    lane: (x: string, value: string | null, unit: string) =>
      value === null ? `${x} 줄, 점 없음` : `${x} 줄, 점 ${value}${unit}`,
    point: (x: string, value: string, unit: string) => `${x} 점, ${value}${unit}`,
    segment: (a: string, b: string) => `${a}과 ${b} 사이 선분, 누르면 끊어요`,
    tooltip: (x: string, value: string, unit: string) => `${x}: ${value}${unit}`,
    connectHint: '점에서 점으로 끌어서 이어요',
  },

  band: {
    board: '띠그래프와 원그래프',
    tableLabel: '표',
    categoryHeader: '종류',
    countHeader: '개수',
    percentHeader: '백분율(%)',
    empty: '–',
    percentInput: (cat: string) => `${cat} 백분율`,
    percentIncrease: (cat: string) => `${cat} 백분율 늘리기`,
    percentDecrease: (cat: string) => `${cat} 백분율 줄이기`,
    handle: (cat: string) => `${cat} 칸 수`,
    handleText: (cat: string, cells: number) => `${cat} ${cells}칸`,
    dragCells: (cells: number) => `${cells}칸`,
    toCircle: '원그래프로 말기',
    toBand: '띠그래프로 펴기',
    morphHandle: '띠 끝을 끌어 말기',
    reset: '띠 지우기',
    slice: (cat: string, cells: number) => `${cat} ${cells}칸`,
    sliceName: (cat: string) => cat,
    sliceNamePercent: (cat: string, cells: number) => `${cat} ${cells}%`,
    compareLabel: '비교하는 원그래프',
    overflow: '틀 밖',
  },

  overlay: {
    equals: '=',
    tableValue: (value: number) => `표: ${value}`,
    more: '…↑',
    moreHorizontal: '…→',
  },
} as const;
