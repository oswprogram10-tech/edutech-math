/** E14 학생에게 보이는 문구. 시각(정답)을 글로 알려 주는 문구는 두지 않는다. */

/** 숫자 1~12 뒤의 목적격 조사(일을·이를·삼을 …). */
const PARTICLE_EUL: readonly string[] = [
  '',
  '을',
  '를',
  '을',
  '를',
  '를',
  '을',
  '을',
  '을',
  '를',
  '을',
  '을',
  '를',
];
/** 숫자 1~12 뒤의 '과/와'. */
const PARTICLE_GWA: readonly string[] = [
  '',
  '과',
  '와',
  '과',
  '와',
  '와',
  '과',
  '과',
  '과',
  '와',
  '과',
  '과',
  '와',
];

export const E14_STRINGS = {
  name: '시계·시간',
  controlsLabel: '조작',
  configError: '이 활동의 설정이 올바르지 않아요.',
  configErrorBody: '선생님께 알려 주세요.',
  boardLabel: '시계 판',
  instructions: '바늘을 돌려 보세요. 키보드는 ←→로 돌려요.',
  instructionsReadOnly: '시계를 잘 보세요.',
  backward: '◀ 거꾸로',
  forward: '앞으로 ▶',
  unroll: '펼치기',
  rewind: '다시 감기',
  reset: '처음으로',
  longHand: '긴바늘',
  shortHand: '짧은바늘',
  gearCaption: '긴바늘이 한 바퀴 돌면 짧은바늘은 한 칸',
  gearBig: '큰 톱니',
  gearSmall: '작은 톱니',
  stripLabel: '0분부터 60분까지 펼친 띠',
  digitalLabel: '디지털 시계',
  rejected: {
    readOnly: '지금은 바늘을 움직일 수 없어요.',
    same: '이미 그 자리에 있어요.',
    notAllowed: '그 자리에는 놓을 수 없어요.',
    unroll: '펼치기를 쓸 수 없는 활동이에요.',
  },
  /** "긴바늘이 6을 가리켜요" */
  pointsAt: (hand: string, numeral: number) =>
    `${hand}이 ${numeral}${PARTICLE_EUL[numeral] ?? '을'} 가리켜요`,
  /** "짧은바늘이 8과 9 사이에 있어요" */
  between: (hand: string, lo: number, hi: number) =>
    `${hand}이 ${lo}${PARTICLE_GWA[lo] ?? '과'} ${hi} 사이에 있어요`,
  overlay: {
    hourHandFocus: '몇 시는 짧은바늘이 알려 줘요',
    numeralMinutes: (numeral: number) => `${numeral * 5}분`,
  },
} as const;
