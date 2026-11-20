/**
 * E14 duration 판(논리 1000×600 SVG). 시 단위 블록 띠 위에 시작·끝 표시를 끌어 놓으면
 * 사이가 색칠·빗금으로 칠해진다. 걸린 시간은 글로 쓰지 않는다(Observation에만 있다).
 * 끄는 동안의 좌표는 지역 미리보기에만 두고, 놓을 때 set-mark Action 하나만 보낸다.
 */
import { useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { pointerToLogical, useDrag } from '../../../core/engine-sdk';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import { E14_MODE_STRINGS } from '../strings-modes.ko';
import {
  BAND,
  DROP_ZONE,
  TRAY,
  blocksOf,
  gapCenterX,
  nearestMinutes,
  pieces,
  xInBlock,
  xOfMinutes,
} from './layout';
import { hourLabel } from './settings';
import type { DurationState, MarkName } from './types';
import type { DurationUi } from './useDurationUi';

const S = E14_MODE_STRINGS.duration;
const INK = '#1d2330';
const BLUE = '#2f6fde';
const ORANGE = '#e8872e';
const LOGICAL = { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT };

interface Props {
  readonly state: DurationState;
  readonly ui: DurationUi;
  readonly svgStyle: CSSProperties | undefined;
  readonly className: string | undefined;
}

interface Preview {
  readonly which: MarkName;
  readonly x: number;
  readonly y: number;
}

function sentence(minutes: number | null): string {
  if (minutes === null) return S.notPlaced;
  return S.markAt(hourLabel(minutes), minutes % 60);
}

export function DurationBoard({ state, ui, svgStyle, className }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [focused, setFocused] = useState<MarkName | null>(null);

  const useMarkDrag = (which: MarkName, disabled: boolean) =>
    useDrag({
      disabled,
      getPoint: (event) => pointerToLogical(event, svgRef.current, LOGICAL),
      onStart: (info) => setPreview({ which, x: info.current.x, y: info.current.y }),
      onMove: (info) => setPreview({ which, x: info.current.x, y: info.current.y }),
      onEnd: (info) => {
        setPreview(null);
        if (info.current.y < DROP_ZONE.top || info.current.y > DROP_ZONE.bottom) return;
        ui.send({ type: 'set-mark', which, minutes: nearestMinutes(state, info.current.x) });
      },
      onCancel: () => setPreview(null),
    });

  const startLocked = ui.locked || state.startFixed;
  const startDrag = useMarkDrag('start', startLocked);
  const endDrag = useMarkDrag('end', ui.locked);

  const blocks = blocksOf(state);
  const { start, end } = state;
  const both = start !== null && end !== null;
  const anyUnplaced = start === null || end === null;

  const renderMark = (which: MarkName) => {
    const minutes = which === 'start' ? start : end;
    const locked = which === 'start' ? startLocked : ui.locked;
    const drag = which === 'start' ? startDrag : endDrag;
    const dragging = preview?.which === which;
    let x: number;
    let y: number;
    if (dragging && preview) {
      x = preview.x;
      y = preview.y + 20;
    } else if (minutes === null) {
      x = which === 'start' ? TRAY.startX : TRAY.endX;
      y = TRAY.y;
    } else {
      x = xOfMinutes(state, minutes);
      y = BAND.markApexY;
    }
    const name = which === 'start' ? S.startName : S.endName;
    const fill = which === 'start' ? BLUE : ORANGE;
    return (
      <g
        key={which}
        data-part={`mark-${which}`}
        data-placed={minutes === null ? 'false' : 'true'}
        data-x={x.toFixed(2)}
        role="slider"
        tabIndex={locked ? -1 : 0}
        aria-label={which === 'start' ? S.startMark : S.endMark}
        aria-orientation="horizontal"
        aria-readonly={locked ? true : undefined}
        aria-valuetext={sentence(minutes)}
        onKeyDown={
          locked
            ? undefined
            : (event) => {
                if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
                event.preventDefault();
                ui.moveMark(which, event.key === 'ArrowRight' ? 1 : -1);
              }
        }
        onFocus={() => setFocused(which)}
        onBlur={() => setFocused((current) => (current === which ? null : current))}
        style={{ outline: 'none' }}
        transform={`translate(${x} ${y})`}
      >
        <polygon
          points="-18,-34 18,-34 0,0"
          fill={fill}
          stroke={focused === which ? INK : '#ffffff'}
          strokeWidth={focused === which ? 5 : 2.5}
          strokeLinejoin="round"
        />
        <text
          x={0}
          y={-44}
          textAnchor="middle"
          fontSize={26}
          fontWeight={800}
          fill={INK}
          stroke="#ffffff"
          strokeWidth={5}
          paintOrder="stroke"
        >
          {name}
        </text>
        <rect
          data-part={`mark-${which}-hit`}
          x={-46}
          y={-88}
          width={92}
          height={96}
          fill="transparent"
          style={{ cursor: locked ? 'default' : 'grab', touchAction: 'none' }}
          {...drag.handlers}
        />
      </g>
    );
  };

  return (
    <svg
      ref={svgRef}
      className={className}
      style={{ ...svgStyle, touchAction: 'none' }}
      viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`}
      preserveAspectRatio="xMidYMid meet"
      data-testid="clock-canvas"
      data-mode="duration"
      role="group"
      aria-label={S.boardLabel}
    >
      <defs>
        <pattern
          id="e14-hatch"
          width={10}
          height={10}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line x1={0} y1={0} x2={0} y2={10} stroke="#ffffff" strokeWidth={4} />
        </pattern>
      </defs>

      {anyUnplaced ? (
        <g data-part="tray">
          <rect
            x={TRAY.left}
            y={TRAY.top}
            width={TRAY.right - TRAY.left}
            height={TRAY.bottom - TRAY.top}
            rx={14}
            fill="#f6f8fc"
            stroke="#9aa6bd"
            strokeWidth={2.5}
            strokeDasharray="10 6"
          />
          <text
            x={(TRAY.left + TRAY.right) / 2}
            y={TRAY.bottom - 12}
            textAnchor="middle"
            fontSize={17}
            fontWeight={700}
            fill="#3d485c"
          >
            {S.trayCaption}
          </text>
        </g>
      ) : null}

      <g data-part="band">
        {blocks.map((block) => (
          <rect
            key={block.index}
            data-part="block"
            x={block.x0}
            y={BAND.barTop}
            width={block.x1 - block.x0}
            height={BAND.barBottom - BAND.barTop}
            rx={4}
            fill="#fffdf6"
            stroke={INK}
            strokeWidth={3}
          />
        ))}

        {both
          ? pieces(state, start, end).map((piece) => {
              const block = blocks[piece.block];
              if (!block) return null;
              const x0 = xInBlock(block, piece.lo - block.base);
              const x1 = xInBlock(block, piece.hi - block.base);
              const props = {
                x: x0,
                y: BAND.barTop + 3,
                width: x1 - x0,
                height: BAND.barBottom - BAND.barTop - 6,
              };
              return (
                <g key={piece.block} data-part="span-piece" data-block={piece.block}>
                  <rect {...props} fill="rgba(47, 111, 222, 0.38)" />
                  <rect {...props} fill="url(#e14-hatch)" opacity={0.55} />
                </g>
              );
            })
          : null}

        {blocks.map((block) => (
          <g key={block.index} data-part="ticks">
            {Array.from({ length: 60 / state.step + 1 }, (_, i) => {
              const j = i * state.step;
              const x = xInBlock(block, j);
              const edge = j === 0 || j === 60;
              const five = j % 5 === 0;
              return (
                <line
                  key={j}
                  x1={x}
                  y1={BAND.barBottom}
                  x2={x}
                  y2={edge ? BAND.barTop - 8 : BAND.barBottom - (five ? 22 : 11)}
                  stroke={INK}
                  strokeWidth={edge ? 6 : five ? 3 : 1.5}
                />
              );
            })}
            {[10, 20, 30, 40, 50].map((j) => (
              <text
                key={j}
                data-part="block-minute"
                x={xInBlock(block, j)}
                y={BAND.numY}
                textAnchor="middle"
                fontSize={19}
                fontWeight={700}
                fill={INK}
              >
                {j}
              </text>
            ))}
          </g>
        ))}

        {Array.from({ length: blocks.length + 1 }, (_, k) => {
          const minutes = state.from + k * 60;
          const x =
            k === 0 ? BAND.left : k === blocks.length ? BAND.right : gapCenterX(state, minutes);
          return (
            <text
              key={k}
              data-part="hour-name"
              x={x}
              y={BAND.nameY}
              textAnchor="middle"
              fontSize={28}
              fontWeight={800}
              fill={INK}
            >
              {S.hourName(hourLabel(minutes))}
            </text>
          );
        })}
      </g>

      {renderMark('start')}
      {renderMark('end')}
    </svg>
  );
}
