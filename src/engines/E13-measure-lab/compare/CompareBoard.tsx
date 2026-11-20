/**
 * E13 compare-direct 판(논리 1000×600 SVG). 길이는 출발선 + 밧줄·연필·리본, 넓이는 손수건·책 겹치기,
 * 들이는 컵과 같은 투명 수조. 물건은 실제 비율대로 그리고, 어느 쪽이 더 긴지(많은지)는 글·속성으로 쓰지 않는다.
 * 끌기는 Pointer Events(useDrag), 키보드는 물건에 초점을 두고 방향키로 한 칸씩 옮긴다.
 */
import { useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, ReactNode, RefObject } from 'react';
import { pointerToLogical, useDrag } from '../../../core/engine-sdk';
import { num } from '../rat';
import { E13_STRINGS as S } from '../strings.ko';
import styles from '../View.module.css';
import {
  AREA_CELL,
  BASE_X,
  BOARD,
  boardHeight,
  CUP_BASE_Y,
  CUP_CENTERS,
  LENGTH_CELL,
  TANK,
  curvePoints,
  cupSize,
  pathOf,
  waterHeight,
} from './geometry';
import { snapPlacement } from './settings';
import type { AreaItem, CapacityCompareState, CompareState, LengthItem } from './types';
import type { CompareUi } from './useCompareUi';

const INK = '#1d2330';
const BLUE = '#2f6fde';
const ORANGE = '#e8872e';
const PULL_THRESHOLD = 24;

interface Props {
  readonly state: CompareState;
  readonly ui: CompareUi;
  readonly locked: boolean;
  readonly svgStyle: CSSProperties | undefined;
  readonly className: string | undefined;
}

/** 방향키 → 칸 이동량. 그 밖의 키는 null. */
function arrowStep(event: KeyboardEvent<Element>): { dx: number; dy: number } | null {
  switch (event.key) {
    case 'ArrowLeft':
      return { dx: -1, dy: 0 };
    case 'ArrowRight':
      return { dx: 1, dy: 0 };
    case 'ArrowUp':
      return { dx: 0, dy: -1 };
    case 'ArrowDown':
      return { dx: 0, dy: 1 };
    default:
      return null;
  }
}

interface DragShellProps {
  readonly svgRef: RefObject<SVGSVGElement>;
  readonly state: CompareState;
  readonly ui: CompareUi;
  readonly locked: boolean;
  readonly id: string;
  readonly label: string;
  readonly cell: number;
  readonly cellX: number;
  readonly cellY: number;
  /** 왼쪽 위(x=0,y=0)가 아닌 칸 → 논리 좌표 변환용 원점. */
  readonly originX: number;
  readonly originY: number;
  readonly hit: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
  readonly opacity?: number;
  readonly children: ReactNode;
  readonly outside?: (dragging: boolean) => ReactNode;
}

/** 물건 하나를 끄는 껍데기. 끄는 동안은 미리보기만, 손을 뗄 때 자석을 적용한 place Action을 한 번 보낸다. */
function DragShell({
  svgRef,
  state,
  ui,
  locked,
  id,
  label,
  cell,
  cellX,
  cellY,
  originX,
  originY,
  hit,
  opacity = 1,
  children,
  outside,
}: DragShellProps) {
  const [shift, setShift] = useState<{ dx: number; dy: number } | null>(null);
  const [focused, setFocused] = useState(false);
  const drag = useDrag({
    disabled: locked,
    getPoint: (event) => pointerToLogical(event, svgRef.current, BOARD),
    onStart: () => setShift({ dx: 0, dy: 0 }),
    onMove: (info) => setShift({ dx: info.delta.x, dy: info.delta.y }),
    onEnd: (info) => {
      setShift(null);
      const snapped = snapPlacement(
        state,
        id,
        cellX + info.delta.x / cell,
        cellY + info.delta.y / cell,
      );
      if (snapped.x !== cellX || snapped.y !== cellY) ui.place(id, snapped.x, snapped.y);
    },
    onCancel: () => setShift(null),
  });
  const x = originX + cellX * cell + (shift?.dx ?? 0);
  const y = originY + cellY * cell + (shift?.dy ?? 0);
  return (
    <g
      data-part="item"
      data-id={id}
      data-x={cellX}
      data-y={cellY}
      transform={`translate(${x} ${y})`}
    >
      <g
        className={styles.piece}
        role="button"
        tabIndex={locked ? -1 : 0}
        aria-label={S.compare.itemHint(label)}
        opacity={opacity}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(event) => {
          if (locked) return;
          const step = arrowStep(event);
          if (!step) return;
          event.preventDefault();
          ui.moveBy(id, step.dx, step.dy);
        }}
      >
        {children}
        {focused ? (
          <rect
            data-part="focus-ring"
            x={hit.x - 5}
            y={hit.y - 5}
            width={hit.w + 10}
            height={hit.h + 10}
            rx={8}
            fill="none"
            stroke={ORANGE}
            strokeWidth={4}
            strokeDasharray="8 5"
          />
        ) : null}
        <rect
          data-part="hit"
          x={hit.x}
          y={hit.y}
          width={hit.w}
          height={hit.h}
          fill="transparent"
          style={{ cursor: locked ? 'default' : 'grab', touchAction: 'none' }}
          {...drag.handlers}
        />
      </g>
      {outside ? outside(shift !== null) : null}
    </g>
  );
}

