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
