/** sort 오버레이 공용 틀: 본 판(`sorter-canvas`)과 같은 자리·같은 논리 크기(1000×높이)로 맞춘다. */
import type { ReactNode } from 'react';
import { CanvasAlignedOverlay } from '../../../../core/engine-sdk';
import { ArtDefs } from '../art';
import { SORT_WIDTH, sortBoardHeight } from '../layout';

export function SortOverlayFrame({
  testId,
  children,
}: {
  readonly testId: string;
  readonly children: ReactNode;
}) {
  return (
    <CanvasAlignedOverlay
      testId={testId}
      canvasSelector={'svg[data-testid="sorter-canvas"]'}
      logicalWidth={SORT_WIDTH}
      logicalHeight={sortBoardHeight()}
    >
      <ArtDefs />
      {children}
    </CanvasAlignedOverlay>
  );
}
