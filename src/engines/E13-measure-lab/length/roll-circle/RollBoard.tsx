/**
 * E13 roll-circle 판(논리 너비 1000 SVG). 위: 굴렁쇠와 바닥 자(0~35cm), 가운데: 지름 막대 줄,
 * 아래: 기록표(오버레이 정렬 때문에 DOM 표가 아니라 판 안에 그린다).
 * 측정 원주·비 숫자는 굴리거나 기록하기 전에는 글·aria·data-에 두지 않는다(자 눈금 숫자는 측정 도구).
 * 굴렁쇠는 오른쪽으로 끌거나(Pointer Events) Enter/Space로 굴린다.
 */
import type { CSSProperties, KeyboardEvent, RefObject } from 'react';
import { pointerToLogical, useDrag } from '../../../../core/engine-sdk';
import { num } from '../../rat';
import { E13_STRINGS as S } from '../../strings.ko';
import styles from '../../View.module.css';
import { BOARD, MARK_R, PX_CM, RULER_CM, RULER_H, STICK_H, X0, boardHeight, geoOf } from './layout';
import { radiusOf, r2 } from './layout';
import type { RollGeo } from './layout';
import type { RollState } from './types';
import type { RollUi } from './useRollUi';

const INK = '#1d2330';
const BLUE = '#2f6fde';
const RED = '#d64541';
const ORANGE = '#e8872e';
const HATCH_ID = 'roll-hatch';

interface Props {
  readonly svgRef: RefObject<SVGSVGElement>;
  readonly state: RollState;
  readonly ui: RollUi;
  readonly locked: boolean;
  readonly svgStyle: CSSProperties | undefined;
  readonly className: string | undefined;
}

/** 바닥 자: 1mm 눈금(옅게), 5mm, 1cm 눈금과 1cm 숫자. */
function Ruler({ geo }: { readonly geo: RollGeo }) {
  const mm: string[] = [];
  const half: string[] = [];
  const cm: string[] = [];
  for (let k = 0; k <= RULER_CM * 10; k += 1) {
    const x = X0 + k * (PX_CM / 10);
    const len = k % 10 === 0 ? 20 : k % 5 === 0 ? 14 : 8;
    const piece = `M${r2(x)} ${geo.ground}v${len}`;
    if (k % 10 === 0) cm.push(piece);
    else if (k % 5 === 0) half.push(piece);
    else mm.push(piece);
  }
  return (
    <g data-part="ruler" role="img" aria-label={S.roll.rulerLabel}>
      <rect
        x={X0 - 14}
        y={geo.ground}
        width={RULER_CM * PX_CM + 28}
        height={RULER_H}
        rx={4}
        fill="#fff6d6"
        stroke="#9a6b00"
        strokeWidth={2}
      />
      <path d={mm.join('')} stroke={INK} strokeWidth={0.8} opacity={0.55} fill="none" />
      <path d={half.join('')} stroke={INK} strokeWidth={1.2} fill="none" />
      <path d={cm.join('')} stroke={INK} strokeWidth={1.8} fill="none" />
      {Array.from({ length: RULER_CM + 1 }, (_, k) => (
        <text
          key={k}
          x={X0 + k * PX_CM}
          y={geo.ground + 36}
          textAnchor="middle"
          fontSize={14}
          fontWeight={700}
          fill={INK}
        >
          {k}
        </text>
      ))}
    </g>
  );
}

interface RingProps {
  readonly svgRef: RefObject<SVGSVGElement>;
  readonly state: RollState;
  readonly ui: RollUi;
  readonly locked: boolean;
  readonly geo: RollGeo;
  readonly cPx: number;
}

