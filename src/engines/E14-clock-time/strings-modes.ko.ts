/**
 * E14 duration·calendar 모드의 학생 문구. 걸린 시간·가려진 날짜를 글로 알려 주는 문구는 두지 않는다.
 */

export const E14_MODE_STRINGS = {
  configError: '이 활동의 설정이 올바르지 않아요.',
  configErrorBody: '선생님께 알려 주세요.',
  controlsLabel: '조작',
  reset: '처음으로',
  duration: {
    boardLabel: '시각 띠',
    instructions:
      '시작 표시와 끝 표시를 띠 위에 놓아 보세요. 키보드는 Tab으로 표시를 고르고 ←→로 옮겨요.',
    instructionsFixed: '시작은 정해져 있어요. 끝 표시를 띠 위에 놓아 보세요.',
    startName: '시작',
    endName: '끝',
    startMark: '시작 표시',
    endMark: '끝 표시',
    notPlaced: '아직 놓지 않았어요',
    trayCaption: '표시를 끌어 띠 위에 놓아요',
    startBack: '시작 ◀',
    startForward: '시작 ▶',
    endBack: '끝 ◀',
    endForward: '끝 ▶',
    spanLabel: '색칠한 구간',
    hourName: (hour: number) => `${hour}시`,
    /** "3시 20분" 같은 표시의 시각 설명(표시 자리만 말한다). */
    markAt: (hour: number, minute: number) =>
      minute === 0 ? `${hour}시` : `${hour}시 ${minute}분`,
    rejected: {
      same: '이미 그 자리에 있어요.',
      notAllowed: '그 자리에는 놓을 수 없어요.',
      endBeforeStart: '끝은 시작보다 앞에 놓을 수 없어요.',
      startAfterEnd: '시작은 끝보다 뒤에 놓을 수 없어요.',
      startFixed: '시작 표시는 움직일 수 없어요.',
    },
    overlay: {
      split: '60분이 되면 다음 시',
    },
  },
  calendar: {
    boardLabel: '달력',
    weekdays: ['일', '월', '화', '수', '목', '금', '토'],
    instructionsLead: '달력을 보세요.',
    instructionsSelect: '날짜를 누르면 고르거나 풀어요.',
    instructionsFill: '가려진 칸을 누르고 수를 넣어요.',
    instructionsArrows: '같은 세로줄을 위에서 아래로 쓸면 화살표가 생겨요. 키보드는 A 키.',
    hiddenCell: (weekday: string) => `가려진 칸, ${weekday}요일`,
    dayCell: (day: number, weekday: string) => `${day}일 ${weekday}요일`,
    filledSuffix: (value: number) => `, 넣은 수 ${value}`,
    selectedSuffix: ', 고름',
    bufferLabel: '넣을 수',
    bufferEmpty: '(없음)',
    clear: '지우기',
    put: '넣기',
    digit: (n: number) => String(n),
    plusSeven: '+7',
    rejected: {
      same: '이미 그렇게 되어 있어요.',
      noEntry: '수를 먼저 눌러 보세요.',
      noCell: '가려진 칸을 먼저 눌러 보세요.',
      badValue: '1부터 31까지의 수를 넣어요.',
      arrowShape: '같은 세로줄에서 위에서 아래로 쓸어 보세요.',
      locked: '지금은 조작할 수 없어요.',
      cannotSelect: '이 활동에서는 날짜를 고를 수 없어요.',
      cannotFill: '이 활동에서는 수를 넣을 수 없어요.',
      cannotArrow: '이 활동에서는 화살표를 그릴 수 없어요.',
    },
  },
} as const;