// ── 길이 ────────────────────────────────────────────────

function PencilShape({ length }: { readonly length: number }) {
  const total = length * LENGTH_CELL;
  const tip = Math.min(26, total * 0.3);
  return (
    <g data-part="pencil">
      <rect x={0} y={-14} width={14} height={28} fill="#f4a6b8" stroke={INK} strokeWidth={3} />
      <rect
        x={14}
        y={-14}
        width={total - tip - 14}
        height={28}
        fill="#f2c14e"
        stroke={INK}
        strokeWidth={3}
      />
      <polygon
        points={`${total - tip},-14 ${total},0 ${total - tip},14`}
        fill="#f3dcb4"
        stroke={INK}
        strokeWidth={3}
        strokeLinejoin="round"
      />
      <polygon points={`${total - 8},-3.5 ${total},0 ${total - 8},3.5`} fill={INK} />
    </g>
  );
}

function RibbonShape({ length }: { readonly length: number }) {
  const total = length * LENGTH_CELL;
  return (
    <polygon
      data-part="ribbon"
      points={`0,-13 ${total},-13 ${total - 14},0 ${total},13 0,13`}
      fill="#f08aa0"
      stroke={INK}
      strokeWidth={3}
      strokeLinejoin="round"
    />
  );
}

function RopeShape({ points }: { readonly points: readonly { x: number; y: number }[] }) {
  const d = pathOf(points);
  return (
    <g data-part="rope">
      <path d={d} fill="none" stroke={INK} strokeWidth={16} strokeLinejoin="round" />
      <path d={d} fill="none" stroke="#c98a4b" strokeWidth={10} strokeLinejoin="round" />
      <path d={d} fill="none" stroke="#fff3df" strokeWidth={2} strokeDasharray="3 9" />
    </g>
  );
}

interface LengthShapeProps {
  readonly svgRef: RefObject<SVGSVGElement>;
  readonly state: CompareState;
  readonly ui: CompareUi;
  readonly locked: boolean;
  readonly item: LengthItem;
  readonly straight: boolean;
  readonly canPull: boolean;
}

