/**
 * E18 band-circle의 기하(순수 함수). 화면 좌표(논리 1000×H)만 실수다.
 *
 * 띠(가로 100칸)를 말아 원그래프로 바꾸는 연속 모핑을 한 식으로 그린다.
 * - 띠 위의 점은 (u, v)로 부른다. u는 띠를 따라 0(왼쪽 끝)~1(오른쪽 끝), v는 두께 방향 0(바깥)~1(안쪽).
 *   조각이 100칸을 넘으면 u > 1도 쓴다(곧은 띠에서는 틀 밖으로, 원그래프에서는 한 바퀴 넘어 겹친다).
 * - curl 0~80: 띠가 길이를 지킨 채 일정한 곡률로 굽는다. 곡률은 curl에 비례하고 80에서 닫힌 고리가 된다.
 *   굽는 쪽은 아래(시계 방향)라서 고리의 12시 방향에서 오른쪽으로 나아가는 띠가 시계 방향 조각이 된다.
 *   왼쪽 끝은 곧은 띠 자리에서 고리 12시 자리로 옮겨 간다(p(2−p) 보간, p = curl/80). 모양이 틀(캔버스) 밖으로 나가면 안으로 밀어 넣는다.
 * - curl 80~100: 고리 안쪽 반지름이 0으로 줄고 바깥 반지름이 원그래프 반지름으로 자라 부채꼴 원그래프가 된다.
 * 조각 각도는 칸 수 × 3.6°이고 12시 방향에서 시계 방향이다.
 */

export const BAND_CELLS = 100;
export const DEGREES_PER_CELL = 3.6;
/** curl이 이 값이 되면 띠가 닫힌 고리가 된다. */
export const RING_CURL = 80;
export const MAX_CURL = 100;

const MARGIN = 12;
const BAND_LENGTH = 900;
const BAND_THICKNESS = 100;

export interface BandFrame {
  /** 논리 크기(viewBox). */
  readonly width: number;
  readonly height: number;
  /** 곧은 띠: 왼쪽 끝 x, 가운데 선 y, 길이(100칸), 두께. */
  readonly band: {
    readonly x: number;
    readonly y: number;
    readonly length: number;
    readonly thickness: number;
  };
  /** 원그래프. */
  readonly pie: { readonly cx: number; readonly cy: number; readonly r: number };
  /** 두 번째 원그래프의 중심(없으면 null). */
  readonly compare: { readonly cx: number; readonly cy: number } | null;
  /** 두 원을 위아래로 쌓았는가. */
  readonly stacked: boolean;
}

const PIE_R = 225;
const PIE_CY = 460;

/** 논리 틀. `compare`가 있으면 두 번째 원을 오른쪽(좁으면 `stacked`로 아래)에 둔다. */
export function bandFrameOf(compare: boolean, stacked: boolean): BandFrame {
  const band = { x: 50, y: 140, length: BAND_LENGTH, thickness: BAND_THICKNESS };
  if (!compare) {
    return {
      width: 1000,
      height: 760,
      band,
      pie: { cx: 500, cy: PIE_CY, r: PIE_R },
      compare: null,
      stacked: false,
    };
  }
  if (stacked) {
    const second = PIE_CY + 2 * PIE_R + 150;
    return {
      width: 1000,
      height: second + PIE_R + 90,
      band,
      pie: { cx: 500, cy: PIE_CY, r: PIE_R },
      compare: { cx: 500, cy: second },
      stacked: true,
    };
  }
  return {
    width: 1000,
    height: 760,
    band,
    pie: { cx: 260, cy: PIE_CY, r: PIE_R },
    compare: { cx: 740, cy: PIE_CY },
    stacked: false,
  };
}

/** 고리의 가운데 선 반지름: 띠 길이 / 2π. */
export function ringRadius(frame: BandFrame): number {
  return frame.band.length / (2 * Math.PI);
}

export function clampCurl(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(MAX_CURL, Math.max(0, Math.round(value)));
}

export interface PathPoint {
  readonly x: number;
  readonly y: number;
}

