/**
 * 사진 늘리기에 쓰는 단순한 강아지 얼굴 그림(SVG 도형 조합, 외부 파일 없음).
 * 처음 크기(base) 비율의 틀에서 원·타원으로 그린 뒤, 가로·세로를 따로 늘려 그린다.
 * 그래서 가로·세로가 같은 비율로 늘지 않으면 눈이 타원이 되는 것처럼 모양이 찌그러져 보인다.
 */
import type { Size } from './types';

export interface PictureProps {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly base: Size;
}

export function Picture({ x, y, width, height, base }: PictureProps) {
  const frameW = base.w * 100;
  const frameH = base.h * 100;
  const m = Math.min(frameW, frameH);
  const cx = frameW / 2;
  const cy = frameH / 2;
  const line = { vectorEffect: 'non-scaling-stroke', strokeWidth: 2 } as const;
  return (
    <g
      transform={`translate(${x} ${y}) scale(${width / frameW} ${height / frameH})`}
      data-part="picture"
    >
      <rect width={frameW} height={frameH} fill="#fff3d9" stroke="#8a6a3a" {...line} />
      <ellipse
        cx={cx - 0.3 * m}
        cy={cy - 0.22 * m}
        rx={0.11 * m}
        ry={0.2 * m}
        fill="#7a4a22"
        stroke="#4a2a12"
        {...line}
      />
      <ellipse
        cx={cx + 0.3 * m}
        cy={cy - 0.22 * m}
        rx={0.11 * m}
        ry={0.2 * m}
        fill="#7a4a22"
        stroke="#4a2a12"
        {...line}
      />
      <ellipse
        cx={cx}
        cy={cy + 0.04 * m}
        rx={0.34 * m}
        ry={0.34 * m}
        fill="#f3d3a4"
        stroke="#4a2a12"
        {...line}
      />
      <ellipse cx={cx - 0.12 * m} cy={cy - 0.04 * m} rx={0.05 * m} ry={0.05 * m} fill="#1d2330" />
      <ellipse cx={cx + 0.12 * m} cy={cy - 0.04 * m} rx={0.05 * m} ry={0.05 * m} fill="#1d2330" />
      <ellipse cx={cx} cy={cy + 0.1 * m} rx={0.07 * m} ry={0.05 * m} fill="#1d2330" />
      <path
        d={`M ${cx - 0.09 * m} ${cy + 0.17 * m} Q ${cx} ${cy + 0.26 * m} ${cx + 0.09 * m} ${cy + 0.17 * m}`}
        fill="none"
        stroke="#4a2a12"
        {...line}
      />
      <ellipse cx={cx} cy={cy + 0.22 * m} rx={0.04 * m} ry={0.05 * m} fill="#e8707a" />
    </g>
  );
}
