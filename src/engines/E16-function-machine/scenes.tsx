/**
 * covary 장면 그림. ○ 값에 따라 그린다.
 * - chairs-legs: 의자 ○개(다리 4개씩) → 규칙 `□ = ○ × 4`
 * - triangles-sticks: 이쑤시개로 이은 삼각형 ○개 → 규칙 `□ = ○ × 2 + 1`
 * - dots: □개의 점(규칙에서 정해진 수를 5개씩 줄 지어 그린다)
 * 그림에는 수·정답 글자를 쓰지 않는다. 학생이 세어 볼 수 있는 그림만 그린다.
 */
import type { ReactNode } from 'react';
import type { CovaryLook, SceneId } from './types';

/** 장면 그림 안의 □ 개수(다리·이쑤시개 수). 점 장면은 규칙에 따라 정해지므로 null. */
export function sceneParts(scene: SceneId, x: number): number | null {
  if (scene === 'chairs-legs') return 4 * x;
  if (scene === 'triangles-sticks') return 2 * x + 1;
  return null;
}

export interface SceneBuild {
  readonly width: number;
  readonly height: number;
  readonly node: ReactNode;
}

const EMPTY: SceneBuild = { width: 100, height: 100, node: null };
const MAX_DOTS = 100;

function chairs(x: number): SceneBuild {
  if (x < 1) return EMPTY;
  const cols = Math.min(x, 5);
  const rows = Math.ceil(x / 5);
  const items = Array.from({ length: x }, (_, i) => {
    const ox = 14 + (i % 5) * 92;
    const oy = 14 + Math.floor(i / 5) * 116;
    return (
      <g key={i} data-chair="true">
        <path
          d={`M${ox + 14} ${oy + 62} L${ox + 14} ${oy + 104}`}
          stroke="#9a7040"
          strokeWidth={5}
        />
        <path
          d={`M${ox + 62} ${oy + 62} L${ox + 62} ${oy + 104}`}
          stroke="#9a7040"
          strokeWidth={5}
        />
        <path
          d={`M${ox + 28} ${oy + 56} L${ox + 28} ${oy + 96}`}
          stroke="#b8905c"
          strokeWidth={4}
        />
        <path
          d={`M${ox + 74} ${oy + 56} L${ox + 74} ${oy + 96}`}
          stroke="#b8905c"
          strokeWidth={4}
        />
        <rect
          x={ox + 6}
          y={oy + 8}
          width={10}
          height={54}
          rx={4}
          fill="#c9a06a"
          stroke="#7a5a30"
          strokeWidth={2}
        />
        <rect
          x={ox + 6}
          y={oy + 48}
          width={78}
          height={14}
          rx={4}
          fill="#d9b27c"
          stroke="#7a5a30"
          strokeWidth={2}
        />
      </g>
    );
  });
  return { width: cols * 92 + 28, height: rows * 116 + 28, node: items };
}

function chairDots(x: number): SceneBuild {
  if (x < 1) return EMPTY;
  const cols = Math.min(x, 5);
  const rows = Math.ceil(x / 5);
  const items = Array.from({ length: x }, (_, i) => {
    const ox = 14 + (i % 5) * 92;
    const oy = 14 + Math.floor(i / 5) * 92;
    return (
      <g key={i}>
        <rect
          x={ox}
          y={oy}
          width={76}
          height={76}
          rx={12}
          fill="#f3f6fd"
          stroke="#8b96ab"
          strokeWidth={2}
        />
        {[0, 1, 2, 3].map((d) => (
          <circle
            key={d}
            cx={ox + 24 + (d % 2) * 28}
            cy={oy + 24 + Math.floor(d / 2) * 28}
            r={9}
            fill="#2f6fde"
          />
        ))}
      </g>
    );
  });
  return { width: cols * 92 + 28, height: rows * 92 + 28, node: items };
}

/** 이쑤시개 띠: 꼭짓점 x+2개를 아래·위 줄에 번갈아 놓고, 이웃 꼭짓점과 한 칸 건너 꼭짓점을 잇는다. */
function strip(x: number): SceneBuild {
  if (x < 1) return EMPTY;
  const step = 44;
  const top = 18;
  const bottom = 98;
  const point = (i: number): [number, number] => [20 + i * step, i % 2 === 0 ? bottom : top];
  const sticks: ReactNode[] = [];
  for (let k = 0; k <= x; k += 1) {
    const [x1, y1] = point(k);
    const [x2, y2] = point(k + 1);
    sticks.push(<line key={`z${k}`} x1={x1} y1={y1} x2={x2} y2={y2} />);
  }
  for (let k = 0; k < x; k += 1) {
    const [x1, y1] = point(k);
    const [x2, y2] = point(k + 2);
    sticks.push(<line key={`h${k}`} x1={x1} y1={y1} x2={x2} y2={y2} />);
  }
  return {
    width: 40 + (x + 1) * step,
    height: 116,
    node: (
      <g stroke="#b8905c" strokeWidth={7} strokeLinecap="round" data-sticks="true">
        {sticks}
      </g>
    ),
  };
}

function bars(count: number): SceneBuild {
  if (count < 1) return EMPTY;
  const perRow = 12;
  const rows = Math.ceil(count / perRow);
  const items = Array.from({ length: count }, (_, i) => (
    <rect
      key={i}
      x={14 + (i % perRow) * 22}
      y={14 + Math.floor(i / perRow) * 56}
      width={10}
      height={44}
      rx={4}
      fill="#b8905c"
    />
  ));
  return { width: Math.min(count, perRow) * 22 + 28, height: rows * 56 + 28, node: items };
}

function dots(count: number): SceneBuild {
  if (count < 1 || count > MAX_DOTS) return EMPTY;
  const rows = Math.ceil(count / 5);
  const items = Array.from({ length: count }, (_, i) => (
    <circle
      key={i}
      cx={30 + (i % 5) * 44}
      cy={30 + Math.floor(i / 5) * 44}
      r={15}
      fill="#2f6fde"
      stroke="#1d4fa8"
      strokeWidth={2}
    />
  ));
  return { width: Math.min(count, 5) * 44 + 16, height: rows * 44 + 16, node: items };
}

/**
 * 장면 그림. `dotCount`는 점 장면(그리고 chairs-legs·triangles-sticks를 점으로 볼 때)의 점 수다.
 * 이 값은 규칙에서 정해지지만 그림 개수로만 쓰이고 글자로는 나가지 않는다.
 */
export function buildScene(
  scene: SceneId,
  look: CovaryLook,
  x: number,
  dotCount: number | null,
): SceneBuild {
  if (look === 'none') return EMPTY;
  if (scene === 'dots') return dots(dotCount ?? 0);
  if (scene === 'chairs-legs') return look === 'dots' ? chairDots(x) : chairs(x);
  return look === 'dots' ? bars(2 * x + 1) : strip(x);
}
