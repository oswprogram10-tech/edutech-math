/**
 * E17 화면 배치. View·overlay·E2E가 같은 좌표를 쓰도록 한 곳에 모은다.
 * 좌표는 모두 논리 좌표(1000×1000)이고, 여기서만 number를 쓴다.
 */
import type { Point } from '../../core/engine-sdk';
import type { DeckCard } from './deck';
import { deckIds } from './deck';
import type { ConstraintToggle, QuadName, QuadNode, VennState } from './types';

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface CardFrame {
  readonly box: Box;
}

/** venn 칸 영역: x 160~1000, y 70~610을 3등분. */
export const VENN_GRID = { x: 160, y: 70, width: 840, height: 540 } as const;
export const VENN_CELL_WIDTH = 280;
export const VENN_CELL_HEIGHT = 180;

/** 카드 칸: y 640~1000, 2줄 × 6장(각 160×170). */
export const VENN_TRAY = { x: 0, y: 640, width: 1000, height: 360 } as const;
export const VENN_TRAY_CELL = { width: 160, height: 170 } as const;
export const VENN_TRAY_COLUMNS = 6;
export const VENN_TRAY_MARGIN_X = 20;
export const VENN_TRAY_MARGIN_Y = 10;

/** 스무고개 카드 16장 4×4(칸 230×230). */
export const SECRET_GRID = { x: 40, y: 60, width: 920, height: 920 } as const;
export const SECRET_CELL = 230;

/** 큰 그림이 필요한 오버레이의 돋보기 판. */
export const PANEL: Box = { x: 520, y: 600, width: 460, height: 380 };

export function vennCellBox(row: number, col: number): Box {
  return {
    x: VENN_GRID.x + col * VENN_CELL_WIDTH,
    y: VENN_GRID.y + row * VENN_CELL_HEIGHT,
    width: VENN_CELL_WIDTH,
    height: VENN_CELL_HEIGHT,
  };
}

export function vennTrayBox(index: number): Box {
  const row = Math.floor(index / VENN_TRAY_COLUMNS);
  const col = index % VENN_TRAY_COLUMNS;
  return {
    x: VENN_TRAY_MARGIN_X + col * VENN_TRAY_CELL.width,
    y: VENN_TRAY.y + VENN_TRAY_MARGIN_Y + row * VENN_TRAY_CELL.height,
    width: VENN_TRAY_CELL.width,
    height: VENN_TRAY_CELL.height,
  };
}

export function secretCardBox(index: number): Box {
  const row = Math.floor(index / 4);
  const col = index % 4;
  return {
    x: SECRET_GRID.x + col * SECRET_CELL,
    y: SECRET_GRID.y + row * SECRET_CELL,
    width: SECRET_CELL,
    height: SECRET_CELL,
  };
}

