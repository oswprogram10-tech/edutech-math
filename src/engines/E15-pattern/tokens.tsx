/**
 * E15 토큰 그림. 모두 SVG로 그리며 이모지·글꼴 그림에 기대지 않는다.
 * 윤곽이 서로 달라 색 없이도 구분된다. `look: 'color'`일 때만 색을 칠한다.
 * 기본 토큰이 아닌 문자열은 그 글자를 큰 글씨로 쓴 글자 카드다.
 */
import { isBasicToken } from './basic-tokens';
import type { Look } from './types';

const INK = '#1d2330';
const PLAIN_FILL = '#e6eaf2';
const PLAIN_INK = '#5b6577';

const COLORS: Readonly<Record<string, string>> = {
  circle: '#e04b4b',
  triangle: '#2f6fde',
  square: '#2e9e5b',
  star: '#e8a13a',
  heart: '#d6479a',
  apple: '#d93b3b',
  banana: '#f0cf45',
  grape: '#7a4bc2',
  strawberry: '#e0405a',
};

const STAR_POINTS = (() => {
  const points: string[] = [];
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? 46 : 19;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    points.push(
      `${(50 + radius * Math.cos(angle)).toFixed(1)},${(54 + radius * Math.sin(angle)).toFixed(1)}`,
    );
  }
  return points.join(' ');
})();

interface Paint {
  readonly fill: string;
  readonly stroke: string;
  readonly leaf: string;
}

function paintOf(token: string, look: Look): Paint {
  if (look === 'plain') return { fill: PLAIN_FILL, stroke: PLAIN_INK, leaf: PLAIN_FILL };
  return { fill: COLORS[token] ?? '#2f6fde', stroke: INK, leaf: '#3aa655' };
}

function Person({ token, paint }: { readonly token: string; readonly paint: Paint }) {
  const line = {
    stroke: paint.stroke,
    strokeWidth: 7,
    strokeLinecap: 'round' as const,
    fill: 'none',
  };
  const head = paint.fill;
  if (token === 'jump') {
    return (
      <g>
        <circle cx={50} cy={16} r={11} fill={head} stroke={paint.stroke} strokeWidth={4} />
        <path d="M50 28 L50 56 M50 34 L26 20 M50 34 L74 20 M50 56 L30 72 M50 56 L70 72" {...line} />
        <path d="M24 90 Q50 80 76 90" stroke={paint.stroke} strokeWidth={4} fill="none" />
      </g>
    );
  }
  if (token === 'hands-up') {
    return (
      <g>
        <circle cx={50} cy={22} r={11} fill={head} stroke={paint.stroke} strokeWidth={4} />
        <path d="M50 34 L50 64 M50 42 L28 12 M50 42 L72 12 M50 64 L36 92 M50 64 L64 92" {...line} />
      </g>
    );
  }
  return (
    <g>
      <circle cx={50} cy={22} r={11} fill={head} stroke={paint.stroke} strokeWidth={4} />
      <path d="M50 34 L50 64 M50 42 L42 56 M50 42 L58 56 M50 64 L38 92 M50 64 L62 92" {...line} />
      <path
        d="M44 66 L38 62 M56 66 L62 62 M50 68 L50 62"
        stroke={paint.stroke}
        strokeWidth={4}
        strokeLinecap="round"
      />
    </g>
  );
}

