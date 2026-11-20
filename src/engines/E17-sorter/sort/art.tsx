/**
 * E17 sort·predict 카드 그림. 모두 직접 그린 SVG다(사진·교과서 그림 없음).
 *
 * 그림은 100×100 단위 상자 안에 원점 중심으로 그리고, `CardArt`가 `size`(논리 길이)에 맞게 줄인다.
 * 색만으로 구별하지 않도록 빨강은 꽉 찬 칠, 파랑은 빗금, 노랑은 점무늬다.
 * `gray`는 색·무늬를 빼고 생김새만 남긴 회색 모형(P 단계, gray-shapes 오버레이)이다.
 */
import type { ReactNode } from 'react';
import type { SortCard } from '../decks';
import { GRAY, paintOf } from './paint';

const INK = '#1d2330';

/** 무늬 정의. 그림을 쓰는 svg마다 한 번 넣는다(같은 내용이라 id가 겹쳐도 같다). */
export function ArtDefs() {
  return (
    <defs>
      <pattern
        id="sort-pat-blue"
        width="10"
        height="10"
        patternUnits="userSpaceOnUse"
        patternTransform="rotate(45)"
      >
        <rect width="10" height="10" fill="#d7e5ff" />
        <rect width="4.5" height="10" fill="#2f6fde" />
      </pattern>
      <pattern id="sort-pat-yellow" width="12" height="12" patternUnits="userSpaceOnUse">
        <rect width="12" height="12" fill="#fff2b0" />
        <circle cx="6" cy="6" r="3.2" fill="#c99700" />
      </pattern>
    </defs>
  );
}

const STROKE = { stroke: INK, strokeWidth: 3.5, strokeLinejoin: 'round' } as const;

// ── 단추 ─────────────────────────────────────────────────────

function holePositions(shape: string, holes: number): readonly (readonly [number, number])[] {
  if (shape === 'triangle') {
    return holes === 4
      ? [
          [-13, 6],
          [13, 6],
          [-13, 26],
          [13, 26],
        ]
      : [
          [-13, 16],
          [13, 16],
        ];
  }
  return holes === 4
    ? [
        [-15, -15],
        [15, -15],
        [-15, 15],
        [15, 15],
      ]
    : [
        [-15, 0],
        [15, 0],
      ];
}

export function ButtonArt({
  color,
  shape,
  holes,
  gray,
}: {
  readonly color: string;
  readonly shape: string;
  readonly holes: number;
  readonly gray: boolean;
}) {
  const fill = paintOf(color, gray);
  return (
    <g>
      {shape === 'circle' ? (
        <circle r={44} fill={fill} {...STROKE} />
      ) : shape === 'square' ? (
        <rect x={-42} y={-42} width={84} height={84} rx={8} fill={fill} {...STROKE} />
      ) : (
        <polygon points="0,-46 46,38 -46,38" fill={fill} {...STROKE} />
      )}
      {holePositions(shape, holes).map(([x, y]) => (
        <circle
          key={`${x},${y}`}
          cx={x}
          cy={y}
          r={6.5}
          fill="#fbfaf6"
          stroke={INK}
          strokeWidth={2.5}
        />
      ))}
    </g>
  );
}

// ── 사물 ─────────────────────────────────────────────────────

function BoxArt({
  w,
  h,
  fill,
  children,
}: {
  readonly w: number;
  readonly h: number;
  readonly fill: string;
  readonly children?: ReactNode;
}) {
  const dx = 18;
  const dy = -13;
  const fx = -w / 2 - dx / 2;
  const fy = -h / 2 - dy / 2;
  const top = `${fx},${fy} ${fx + dx},${fy + dy} ${fx + w + dx},${fy + dy} ${fx + w},${fy}`;
  const side = `${fx + w},${fy} ${fx + w + dx},${fy + dy} ${fx + w + dx},${fy + h + dy} ${fx + w},${fy + h}`;
  return (
    <g>
      <rect x={fx} y={fy} width={w} height={h} fill={fill} {...STROKE} />
      <polygon points={top} fill={fill} {...STROKE} />
      <polygon points={top} fill="#ffffff" fillOpacity={0.4} />
      <polygon points={side} fill={fill} {...STROKE} />
      <polygon points={side} fill="#000000" fillOpacity={0.2} />
      <g transform={`translate(${fx},${fy})`}>{children}</g>
    </g>
  );
}

function CylinderArt({
  w,
  h,
  fill,
  hollow = false,
  children,
}: {
  readonly w: number;
  readonly h: number;
  readonly fill: string;
  readonly hollow?: boolean;
  readonly children?: ReactNode;
}) {
  const rx = w / 2;
  const ry = w / 5;
  const top = -h / 2 + ry;
  const bottom = h / 2 - ry;
  return (
    <g>
      <path
        d={`M ${-rx} ${top} L ${-rx} ${bottom} A ${rx} ${ry} 0 0 0 ${rx} ${bottom} L ${rx} ${top} Z`}
        fill={fill}
        {...STROKE}
      />
      <g>{children}</g>
      <ellipse cx={0} cy={top} rx={rx} ry={ry} fill={fill} {...STROKE} />
      <ellipse cx={0} cy={top} rx={rx} ry={ry} fill="#ffffff" fillOpacity={0.4} />
      {hollow ? (
        <ellipse
          cx={0}
          cy={top}
          rx={rx * 0.62}
          ry={ry * 0.62}
          fill="#6b7280"
          stroke={INK}
          strokeWidth={2.5}
        />
      ) : null}
    </g>
  );
}

