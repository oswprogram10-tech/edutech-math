/**
 * E06 판 그림(논리 1000×600 SVG). look 셋: scale(저울) / bars(막대 두 줄) / symbols(식).
 *
 * 색만으로 전달하지 않는다: 빼는 항은 점선 테두리 + 빗금 + "−16" 글자, □는 굵은 테두리 + "□" 글자,
 * 기울기는 글("왼쪽이 더 무거워요")과 `data-tilt`로도 알린다.
 * 화면·DOM·aria 어디에도 □의 정답은 나오지 않는다(엔진이 정답을 모른다).
 */
import { useId } from 'react';
import type { CSSProperties } from 'react';
import { readBalance } from './observe';
import {
  BARS,
  BEAM_HALF,
  PAN_CENTER,
  PAN_HALF,
  PAN_SURFACE_Y,
  PIVOT,
  beamRotation,
  expressionOf,
  panBarRects,
  panOffsets,
  rowBarRects,
  tiltDegrees,
} from './layout';
import type { BarRect } from './layout';
import { resultText } from './result';
import { balanceStrings as S } from './strings.ko';
import styles from './View.module.css';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from './types';
import type { BalanceState, BalanceTilt } from './types';

const INK = '#1d2330';

function signOf(tilt: BalanceTilt): string {
  if (tilt === 'level') return S.sign.equal;
  if (tilt === 'unknown') return S.sign.unknown;
  return S.sign.notEqual;
}

interface BarProps {
  readonly rect: BarRect;
  readonly hatchId: string;
}

function Bar({ rect, hatchId }: BarProps) {
  const { item, x, y, width, height } = rect;
  const label = item.label;
  const aria =
    item.kind === 'box'
      ? item.unknown
        ? S.boxLabel
        : S.boxTriedLabel(item.label.replace('□ = ', ''))
      : item.negative
        ? S.subtractLabel(item.label)
        : S.barLabel(item.label);
  return (
    <g role="img" aria-label={aria} data-bar={item.kind} data-negative={item.negative || undefined}>
      {item.kind === 'box' ? (
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          rx={10}
          fill="#fff3d6"
          stroke="#8a4b00"
          strokeWidth={4}
        />
      ) : item.negative ? (
        <>
          <rect x={x} y={y} width={width} height={height} rx={6} fill="#ffffff" />
          <rect x={x} y={y} width={width} height={height} rx={6} fill={`url(#${hatchId})`} />
          <rect
            x={x}
            y={y}
            width={width}
            height={height}
            rx={6}
            fill="none"
            stroke="#a8321f"
            strokeWidth={3}
            strokeDasharray="10 6"
          />
        </>
      ) : (
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          rx={6}
          fill="#bcd0f5"
          stroke="#1d4fa8"
          strokeWidth={3}
        />
      )}
      <text
        x={x + width / 2}
        y={y + height / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={24}
        fontWeight={800}
        fill={INK}
        stroke="#ffffff"
        strokeWidth={item.negative ? 5 : 0}
        paintOrder="stroke"
      >
        {label}
      </text>
      {item.kind === 'box' && item.unknown ? (
        <g data-testid="box-unknown">
          <circle
            cx={x + width - 4}
            cy={y + 4}
            r={14}
            fill="#ffffff"
            stroke="#8a4b00"
            strokeWidth={3}
          />
          <text
            x={x + width - 4}
            y={y + 4}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={20}
            fontWeight={800}
            fill="#8a4b00"
          >
            {S.sign.unknown}
          </text>
        </g>
      ) : null}
    </g>
  );
}

function Totals({
  state,
  name,
  x,
  y,
  anchor,
}: {
  readonly state: BalanceState;
  readonly name: 'left' | 'right';
  readonly x: number;
  readonly y: number;
  readonly anchor: 'start' | 'middle';
}) {
  if (!state.settings.showTotals) return null;
  const reading = readBalance(state);
  const value = name === 'left' ? reading.left : reading.right;
  if (value === null) return null;
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      fontSize={30}
      fontWeight={700}
      fill={INK}
      data-total={name}
    >
      {S.total(value.toString())}
    </text>
  );
}

