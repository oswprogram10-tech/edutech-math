/**
 * E19 outlier 판(논리 1000×600 SVG). 수직선 위 점들 가운데 ◆ 하나를 끌면 평균선이 따라 움직인다.
 * 예측이 필요한 설정(predict)이면 예측을 잠그기 전에는 끌기도 평균선도 없다(평균 값은 그때까지 화면에 없다).
 * 끌기 도중 값은 지역 미리보기이고, 손을 뗄 때 set-value Action 한 번을 보낸다.
 */
import { useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent } from 'react';
import { pointerToLogical, useDrag } from '../../core/engine-sdk';
import { Rational } from '../../core/math';
import { meanOf } from './observe';
import {
  AXIS,
  OUTLIER,
  anchorAt,
  axisX,
  dotY,
  formatValue,
  stackIndex,
  tickValues,
  valueFromX,
} from './layout';
import { E19_STRINGS as S } from './strings.ko';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from './types';
import type { OutlierState } from './types';
import type { ChanceUi } from './useChanceUi';

const INK = '#1d2330';
const LOGICAL = { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT };
const DIAMOND = 24;

interface Props {
  readonly state: OutlierState;
  readonly ui: ChanceUi;
  readonly readOnly: boolean;
  readonly svgStyle: CSSProperties | undefined;
  readonly className: string | undefined;
}

