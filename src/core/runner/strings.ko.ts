/** 실행 화면 문구. 학생 화면에 하드코딩하지 않는다. 정답을 알려 주는 문구는 없다. */
export const runnerStrings = {
  loading: '과제를 불러오는 중이에요.',
  loadError: '과제를 불러오지 못했어요.',
  back: '첫 화면으로',
  activity: '활동',
  task: '과제',
  taskCounter: (index: number, total: number) => `${index} / ${total}`,
  submit: '확인하기',
  next: '다음 과제',
  finish: '처음으로',
  passed: '좋아요, 통과했어요!',
  failed: '다시 볼까요? 지금 한 것을 천천히 살펴보고 고쳐 보세요.',
  completed: '모든 과제를 마쳤어요.',
  undo: '되돌리기',
  redo: '다시하기',
  controls: '과제 조작 도구',
  slotLabel: (slot: string) => {
    if (slot === 'left') return '왼쪽 판';
    if (slot === 'right') return '오른쪽 판';
    return slot;
  },
  taskList: '과제 목록',
} as const;