function ScaleBoard({
  state,
  hatchId,
}: {
  readonly state: BalanceState;
  readonly hatchId: string;
}) {
  const reading = readBalance(state);
  const degrees = tiltDegrees(state);
  const offsets = panOffsets(reading.tilt, degrees);
  const rotation = beamRotation(reading.tilt, degrees);
  const names = ['left', 'right'] as const;
  return (
    <>
      <path
        d={`M${PIVOT.x} ${PIVOT.y} V548 M${PIVOT.x - 130} 548 H${PIVOT.x + 130}`}
        stroke="#4a5568"
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
      {names.map((name) => {
        const cx = PAN_CENTER[name];
        const offset = offsets[name];
        return (
          <g
            key={name}
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
            {panBarRects(state, name).map((rect) => (
              <Bar key={rect.item.kind} rect={rect} hatchId={hatchId} />
            ))}
            <Totals state={state} name={name} x={cx} y={PAN_SURFACE_Y + 90} anchor="middle" />
          </g>
        );
      })}
      <circle cx={PIVOT.x} cy={PIVOT.y} r={16} fill="#4a5568" />
    </>
  );
}

function BarsBoard({ state, hatchId }: { readonly state: BalanceState; readonly hatchId: string }) {
  const reading = readBalance(state);
  const names = ['left', 'right'] as const;
  return (
    <>
      {names.map((name) => {
        const y = name === 'left' ? BARS.leftY : BARS.rightY;
        return (
          <g key={name} role="group" aria-label={S.rowLabel[name]} data-row={name}>
            <text
              x={20}
              y={y + BARS.height / 2}
              dominantBaseline="central"
              fontSize={26}
              fontWeight={700}
              fill={INK}
            >
              {S.rowLabel[name]}
            </text>
            {rowBarRects(state, name).map((rect) => (
              <Bar key={rect.item.kind} rect={rect} hatchId={hatchId} />
            ))}
            <Totals state={state} name={name} x={BARS.x} y={y + BARS.height + 60} anchor="start" />
          </g>
        );
      })}
      <text
        x={PIVOT.x}
        y={(BARS.leftY + BARS.rightY + BARS.height) / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={72}
        fontWeight={800}
        fill={INK}
        data-testid="balance-sign"
      >
        {signOf(reading.tilt)}
      </text>
    </>
  );
}

function SymbolsBoard({ state }: { readonly state: BalanceState }) {
  const reading = readBalance(state);
  return (
    <g data-testid="balance-equation">
      <text
        x={440}
        y={300}
        textAnchor="end"
        dominantBaseline="central"
        fontSize={72}
        fontWeight={800}
        fill={INK}
      >
        {expressionOf(state.left, state.tryValue)}
      </text>
      <text
        x={500}
        y={300}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={72}
        fontWeight={800}
        fill={INK}
        data-testid="balance-sign"
      >
        {signOf(reading.tilt)}
      </text>
      <text
        x={560}
        y={300}
        textAnchor="start"
        dominantBaseline="central"
        fontSize={72}
        fontWeight={800}
        fill={INK}
      >
        {expressionOf(state.right, state.tryValue)}
      </text>
    </g>
  );
}

export interface BalanceBoardProps {
  readonly state: BalanceState;
  readonly svgStyle?: CSSProperties;
  readonly className?: string;
}

export function BalanceBoard({ state, svgStyle, className }: BalanceBoardProps) {
  const hatchId = `e06-hatch-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const reading = readBalance(state);
  const { look } = state.settings;
  return (
    <svg
      className={className}
      viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`}
      style={svgStyle}
      role="group"
      aria-label={S.canvasLabel}
      data-testid="balance-canvas"
      data-tilt={reading.tilt}
      data-look={look}
    >
      <defs>
        <pattern
          id={hatchId}
          width={12}
          height={12}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width={12} height={12} fill="#ffffff" />
          <line x1={0} y1={0} x2={0} y2={12} stroke="#a8321f" strokeWidth={4} />
        </pattern>
      </defs>
      <rect width={LOGICAL_WIDTH} height={LOGICAL_HEIGHT} rx={16} fill="#fbfaf6" />
      {look === 'scale' ? <ScaleBoard state={state} hatchId={hatchId} /> : null}
      {look === 'bars' ? <BarsBoard state={state} hatchId={hatchId} /> : null}
      {look === 'symbols' ? <SymbolsBoard state={state} /> : null}
      <text
        x={PIVOT.x}
        y={look === 'scale' ? 46 : 70}
        textAnchor="middle"
        fontSize={36}
        fontWeight={800}
        fill={INK}
        role="status"
        aria-live="polite"
        data-testid="balance-result"
      >
        {resultText(state, reading.tilt)}
      </text>
      {look === 'scale' ? (
        <text
          x={PIVOT.x}
          y={118}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={56}
          fontWeight={800}
          fill={INK}
          data-testid="balance-sign"
        >
          {signOf(reading.tilt)}
        </text>
      ) : null}
    </svg>
  );
}
