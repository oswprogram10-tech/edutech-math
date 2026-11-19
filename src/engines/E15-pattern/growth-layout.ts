/**
 * E15 growth 보기 판의 논리 좌표(화면 좌표라 number). GrowthView와 growth-split 오버레이가 같이 쓴다.
 *
 * 단계 칸(패널)은 보여 준 마지막 단계 모양이 들어가는 크기로 모두 같고,
 * 쌓기나무 원점(0,0,0)이 칸마다 같은 자리라서 앞 단계가 다음 단계 안에 그대로 있다.
 * 칸 아래에 단계 이름 줄과 오버레이 배지 줄(BADGE_H)을 비워 둔다.
 */
import { newCubes, stageCubes } from './growth';
import type { Cube } from './growth';
import type { GrowthSettings } from './types';

/** 쌓기나무 한 개의 논리 폭(등각 육각형 폭, 색칸 그림의 한 변). 화면 24px 기준 최소 배율은 24/CUBE. */
export const CUBE = 32;
/** 등각 쌓기나무 옆면 높이. */
export const SIDE_H = 20;
/** 등각 쌓기나무 전체 높이(윗면 마름모 16 + 옆면). */
export const CUBE_H = CUBE / 2 + SIDE_H;
export const PAD = 16;
export const GAP = 28;
export const LABEL_H = 30;
export const BADGE_H = 34;
const MIN_PANEL_W = 72;

export interface PlacedCube {
  readonly cube: Cube;
  readonly stage: number;
  readonly isNew: boolean;
  /** 그림 상자 왼쪽 위(논리). 등각은 CUBE × CUBE_H, 색칸은 CUBE × CUBE. */
  readonly left: number;
  readonly top: number;
}

export interface Panel {
  readonly stage: number;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly cubes: readonly PlacedCube[];
  readonly labelX: number;
  readonly labelY: number;
  readonly badgeX: number;
  readonly badgeY: number;
}

export interface GrowthLayout {
  readonly look: 'cubes' | 'flat';
  readonly width: number;
  readonly height: number;
  readonly panels: readonly Panel[];
}

/** 등각 투영: 큐브 윗꼭짓점(마름모 위 꼭짓점)의 위치. y(안쪽)는 쓰지 않아 0이다. */
function isoPoint(cube: Cube): { x: number; y: number } {
  const [x, y, z] = cube;
  return { x: (x - y) * (CUBE / 2), y: (x + y) * (CUBE / 4) - z * SIDE_H };
}

/** 그리는 순서(뒤에서 앞으로). 합이 작은 것부터 그리면 앞쪽·위쪽 쌓기나무가 위에 덮인다. */
function paintOrder(a: Cube, b: Cube): number {
  return a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]) || a[2] - b[2] || a[0] - b[0];
}

export function growthLayout(settings: GrowthSettings): GrowthLayout | null {
  if (settings.look === 'none') return null;
  const look = settings.look;
  const last = stageCubes(settings.shape, settings.stepsShown);

  // 마지막 단계 모양의 그림 상자(원점 기준)
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const cube of last) {
    let left: number;
    let top: number;
    if (look === 'cubes') {
      const p = isoPoint(cube);
      left = p.x - CUBE / 2;
      top = p.y;
    } else {
      left = cube[0] * CUBE;
      top = -cube[2] * CUBE;
    }
    const w = CUBE;
    const h = look === 'cubes' ? CUBE_H : CUBE;
    minX = Math.min(minX, left);
    minY = Math.min(minY, top);
    maxX = Math.max(maxX, left + w);
    maxY = Math.max(maxY, top + h);
  }
  const boxW = maxX - minX;
  const boxH = maxY - minY;
  // 단계 이름("3단계")이 들어가도록 칸 폭의 최솟값을 둔다. 모양은 칸 가운데에 둔다.
  const panelW = Math.max(boxW, MIN_PANEL_W);
  const offX = (panelW - boxW) / 2;
  const panelH = boxH;

  const panels: Panel[] = [];
  for (let stage = 1; stage <= settings.stepsShown; stage += 1) {
    const x = PAD + (stage - 1) * (panelW + GAP);
    const y = PAD;
    const fresh = new Set(newCubes(settings.shape, stage).map((c) => c.join(',')));
    const placed: PlacedCube[] = [];
    for (const cube of [...stageCubes(settings.shape, stage)].sort(paintOrder)) {
      let left: number;
      let top: number;
      if (look === 'cubes') {
        const p = isoPoint(cube);
        left = p.x - CUBE / 2;
        top = p.y;
      } else {
        left = cube[0] * CUBE;
        top = -cube[2] * CUBE;
      }
      placed.push({
        cube,
        stage,
        // 1단계는 늘어난 것이 없다(처음 모양). 강조는 2단계부터다.
        isNew: settings.highlightIncrement && stage >= 2 && fresh.has(cube.join(',')),
        left: x + offX + (left - minX),
        top: y + (top - minY),
      });
    }
    panels.push({
      stage,
      x,
      y,
      w: panelW,
      h: panelH,
      cubes: placed,
      labelX: x + panelW / 2,
      labelY: y + panelH + 8 + LABEL_H / 2,
      badgeX: x + panelW / 2,
      badgeY: y + panelH + 8 + LABEL_H + 4 + BADGE_H / 2,
    });
  }
  return {
    look,
    width: PAD * 2 + settings.stepsShown * panelW + (settings.stepsShown - 1) * GAP,
    height: PAD * 2 + panelH + 8 + LABEL_H + 4 + BADGE_H,
    panels,
  };
}

/** 등각 쌓기나무 세 면의 꼭짓점(논리). `left`·`top`은 그림 상자 왼쪽 위. */
export function cubeFaces(
  left: number,
  top: number,
): { readonly top: string; readonly left: string; readonly right: string } {
  const cx = left + CUBE / 2;
  const half = CUBE / 2;
  const q = CUBE / 4;
  return {
    top: `${cx},${top} ${cx + half},${top + q} ${cx},${top + half} ${cx - half},${top + q}`,
    left: `${cx - half},${top + q} ${cx},${top + half} ${cx},${top + half + SIDE_H} ${cx - half},${top + q + SIDE_H}`,
    right: `${cx},${top + half} ${cx + half},${top + q} ${cx + half},${top + q + SIDE_H} ${cx},${top + half + SIDE_H}`,
  };
}
