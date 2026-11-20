/**
 * E20 mix 판 그림(논리 1000×600 SVG). look 셋: blocks(블록 컵) / strip(띠 그림) / ratio(글만).
 *
 * 색만으로 전달하지 않는다: 시럽 블록은 점 무늬, 띠 위 표시는 모양(▲ 기준, ● 내 컵, ■ 비교 컵)과
 * 이름표로 보인다. 화면·DOM·aria 어디에도 목표 값은 나오지 않는다(엔진이 모른다).
 */
import { useId } from 'react';
import type { CSSProperties } from 'react';
import {
  BROWNS,
  CUP_GEOMETRY as CUP,
  MARKER_LABEL_STEP,
  MARKER_LABEL_Y,
  STRIP,
  markerRows,
  mixCups,
  stageOf,
  stripX,
} from './layout';
import type { CupLayout } from './layout';
import { E20_STRINGS as S } from './strings.ko';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from './types';
import type { MixState } from './types';

const INK = '#1d2330';
const MARKER_TOP = 450;

function patternId(base: string, uid: string): string {
  return `e20-${base}-${uid.replace(/[^a-zA-Z0-9]/g, '')}`;
}

function Cup({ cup }: { cup: CupLayout }) {
  const { body } = cup;
  if (body === null) return null;
  const poly = `${body.x},${body.y} ${body.x + body.w},${body.y} ${body.x + body.w - CUP.taper},${body.y + body.h} ${body.x + CUP.taper},${body.y + body.h}`;
  return (
    <polygon points={poly} fill="#fbfdff" stroke="#4b566b" strokeWidth={4} strokeLinejoin="round" />
  );
}

function Blocks({ cup, dotsId }: { cup: CupLayout; dotsId: string }) {
  return (
    <g data-part="blocks">
      {cup.blocks.map((block) => (
        <g key={`${block.kind}-${block.index}`} data-block={block.kind}>
          {block.kind === 'milk' ? (
            <rect
              x={block.x + 1}
              y={block.y + 1}
              width={block.w - 2}
              height={block.h - 2}
              fill="#ffffff"
              stroke="#6b7487"
              strokeWidth={1.5}
            />
          ) : (
            <>
              <rect
                x={block.x + 1}
                y={block.y + 1}
                width={block.w - 2}
                height={block.h - 2}
                fill="#6b3f1d"
                stroke="#3f230f"
                strokeWidth={1.5}
              />
              <rect
                x={block.x + 1}
                y={block.y + 1}
                width={block.w - 2}
                height={block.h - 2}
                fill={`url(#${dotsId})`}
              />
            </>
          )}
        </g>
      ))}
    </g>
  );
}

function Marker({ cup, row }: { cup: CupLayout; row: number }) {
  if (cup.position === null) return null;
  const x = stripX(cup.position);
  const labelY = MARKER_LABEL_Y + row * MARKER_LABEL_STEP;
  return (
    <g
      data-marker={cup.role}
      data-key={cup.key}
      data-pos={cup.position.toString()}
      data-stage={stageOf(cup.position)}
      data-x={x.toFixed(2)}
    >
      <line x1={x} y1={labelY + 6} x2={x} y2={MARKER_TOP} stroke={INK} strokeWidth={2} />
      {cup.role === 'reference' ? (
        <polygon
          points={`${x - 13},${MARKER_TOP} ${x + 13},${MARKER_TOP} ${x},${MARKER_TOP + 24}`}
          fill={INK}
          stroke="#ffffff"
          strokeWidth={2}
        />
      ) : cup.role === 'cup' ? (
        <circle cx={x} cy={MARKER_TOP + 12} r={12} fill={INK} stroke="#ffffff" strokeWidth={2} />
      ) : (
        <rect
          x={x - 11}
          y={MARKER_TOP + 1}
          width={22}
          height={22}
          fill={INK}
          stroke="#ffffff"
          strokeWidth={2}
        />
      )}
      <text
        x={x}
        y={labelY}
        textAnchor="middle"
        fontSize={20}
        fontWeight={800}
        fill={INK}
        stroke="#ffffff"
        strokeWidth={4}
        paintOrder="stroke"
      >
        {cup.label}
      </text>
    </g>
  );
}

