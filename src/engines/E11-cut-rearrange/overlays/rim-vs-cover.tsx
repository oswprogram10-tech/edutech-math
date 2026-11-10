/**
 * 힌트 ② `rim-vs-cover`: 원 둘레를 굵은 실선으로, 원 안을 반지름 1에 해당하는
 * 화면 길이 격자로 그린다. 칸 개수·수 값은 쓰지 않는다.
 */
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import { CIRCLE_CENTER, CIRCLE_RADIUS, rimGridLines } from '../circle-sectors/layout';
import { cutStrings as S } from '../strings.ko';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import type { CutConfig, CutState } from '../types';

const ORANGE = '#e8872e';
const CLIP_ID = 'rim-vs-cover-clip';

export function RimVsCoverOverlay({ state }: OverlayProps<CutConfig, CutState>) {
  if (state.mode !== 'circle-sectors') {
    return (
      <CanvasAlignedOverlay
        testId="rim-vs-cover"
        canvasSelector={'svg[data-testid="cut-canvas"]'}
        logicalWidth={LOGICAL_WIDTH}
        logicalHeight={LOGICAL_HEIGHT}
      >
        <title>{S.overlays.rimVsCover}</title>
      </CanvasAlignedOverlay>
    );
  }

  const { vertical, horizontal } = rimGridLines(state.settings.radius);

  return (
    <CanvasAlignedOverlay
      testId="rim-vs-cover"
      canvasSelector={'svg[data-testid="cut-canvas"]'}
      logicalWidth={LOGICAL_WIDTH}
      logicalHeight={LOGICAL_HEIGHT}
    >
      <defs>
        <clipPath id={CLIP_ID}>
          <circle cx={CIRCLE_CENTER.x} cy={CIRCLE_CENTER.y} r={CIRCLE_RADIUS - 1} />
        </clipPath>
      </defs>
      <rect width={LOGICAL_WIDTH} height={LOGICAL_HEIGHT} fill="none" stroke="none" />
      <g clipPath={`url(#${CLIP_ID})`} stroke={ORANGE} strokeWidth={1.6} strokeOpacity={0.55}>
        {vertical.map((x, index) => (
          <line
            key={`rim-v-${index}`}
            x1={x}
            y1={CIRCLE_CENTER.y - CIRCLE_RADIUS}
            x2={x}
            y2={CIRCLE_CENTER.y + CIRCLE_RADIUS}
          />
        ))}
        {horizontal.map((y, index) => (
          <line
            key={`rim-h-${index}`}
            x1={CIRCLE_CENTER.x - CIRCLE_RADIUS}
            y1={y}
            x2={CIRCLE_CENTER.x + CIRCLE_RADIUS}
            y2={y}
          />
        ))}
      </g>
      <circle
        cx={CIRCLE_CENTER.x}
        cy={CIRCLE_CENTER.y}
        r={CIRCLE_RADIUS}
        fill="none"
        stroke={ORANGE}
        strokeWidth={9}
        strokeOpacity={0.8}
      />
      <title>{S.overlays.rimVsCover}</title>
    </CanvasAlignedOverlay>
  );
}
