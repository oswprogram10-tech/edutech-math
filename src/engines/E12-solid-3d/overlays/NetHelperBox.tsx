/**
 * `net-fold` 힌트 ② 오버레이용 왼쪽 위 도움 그림 상자.
 * (`HelperDiagramBox.tsx`의 시각 규격을 따르면서 net-fold 3D 그림을 담는다.)
 */
import type { ReactNode } from 'react';
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';

export const NET_OVERLAY_W = 420;
export const NET_OVERLAY_H = 300;
export const NET_CARD_W = 240;
export const NET_CARD_H = 210;
export const NET_CARD_HEADER_H = 34;

interface NetHelperBoxProps {
  readonly testId: string;
  readonly titleTestId: string;
  readonly title: string;
  /** 제목 글자 크기(기본 12.5). 긴 문구를 카드 폭에 맞출 때만 줄인다. */
  readonly titleSize?: number;
  readonly canvasSelector?: string;
  readonly children: ReactNode;
}

export function NetHelperBox({
  testId,
  titleTestId,
  title,
  titleSize = 12.5,
  canvasSelector = 'svg[data-testid="net-grid"], svg[data-testid="net-fold-stage"]',
  children,
}: NetHelperBoxProps) {
  return (
    <CanvasAlignedOverlay
      testId={testId}
      canvasSelector={canvasSelector}
      logicalWidth={NET_OVERLAY_W}
      logicalHeight={NET_OVERLAY_H}
    >
      <g data-testid="cubes-helper-diagram">
        <rect
          x={10}
          y={10}
          width={NET_CARD_W}
          height={NET_CARD_H}
          rx={12}
          fill="#ffffff"
          fillOpacity={0.94}
          stroke="#2f6fde"
          strokeWidth={2}
        />
        <text
          x={20}
          y={32}
          fontSize={titleSize}
          fontWeight={800}
          fill="#1d4fa8"
          data-testid={titleTestId}
        >
          {title}
        </text>
        <g transform={`translate(10, ${10 + NET_CARD_HEADER_H})`}>{children}</g>
      </g>
    </CanvasAlignedOverlay>
  );
}
