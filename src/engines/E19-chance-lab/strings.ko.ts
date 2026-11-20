/** E19 학생에게 보이는 문구. 정답(평균)을 알려 주는 글은 두지 않는다. */
export const E19_STRINGS = {
  name: '평균·가능성 실험실',
  controlsLabel: '조작',
  configError: '이 활동의 설정이 올바르지 않아요.',
  configErrorBody: '선생님께 알려 주세요.',
  configErrorDivide: '이 자료는 블록을 쪼개지 않고는 똑같이 나눌 수 없어요.',
  defaultName: (index: number) => `${index + 1}번`,
  reset: '처음으로',
  leveling: {
    instructions:
      '기둥 맨 위 블록을 끌어 다른 기둥 위에 놓아 보세요. 키보드는 ←→로 기둥을 고르고 Enter로 집고 놓아요. Esc는 취소예요.',
    boardLabel: '블록 기둥 판',
    movesText: (n: number) => `옮긴 횟수 ${n}번`,
    holdingText: (name: string) =>
      `${name} 맨 위 블록을 집었어요. 놓을 기둥을 골라 Enter를 눌러요.`,
    cursorText: (name: string) => `${name} 기둥을 골랐어요.`,
    columnLabel: (name: string, height: number) => `${name} 기둥, 블록 ${height}개`,
    buttons: {
      prev: '왼쪽 기둥 고르기',
      next: '오른쪽 기둥 고르기',
      pick: '맨 위 블록 집기',
      place: '여기에 놓기',
      cancel: '집기 취소',
      reset: '처음으로',
    },
    rejected: {
      empty: '옮길 블록이 없어요.',
      full: '더 쌓을 수 없어요.',
      same: '다른 기둥에 놓아 주세요.',
    },
    overlay: {
      levelTry: (extra: number, lack: number) => `남는 블록 ${extra}개 / 모자란 칸 ${lack}개`,
      sumTower: '모두 합친 기둥',
    },
  },
  seesaw: {
    instructions:
      '삼각형 받침점을 끌어 시소가 수평이 되는 자리를 찾아 보세요. 키보드는 받침점을 고르고 ←→로 움직여요.',
    boardLabel: '시소 판',
    fulcrumLabel: '받침점',
    fulcrumText: (value: string) => `받침점 ${value}`,
    tilt: {
      left: '왼쪽으로 기울어요',
      right: '오른쪽으로 기울어요',
      level: '수평이에요',
    },
    movesText: (n: number) => `옮긴 횟수 ${n}번`,
    buttons: { left: '받침점 왼쪽으로', right: '받침점 오른쪽으로', reset: '처음으로' },
    rejected: { edge: '더 갈 수 없어요.' },
    overlay: { left: '왼쪽 합', right: '오른쪽 합' },
  },
  outlier: {
    instructions:
      '◆를 끌어 값을 바꾸면 평균선이 어떻게 움직이는지 살펴보세요. 키보드는 ◆를 고르고 ←→로 움직여요.',
    instructionsPredict:
      '먼저 평균이 어떻게 될지 예측해서 써 보세요. 예측하기를 누르면 ◆를 끌 수 있어요.',
    boardLabel: '점과 평균선 판',
    dragHint: '끌 수 있어요',
    pointLabel: (name: string, value: number) => `${name} 점, ${value}`,
    meanLabel: '평균',
    initialMeanLabel: '처음 평균',
    predictionLabel: '내 예측',
    predictedText: (text: string) => `내 예측 ${text}`,
    predictTitle: '내 예측',
    predictButton: '예측하기',
    predictPlaceholder: '예측을 써 보세요',
    keypadLabel: '예측 키패드',
    keys: { backspace: '지우기', space: '띄우기', dot: '.', slash: '/' },
    buttons: { less: '1 줄이기', more: '1 늘리기', reset: '처음으로' },
    rejected: {
      locked: '먼저 예측해 보세요.',
      range: '끌 수 있는 범위를 벗어났어요.',
      bad: '예측을 숫자(소수·분수)로 써 주세요.',
      outOfRange: '수직선 범위 안의 수로 써 주세요.',
    },
    overlay: { pointMoved: '점이 움직인 거리', meanMoved: '평균이 움직인 거리' },
  },
} as const;
