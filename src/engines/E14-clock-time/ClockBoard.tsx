/**
 * E14 clock 판(논리 1000×600 SVG). 왼쪽에 시계, 켜면 뒤에 톱니, 펼치면 아래에 0~60분 띠.
 * 긴바늘·짧은바늘 모두 끌 수 있다. 끄는 동안은 지역 미리보기로 두 바늘을 함께 돌리고,
 * 손을 뗄 때 허용 분에 맞춘 set-time Action을 한 번 보낸다. 각도는 누적해서 12를 넘어 감아 돈다.
 * 시각 글(디지털 표시)은 digitalReadout:'always'일 때만 그린다. 바늘 aria는 방향만 말한다.
 */
import { useRef, useState } from 'react';
import type { CSSProperties, RefObject } from 'react';
import { pointerToLogical, useDrag } from '../../core/engine-sdk';
import type { DragInfo } from '../../core/engine-sdk';
import {
  CLOCK,
  SIDE,
  STRIP,
  angleDelta,
  dragMinutes,
  gearAngles,
  gearPath,
  handAngles,
  handsSentence,
  longHandSentence,
  numeralPoint,
  pointerAngle,
  polar,
  shortHandSentence,
  stripX,
} from './layout';
import type { DragHand } from './layout';
import { formatTime, snapMinutes } from './settings';
import { E14_STRINGS as S } from './strings.ko';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from './types';
import type { ClockState } from './types';
import type { ClockUi } from './useClockUi';
import styles from './View.module.css';

const INK = '#1d2330';
const BLUE = '#2f6fde';
const LOGICAL = { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT };

interface Props {
  readonly state: ClockState;
  readonly ui: ClockUi;
  readonly readOnly: boolean;
  readonly svgStyle: CSSProperties | undefined;
  readonly className: string | undefined;
}

interface DragRef {
  start: number;
  last: number | null;
  accumulated: number;
}

interface HandDragOptions {
  readonly svgRef: RefObject<SVGSVGElement | null>;
  readonly dragRef: { current: DragRef };
  readonly state: ClockState;
  readonly ui: ClockUi;
  readonly locked: boolean;
  readonly setPreview: (minutes: number | null) => void;
}

/** 각도 변화를 누적해 미리보기 분을 낸다(12를 지나 감아 돈다). */
function track(drag: DragRef, hand: DragHand, info: DragInfo): number {
  const angle = pointerAngle(info.current);
  if (angle !== null) {
    if (drag.last !== null) drag.accumulated += angleDelta(drag.last, angle);
    drag.last = angle;
  }
  return dragMinutes(drag.start, drag.accumulated, hand);
}

/** 바늘 하나를 끄는 훅. 끄는 동안은 미리보기만, 손을 뗄 때 허용 분에 맞춰 set-time 한 번. */
function useHandDrag(hand: DragHand, options: HandDragOptions) {
  const { svgRef, dragRef, state, ui, locked, setPreview } = options;
  return useDrag({
    disabled: locked,
    getPoint: (event) => pointerToLogical(event, svgRef.current, LOGICAL),
    onStart: (info) => {
      dragRef.current = { start: state.minutes, last: null, accumulated: 0 };
      setPreview(track(dragRef.current, hand, info));
    },
    onMove: (info) => setPreview(track(dragRef.current, hand, info)),
    onEnd: (info) => {
      const raw = track(dragRef.current, hand, info);
      setPreview(null);
      const next = snapMinutes(state, raw);
      if (next !== state.minutes) ui.send({ type: 'set-time', minutes: next });
    },
    onCancel: () => setPreview(null),
  });
}

