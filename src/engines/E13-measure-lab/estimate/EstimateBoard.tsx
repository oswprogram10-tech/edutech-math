/**
 * E13 estimate 판(논리 1000×600 SVG). 물건은 고정이고 자가 좌우로 움직인다.
 * 자는 0~25cm, 1cm 큰 눈금과 숫자뿐이다(2학년이라 mm 눈금은 없다).
 * 물건의 길이·끝 눈금은 그림으로만 드러나고 글·data-·aria에는 두지 않는다.
 * 어림 먼저 모드에서 어림을 넣기 전에는 자를 그리지 않는다.
 */
import { useState } from 'react';
import type { CSSProperties, RefObject } from 'react';
import { pointerToLogical, useDrag } from '../../../core/engine-sdk';
import { ObjectShape } from '../length/LengthBoard';
import { num } from '../rat';
import { E13_STRINGS as S } from '../strings.ko';
import {
  BOARD,
  ESTIMATE_BAR,
  OBJECT_H,
  OBJECT_LEFT,
  OBJECT_TOP,
  PPC,
  RULER,
  RULER_WIDTH,
  r2,
  rulerLeft,
} from './layout';
import { rulerHidden } from './settings';
import { MAX_OFFSET_CM, RULER_CM } from './types';
import type { EstimateState } from './types';
import type { EstimateUi } from './useEstimateUi';

const INK = '#1d2330';
const ORANGE = '#e8872e';

interface Props {
  readonly svgRef: RefObject<SVGSVGElement>;
  readonly state: EstimateState;
  readonly ui: EstimateUi;
  readonly locked: boolean;
  readonly svgStyle: CSSProperties | undefined;
  readonly className: string | undefined;
}

function RulerShape({ state, ui, locked, svgRef }: Omit<Props, 'svgStyle' | 'className'>) {
  const [shift, setShift] = useState<number | null>(null);
  const [focused, setFocused] = useState(false);
  const movable = state.draggable && !locked;
  const base = rulerLeft(state);
  const left = base + (shift ?? 0);
  const drag = useDrag({
    disabled: !movable,
    getPoint: (event) => pointerToLogical(event, svgRef.current, BOARD),
    onStart: () => setShift(0),
    onMove: (info) => {
      // 눈금 0~5 밖으로는 끌려가지 않는다(자가 물건 밖으로 사라지지 않게).
      const offset = num(state.rulerOffset);
      const raw = Math.min(Math.max(offset - info.delta.x / PPC, 0), MAX_OFFSET_CM);
      setShift((offset - raw) * PPC);
    },
    onEnd: (info) => {
      setShift(null);
      ui.dropRuler(num(state.rulerOffset) - info.delta.x / PPC);
    },
    onCancel: () => setShift(null),
  });
  return (
    <g
      data-part="ruler"
      role={state.draggable ? 'button' : 'img'}
      tabIndex={movable ? 0 : undefined}
      aria-label={S.estimate.rulerLabel}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onKeyDown={(event) => {
        if (!movable) return;
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault();
          // 자를 왼쪽으로 옮기면 물건 왼쪽 끝이 자의 더 큰 눈금에 놓인다.
          ui.nudge(event.key === 'ArrowLeft' ? 0.5 : -0.5);
        }
      }}
    >
      <rect
        data-part="ruler-body"
        x={r2(left)}
        y={RULER.top}
        width={RULER_WIDTH}
        height={RULER.height}
        rx={6}
        fill="#fff6c9"
        stroke={INK}
        strokeWidth={3}
      />
      {Array.from({ length: RULER_CM + 1 }, (_, cm) => {
        const x = r2(left + cm * PPC);
        return (
          <g key={cm} data-part="ruler-tick">
            <line
              x1={x}
              y1={RULER.top}
              x2={x}
              y2={RULER.top + RULER.tickH}
              stroke={INK}
              strokeWidth={cm === 0 ? 4 : 2.5}
            />
            <text
              x={x}
              y={RULER.numberY}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={20}
              fontWeight={800}
              fill={INK}
            >
              {cm}
            </text>
          </g>
        );
      })}
      {focused ? (
        <rect
          x={r2(left - 4)}
          y={RULER.top - 4}
          width={RULER_WIDTH + 8}
          height={RULER.height + 8}
          rx={8}
          fill="none"
          stroke={ORANGE}
          strokeWidth={4}
          strokeDasharray="8 5"
        />
      ) : null}
      <rect
        data-part="hit"
        x={r2(left)}
        y={RULER.top - 10}
        width={RULER_WIDTH}
        height={RULER.height + 20}
        fill="transparent"
        style={{ cursor: movable ? 'grab' : 'default', touchAction: 'none' }}
        {...drag.handlers}
      />
    </g>
  );
}