export interface BandMapper {
  /** 띠 위의 점 (u, v). */
  at(u: number, v: number): PathPoint;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** curl 0~80의 굽은 띠(왼쪽 끝 `anchor`). */
function bentPoint(
  frame: BandFrame,
  p: number,
  anchor: PathPoint,
  u: number,
  v: number,
): PathPoint {
  const { length, thickness } = frame.band;
  const s = u * length;
  const kappa = (2 * Math.PI * p) / length;
  const theta = kappa * s;
  const cx = kappa < 1e-9 ? s : Math.sin(theta) / kappa;
  const cy = kappa < 1e-9 ? 0 : (1 - Math.cos(theta)) / kappa;
  const offset = (v - 0.5) * thickness;
  return {
    x: anchor.x + cx + offset * -Math.sin(theta),
    y: anchor.y + cy + offset * Math.cos(theta),
  };
}

/**
 * curl에 맞는 (u, v) → 화면 좌표 변환. 한 번 만들어 여러 점에 쓴다.
 * curl은 0~100으로 자른다.
 */
export function bandMapper(frame: BandFrame, curl: number): BandMapper {
  const c = Math.min(MAX_CURL, Math.max(0, Number.isFinite(curl) ? curl : 0));
  const { thickness } = frame.band;
  const rc = ringRadius(frame);
  const { cx, cy, r } = frame.pie;

  if (c > RING_CURL) {
    const q = (c - RING_CURL) / (MAX_CURL - RING_CURL);
    const ringOuter = rc + thickness / 2;
    const outer = ringOuter + q * (r - ringOuter);
    const inner = (rc - thickness / 2) * (1 - q);
    return {
      at(u, v) {
        const angle = 2 * Math.PI * u;
        const radius = outer - v * (outer - inner);
        return { x: cx + radius * Math.sin(angle), y: cy - radius * Math.cos(angle) };
      },
    };
  }

  const p = c / RING_CURL;
  const start: PathPoint = { x: frame.band.x, y: frame.band.y };
  const target: PathPoint = { x: cx, y: cy - rc };
  const weight = p * (2 - p);
  const anchor: PathPoint = {
    x: start.x + weight * (target.x - start.x),
    y: start.y + weight * (target.y - start.y),
  };

  // 모양이 틀 밖으로 나가면 안으로 민다(곧은 띠와 닫힌 고리는 이미 안에 있다).
  let shiftX = 0;
  let shiftY = 0;
  if (p > 0 && p < 1) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    const samples = 48;
    for (let i = 0; i <= samples; i += 1) {
      for (const v of [0, 1]) {
        const point = bentPoint(frame, p, anchor, i / samples, v);
        minX = Math.min(minX, point.x);
        maxX = Math.max(maxX, point.x);
        minY = Math.min(minY, point.y);
        maxY = Math.max(maxY, point.y);
      }
    }
    shiftX = Math.max(0, MARGIN - minX) + Math.min(0, frame.width - MARGIN - maxX);
    shiftY = Math.max(0, MARGIN - minY) + Math.min(0, frame.height - MARGIN - maxY);
    // 틀이 모양보다 작으면 위·왼쪽을 우선한다.
    if (maxX - minX > frame.width - 2 * MARGIN) shiftX = MARGIN - minX;
    if (maxY - minY > frame.height - 2 * MARGIN) shiftY = MARGIN - minY;
  }
  const moved: PathPoint = { x: anchor.x + shiftX, y: anchor.y + shiftY };
  return { at: (u, v) => bentPoint(frame, p, moved, u, v) };
}

export interface BandSegment {
  readonly cat: string;
  readonly cells: number;
}

export interface SlicePath {
  readonly cat: string;
  readonly index: number;
  /** 조각이 차지하는 띠 구간(칸 수 / 100). */
  readonly u0: number;
  readonly u1: number;
  readonly cells: number;
  /** SVG path 데이터(닫힌 다각형). 칸이 0이면 빈 문자열. */
  readonly d: string;
  /** 글자를 둘 자리. */
  readonly label: PathPoint;
  /** 조각 가운데의 12시 기준 시계 방향 각도(°). 원그래프일 때만 뜻이 있다. */
  readonly midDegrees: number;
}

export interface BandCirclePath {
  readonly slices: readonly SlicePath[];
  /** 100칸 틀의 바깥 선. */
  readonly frameD: string;
  /** 띠의 오른쪽 끝(가운데 선). */
  readonly end: PathPoint;
}

