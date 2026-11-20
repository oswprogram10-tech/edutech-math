/**
 * E13 length 판(논리 1000×600 SVG). 위에 물건 그림, 아래에 단위 조각을 이어 놓는 띠, 자를 만들면
 * 블록 경계 11곳에 눈금 칸이 생긴다. 뼘 시연(demoSpans)은 판 위쪽에 따로 그린다.
 * 물건의 길이는 그림의 크기로만 드러나고 글·data-·aria에는 두지 않는다.
 * 틈은 빨간 점선 + 빗금 + "틈" 글, 겹침은 진한 줄무늬 + "겹침" 글로 색만으로 전하지 않는다.
 */
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, RefObject } from 'react';
import { pointerToLogical, useDrag } from '../../../core/engine-sdk';
import { num, toNumber } from '../rat';
import { E13_STRINGS as S } from '../strings.ko';
import { unitOf } from '../units';
import styles from '../View.module.css';
import {
  BAND_H,
  BAND_LEFT,
  BAND_WIDTH,
  BOARD,
  DEMO,
  boardHeight,
  OBJECT_H,
  SLOT_H,
  RULER_STEP,
  TICK_COUNT,
  geoOf,
  rulerX,
  xOfCm,
} from './layout';
import type { Geo } from './layout';
import { analyze, pieceLength, pieceStart } from './settings';
import type { LengthUi } from './useLengthUi';
import type { MeasureState, Piece } from './types';

const INK = '#1d2330';
const BLUE = '#2f6fde';
const ORANGE = '#e8872e';
const RED = '#c0392b';

interface Props {
  readonly svgRef: RefObject<SVGSVGElement>;
  readonly state: MeasureState;
  readonly ui: LengthUi;
  readonly locked: boolean;
  readonly svgStyle: CSSProperties | undefined;
  readonly className: string | undefined;
}

// ── 물건 그림 ────────────────────────────────────────────

/** 물건 그림(length·estimate 두 모드가 함께 쓴다). 길이 글은 없고 그림 크기로만 드러난다. */
export function ObjectShape({ name, x, y, w }: { name: string; x: number; y: number; w: number }) {
  const h = OBJECT_H;
  const label = S.objectNames[name] ?? name;
  let body;
  if (name === 'pencil') {
    const tip = Math.min(40, w * 0.3);
    body = (
      <>
        <rect x={x} y={y} width={22} height={h} fill="#f4a6b8" stroke={INK} strokeWidth={3} />
        <rect
          x={x + 22}
          y={y}
          width={w - tip - 22}
          height={h}
          fill="#f2c14e"
          stroke={INK}
          strokeWidth={3}
        />
        <polygon
          points={`${x + w - tip},${y} ${x + w},${y + h / 2} ${x + w - tip},${y + h}`}
          fill="#f3dcb4"
          stroke={INK}
          strokeWidth={3}
          strokeLinejoin="round"
        />
        <polygon
          points={`${x + w - 12},${y + h / 2 - 5} ${x + w},${y + h / 2} ${x + w - 12},${y + h / 2 + 5}`}
          fill={INK}
        />
      </>
    );
  } else if (name === 'desk') {
    body = (
      <>
        <rect x={x} y={y} width={w} height={h * 0.45} fill="#d9b382" stroke={INK} strokeWidth={3} />
        <rect
          x={x + 10}
          y={y + h * 0.45}
          width={10}
          height={h * 0.55}
          fill="#8b5a2b"
          stroke={INK}
          strokeWidth={2}
        />
        <rect
          x={x + w - 20}
          y={y + h * 0.45}
          width={10}
          height={h * 0.55}
          fill="#8b5a2b"
          stroke={INK}
          strokeWidth={2}
        />
      </>
    );
  } else if (name === 'crayon') {
    const tip = Math.min(26, w * 0.25);
    body = (
      <>
        <rect x={x} y={y} width={w - tip} height={h} fill="#e8872e" stroke={INK} strokeWidth={3} />
        <rect
          x={x + 10}
          y={y}
          width={Math.max(0, w - tip - 20)}
          height={h}
          fill="#fff1d6"
          stroke={INK}
          strokeWidth={2}
        />
        <polygon
          points={`${x + w - tip},${y} ${x + w},${y + h / 2} ${x + w - tip},${y + h}`}
          fill="#e8872e"
          stroke={INK}
          strokeWidth={3}
          strokeLinejoin="round"
        />
      </>
    );
  } else if (name === 'eraser') {
    body = (
      <>
        <rect x={x} y={y} width={w} height={h} rx={8} fill="#f7b6c8" stroke={INK} strokeWidth={3} />
        <rect
          x={x + w * 0.3}
          y={y}
          width={w * 0.4}
          height={h}
          fill="#6fa8ff"
          stroke={INK}
          strokeWidth={3}
        />
      </>
    );
  } else if (name === 'blackboard') {
    body = (
      <>
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          rx={3}
          fill="#2f5d46"
          stroke="#8b5a2b"
          strokeWidth={5}
        />
        <line
          x1={x + 12}
          y1={y + h - 8}
          x2={x + Math.min(60, w / 3)}
          y2={y + h - 8}
          stroke="#e8e8e8"
          strokeWidth={3}
          strokeLinecap="round"
        />
      </>
    );
  } else if (name === 'book') {
    body = (
      <>
        <rect x={x} y={y} width={w} height={h} rx={3} fill="#c98a4b" stroke={INK} strokeWidth={3} />
        <rect
          x={x}
          y={y}
          width={Math.min(14, w / 4)}
          height={h}
          fill="#8b5a2b"
          stroke={INK}
          strokeWidth={3}
        />
      </>
    );
  } else {
    body = (
      <rect x={x} y={y} width={w} height={h} rx={6} fill="#e6d9f7" stroke={INK} strokeWidth={3} />
    );
  }
  return (
    <g data-part="object">
      {body}
      <text x={x} y={y - 8} fontSize={22} fontWeight={800} fill={INK}>
        {label}
      </text>
    </g>
  );
}

