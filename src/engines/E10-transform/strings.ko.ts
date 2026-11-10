/** E10 도형 이동의 학생 문구. 화면에 하드코딩하지 않는다. */
import type { Side, TurnAngle, TurnDirection } from './types';

export const transformStrings = {
  name: '도형 이동',
  canvasLabel: {
    'slide-flip-turn': '모눈 위에서 도형을 밀고 뒤집고 돌리는 판',
    predict: '도형이 움직인 결과를 먼저 칠해 보는 판',
  },
  instructions: {
    'slide-flip-turn':
      '도형을 끌거나 버튼·방향키로 밀고, 뒤집고, 돌려 보세요. 움직이기 전 자리에 잔상이 남아요.',
    predict: '움직인 뒤 도형이 놓일 칸을 먼저 칠해 보세요. 확인을 누르면 도형이 실제로 움직여요.',
  },
  vertexLabels: ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅊ'] as const,
  sides: {
    up: '위',
    down: '아래',
    left: '왼쪽',
    right: '오른쪽',
  } as Readonly<Record<Side, string>>,
  turnDirections: {
    cw: '시계',
    ccw: '시계 반대',
  } as Readonly<Record<TurnDirection, string>>,

  centerAnnounce: (label: string) => `중심: 점 ${label}`,
  centerOption: (label: string) => `점 ${label}`,
  centerAria: (label: string) => `돌리기 중심 점 ${label}`,
  vertexAria: (label: string) => `꼭짓점 ${label}`,

  moveText: {
    slide: (side: string, cells: number) => `${side}로 ${cells}칸 밀기`,
    flip: (side: string) => `${side}로 뒤집기`,
    turn: (label: string, direction: string, angle: TurnAngle) =>
      `점 ${label}을 중심으로 ${direction} 방향으로 ${angle}° 돌리기`,
  },

  panel: {
    slideGroup: '밀기',
    flipGroup: '뒤집기',
    turnGroup: '돌리기',
    cells: '칸 수',
    slideAction: '밀기',
    turnAction: '돌리기',
    turnCenter: '돌리기 중심',
    angle: (angle: TurnAngle) => `${angle}°`,
    undo: '되돌리기',
    reset: '처음으로',
    gridLabel: '모눈',
    gridValue: (grid: number) => `${grid}×${grid}`,
    moveListTitle: '이동 기록',
    operationTitle: '해야 할 움직임',
    noMoves: '아직 움직이지 않았어요.',
  },

  keyboard: {
    'slide-flip-turn':
      '방향키: 1칸 밀기 · Shift+방향키: 뒤집기 · R: 시계 90° · Shift+R: 반시계 90° · C: 중심 바꾸기 · Backspace: 되돌리기',
    predict: '방향키: 칸 옮기기 · Enter: 칠하기 · Delete: 칠한 칸 지우기',
  },

  status: {
    blocked: '모눈 밖으로 나가서 옮기지 못했어요.',
    targetDone: '딱 맞아요',
  },

  predict: {
    confirm: '확인',
    retry: '다시 해 보기',
    clearPaint: '칠한 칸 지우기',
    cursorAria: '칸 커서',
    paintedAria: (i: number, j: number) => `칠한 칸 ${i + 1}번째 줄 ${j + 1}번째`,
    emptyPaint: '결과가 놓일 칸을 먼저 칠해 보세요.',
    resultAria: '움직인 뒤 도형',
    correctMark: '맞은 칸',
    extraMark: '더 칠한 칸',
    missingMark: '못 칠한 칸',
  },

  overlays: {
    pinArcs: '돌리기 중심 압정과 꼭짓점 호',
    pointTrack: '점 ㄱ이 간 자리',
    clockHand: '시계 방향 시계판',
  },
} as const;
