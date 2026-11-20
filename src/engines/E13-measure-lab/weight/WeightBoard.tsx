/**
 * E13 weight 판(논리 너비 1000 SVG). 윗접시저울(기울기)과 용수철저울(눈금)을 그린다.
 * 물건의 g는 글·DOM·aria·data-에 쓰지 않는다. 쓰는 숫자는 용수철저울 눈금 숫자(측정 도구)와
 * 학생이 쌓은 클립 수뿐이다. 물건은 끌어서 접시·고리·선반으로 옮기고(Pointer Events),
 * Enter로 고른 뒤 조작 칸 단추로도 옮긴다.
 */
import { useState } from 'react';
import type { CSSProperties, KeyboardEvent, RefObject } from 'react';
import { Rational } from '../../../core/math';
import { pointerToLogical, useDrag } from '../../../core/engine-sdk';
import { E13_STRINGS as S } from '../strings.ko';
import styles from '../View.module.css';
import { ObjectArt } from './Art';
import {
  BOARD,
  MIN_HIT,
  SIZE_PX,
  beamRotation,
  dropTarget,
  geoOf,
  hookY,
  panCenter,
  panOffsets,
  placementOf,
  r2,
  tiltDegrees,
} from './layout';
import type { BalanceGeo, SpringGeo } from './layout';
import { placeOf, readWeight } from './settings';
import type { WeightObject, WeightState } from './types';
import type { WeightUi } from './useWeightUi';

const INK = '#1d2330';
const ORANGE = '#e8872e';
const BLUE = '#2f6fde';
const RED = '#d64541';
const METAL = '#4a5568';
const TAP = 8;
const CLIP_W = 34;
const CLIP_H = 11;

interface Props {
  readonly svgRef: RefObject<SVGSVGElement>;
  readonly state: WeightState;
  readonly ui: WeightUi;
  readonly locked: boolean;
  readonly svgStyle: CSSProperties | undefined;
  readonly className: string | undefined;
}

/** 클립 더미: 오른쪽 접시 위에 아래부터 쌓는다. */
function ClipPile({ balance, count }: { readonly balance: BalanceGeo; readonly count: number }) {
  const cols = Math.max(1, Math.floor((balance.panHalf * 2 - 12) / (CLIP_W + 4)));
  return (
    <g data-part="clip-pile">
      {Array.from({ length: count }, (_, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = (col - (cols - 1) / 2) * (CLIP_W + 4) - CLIP_W / 2;
        const y = -(row + 1) * (CLIP_H + 2) - 2;
        return (
          <g key={i} data-part="clip" transform={`translate(${x} ${y})`}>
            <rect
              width={CLIP_W}
              height={CLIP_H}
              rx={5}
              fill="#ffffff"
              stroke={BLUE}
              strokeWidth={2.5}
            />
            <rect
              x={6}
              y={2.5}
              width={CLIP_W - 12}
              height={CLIP_H - 5}
              rx={3}
              fill="none"
              stroke={BLUE}
              strokeWidth={2}
            />
          </g>
        );
      })}
    </g>
  );
}

interface PanProps {
  readonly balance: BalanceGeo;
  readonly name: 'left' | 'right';
  readonly offset: { readonly dx: number; readonly dy: number };
  readonly state: WeightState;
}