function Shape({ token, paint }: { readonly token: string; readonly paint: Paint }) {
  const common = {
    fill: paint.fill,
    stroke: paint.stroke,
    strokeWidth: 4,
    strokeLinejoin: 'round' as const,
  };
  switch (token) {
    case 'circle':
      return <circle cx={50} cy={50} r={42} {...common} />;
    case 'triangle':
      return <polygon points="50,8 94,88 6,88" {...common} />;
    case 'square':
      return <rect x={10} y={10} width={80} height={80} rx={4} {...common} />;
    case 'star':
      return <polygon points={STAR_POINTS} {...common} />;
    case 'heart':
      return (
        <path
          d="M50 90 C8 60 4 28 27 18 C39 13 48 20 50 30 C52 20 61 13 73 18 C96 28 92 60 50 90 Z"
          {...common}
        />
      );
    case 'apple':
      return (
        <g>
          <path
            d="M50 32 C36 18 10 28 13 56 C16 80 34 94 50 86 C66 94 84 80 87 56 C90 28 64 18 50 32 Z"
            {...common}
          />
          <path d="M50 32 L54 10" stroke={paint.stroke} strokeWidth={5} strokeLinecap="round" />
          <path
            d="M54 18 C64 8 78 10 80 16 C70 24 58 24 54 18 Z"
            fill={paint.leaf}
            stroke={paint.stroke}
            strokeWidth={3}
          />
        </g>
      );
    case 'banana':
      return (
        <g>
          <path d="M14 26 C10 66 42 96 90 78 L86 64 C56 70 36 52 30 22 Z" {...common} />
          <path
            d="M14 26 L10 16 M90 78 L96 82"
            stroke={paint.stroke}
            strokeWidth={5}
            strokeLinecap="round"
          />
        </g>
      );
    case 'grape':
      return (
        <g>
          {(
            [
              [30, 42],
              [50, 42],
              [70, 42],
              [40, 62],
              [60, 62],
              [50, 82],
            ] as const
          ).map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={13} {...common} />
          ))}
          <path d="M50 28 L54 8" stroke={paint.stroke} strokeWidth={5} strokeLinecap="round" />
        </g>
      );
    case 'strawberry':
      return (
        <g>
          <path d="M16 34 C16 72 38 92 50 92 C62 92 84 72 84 34 C68 26 32 26 16 34 Z" {...common} />
          <path
            d="M28 32 L38 16 L50 28 L62 16 L72 32 Z"
            fill={paint.leaf}
            stroke={paint.stroke}
            strokeWidth={3}
            strokeLinejoin="round"
          />
          {(
            [
              [36, 52],
              [56, 50],
              [46, 66],
              [64, 66],
              [40, 76],
            ] as const
          ).map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={3} fill={paint.stroke} />
          ))}
        </g>
      );
    default:
      return null;
  }
}

export interface TokenGlyphProps {
  readonly token: string;
  /** 그림을 놓을 상자의 왼쪽 위와 한 변. */
  readonly x: number;
  readonly y: number;
  readonly size: number;
  readonly look: Look;
  readonly symbols?: Readonly<Record<string, string>>;
}

/** SVG 안에 토큰 하나를 그린다. 그림은 상자의 70%다. */
export function TokenGlyph({ token, x, y, size, look: mode, symbols }: TokenGlyphProps) {
  const symbol = mode === 'symbol' ? symbols?.[token] : undefined;
  if (symbol !== undefined || !isBasicToken(token)) {
    const text = symbol ?? token;
    const fontSize = size * (text.length <= 1 ? 0.56 : text.length === 2 ? 0.44 : 0.32);
    return (
      <text
        x={x + size / 2}
        y={y + size / 2}
        fontSize={fontSize}
        fontWeight={800}
        fill={mode === 'plain' ? PLAIN_INK : INK}
        textAnchor="middle"
        dominantBaseline="central"
      >
        {text}
      </text>
    );
  }
  const drawSize = size * 0.7;
  const offset = (size - drawSize) / 2;
  const paint = paintOf(token, mode === 'symbol' ? 'color' : mode);
  const isPerson = token === 'clap' || token === 'jump' || token === 'hands-up';
  return (
    <g transform={`translate(${x + offset} ${y + offset}) scale(${drawSize / 100})`}>
      {isPerson ? (
        <Person
          token={token}
          paint={mode === 'plain' ? paint : { ...paint, fill: '#f6d6b0', stroke: '#2f6fde' }}
        />
      ) : (
        <Shape token={token} paint={paint} />
      )}
    </g>
  );
}
