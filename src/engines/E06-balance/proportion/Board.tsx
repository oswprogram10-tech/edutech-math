/**
 * proportion 판 그림(논리 1000×600 SVG). look 셋: scale(저울+격자) / grid(격자 둘 나란히) / symbols(식).
 *
 * 색만으로 전달하지 않는다: 기울기는 글("왼쪽이 더 무거워요")과 `data-tilt`로도 알리고,
 * 모르는 □는 굵은 테두리 + "□" 글자 + "?"로 쓴다. 격자는 칸 수 글로도 쓴다.
 * 화면·DOM·aria 어디에도 □의 정답은 나오지 않는다(엔진이 정답을 모른다).
 * 외항·내항 괄호는 여기에 없다. 오버레이 `cross-brackets`가 그린다.
 */
import type { CSSProperties } from 'react';
import {
  BEAM_HALF,
  PAN_CENTER,
  PAN_HALF,
  PAN_SURFACE_Y,
  PIVOT,
  beamRotation,
  panOffsets,
  tiltDegreesOf,
} from '../layout';
import { balanceStrings as S } from '../strings.ko';
import styles from '../View.module.css';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import type { BalanceTilt } from '../types';
import { COLON_X, EQUALS_X, EQ_Y, RESULT_Y, SIGN_POS, TERM_BOX, TERM_X, platesOf } from './layout';
import type { GridBox, PlateLayout } from './layout';
import { areaOf, readProportion } from './read';
import { proportionResultText } from './result';
import type { ProportionReading } from './read';
import type { ProportionState } from './types';

const INK = '#1d2330';
const P = S.proportion;
/** grid look에서 격자 아래 글 높이. */
const GRID_CENTER_TEXT_Y = 478;

function signOf(tilt: BalanceTilt): string {
  if (tilt === 'level') return S.sign.equal;
  if (tilt === 'unknown') return S.sign.unknown;
  return S.sign.notEqual;
}

function gridPath(box: GridBox): string {
  const parts: string[] = [];
  for (let i = 1; i < box.w; i += 1) {
    const x = box.x + i * box.unit;
    parts.push(`M${x} ${box.y}V${box.y + box.height}`);
  }
  for (let j = 1; j < box.h; j += 1) {
    const y = box.y + j * box.unit;
    parts.push(`M${box.x} ${y}H${box.x + box.width}`);
  }
  return parts.join('');
}

function Grid({ box, name }: { readonly box: GridBox; readonly name: 'left' | 'right' }) {
  const left = name === 'left';
  return (
    <g
      role="img"
      aria-label={`${P.gridLabel[name]}, ${P.dims(String(box.w), String(box.h))}`}
      data-grid={name}
      data-cols={box.w}
      data-rows={box.h}
    >
      <rect
        x={box.x}
        y={box.y}
        width={box.width}
        height={box.height}
        fill={left ? '#bcd0f5' : '#fbd9a8'}
      />
      <path d={gridPath(box)} stroke={left ? '#5b7fc7' : '#c98a3a'} strokeWidth={1} fill="none" />
      <rect
        x={box.x}
        y={box.y}
        width={box.width}
        height={box.height}
        fill="none"
        stroke={left ? '#1d4fa8' : '#8a4b00'}
        strokeWidth={3}
        strokeDasharray={left ? undefined : '10 5'}
      />
    </g>
  );
}

