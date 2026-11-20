/**
 * rounding 상황 장면의 그림 조각: 마지막 버스·마지막 봉지·정류장의 남은 학생·남은 사탕.
 * 전체 버스·봉지 수는 그리지 않고, 글에도 수를 쓰지 않는다(정답 노출 금지).
 * 앉은 자리·담은 사탕은 채운 모양, 빈 자리·빈 칸은 점선 모양이라 색 없이도 구별된다.
 */
import { numberLineStrings } from '../../strings.ko';

const S = numberLineStrings.rounding.scene;
const MAX_DRAWN = 20;
const PER_ROW = 10;

export const SCENE_TOP = 398;

interface SlotGridProps {
  readonly x: number;
  readonly y: number;
  readonly size: number;
  readonly filled: number;
  readonly kind: 'seat' | 'candy';
}

/** 2줄로 늘어놓은 자리·칸. */
function SlotGrid({ x, y, size, filled, kind }: SlotGridProps) {
  const perRow = Math.ceil(size / 2);
  const gap = 34;
  return (
    <g data-testid={kind === 'seat' ? 'scene-seats' : 'scene-slots'} data-filled={filled}>
      {Array.from({ length: size }, (_, index) => {
        const column = index % perRow;
        const row = Math.floor(index / perRow);
        const cx = x + column * gap;
        const cy = y + row * gap;
        const isFilled = index < filled;
        return kind === 'seat' ? (
          <g key={index} data-slot={isFilled ? 'filled' : 'empty'}>
            <rect
              x={cx - 13}
              y={cy - 13}
              width={26}
              height={26}
              rx={6}
              fill={isFilled ? '#e8eefc' : '#ffffff'}
              stroke="#1d2330"
              strokeWidth={2}
              strokeDasharray={isFilled ? undefined : '4 3'}
            />
            {isFilled ? <circle cx={cx} cy={cy - 3} r={7} fill="#2f6fde" /> : null}
          </g>
        ) : (
          <circle
            key={index}
            cx={cx}
            cy={cy}
            r={12}
            data-slot={isFilled ? 'filled' : 'empty'}
            fill={isFilled ? '#e86a9a' : '#ffffff'}
            stroke="#1d2330"
            strokeWidth={2}
            strokeDasharray={isFilled ? undefined : '4 3'}
          />
        );
      })}
    </g>
  );
}

export interface BusArtProps {
  readonly x: number;
  readonly y: number;
  readonly size: number;
  readonly filled: number;
}

/** 마지막 버스. 좌표 (x, y)는 왼쪽 위. */
export function BusArt({ x, y, size, filled }: BusArtProps) {
  const perRow = Math.ceil(size / 2);
  const width = perRow * 34 + 40;
  return (
    <g data-testid="scene-bus">
      <text x={x} y={y - 8} fontSize={16} fontWeight={700} fill="#1d2330">
        {S.busLabel}
      </text>
      <rect
        x={x}
        y={y}
        width={width}
        height={80}
        rx={14}
        fill="#fff4e2"
        stroke="#1d2330"
        strokeWidth={3}
      />
      <SlotGrid x={x + 30} y={y + 22} size={size} filled={filled} kind="seat" />
      <circle cx={x + 40} cy={y + 82} r={11} fill="#1d2330" />
      <circle cx={x + width - 40} cy={y + 82} r={11} fill="#1d2330" />
    </g>
  );
}

export interface BagArtProps {
  readonly x: number;
  readonly y: number;
  readonly size: number;
  readonly filled: number;
  readonly label: string;
}

/** 마지막 봉지. */
export function BagArt({ x, y, size, filled, label }: BagArtProps) {
  const perRow = Math.ceil(size / 2);
  const width = perRow * 34 + 40;
  return (
    <g data-testid="scene-bag">
      <text x={x} y={y - 8} fontSize={16} fontWeight={700} fill="#1d2330">
        {label}
      </text>
      <rect
        x={x}
        y={y}
        width={width}
        height={80}
        rx={18}
        fill="#fff4e2"
        stroke="#1d2330"
        strokeWidth={3}
      />
      <SlotGrid x={x + 30} y={y + 22} size={size} filled={filled} kind="candy" />
    </g>
  );
}

function Student({ x, y }: { readonly x: number; readonly y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} data-testid="scene-student">
      <circle cx={0} cy={-44} r={9} fill="#f3c9a0" stroke="#1d2330" strokeWidth={2.5} />
      <line
        x1={0}
        y1={-35}
        x2={0}
        y2={-14}
        stroke="#1d2330"
        strokeWidth={5}
        strokeLinecap="round"
      />
      <line x1={0} y1={-14} x2={-8} y2={0} stroke="#1d2330" strokeWidth={4} strokeLinecap="round" />
      <line x1={0} y1={-14} x2={8} y2={0} stroke="#1d2330" strokeWidth={4} strokeLinecap="round" />
    </g>
  );
}

export interface PileProps {
  readonly x: number;
  readonly y: number;
  readonly count: number;
}

/** 정류장에 남은 학생들. y는 발 끝. */
export function StopArt({ x, y, count }: PileProps) {
  const drawn = Math.min(count, MAX_DRAWN);
  return (
    <g data-testid="scene-stop" data-count-drawn={drawn}>
      <text x={x} y={y - 76} fontSize={16} fontWeight={700} fill="#1d2330">
        {S.busStop}
      </text>
      <line x1={x - 8} y1={y - 64} x2={x - 8} y2={y} stroke="#5a6478" strokeWidth={5} />
      {Array.from({ length: drawn }, (_, index) => (
        <Student key={index} x={x + 14 + (index % PER_ROW) * 26} y={y} />
      ))}
      {count > MAX_DRAWN ? (
        <text x={x + 14 + PER_ROW * 26} y={y} fontSize={16} fontWeight={700} fill="#1d2330">
          {S.moreLeft}
        </text>
      ) : null}
    </g>
  );
}

/** 봉지에 못 담고 남은 사탕. */
export function TrayArt({ x, y, count }: PileProps) {
  const drawn = Math.min(count, MAX_DRAWN);
  return (
    <g data-testid="scene-leftover" data-count-drawn={drawn}>
      <rect
        x={x - 12}
        y={y - 10}
        width={PER_ROW * 30 + 24}
        height={72}
        rx={12}
        fill="#f7f9ff"
        stroke="#1d2330"
        strokeWidth={2.5}
      />
      {Array.from({ length: drawn }, (_, index) => (
        <circle
          key={index}
          cx={x + 12 + (index % PER_ROW) * 30}
          cy={y + 14 + Math.floor(index / PER_ROW) * 30}
          r={11}
          fill="#e86a9a"
          stroke="#1d2330"
          strokeWidth={2}
        />
      ))}
      {count > MAX_DRAWN ? (
        <text x={x + 12} y={y + 80} fontSize={16} fontWeight={700} fill="#1d2330">
          {S.moreLeft}
        </text>
      ) : null}
    </g>
  );
}
