/** E10 도형 이동의 학생 문구. 화면에 하드코딩하지 않는다. */
import type { Side, TurnAngle, TurnDirection } from './types';
import type { LinePresetId, PointPresetId } from './polygons';

/** 받침에 맞춘 방향 조사. '위·아래'는 로, '왼쪽·오른쪽'은 으로. */
function directionParticle(word: string): '로' | '으로' {
  const code = word.charCodeAt(word.length - 1);
  if (code < 0xac00 || code > 0xd7a3) return '로';
  const final = (code - 0xac00) % 28;
  return final === 0 || final === 8 ? '로' : '으로';
}

export const transformStrings = {
  name: '도형 이동',
  canvasLabel: {
    'slide-flip-turn': '모눈 위에서 도형을 밀고 뒤집고 돌리는 판',
    predict: '도형이 움직인 결과를 먼저 칠해 보는 판',
    tessellation: '여러 가지 타일로 틀을 빈틈없이 채우는 판',
    congruence: '도형을 옮겨 다른 도형과 포개 보는 판',
    'line-symmetry': '접어서 선대칭을 살펴보는 판',
    'point-symmetry': '압정을 꽂고 돌려 점대칭을 살펴보는 판',
  },
  instructions: {
    'slide-flip-turn':
      '도형을 끌거나 버튼·방향키로 밀고, 뒤집고, 돌려 보세요. 움직이기 전 자리에 잔상이 남아요.',
    predict: '움직인 뒤 도형이 놓일 칸을 먼저 칠해 보세요. 확인을 누르면 도형이 실제로 움직여요.',
    tessellation:
      '타일을 골라 밀고·뒤집고·돌려 틀을 채워 보세요. 다 놓았으면 빈틈 살펴보기로 확인해요.',
    congruence: '움직이는 도형을 밀고·뒤집고·돌려 고정된 도형 위에 정확히 포개 보세요.',
    'line-symmetry':
      '점 두 개를 골라 대칭축을 긋고 접어 보세요. 겹치면 축이 남고, 어긋나면 빈틈이 보여요.',
    'point-symmetry': '압정을 꽂고 180° 돌려 보세요. 도형이 겹치는 압정 자리를 살펴보세요.',
  },
  vertexLabels: ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅊ'] as const,
  movingLabels: ['ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'] as const,
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
    slide: (side: string, cells: number) => `${side}${directionParticle(side)} ${cells}칸 밀기`,
    flip: (side: string) => `${side}${directionParticle(side)} 뒤집기`,
    turn: (label: string, direction: string, angle: number) =>
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
    historyLabel: '이동 기록',
    operationTitle: '해야 할 움직임',
    noMoves: '아직 움직이지 않았어요.',
  },

  keyboard: {
    'slide-flip-turn':
      '방향키: 1칸 밀기 · Shift+방향키: 뒤집기 · R: 시계 90° · Shift+R: 반시계 90° · C: 중심 바꾸기 · Backspace: 되돌리기',
    predict: '방향키: 칸 옮기기 · Enter: 칠하기 · Delete: 칠한 칸 지우기',
    tessellation:
      '방향키: 밀기 · F 뒤 방향키: 뒤집기 · R: 돌리기 · C: 중심 · Enter: 놓기 · Backspace: 마지막 타일 빼기 · G: 빈틈 살펴보기',
    congruence:
      '방향키: 1칸 밀기 · Shift+방향키: 뒤집기 · R: 시계 90° · Shift+R: 반시계 90° · C: 중심 · Backspace: 되돌리기 · Escape: 처음 자리로',
    'line-symmetry':
      '방향키: 점 옮기기 · Enter: 점 고르기 · F: 접어 보기 · U: 펼치기 · Escape: 축 지우기 · 1~9: 도형 고르기',
    'point-symmetry':
      '방향키: 압정 옮기기 · Enter: 압정 꽂기 · T: 180° 돌리기 · Shift+방향키: 뒤집기 · Escape: 되돌리기 · 1~9: 도형 고르기',
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

  tessellation: {
    tileGroup: '타일 고르기',
    tiles: {
      square: '정사각형',
      triangle: '정삼각형',
      hexagon: '정육각형',
      'pentagon-regular': '정오각형',
      custom: '변형 도형',
    } as Readonly<Record<string, string>>,
    customize: '변 깎아 붙이기',
    place: '놓기',
    removeLast: '마지막 타일 빼기',
    clearAll: '모두 지우기',
    checkGaps: '빈틈 살펴보기',
    full: '빈틈도 겹침도 없어요',
    hasGap: '빈 칸이 남아 있어요',
    hasOverlap: '겹친 칸이 있어요',
    otherFamily: '다른 모양을 쓰려면 먼저 모두 지우기',
    hubTitle: '한 꼭짓점 둘레',
    hubAdd: '하나 더 붙이기',
    hubRemove: '하나 빼기',
    editorTitle: '변 깎기 편집판',
    editorHint: '방향키로 칸을 옮기고 Enter로 깎아 보세요. 붙은 칸은 다른 무늬로 보여요.',
    cellAria: (column: number, row: number) => `${row}번째 줄 ${column}번째 칸`,
    diagonalSw: '↙ 왼쪽 아래',
    diagonalNe: '↗ 오른쪽 위',
    cells: '칸 수',
  },

  congruence: {
    pairTitle: '대응하는 변 짝짓기',
    movingSide: '움직인 도형의 변',
    fixedSide: '고정된 도형의 변',
    pair: '짝 짓기',
    unpair: '짝 풀기',
    pairs: '지은 짝',
    noPairs: '아직 지은 짝이 없어요.',
    resetMoving: '처음 자리로',
    sideName: (label: string, next: string) => `변 ${label}${next}`,
    pointMark: ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧'] as const,
  },

  line: {
    fold: '접어 보기',
    unfold: '펼치기',
    clearAxis: '축 지우기',
    pointCursor: '점 커서',
    axisPrompt: '점 두 개를 골라 축을 그어 보세요.',
    pickSecond: '한 점을 더 골라 주세요.',
    foldOk: '딱 겹쳐요',
    foldGap: '어긋나서 빈틈이 생겨요',
    shapePick: (index: number) => `도형 ${index + 1}`,
    decal: {
      mark: '물감 바꾸기',
      erase: '점 지우기',
      fold: '종이 접기',
      unfold: '종이 펴기',
      folded: '접힌 종이',
      marks: ['●', '▲', '■', '◆'] as const,
      instruction: '가운데 선 왼쪽에만 물감을 찍어요. 접으면 오른쪽에 같은 모양이 찍혀요.',
    },
    complete: {
      instruction: '반쪽의 끝에서 시작해 점을 이어 반쪽을 완성하세요.',
      undo: '마지막 점 지우기',
      closed: '완성했어요',
      notClosed: '반쪽의 끝에서 시작해 첫 점에서 닫아 보세요.',
    },
    shapeId: (id: LinePresetId) => id,
  },

  point: {
    place: '압정 꽂기',
    turn: '180° 돌리기',
    reset: '되돌리기',
    pinCursor: '압정 커서',
    prompt: '점판을 눌러 압정을 꽂고 180° 돌려 보세요.',
    center: '대칭의 중심',
    centerFound: '대칭의 중심을 찾았어요',
    notYet: '아직 겹치지 않아요',
    flipWarn: '뒤집기는 대칭의 중심을 찾는 데 쓰지 않아요.',
    shapePick: (index: number) => `도형 ${index + 1}`,
    complete: {
      instruction: '반쪽의 끝에서 시작해 점을 이어 반쪽을 완성하세요.',
      undo: '마지막 점 지우기',
      closed: '완성했어요',
      notClosed: '반쪽의 끝에서 시작해 첫 점에서 닫아 보세요.',
    },
    shapeId: (id: PointPresetId) => id,
  },

  overlays: {
    pinArcs: '돌리기 중심 압정과 꼭짓점 호',
    pointTrack: '점 ㄱ이 간 자리',
    clockHand: '시계 방향 시계판',
    foldGap: '접었을 때 생기는 빈틈',
    protrude: '고정된 도형 밖으로 삐져나온 부분',
    flipVsTurn: '뒤집기와 돌리기 비교',
    flip: '뒤집기',
    turn: '돌리기',
  },
} as const;
