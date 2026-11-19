/**
 * E15 gears 모드 화면: 맞물려 도는 두 톱니바퀴(판)와 돌리기 단추·기록·예측 패드.
 *
 * 최소공배수 값을 화면에 쓰지 않는다. 표시 톱니는 빨강 + 굵은 윤곽 + 점 무늬이고,
 * 다시 만난 순간에는 별 모양과 글자를 함께 쓴다(색만으로 알리지 않는다).
 * 톱니 한 칸이 화면 32px보다 작아지면 줄이지 않고 판 안에서 스크롤한다.
 * 돌리기는 단추·키보드(←→)·바퀴 끌기(Pointer Events)로 할 수 있다.
 */
import { useId, useMemo, useRef, useState } from 'react';
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';
import { useRenderedSize } from '../../core/engine-sdk';
import type { EngineViewProps } from '../../core/engine-sdk';
import { isMeeting, lapsOf, turnLocked } from './gears';
import {
  PITCH,
  ROOT,
  gearsLayout,
  rotationOf,
  starPoints,
  toothAngle,
  toothPoints,
} from './gears-layout';
import type { GearGeometry } from './gears-layout';
import { patternStrings as S } from './strings.ko';
import type { GearsState, PatternAction, PatternConfig } from './types';
import styles from './View.module.css';

type GearsViewProps = Omit<EngineViewProps<PatternConfig, GearsState, PatternAction>, 'state'> & {
  readonly state: GearsState;
};

/** 톱니 한 칸(피치)의 최소 화면 크기(px). 이보다 작아지면 줄이지 않고 판 안에서 스크롤한다. */
const MIN_PITCH_PX = 32;
const MAX_FIT = 2.5;

const GEAR_COLORS = {
  a: { fill: '#bcd0f5', stroke: '#1d4fa8' },
  b: { fill: '#c6e5cd', stroke: '#1f6b3a' },
  markFill: '#e53935',
  markStroke: '#4a0f0c',
  ink: '#1d2330',
} as const;

