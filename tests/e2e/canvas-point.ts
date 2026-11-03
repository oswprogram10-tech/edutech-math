/**
 * 논리 좌표(기본 1000×600)를 화면 좌표로 바꾼다.
 * 캔버스 SVG는 preserveAspectRatio="xMidYMid meet"라서 상자와 비율이 다르면
 * 작은 쪽 배율로 줄어 가운데에 그려진다. 앱의 pointerToLogical과 같은 계산이다.
 */
export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export function canvasScale(box: Box, logicalWidth = 1000, logicalHeight = 600): number {
  return Math.min(box.width / logicalWidth, box.height / logicalHeight);
}

export function logicalToScreen(
  box: Box,
  x: number,
  y: number,
  logicalWidth = 1000,
  logicalHeight = 600,
): { x: number; y: number } {
  const scale = canvasScale(box, logicalWidth, logicalHeight);
  return {
    x: box.x + (box.width - logicalWidth * scale) / 2 + x * scale,
    y: box.y + (box.height - logicalHeight * scale) / 2 + y * scale,
  };
}
