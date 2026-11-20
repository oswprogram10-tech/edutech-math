/**
 * E13 학생에게 보이는 문구. 물건의 길이·들이와 어느 쪽이 더 긴지(많은지)를 글로 알려 주는 문구는 두지 않는다.
 * 학년 표시와 점수 문구도 없다.
 */

export const E13_STRINGS = {
  name: '측정 실험실',
  configError: '이 활동의 설정이 올바르지 않아요.',
  configErrorBody: '선생님께 알려 주세요.',
  controlsLabel: '조작',
  reset: '처음으로',
  /** 물건 이름 목록(설정의 `object.name`·`kind`가 가리킨다). */
  objectNames: {
    pencil: '연필',
    desk: '책상',
    book: '책',
    rope: '밧줄',
    ribbon: '리본',
    handkerchief: '손수건',
    paper: '종이',
    cup: '컵',
  } as Readonly<Record<string, string>>,
  compare: {
    boardLabel: '비교판',
    instructionsLength:
      '물건을 끌어 옮겨 놓고 길이를 비교해 봐요. 키보드는 Tab으로 물건을 고르고 방향키로 옮겨요.',
    instructionsArea:
      '물건 하나를 끌어 다른 물건 위에 놓아 보세요. 키보드는 Tab으로 고르고 방향키로 옮겨요.',
    instructionsCapacity: '컵의 물을 같은 수조에 부어 보세요.',
    baselineName: '출발선',
    straighten: (label: string) => `${label} 펴기`,
    pour: (label: string) => `${label}의 물을 같은 수조에 붓기`,
    pourShort: '같은 수조에 붓기',
    pulledHandle: (label: string) => `${label} 끝 잡아당기기`,
    itemHint: (label: string) => `${label}. 방향키로 옮겨요`,
    tankName: '수조',
    onTop: '위에 놓음',
    rejected: {
      readOnly: '지금은 조작할 수 없어요.',
      same: '이미 그렇게 되어 있어요.',
      out: '판 밖으로는 옮길 수 없어요.',
      already: '이미 했어요.',
    },
  },
  length: {
    boardLabel: '재기판',
    instructions:
      '아래 상자에서 단위를 골라 띠 위로 끌어 놓아 보세요. 단추를 누르거나 Enter를 눌러도 끝에 붙어요.',
    instructionsKeyboard: '조각을 고른 뒤 ←→로 옮겨요. Backspace는 마지막 조각을 지워요.',
    trayCaption: '단위 상자',
    trayButton: (name: string) => `${name} 놓기`,
    unitNames: {
      'hand-span-a': '뼘 가',
      'hand-span-b': '뼘 나',
      'clip-3cm': '클립',
      'cm-block': '1cm 블록',
      'eraser-5cm': '지우개',
    } as Readonly<Record<string, string>>,
    pieceLabel: (order: number, name: string) => `${order}번째 조각, ${name}`,
    countLabel: (n: number) => `놓은 조각 ${n}개`,
    removeLast: '마지막 조각 지우기',
    gap: '틈',
    overlap: '겹침',
    makeRuler: '자 만들기',
    rulerMadeNote: '자를 만들었어요. 숫자 카드를 눈금에 놓아요.',
    rulerHint: '1cm 블록 10개를 0부터 틈 없이 이어 붙이면 자를 만들 수 있어요.',
    cardTray: '숫자 카드',
    cardButton: (value: number) => `숫자 ${value}`,
    tickLabel: (order: number) => `왼쪽에서 ${order}번째 눈금`,
    tickEmpty: '비었어요',
    tickFilled: (value: number) => `${value} 놓음`,
    selectedCard: (value: number) => `고른 카드: ${value}`,
    demo: {
      friendA: '가 친구',
      friendB: '나 친구',
      count: (n: number, exact: boolean) => (exact ? `${n}번` : `약 ${n}번`),
      desk: '책상',
      spanCompare: '두 뼘의 크기',
    },
    rejected: {
      readOnly: '지금은 조작할 수 없어요.',
      full: '조각은 40개까지 놓을 수 있어요.',
      out: '띠 밖으로는 놓을 수 없어요.',
      same: '이미 그 자리에 있어요.',
      ruler: '자를 만든 뒤에는 조각을 바꿀 수 없어요. 처음으로 눌러 다시 해요.',
      notReady: '아직 자를 만들 수 없어요.',
    },
  },
  overlay: {
    misaligned: '어긋남',
    sameTank: '같은 수조에 부어 봐요',
    gap: '틈',
    overlap: '겹침',
  },
} as const;