export function ClockBoard({ state, ui, readOnly, svgStyle, className }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<DragRef>({ start: 0, last: null, accumulated: 0 });
  const [preview, setPreview] = useState<number | null>(null);
  const [focused, setFocused] = useState(false);
  const locked = readOnly || state.readOnly;

  const dragOptions = { svgRef, dragRef, state, ui, locked, setPreview };
  const longDrag = useHandDrag('long', dragOptions);
  const shortDrag = useHandDrag('short', dragOptions);

  const shown = preview ?? state.minutes;
  const angles = handAngles(shown);
  const gears = gearAngles(shown);
  const { cx, cy } = CLOCK;
  const showLong = !state.hideMinuteHand;
  const showMarker = state.unrolled && !state.readOnly && showLong;
  const minuteOfHour = ((shown % 60) + 60) % 60;

  return (
    <svg
      ref={svgRef}
      className={className}
      style={{ ...svgStyle, touchAction: 'none' }}
      viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`}
      preserveAspectRatio="xMidYMid meet"
      data-testid="clock-canvas"
      data-unrolled={state.unrolled ? 'true' : 'false'}
      role="group"
      aria-label={S.boardLabel}
    >
      {state.showGears ? (
        <g data-part="gears">
          <g data-part="gear-big" data-angle={gears.big.toFixed(2)}>
            <g transform={`rotate(${gears.big} ${cx} ${cy})`}>
              <path
                d={gearPath(18, 128, 148)}
                fill="#cfe0ff"
                stroke={BLUE}
                strokeWidth={3}
                strokeLinejoin="round"
              />
              <line x1={cx} y1={cy - 100} x2={cx} y2={cy - 128} stroke={BLUE} strokeWidth={8} />
            </g>
            <title>{S.gearBig}</title>
          </g>
          <g data-part="gear-small" data-angle={gears.small.toFixed(2)}>
            <g transform={`rotate(${gears.small} ${cx} ${cy})`}>
              <path
                d={gearPath(9, 52, 70)}
                fill="#ffe1b8"
                stroke="#b55a00"
                strokeWidth={3}
                strokeLinejoin="round"
              />
              <line x1={cx} y1={cy - 30} x2={cx} y2={cy - 52} stroke="#b55a00" strokeWidth={8} />
            </g>
            <title>{S.gearSmall}</title>
          </g>
          <text
            data-part="gear-caption"
            x={SIDE.x}
            y={SIDE.captionY}
            fontSize={22}
            fontWeight={700}
            fill={INK}
          >
            {S.gearCaption}
          </text>
        </g>
      ) : null}

      <g
        data-part="clock"
        role="slider"
        tabIndex={locked ? -1 : 0}
        aria-label={S.boardLabel}
        aria-orientation="horizontal"
        aria-readonly={locked ? true : undefined}
        aria-valuetext={handsSentence(state.minutes, state.hideMinuteHand)}
        onKeyDown={locked ? undefined : ui.onSliderKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{ outline: 'none' }}
      >
        <circle
          cx={cx}
          cy={cy}
          r={CLOCK.r}
          fill={state.showGears ? 'rgba(255,255,255,0.6)' : '#ffffff'}
          stroke={focused ? '#e8872e' : INK}
          strokeWidth={focused ? 9 : 6}
          strokeDasharray={focused ? '14 7' : undefined}
        />
        {Array.from({ length: 60 }, (_, i) => {
          const major = i % 5 === 0;
          const a = polar(i * 6, CLOCK.r - 4);
          const b = polar(i * 6, CLOCK.r - (major ? 22 : 12));
          return (
            <line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={INK}
              strokeWidth={major ? 4 : 2}
            />
          );
        })}
        {Array.from({ length: 12 }, (_, i) => {
          const n = i + 1;
          const p = numeralPoint(n);
          return (
            <text
              key={n}
              data-part="numeral"
              x={p.x}
              y={p.y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={34}
              fontWeight={800}
              fill={INK}
            >
              {n}
            </text>
          );
        })}

        <g
          data-part="short-hand"
          data-angle={angles.hour.toFixed(2)}
          role="img"
          aria-label={shortHandSentence(state.minutes)}
          transform={`rotate(${angles.hour} ${cx} ${cy})`}
        >
          <polygon
            points={`${cx - 9},${cy + 22} ${cx - 9},${cy - CLOCK.shortLength + 26} ${cx},${cy - CLOCK.shortLength} ${cx + 9},${cy - CLOCK.shortLength + 26} ${cx + 9},${cy + 22}`}
            fill={INK}
            stroke="#ffffff"
            strokeWidth={2}
            strokeLinejoin="round"
          />
          <rect
            data-part="short-hit"
            x={cx - 35}
            y={cy - CLOCK.shortLength - 6}
            width={70}
            height={CLOCK.shortLength + 6}
            fill="transparent"
            style={{ cursor: locked ? 'default' : 'grab', touchAction: 'none' }}
            {...shortDrag.handlers}
          />
        </g>
        {showLong ? (
          <g
            data-part="long-hand"
            data-angle={angles.minute.toFixed(2)}
            role="img"
            aria-label={longHandSentence(state.minutes)}
            transform={`rotate(${angles.minute} ${cx} ${cy})`}
          >
            <line
              x1={cx}
              y1={cy + 28}
              x2={cx}
              y2={cy - CLOCK.longLength + 8}
              stroke={BLUE}
              strokeWidth={6}
              strokeLinecap="round"
            />
            <circle
              cx={cx}
              cy={cy - CLOCK.longLength + 4}
              r={9}
              fill="#ffffff"
              stroke={BLUE}
              strokeWidth={5}
            />
            <rect
              data-part="long-hit"
              x={cx - 32}
              y={cy - CLOCK.longLength - 16}
              width={64}
              height={CLOCK.longLength + 16 - 70}
              fill="transparent"
              style={{ cursor: locked ? 'default' : 'grab', touchAction: 'none' }}
              {...longDrag.handlers}
            />
          </g>
        ) : null}
        <circle cx={cx} cy={cy} r={11} fill={INK} stroke="#ffffff" strokeWidth={3} />
      </g>

      {state.digitalReadout === 'always' ? (
        <text
          data-part="digital"
          data-testid="clock-digital"
          x={SIDE.x}
          y={SIDE.digitalY}
          fontSize={64}
          fontWeight={800}
          fill={INK}
          aria-label={`${S.digitalLabel} ${formatTime(state.minutes)}`}
        >
          {formatTime(state.minutes)}
        </text>
      ) : null}

      {state.unrolled ? (
        <g data-part="strip" className={styles.strip} role="group" aria-label={S.stripLabel}>
          <rect
            x={STRIP.left}
            y={STRIP.barTop}
            width={STRIP.right - STRIP.left}
            height={STRIP.barBottom - STRIP.barTop}
            rx={6}
            fill="#fffdf6"
            stroke={INK}
            strokeWidth={3}
          />
          {Array.from({ length: 61 }, (_, i) => {
            const x = stripX(i);
            const major = i % 5 === 0;
            return (
              <line
                key={i}
                x1={x}
                y1={STRIP.barBottom}
                x2={x}
                y2={STRIP.barBottom - (major ? 18 : 9)}
                stroke={INK}
                strokeWidth={major ? 3 : 1.5}
              />
            );
          })}
          {Array.from({ length: 12 }, (_, i) => (
            <text
              key={i}
              data-part="strip-numeral"
              x={stripX((i + 1) * 5)}
              y={STRIP.numY}
              textAnchor="middle"
              fontSize={20}
              fontWeight={800}
              fill={INK}
            >
              {i + 1}
            </text>
          ))}
          {Array.from({ length: 13 }, (_, i) => (
            <text
              key={i}
              data-part="strip-minute"
              x={stripX(i * 5)}
              y={STRIP.lowY}
              textAnchor="middle"
              fontSize={18}
              fontWeight={700}
              fill={INK}
            >
              {i * 5}
            </text>
          ))}
          {showMarker ? (
            <g data-part="strip-marker" data-x={stripX(minuteOfHour).toFixed(2)}>
              <line
                x1={stripX(minuteOfHour)}
                y1={STRIP.barTop - 6}
                x2={stripX(minuteOfHour)}
                y2={STRIP.barBottom + 2}
                stroke={BLUE}
                strokeWidth={4}
              />
              <polygon
                points={`${stripX(minuteOfHour) - 10},${STRIP.barBottom + 18} ${stripX(minuteOfHour) + 10},${STRIP.barBottom + 18} ${stripX(minuteOfHour)},${STRIP.barBottom + 3}`}
                fill={BLUE}
                stroke="#ffffff"
                strokeWidth={1.5}
              />
            </g>
          ) : null}
        </g>
      ) : null}
    </svg>
  );
}
