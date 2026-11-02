import type { Interest } from '../core/storage';

export const appStrings = {
  title: 'MathExplorer',
  tagline: '손으로 만지며 수학 원리를 발견해요',
  comingSoon: '교구를 준비하고 있어요.',
  loading: '화면을 불러오는 중이에요.',
} as const;

/** 엔진 샌드박스(E2E·교사 시연용) 문구. 학생 메뉴에는 나오지 않는다. */
export const sandboxStrings = {
  loading: '엔진을 불러오는 중이에요.',
  loadError: '엔진을 불러오지 못했어요.',
  back: '첫 화면으로',
  controls: '엔진 조작 도구',
  undo: '되돌리기',
  redo: '다시하기',
  zoomIn: '확대',
  zoomOut: '축소',
  target48: '터치 48px',
  target64: '터치 64px',
  readOnly: '읽기 전용',
  overlay: '힌트 겹쳐 보기',
  observation: '관찰 결과',
  engineLabel: '엔진',
  modeLabel: '모드',
} as const;

export const interestLabels: Record<Interest, string> = {
  baseball: '야구',
  cooking: '요리',
  space: '우주',
  game: '게임',
  animals: '동물',
  music: '음악',
};

/** S1 시작 화면. */
export const startStrings = {
  heading: '몇 번이에요?',
  hint: '내 번호를 눌러 주세요.',
  numberLabel: (number: number) => `${number}번`,
  currentLearner: (number: string) => `지금 ${number}번 친구예요`,
  interestsHeading: '관심사를 골라 보세요.',
  interestsHint: '문장제에 내 관심사를 섞어 보여 줘요. 건너뛰어도 괜찮아요.',
  skip: '건너뛰기',
  start: '시작하기',
  backToNumbers: '번호 다시 고르기',
  teacher: '선생님',
  loading: '학생 정보를 불러오는 중이에요.',
  loadError: '학생 정보를 불러오지 못했어요.',
  memoryNotice: '이 기기에서는 기록이 저장되지 않아요(사생활 보호 모드 등).',
} as const;

/** S2 자리(`#/map`). 별자리는 T008에서 만든다. */
export const mapStrings = {
  heading: '활동',
  constellationSoon: '나의 수학 별자리는 다음 카드에서 만나요.',
  activitiesHeading: '할 수 있는 활동',
  empty: '아직 열린 활동이 없어요.',
  loading: '활동 목록을 불러오는 중이에요.',
  loadError: '활동 목록을 불러오지 못했어요.',
  back: '시작 화면으로',
  learnerLabel: (number: string) => `${number}번`,
} as const;

/** S3 활동 화면 상단 바·설정 메뉴. */
export const activityStrings = {
  back: '활동 목록으로',
  readPrompt: '발문 읽기',
  settings: '설정',
  settingsMenu: '활동 설정',
  autoRead: '발문 자동 읽기',
  largeTarget: '큰 버튼',
  switchFriend: '다른 친구로 바꾸기',
  learnerLabel: (number: string) => `${number}번`,
  progress: (current: number, total: number) => `과제 ${current} / ${total}`,
  loading: '활동을 불러오는 중이에요.',
  loadError: '활동을 불러오지 못했어요.',
  notFound: '활동을 찾지 못했어요.',
} as const;

/** 교사 PIN과 교사 첫 화면. */
export const teacherStrings = {
  heading: '선생님 확인',
  setupHeading: '선생님 PIN 만들기',
  setupHint: '숫자 4자리 PIN을 두 번 입력해 주세요.',
  unlockHeading: '선생님 PIN',
  newPin: '새 PIN',
  confirmPin: '새 PIN 확인',
  pin: 'PIN',
  create: '만들기',
  enter: '들어가기',
  wrongPin: 'PIN이 맞지 않아요. 다시 입력해 주세요.',
  mismatch: '두 PIN이 달라요. 다시 입력해 주세요.',
  invalid: '숫자 4자리로 입력해 주세요.',
  unavailable: '이 주소(http)에서는 선생님 PIN을 쓸 수 없어요. https 주소로 열어 주세요.',
  saveError: 'PIN을 저장하지 못했어요. 다시 시도해 주세요.',
  homeHeading: '선생님 화면',
  homeHint: '교사 시연 도구와 관리는 다음 카드에서 이어져요.',
  sandboxHeading: '엔진 샌드박스',
  storageHeading: '기기 저장소',
  backendIndexedDb: '기기에 저장 중',
  backendMemory: '저장하지 못하고 메모리에만 있어요',
  persistedYes: '기록이 오래 남도록 허용됨',
  persistedUnknown: '기록 보관이 보장되지 않아요',
  memoryNotice: '이 기기에서는 기록이 저장되지 않아요(사생활 보호 모드 등).',
  persistentNotice: '아이패드는 홈 화면에 추가해야 기록이 오래 남아요.',
  back: '첫 화면으로',
  loading: '선생님 화면을 준비하는 중이에요.',
} as const;
