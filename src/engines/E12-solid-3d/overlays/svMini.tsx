/**
 * `surface-volume` 힌트 ② 오버레이가 함께 쓰는 작은 그림(전개도·등각 상자). 넓이·개수 숫자를 쓰지 않는다.
 */
import { computeStageLayout, pointsAttr, projectPoint } from '../layout';
import { netLayout } from '../sv/geometry';
import type { XrayFaceId } from '../xray/geometry';

export interface SvMiniFaceStyle {
  readonly fill: string;
  readonly stroke: string;
  readonly strokeWidth: number;
  /** true면 테두리를 깜빡인다(`animate`). */
  readonly blink?: boolean;
}

interface MiniNetProps {
  readonly w: number;
  readonly d: number;
  readonly h: number;
  readonly cell: number;
  readonly x0: number;
  readonly y0: number;
  readonly grid?: boolean;
  readonly style: (face: XrayFaceId) => SvMiniFaceStyle;
  readonly testIdPrefix?: string;
  readonly reducedMotion?: boolean;
}

export function SvMiniNet({
  w,
  d,
  h,
  cell,
  x0,
  y0,
  grid = true,
  style,
  testIdPrefix,
  reducedMotion = true,
}: MiniNetProps) {
  return (
    <g>
      {netLayout(w, d, h).map((f) => {
        const st = style(f.face);
        const px = x0 + f.x * cell;
        const py = y0 + f.y * cell;
        const lines: React.ReactNode[] = [];
        if (grid) {
          for (let i = 1; i < f.w; i += 1) {
            lines.push(
              <line
                key={`v${i}`}
                x1={px + i * cell}
                y1={py}
                x2={px + i * cell}
                y2={py + f.h * cell}
                stroke="#cbd5e1"
                strokeWidth={0.8}
              />,
            );
          }
          for (let j = 1; j < f.h; j += 1) {
            lines.push(
              <line
                key={`h${j}`}
                x1={px}
                y1={py + j * cell}
                x2={px + f.w * cell}
                y2={py + j * cell}
                stroke="#cbd5e1"
                strokeWidth={0.8}
              />,
            );
          }
        }
        return (
          <g
            key={f.face}
            data-testid={testIdPrefix ? `${testIdPrefix}-face-${f.face}` : undefined}
            data-blink={st.blink ? 'true' : undefined}
          >
            <rect x={px} y={py} width={f.w * cell} height={f.h * cell} fill={st.fill} />
            {lines}
            <rect
              x={px}
              y={py}
              width={f.w * cell}
              height={f.h * cell}
              fill="none"
              stroke={st.stroke}
              strokeWidth={st.strokeWidth}
              strokeLinejoin="round"
            >
              {st.blink && !reducedMotion ? (
                <animate
                  attributeName="stroke-opacity"
                  values="1;0.1"
                  dur="1.6s"
                  calcMode="discrete"
                  repeatCount="indefinite"
                />
              ) : null}
            </rect>
          </g>
        );
      })}
    </g>
  );
}

interface IsoBoxProps {
  readonly w: number;
  readonly d: number;
  readonly h: number;
  readonly unit: number;
  /** 'hatch'면 면을 빗금으로 감싼 포장지, 'cubes'면 1칸 격자(쌓기나무). */
  readonly kind: 'hatch' | 'cubes';
  readonly idPrefix: string;
}

/** 등각 상자 그림. 좌표 원점(0, 0)을 왼쪽 위에 두고 `box` 크기를 돌려주지 않는다(호출자가 `translate`). */
export function SvIsoBoxMini({ w, d, h, unit, kind, idPrefix }: IsoBoxProps) {
  const layout = computeStageLayout(w, d, h, unit);
  const p = (x: number, y: number, z: number) => projectPoint(layout, x, y, z);
  const top = [p(0, 0, h), p(w, 0, h), p(w, d, h), p(0, d, h)];
  const front = [p(0, 0, 0), p(w, 0, 0), p(w, 0, h), p(0, 0, h)];
  const right = [p(w, 0, 0), p(w, d, 0), p(w, d, h), p(w, 0, h)];
  const faces = [
    { id: 'top', pts: top, fill: '#eef3ff' },
    { id: 'front', pts: front, fill: '#d3e0fa' },
    { id: 'right', pts: right, fill: '#b9cdf3' },
  ];
  const lines: { a: ReturnType<typeof p>; b: ReturnType<typeof p> }[] = [];
  if (kind === 'cubes') {
    for (let x = 1; x < w; x += 1) {
      lines.push({ a: p(x, 0, h), b: p(x, d, h) }, { a: p(x, 0, 0), b: p(x, 0, h) });
    }
    for (let y = 1; y < d; y += 1) {
      lines.push({ a: p(0, y, h), b: p(w, y, h) }, { a: p(w, y, 0), b: p(w, y, h) });
    }
    for (let z = 1; z < h; z += 1) {
      lines.push({ a: p(0, 0, z), b: p(w, 0, z) }, { a: p(w, 0, z), b: p(w, d, z) });
    }
  }
  const hatchId = `${idPrefix}-hatch`;
  return (
    <g data-box-kind={kind}>
      {kind === 'hatch' ? (
        <defs>
          <pattern id={hatchId} patternUnits="userSpaceOnUse" width={6} height={6}>
            <rect width={6} height={6} fill="#fff4e0" />
            <path d="M-1,7 L7,-1" stroke="#d9730d" strokeWidth={1.4} />
          </pattern>
        </defs>
      ) : null}
      {faces.map((f) => (
        <polygon
          key={f.id}
          points={pointsAttr(f.pts)}
          fill={kind === 'hatch' ? `url(#${hatchId})` : f.fill}
          stroke="#1e293b"
          strokeWidth={1.6}
          strokeLinejoin="round"
        />
      ))}
      {lines.map((l, i) => (
        <line
          key={i}
          x1={l.a.x}
          y1={l.a.y}
          x2={l.b.x}
          y2={l.b.y}
          stroke="#5b6f93"
          strokeOpacity={0.7}
          strokeWidth={0.9}
        />
      ))}
    </g>
  );
}