function LengthShape({ svgRef, state, ui, locked, item, straight, canPull }: LengthShapeProps) {
  const length = num(item.length);
  const total = length * LENGTH_CELL;
  const [pulled, setPulled] = useState(false);
  const curvy = item.shape === 'curvy' && !straight;
  const points = curvy && !pulled ? curvePoints(length) : null;
  const end = points ? points[points.length - 1] : undefined;
  const handleX = end ? end.x : total;
  const handleY = end ? end.y : 0;

  const pull = useDrag({
    disabled: locked || !canPull,
    getPoint: (event) => pointerToLogical(event, svgRef.current, BOARD),
    onStart: () => setPulled(false),
    onMove: (info) => setPulled(info.delta.x >= PULL_THRESHOLD),
    onEnd: (info) => {
      setPulled(false);
      if (info.delta.x >= PULL_THRESHOLD) ui.send({ type: 'straighten', id: item.id });
    },
    onCancel: () => setPulled(false),
  });

  const shape =
    item.kind === 'pencil' ? (
      <PencilShape length={length} />
    ) : curvy && points ? (
      <RopeShape points={points} />
    ) : item.kind === 'ribbon' ? (
      <RibbonShape length={length} />
    ) : (
      <RopeShape
        points={[
          { x: 0, y: 0 },
          { x: total, y: 0 },
        ]}
      />
    );
  const hitWidth = points && end ? Math.max(end.x, 60) : total;

  return (
    <DragShell
      svgRef={svgRef}
      state={state}
      ui={ui}
      locked={locked}
      id={item.id}
      label={item.label}
      cell={LENGTH_CELL}
      cellX={num(item.x)}
      cellY={num(item.y)}
      originX={BASE_X}
      originY={30}
      hit={{ x: 0, y: -40, w: hitWidth, h: 80 }}
      outside={() =>
        canPull ? (
          <g data-part="pull-handle">
            <circle
              cx={handleX}
              cy={handleY}
              r={16}
              fill="#ffffff"
              stroke={BLUE}
              strokeWidth={5}
              strokeDasharray={pulled ? '6 4' : undefined}
            />
            <circle
              cx={handleX}
              cy={handleY}
              r={44}
              fill="transparent"
              role="button"
              tabIndex={locked ? -1 : 0}
              aria-label={S.compare.pulledHandle(item.label)}
              style={{ cursor: locked ? 'default' : 'ew-resize', touchAction: 'none' }}
              onKeyDown={(event) => {
                if (locked) return;
                if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowRight') {
                  event.preventDefault();
                  ui.send({ type: 'straighten', id: item.id });
                }
              }}
              {...pull.handlers}
            />
          </g>
        ) : null
      }
    >
      {/* 왼쪽 끝 표시: 끝이 어디인지 잘 보이게 한다. */}
      <line x1={0} y1={-26} x2={0} y2={26} stroke={INK} strokeWidth={3} />
      {shape}
      <text x={4} y={-36} fontSize={22} fontWeight={800} fill={INK}>
        {item.label}
      </text>
    </DragShell>
  );
}

// ── 넓이 ────────────────────────────────────────────────

