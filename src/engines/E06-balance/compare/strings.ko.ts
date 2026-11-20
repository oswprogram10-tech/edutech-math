/** E06 `compare` 모드의 학생 문구. 화면에 하드코딩하지 않는다. */
import type { CompareKind } from './types';

export const compareStrings = {
  names: {
    apple: '사과',
    feather: '깃털',
    balloon: '풍선',
    stone: '돌',
    sponge: '스펀지',
    'iron-ball': '쇠공',
    book: '책',
    eraser: '지우개',
  } satisfies Record<CompareKind, string>,
  empty: '물건을 접시에 올려 보세요',
  instructions:
    '물건을 끌어 저울에 올려 무게를 견줘 보세요. 키보드는 L(왼쪽)·R(오른쪽)·Backspace(선반)예요.',
  shelfLabel: '물건 선반',
  itemLabel: (name: string, place: string) => `${name}, ${place}`,
  weightLabel: (value: string) => `무게 ${value}`,
  place: { shelf: '선반에 있어요', left: '왼쪽 접시에 있어요', right: '오른쪽 접시에 있어요' },
  selected: (name: string) => `고른 물건: ${name}`,
  noneSelected: '물건을 먼저 골라 주세요',
  buttons: {
    group: '고른 물건 옮기기',
    left: '왼쪽 접시에 올리기 (L)',
    right: '오른쪽 접시에 올리기 (R)',
    shelf: '선반으로 (Backspace)',
  },
  full: '접시가 가득 찼어요',
  overlay: {
    label: '크기와 무게를 견준 그림',
    size: '크기',
    weight: '무게',
    left: '왼쪽',
    right: '오른쪽',
  },
} as const;
