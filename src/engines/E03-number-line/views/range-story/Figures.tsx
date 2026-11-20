/**
 * range 이야기 장면의 그림: 캐릭터(키 글 포함)와 게이트. 판과 오버레이가 함께 쓴다.
 * 색만으로 통과·막힘을 알리지 않는다(표시 글자 ✓ ✕와 게이트 막대 모양).
 */
import { numberLineStrings } from '../../strings.ko';
import { GATE_GROUND_Y, GATE_HALF_WIDTH, GATE_X } from './geometry';

const S = numberLineStrings.range;

export type RiderMark = 'passed' | 'blocked' | null;

export interface RiderFigureProps {
  readonly x: number;
  readonly y: number;
  readonly height: number;
  /** 몸 그림의 배율. 키 글은 배율과 상관없이 `labelSize`로 정한다. */
  readonly scale?: number;
  readonly labelSize?: number;
  readonly mark?: RiderMark;
  readonly testId?: string;
}

/** 키 글의 논리 크기. 아이패드(판 너비 약 740px)에서도 화면 12px 이상이 되게 17로 둔다. */
export const RIDER_LABEL_SIZE = 17;
/** 캐릭터 몸 그림의 기본 배율. */
export const RIDER_BODY_SCALE = 0.8;

/** 발 끝이 (x, y)에 닿는 캐릭터. 키 글은 발 아래. */
export function RiderFigure({
  x,
  y,
  height,
  scale = RIDER_BODY_SCALE,
  labelSize = RIDER_LABEL_SIZE,
  mark = null,
  testId,
}: RiderFigureProps) {
  const stroke = { stroke: '#1d2330', strokeLinecap: 'round' as const };
  return (
    <g
      transform={`translate(${x} ${y})`}
      data-testid={testId}
      data-rider={height}
      data-mark={mark ?? ''}
    >
      <g transform={`scale(${scale})`}>
        <circle cx={0} cy={-62} r={9} fill="#f3c9a0" stroke="#1d2330" strokeWidth={2.5} />
        <line x1={0} y1={-52} x2={0} y2={-24} strokeWidth={5} {...stroke} />
        <line x1={-12} y1={-42} x2={12} y2={-42} strokeWidth={4} {...stroke} />
        <line x1={0} y1={-24} x2={-9} y2={0} strokeWidth={4} {...stroke} />
        <line x1={0} y1={-24} x2={9} y2={0} strokeWidth={4} {...stroke} />
      </g>
      <text
        x={0}
        y={labelSize + 3}
        textAnchor="middle"
        fontSize={labelSize}
        fontWeight={700}
        fill="#1d2330"
        data-rider-label={height}
      >
        {S.rider(String(height))}
      </text>
      {mark ? (
        <text
          x={0}
          y={-76 * scale - 4}
          textAnchor="middle"
          fontSize={Math.round(20 * Math.max(1, scale))}
          fontWeight={800}
          fill={mark === 'passed' ? '#0f7b6c' : '#b42318'}
          aria-label={mark === 'passed' ? S.passedMark : S.blockedMark}
        >
          {mark === 'passed' ? '✓' : '✕'}
        </text>
      ) : null}
    </g>
  );
}

export interface GateFigureProps {
  /** 막대가 내려와 길을 막고 있나. */
  readonly closed: boolean;
  readonly label: string;
}

export function GateFigure({ closed, label }: GateFigureProps) {
  const top = GATE_GROUND_Y - 100;
  const left = -GATE_HALF_WIDTH;
  const right = GATE_HALF_WIDTH;
  return (
    <g transform={`translate(${GATE_X} 0)`} data-testid="range-gate" data-closed={closed}>
      <rect x={left - 8} y={top} width={8} height={100} fill="#5a6478" />
      <rect x={right} y={top} width={8} height={100} fill="#5a6478" />
      <line
        x1={left}
        y1={top + 20}
        x2={closed ? right : right - 6}
        y2={closed ? top + 20 : top - 18}
        stroke="#d64545"
        strokeWidth={7}
        strokeLinecap="round"
      />
      <text x={0} y={top - 28} textAnchor="middle" fontSize={16} fontWeight={800} fill="#1d2330">
        {label}
      </text>
    </g>
  );
}
