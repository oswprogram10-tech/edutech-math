/** E01 수 모형의 학생 문구. 화면에 하드코딩하지 않는다. */
import type { BaseTenIcon, BlockValue, ChartName, Interpretation, Zone } from './types';

export const baseTenStrings = {
  name: '수 모형',
  canvasLabel: '수 모형 블록을 놓고 묶는 판',
  instructions: {
    count:
      '블록 상자에서 블록을 끌어 와 수를 만들어 보세요. 같은 블록 열 개를 올가미로 감싸면 한 자리 위 블록이 돼요.',
    regroup:
      '낱개를 열 개씩 묶어 십으로, 십을 열 개씩 묶어 백으로 만들어 보세요. "10개 묶기" 단추로도 묶을 수 있어요.',
    'add-sub':
      '두 수를 블록으로 놓았어요. 모으기 칸으로 끌어 모으면 합을, 빼기 접시에 놓으면 뺀 수를 알 수 있어요.',
    'place-chart':
      '숫자 카드를 골라 자릿값 칸에 놓아 보세요. 블록을 더하거나 빼면 칸 숫자도 함께 바뀌어요.',
    free: '블록을 자유롭게 놓고 옮기며 수를 만들어 보세요.',
    'big-number':
      '숫자 사이 틈을 눌러 네 자리씩 잘라 보세요. 잘린 덩어리를 누르면 그 안의 자리 이름을 볼 수 있어요.',
    decimal:
      '판은 1, 막대는 0.1, 낱개는 0.01을 나타내요. 열 개를 묶거나 큰 블록을 풀어 같은 수를 다르게 나타내 보세요.',
    divide:
      '무더기의 블록을 접시마다 똑같이 나눠 보세요. 큰 블록을 먼저 나누고, 남는 블록은 풀어서 이어 가요.',
  },
  toolbox: '블록 상자',
  blockName: {
    1: '하나',
    10: '십',
    100: '백',
    1000: '천',
  } as Readonly<Record<BlockValue, string>>,
  blockLabel: (value: BlockValue) => `${baseTenStrings.blockName[value]} 블록`,
  addBlock: (value: BlockValue) => `${baseTenStrings.blockName[value]} 블록 놓기`,
  decimalBlockName: {
    1: '0.01',
    10: '0.1',
    100: '1',
    1000: '1000',
  } as Readonly<Record<BlockValue, string>>,
  blockNameFor: (value: BlockValue, interpretation: Interpretation) =>
    interpretation === 'decimal'
      ? baseTenStrings.decimalBlockName[value]
      : baseTenStrings.blockName[value],
  blockLabelFor: (value: BlockValue, interpretation: Interpretation) =>
    `${baseTenStrings.blockNameFor(value, interpretation)} 블록`,
  addBlockFor: (value: BlockValue, interpretation: Interpretation) =>
    `${baseTenStrings.blockNameFor(value, interpretation)} 블록 놓기`,
  decimalPlaceLabels: {
    0: '1',
    [-1]: '0.1',
    [-2]: '0.01',
  } as Readonly<Record<number, string>>,
  groupTens: '10개 묶기',
  groupTensHint: '같은 블록 열 개를 한 번에 묶어요.',
  breakBlock: '풀기',
  breakHint: '고른 블록을 열 개로 풀어요. 블록을 두 번 톡 눌러도 풀려요.',
  selected: '블록을 골랐어요.',
  noneSelected: '먼저 풀 블록을 고르세요.',
  trash: '휴지통',
  trashHint: '블록을 휴지통으로 끌면 사라져요.',
  attemptBadge: (count: number) => `${count}개를 골랐어요`,
  attemptHint: '같은 블록을 꼭 열 개 골라 보세요.',

  zoneLabels: {
    a: '처음 수',
    b: '더하는 수',
    sum: '모으기',
    take: '빼기 접시',
  } as Readonly<Record<Zone, string>>,
  zoneHint: {
    a: '처음 수 블록',
    b: '더하는 수 블록',
    sum: '여기로 모아 보세요',
    take: '여기에 놓은 블록은 빼요',
  } as Readonly<Record<Zone, string>>,
  moreThanB: '빼기 접시에 그 자리 블록을 더 놓을 수 없어요. 큰 블록을 먼저 풀어 보세요.',

  chart: '자릿값 표',
  chartCell: (label: string) => `${label} 자리`,
  chartEmptyCell: '빈칸',
  chartKeypad: '숫자 넣기',
  chartDigit: (digit: number) => `${digit}`,
  chartClear: '지우기',
  chartClose: '닫기',
  chartAutoHint: '블록 개수를 그대로 보여 줘요.',
  chartStudentHint: '칸을 눌러 숫자를 써 보세요.',
  chartNoTable: '자릿값 표가 없어요.',

  digitCards: '숫자 카드',
  digitCard: (digit: number) => `${digit} 카드`,
  digitPlaced: (digit: number) => `${digit} 카드를 놓았어요.`,
  digitCardHint: '카드를 고른 뒤 칸을 누르세요. 카드를 칸으로 끌어도 돼요.',
  placeDigit: (columnLabel: string) => `${columnLabel} 자리에 놓기`,

  iconNames: {
    candy: '사탕',
    star: '별',
  } as Readonly<Record<BaseTenIcon, string>>,
  columnNames: {
    thousands: '천',
    hundreds: '백',
    tens: '십',
    ones: '일',
  } as Readonly<Record<ChartName, string>>,
  bundle: '묶음',

  overlayTenOutline: '열 개 자리 윤곽',
  overlayPlaceValue: '자릿값 이름',
  overlayBreakPreview: '풀면 이렇게 돼요',
  overlayEmptyPlate: '블록이 안 간 접시',
  overlayFourDigitGrid: '네 자리마다 선',
  overlayPlateLevels: '접시별 높이',

  // ── big-number ────────────────────────────────────────────
  bigNumberCanvasLabel: '큰 수를 네 자리씩 자르는 판',
  bigNumberStrip: '숫자 띠',
  bigNumberGap: '자르는 틈',
  cutAt: (position: number) => `${position}번째 자리 앞에서 자르기`,
  uncutAt: (position: number) => `${position}번째 자리 앞 자르기 되돌리기`,
  bigGroupNames: ['일', '만', '억', '조'] as readonly string[],
  bigPlaceNames: ['천', '백', '십', '일'] as readonly string[],
  expandGroup: (name: string) => `${name} 덩어리 펼치기`,
  collapseGroup: (name: string) => `${name} 덩어리 접기`,
  selectDigit: (digit: string) => `${digit} 자리 고르기`,
  reverseCanvasLabel: '들은 수를 자리 칸에 만드는 판',
  reverseCell: (place: string, group: string) => `${group} ${place} 자리`,
  reverseHint: '숫자 카드를 고른 뒤 칸을 누르세요. 칸을 고르고 숫자키를 눌러도 돼요.',
  clearCell: '칸 지우기',
  clearSelectedCell: '고른 칸 지우기',
  reverseEmpty: '아직 만든 수가 없어요.',

  // ── divide ────────────────────────────────────────────────
  pile: '무더기',
  pileHint: '아직 나누지 않은 블록',
  plate: (index: number) => `접시 ${index}`,
  platesLabel: '나누는 접시',
  dealRound: (name: string) => `${name} 한 바퀴`,
  dealRoundHint: '접시마다 하나씩 나눠 놓아요.',
  rewind: '되감기',
  rewindHint: '접시에 나눈 블록을 모두 무더기로 모아요.',
  divideEmptyPile: '무더기가 비었어요.',
} as const;
