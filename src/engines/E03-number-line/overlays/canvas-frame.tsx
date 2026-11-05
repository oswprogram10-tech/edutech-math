/**
 * 본 수직선 svg 자리에 맞춘 오버레이 svg.
 * 위치 측정은 `use-canvas-frame`이 맡는다.
 */
import type { CSSProperties, ReactNode } from 'react';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import { useCanvasFrame } from './use-canvas-frame';

interface CanvasAlignedOverlayProps {
  readonly testId: string;
  readonly children: ReactNode;
}

/**
 * 본 수직선 svg 자리에 맞춘 오버레이 svg.
 * 본 svg를 찾지 못하면(엔진을 숨긴 과제의 힌트 칸) 예전처럼 칸 전체에 펼친다.
 */
export function CanvasAlignedOverlay({ testId, children }: CanvasAlignedOverlayProps) {
  const { hostRef, frame } = useCanvasFrame();
  const box: CSSProperties = frame
    ? {
        position: 'absolute',
        left: frame.left,
        top: frame.top,
        width: frame.width,
        height: frame.height,
      }
    : { position: 'absolute', inset: 0 };
  return (
    <div ref={hostRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <div style={box}>
        <svg
          viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`}
          width="100%"
          height="100%"
          data-testid={testId}
          aria-hidden="true"
          style={{ display: 'block' }}
        >
          {children}
        </svg>
      </div>
    </div>
  );
}