/** 굴렁쇠. 굴리면 오른쪽으로 한 바퀴 돌며 이동한다(CSS 전환 1초, 움직임 줄이기면 바로). */
function Ring({ svgRef, state, ui, locked, geo, cPx }: RingProps) {
  const r = radiusOf(state.diameter);
  const size = { width: BOARD.width, height: boardHeight(state) };
  const drag = useDrag({
    disabled: locked,
    getPoint: (event) => pointerToLogical(event, svgRef.current, size),
    onMove: (info) => {
      // 포인터가 굴렁쇠 지름의 절반 넘게 오른쪽으로 움직이면 한 바퀴 굴리기로 확정한다.
      if (!state.rolled && info.delta.x > r) ui.send({ type: 'roll' });
    },
    onEnd: (info) => {
      if (state.rolled && info.delta.x > r) ui.send({ type: 'roll' });
    },
  });
  const onKeyDown = (event: KeyboardEvent<SVGGElement>) => {
    if (locked) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      ui.send({ type: 'roll' });
    }
  };
  const hit = Math.max(r, 32);
  return (
    <g transform={`translate(0 ${r2(geo.ground - r)})`} data-part="ring-lift">
      <g
        className={state.rolled ? styles.rollMove : undefined}
        style={{ transform: `translateX(${r2(X0 + (state.rolled ? cPx : 0))}px)` } as CSSProperties}
        data-part="ring"
        data-rolled={state.rolled ? 'yes' : 'no'}
        role="button"
        tabIndex={locked ? -1 : 0}
        aria-label={S.roll.ringHint}
        onKeyDown={onKeyDown}
      >
        <g
          className={state.rolled ? styles.rollMove : undefined}
          style={{ transform: `rotate(${state.rolled ? 360 : 0}deg)` } as CSSProperties}
        >
          <circle r={r} fill="rgba(47,111,222,0.08)" stroke={BLUE} strokeWidth={7} />
          <circle data-part="paint-dot" cx={0} cy={r} r={7} fill={RED} />
        </g>
        <circle
          data-part="hit"
          r={hit}
          fill="transparent"
          style={{ cursor: locked ? 'default' : 'grab', touchAction: 'none' }}
          {...drag.handlers}
        />
      </g>
    </g>
  );
}

/** 물감 자국 둘(0과 측정 원주 자리)과 그 사이를 잇는 굵은 선. 굴리기가 끝난 뒤에 나타난다. */
function Marks({ geo, cPx, on }: { geo: RollGeo; cPx: number; on: boolean }) {
  return (
    <g className={styles.rollMarks} data-on={on ? 'true' : 'false'} data-part="marks">
      {on ? (
        <>
          <line
            data-part="span"
            x1={X0}
            y1={geo.ground}
            x2={r2(X0 + cPx)}
            y2={geo.ground}
            stroke={ORANGE}
            strokeWidth={8}
            strokeLinecap="round"
            opacity={0.85}
          />
          <circle
            data-part="mark"
            data-mark="start"
            role="img"
            aria-label={S.roll.markLabel}
            cx={X0}
            cy={geo.ground}
            r={MARK_R}
            fill={RED}
          />
          <circle
            data-part="mark"
            data-mark="end"
            role="img"
            aria-label={S.roll.markLabel}
            cx={r2(X0 + cPx)}
            cy={geo.ground}
            r={MARK_R}
            fill={RED}
          />
          {geo.sticksTop !== null ? (
            <g stroke={RED} strokeWidth={2} strokeDasharray="6 5" opacity={0.7}>
              <line x1={X0} y1={geo.ground} x2={X0} y2={geo.sticksTop + STICK_H + 6} />
              <line
                x1={r2(X0 + cPx)}
                y1={geo.ground}
                x2={r2(X0 + cPx)}
                y2={geo.sticksTop + STICK_H + 6}
              />
            </g>
          ) : null}
        </>
      ) : null}
    </g>
  );
}

