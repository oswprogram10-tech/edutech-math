/**
 * 힌트 ② meter-100 (MC-LENGTH-UNIT-MIX). 판 위쪽에 1m 줄자를 100칸으로 펼쳐 그린다. 10칸마다 굵은 선이고
 * 10·20…100 숫자를 쓰며 "1m" 이름표를 단다. 과제 값과 상관없는 고정 그림이다.
 * length(합체 규칙)·unit-train 두 판에서 같은 위쪽 자리(0~100px)에 그린다.
 */
import { CanvasAlignedOverlay } from '../../../../core/engine-sdk';
import { E13_STRINGS as S } from '../../strings.ko';

const INK = '#1d2330';
const ORANGE = '#e8872e';
const LOGICAL = { width: 1000, height: 600 } as const;
const BAR = { left: 60, width: 880, top: 34, height: 28 } as const;
const CELL = BAR.width / 100;

export interface Meter100Props {
  readonly canvasSelector: string;
}

export function Meter100({ canvasSelector }: Meter100Props) {
  return (
    <CanvasAlignedOverlay
      testId="overlay-meter-100"
      canvasSelector={canvasSelector}
      logicalWidth={LOGICAL.width}
      logicalHeight={LOGICAL.height}
    >
      <rect
        data-part="meter-bar"
        x={BAR.left}
        y={BAR.top}
        width={BAR.width}
        height={BAR.height}
        fill="#fff6c9"
        stroke={INK}
        strokeWidth={3}
      />
      {Array.from({ length: 99 }, (_, i) => {
        const n = i + 1;
        const thick = n % 10 === 0;
        const x = BAR.left + n * CELL;
        return (
          <line
            key={n}
            data-part={thick ? 'tick-10' : 'tick-1'}
            x1={x}
            y1={BAR.top}
            x2={x}
            y2={BAR.top + (thick ? BAR.height + 8 : BAR.height * 0.55)}
            stroke={thick ? INK : '#7a8497'}
            strokeWidth={thick ? 4 : 1.5}
          />
        );
      })}
      {Array.from({ length: 10 }, (_, i) => {
        const n = (i + 1) * 10;
        return (
          <text
            key={n}
            data-part="tick-number"
            x={BAR.left + n * CELL}
            y={BAR.top + BAR.height + 28}
            textAnchor="middle"
            fontSize={20}
            fontWeight={800}
            fill={INK}
            stroke="#ffffff"
            strokeWidth={4}
            paintOrder="stroke"
          >
            {n}
          </text>
        );
      })}
      <text
        data-part="label"
        x={BAR.left}
        y={BAR.top - 10}
        fontSize={28}
        fontWeight={800}
        fill="#8a4b00"
        stroke="#ffffff"
        strokeWidth={6}
        paintOrder="stroke"
      >
        {S.overlay.meter100}
      </text>
      <rect
        x={BAR.left - 4}
        y={BAR.top - 4}
        width={BAR.width + 8}
        height={BAR.height + 8}
        fill="none"
        stroke={ORANGE}
        strokeWidth={3}
        strokeDasharray="10 6"
      />
    </CanvasAlignedOverlay>
  );
}
