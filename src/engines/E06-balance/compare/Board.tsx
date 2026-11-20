/**
 * compare 판 그림(논리 1000×600 SVG): 양팔저울 + 아래 선반의 물건들.
 * 물건은 끌어서 접시·선반으로 옮긴다(Pointer Events). 키보드 대체 조작은 View가 맡는다.
 * 기울기는 글("왼쪽이 더 무거워요")과 `data-tilt`로도 알린다(색만으로 전달하지 않는다).
 * `showValues`가 false이면 무게 숫자를 DOM·aria·data- 어디에도 쓰지 않는다.
 */
import type { CSSProperties, PointerEvent as ReactPointerEvent, Ref } from 'react';
import {
  BEAM_HALF,
  PAN_CENTER,
  PAN_HALF,
  PAN_SURFACE_Y,
  PIVOT,
  beamRotation,
  tiltDegreesOf,
} from '../layout';
import { balanceStrings as S } from '../strings.ko';
import styles from '../View.module.css';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import { ItemArt } from './Art';
import itemStyles from './compare.module.css';
import {
  MIN_HIT,
  RESULT_Y,
  SHELF_BOTTOM,
  SHELF_LABEL_Y,
  SHELF_TOP,
  SIZE_PX,
  STAND_BASE_Y,
  placementOf,
  tiltOffsets,
} from './layout';
import { placeOf, readCompare } from './reduce';
import { compareStrings as C } from './strings.ko';
import type { CompareItem, CompareState } from './types';

const INK = '#1d2330';

export interface DragPoint {
  readonly id: string;
  readonly x: number;
  readonly y: number;
}

export interface ItemHandlers {
  readonly onPointerDown: (id: string, event: ReactPointerEvent<SVGGElement>) => void;
  readonly onPointerMove: (id: string, event: ReactPointerEvent<SVGGElement>) => void;
  readonly onPointerUp: (id: string, event: ReactPointerEvent<SVGGElement>) => void;
  readonly onPointerCancel: (id: string) => void;
  readonly onFocus: (id: string) => void;
}

export interface CompareBoardProps {
  readonly state: CompareState;
  readonly svgStyle?: CSSProperties;
  readonly className?: string;
  readonly svgRef?: Ref<SVGSVGElement>;
  readonly selectedId: string | null;
  readonly drag: DragPoint | null;
  readonly handlers: ItemHandlers;
  readonly resultText: string;
}

function Stand() {
  return (
    <path
      d={`M${PIVOT.x} ${PIVOT.y} V${STAND_BASE_Y} M${PIVOT.x - 130} ${STAND_BASE_Y} H${PIVOT.x + 130}`}
      stroke="#4a5568"
      strokeWidth={14}
      strokeLinecap="round"
      fill="none"
    />
  );
}

function Pan({
  name,
  offset,
}: {
  readonly name: 'left' | 'right';
  readonly offset: { readonly dx: number; readonly dy: number };
}) {
  const cx = PAN_CENTER[name];
  return (
    <g
      className={styles.motion}
      role="group"
      aria-label={S.panLabel[name]}
      data-pan={name}
      style={{ transform: `translate(${offset.dx}px, ${offset.dy}px)` } as CSSProperties}
    >
      <path
        d={`M${cx} ${PIVOT.y} L${cx - PAN_HALF} ${PAN_SURFACE_Y} M${cx} ${PIVOT.y} L${cx + PAN_HALF} ${PAN_SURFACE_Y}`}
        stroke="#4a5568"
        strokeWidth={3}
        fill="none"
      />
      <path
        d={`M${cx - PAN_HALF} ${PAN_SURFACE_Y} H${cx + PAN_HALF} Q${cx + PAN_HALF - 10} ${PAN_SURFACE_Y + 44} ${cx} ${PAN_SURFACE_Y + 44} Q${cx - PAN_HALF + 10} ${PAN_SURFACE_Y + 44} ${cx - PAN_HALF} ${PAN_SURFACE_Y} Z`}
        fill="#e8edf6"
        stroke="#4a5568"
        strokeWidth={4}
      />
    </g>
  );
}

function itemLabel(state: CompareState, item: CompareItem): string {
  const name = C.names[item.kind];
  const base = C.itemLabel(name, C.place[placeOf(state, item.id)]);
  return state.showValues ? `${base}, ${C.weightLabel(String(item.weight))}` : base;
}

