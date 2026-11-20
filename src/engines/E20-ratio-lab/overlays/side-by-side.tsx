/**
 * 힌트 ② side-by-side (MC-RATIO-ADDITIVE).
 * 기준 컵과 내 컵의 띠 위 표시를 나란히 크게 그리고, 두 표시 사이에 차이 화살표와 "≠"를 놓는다.
 * 두 컵의 진하기가 같으면 화살표와 ≠는 그리지 않는다. 값(분수)은 쓰지 않는다.
 */
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import { STRIP, stripX } from '../layout';
import { stripPosition } from '../observe';
import { E20_STRINGS as S } from '../strings.ko';
import { CANVAS_SELECTOR, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import type { RatioConfig, RatioState } from '../types';

const INK = '#1d2330';
const TOP = 400;

export function SideBySideOverlay({ state }: OverlayProps<RatioConfig, RatioState>) {
  if (state.mode !== 'mix' || state.error !== null || !state.settings.showStrip) return null;
  if (state.reference === null || !state.settings.hasCup) return null;
  const refPos = stripPosition(state.reference);
  const cupPos = stripPosition(state.cup);
  if (refPos === null || cupPos === null) return null;
  const refX = stripX(refPos);
  const cupX = stripX(cupPos);
  const differs = !refPos.equals(cupPos);
  const mid = (refX + cupX) / 2;
  const dir = cupX >= refX ? 1 : -1;
  return (
    <CanvasAlignedOverlay
      testId="overlay-side-by-side"
      canvasSelector={CANVAS_SELECTOR}
      logicalWidth={LOGICAL_WIDTH}
      logicalHeight={LOGICAL_HEIGHT}
    >
      <rect
        x={STRIP.x - 10}
        y={TOP - 30}
        width={STRIP.w + 20}
        height={STRIP.y - TOP + 26}
        rx={12}
        fill="#fffdf6"
        fillOpacity={0.94}
        stroke="#8a4b00"
        strokeWidth={3}
        strokeDasharray="8 5"
        data-part="panel"
      />
      {[
        { key: 'reference', x: refX, label: S.mix.referenceName, labelY: TOP - 6 },
        { key: 'cup', x: cupX, label: S.mix.cupName, labelY: TOP + 20 },
      ].map((mark) => (
        <g key={mark.key} data-part={`mark-${mark.key}`} data-x={mark.x.toFixed(2)}>
          <line
            x1={mark.x}
            y1={mark.labelY + 6}
            x2={mark.x}
            y2={STRIP.y}
            stroke={INK}
            strokeWidth={4}
          />
          {mark.key === 'reference' ? (
            <polygon
              points={`${mark.x - 16},${TOP + 50} ${mark.x + 16},${TOP + 50} ${mark.x},${TOP + 74}`}
              fill={INK}
            />
          ) : (
            <circle cx={mark.x} cy={TOP + 62} r={14} fill={INK} />
          )}
          <text
            x={mark.x}
            y={mark.labelY}
            textAnchor="middle"
            fontSize={24}
            fontWeight={800}
            fill={INK}
            stroke="#fffdf6"
            strokeWidth={5}
            paintOrder="stroke"
          >
            {mark.label}
          </text>
        </g>
      ))}
      {differs ? (
        <g data-part="difference">
          <line
            x1={refX + dir * 20}
            y1={TOP + 44}
            x2={cupX - dir * 16}
            y2={TOP + 44}
            stroke="#8a4b00"
            strokeWidth={5}
            data-part="gap-arrow"
          />
          <polygon
            points={`${cupX - dir * 12},${TOP + 44} ${cupX - dir * 30},${TOP + 34} ${cupX - dir * 30},${TOP + 54}`}
            fill="#8a4b00"
          />
          <text
            x={mid}
            y={TOP + 38}
            textAnchor="middle"
            fontSize={36}
            fontWeight={900}
            fill="#8a4b00"
            stroke="#fffdf6"
            strokeWidth={5}
            paintOrder="stroke"
            data-part="not-equal"
          >
            {S.mix.overlay.differs}
          </text>
        </g>
      ) : null}
    </CanvasAlignedOverlay>
  );
}
