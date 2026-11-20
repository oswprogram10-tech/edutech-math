/**
 * 힌트 ② span-compare (MC-MEASURE-UNIT-SIZE). demoSpans의 두 뼘을 왼쪽 끝을 맞춰 위아래로 겹쳐 그리고
 * "두 뼘의 크기" 글을 단다. 길이 숫자는 쓰지 않는다. demoSpans가 없으면 그리지 않는다.
 */
import { CanvasAlignedOverlay } from '../../../../core/engine-sdk';
import type { OverlayProps } from '../../../../core/engine-sdk';
import { num } from '../../rat';
import { E13_STRINGS as S } from '../../strings.ko';
import { unitOf } from '../../units';
import { BOARD, DEMO } from '../layout';
import { LENGTH_CANVAS_SELECTOR } from '../types';
import type { LengthConfig, MeasureState } from '../types';

const INK = '#1d2330';
/** 두 뼘을 그리는 배율(논리 px / cm). 가장 긴 뼘(15cm)이 오른쪽 빈 자리에 들어간다. */
const PX_PER_CM = 12;

export function SpanCompareOverlay({ state }: OverlayProps<LengthConfig, MeasureState>) {
  if (state.error !== null || state.demo === null) return null;
  const spans = ['hand-span-a', 'hand-span-b'].map((id) => unitOf(id));
  const x = DEMO.compareX;
  return (
    <CanvasAlignedOverlay
      testId="overlay-span-compare"
      canvasSelector={LENGTH_CANVAS_SELECTOR}
      logicalWidth={BOARD.width}
      logicalHeight={BOARD.height}
    >
      <rect
        data-part="backdrop"
        x={x - 16}
        y={14}
        width={BOARD.width - x - 4}
        height={170}
        rx={12}
        fill="#fffdf6"
        fillOpacity={0.92}
        stroke={INK}
        strokeWidth={2}
      />
      <text data-part="label" x={x} y={44} fontSize={22} fontWeight={800} fill={INK}>
        {S.length.demo.spanCompare}
      </text>
      {spans.map((span, index) =>
        span ? (
          <rect
            key={span.id}
            data-part="span"
            data-unit={span.id}
            x={x}
            y={64 + index * 52}
            width={num(span.cm) * PX_PER_CM}
            height={36}
            rx={6}
            fill={span.fill}
            stroke={span.stroke}
            strokeWidth={4}
          />
        ) : null,
      )}
      <line x1={x} y1={58} x2={x} y2={170} stroke={INK} strokeWidth={3} strokeDasharray="6 5" />
    </CanvasAlignedOverlay>
  );
}