export function boxCenter(box: Box): Point {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

export function pointInBox(point: Point, box: Box): boolean {
  return (
    point.x >= box.x &&
    point.x <= box.x + box.width &&
    point.y >= box.y &&
    point.y <= box.y + box.height
  );
}

/** venn 칸·카드 칸 위의 논리 좌표를 찾는다. */
export function vennTargetAt(
  point: Point,
  rows: number,
  cols: number,
):
  | { readonly kind: 'cell'; readonly row: number; readonly col: number }
  | {
      readonly kind: 'tray';
      readonly index: number;
    }
  | null {
  if (
    point.x >= VENN_GRID.x &&
    point.x < VENN_GRID.x + VENN_GRID.width &&
    point.y >= VENN_GRID.y &&
    point.y < VENN_GRID.y + VENN_GRID.height
  ) {
    const col = Math.floor((point.x - VENN_GRID.x) / VENN_CELL_WIDTH);
    const row = Math.floor((point.y - VENN_GRID.y) / VENN_CELL_HEIGHT);
    if (row < rows && col < cols) return { kind: 'cell', row, col };
    return null;
  }
  if (pointInBox(point, VENN_TRAY)) {
    const col = Math.min(
      VENN_TRAY_COLUMNS - 1,
      Math.max(0, Math.floor((point.x - VENN_TRAY_MARGIN_X) / VENN_TRAY_CELL.width)),
    );
    const row = Math.min(
      1,
      Math.max(0, Math.floor((point.y - VENN_TRAY.y - VENN_TRAY_MARGIN_Y) / VENN_TRAY_CELL.height)),
    );
    return { kind: 'tray', index: row * VENN_TRAY_COLUMNS + col };
  }
  return null;
}

/** 카드 좌표를 화면 좌표로. y는 √k 배 해서 그린다(화면 계산만 number). */
export function cardScreenPoints(card: DeckCard, unit: number, center: Point): Point[] {
  const xs = card.points.map(([x]) => x);
  const ys = card.points.map(([, y]) => y * Math.sqrt(card.yScale2));
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const offsetX = center.x - ((minX + maxX) / 2) * unit;
  const offsetY = center.y - ((minY + maxY) / 2) * unit;
  return card.points.map(([x, y]) => ({
    x: offsetX + x * unit,
    y: offsetY + y * Math.sqrt(card.yScale2) * unit,
  }));
}

/** 사각형 꼭짓점(정수 격자, y 배율 1)을 상자 안에 비율 유지하며 맞춘다. */
export function fitPoints(
  points: readonly (readonly [number, number])[],
  box: Box,
  padding = 12,
): Point[] {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const scale = Math.min((box.width - padding * 2) / width, (box.height - padding * 2) / height);
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  const offsetX = centerX - ((minX + maxX) / 2) * scale;
  const offsetY = centerY - ((minY + maxY) / 2) * scale;
  return points.map(([x, y]) => ({ x: offsetX + x * scale, y: offsetY + y * scale }));
}

// ── hierarchy 모양 ────────────────────────────────────────────

export interface HierarchyShape {
  readonly p: 0 | 1 | 2;
  readonly equalSides: boolean;
  readonly rightAngle: boolean;
  readonly points: readonly (readonly [number, number])[];
}

/**
 * 토글 → 모양 좌표표(T108 결정 7). 유효 조건은
 * `p = (two-parallel-pairs 또는 equal-sides) ? 2 : one-parallel-pair ? 1 : 0`.
 */
export const HIERARCHY_SHAPES: readonly HierarchyShape[] = [
  {
    p: 0,
    equalSides: false,
    rightAngle: false,
    points: [
      [1, 1],
      [7, 2],
      [6, 6],
      [2, 6],
    ],
  },
  {
    p: 0,
    equalSides: false,
    rightAngle: true,
    points: [
      [1, 1],
      [7, 2],
      [6, 6],
      [1, 6],
    ],
  },
  {
    p: 1,
    equalSides: false,
    rightAngle: false,
    points: [
      [2, 1],
      [6, 1],
      [8, 6],
      [1, 6],
    ],
  },
  {
    p: 1,
    equalSides: false,
    rightAngle: true,
    points: [
      [1, 1],
      [5, 1],
      [8, 6],
      [1, 6],
    ],
  },
  {
    p: 2,
    equalSides: false,
    rightAngle: false,
    points: [
      [2, 1],
      [7, 1],
      [6, 6],
      [1, 6],
    ],
  },
  {
    p: 2,
    equalSides: false,
    rightAngle: true,
    points: [
      [1, 2],
      [8, 2],
      [8, 6],
      [1, 6],
    ],
  },
  {
    p: 2,
    equalSides: true,
    rightAngle: false,
    points: [
      [4, 0],
      [7, 4],
      [4, 8],
      [1, 4],
    ],
  },
  {
    p: 2,
    equalSides: true,
    rightAngle: true,
    points: [
      [2, 1],
      [7, 1],
      [7, 6],
      [2, 6],
    ],
  },
];

export function hierarchyLevel(toggles: readonly ConstraintToggle[]): {
  readonly p: 0 | 1 | 2;
  readonly equalSides: boolean;
  readonly rightAngle: boolean;
} {
  const two = toggles.includes('two-parallel-pairs');
  const one = toggles.includes('one-parallel-pair');
  const equalSides = toggles.includes('equal-sides');
  const rightAngle = toggles.includes('right-angle');
  const p: 0 | 1 | 2 = two || equalSides ? 2 : one ? 1 : 0;
  return { p, equalSides: p === 2 ? equalSides : false, rightAngle };
}

export function hierarchyPoints(
  toggles: readonly ConstraintToggle[],
): readonly (readonly [number, number])[] {
  const level = hierarchyLevel(toggles);
  const shape =
    HIERARCHY_SHAPES.find(
      (candidate) =>
        candidate.p === level.p &&
        candidate.equalSides === level.equalSides &&
        candidate.rightAngle === level.rightAngle,
    ) ?? HIERARCHY_SHAPES[0];
  return shape ? shape.points : [];
}

// ── hierarchy 트리 ────────────────────────────────────────────

export interface TreeNodeLayout {
  readonly name: QuadName;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export const TREE_NODE = { width: 150, height: 70 } as const;

const INCLUSIVE_TREE: readonly (readonly [QuadName, number, number])[] = [
  ['quadrilateral', 730, 80],
  ['trapezoid', 730, 250],
  ['parallelogram', 730, 420],
  ['rhombus', 620, 600],
  ['rectangle', 840, 600],
  ['square', 730, 780],
];

const EXCLUSIVE_TREE: readonly (readonly [QuadName, number, number])[] = [
  ['quadrilateral', 730, 80],
  ['trapezoid', 560, 260],
  ['parallelogram', 840, 260],
  ['rhombus', 720, 450],
  ['rectangle', 920, 450],
  ['square', 820, 640],
];

export function treeNodes(definition: 'inclusive' | 'exclusive'): TreeNodeLayout[] {
  const source = definition === 'inclusive' ? INCLUSIVE_TREE : EXCLUSIVE_TREE;
  return source.map(([name, x, y]) => ({
    name,
    x,
    y,
    width: TREE_NODE.width,
    height: TREE_NODE.height,
  }));
}

export function treeNodeBox(node: TreeNodeLayout): Box {
  return {
    x: node.x - node.width / 2,
    y: node.y - node.height / 2,
    width: node.width,
    height: node.height,
  };
}

/** 트리 연결선(부모 → 자식) 쌍. */
export function treeEdges(definition: 'inclusive' | 'exclusive'): [QuadNode, QuadNode][] {
  if (definition === 'inclusive') {
    return [
      ['quadrilateral', 'trapezoid'],
      ['trapezoid', 'parallelogram'],
      ['parallelogram', 'rhombus'],
      ['parallelogram', 'rectangle'],
      ['rhombus', 'square'],
      ['rectangle', 'square'],
    ];
  }
  return [
    ['quadrilateral', 'trapezoid'],
    ['quadrilateral', 'parallelogram'],
    ['parallelogram', 'rhombus'],
    ['parallelogram', 'rectangle'],
    ['rhombus', 'square'],
    ['rectangle', 'square'],
  ];
}

export function hierarchyShapeBox(): Box {
  return { x: 20, y: 120, width: 400, height: 460 };
}

export function overlayHeader(): Point {
  return { x: PANEL.x + 16, y: PANEL.y + 30 };
}

// ── overlay 기본 대상 ────────────────────────────────────────

/** venn에서 카드 한 장이 실제로 놓인 자리(카드 칸 또는 칸 안 슬롯). */
export function vennCardFrame(state: VennState, cardId: string): CardFrame | null {
  const index = deckIds(state.deck).indexOf(cardId);
  if (index < 0) return null;
  const cell = state.placements[cardId];
  if (cell === null || cell === undefined) {
    return { box: vennTrayBox(index) };
  }
  const [rowName, colName] = cell.split('|');
  const row = state.settings.rows.indexOf(rowName as never);
  const col = state.settings.cols.indexOf(colName as never);
  if (row < 0 || col < 0) return null;
  const box = vennCellBox(row, col);
  const inCell = deckIds(state.deck).filter((id) => state.placements[id] === cell);
  const position = Math.max(0, inCell.indexOf(cardId));
  const slotWidth = box.width / 4;
  const slotHeight = box.height / 3;
  return {
    box: {
      x: box.x + (position % 4) * slotWidth,
      y: box.y + Math.floor(position / 4) * slotHeight,
      width: slotWidth,
      height: slotHeight,
    },
  };
}
