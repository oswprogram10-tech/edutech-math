/**
 * E13 capacity 판(논리 너비 1000 SVG). 그릇의 물 높이로만 양을 보여 준다.
 * 물의 양(mL)과 들이는 글·DOM·aria·data-에 쓰지 않는다. 학생이 센 컵 수("컵 n번")만 글로 쓴다.
 * - cup-count: 그릇을 누르거나 [컵으로 붓기]로 컵 하나씩 붓는다.
 * - puzzle: 눈금 없는 비커 둘. 비커를 다른 비커 위로 끌어 놓으면 붓는다.
 */
import { useState } from 'react';
import type { CSSProperties, RefObject } from 'react';
import { pointerToLogical, useDrag } from '../../../core/engine-sdk';
import { E13_STRINGS as S } from '../strings.ko';
import {
  BOARD,
  CUP_ICON,
  FAUCET,
  SINK,
  boardHeight,
  closedPath,
  containerGeo,
  outlinePath,
  r2,
} from './layout';
import type { ContainerGeo } from './layout';
import { cupsOf, fillRatio } from './settings';
import type { CapacityContainer, CapacityState } from './types';
import type { CapacityUi } from './useCapacityUi';

const INK = '#1d2330';
const WATER = '#7ab8ff';

interface Props {
  readonly svgRef: RefObject<SVGSVGElement>;
  readonly state: CapacityState;
  readonly ui: CapacityUi;
  readonly locked: boolean;
  readonly svgStyle: CSSProperties | undefined;
  readonly className: string | undefined;
}

interface ShapeProps {
  readonly container: CapacityContainer;
  readonly geo: ContainerGeo;
  readonly ratio: number;
}

/** 그릇 그림: 물(아래에서 위로 차오름) + 바깥선. */
function ContainerArt({ container, geo, ratio }: ShapeProps) {
  const clipId = `cap-clip-${container.id}`;
  const top = geo.base - geo.h;
  return (
    <g data-part="art" data-kind={container.kind} data-shape={container.shape}>
      <clipPath id={clipId}>
        <path d={closedPath(container.kind, geo)} />
      </clipPath>
      <g clipPath={`url(#${clipId})`}>
        <rect
          data-part="water"
          x={geo.cx - geo.w / 2}
          y={top}
          width={geo.w}
          height={geo.h}
          fill={WATER}
          style={{
            transform: `scaleY(${r2(ratio)})`,
            transformBox: 'fill-box',
            transformOrigin: '50% 100%',
            transition: 'transform 300ms ease-out',
          }}
        />
      </g>
      <path
        d={outlinePath(container.kind, geo)}
        fill="none"
        stroke={INK}
        strokeWidth={5}
        strokeLinejoin="round"
        style={{ pointerEvents: 'none' }}
      />
    </g>
  );
}

function CupIcon({ y }: { readonly y: number }) {
  const { cx, w, h } = CUP_ICON;
  return (
    <g data-part="cup-icon" role="img" aria-label={S.capacity.cupName}>
      <path
        d={`M${cx - w / 2},${y - h} L${cx - w / 2 + 8},${y} H${cx + w / 2 - 8} L${cx + w / 2},${y - h}`}
        fill="#e8f3ff"
        stroke={INK}
        strokeWidth={5}
        strokeLinejoin="round"
      />
      <path
        d={`M${cx + w / 2 - 2},${y - h * 0.7} q26,6 20,${h * 0.4} q-4,16 -${w * 0.2},${h * 0.1}`}
        fill="none"
        stroke={INK}
        strokeWidth={5}
      />
      <text x={cx} y={y + 26} textAnchor="middle" fontSize={22} fontWeight={800} fill={INK}>
        {S.capacity.cupName}
      </text>
    </g>
  );
}

function CupCountBoard({ state, ui, locked }: Pick<Props, 'state' | 'ui' | 'locked'>) {
  return (
    <>
      {state.containers.map((container, index) => {
        const geo = containerGeo(state, index);
        const cups = cupsOf(state, container.id);
        return (
          <g
            key={container.id}
            data-part="container"
            data-id={container.id}
            role="img"
            aria-label={container.label}
          >
            <ContainerArt container={container} geo={geo} ratio={fillRatio(state, container)} />
            <rect
              data-part="hit"
              x={geo.cx - geo.w / 2}
              y={geo.base - geo.h}
              width={geo.w}
              height={geo.h}
              fill="transparent"
              style={{ cursor: locked ? 'default' : 'pointer' }}
              onClick={() => ui.send({ type: 'pour-cup', id: container.id })}
            />
            <text
              x={geo.cx}
              y={geo.base + 28}
              textAnchor="middle"
              fontSize={24}
              fontWeight={800}
              fill={INK}
            >
              {container.label}
            </text>
            <text
              data-part="cup-count"
              x={geo.cx}
              y={geo.base + 62}
              textAnchor="middle"
              fontSize={28}
              fontWeight={800}
              fill="#8a4b00"
            >
              {S.capacity.cupsCount(cups)}
            </text>
          </g>
        );
      })}
      <CupIcon y={state.containers.length > 0 ? containerGeo(state, 0).base : 320} />
    </>
  );
}

