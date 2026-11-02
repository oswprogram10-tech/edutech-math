/**
 * 힌트 ②: 올가미 제스처를 안내하는 레이어.
 * 어떤 셈돌을 묶어야 하는지는 보여 주지 않는다(정답 노출 금지).
 */
import { demoStrings } from '../strings.ko';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';

export function LassoGuideOverlay() {
  return (
    <svg
      viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`}
      width="100%"
      height="100%"
      data-testid="overlay-lasso-guide"
      aria-hidden="true"
    >
      <circle
        cx={840}
        cy={110}
        r={72}
        fill="none"
        stroke="#e08a1e"
        strokeWidth={6}
        strokeDasharray="16 12"
      />
      <text x={840} y={215} fill="#8a5a10" fontSize={24} textAnchor="middle" fontWeight={600}>
        {demoStrings.lassoGuide}
      </text>
    </svg>
  );
}
