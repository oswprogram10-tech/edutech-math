/** 각기둥 전개도 그림 공용 값(화면 좌표 계산). */
import { layoutBounds, polygonCenter, type PlacedPiece, type Pt } from './layout';

export const BASE_STYLE = { fill: '#cfe3ff', stroke: '#2f6fde' } as const;
export const RECT_STYLE = { fill: '#fff0b8', stroke: '#b7791f' } as const;

export function pieceStyle(type: 'base' | 'rect') {
  return type === 'base' ? BASE_STYLE : RECT_STYLE;
}

/** 배치 좌표(y 위쪽 +) → 화면 좌표: `(ox + x*scale, oy - y*scale)`. */
export interface Fit {
  readonly scale: number;
  readonly ox: number;
  readonly oy: number;
}

export function fitPlaced(
  placed: readonly PlacedPiece[],
  width: number,
  height: number,
  pad: number,
  maxCell: number,
  minCell = 4,
): Fit {
  const b = layoutBounds(placed);
  const bw = Math.max(b.maxX - b.minX, 1e-6);
  const bh = Math.max(b.maxY - b.minY, 1e-6);
  const raw = Math.min((width - pad * 2) / bw, (height - pad * 2) / bh, maxCell);
  const scale = Math.max(minCell, raw);
  return {
    scale,
    ox: width / 2 - ((b.minX + b.maxX) / 2) * scale,
    oy: height / 2 + ((b.minY + b.maxY) / 2) * scale,
  };
}

export function toScreen(fit: Fit, p: Pt): Pt {
  return { x: fit.ox + p.x * fit.scale, y: fit.oy - p.y * fit.scale };
}

export function pointsAttr(points: readonly Pt[]): string {
  return points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}

/** 밑면 가운데에 그리는 작은 정다각형 표시(색만으로 알리지 않기 위함). 화면 좌표를 받는다. */
export function baseMarkerPoints(screenPoints: readonly Pt[]): string {
  const n = screenPoints.length;
  const c = polygonCenter(screenPoints);
  const first = screenPoints[0];
  const radius = first ? Math.hypot(first.x - c.x, first.y - c.y) * 0.3 : 4;
  const pts: Pt[] = Array.from({ length: n }, (_, k) => {
    const a = -Math.PI / 2 - Math.PI / n + (2 * Math.PI * k) / n;
    return { x: c.x + radius * Math.cos(a), y: c.y - radius * Math.sin(a) };
  });
  return pointsAttr(pts);
}