/** 내 어림: 물건 왼쪽 끝에서 어림 길이만큼의 점선 막대. 물건 끝과의 차이는 그림으로만 보인다. */
function EstimateBar({ value }: { value: number }) {
  const room = BOARD.width - 40 - OBJECT_LEFT;
  const full = value * PPC;
  const clipped = full > room;
  const width = clipped ? room : full;
  const { top, height } = ESTIMATE_BAR;
  return (
    <g data-part="estimate-bar">
      <rect
        x={OBJECT_LEFT}
        y={top}
        width={r2(width)}
        height={height}
        rx={4}
        fill="rgba(232,135,46,0.18)"
        stroke={ORANGE}
        strokeWidth={4}
        strokeDasharray="10 6"
      />
      {clipped ? (
        <polygon
          points={`${OBJECT_LEFT + width},${top - 6} ${OBJECT_LEFT + width + 22},${top + height / 2} ${OBJECT_LEFT + width},${top + height + 6}`}
          fill={ORANGE}
        />
      ) : null}
      <text
        x={OBJECT_LEFT}
        y={top - 10}
        fontSize={22}
        fontWeight={800}
        fill="#8a4b00"
        stroke="#ffffff"
        strokeWidth={5}
        paintOrder="stroke"
      >
        {S.estimate.myEstimate}
      </text>
    </g>
  );
}

export function EstimateBoard({ svgRef, state, ui, locked, svgStyle, className }: Props) {
  const objectW = num(state.lengthCm) * PPC;
  const hidden = rulerHidden(state);
  const objectEnd = OBJECT_LEFT + objectW;
  return (
    <svg
      ref={svgRef}
      className={className}
      style={{ ...svgStyle, touchAction: 'none' }}
      viewBox={`0 0 ${BOARD.width} ${BOARD.height}`}
      preserveAspectRatio="xMidYMid meet"
      data-testid="estimate-canvas"
      role="group"
      aria-label={S.estimate.boardLabel}
      data-ruler={hidden ? 'hidden' : 'shown'}
    >
      <ObjectShape name={state.objectName} x={OBJECT_LEFT} y={OBJECT_TOP} w={r2(objectW)} />
      {state.estimateLocked && state.estimate !== null ? (
        <EstimateBar value={state.estimate} />
      ) : null}
      {hidden ? (
        <g data-part="ask-first">
          <rect
            x={OBJECT_LEFT}
            y={RULER.top}
            width={RULER_WIDTH}
            height={RULER.height}
            rx={6}
            fill="rgba(255,255,255,0.6)"
            stroke="#7a8497"
            strokeWidth={3}
            strokeDasharray="10 6"
          />
          <text
            x={OBJECT_LEFT + RULER_WIDTH / 2}
            y={RULER.top + RULER.height / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={30}
            fontWeight={800}
            fill={INK}
          >
            {S.estimate.askFirst}
          </text>
        </g>
      ) : (
        <>
          {/* 물건의 양 끝에서 자로 내려오는 안내선(눈금 숫자는 학생이 읽는다). */}
          <g data-part="end-guides" stroke="#7a8497" strokeWidth={2} strokeDasharray="4 6">
            <line x1={OBJECT_LEFT} y1={OBJECT_TOP + OBJECT_H} x2={OBJECT_LEFT} y2={RULER.top} />
            <line x1={r2(objectEnd)} y1={OBJECT_TOP + OBJECT_H} x2={r2(objectEnd)} y2={RULER.top} />
          </g>
          <RulerShape svgRef={svgRef} state={state} ui={ui} locked={locked} />
        </>
      )}
    </svg>
  );
}