// ── 뼘 시연 ──────────────────────────────────────────────

const SPAN_FILL: Readonly<Record<string, readonly [string, string]>> = {
  'hand-span-a': ['#ffd9b3', '#b55a00'],
  'hand-span-b': ['#f9c7d6', '#a3265a'],
};

function Avatar({ cx, cy, mark }: { cx: number; cy: number; mark: 'a' | 'b' }) {
  return (
    <g data-part="avatar" aria-hidden="true">
      <circle
        cx={cx}
        cy={cy}
        r={28}
        fill={mark === 'a' ? '#ffe3c2' : '#f9d6e2'}
        stroke={INK}
        strokeWidth={3}
      />
      <circle cx={cx - 10} cy={cy - 5} r={3} fill={INK} />
      <circle cx={cx + 10} cy={cy - 5} r={3} fill={INK} />
      <path
        d={`M${cx - 10},${cy + 8} Q${cx},${cy + 18} ${cx + 10},${cy + 8}`}
        fill="none"
        stroke={INK}
        strokeWidth={3}
      />
    </g>
  );
}

function DemoSpans({ state }: { state: MeasureState }) {
  if (state.demo === null) return null;
  const total = num(state.demo.objectCm);
  const pcm = DEMO.deskW / total;
  const rows = [
    { unit: 'hand-span-a', name: S.length.demo.friendA, mark: 'a' as const },
    { unit: 'hand-span-b', name: S.length.demo.friendB, mark: 'b' as const },
  ];
  return (
    <g data-part="demo">
      {rows.map((row, index) => {
        const y = DEMO.rowY[index] ?? 0;
        const span = unitOf(row.unit);
        const spanCm = span ? num(span.cm) : 1;
        const count = Math.ceil(total / spanCm - 1e-9);
        const exact = Math.abs(total / spanCm - Math.round(total / spanCm)) < 1e-9;
        const [fill, stroke] = SPAN_FILL[row.unit] ?? ['#eee', INK];
        return (
          <g key={row.unit} data-part="demo-row" data-unit={row.unit}>
            <Avatar cx={DEMO.avatarX} cy={y + 34} mark={row.mark} />
            <text
              x={DEMO.avatarX}
              y={y + DEMO.rowH + 6}
              textAnchor="middle"
              fontSize={18}
              fontWeight={800}
              fill={INK}
            >
              {row.name}
            </text>
            <rect
              x={DEMO.deskX}
              y={y + 22}
              width={DEMO.deskW}
              height={44}
              fill="#fffdf6"
              stroke={INK}
              strokeWidth={3}
            />
            {Array.from({ length: count }, (_, i) => {
              const tileW = Math.min(spanCm * pcm, DEMO.deskW - i * spanCm * pcm);
              return (
                <rect
                  key={i}
                  data-part="demo-tile"
                  x={DEMO.deskX + i * spanCm * pcm}
                  y={y + 26}
                  width={tileW}
                  height={36}
                  rx={6}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={3}
                  strokeDasharray={tileW < spanCm * pcm - 0.01 ? '6 4' : undefined}
                />
              );
            })}
            <text x={DEMO.deskX} y={y + 14} fontSize={18} fontWeight={800} fill={INK}>
              {S.objectNames[state.demo?.objectName ?? ''] ?? state.demo?.objectName}
            </text>
            <text x={DEMO.countX} y={y + 52} fontSize={28} fontWeight={800} fill={INK}>
              {S.length.demo.count(count, exact)}
            </text>
          </g>
        );
      })}
    </g>
  );
}

