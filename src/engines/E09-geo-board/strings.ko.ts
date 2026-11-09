/** E09 기하판의 학생 문구. 화면에 하드코딩하지 않는다. */
import type { ConstructTool } from './types';

export const geoBoardStrings = {
  name: '기하판',
  canvasLabel: {
    geoboard: '못판에 고무줄로 도형을 만드는 판',
    construct: '점판에 선을 긋고 각을 살펴보는 판',
  },
  instructions: {
    geoboard: '못에서 못으로 끌어 고무줄을 걸어 보세요. 방향키로 못을 옮기고 Enter로 이어요.',
    construct: '두 점을 골라 선을 그어 보세요. 방향키로 점을 옮기고 Enter로 골라요.',
  },

  closeBand: '고무줄 닫기',
  deleteBand: '고무줄 지우기',
  undoPeg: '마지막 못 빼기',
  chooseBand: (number: number) => `고무줄 ${number} 고르기`,
  bandLabel: (number: number) => `고무줄 ${number}`,
  bandsCount: (count: number) => `고무줄 ${count}개`,
  count: (vertices: number, sides: number) => `꼭짓점 ${vertices}개 · 변 ${sides}개`,
  overlap: '선이 서로 겹쳐요. 다른 못으로 옮겨 보세요.',
  pegAria: (i: number, j: number) => `못 ${i + 1}번째 줄 ${j + 1}번째`,
  cursor: '못 커서',
  canvasHint:
    '방향키: 못 옮기기 · Enter: 잇기/닫기 · Backspace: 마지막 못 빼기 · Delete: 고무줄 지우기',
  bandHint: '1~9: 옮길 점 고르기 · 방향키: 옮기기 · Delete: 고무줄 지우기',
  vertexChosen: (index: number) => `${index}번 점을 골랐어요. 방향키로 옮겨 보세요.`,
  gridLabel: '못판 크기',
  gridValue: (cols: number, rows: number) => `${cols}×${rows}`,

  construct: {
    toolGroup: '도구',
    tools: {
      segment: '선분',
      ray: '반직선',
      line: '직선',
      'set-square': '직각삼각자',
    } as Readonly<Record<ConstructTool, string>>,
    pending: '시작점을 골랐어요. 다른 점을 골라 이어 보세요.',
    removeObject: '선 지우기',
    objectLabel: (kind: ConstructTool, from: string, to: string) =>
      `${geoBoardStrings.construct.tools[kind]} ${from}${to}`,
    removeObjectLabel: (label: string) => `${label} 지우기`,
    placeSquare: '직각삼각자 대기',
    removeSquare: '삼각자 떼기',
    squareFit: '꼭 맞아요',
    squareGap: '틈이 있어요',
    markRight: '직각 표시하기',
    unmarkRight: '직각 표시 지우기',
    angleLabel: (number: number) => `각 ${number}`,
    angleHint: '삼각자 도구를 고르고 각을 골라 Enter를 누르면 대어 볼 수 있어요.',
    given: '미리 그린 선',
    squareOn: (label: string) => `${label}에 삼각자를 댔어요.`,
    targetHit: '별을 맞혔어요',
    targetPending: '아직 맞히지 않은 별',
    canvasHint: '방향키: 점 옮기기 · Enter: 점 고르기 · Delete: 마지막으로 그린 선 지우기',
    pointAria: (label: string) => `점 ${label}`,
    targetAria: (number: number) => `과녁 별 ${number}`,
  },

  overlays: {
    straightRun: '일직선 위 못 구간',
    uprightGhost: '가장 긴 변을 수평으로 돌린 그림',
    laserExtent: '끝이 없는 쪽 레이저',
    squareTurn: '직각삼각자 돌리기',
  },
} as const;