function PanArt({ balance, name, offset, state }: PanProps) {
  const cx = panCenter(balance, name);
  const half = balance.panHalf;
  const y = balance.surfaceY;
  const showClips = name === 'right' && state.clipG !== null;
  return (
    <g
      className={styles.motion}
      role="group"
      aria-label={name === 'left' ? S.weight.leftPan : S.weight.rightPan}
      data-pan={name}
      style={{ transform: `translate(${offset.dx}px, ${offset.dy}px)` } as CSSProperties}
    >
      <path
        d={`M${cx} ${balance.pivotY} L${cx - half} ${y} M${cx} ${balance.pivotY} L${cx + half} ${y}`}
        stroke={METAL}
        strokeWidth={3}
        fill="none"
      />
      <path
        d={`M${cx - half} ${y} H${cx + half} Q${cx + half - 10} ${y + 44} ${cx} ${y + 44} Q${cx - half + 10} ${y + 44} ${cx - half} ${y} Z`}
        fill="#e8edf6"
        stroke={METAL}
        strokeWidth={4}
      />
      {showClips ? (
        <>
          <g transform={`translate(${cx} ${y})`}>
            <ClipPile balance={balance} count={state.clips} />
          </g>
          <text
            data-part="clip-count"
            x={cx}
            y={y + 74}
            textAnchor="middle"
            fontSize={24}
            fontWeight={800}
            fill="#8a4b00"
          >
            {S.weight.clipsCount(state.clips)}
          </text>
        </>
      ) : null}
    </g>
  );
}

function BalanceArt({
  balance,
  state,
}: {
  readonly balance: BalanceGeo;
  readonly state: WeightState;
}) {
  const reading = readWeight(state);
  const degrees = tiltDegrees(state);
  const offsets = panOffsets(balance.beamHalf, reading.tilt, degrees);
  const rotation = beamRotation(reading.tilt, degrees);
  const result = !reading.bothUsed
    ? ''
    : reading.tilt === 'left'
      ? S.weight.resultLeft
      : reading.tilt === 'right'
        ? S.weight.resultRight
        : S.weight.resultLevel;
  return (
    <g data-part="pan-balance" role="group" aria-label={S.weight.panName}>
      <path
        d={`M${balance.cx} ${balance.pivotY} V${balance.standBase} M${balance.cx - 110} ${balance.standBase} H${balance.cx + 110}`}
        stroke={METAL}
        strokeWidth={14}
        strokeLinecap="round"
        fill="none"
      />
      <g
        className={styles.motion}
        data-part="beam"
        style={
          {
            transform: `rotate(${rotation}deg)`,
            transformOrigin: `${balance.cx}px ${balance.pivotY}px`,
          } as CSSProperties
        }
      >
        <line
          x1={balance.cx - balance.beamHalf}
          y1={balance.pivotY}
          x2={balance.cx + balance.beamHalf}
          y2={balance.pivotY}
          stroke={METAL}
          strokeWidth={12}
          strokeLinecap="round"
        />
      </g>
      <PanArt balance={balance} name="left" offset={offsets.left} state={state} />
      <PanArt balance={balance} name="right" offset={offsets.right} state={state} />
      <circle cx={balance.cx} cy={balance.pivotY} r={16} fill={METAL} />
      <text
        x={balance.cx}
        y={balance.standBase + 26}
        textAnchor="middle"
        fontSize={22}
        fontWeight={800}
        fill={INK}
      >
        {S.weight.panName}
      </text>
      <text
        data-testid="weight-result"
        x={balance.cx}
        y={36}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={28}
        fontWeight={800}
        fill={INK}
        role="status"
        aria-live="polite"
      >
        {result}
      </text>
    </g>
  );
}

/** 용수철 모양(지그재그). */
function coilPath(spring: SpringGeo, hook: number): string {
  const y0 = spring.top + 10;
  const y1 = hook - 14;
  const steps = 12;
  let d = `M${spring.x},${spring.top} V${y0}`;
  for (let i = 1; i <= steps; i += 1) {
    const y = y0 + ((y1 - y0) * i) / steps;
    d += ` L${r2(spring.x + (i % 2 === 0 ? -14 : 14))},${r2(y)}`;
  }
  return `${d} L${spring.x},${r2(y1)} V${r2(hook - 8)}`;
}