function AreaShape({
  svgRef,
  state,
  ui,
  locked,
  item,
  index,
  onTop,
}: {
  readonly svgRef: RefObject<SVGSVGElement>;
  readonly state: CompareState;
  readonly ui: CompareUi;
  readonly locked: boolean;
  readonly item: AreaItem;
  readonly index: number;
  readonly onTop: boolean;
}) {
  const w = num(item.w) * AREA_CELL;
  const h = num(item.h) * AREA_CELL;
  const fill =
    item.kind === 'book' ? '#c98a4b' : item.kind === 'handkerchief' ? '#cfe0ff' : '#fff7d6';
  return (
    <DragShell
      svgRef={svgRef}
      state={state}
      ui={ui}
      locked={locked}
      id={item.id}
      label={item.label}
      cell={AREA_CELL}
      cellX={num(item.x)}
      cellY={num(item.y)}
      originX={0}
      originY={0}
      opacity={onTop ? 0.62 : 1}
      hit={{ x: 0, y: 0, w, h }}
    >
      <rect
        data-part={item.kind}
        x={0}
        y={0}
        width={w}
        height={h}
        rx={item.kind === 'book' ? 4 : 8}
        fill={fill}
        stroke={index === 0 ? INK : BLUE}
        strokeWidth={4}
        strokeDasharray={item.kind === 'handkerchief' ? '14 6' : undefined}
      />
      {item.kind === 'book' ? (
        <rect x={0} y={0} width={14} height={h} fill="#8b5a2b" stroke={INK} strokeWidth={3} />
      ) : null}
      {item.kind === 'handkerchief' ? (
        <path d={`M8,8 L${w - 8},${h - 8} M${w - 8},8 L8,${h - 8}`} stroke={BLUE} strokeWidth={2} />
      ) : null}
      <text
        x={w / 2}
        y={h / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={22}
        fontWeight={800}
        fill={INK}
        stroke="#ffffff"
        strokeWidth={4}
        paintOrder="stroke"
      >
        {item.label}
      </text>
    </DragShell>
  );
}

// ── 들이 ────────────────────────────────────────────────

function CapacityBoard({ state }: { readonly state: CapacityCompareState }) {
  return (
    <>
      {state.items.map((item, index) => {
        const cx = CUP_CENTERS[index] ?? 250;
        const size = cupSize(item.shape, num(item.capacity));
        const poured = state.poured.includes(item.id);
        const left = cx - size.width / 2;
        const top = CUP_BASE_Y - size.height;
        const fillHeight = size.height * 0.88;
        return (
          <g key={item.id} data-part="cup-group" data-id={item.id}>
            <g role="img" aria-label={item.label} data-part="cup" data-shape={item.shape}>
              {poured ? null : (
                <rect
                  data-part="cup-water"
                  x={left + 3}
                  y={CUP_BASE_Y - fillHeight}
                  width={size.width - 6}
                  height={fillHeight - 3}
                  fill="#7ab8ff"
                />
              )}
              <path
                d={`M${left},${top} L${left},${CUP_BASE_Y} L${left + size.width},${CUP_BASE_Y} L${left + size.width},${top}`}
                fill="none"
                stroke={INK}
                strokeWidth={5}
                strokeLinejoin="round"
              />
            </g>
            <text
              x={cx}
              y={CUP_BASE_Y + 24}
              textAnchor="middle"
              fontSize={22}
              fontWeight={800}
              fill={INK}
            >
              {item.label}
            </text>
            {state.pour ? (
              <g data-part="tank" data-id={item.id} role="img" aria-label={S.compare.tankName}>
                {poured ? (
                  <rect
                    className={styles.water}
                    data-part="tank-water"
                    x={cx - TANK.width / 2 + 3}
                    y={TANK.bottom - waterHeight(num(item.capacity))}
                    width={TANK.width - 6}
                    height={waterHeight(num(item.capacity)) - 3}
                    fill="#7ab8ff"
                  />
                ) : null}
                <path
                  d={`M${cx - TANK.width / 2},${TANK.bottom - TANK.height} L${cx - TANK.width / 2},${TANK.bottom} L${cx + TANK.width / 2},${TANK.bottom} L${cx + TANK.width / 2},${TANK.bottom - TANK.height}`}
                  fill="rgba(207,224,255,0.25)"
                  stroke={INK}
                  strokeWidth={5}
                  strokeLinejoin="round"
                />
                <text
                  x={cx}
                  y={TANK.bottom + 28}
                  textAnchor="middle"
                  fontSize={20}
                  fontWeight={700}
                  fill={INK}
                >
                  {S.compare.tankName}
                </text>
              </g>
            ) : null}
          </g>
        );
      })}
    </>
  );
}

// ── 판 ──────────────────────────────────────────────────

export function CompareBoard({ state, ui, locked, svgStyle, className }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  return (
    <svg
      ref={svgRef}
      className={className}
      style={{ ...svgStyle, touchAction: 'none' }}
      viewBox={`0 0 ${BOARD.width} ${boardHeight(state)}`}
      preserveAspectRatio="xMidYMid meet"
      data-testid="compare-canvas"
      data-attribute={state.attribute}
      role="group"
      aria-label={S.compare.boardLabel}
    >
      {state.attribute === 'length' ? (
        <>
          {state.baseline ? (
            <g data-part="baseline">
              <line
                x1={BASE_X}
                y1={40}
                x2={BASE_X}
                y2={boardHeight(state) - 20}
                stroke={ORANGE}
                strokeWidth={6}
              />
              <text x={BASE_X} y={28} textAnchor="middle" fontSize={22} fontWeight={800} fill={INK}>
                {S.compare.baselineName}
              </text>
            </g>
          ) : null}
          {state.items.map((item) => {
            const straight = state.straightened.includes(item.id);
            return (
              <LengthShape
                key={item.id}
                svgRef={svgRef}
                state={state}
                ui={ui}
                locked={locked}
                item={item}
                straight={straight}
                canPull={state.straighten && item.shape === 'curvy' && !straight}
              />
            );
          })}
        </>
      ) : null}
      {state.attribute === 'area'
        ? [...state.items]
            .map((item, index) => ({ item, index }))
            .sort((a, b) => Number(a.item.id === state.last) - Number(b.item.id === state.last))
            .map(({ item, index }) => (
              <AreaShape
                key={item.id}
                svgRef={svgRef}
                state={state}
                ui={ui}
                locked={locked}
                item={item}
                index={index}
                onTop={item.id === state.last}
              />
            ))
        : null}
      {state.attribute === 'capacity' ? <CapacityBoard state={state} /> : null}
    </svg>
  );
}