/** 아직 모르는 격자 자리(□ 쪽): 굵은 점선 상자와 "?". */
function UnknownGrid({ plate }: { readonly plate: PlateLayout }) {
  const size = 100;
  const x = plate.centerX - size / 2;
  const y = plate.bottomY - size;
  return (
    <g role="img" aria-label={P.gridUnknown} data-testid={`grid-unknown-${plate.name}`}>
      <rect
        x={x}
        y={y}
        width={size}
        height={size}
        rx={10}
        fill="#fff3d6"
        stroke="#8a4b00"
        strokeWidth={4}
        strokeDasharray="10 6"
      />
      <text
        x={plate.centerX}
        y={y + size / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={44}
        fontWeight={800}
        fill="#8a4b00"
      >
        {S.sign.unknown}
      </text>
    </g>
  );
}

function PlateContent({ plate, textY }: { readonly plate: PlateLayout; readonly textY: number }) {
  const { box, dims } = plate;
  if (box === null) {
    return <UnknownGrid plate={plate} />;
  }
  const area = areaOf(dims);
  return (
    <>
      <Grid box={box} name={plate.name} />
      <text
        x={plate.centerX}
        y={textY}
        textAnchor="middle"
        fontSize={22}
        fontWeight={700}
        fill={INK}
        data-dims={plate.name}
      >
        {P.dims(String(box.w), String(box.h))}
      </text>
      <text
        x={plate.centerX}
        y={textY + 32}
        textAnchor="middle"
        fontSize={28}
        fontWeight={800}
        fill={INK}
        data-total={plate.name}
      >
        {P.total(area === null ? '' : area.toString())}
      </text>
    </>
  );
}

function TermBox({
  x,
  text,
  tried,
  index,
}: {
  readonly x: number;
  readonly text: string;
  readonly tried: boolean;
  readonly index: number;
}) {
  return (
    <g
      role="img"
      aria-label={tried ? S.boxTriedLabel(text) : S.boxLabel}
      data-term={index}
      data-box="true"
      data-unknown={tried ? undefined : 'true'}
    >
      <rect
        x={x - TERM_BOX.width / 2}
        y={EQ_Y - TERM_BOX.height / 2}
        width={TERM_BOX.width}
        height={TERM_BOX.height}
        rx={10}
        fill="#fff3d6"
        stroke="#8a4b00"
        strokeWidth={4}
      />
      <text
        x={x}
        y={EQ_Y}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={44}
        fontWeight={800}
        fill={INK}
      >
        {text}
      </text>
    </g>
  );
}

/** 위쪽 식 줄: a : b = c : d. □는 넣어 본 값이 있으면 그 값을 □ 상자 안에 쓴다. */
function EquationLine({ state }: { readonly state: ProportionState }) {
  if (state.terms.length !== 4) return null;
  const textProps = {
    textAnchor: 'middle',
    dominantBaseline: 'central',
    fontSize: 48,
    fontWeight: 800,
    fill: INK,
  } as const;
  return (
    <g role="group" aria-label={P.equationLabel} data-testid="proportion-equation">
      {state.terms.map((term, index) => {
        const x = TERM_X[index] ?? 0;
        if (term === null) {
          return (
            <TermBox
              key={index}
              x={x}
              index={index}
              tried={state.tryValue !== null}
              text={state.tryValue ?? '□'}
            />
          );
        }
        return (
          <text key={index} x={x} y={EQ_Y} {...textProps} data-term={index}>
            {term}
          </text>
        );
      })}
      {COLON_X.map((x) => (
        <text key={x} x={x} y={EQ_Y} {...textProps}>
          :
        </text>
      ))}
      <text x={EQUALS_X} y={EQ_Y} {...textProps}>
        =
      </text>
    </g>
  );
}

function ScaleBoard({
  reading,
  plates,
}: {
  readonly reading: ProportionReading;
  readonly plates: readonly PlateLayout[];
}) {
  const degrees = tiltDegreesOf(reading.left, reading.right);
  const offsets = panOffsets(reading.tilt, degrees);
  const rotation = beamRotation(reading.tilt, degrees);
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
      {plates.map((plate) => {
        const cx = PAN_CENTER[plate.name];
        const offset = offsets[plate.name];
        return (
          <g
            key={plate.name}
            className={styles.motion}
            role="group"
            aria-label={S.panLabel[plate.name]}
            data-pan={plate.name}
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
            {reading.placed ? <PlateContent plate={plate} textY={PAN_SURFACE_Y + 76} /> : null}
          </g>
        );
      })}
      <circle cx={PIVOT.x} cy={PIVOT.y} r={16} fill="#4a5568" />
    </>
  );
}

function GridBoard({
  reading,
  plates,
}: {
  readonly reading: ProportionReading;
  readonly plates: readonly PlateLayout[];
}) {
  if (!reading.placed) return null;
  return (
    <>
      {plates.map((plate) => (
        <g key={plate.name} role="group" aria-label={P.gridLabel[plate.name]} data-row={plate.name}>
          <PlateContent plate={plate} textY={GRID_CENTER_TEXT_Y} />
        </g>
      ))}
      <text
        x={SIGN_POS.x}
        y={SIGN_POS.y}
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

function SymbolsBoard({
  state,
  reading,
}: {
  readonly state: ProportionState;
  readonly reading: ProportionReading;
}) {
  if (!reading.placed) return null;
  const labels = state.settings.pairSelect
    ? [P.symbols.picked, P.symbols.rest]
    : [P.symbols.extremes, P.symbols.means];
  const big = {
    dominantBaseline: 'central',
    fontWeight: 800,
    fill: INK,
  } as const;
  return (
    <g data-testid="proportion-products">
      <text x={440} y={290} textAnchor="end" fontSize={48} {...big}>
        {labels[0]}
      </text>
      <text x={500} y={290} textAnchor="middle" fontSize={72} {...big} data-testid="balance-sign">
        {signOf(reading.tilt)}
      </text>
      <text x={560} y={290} textAnchor="start" fontSize={48} {...big}>
        {labels[1]}
      </text>
      <text x={440} y={390} textAnchor="end" fontSize={56} {...big} data-total="left">
        {reading.left === null ? S.sign.unknown : reading.left.toString()}
      </text>
      <text x={500} y={390} textAnchor="middle" fontSize={56} {...big}>
        {signOf(reading.tilt)}
      </text>
      <text x={560} y={390} textAnchor="start" fontSize={56} {...big} data-total="right">
        {reading.right === null ? S.sign.unknown : reading.right.toString()}
      </text>
    </g>
  );
}

export interface ProportionBoardProps {
  readonly state: ProportionState;
  readonly svgStyle?: CSSProperties;
  readonly className?: string;
}

export function ProportionBoard({ state, svgStyle, className }: ProportionBoardProps) {
  const reading = readProportion(state);
  const { look } = state.settings;
  const plates = look === 'symbols' ? [] : platesOf(reading, look);
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
      <rect width={LOGICAL_WIDTH} height={LOGICAL_HEIGHT} rx={16} fill="#fbfaf6" />
      {look === 'scale' ? <ScaleBoard reading={reading} plates={plates} /> : null}
      {look === 'grid' ? <GridBoard reading={reading} plates={plates} /> : null}
      {look === 'symbols' ? <SymbolsBoard state={state} reading={reading} /> : null}
      <EquationLine state={state} />
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
        {proportionResultText(state, reading.tilt)}
      </text>
    </svg>
  );
}
