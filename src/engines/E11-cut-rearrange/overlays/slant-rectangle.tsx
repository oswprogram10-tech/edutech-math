/**
 * 힌트 ② `slant-rectangle` (MC-AREA-SLANT-SIDE).
 *
 * 처음 도형이 수평 밑변이 있는 평행사변형일 때만, 밑변 × 옆변 길이 직사각형을
 * 반투명으로 겹치고 평행사변형 밖으로 남는 부분에 빗금을 친다.
 * 완성된 정답 도형은 그리지 않는다.
 */
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import { pointsAttribute, slantRectangle } from '../layout';
import { cutStrings as S } from '../strings.ko';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import type { CutConfig, CutState } from '../types';

const ORANGE = '#e8872e';

export function SlantRectangleOverlay({ state }: OverlayProps<CutConfig, CutState>) {
  if (state.mode === 'angle-gather') return null;
  const initial = state.settings.initial[0];
  if (!initial) return null;
  const shape = slantRectangle(initial);
  if (!shape) return null;

  return (
    <CanvasAlignedOverlay
      testId="slant-rectangle"
      canvasSelector={'svg[data-testid="cut-canvas"]'}
      logicalWidth={LOGICAL_WIDTH}
      logicalHeight={LOGICAL_HEIGHT}
    >
      <defs>
        <pattern id="slant-hatch" patternUnits="userSpaceOnUse" width={18} height={18}>
          <path
            d="M 0 18 L 18 0"
            stroke={ORANGE}
            strokeWidth={2.5}
            strokeOpacity={0.7}
            fill="none"
          />
        </pattern>
        <mask id="slant-outside">
          <rect width={LOGICAL_WIDTH} height={LOGICAL_HEIGHT} fill="#ffffff" />
          <polygon points={pointsAttribute(shape.parallelogram)} fill="#000000" />
        </mask>
      </defs>

      <polygon
        points={pointsAttribute(shape.parallelogram)}
        fill={ORANGE}
        fillOpacity={0.12}
        stroke={ORANGE}
        strokeWidth={3.5}
        strokeDasharray="12 7"
        strokeLinejoin="round"
      />
      <rect
        x={shape.rect.x}
        y={shape.rect.y}
        width={shape.rect.width}
        height={shape.rect.height}
        fill="none"
        stroke={ORANGE}
        strokeWidth={6}
        strokeOpacity={0.85}
        data-slant-rectangle="true"
      />
      <rect
        x={shape.rect.x}
        y={shape.rect.y}
        width={shape.rect.width}
        height={shape.rect.height}
        fill="url(#slant-hatch)"
        mask="url(#slant-outside)"
      />
      <title>{S.overlays.slantRectangle}</title>
    </CanvasAlignedOverlay>
  );
}
