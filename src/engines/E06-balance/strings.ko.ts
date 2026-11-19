/** E06 양팔저울의 학생 문구. 화면에 하드코딩하지 않는다. */

export const balanceStrings = {
  name: '양팔저울',
  configError: '설정을 확인해 주세요.',
  configErrorBody: '이 활동의 설정에 문제가 있어요.',
  canvasLabel: '양팔저울',
  panLabel: { left: '왼쪽 접시', right: '오른쪽 접시' },
  result: {
    left: '왼쪽이 더 무거워요',
    right: '오른쪽이 더 무거워요',
    level: '수평이에요',
    unknown: '□에 수를 넣어 보세요',
    unknownFixed: '□ 때문에 아직 알 수 없어요',
  },
  sign: { equal: '=', notEqual: '≠', unknown: '?' },
  total: (value: string) => `합 ${value}`,
  rowLabel: { left: '왼쪽', right: '오른쪽' },
  barLabel: (text: string) => `수 막대 ${text}`,
  subtractLabel: (text: string) => `빼는 막대 ${text}`,
  boxLabel: '□ 상자',
  boxTriedLabel: (value: string) => `□ 상자, 넣어 본 수 ${value}`,
  instructions: '□에 수를 넣어 보거나 양쪽에 같은 수를 더하고 빼서 저울을 맞춰 보세요.',
  predict: {
    question: '이 저울은 수평일까요?',
    yes: '예',
    no: '아니요',
    group: '예측',
    made: (value: 'yes' | 'no') =>
      value === 'yes' ? '내 예측: 수평이에요' : '내 예측: 수평이 아니에요',
    waiting: '먼저 예측해 보세요',
  },
  keypad: {
    group: '숫자 키패드',
    erase: '지우기',
  },
  tryBlock: {
    group: '□에 수 넣어 보기',
    field: '□에 넣을 수 칸',
    fieldHint: '□에 넣을 수',
    button: '넣어 보기',
    empty: '□에 넣을 수를 써 보세요',
  },
  amount: {
    field: '더하거나 뺄 수 칸',
    fieldHint: '더하거나 뺄 수',
    invalid: '1부터 999까지의 수를 써 보세요',
  },
  both: {
    group: '양쪽에 같은 수',
    add: '양쪽에 더하기',
    remove: '양쪽에서 빼기',
  },
  one: {
    group: '한쪽만',
    leftAdd: '왼쪽에만 더하기',
    rightAdd: '오른쪽에만 더하기',
    leftRemove: '왼쪽에서만 빼기',
    rightRemove: '오른쪽에서만 빼기',
  },
  cannotRemove: '그만큼 뺄 수 있는 막대가 없어요',
  reset: '처음으로',
  overlay: {
    unknownPart: '?',
  },
} as const;
