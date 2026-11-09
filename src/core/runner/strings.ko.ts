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
  hint: '힌트',
  hintRead: '힌트 읽어 주기',
  hintLookAtOverlay: '교구에 표시한 그림을 살펴보세요.',
  boosterTitle: '잠깐 연습',
  slotLabel: (slot: string) => {
    if (slot === 'left') return '왼쪽 판';
    if (slot === 'right') return '오른쪽 판';
    if (slot === 'response') return '내 답';
    // 'main' 같은 내부 이름은 학생에게 보이지 않게 한다.
    return '교구';
  },
  taskList: '과제 목록',
  show: '보여 주기',
  shareTitle: '지금 상태 보여 주기',
  shareHint: '이 코드나 링크를 선생님 기기에서 열면 지금 화면이 그대로 나와요.',
  shareCodeLabel: '공유 코드',
  shareLinkLabel: '링크',
  shareQrLabel: 'QR',
  shareClose: '닫기',
  shareTooLong: '상태가 너무 커서 짧은 코드로 만들 수 없어요.',
  shareInvalid: '공유 코드를 읽을 수 없어요.',
  shareFailed: '공유 코드를 만들지 못했어요.',
  shareQrFailed: 'QR을 만들지 못했어요.',
  shareQrLoading: 'QR을 만드는 중이에요.',
  shareQrTooLarge: 'QR로 담기에는 상태가 너무 커요. 코드나 링크를 써 주세요.',
} as const;