// ── 조각 ─────────────────────────────────────────────────

interface PieceProps {
  readonly svgRef: RefObject<SVGSVGElement>;
  readonly ui: LengthUi;
  readonly locked: boolean;
  readonly index: number;
  readonly piece: Piece;
  readonly geo: Geo;
  /** 방금 합체해 만들어진 1m 줄자면 말리는 연출(400ms)을 보인다. */
  readonly rolling?: boolean;
}

/** 막대·줄자 안쪽 눈금: 10cm 막대는 1cm마다 가는 선, 1m 줄자는 10cm마다 굵은 선. */
function UnitTicks({
  unit,
  x,
  y,
  w,
  h,
}: {
  unit: string;
  x: number;
  y: number;
  w: number;
  h: number;
}) {
  if (unit !== 'cm-10-rod' && unit !== 'm-tape') return null;
  const parts = unit === 'cm-10-rod' ? 10 : 10;
  const d = Array.from({ length: parts - 1 }, (_, i) => {
    const tx = x + (w * (i + 1)) / parts;
    return `M${tx},${y} V${y + h}`;
  }).join(' ');
  return (
    <path
      data-part="unit-ticks"
      d={d}
      fill="none"
      stroke={unit === 'm-tape' ? '#9a6b00' : '#2a7a2a'}
      strokeWidth={unit === 'm-tape' ? 2.5 : 1}
      pointerEvents="none"
    />
  );
}

