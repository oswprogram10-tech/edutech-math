/** E17 secret-rule predict의 학생 문구. 비밀 기준을 말하는 글은 맞힌 뒤에만 쓴다. */
export const predictStrings = {
  canvasLabel: '컴퓨터가 단추를 예·아니요 상자로 나눈 판',
  configError: '이 과제의 설정을 읽을 수 없어요.',
  configErrorBody: '선생님께 알려 주세요.',
  instructions:
    '컴퓨터가 정한 기준으로 단추를 "예"와 "아니요" 상자에 나눴어요. 새 단추가 어느 상자로 갈지 맞혀 보세요.',
  yesBin: '예 상자',
  noBin: '아니요 상자',
  yesName: '예',
  noName: '아니요',
  newCard: '새 단추',
  predictTitle: '어느 상자로 갈까요?',
  heldStatus: '새 단추를 들었어요. 넣을 상자를 골라요.',
  right: '맞았어요',
  wrong: '다른 상자였어요',
  streak: (count: number) => `연속으로 ${count}번 맞혔어요`,
  guessTitle: '컴퓨터는 어떤 기준으로 나누었을까요?',
  guessUnlocked: '이제 기준을 골라 볼 수 있어요.',
  guessWrong: '카드를 더 보고 다시 골라요.',
  guessRight: (name: string) => `맞았어요! 기준은 "${name}"이에요.`,
  optionName: (attribute: string, value: string): string => {
    if (attribute === 'color') {
      return value === 'red' ? '빨간색' : value === 'blue' ? '파란색' : '노란색';
    }
    if (attribute === 'shape') {
      return value === 'circle' ? '동그라미 모양' : value === 'square' ? '네모 모양' : '세모 모양';
    }
    return '구멍 ' + value + '개';
  },
  allDone: '기준을 맞혔어요.',
} as const;
