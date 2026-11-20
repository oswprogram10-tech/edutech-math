/**
 * E20 rate 판 그림(논리 1000×600 SVG). look: race(트랙 두 줄) / table(표 + 작은 트랙).
 * 캐릭터는 도형으로 구분한다(색만으로 전달하지 않는다). 각자 자기 시간에 자기 거리에 닿고, 도착선은 각자의 거리에 있다.
 * "1초에 간 거리"·누가 빠른지 결과 글은 어디에도 쓰지 않는다. 결과는 같은 시각의 위치와 표로만 보인다.
 */
import type { CSSProperties } from 'react';
import { Rational } from '../../core/math';
import { LANE, TABLE, TRACK, laneY, raceTotalTime, racerDistanceAt, trackX } from './layout';
import { E20_STRINGS as S } from './strings.ko';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from './types';
import type { RacerState, RateState } from './types';
import { useRacePlayback } from './usePlayback';

const INK = '#1d2330';
const COLORS = ['#2f6fde', '#c76a12'] as const;

/** 도형으로 구분하는 캐릭터. 0번은 귀가 긴 동물, 1번은 등딱지가 있는 동물(이름은 이름표가 말한다). */
function Character({ index, x, y }: { index: number; x: number; y: number }) {
  const color = COLORS[index] ?? COLORS[0];
  return (
    <g
      transform={`translate(${x} ${y})`}
      data-part="character"
      data-shape={index === 0 ? 'ears' : 'shell'}
    >
      {index === 0 ? (
        <>
          <ellipse cx={-4} cy={-2} rx={22} ry={15} fill="#ffffff" stroke={color} strokeWidth={4} />
          <circle cx={16} cy={-10} r={10} fill="#ffffff" stroke={color} strokeWidth={4} />
          <ellipse cx={13} cy={-28} rx={4} ry={11} fill="#ffffff" stroke={color} strokeWidth={3} />
          <ellipse cx={22} cy={-27} rx={4} ry={11} fill="#ffffff" stroke={color} strokeWidth={3} />
          <circle cx={19} cy={-12} r={2} fill={INK} />
        </>
      ) : (
        <>
          <path d="M -24 8 A 24 24 0 0 1 24 8 Z" fill="#fff4e0" stroke={color} strokeWidth={4} />
          <path
            d="M -12 8 L -6 -8 M 2 8 L 4 -12 M 14 8 L 12 -6"
            stroke={color}
            strokeWidth={2.5}
            fill="none"
          />
          <circle cx={30} cy={2} r={8} fill="#fff4e0" stroke={color} strokeWidth={4} />
          <circle cx={33} cy={0} r={1.8} fill={INK} />
        </>
      )}
    </g>
  );
}

interface LaneProps {
  readonly racer: RacerState;
  readonly index: number;
  readonly state: RateState;
  readonly characterDistance: Rational | null;
}

function Lane({ racer, index, state, characterDistance }: LaneProps) {
  const { look, maxDistance } = state.settings;
  const cy = laneY(look, index);
  const x = characterDistance === null ? TRACK.x0 : trackX(characterDistance, maxDistance);
  const finishX = racer.distance === null ? null : trackX(Rational.of(racer.distance), maxDistance);
  const atFinish =
    characterDistance !== null &&
    racer.distance !== null &&
    characterDistance.equals(Rational.of(racer.distance));
  const tag =
    look === 'race' ? S.rate.racerLine(racer.name, racer.distance, racer.time) : racer.name;
  const top = cy - LANE.halfH;
  const bottom = cy + LANE.halfH;
  return (
    <g data-lane={racer.id}>
      <rect
        x={TRACK.x0}
        y={top}
        width={TRACK.w}
        height={LANE.halfH * 2}
        fill="#f4f7fb"
        stroke="#b5c0d3"
        strokeWidth={2}
      />
      <line x1={TRACK.x0} y1={top} x2={TRACK.x0} y2={bottom} stroke={INK} strokeWidth={4} />
      {finishX === null ? null : (
        <g data-part="finish" data-racer={racer.id} data-x={finishX}>
          <line x1={finishX} y1={top} x2={finishX} y2={bottom} stroke={INK} strokeWidth={6} />
          <line
            x1={finishX}
            y1={top}
            x2={finishX}
            y2={bottom}
            stroke="#ffffff"
            strokeWidth={6}
            strokeDasharray="8 8"
          />
          <text
            x={finishX}
            y={bottom + 22}
            textAnchor="middle"
            fontSize={18}
            fontWeight={700}
            fill={INK}
          >
            {S.rate.finishLine}
          </text>
        </g>
      )}
      <text
        x={20}
        y={top - 12}
        fontSize={look === 'race' ? 24 : 22}
        fontWeight={800}
        fill={INK}
        data-part="name-tag"
      >
        {tag}
      </text>
      <g data-racer={racer.id} data-x={x} data-at-finish={atFinish ? 'true' : 'false'}>
        <Character index={index} x={x} y={cy} />
      </g>
    </g>
  );
}

