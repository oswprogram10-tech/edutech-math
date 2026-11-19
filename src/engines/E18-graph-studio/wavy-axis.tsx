/**
 * 물결선(축 자름) 그림. line-graph와 distortion이 같이 쓴다.
 *
 * 세로축 맨 아래 한 칸(`unit`)의 35%~65% 자리를 비우고 그 두 끝에 지그재그를 그린다.
 * 축 선도 이 자리에서 끊는다.
 */

/** 지그재그 한 줄의 점 목록. */
function zigzag(x: number, y: number): string {
  const half = 7;
  const points = [0, 1, 2, 3, 4].map(
    (step) => `${x - 14 + step * half},${y + (step % 2 === 0 ? 0 : -6)}`,
  );
  return points.join(' ');
}

interface WavyAxisBreakProps {
  /** 세로축 선의 x. */
  readonly x: number;
  /** 세로축 맨 위 y. */
  readonly top: number;
  /** 세로축 맨 아래 y(0 눈금). */
  readonly bottom: number;
  /** 눈금 한 칸의 높이. */
  readonly unit: number;
  readonly ink: string;
  readonly testId: string;
}

export function WavyAxisBreak({ x, top, bottom, unit, ink, testId }: WavyAxisBreakProps) {
  return (
    <>
      <line x1={x} x2={x} y1={bottom} y2={bottom - unit * 0.35} stroke={ink} strokeWidth={3} />
      <line x1={x} x2={x} y1={bottom - unit * 0.65} y2={top} stroke={ink} strokeWidth={3} />
      <g data-testid={testId} data-wavy="true" fill="none" stroke={ink} strokeWidth={3}>
        <polyline points={zigzag(x, bottom - unit * 0.35)} />
        <polyline points={zigzag(x, bottom - unit * 0.65)} />
      </g>
    </>
  );
}