function PieceShape({ svgRef, ui, locked, index, piece, geo, rolling = false }: PieceProps) {
  const [shift, setShift] = useState<{ dx: number; dy: number } | null>(null);
  const [focused, setFocused] = useState(false);
  const def = unitOf(piece.unit);
  const startCm = toNumber(pieceStart(piece));
  const w = toNumber(pieceLength(piece)) * geo.ppc;
  const x = xOfCm(geo, startCm) + (shift?.dx ?? 0);
  const y = geo.bandTop + 4 + (shift?.dy ?? 0);
  const name = S.length.unitNames[piece.unit] ?? piece.unit;
  const drag = useDrag({
    disabled: locked,
    getPoint: (event) => pointerToLogical(event, svgRef.current, BOARD),
    onStart: () => setShift({ dx: 0, dy: 0 }),
    onMove: (info) => setShift({ dx: info.delta.x, dy: info.delta.y }),
    onEnd: (info) => {
      setShift(null);
      ui.dropPiece(index, startCm + info.delta.x / geo.ppc, info.current.y);
    },
    onCancel: () => setShift(null),
  });
  return (
    <g
      className={rolling ? `${styles.piece} ${styles.roll}` : styles.piece}
      data-part="piece"
      data-index={index}
      data-unit={piece.unit}
      data-start={startCm}
      role="button"
      tabIndex={locked ? -1 : 0}
      aria-label={S.length.pieceLabel(index + 1, name)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onKeyDown={(event) => {
        if (locked) return;
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault();
          ui.nudge(index, event.key === 'ArrowRight' ? ui.step : -ui.step);
        } else if (event.key === 'Delete') {
          event.preventDefault();
          ui.removeAt(index);
        }
      }}
    >
      <rect
        x={x}
        y={y}
        width={w}
        height={BAND_H - 8}
        rx={4}
        fill={def?.fill ?? '#eee'}
        fillOpacity={0.9}
        stroke={def?.stroke ?? INK}
        strokeWidth={3}
      />
      <UnitTicks unit={piece.unit} x={x} y={y} w={w} h={BAND_H - 8} />
      {w >= 44 ? (
        <text
          x={x + w / 2}
          y={y + (BAND_H - 8) / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={16}
          fontWeight={800}
          fill={INK}
          {...(piece.unit === 'm-tape'
            ? { stroke: '#fff3c4', strokeWidth: 5, paintOrder: 'stroke' }
            : {})}
        >
          {name}
        </text>
      ) : null}
      {focused ? (
        <rect
          x={x - 4}
          y={y - 4}
          width={w + 8}
          height={BAND_H}
          rx={6}
          fill="none"
          stroke={ORANGE}
          strokeWidth={4}
          strokeDasharray="8 5"
        />
      ) : null}
      <rect
        data-part="hit"
        x={x - Math.max(0, (36 - w) / 2)}
        y={y - 20}
        width={Math.max(w, 36)}
        height={BAND_H + 32}
        fill="transparent"
        style={{ cursor: locked ? 'default' : 'grab', touchAction: 'none' }}
        {...drag.handlers}
      />
    </g>
  );
}

// ── 틈·겹침 ───────────────────────────────────────────────

function GapOverlapMarks({ state, geo }: { state: MeasureState; geo: Geo }) {
  const result = analyze(state);
  return (
    <g data-part="gap-overlap-marks" pointerEvents="none">
      {result.gaps.map((gap, i) => {
        const x = xOfCm(geo, toNumber(gap.from));
        const w = (toNumber(gap.to) - toNumber(gap.from)) * geo.ppc;
        return (
          <g key={`gap-${i}`} data-part="gap">
            <rect
              x={x}
              y={geo.bandTop}
              width={w}
              height={BAND_H}
              fill="url(#e13-gap-hatch)"
              stroke={RED}
              strokeWidth={3}
              strokeDasharray="6 4"
            />
            <text
              x={x + w / 2}
              y={geo.bandTop - 8}
              textAnchor="middle"
              fontSize={22}
              fontWeight={800}
              fill={RED}
              stroke="#ffffff"
              strokeWidth={4}
              paintOrder="stroke"
            >
              {S.length.gap}
            </text>
          </g>
        );
      })}
      {result.overlaps.map((overlap, i) => {
        const x = xOfCm(geo, toNumber(overlap.from));
        const w = (toNumber(overlap.to) - toNumber(overlap.from)) * geo.ppc;
        return (
          <g key={`overlap-${i}`} data-part="overlap">
            <rect
              x={x}
              y={geo.bandTop}
              width={w}
              height={BAND_H}
              fill="url(#e13-overlap-stripe)"
              stroke={INK}
              strokeWidth={3}
            />
            <text
              x={x + w / 2}
              y={geo.bandTop - 8}
              textAnchor="middle"
              fontSize={22}
              fontWeight={800}
              fill={INK}
              stroke="#ffffff"
              strokeWidth={4}
              paintOrder="stroke"
            >
              {S.length.overlap}
            </text>
          </g>
        );
      })}
    </g>
  );
}

// ── 자 만들기 ─────────────────────────────────────────────

function RulerTicks({
  state,
  ui,
  locked,
  geo,
}: {
  state: MeasureState;
  ui: LengthUi;
  locked: boolean;
  geo: Geo;
}) {
  const [focusedTick, setFocusedTick] = useState<number | null>(null);
  const typed = useRef<{ tick: number; key: string; at: number } | null>(null);
  const slotW = 64;
  return (
    <g data-part="ruler">
      {Array.from({ length: TICK_COUNT }, (_, i) => {
        const x = rulerX(i);
        const value = state.labels[String(i)];
        const filled = value !== undefined;
        return (
          <g
            key={i}
            data-part="tick"
            data-tick={i}
            role="button"
            tabIndex={locked ? -1 : 0}
            aria-label={`${S.length.tickLabel(i + 1)}, ${filled ? S.length.tickFilled(value) : S.length.tickEmpty}`}
            onFocus={() => setFocusedTick(i)}
            onBlur={() => setFocusedTick((current) => (current === i ? null : current))}
            onClick={() => {
              if (!locked) ui.placeSelected(i);
            }}
            onKeyDown={(event) => {
              if (locked) return;
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                ui.placeSelected(i);
                return;
              }
              if (!/^[0-9]$/.test(event.key)) return;
              event.preventDefault();
              const now = Date.now();
              const before = typed.current;
              const ten =
                before &&
                before.tick === i &&
                before.key === '1' &&
                event.key === '0' &&
                now - before.at < 900;
              typed.current = { tick: i, key: event.key, at: now };
              ui.placeLabel(i, ten ? 10 : Number(event.key));
            }}
            style={{ cursor: locked ? 'default' : 'pointer' }}
          >
            {/* 블록 경계(위)에서 눈금 칸(아래)으로 펼쳐 내려 눈금 칸을 크게 만든다. */}
            <line
              x1={xOfCm(geo, i)}
              y1={geo.bandBottom}
              x2={x}
              y2={geo.slotTop}
              stroke={INK}
              strokeWidth={3}
            />
            <rect
              x={x - slotW / 2}
              y={geo.slotTop}
              width={slotW}
              height={SLOT_H}
              rx={6}
              fill={filled ? '#fffdf6' : 'rgba(255,255,255,0.6)'}
              stroke={focusedTick === i ? ORANGE : BLUE}
              strokeWidth={focusedTick === i ? 5 : 3}
              strokeDasharray={filled ? undefined : '6 4'}
            />
            {filled ? (
              <text
                data-part="tick-value"
                x={x}
                y={geo.slotTop + SLOT_H / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={value >= 10 ? 26 : 30}
                fontWeight={800}
                fill={INK}
              >
                {value}
              </text>
            ) : null}
            <rect
              data-part="tick-hit"
              x={x - RULER_STEP / 2}
              y={geo.slotTop - 16}
              width={RULER_STEP}
              height={SLOT_H + 32}
              fill="transparent"
            />
          </g>
        );
      })}
    </g>
  );
}

// ── 합체 연출 ─────────────────────────────────────────────

/** 합체로 새로 생긴 1m 줄자의 시작 위치 목록(400ms 동안). 움직임 줄이기는 CSS가 처리한다. */
function useRollingTapes(state: MeasureState): readonly string[] {
  const seen = useRef<{ merges: number; tapes: readonly string[] }>({
    merges: state.merges,
    tapes: state.pieces.filter((piece) => piece.unit === 'm-tape').map((piece) => piece.start),
  });
  const [rolling, setRolling] = useState<readonly string[]>([]);
  useEffect(() => {
    const tapes = state.pieces
      .filter((piece) => piece.unit === 'm-tape')
      .map((piece) => piece.start);
    const before = seen.current;
    seen.current = { merges: state.merges, tapes };
    if (state.merges <= before.merges) return undefined;
    setRolling(tapes.filter((start) => !before.tapes.includes(start)));
    const timer = window.setTimeout(() => setRolling([]), 400);
    return () => window.clearTimeout(timer);
  }, [state.merges, state.pieces]);
  return rolling;
}

// ── 판 ────────────────────────────────────────────────────

export function LengthBoard({ svgRef, state, ui, locked, svgStyle, className }: Props) {
  const geo = geoOf(state);
  const objectW = num(state.objectCm) * geo.ppc;
  const ghost = ui.ghost;
  const ghostDef = ghost?.kind === 'unit' ? unitOf(ghost.unit) : undefined;
  const ghostW = ghostDef ? num(ghostDef.cm) * geo.ppc : 0;
  const rolling = useRollingTapes(state);
  return (
    <svg
      ref={svgRef}
      className={className}
      style={{ ...svgStyle, touchAction: 'none' }}
      viewBox={`0 0 ${BOARD.width} ${boardHeight(state)}`}
      preserveAspectRatio="xMidYMid meet"
      data-testid="length-canvas"
      role="group"
      aria-label={S.length.boardLabel}
    >
      <defs>
        <pattern id="e13-gap-hatch" width={10} height={10} patternUnits="userSpaceOnUse">
          <rect width={10} height={10} fill="#fde8e5" />
          <path d="M-2,2 l4,-4 M0,10 l10,-10 M8,12 l4,-4" stroke={RED} strokeWidth={2} />
        </pattern>
        <pattern id="e13-overlap-stripe" width={8} height={8} patternUnits="userSpaceOnUse">
          <rect width={8} height={8} fill="#7a8497" />
          <path d="M4,0 V8" stroke={INK} strokeWidth={3} />
        </pattern>
      </defs>

      <DemoSpans state={state} />

      <ObjectShape name={state.objectName} x={BAND_LEFT} y={geo.objectTop} w={objectW} />
      {/* 물건의 양 끝에서 띠로 내려오는 안내선(길이 글은 없다). */}
      <g data-part="end-guides" stroke="#7a8497" strokeWidth={2} strokeDasharray="4 6">
        <line x1={BAND_LEFT} y1={geo.objectTop + OBJECT_H} x2={BAND_LEFT} y2={geo.bandBottom} />
        <line
          x1={BAND_LEFT + objectW}
          y1={geo.objectTop + OBJECT_H}
          x2={BAND_LEFT + objectW}
          y2={geo.bandBottom}
        />
      </g>

      <rect
        data-part="band"
        x={BAND_LEFT}
        y={geo.bandTop}
        width={BAND_WIDTH}
        height={BAND_H}
        rx={6}
        fill="rgba(207,224,255,0.25)"
        stroke="#7a8497"
        strokeWidth={2}
      />
      {state.pieces.map((piece, index) => (
        <PieceShape
          key={index}
          svgRef={svgRef}
          ui={ui}
          locked={locked}
          index={index}
          piece={piece}
          geo={geo}
          rolling={piece.unit === 'm-tape' && rolling.includes(piece.start)}
        />
      ))}
      {state.showGapOverlap ? <GapOverlapMarks state={state} geo={geo} /> : null}
      {state.rulerMade ? <RulerTicks state={state} ui={ui} locked={locked} geo={geo} /> : null}

      {ghost?.kind === 'unit' && ghostDef ? (
        <rect
          data-part="ghost"
          x={ghost.x - ghostW / 2}
          y={ghost.y - (BAND_H - 8) / 2}
          width={ghostW}
          height={BAND_H - 8}
          rx={4}
          fill={ghostDef.fill}
          fillOpacity={0.6}
          stroke={ghostDef.stroke}
          strokeWidth={3}
          strokeDasharray="6 4"
        />
      ) : null}
      {ghost?.kind === 'card' ? (
        <g data-part="ghost">
          <circle
            cx={ghost.x}
            cy={ghost.y}
            r={24}
            fill="#fffdf6"
            fillOpacity={0.8}
            stroke={BLUE}
            strokeWidth={3}
          />
          <text
            x={ghost.x}
            y={ghost.y}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={24}
            fontWeight={800}
            fill={INK}
          >
            {ghost.value}
          </text>
        </g>
      ) : null}
    </svg>
  );
}