function RateTable({ state }: { state: RateState }) {
  const rows = state.racers;
  const { x, y, w, rowH, colName, colDistance, colTime } = TABLE;
  const cell = (value: number | null) => (value === null ? S.rate.empty : String(value));
  const headers = [
    { label: S.rate.tableName, dx: colName },
    { label: S.rate.tableDistance, dx: colDistance },
    { label: S.rate.tableTime, dx: colTime },
  ];
  return (
    <g data-part="rate-table">
      <text x={20} y={y - 14} fontSize={24} fontWeight={800} fill={INK}>
        {S.rate.tableTitle}
      </text>
      <rect
        x={x}
        y={y}
        width={w}
        height={rowH * (rows.length + 1)}
        fill="#ffffff"
        stroke={INK}
        strokeWidth={2}
      />
      {headers.map((header) => (
        <text
          key={header.label}
          x={x + header.dx}
          y={y + 35}
          fontSize={22}
          fontWeight={800}
          fill={INK}
        >
          {header.label}
        </text>
      ))}
      {rows.map((racer, i) => {
        const top = y + rowH * (i + 1);
        return (
          <g key={racer.id} data-row={racer.id}>
            <line x1={x} y1={top} x2={x + w} y2={top} stroke="#8b96ab" strokeWidth={1.5} />
            <text x={x + colName} y={top + 35} fontSize={24} fontWeight={700} fill={INK}>
              {racer.name}
            </text>
            <text
              x={x + colDistance}
              y={top + 35}
              fontSize={24}
              fontWeight={700}
              fill={INK}
              data-cell="distance"
            >
              {cell(racer.distance)}
            </text>
            <text
              x={x + colTime}
              y={top + 35}
              fontSize={24}
              fontWeight={700}
              fill={INK}
              data-cell="time"
            >
              {cell(racer.time)}
            </text>
          </g>
        );
      })}
    </g>
  );
}

export interface RateBoardProps {
  readonly state: RateState;
  readonly svgStyle?: CSSProperties;
  readonly className?: string;
}

export function RateBoard({ state, svgStyle, className }: RateBoardProps) {
  const valuesKey = state.racers.map((r) => `${r.id}:${r.distance}:${r.time}`).join('|');
  const playback = useRacePlayback(state.runs, valuesKey);
  const total = raceTotalTime(state.racers);
  const { look, maxDistance } = state.settings;
  const axisY = laneY(look, 1) + LANE.halfH + 48;
  return (
    <svg
      className={className}
      viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`}
      style={svgStyle}
      role="group"
      aria-label={S.canvasLabel}
      data-testid="ratio-canvas"
      data-mode="rate"
      data-look={look}
      data-ran={state.runs > 0 ? 'true' : 'false'}
      data-playing={playback.playing ? 'true' : 'false'}
      data-step={playback.step}
    >
      <rect x={0} y={0} width={LOGICAL_WIDTH} height={LOGICAL_HEIGHT} fill="#ffffff" />
      {look === 'table' ? <RateTable state={state} /> : null}
      {state.racers.map((racer, i) => (
        <Lane
          key={racer.id}
          racer={racer}
          index={i}
          state={state}
          characterDistance={total === null ? null : racerDistanceAt(racer, total, playback.step)}
        />
      ))}
      <text
        x={TRACK.x0}
        y={axisY}
        textAnchor="middle"
        fontSize={18}
        fontWeight={700}
        fill="#3d485c"
      >
        {S.rate.axisZero}
      </text>
      <text
        x={TRACK.x0 + TRACK.w}
        y={axisY}
        textAnchor="middle"
        fontSize={18}
        fontWeight={700}
        fill="#3d485c"
      >
        {S.rate.axisMax(maxDistance)}
      </text>
    </svg>
  );
}