function SpringArt({ spring, state }: { readonly spring: SpringGeo; readonly state: WeightState }) {
  const maxG = Rational.parse(state.springMaxG);
  const hungItem = state.objects.find((item) => item.id === state.hung);
  const hook = hookY(spring, hungItem === undefined ? null : Rational.parse(hungItem.g), maxG);
  const maxTens = Number(maxG.n) / 10;
  const per = spring.len / maxTens;
  return (
    <g data-part="spring-scale" role="group" aria-label={S.weight.springName}>
      <line
        x1={spring.x - 44}
        y1={spring.top}
        x2={spring.x + 44}
        y2={spring.top}
        stroke={METAL}
        strokeWidth={10}
        strokeLinecap="round"
      />
      <path
        data-part="coil"
        d={coilPath(spring, hook)}
        fill="none"
        stroke={METAL}
        strokeWidth={4}
        strokeLinejoin="round"
        className={styles.motion}
      />
      <circle
        data-part="hook"
        role="img"
        aria-label={S.weight.hook}
        cx={spring.x}
        cy={r2(hook)}
        r={8}
        fill="none"
        stroke={METAL}
        strokeWidth={4}
      />
      <g data-part="spring-ticks">
        <line
          x1={spring.rulerX}
          y1={spring.zeroY}
          x2={spring.rulerX}
          y2={spring.zeroY + spring.len}
          stroke={INK}
          strokeWidth={3}
        />
        {Array.from({ length: maxTens + 1 }, (_, i) => {
          const y = r2(spring.zeroY + i * per);
          const hundred = i % 10 === 0;
          const half = i % 5 === 0;
          return (
            <g key={i} data-part="tick" data-kind={hundred ? 'hundred' : half ? 'half' : 'ten'}>
              <line
                x1={spring.rulerX}
                y1={y}
                x2={spring.rulerX + (hundred ? 26 : half ? 18 : 10)}
                y2={y}
                stroke={INK}
                strokeWidth={hundred ? 3 : 1.5}
              />
              {hundred ? (
                <text
                  x={spring.rulerX + 32}
                  y={y}
                  dominantBaseline="central"
                  fontSize={20}
                  fontWeight={700}
                  fill={INK}
                >
                  {i * 10}
                </text>
              ) : null}
            </g>
          );
        })}
        <text
          x={spring.rulerX + 12}
          y={spring.zeroY - 18}
          textAnchor="middle"
          fontSize={20}
          fontWeight={800}
          fill={INK}
        >
          g
        </text>
      </g>
      <g
        data-part="pointer"
        className={styles.motion}
        data-hung={state.hung === null ? 'no' : 'yes'}
      >
        <line
          x1={spring.x + 10}
          y1={r2(hook)}
          x2={spring.rulerX - 24}
          y2={r2(hook)}
          stroke={RED}
          strokeWidth={3}
        />
        <polygon
          points={`${spring.rulerX - 28},${r2(hook - 9)} ${spring.rulerX - 28},${r2(hook + 9)} ${spring.rulerX - 2},${r2(hook)}`}
          fill={RED}
        />
      </g>
      <text
        x={spring.x}
        y={spring.top - 16}
        textAnchor="middle"
        fontSize={22}
        fontWeight={800}
        fill={INK}
      >
        {S.weight.springName}
      </text>
    </g>
  );
}

interface ItemProps {
  readonly svgRef: RefObject<SVGSVGElement>;
  readonly state: WeightState;
  readonly ui: WeightUi;
  readonly locked: boolean;
  readonly item: WeightObject;
}

