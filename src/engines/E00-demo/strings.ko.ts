/** E00-demo 학생 문구. 화면에 하드코딩하지 않는다. */
export const demoStrings = {
  name: '셈돌 데모',
  canvasLabel: '셈돌을 놓고 옮기는 판',
  instructions: '빈 곳을 누르면 셈돌이 놓여요. 끌어서 옮기고, 빈 곳을 크게 둘러 묶어 보세요.',
  addCounter: '셈돌 놓기',
  counterLabel: (number: number) => `셈돌 ${number}`,
  groupLabel: (count: number) => `묶음: 셈돌 ${count}개`,
  ungroup: '묶음 풀기',
  selectedHint: '선택한 셈돌은 Enter 키로 묶을 수 있어요.',
  lassoGuide: '빈 곳을 크게 둘러 보세요',
} as const;
