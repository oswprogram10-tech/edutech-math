/** 응답 위젯 문구. 선택지·카드 이름은 콘텐츠 JSON에 둔다. 정답을 알려 주는 문구는 없다. */
import type { NumberForm } from './types';

export const responseStrings = {
  name: '내 답',
  panelLabel: '내 답 쓰기',
  fieldLabel: (label: string | undefined, index: number) =>
    label && label.length > 0 ? label : `답 ${index + 1}`,
  forms: {
    integer: '자연수',
    fraction: '분수',
    mixed: '대분수',
    decimal: '소수',
  } satisfies Record<NumberForm, string>,
  formSwitch: '입력 틀',
  whole: '자연수 부분',
  numerator: '분자',
  denominator: '분모',
  decimal: '소수',
  numberInput: '답 입력',
  keypad: '답 입력 키패드',
  backspace: '한 칸 지우기',
  clear: '모두 지우기',
  emptyPart: '빈칸',
  choiceGroup: '보기',
  choiceOption: (index: number) => `보기 ${index + 1}`,
  selectedMark: '골랐어요',
  orderGroup: '순서',
  orderUp: '위로',
  orderDown: '아래로',
  orderItem: (index: number) => `${index + 1}번째`,
  compareGroup: '부등호',
  compareSymbols: {
    '<': '작다',
    '=': '같다',
    '>': '크다',
  },
  sortGroup: '카드 나누기',
  sortUnsorted: '아직 고르지 않은 카드',
  sortPick: '옮길 카드로 고르기',
  sortPlace: '여기에 놓기',
  sortRemove: '빼기',
  keyboardHint: '키보드로도 입력할 수 있어요.',
} as const;