function polygon(mapper: BandMapper, u0: number, u1: number, curl: number): string {
  const span = Math.abs(u1 - u0);
  const steps = curl === 0 ? 2 : Math.max(2, Math.ceil(span * 120) + 1);
  const points: PathPoint[] = [];
  for (let i = 0; i < steps; i += 1) {
    points.push(mapper.at(u0 + ((u1 - u0) * i) / (steps - 1), 0));
  }
  for (let i = steps - 1; i >= 0; i -= 1) {
    points.push(mapper.at(u0 + ((u1 - u0) * i) / (steps - 1), 1));
  }
  return `${points.map((point, i) => `${i === 0 ? 'M' : 'L'}${round(point.x)} ${round(point.y)}`).join(' ')} Z`;
}

/** 띠의 한 구간(u0~u1)을 curl에서 그린 닫힌 다각형 path. 구간이 비면 빈 문자열. */
export function regionPath(frame: BandFrame, curl: number, u0: number, u1: number): string {
  if (!(u1 > u0)) return '';
  return polygon(bandMapper(frame, curl), u0, u1, Math.round(curl));
}

/** 띠 위의 점 (u, v)의 화면 좌표. */
export function pointAt(frame: BandFrame, curl: number, u: number, v: number): PathPoint {
  const point = bandMapper(frame, curl).at(u, v);
  return { x: round(point.x), y: round(point.y) };
}

/**
 * 조각들의 모양. 조각은 범주 순서대로 왼쪽부터 이어 놓고, 칸 수 합이 100이 아니어도 그 칸 수 그대로 그린다
 * (넘치면 틀 밖·겹침, 모자라면 빈칸).
 */
export function bandCirclePath(
  segments: readonly BandSegment[],
  curl: number,
  frame: BandFrame,
): BandCirclePath {
  const c = Math.min(MAX_CURL, Math.max(0, Number.isFinite(curl) ? curl : 0));
  const mapper = bandMapper(frame, c);
  let used = 0;
  const slices = segments.map((segment, index): SlicePath => {
    const cells = Math.max(0, segment.cells);
    const u0 = used / BAND_CELLS;
    used += cells;
    const u1 = used / BAND_CELLS;
    const mid = (u0 + u1) / 2;
    const label = mapper.at(mid, 0.4);
    return {
      cat: segment.cat,
      index,
      u0,
      u1,
      cells,
      d: cells > 0 ? polygon(mapper, u0, u1, Math.round(c)) : '',
      label: { x: round(label.x), y: round(label.y) },
      midDegrees: mid * 360,
    };
  });
  const end = mapper.at(1, 0.5);
  return {
    slices,
    frameD: polygon(mapper, 0, 1, Math.round(c)),
    end: { x: round(end.x), y: round(end.y) },
  };
}

/** 띠 왼쪽 끝과 오른쪽 끝(가운데 선)의 거리: p = curl / 80일 때 L·sin(πp)/(πp). */
export function chordLength(frame: BandFrame, curl: number): number {
  const length = frame.band.length;
  const p = Math.min(1, Math.max(0, curl / RING_CURL));
  if (p < 1e-9) return length;
  return (length * Math.sin(Math.PI * p)) / (Math.PI * p);
}

/**
 * 끄는 손가락과 곧은 띠 왼쪽 끝 사이의 거리 d로 curl(0~80)을 정한다.
 * d ≥ 띠 길이면 0, d ≤ 0이면 80이고, 그 사이는 단조(이분법)다.
 */
export function curlFromDistance(frame: BandFrame, distance: number): number {
  const length = frame.band.length;
  if (!Number.isFinite(distance) || distance >= length) return 0;
  if (distance <= 0) return RING_CURL;
  let lo = 0;
  let hi = RING_CURL;
  for (let i = 0; i < 40; i += 1) {
    const mid = (lo + hi) / 2;
    if (chordLength(frame, mid) > distance) lo = mid;
    else hi = mid;
  }
  return Math.round(((lo + hi) / 2) * 100) / 100;
}

/** 칸 수 합과 100의 관계: 'under' 모자람, 'exact', 'over' 넘침. */
export function bandFill(cellSum: number): 'under' | 'exact' | 'over' {
  if (cellSum < BAND_CELLS) return 'under';
  return cellSum > BAND_CELLS ? 'over' : 'exact';
}