const DIGITS: readonly string[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

interface DragInfo {
  readonly side: 'a' | 'b';
  readonly base: number;
  last: number;
  acc: number;
  target: number;
}

function angleDiff(next: number, prev: number): number {
  let diff = next - prev;
  while (diff > 180) diff -= 360;
  while (diff <= -180) diff += 360;
  return diff;
}

export function GearsView({ state, dispatch, targetSize, readOnly = false }: GearsViewProps) {
  const { settings } = state;
  const layout = useMemo(() => gearsLayout(settings), [settings]);
  const boardRef = useRef<HTMLDivElement>(null);
  const board = useRenderedSize(boardRef);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<DragInfo | null>(null);
  const [dragging, setDragging] = useState(false);
  const patternId = `gears-dots-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  const locked = turnLocked(state);
  const frozen = readOnly || locked;
  const met = state.steps > 0 && isMeeting(settings, state.steps);

  let sizeStyle: { width: string; height: string } | undefined;
  let scroll = false;
  if (board.width > 0 && board.height > 0) {
    const fit = Math.min(board.width / layout.width, board.height / layout.height, MAX_FIT);
    const minScale = MIN_PITCH_PX / PITCH;
    const scale = fit >= minScale - 0.005 ? fit : minScale;
    scroll = fit < minScale - 0.005;
    sizeStyle = { width: `${layout.width * scale}px`, height: `${layout.height * scale}px` };
  }
  const boardStyle = {
    '--gears-min-h': `${Math.ceil(layout.height * (MIN_PITCH_PX / PITCH))}px`,
  } as CSSProperties;

  const turn = (by: 1 | -1) => {
    if (!frozen) dispatch({ type: 'turn', by });
  };

  const onKeyDown = (event: ReactKeyboardEvent<SVGSVGElement>) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      turn(1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      turn(-1);
    }
  };

  const onPredictKey = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (readOnly || event.ctrlKey || event.metaKey || event.altKey) return;
    if (/^[0-9]$/.test(event.key)) {
      event.preventDefault();
      dispatch({ type: 'predict-type', key: event.key });
    } else if (event.key === 'Backspace') {
      event.preventDefault();
      dispatch({ type: 'predict-backspace' });
    } else if (event.key === 'Enter') {
      event.preventDefault();
      dispatch({ type: 'predict-lock' });
    }
  };

  const pointerAngle = (event: ReactPointerEvent<SVGElement>, gear: GearGeometry): number => {
    const svg = svgRef.current;
    if (!svg) return 0;
    const rect = svg.getBoundingClientRect();
    const scale = rect.width > 0 ? layout.width / rect.width : 1;
    const x = (event.clientX - rect.left) * scale;
    const y = (event.clientY - rect.top) * scale;
    return (Math.atan2(y - gear.cy, x - gear.cx) * 180) / Math.PI;
  };

  const onGearDown = (event: ReactPointerEvent<SVGGElement>, side: 'a' | 'b') => {
    if (frozen) return;
    const gear = layout[side];
    dragRef.current = {
      side,
      base: state.steps,
      last: pointerAngle(event, gear),
      acc: 0,
      target: state.steps,
    };
    svgRef.current?.setPointerCapture?.(event.pointerId);
    setDragging(true);
  };

  const onMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const gear = layout[drag.side];
    const angle = pointerAngle(event, gear);
    drag.acc += angleDiff(angle, drag.last);
    drag.last = angle;
    // 왼쪽 바퀴는 시계 방향이 앞, 오른쪽 바퀴는 시계 반대 방향이 앞이다.
    const delta = (drag.side === 'a' ? drag.acc : -drag.acc) / gear.theta;
    const target = drag.base + Math.round(delta);
    if (target !== drag.target) {
      drag.target = target;
      dispatch({ type: 'turn-to', steps: target });
    }
  };

  const endDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setDragging(false);
    svgRef.current?.releasePointerCapture?.(event.pointerId);
  };

  const renderGear = (side: 'a' | 'b') => {
    const g = layout[side];
    const colors = GEAR_COLORS[side];
    const name = side === 'a' ? S.gears.leftName : S.gears.rightName;
    const rotation = rotationOf(side, state.steps, g.theta);
    const teeth = Array.from({ length: g.teeth }, (_, k) => k);
    return (
      <g key={side} data-gear={side} data-teeth={g.teeth}>
        <g
          className={styles.gearRotor}
          data-dragging={dragging ? 'true' : undefined}
          data-testid={`gears-rotor-${side}`}
          data-rotation={rotation}
          style={{
            transform: `rotate(${rotation}deg)`,
            transformOrigin: `${g.cx}px ${g.cy}px`,
            touchAction: 'none',
            cursor: frozen ? 'default' : 'grab',
          }}
          onPointerDown={(event) => onGearDown(event, side)}
        >
          <circle
            cx={g.cx}
            cy={g.cy}
            r={g.r - ROOT + 1}
            fill={colors.fill}
            stroke={colors.stroke}
            strokeWidth={1.5}
          />
          {teeth
            .filter((k) => k !== 0)
            .map((k) => (
              <polygon
                key={k}
                points={toothPoints(g, toothAngle(side, k, g.theta))}
                fill={colors.fill}
                stroke={colors.stroke}
                strokeWidth={1.5}
                strokeLinejoin="round"
              />
            ))}
          <g data-mark="true" data-testid={`gears-mark-${side}`}>
            <polygon
              points={toothPoints(g, toothAngle(side, 0, g.theta))}
              fill={GEAR_COLORS.markFill}
              stroke={GEAR_COLORS.markStroke}
              strokeWidth={4}
              strokeLinejoin="round"
            />
            <polygon
              points={toothPoints(g, toothAngle(side, 0, g.theta))}
              fill={`url(#${patternId})`}
              stroke="none"
            />
          </g>
        </g>
        <circle
          cx={g.cx}
          cy={g.cy}
          r={Math.max(9, g.r - ROOT - 4)}
          fill="#ffffff"
          stroke={colors.stroke}
          strokeWidth={1.5}
          pointerEvents="none"
        />
        <text
          x={g.cx}
          y={g.cy}
          fontSize={Math.min(22, Math.max(14, g.r - ROOT - 4) * 1.1)}
          fontWeight={800}
          fill={GEAR_COLORS.ink}
          textAnchor="middle"
          dominantBaseline="central"
          pointerEvents="none"
          aria-label={S.gears.gearLabel(name, g.teeth)}
        >
          {g.teeth}
        </text>
      </g>
    );
  };

  const lapA = lapsOf(state.steps, settings.teethA);
  const lapB = lapsOf(state.steps, settings.teethB);
  const draft = state.predictionDraft;

  return (
    <div className={styles.wrap} data-target-size={targetSize} data-mode="gears">
      <div className={styles.stageRow}>
        <div
          ref={boardRef}
          className={styles.boardArea}
          data-scroll={scroll ? 'true' : 'false'}
          data-gears="true"
          style={boardStyle}
          data-testid="gears-board"
        >
          <svg
            ref={svgRef}
            data-testid="gears-canvas"
            className={`${styles.calcSvg} ${styles.gearsSvg}`}
            style={sizeStyle ?? { aspectRatio: `${layout.width} / ${layout.height}` }}
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            role="group"
            aria-label={S.gears.canvasKeys}
            tabIndex={0}
            onKeyDown={onKeyDown}
            onPointerMove={onMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            <title>{S.gears.canvasLabel}</title>
            <defs>
              <pattern id={patternId} patternUnits="userSpaceOnUse" width={7} height={7}>
                <circle cx={2} cy={2} r={1.5} fill="#ffffff" />
                <circle cx={5.5} cy={5.5} r={1.5} fill="#ffffff" />
              </pattern>
            </defs>
            {state.prediction !== null ? (
              <text
                x={16}
                y={28}
                fontSize={20}
                fontWeight={800}
                fill={GEAR_COLORS.ink}
                data-testid="gears-prediction-text"
              >
                {S.gears.predictMine(state.prediction)}
              </text>
            ) : null}
            {met ? (
              <text
                x={layout.width - 16}
                y={28}
                fontSize={22}
                fontWeight={800}
                fill="#7a2a00"
                textAnchor="end"
                aria-hidden="true"
                data-testid="gears-meet-text"
              >
                {S.gears.meetText}
              </text>
            ) : null}
            {renderGear('a')}
            {renderGear('b')}
            {met ? (
              <g pointerEvents="none" data-testid="gears-meet-mark">
                <line
                  x1={layout.contact.x}
                  x2={layout.contact.x}
                  y1={layout.starY + 18}
                  y2={layout.contact.y}
                  stroke={GEAR_COLORS.ink}
                  strokeWidth={3}
                  strokeDasharray="5 4"
                />
                <circle
                  cx={layout.contact.x}
                  cy={layout.contact.y}
                  r={5}
                  fill="#ffd23f"
                  stroke={GEAR_COLORS.ink}
                  strokeWidth={2.5}
                />
                <polygon
                  points={starPoints(layout.contact.x, layout.starY, 22, 10)}
                  fill="#ffd23f"
                  stroke={GEAR_COLORS.ink}
                  strokeWidth={3}
                  strokeLinejoin="round"
                  data-testid="gears-meet-star"
                />
              </g>
            ) : null}
          </svg>
        </div>

        <div className={styles.sideStack}>
          <section className={styles.calcSection}>
            <p className={styles.instructions}>
              {settings.predict ? S.gears.predictInstructions : S.gears.instructions}
            </p>
            <div className={styles.toolbar}>
              <button
                type="button"
                className={styles.button}
                disabled={frozen || state.steps <= 0}
                onClick={() => turn(-1)}
              >
                {S.gears.turnBack}
              </button>
              <button
                type="button"
                className={styles.button}
                disabled={frozen || state.steps >= settings.maxSteps}
                onClick={() => turn(1)}
              >
                {S.gears.turnForward}
              </button>
              <button
                type="button"
                className={styles.button}
                disabled={readOnly}
                onClick={() => dispatch({ type: 'reset' })}
              >
                {S.gears.reset}
              </button>
            </div>
            {locked ? (
              <p className={styles.status} data-testid="gears-lock-reason">
                {S.gears.predictFirst}
              </p>
            ) : null}
            <div className={styles.gearsRecord} data-testid="gears-record">
              <p className={styles.gearsSteps} data-testid="gears-steps">
                {S.gears.steps(state.steps)}
              </p>
              {settings.showLaps ? (
                <>
                  <p className={styles.gearsLap} data-testid="gears-laps-a">
                    {S.gears.laps(S.gears.leftName, lapA.laps, lapA.rest)}
                  </p>
                  <p className={styles.gearsLap} data-testid="gears-laps-b">
                    {S.gears.laps(S.gears.rightName, lapB.laps, lapB.rest)}
                  </p>
                </>
              ) : null}
            </div>
          </section>

          {settings.predict ? (
            <section
              className={styles.calcSection}
              role="group"
              aria-label={S.gears.predictLabel}
              data-testid="gears-predict"
              onKeyDown={onPredictKey}
            >
              <p className={styles.gearsDraft} data-testid="gears-draft">
                {state.prediction !== null
                  ? S.gears.predictMine(state.prediction)
                  : `${S.gears.predictDraft}: ${draft === '' ? S.gears.predictEmpty : draft}`}
              </p>
              {state.prediction === null ? (
                <div
                  className={styles.calcPad}
                  role="group"
                  aria-label={S.gears.predictPad}
                  data-testid="gears-pad"
                >
                  {DIGITS.map((digit) => (
                    <button
                      key={digit}
                      type="button"
                      className={styles.calcPadButton}
                      disabled={readOnly}
                      onClick={() => dispatch({ type: 'predict-type', key: digit })}
                    >
                      {digit}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={`${styles.calcPadButton} ${styles.calcPadWide}`}
                    disabled={readOnly}
                    onClick={() => dispatch({ type: 'predict-backspace' })}
                  >
                    {S.gears.predictErase}
                  </button>
                  <button
                    type="button"
                    className={`${styles.calcPadButton} ${styles.calcPadWide}`}
                    disabled={readOnly || draft === ''}
                    onClick={() => dispatch({ type: 'predict-lock' })}
                  >
                    {S.gears.predictLock}
                  </button>
                </div>
              ) : null}
            </section>
          ) : null}
        </div>
      </div>
      <p className={styles.srOnly} aria-live="polite" data-testid="gears-live">
        {met ? S.gears.meetLive(state.steps) : ''}
      </p>
    </div>
  );
}
