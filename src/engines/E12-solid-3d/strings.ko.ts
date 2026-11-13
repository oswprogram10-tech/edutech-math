/** E12 3D 입체의 학생 화면 문구. 화면에 높이·전체 개수 숫자를 노출하지 않는다. */
import type { CubesTool, ProjectionView } from './types';

export const solid3dStrings = {
  name: '3D 입체',
  canvasLabel: '쌓기나무를 쌓고 돌려서 살펴보는 무대',
  instructions:
    '칸을 눌러 쌓기나무를 쌓거나 길게 눌러 뺄 수 있어요. 방향키로 칸을 옮기고 Enter로 쌓아요.',
  keyHint: '방향키: 칸 옮기기 · Enter: 쌓기 · Backspace: 빼기 · Q/E: 돌리기 · T: 반투명',
  keyHint3d: '손가락 두 개로 돌려 보세요 · 마우스는 오른쪽 버튼으로 끌어요',
  tools: {
    add: '쌓기',
    remove: '빼기',
  } as Readonly<Record<CubesTool, string>>,
  turnLeft: '왼쪽으로 돌리기',
  turnRight: '오른쪽으로 돌리기',
  translucent: '반투명',
  clear: '모두 빼기',
  switchToIso: '평면 그림으로 보기',
  switchTo3d: '입체로 보기',
  preparing3d: '입체 무대를 준비하고 있어요',
  helperDiagramTitle: '도움 그림',
  cameraPresets: {
    top: '위에서',
    front: '앞에서',
    side: '오른쪽에서',
    iso: '비스듬히',
  } as const,
  maxReached: '더 쌓을 수 없어요',
  front: '앞',
  views: {
    top: '위에서 본 모양',
    front: '앞에서 본 모양',
    side: '오른쪽 옆에서 본 모양',
  } as Readonly<Record<ProjectionView, string>>,
  referenceTitle: '보기',
  referenceViewTitle: (view: ProjectionView) => `보기: ${solid3dStrings.views[view]}`,
  projectionHint: '칸을 누르거나 방향키·Enter로 고르면 무대의 쌓기나무가 강조돼요.',
  columnAria: (x: number, y: number) => `가로 ${x + 1}번째, 앞에서 ${y + 1}번째 칸`,
  projectionCellAria: (view: ProjectionView, row: number, col: number, filled: boolean) =>
    `${solid3dStrings.views[view]} ${row + 1}번째 줄 ${col + 1}번째 칸${filled ? ', 채워짐' : ''}`,
  referenceAria: '보기 모양',
  live: {
    cursorAt: (x: number, y: number) => `가로 ${x + 1}번째, 앞에서 ${y + 1}번째 칸`,
    added: '쌓았어요',
    removed: '뺐어요',
    maxReached: '더 쌓을 수 없어요',
    turned: '방향을 돌렸어요',
    translucentOn: '반투명으로 보여요',
    translucentOff: '불투명으로 보여요',
    cleared: '모두 뺐어요',
  },
} as const;
