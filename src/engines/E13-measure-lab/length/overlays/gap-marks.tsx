/**
 * 힌트 ② gap-marks (MC-MEASURE-GAP). 틈마다 빨간 세로 띠와 "틈", 겹침마다 진한 줄무늬와 "겹침"을
 * 크게 다시 그린다. 둘 다 없으면 그리지 않는다. 색만으로 구분하지 않도록 무늬와 글을 함께 쓴다.
 */
import { CanvasAlignedOverlay } from '../../../../core/engine-sdk';
import type { OverlayProps } from '../../../../core/engine-sdk';
import { toNumber } from '../../rat';
import { E13_STRINGS as S } from '../../strings.ko';
import { BAND_H, BOARD, boardHeight, geoOf, xOfCm } from '../layout';
import { analyze } from '../settings';
import { LENGTH_CANVAS_SELECTOR } from '../types';
import type { LengthConfig, MeasureState } from '../types';

const INK = '#1d2330';
const RED = '#c0392b';

export function GapMarksOverlay({ state }: OverlayProps<LengthConfig, MeasureState>) {
  if (state.error !== null) return null;
  const result = analyze(state);
  if (result.gaps.length === 0 && result.overlaps.length === 0) return null;
  const geo = geoOf(state);
  const top = geo.bandTop - 26;
  const height = BAND_H + 52;
  return (
    <CanvasAlignedOverlay
      testId="overlay-gap-marks"
      canvasSelector={LENGTH_CANVAS_SELECTOR}
      logicalWidth={BOARD.width}
      logicalHeight={boardHeight(state)}
    >
      <defs>
        <pattern id="e13-ov-gap-hatch" width={12} height={12} patternUnits="userSpaceOnUse">
          <rect width={12} height={12} fill="#fde8e5" />
          <path d="M-2,2 l4,-4 M0,12 l12,-12 M10,14 l4,-4" stroke={RED} strokeWidth={3} />
        </pattern>
        <pattern id="e13-ov-overlap-stripe" width={10} height={10} patternUnits="userSpaceOnUse">
          <rect width={10} height={10} fill="#7a8497" />
          <path d="M5,0 V10" stroke={INK} strokeWidth={4} />
        </pattern>
      </defs>
      {result.gaps.map((gap, i) => {
        const x = xOfCm(geo, toNumber(gap.from));
        const w = Math.max((toNumber(gap.to) - toNumber(gap.from)) * geo.ppc, 6);
        return (
          <g key={`gap-${i}`} data-part="gap-mark">
            <rect
              x={x}
              y={top}
              width={w}
              height={height}
              fill="url(#e13-ov-gap-hatch)"
              fillOpacity={0.8}
              stroke={RED}
              strokeWidth={5}
            />
            <text
              x={x + w / 2}
              y={top - 10}
              textAnchor="middle"
              fontSize={34}
              fontWeight={800}
              fill={RED}
              stroke="#ffffff"
              strokeWidth={6}
              paintOrder="stroke"
            >
              {S.overlay.gap}
            </text>
          </g>
        );
      })}
      {result.overlaps.map((overlap, i) => {
        const x = xOfCm(geo, toNumber(overlap.from));
        const w = Math.max((toNumber(overlap.to) - toNumber(overlap.from)) * geo.ppc, 6);
        return (
          <g key={`overlap-${i}`} data-part="overlap-mark">
            <rect
              x={x}
              y={top}
              width={w}
              height={height}
              fill="url(#e13-ov-overlap-stripe)"
              fillOpacity={0.85}
              stroke={INK}
              strokeWidth={5}
            />
            <text
              x={x + w / 2}
              y={top - 10}
              textAnchor="middle"
              fontSize={34}
              fontWeight={800}
              fill={INK}
              stroke="#ffffff"
              strokeWidth={6}
              paintOrder="stroke"
            >
              {S.overlay.overlap}
            </text>
          </g>
        );
      })}
    </CanvasAlignedOverlay>
  );
}
