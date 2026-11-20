/** E17 sort 모드의 학생 문구. 화면에 하드코딩하지 않는다. */

const COLOR_NAMES: Readonly<Record<string, string>> = {
  red: '빨강',
  blue: '파랑',
  yellow: '노랑',
};

const SHAPE_NAMES: Readonly<Record<string, string>> = {
  circle: '동그라미',
  square: '네모',
  triangle: '세모',
};

const FAMILY_NAMES: Readonly<Record<string, string>> = {
  box: '상자 모양',
  cylinder: '둥근기둥 모양',
  sphere: '공 모양',
};

const SIZE_NAMES: Readonly<Record<string, string>> = {
  small: '작은 것',
  mid: '중간 것',
  big: '큰 것',
};

export const sortStrings = {
  canvasLabel: '카드를 상자에 나누어 넣는 판',
  configError: '이 과제의 설정을 읽을 수 없어요.',
  configErrorBody: '선생님께 알려 주세요.',
  instructions: {
    pickCriterion: '먼저 나누는 기준을 골라요.',
    sorting: '카드를 끌어서 상자에 넣어요. 카드를 눌러 든 뒤 상자를 눌러도 돼요.',
    conveyor: '벨트에 온 카드를 상자에 넣으면 다음 카드가 와요.',
    nameBins: '상자마다 이름 그림을 골라 붙여요.',
    counting: '상자마다 카드가 몇 장인지 세어서 적어요.',
  },
  tray: '카드 칸',
  belt: '벨트',
  beltRemaining: (count: number) => `남은 카드 ${count}장`,
  beltEmpty: '벨트가 비었어요',
  binLabel: (index: number) => `상자 ${index}`,
  binUnnamed: '이름 없는 상자',
  binCount: (count: number) => `${count}장`,
  trayEmpty: '카드를 모두 상자에 넣었어요.',
  noBinsYet: '기준을 고르면 상자가 나타나요.',
  heldStatus: '카드를 들었어요. 넣을 상자를 골라요.',
  placedStatus: (bin: string) => `${bin}에 넣었어요.`,
  backStatus: '카드를 카드 칸으로 돌려놓았어요.',
  needCriterion: '먼저 기준을 골라야 카드를 넣을 수 있어요.',
  needCurrent: '벨트에 온 카드부터 넣어요.',

  criterionTitle: '나누는 기준 고르기',
  criterionChoose: (name: string) => `${name}(으)로 나누기`,
  changeCriterion: '기준 바꾸기',
  criterionName: {
    color: '색깔',
    shape: '모양',
    holes: '구멍 수',
    pretty: '예쁜 것',
    shapeFamily: '모양',
    size: '크기',
  } as Readonly<Record<string, string>>,
  prettyValue: { pretty: '예쁜 것', plain: '안 예쁜 것' } as Readonly<Record<string, string>>,

  labelTitle: '상자 이름 붙이기',
  labelGroup: (index: number) => `상자 ${index} 이름 붙이기`,
  labelClear: '이름 지우기',
  iconNone: '이름 없음',

  countTitle: '개수 세기',
  countGroup: (name: string) => `${name} 카드 수`,
  countDecrease: '하나 줄이기',
  countIncrease: '하나 늘리기',
  countInput: (name: string) => `${name} 개수 쓰기`,
  autoCountTitle: '상자별 개수',

  valueName: (attribute: string, value: string): string => {
    if (attribute === 'color') return COLOR_NAMES[value] ?? value;
    if (attribute === 'shape') return SHAPE_NAMES[value] ?? value;
    if (attribute === 'holes') return `구멍 ${value}개`;
    if (attribute === 'shapeFamily') return FAMILY_NAMES[value] ?? value;
    if (attribute === 'size') return SIZE_NAMES[value] ?? value;
    if (attribute === 'pretty') return sortStrings.prettyValue[value] ?? value;
    return value;
  },

  /** 단추 카드 aria-label: 색·모양·구멍 수. */
  buttonLabel: (color: string, shape: string, holes: string): string =>
    `${COLOR_NAMES[color] ?? color} ${SHAPE_NAMES[shape] ?? shape} 단추, 구멍 ${holes}개`,

  overlay: {
    binAttributes: '상자 안 카드의 성질',
    attrRow: {
      color: '색',
      shape: '모양',
      holes: '구멍',
      shapeFamily: '모양',
      size: '크기',
    } as Readonly<Record<string, string>>,
    twoFriends: '두 친구가 나눈 모습',
    friend1: '친구 1',
    friend2: '친구 2',
    touchDots: '짚으며 세는 점',
    grayShapes: '생김새만 보이는 회색 그림',
    rotateMatch: '눕힌 캔을 세워 겹친 그림',
  },
} as const;
