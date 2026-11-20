/**
 * 힌트 ② growth-arrows (MC-RATIO-ADDITIVE).
 * 가로·세로 변에 "+d" 화살표를 그리고, 처음 길이에 대한 늘어난 정도 막대(가로 d/w0, 세로 d/h0 길이)를
 * 나란히 보여 준다. 같은 d를 더해도 처음 길이가 달라 늘어난 정도가 다르다. 분수 값 글은 쓰지 않는다.
 */
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import { PANEL, PIC, pictureRect } from '../layout';
import { E20_STRINGS as S } from '../strings.ko';
import { CANVAS_SELECTOR, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import type { RatioConfig, RatioState } from '../types';

const AMBER = '#8a4b00';
/** 처음 길이 1에 해당하는 막대 길이(논리 px)와 막대 최대 길이. */
const UNIT = 110;
const MAX_BAR = 270;

function Arrow({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  const length = Math.hypot(x2 - x1, y2 - y1);
  const ux = (x2 - x1) / length;
  const uy = (y2 - y1) / length;
  const head = 12;
  const wing = 8;
  const hx = x2 - ux * head;
  const hy = y2 - uy * head;
  return (
    <g stroke={AMBER} fill={AMBER}>
      <line x1={x1} y1={y1} x2={hx} y2={hy} strokeWidth={5} />
      <polygon
        points={`${x2},${y2} ${hx - uy * wing},${hy + ux * wing} ${hx + uy * wing},${hy - ux * wing}`}
        strokeWidth={1}
      />
    </g>
  );
}

export function GrowthArrowsOverlay({ state }: OverlayProps<RatioConfig, RatioState>) {
  if (state.mode !== 'resize' || state.error !== null) return null;
  const { size, base } = state;
  const dw = size.w - base.w;
  const dh = size.h - base.h;
  if (dw < 1 && dh < 1) return null;
  const r = pictureRect(size);
  const barX = PANEL.x;
  const bars = [
    { key: 'w', d: dw, per: base.w, y: 536 },
    { key: 'h', d: dh, per: base.h, y: 566 },
  ];
  return (
    <CanvasAlignedOverlay
      testId="overlay-growth-arrows"
      canvasSelector={CANVAS_SELECTOR}
      logicalWidth={LOGICAL_WIDTH}
      logicalHeight={LOGICAL_HEIGHT}
    >
      {dw >= 1 ? (
        <g data-part="arrow-w">
          <Arrow x1={r.x + base.w * r.cell} y1={PIC.y0 - 18} x2={r.x + r.w} y2={PIC.y0 - 18} />
          <text
            x={r.x + (base.w * r.cell + r.w) / 2}
            y={PIC.y0 - 28}
            textAnchor="middle"
            fontSize={22}
            fontWeight={900}
            fill={AMBER}
          >
            {S.resize.overlay.addArrow(dw)}
          </text>
        </g>
      ) : null}
      {dh >= 1 ? (
        <g data-part="arrow-h">
          <Arrow
            x1={r.x + r.w + 18}
            y1={r.y + base.h * r.cell}
            x2={r.x + r.w + 18}
            y2={r.y + r.h}
          />
          <text
            x={r.x + r.w + 30}
            y={r.y + (base.h * r.cell + r.h) / 2}
            dominantBaseline="central"
            fontSize={22}
            fontWeight={900}
            fill={AMBER}
          >
            {S.resize.overlay.addArrow(dh)}
          </text>
        </g>
      ) : null}
      <rect
        x={PANEL.x - 10}
        y={506}
        width={PANEL.w}
        height={84}
        rx={10}
        fill="#fffdf6"
        fillOpacity={0.95}
        stroke={AMBER}
        strokeWidth={2.5}
        strokeDasharray="8 5"
        data-part="bars-panel"
      />
      {bars.map((bar) => {
        const length = Math.min(MAX_BAR, Math.max(0, (bar.d / bar.per) * UNIT));
        return (
          <g key={bar.key} data-part={`bar-${bar.key}`} data-length={length.toFixed(2)}>
            <rect
              x={barX}
              y={bar.y - 12}
              width={length}
              height={20}
              fill={AMBER}
              fillOpacity={0.85}
            />
            <text
              x={barX + length + 8}
              y={bar.y}
              dominantBaseline="central"
              fontSize={20}
              fontWeight={800}
              fill={AMBER}
            >
              {bar.key === 'w' ? S.resize.tableWidth : S.resize.tableHeight}
            </text>
          </g>
        );
      })}
      <line
        x1={barX + UNIT}
        y1={518}
        x2={barX + UNIT}
        y2={582}
        stroke="#1d2330"
        strokeWidth={2}
        strokeDasharray="4 4"
      />
    </CanvasAlignedOverlay>
  );
}