function SphereArt({
  fill,
  r = 40,
  children,
}: {
  readonly fill: string;
  readonly r?: number;
  readonly children?: ReactNode;
}) {
  return (
    <g>
      <circle r={r} fill={fill} {...STROKE} />
      {children}
      <ellipse
        cx={-r * 0.35}
        cy={-r * 0.4}
        rx={r * 0.3}
        ry={r * 0.18}
        fill="#ffffff"
        fillOpacity={0.5}
        transform={`rotate(-30 ${-r * 0.35} ${-r * 0.4})`}
      />
    </g>
  );
}

function ObjectShape({ id, fill }: { readonly id: string; readonly fill: string }) {
  switch (id) {
    case 'o-eraser':
      return (
        <BoxArt w={66} h={30} fill={fill}>
          <rect
            x={44}
            y={0}
            width={22}
            height={30}
            fill="#4b5563"
            fillOpacity={0.55}
            stroke={INK}
            strokeWidth={2.5}
          />
        </BoxArt>
      );
    case 'o-milk':
      return (
        <BoxArt w={36} h={62} fill={fill}>
          <path
            d="M 0 0 L 18 -12 L 36 0"
            fill="none"
            stroke={INK}
            strokeWidth={3}
            strokeLinejoin="round"
          />
          <rect
            x={7}
            y={26}
            width={22}
            height={18}
            rx={3}
            fill="#ffffff"
            fillOpacity={0.75}
            stroke={INK}
            strokeWidth={2}
          />
        </BoxArt>
      );
    case 'o-tissue':
      return (
        <BoxArt w={74} h={38} fill={fill}>
          <ellipse cx={37} cy={-4} rx={20} ry={5} fill="#fbfaf6" stroke={INK} strokeWidth={2.5} />
        </BoxArt>
      );
    case 'o-dice':
      return (
        <BoxArt w={48} h={48} fill={fill}>
          {[
            [12, 12],
            [24, 24],
            [36, 36],
          ].map(([x, y]) => (
            <circle key={`${x}`} cx={x} cy={y} r={4.5} fill={INK} />
          ))}
        </BoxArt>
      );
    case 'o-glue':
      return (
        <CylinderArt w={34} h={66} fill={fill}>
          <rect
            x={-17}
            y={-18}
            width={34}
            height={14}
            fill="#ffffff"
            fillOpacity={0.7}
            stroke={INK}
            strokeWidth={2.5}
          />
        </CylinderArt>
      );
    case 'o-roll':
      return <CylinderArt w={46} h={52} fill={fill} hollow />;
    case 'o-can-up':
    case 'o-can-side':
      return (
        <CylinderArt w={50} h={68} fill={fill}>
          <rect
            x={-25}
            y={-8}
            width={50}
            height={22}
            fill="#ffffff"
            fillOpacity={0.7}
            stroke={INK}
            strokeWidth={2.5}
          />
        </CylinderArt>
      );
    case 'o-ball':
      return (
        <SphereArt fill={fill} r={44}>
          <path d="M -44 0 Q 0 -22 44 0" fill="none" stroke={INK} strokeWidth={3} />
          <path d="M -22 -38 Q -4 0 -22 38" fill="none" stroke={INK} strokeWidth={3} />
        </SphereArt>
      );
    case 'o-marble':
      return (
        <SphereArt fill={fill} r={36}>
          <path
            d="M -22 8 Q 0 -20 22 6"
            fill="none"
            stroke="#ffffff"
            strokeOpacity={0.8}
            strokeWidth={4}
          />
        </SphereArt>
      );
    case 'o-orange':
      return (
        <SphereArt fill={fill} r={42}>
          <path
            d="M 0 -42 Q 12 -56 22 -46 Q 10 -38 0 -42 Z"
            fill="#3a8a4a"
            stroke={INK}
            strokeWidth={2.5}
          />
          <circle cx={14} cy={10} r={2.2} fill={INK} fillOpacity={0.6} />
          <circle cx={-6} cy={22} r={2.2} fill={INK} fillOpacity={0.6} />
          <circle cx={22} cy={-6} r={2.2} fill={INK} fillOpacity={0.6} />
        </SphereArt>
      );
    case 'o-bead':
      return (
        <SphereArt fill={fill} r={34}>
          <ellipse cx={0} cy={-2} rx={8} ry={5} fill="#fbfaf6" stroke={INK} strokeWidth={2.5} />
          <path d="M -34 -2 L -8 -2 M 8 -2 L 34 -2" stroke={INK} strokeWidth={3} />
        </SphereArt>
      );
    default:
      return <SphereArt fill={fill} />;
  }
}