/** 지름 막대: 지름 길이 막대를 자국 0부터 이어 놓는다. 자국(원주)을 넘는 부분은 빗금이다. */
function Sticks({ state, geo, cPx }: { state: RollState; geo: RollGeo; cPx: number }) {
  if (geo.sticksTop === null) return null;
  const w = num(state.diameter) * PX_CM;
  const end = X0 + cPx;
  return (
    <g data-part="sticks">
      {Array.from({ length: state.sticks }, (_, i) => {
        const x = X0 + i * w;
        const insideW = Math.max(0, Math.min(x + w, end) - x);
        const overStart = Math.max(x, end);
        const overW = x + w - overStart;
        return (
          <g
            key={i}
            data-part="stick"
            data-index={i + 1}
            role="img"
            aria-label={S.roll.stickLabel(i + 1)}
          >
            <rect
              x={r2(x)}
              y={geo.sticksTop ?? 0}
              width={r2(w)}
              height={STICK_H}
              rx={3}
              fill="#d9e8ff"
              stroke={BLUE}
              strokeWidth={2.5}
            />
            {overW > 0.5 ? (
              <rect
                data-part="overflow"
                x={r2(overStart)}
                y={geo.sticksTop ?? 0}
                width={r2(overW)}
                height={STICK_H}
                rx={3}
                fill={`url(#${HATCH_ID})`}
                stroke={RED}
                strokeWidth={2.5}
              />
            ) : null}
            <text
              x={r2(x + Math.max(insideW, 24) / 2)}
              y={(geo.sticksTop ?? 0) + STICK_H / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={18}
              fontWeight={800}
              fill={INK}
              stroke="#ffffff"
              strokeWidth={4}
              paintOrder="stroke"
            >
              {i + 1}
            </text>
          </g>
        );
      })}
    </g>
  );
}

/** 기록표(지름·원주·원주 ÷ 지름). 기록한 줄만 숫자가 보인다. */
function LogTable({ state, geo }: { state: RollState; geo: RollGeo }) {
  const t = geo.table;
  if (t === null) return null;
  const heads = [S.roll.headDiameter, S.roll.headCircumference, S.roll.headRatio];
  return (
    <g data-part="log-table" role="group" aria-label={S.roll.tableLabel}>
      <rect
        x={t.x}
        y={t.top}
        width={t.width}
        height={t.height}
        fill="#fffdf6"
        stroke={INK}
        strokeWidth={2}
      />
      <rect
        x={t.x}
        y={t.top}
        width={t.width}
        height={t.headH}
        fill="#eef2fa"
        stroke={INK}
        strokeWidth={2}
      />
      {[1, 2].map((k) => (
        <line
          key={k}
          x1={t.colX[k] ?? 0}
          y1={t.top}
          x2={t.colX[k] ?? 0}
          y2={t.top + t.height}
          stroke={INK}
          strokeWidth={1.5}
        />
      ))}
      {Array.from({ length: t.rows }, (_, i) => (
        <line
          key={i}
          x1={t.x}
          data-part="row-line"
          y1={t.top + t.headH + i * t.rowH}
          x2={t.x + t.width}
          y2={t.top + t.headH + i * t.rowH}
          stroke={INK}
          strokeWidth={1.5}
        />
      ))}
      {heads.map((head, k) => (
        <text
          key={head}
          data-part="head"
          x={(t.colX[k] ?? 0) + (t.colW[k] ?? 0) / 2}
          y={t.top + t.headH / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={18}
          fontWeight={800}
          fill={INK}
        >
          {head}
        </text>
      ))}
      {state.log.map((row, i) =>
        [row.d, row.c, row.ratio].map((cell, k) => (
          <text
            key={`${i}-${k}`}
            data-part="cell"
            data-row={i}
            data-col={k}
            x={(t.colX[k] ?? 0) + (t.colW[k] ?? 0) / 2}
            y={t.top + t.headH + i * t.rowH + t.rowH / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={18}
            fontWeight={700}
            fill={INK}
          >
            {cell}
          </text>
        )),
      )}
    </g>
  );
}

export function RollBoard({ svgRef, state, ui, locked, svgStyle, className }: Props) {
  const geo = geoOf(state);
  const measured = state.measuredCm === null ? 0 : num(state.measuredCm);
  const cPx = measured * PX_CM;
  return (
    <svg
      ref={svgRef}
      className={className}
      style={{ ...svgStyle, touchAction: 'manipulation' }}
      viewBox={`0 0 ${BOARD.width} ${boardHeight(state)}`}
      preserveAspectRatio="xMidYMid meet"
      data-testid="roll-canvas"
      role="group"
      aria-label={S.roll.boardLabel}
    >
      <defs>
        <pattern id={HATCH_ID} width={8} height={8} patternUnits="userSpaceOnUse">
          <rect width={8} height={8} fill="#fff1ef" />
          <path d="M-2 2l4-4M0 8l8-8M6 10l4-4" stroke={RED} strokeWidth={1.6} />
        </pattern>
      </defs>
      <Ruler geo={geo} />
      <Marks geo={geo} cPx={cPx} on={state.rolled} />
      <Ring svgRef={svgRef} state={state} ui={ui} locked={locked} geo={geo} cPx={cPx} />
      <Sticks state={state} geo={geo} cPx={cPx} />
      <LogTable state={state} geo={geo} />
    </svg>
  );
}