function Strip({ cups }: { cups: readonly CupLayout[] }) {
  const segment = STRIP.w / BROWNS.length;
  const rows = markerRows(cups);
  return (
    <g data-part="strip">
      {BROWNS.map((color, i) => (
        <rect
          key={color}
          x={STRIP.x + i * segment}
          y={STRIP.y}
          width={segment}
          height={STRIP.h}
          fill={color}
          stroke="#8b96ab"
          strokeWidth={1}
        />
      ))}
      <rect
        x={STRIP.x}
        y={STRIP.y}
        width={STRIP.w}
        height={STRIP.h}
        fill="none"
        stroke={INK}
        strokeWidth={3}
      />
      <text x={STRIP.x} y={STRIP.y + STRIP.h + 30} fontSize={20} fontWeight={700} fill={INK}>
        {S.mix.stripLight}
      </text>
      <text
        x={STRIP.x + STRIP.w}
        y={STRIP.y + STRIP.h + 30}
        textAnchor="end"
        fontSize={20}
        fontWeight={700}
        fill={INK}
      >
        {S.mix.stripDark}
      </text>
      {cups.map((cup) => (
        <Marker key={cup.key} cup={cup} row={rows.get(cup.key) ?? 0} />
      ))}
    </g>
  );
}

export interface MixBoardProps {
  readonly state: MixState;
  readonly svgStyle?: CSSProperties;
  readonly className?: string;
}

export function MixBoard({ state, svgStyle, className }: MixBoardProps) {
  const uid = useId();
  const dotsId = patternId('dots', uid);
  const { look, showStrip } = state.settings;
  const cups = mixCups(state);
  const mine = cups.find((c) => c.role === 'cup');
  return (
    <svg
      className={className}
      viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`}
      style={svgStyle}
      role="group"
      aria-label={S.canvasLabel}
      data-testid="ratio-canvas"
      data-mode="mix"
      data-look={look}
      data-cup-milk={mine?.milk}
      data-cup-syrup={mine?.syrup}
    >
      <defs>
        <pattern id={dotsId} width={8} height={8} patternUnits="userSpaceOnUse">
          <circle cx={3} cy={3} r={1.6} fill="#ffffff" />
        </pattern>
      </defs>
      <rect x={0} y={0} width={LOGICAL_WIDTH} height={LOGICAL_HEIGHT} fill="#ffffff" />
      {cups.map((cup) => (
        <g
          key={cup.key}
          data-cup={cup.role}
          data-key={cup.key}
          data-milk={cup.milk}
          data-syrup={cup.syrup}
        >
          <text
            x={cup.labelX}
            y={cup.labelY}
            textAnchor={cup.anchor}
            fontSize={24}
            fontWeight={800}
            fill={INK}
          >
            {cup.label}
          </text>
          {look === 'blocks' ? <Cup cup={cup} /> : null}
          {look !== 'ratio' ? <Blocks cup={cup} dotsId={dotsId} /> : null}
          {look === 'ratio' ? (
            <text
              x={230}
              y={cup.textY - 6}
              fontSize={32}
              fontWeight={800}
              fill={INK}
              data-part="ratio-text"
            >
              {S.mix.ratioText(cup.milk, cup.syrup)}
            </text>
          ) : (
            <text
              x={cup.textX}
              y={cup.textY}
              textAnchor={cup.anchor}
              fontSize={20}
              fontWeight={700}
              fill="#3d485c"
              data-part="amounts"
            >
              {S.mix.amounts(cup.milk, cup.syrup)}
            </text>
          )}
        </g>
      ))}
      {showStrip ? <Strip cups={cups} /> : null}
    </svg>
  );
}