/** 물건 하나. 끄는 동안은 미리보기만, 손을 뗄 때 Action 한 번을 보낸다. 거의 안 움직였으면 "고르기"다. */
function ObjectItem({ svgRef, state, ui, locked, item }: ItemProps) {
  const [shift, setShift] = useState<{ dx: number; dy: number } | null>(null);
  const size = { width: BOARD.width, height: geoOf(state).height };
  const where = placeOf(state, item.id);
  const spot = placementOf(state, item.id);
  const px = SIZE_PX[item.visualSize] * spot.scale;
  const hit = Math.max(MIN_HIT * Math.min(1, spot.scale + 0.2), px);
  const selected = ui.selected === item.id;
  const drag = useDrag({
    disabled: locked,
    getPoint: (event) => pointerToLogical(event, svgRef.current, size),
    onStart: () => setShift({ dx: 0, dy: 0 }),
    onMove: (info) => setShift({ dx: info.delta.x, dy: info.delta.y }),
    onEnd: (info) => {
      setShift(null);
      if (Math.hypot(info.delta.x, info.delta.y) < TAP) {
        ui.select(selected ? null : item.id);
        return;
      }
      const target = dropTarget(state, info.current.x, info.current.y);
      if (target === null) return;
      ui.select(item.id);
      if (target === 'spring') ui.send({ type: 'hang', id: item.id });
      else ui.send({ type: 'place', id: item.id, pan: target });
    },
    onCancel: () => setShift(null),
  });
  const onKeyDown = (event: KeyboardEvent<SVGGElement>) => {
    if (locked) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      ui.select(selected ? null : item.id);
    }
  };
  const dragging = shift !== null;
  return (
    <g
      className={dragging ? undefined : styles.motion}
      style={{ transform: `translate(${spot.x}px, ${spot.y}px)` } as CSSProperties}
      data-part="item"
      data-id={item.id}
      data-place={where}
    >
      <g
        transform={`translate(${shift?.dx ?? 0} ${shift?.dy ?? 0})`}
        opacity={dragging ? 0.85 : 1}
        role="button"
        tabIndex={locked ? -1 : 0}
        aria-label={S.weight.itemHint(item.name)}
        aria-pressed={selected}
        onKeyDown={onKeyDown}
      >
        {selected ? (
          <rect
            data-part="selected"
            x={-px / 2 - 8}
            y={-px - 8}
            width={px + 16}
            height={px + 16}
            rx={12}
            fill="none"
            stroke={ORANGE}
            strokeWidth={4}
            strokeDasharray="10 6"
          />
        ) : null}
        <ObjectArt kind={item.kind} size={px} />
        {where === 'shelf' ? (
          <text x={0} y={18} textAnchor="middle" fontSize={22} fontWeight={700} fill={INK}>
            {item.name}
          </text>
        ) : null}
        <rect
          data-part="hit"
          x={-hit / 2}
          y={-hit + (hit - px) / 2}
          width={hit}
          height={hit}
          fill="transparent"
          style={{ cursor: locked ? 'default' : 'grab', touchAction: 'none' }}
          {...drag.handlers}
        />
      </g>
    </g>
  );
}

export function WeightBoard({ svgRef, state, ui, locked, svgStyle, className }: Props) {
  const geo = geoOf(state);
  return (
    <svg
      ref={svgRef}
      className={className}
      style={{ ...svgStyle, touchAction: 'manipulation' }}
      viewBox={`0 0 ${BOARD.width} ${geo.height}`}
      preserveAspectRatio="xMidYMid meet"
      data-testid="weight-canvas"
      data-tilt={readWeight(state).tilt}
      role="group"
      aria-label={S.weight.boardLabel}
    >
      {geo.balance !== null ? <BalanceArt balance={geo.balance} state={state} /> : null}
      {geo.spring !== null ? <SpringArt spring={geo.spring} state={state} /> : null}
      <rect
        data-part="shelf"
        role="img"
        aria-label={S.weight.shelf}
        x={40}
        y={geo.shelfTop}
        width={920}
        height={geo.height - geo.shelfTop - 10}
        rx={14}
        fill="#efe6d4"
        stroke="#8a6d3b"
        strokeWidth={3}
      />
      {state.objects.map((item) => (
        <ObjectItem
          key={item.id}
          svgRef={svgRef}
          state={state}
          ui={ui}
          locked={locked}
          item={item}
        />
      ))}
    </svg>
  );
}