export function CompareBoard({
  state,
  svgStyle,
  className,
  svgRef,
  selectedId,
  drag,
  handlers,
  resultText,
}: CompareBoardProps) {
  const reading = readCompare(state);
  const offsets = tiltOffsets(reading.left, reading.right, reading.tilt);
  const degrees = tiltDegreesOf(reading.left, reading.right);
  const rotation = beamRotation(reading.tilt, degrees);
  const dragged = drag === null ? undefined : state.items.find((item) => item.id === drag.id);
  return (
    <svg
      ref={svgRef}
      className={className}
      viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`}
      style={svgStyle}
      role="group"
      aria-label={S.canvasLabel}
      data-testid="balance-canvas"
      data-tilt={reading.tilt}
      data-mode="compare"
    >
      <rect width={LOGICAL_WIDTH} height={LOGICAL_HEIGHT} rx={16} fill="#fbfaf6" />
      <Stand />
      <g
        className={styles.motion}
        data-part="beam"
        style={
          {
            transform: `rotate(${rotation}deg)`,
            transformOrigin: `${PIVOT.x}px ${PIVOT.y}px`,
          } as CSSProperties
        }
      >
        <line
          x1={PIVOT.x - BEAM_HALF}
          y1={PIVOT.y}
          x2={PIVOT.x + BEAM_HALF}
          y2={PIVOT.y}
          stroke="#4a5568"
          strokeWidth={12}
          strokeLinecap="round"
        />
      </g>
      <Pan name="left" offset={offsets.left} />
      <Pan name="right" offset={offsets.right} />
      <circle cx={PIVOT.x} cy={PIVOT.y} r={16} fill="#4a5568" />
      <g role="group" aria-label={C.shelfLabel} data-part="shelf">
        <rect
          x={40}
          y={SHELF_TOP}
          width={920}
          height={SHELF_BOTTOM - SHELF_TOP}
          rx={14}
          fill="#efe6d4"
          stroke="#8a6d3b"
          strokeWidth={3}
        />
      </g>
      {state.items.map((item) => {
        const place = placeOf(state, item.id);
        const spot = placementOf(state, item.id, offsets);
        const size = SIZE_PX[item.size] * spot.scale;
        const hit = Math.max(MIN_HIT * Math.min(1, spot.scale + 0.2), size);
        const isDrag = drag?.id === item.id;
        const name = C.names[item.kind];
        const selected = selectedId === item.id;
        return (
          <g
            key={item.id}
            className={`${itemStyles.item} ${isDrag ? '' : styles.motion}`}
            style={{ transform: `translate(${spot.x}px, ${spot.y}px)` } as CSSProperties}
            opacity={isDrag ? 0.35 : 1}
            role="button"
            tabIndex={0}
            aria-label={itemLabel(state, item)}
            aria-pressed={selected}
            data-item={item.id}
            data-place={place}
            onPointerDown={(event) => handlers.onPointerDown(item.id, event)}
            onPointerMove={(event) => handlers.onPointerMove(item.id, event)}
            onPointerUp={(event) => handlers.onPointerUp(item.id, event)}
            onPointerCancel={() => handlers.onPointerCancel(item.id)}
            onFocus={() => handlers.onFocus(item.id)}
          >
            <rect
              x={-hit / 2}
              y={-hit + (hit - size) / 2}
              width={hit}
              height={hit}
              fill="transparent"
              data-part="hit"
            />
            {selected ? (
              <rect
                x={-size / 2 - 8}
                y={-size - 8}
                width={size + 16}
                height={size + 16}
                rx={12}
                fill="none"
                stroke="#e8872e"
                strokeWidth={4}
                strokeDasharray="10 6"
                data-part="selected"
              />
            ) : null}
            <ItemArt kind={item.kind} size={size} />
            {place === 'shelf' ? (
              <text
                x={0}
                y={SHELF_LABEL_Y - spot.y}
                textAnchor="middle"
                fontSize={22}
                fontWeight={700}
                fill={INK}
              >
                {state.showValues ? `${name} ${item.weight}` : name}
              </text>
            ) : state.showValues ? (
              <text x={0} y={26} textAnchor="middle" fontSize={24} fontWeight={800} fill={INK}>
                {item.weight}
              </text>
            ) : null}
          </g>
        );
      })}
      {drag !== null && dragged !== undefined ? (
        <g
          transform={`translate(${drag.x} ${drag.y + SIZE_PX[dragged.size] / 2})`}
          opacity={0.9}
          pointerEvents="none"
          data-part="drag-ghost"
        >
          <ItemArt kind={dragged.kind} size={SIZE_PX[dragged.size]} />
        </g>
      ) : null}
      <text
        x={PIVOT.x}
        y={RESULT_Y}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={30}
        fontWeight={800}
        fill={INK}
        role="status"
        aria-live="polite"
        data-testid="balance-result"
      >
        {resultText}
      </text>
    </svg>
  );
}