/** 사물 크기 배율. 작은 것·중간 것·큰 것이 한눈에 다르게 보이도록 벌려 둔다. */
const SIZE_SCALE: Readonly<Record<string, number>> = { small: 0.86, mid: 1.03, big: 1.2 };

export function ObjectArt({
  id,
  color,
  size,
  lying,
  gray,
}: {
  readonly id: string;
  readonly color: string;
  readonly size: string;
  readonly lying: boolean;
  readonly gray: boolean;
}) {
  const scale = SIZE_SCALE[size] ?? 0.84;
  return (
    <g transform={`scale(${scale})${lying ? ' rotate(90)' : ''}`}>
      <ObjectShape id={id} fill={paintOf(color, gray)} />
    </g>
  );
}

// ── 카드·아이콘 ──────────────────────────────────────────────

/** 카드 하나. `center`에 `size`(논리 길이) 상자 안으로 그린다. 크기 배율은 사물 그림이 자체로 가진다. */
export function CardArt({
  card,
  size,
  x,
  y,
  gray = false,
}: {
  readonly card: SortCard;
  readonly size: number;
  readonly x: number;
  readonly y: number;
  readonly gray?: boolean;
}) {
  const a = card.attrs;
  return (
    <g transform={`translate(${x},${y}) scale(${size / 100})`}>
      {card.name === null ? (
        <ButtonArt
          color={String(a['color'])}
          shape={String(a['shape'])}
          holes={Number(a['holes'])}
          gray={gray}
        />
      ) : (
        <ObjectArt
          id={card.id}
          color={String(a['color'])}
          size={String(a['size'])}
          lying={a['orientation'] === 'lying'}
          gray={gray}
        />
      )}
    </g>
  );
}

/** 속성 값 아이콘(상자 이름·기준 단추용). 100 단위 상자 원점 중심. */
export function ValueIcon({
  attribute,
  value,
}: {
  readonly attribute: string;
  readonly value: string;
}) {
  switch (attribute) {
    case 'color':
      return (
        <rect
          x={-38}
          y={-38}
          width={76}
          height={76}
          rx={12}
          fill={paintOf(value, false)}
          {...STROKE}
        />
      );
    case 'shape':
      return <ButtonArt color="none" shape={value} holes={0} gray />;
    case 'holes':
      return <ButtonArt color="none" shape="circle" holes={Number(value)} gray />;
    case 'shapeFamily':
      return (
        <g transform="scale(0.8)">
          {value === 'box' ? (
            <BoxArt w={50} h={50} fill={GRAY} />
          ) : value === 'cylinder' ? (
            <CylinderArt w={50} h={64} fill={GRAY} />
          ) : (
            <SphereArt fill={GRAY} r={42} />
          )}
        </g>
      );
    case 'size': {
      const radius = value === 'small' ? 14 : value === 'mid' ? 26 : 40;
      return <circle r={radius} fill={GRAY} {...STROKE} />;
    }
    case 'pretty':
      return (
        <path
          d="M 0 30 C -50 -4 -30 -40 0 -16 C 30 -40 50 -4 0 30 Z"
          fill={value === 'pretty' ? '#f2a0b5' : 'none'}
          strokeDasharray={value === 'pretty' ? undefined : '8 6'}
          {...STROKE}
        />
      );
    default:
      return <circle r={30} fill={GRAY} {...STROKE} />;
  }
}

/** HTML 단추 안에 넣는 아이콘 svg. */
export function IconSvg({
  attribute,
  value,
  size,
}: {
  readonly attribute: string;
  readonly value: string;
  readonly size: number;
}) {
  return (
    <svg
      viewBox="-50 -50 100 100"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      style={{ display: 'block', flex: 'none' }}
    >
      <ArtDefs />
      <ValueIcon attribute={attribute} value={value} />
    </svg>
  );
}

/** 기준 아이콘(색깔·모양·구멍 수·크기·예쁜 것). 값 아이콘 둘~셋을 나란히 놓은 그림. */
export function CriterionIconSvg({
  criterion,
  size,
}: {
  readonly criterion: string;
  readonly size: number;
}) {
  const values: Readonly<Record<string, readonly string[]>> = {
    color: ['red', 'blue', 'yellow'],
    shape: ['circle', 'square', 'triangle'],
    holes: ['2', '4'],
    shapeFamily: ['box', 'cylinder', 'sphere'],
    size: ['small', 'mid', 'big'],
    pretty: ['pretty', 'plain'],
  };
  const list = values[criterion] ?? [];
  const count = list.length;
  const step = 100 / Math.max(count, 1);
  return (
    <svg
      viewBox="0 0 100 40"
      width={size * 2.2}
      height={size * 0.88}
      aria-hidden="true"
      focusable="false"
      style={{ display: 'block', flex: 'none' }}
    >
      <ArtDefs />
      {list.map((value, index) => (
        <g
          key={value}
          transform={`translate(${step * index + step / 2},20) scale(${Math.min(0.34, (step * 0.9) / 100)})`}
        >
          <ValueIcon attribute={criterion} value={value} />
        </g>
      ))}
    </svg>
  );
}