interface BeakerProps {
  readonly svgRef: RefObject<SVGSVGElement>;
  readonly state: CapacityState;
  readonly ui: CapacityUi;
  readonly locked: boolean;
  readonly container: CapacityContainer;
  readonly index: number;
}

/** 비커 하나. 끄는 동안은 미리보기만, 손을 뗄 때 다른 비커 위면 pour Action 한 번을 보낸다. */
function Beaker({ svgRef, state, ui, locked, container, index }: BeakerProps) {
  const [shift, setShift] = useState<{ dx: number; dy: number } | null>(null);
  const geo = containerGeo(state, index);
  const size = { width: BOARD.width, height: boardHeight(state) };
  const drag = useDrag({
    disabled: locked,
    getPoint: (event) => pointerToLogical(event, svgRef.current, size),
    onStart: () => setShift({ dx: 0, dy: 0 }),
    onMove: (info) => setShift({ dx: info.delta.x, dy: info.delta.y }),
    onEnd: (info) => {
      setShift(null);
      const hit = state.containers.findIndex((other, i) => {
        if (other.id === container.id) return false;
        const g = containerGeo(state, i);
        return (
          Math.abs(info.current.x - g.cx) <= g.w / 2 + 30 &&
          info.current.y >= g.base - g.h - 40 &&
          info.current.y <= g.base + 20
        );
      });
      const target = state.containers[hit];
      if (target !== undefined) ui.send({ type: 'pour', from: container.id, to: target.id });
    },
    onCancel: () => setShift(null),
  });
  return (
    <g
      data-part="beaker"
      data-id={container.id}
      transform={`translate(${shift?.dx ?? 0} ${shift?.dy ?? 0})`}
      opacity={shift === null ? 1 : 0.85}
      role="img"
      aria-label={container.label}
    >
      <ContainerArt container={container} geo={geo} ratio={fillRatio(state, container)} />
      <rect
        data-part="hit"
        x={geo.cx - geo.w / 2 - 6}
        y={geo.base - geo.h - 6}
        width={geo.w + 12}
        height={geo.h + 12}
        fill="transparent"
        style={{ cursor: locked ? 'default' : 'grab', touchAction: 'none' }}
        {...drag.handlers}
      />
      <text
        x={geo.cx}
        y={geo.base + 30}
        textAnchor="middle"
        fontSize={24}
        fontWeight={800}
        fill={INK}
      >
        {container.label}
      </text>
    </g>
  );
}

function PuzzleBoard({ svgRef, state, ui, locked }: Omit<Props, 'svgStyle' | 'className'>) {
  return (
    <>
      <g data-part="faucet" role="img" aria-label={S.capacity.faucet}>
        <path
          d={`M${FAUCET.x},${FAUCET.y + 20} H${FAUCET.x + 150} V${FAUCET.y + 52}`}
          fill="none"
          stroke="#4a5568"
          strokeWidth={16}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={`M${FAUCET.x + 150},${FAUCET.y + 78} q-12,20 0,26 q12,-6 0,-26 Z`}
          fill={WATER}
          stroke={INK}
          strokeWidth={3}
        />
        <text
          x={FAUCET.x + 70}
          y={FAUCET.y - 6}
          textAnchor="middle"
          fontSize={22}
          fontWeight={800}
          fill={INK}
        >
          {S.capacity.faucet}
        </text>
      </g>
      <g data-part="sink" role="img" aria-label={S.capacity.sink}>
        <path
          d={`M${SINK.x},${SINK.y} V${SINK.y + SINK.h} H${SINK.x + SINK.w} V${SINK.y}`}
          fill="#eef1f6"
          stroke="#4a5568"
          strokeWidth={5}
          strokeLinejoin="round"
        />
        <line
          x1={SINK.x + SINK.w / 2}
          y1={SINK.y + SINK.h - 22}
          x2={SINK.x + SINK.w / 2}
          y2={SINK.y + SINK.h - 8}
          stroke="#4a5568"
          strokeWidth={5}
          strokeLinecap="round"
        />
        <text
          x={SINK.x + SINK.w / 2}
          y={SINK.y + SINK.h + 30}
          textAnchor="middle"
          fontSize={22}
          fontWeight={800}
          fill={INK}
        >
          {S.capacity.sink}
        </text>
      </g>
      {state.containers.map((container, index) => (
        <Beaker
          key={container.id}
          svgRef={svgRef}
          state={state}
          ui={ui}
          locked={locked}
          container={container}
          index={index}
        />
      ))}
    </>
  );
}

export function CapacityBoard({ svgRef, state, ui, locked, svgStyle, className }: Props) {
  return (
    <svg
      ref={svgRef}
      className={className}
      style={{ ...svgStyle, touchAction: 'manipulation' }}
      viewBox={`0 0 ${BOARD.width} ${boardHeight(state)}`}
      preserveAspectRatio="xMidYMid meet"
      data-testid="capacity-canvas"
      data-variant={state.variant}
      role="group"
      aria-label={S.capacity.boardLabel}
    >
      {state.variant === 'puzzle' ? (
        <PuzzleBoard svgRef={svgRef} state={state} ui={ui} locked={locked} />
      ) : (
        <CupCountBoard state={state} ui={ui} locked={locked} />
      )}
    </svg>
  );
}