export function OutlierBoard({ state, ui, readOnly, svgStyle, className }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [preview, setPreview] = useState<number | null>(null);
  const [focused, setFocused] = useState(false);
  const waiting = state.requirePrediction && state.prediction === null;
  const lineShown = !waiting;

  const drag = useDrag({
    disabled: readOnly || waiting,
    getPoint: (event) => pointerToLogical(event, svgRef.current, LOGICAL),
    onStart: (info) => setPreview(valueFromX(state, info.current.x)),
    onMove: (info) => setPreview(valueFromX(state, info.current.x)),
    onEnd: (info) => {
      setPreview(null);
      const value = valueFromX(state, info.current.x);
      if (value !== state.values[state.dragIndex]) ui.send({ type: 'set-value', value });
    },
    onCancel: () => setPreview(null),
  });

  const values = state.values.map((v, i) =>
    i === state.dragIndex && preview !== null ? preview : v,
  );
  const mean = meanOf(values);
  const initial = meanOf(state.data);
  const meanX = axisX(state.min, state.max, mean);
  const initialX = axisX(state.min, state.max, initial);
  const prediction = state.prediction === null ? null : Rational.parse(state.prediction);
  const predictionX = prediction === null ? null : axisX(state.min, state.max, prediction);

  const onPointerDown = (event: PointerEvent<Element>) => {
    if (waiting && !readOnly) {
      ui.tell(S.outlier.rejected.locked);
      return;
    }
    drag.handlers.onPointerDown(event);
  };
  const onKeyDown = (event: ReactKeyboardEvent<SVGGElement>) => {
    if (event.ctrlKey || event.metaKey || event.altKey || readOnly) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') ui.nudgeValue(-1);
    else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') ui.nudgeValue(1);
    else return;
    event.preventDefault();
  };

  const dragLevel = stackIndex(values, state.dragIndex);
  const dragValue = values[state.dragIndex] ?? 0;
  const dragX = axisX(state.min, state.max, dragValue);
  const dragY = dotY(dragLevel);

  return (
    <svg
      ref={svgRef}
      className={className}
      style={{ ...svgStyle, touchAction: 'none' }}
      viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`}
      role="group"
      aria-label={S.outlier.boardLabel}
      data-testid="chance-canvas"
      data-mode="outlier"
      data-locked={waiting ? 'true' : 'false'}
      data-dragged={state.dragged ? 'true' : 'false'}
    >
      <rect width={LOGICAL_WIDTH} height={LOGICAL_HEIGHT} fill="#fbfcff" />
      {state.label !== '' ? (
        <text x={AXIS.left} y={52} fontSize={26} fontWeight={800} fill={INK}>
          {state.label}
        </text>
      ) : null}
      <line
        x1={AXIS.left - 20}
        y1={AXIS.y}
        x2={AXIS.right + 20}
        y2={AXIS.y}
        stroke={INK}
        strokeWidth={4}
      />
      {tickValues(state.min, state.max).map((value) => {
        const x = axisX(state.min, state.max, value);
        return (
          <g key={value} data-part="tick" data-value={value}>
            <line x1={x} y1={AXIS.y} x2={x} y2={AXIS.y + 10} stroke={INK} strokeWidth={2} />
            <text
              x={x}
              y={AXIS.y + 34}
              textAnchor="middle"
              fontSize={18}
              fontWeight={700}
              fill={INK}
            >
              {value}
            </text>
          </g>
        );
      })}

      {lineShown ? (
        <g data-part="initial-mean" data-x={initialX.toFixed(2)}>
          <line
            x1={initialX}
            y1={OUTLIER.lineTop}
            x2={initialX}
            y2={OUTLIER.lineBottom}
            stroke="#5b6577"
            strokeOpacity={0.45}
            strokeWidth={3}
            strokeDasharray="3 7"
          />
          <text
            x={initialX}
            y={AXIS.y + 78}
            textAnchor={anchorAt(initialX)}
            fontSize={18}
            fontWeight={700}
            fill="#3d485c"
          >
            {S.outlier.initialMeanLabel}
          </text>
        </g>
      ) : null}

      {prediction !== null && predictionX !== null ? (
        <g data-part="prediction" data-x={predictionX.toFixed(2)}>
          <line
            x1={predictionX}
            y1={160}
            x2={predictionX}
            y2={OUTLIER.lineBottom}
            stroke="#7a3fb0"
            strokeWidth={3}
            strokeDasharray="2 6"
          />
          <polygon
            points={`${predictionX - 11},${AXIS.y + 52} ${predictionX + 11},${AXIS.y + 52} ${predictionX},${AXIS.y + 36}`}
            fill="#7a3fb0"
          />
          <text
            x={predictionX}
            y={150}
            textAnchor={anchorAt(predictionX)}
            fontSize={20}
            fontWeight={800}
            fill="#5a2a86"
            stroke="#fbfcff"
            strokeWidth={5}
            paintOrder="stroke"
          >
            {S.outlier.predictedText(formatValue(prediction))}
          </text>
        </g>
      ) : null}

      {values.map((value, index) => {
        if (index === state.dragIndex) return null;
        const x = axisX(state.min, state.max, value);
        return (
          <circle
            key={index}
            data-part="point"
            data-value={value}
            cx={x}
            cy={dotY(stackIndex(values, index))}
            r={OUTLIER.dotR}
            fill="#9cc3ff"
            stroke="#2f6fde"
            strokeWidth={3}
          />
        );
      })}

      {lineShown ? (
        <g data-part="mean-line" data-x={meanX.toFixed(2)}>
          <line
            x1={meanX}
            y1={OUTLIER.lineTop}
            x2={meanX}
            y2={OUTLIER.lineBottom}
            stroke="#c0392b"
            strokeWidth={4}
            strokeDasharray="10 6"
          />
          <text
            data-part="mean-label"
            x={meanX}
            y={OUTLIER.lineTop - 14}
            textAnchor={anchorAt(meanX)}
            fontSize={24}
            fontWeight={800}
            fill="#8f2a1f"
            stroke="#fbfcff"
            strokeWidth={5}
            paintOrder="stroke"
          >
            {`${S.outlier.meanLabel} ${formatValue(mean)}`}
          </text>
        </g>
      ) : null}

      <g
        data-part="drag-point"
        data-index={state.dragIndex}
        data-value={dragValue}
        data-x={dragX.toFixed(2)}
        role="slider"
        tabIndex={readOnly ? -1 : 0}
        aria-label={S.outlier.pointLabel(state.names[state.dragIndex] ?? '', dragValue)}
        aria-valuemin={state.min}
        aria-valuemax={state.max}
        aria-valuenow={dragValue}
        aria-disabled={waiting ? 'true' : undefined}
        style={{ cursor: readOnly || waiting ? 'default' : 'grab' }}
        onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onPointerDown={onPointerDown}
        onPointerMove={drag.handlers.onPointerMove}
        onPointerUp={drag.handlers.onPointerUp}
        onPointerCancel={drag.handlers.onPointerCancel}
      >
        <circle cx={dragX} cy={dragY} r={42} fill="transparent" data-part="drag-hit" />
        <polygon
          points={`${dragX},${dragY - DIAMOND} ${dragX + DIAMOND},${dragY} ${dragX},${dragY + DIAMOND} ${dragX - DIAMOND},${dragY}`}
          fill="#ffd9a8"
          stroke={INK}
          strokeWidth={focused ? 6 : 3.5}
          strokeDasharray={focused ? '9 5' : undefined}
        />
        <text
          x={dragX}
          y={dragY - DIAMOND - 12}
          textAnchor={anchorAt(dragX)}
          fontSize={20}
          fontWeight={800}
          fill={INK}
          stroke="#fbfcff"
          strokeWidth={5}
          paintOrder="stroke"
          data-part="drag-hint"
        >
          {S.outlier.dragHint}
        </text>
      </g>
    </svg>
  );
}
