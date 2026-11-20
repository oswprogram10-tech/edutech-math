/**
 * E19 seesaw 판(논리 1000×600 SVG). 수직선 판자 위에 자료 값마다 추를 놓고(같은 값은 위로 쌓기),
 * 아래의 삼각형 받침점을 끌어 판자가 기우는 모습을 본다. 끌기는 step 격자에 붙고 손을 뗄 때 Action 한 번을 보낸다.
 * 기울기는 돌림힘 합 Σ(x − f)의 부호로, 각도는 4° + 8° × min(1, |Σ| / (n × (max − min)))다.
 */
import { useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { pointerToLogical, useDrag } from '../../core/engine-sdk';
import { Rational } from '../../core/math';
import {
  AXIS,
  SEESAW,
  axisX,
  formatPoint,
  nearestFulcrum,
  plankAngle,
  stackIndex,
  tickValues,
} from './layout';
import { tiltOf, torqueOf } from './observe';
import { E19_STRINGS as S } from './strings.ko';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from './types';
import type { SeesawState } from './types';
import type { ChanceUi } from './useChanceUi';

const INK = '#1d2330';
const LOGICAL = { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT };

interface Props {
  readonly state: SeesawState;
  readonly ui: ChanceUi;
  readonly readOnly: boolean;
  readonly svgStyle: CSSProperties | undefined;
  readonly className: string | undefined;
}

export function SeesawBoard({ state, ui, readOnly, svgStyle, className }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [preview, setPreview] = useState<Rational | null>(null);
  const [focused, setFocused] = useState(false);

  const drag = useDrag({
    disabled: readOnly,
    getPoint: (event) => pointerToLogical(event, svgRef.current, LOGICAL),
    onStart: (info) => setPreview(nearestFulcrum(state, info.current.x)),
    onMove: (info) => setPreview(nearestFulcrum(state, info.current.x)),
    onEnd: (info) => {
      setPreview(null);
      const value = nearestFulcrum(state, info.current.x);
      if (value.toString() !== state.fulcrum)
        ui.send({ type: 'set-fulcrum', value: value.toString() });
    },
    onCancel: () => setPreview(null),
  });

  const fulcrum = preview ?? Rational.parse(state.fulcrum);
  const torque = torqueOf(state.data, fulcrum);
  const tilt = tiltOf(state.data, fulcrum);
  const angle = plankAngle(
    tilt === 'left' ? -1 : tilt === 'right' ? 1 : 0,
    torque,
    state.data.length,
    state.min,
    state.max,
  );
  const fx = axisX(state.min, state.max, fulcrum);
  const py = SEESAW.plankY;
  const half = SEESAW.plankHalf;

  const onKeyDown = (event: ReactKeyboardEvent<SVGGElement>) => {
    if (event.ctrlKey || event.metaKey || event.altKey || readOnly) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') ui.nudgeFulcrum(-1);
    else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') ui.nudgeFulcrum(1);
    else return;
    event.preventDefault();
  };

  return (
    <svg
      ref={svgRef}
      className={className}
      style={{ ...svgStyle, touchAction: 'none' }}
      viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`}
      role="group"
      aria-label={S.seesaw.boardLabel}
      data-testid="chance-canvas"
      data-mode="seesaw"
      data-tilt={tilt}
      data-moves={state.moves}
    >
      <rect width={LOGICAL_WIDTH} height={LOGICAL_HEIGHT} fill="#fbfcff" />
      {state.label !== '' ? (
        <text x={AXIS.left} y={52} fontSize={26} fontWeight={800} fill={INK}>
          {state.label}
        </text>
      ) : null}
      <line
        x1={AXIS.left - 20}
        y1={py + half + SEESAW.triangleH}
        x2={AXIS.right + 20}
        y2={py + half + SEESAW.triangleH}
        stroke="#7d8aa3"
        strokeWidth={4}
      />
      <g
        transform={`rotate(${angle} ${fx} ${py})`}
        data-part="plank-group"
        data-angle={angle.toFixed(2)}
      >
        <rect
          data-part="plank"
          x={AXIS.left - 20}
          y={py - half}
          width={AXIS.right - AXIS.left + 40}
          height={half * 2}
          rx={4}
          fill="#efe1c2"
          stroke="#8a6a2f"
          strokeWidth={3}
        />
        {tickValues(state.min, state.max).map((value) => {
          const x = axisX(state.min, state.max, value);
          return (
            <g key={value} data-part="tick" data-value={value}>
              <line
                x1={x}
                y1={py - half}
                x2={x}
                y2={py - half + 6}
                stroke="#8a6a2f"
                strokeWidth={2}
              />
              <text x={x} y={py + 7} textAnchor="middle" fontSize={16} fontWeight={700} fill={INK}>
                {value}
              </text>
            </g>
          );
        })}
        {state.data.map((value, index) => {
          const x = axisX(state.min, state.max, value);
          const level = stackIndex(state.data, index);
          const top =
            py - half - (level + 1) * (SEESAW.weightH + SEESAW.weightGap) + SEESAW.weightGap;
          return (
            <g key={index} data-part="weight" data-value={value} data-x={x.toFixed(2)}>
              <rect
                x={x - SEESAW.weightW / 2}
                y={top}
                width={SEESAW.weightW}
                height={SEESAW.weightH}
                rx={5}
                fill="#9cc3ff"
                stroke="#2f6fde"
                strokeWidth={2.5}
              />
            </g>
          );
        })}
      </g>
      <g
        data-part="fulcrum"
        data-x={fx.toFixed(2)}
        data-value={fulcrum.toString()}
        role="slider"
        tabIndex={readOnly ? -1 : 0}
        aria-label={S.seesaw.fulcrumLabel}
        aria-orientation="horizontal"
        aria-valuemin={state.min}
        aria-valuemax={state.max}
        aria-valuenow={Number(fulcrum.n) / Number(fulcrum.d)}
        aria-valuetext={formatPoint(fulcrum)}
        style={{ cursor: readOnly ? 'default' : 'grab' }}
        onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...drag.handlers}
      >
        <circle
          cx={fx}
          cy={py + half + SEESAW.triangleH / 2}
          r={46}
          fill="transparent"
          data-part="fulcrum-hit"
        />
        <polygon
          points={`${fx},${py + half} ${fx - 36},${py + half + SEESAW.triangleH} ${fx + 36},${py + half + SEESAW.triangleH}`}
          fill="#ffd9a8"
          stroke={INK}
          strokeWidth={focused ? 6 : 3}
          strokeDasharray={focused ? '10 5' : undefined}
        />
        <text
          data-part="fulcrum-value"
          x={fx}
          y={py + half + SEESAW.triangleH + 44}
          textAnchor="middle"
          fontSize={24}
          fontWeight={800}
          fill={INK}
        >
          {S.seesaw.fulcrumText(formatPoint(fulcrum))}
        </text>
      </g>
    </svg>
  );
}
