/**
 * E12 `shapes-sort` 규칙(순수 함수): 굴림·쌓기·만져 보기 단서·그림자.
 *
 * 물리 엔진을 쓰지 않는다. 결과는 모양과 방향만으로 정해진 규칙이다.
 * 색과 크기는 판정에 쓰지 않는 방해 속성이다(MC-SHAPE-BY-COLOR-SIZE).
 */

export type ShapeKind = 'box' | 'cylinder' | 'sphere';
export type ShapePose = 'flat' | 'standing' | 'lying' | 'any';
export type ShapeColor = 'red' | 'blue' | 'yellow' | 'green';
export type ShapeSize = 'small' | 'large';
export type RampOutcome = 'roll' | 'stay';
export type ShapeClue = 'flat' | 'pointy' | 'round';
export type ShadowView = 'top' | 'side';
export type ShadowForm = 'square' | 'circle';

export interface ShapeItem {
  readonly id: string;
  readonly kind: ShapeKind;
  readonly color: ShapeColor;
  readonly size: ShapeSize;
}

/** 쌓기 계산에 쓰는 모양과 방향 한 쌍. */
export interface ShapePart {
  readonly kind: ShapeKind;
  readonly pose: ShapePose;
}

export const SHAPE_KINDS: readonly ShapeKind[] = ['box', 'cylinder', 'sphere'];
export const SHAPE_COLORS: readonly ShapeColor[] = ['red', 'blue', 'yellow', 'green'];
export const SHAPE_SIZES: readonly ShapeSize[] = ['large', 'small'];

export const SHAPES_MIN_TOWER = 1;
export const SHAPES_MAX_TOWER = 5;
export const SHAPES_DEFAULT_TOWER = 4;
export const SHAPES_MAX_RECORDS = 20;

export function isShapeKind(value: unknown): value is ShapeKind {
  return value === 'box' || value === 'cylinder' || value === 'sphere';
}

export function isShapeColor(value: unknown): value is ShapeColor {
  return value === 'red' || value === 'blue' || value === 'yellow' || value === 'green';
}

export function isShapeSize(value: unknown): value is ShapeSize {
  return value === 'small' || value === 'large';
}

/** 그 모양에 허용된 놓는 방향. 첫 번째가 기본 방향이다. */
export function allowedPoses(kind: ShapeKind): readonly ShapePose[] {
  if (kind === 'box') return ['flat'];
  if (kind === 'cylinder') return ['standing', 'lying'];
  return ['any'];
}

export function defaultPose(kind: ShapeKind): ShapePose {
  return allowedPoses(kind)[0] ?? 'any';
}

export function isAllowedPose(kind: ShapeKind, pose: unknown): pose is ShapePose {
  return (allowedPoses(kind) as readonly unknown[]).includes(pose);
}

/** 종류만 주었을 때 차례로 정하는 색·크기(빨강 큰 것부터). */
export function defaultLook(index: number): Pick<ShapeItem, 'color' | 'size'> {
  return {
    color: SHAPE_COLORS[index % SHAPE_COLORS.length] ?? 'red',
    size: SHAPE_SIZES[index % SHAPE_SIZES.length] ?? 'large',
  };
}

/** 경사로 결과: 공과 눕힌 둥근기둥은 구르고, 나머지는 그 자리에 머문다. */
export function rampResult(kind: ShapeKind, pose: ShapePose): RampOutcome {
  if (kind === 'sphere') return 'roll';
  if (kind === 'cylinder' && pose === 'lying') return 'roll';
  return 'stay';
}

/** 위가 평평한 받침인가(바닥은 호출하는 쪽이 따로 처리한다). */
export function hasFlatTop(part: ShapePart): boolean {
  return part.kind === 'box' || (part.kind === 'cylinder' && part.pose === 'standing');
}

/** 아래가 평평한 물건인가. 공만 아니다. */
export function hasFlatBottom(part: ShapePart): boolean {
  return part.kind !== 'sphere';
}

/**
 * `item`을 `below` 위에 올리면 머무는가. `below`가 null이면 바닥이다.
 * 공은 바닥에만 머문다. 공이나 눕힌 둥근기둥 위에는 아무것도 머물지 않는다.
 */
export function canStackOn(below: ShapePart | null, item: ShapePart): boolean {
  if (below === null) return true;
  if (!hasFlatBottom(item)) return false;
  return hasFlatTop(below);
}

/** 만져 보기 단서 목록(드러나는 순서). */
export function cluesOf(kind: ShapeKind): readonly ShapeClue[] {
  if (kind === 'box') return ['flat', 'pointy'];
  if (kind === 'cylinder') return ['flat', 'round'];
  return ['round'];
}

/** 그림자 모양. 위에서: 상자 사각형·둥근기둥 원·공 원, 옆에서: 상자 사각형·둥근기둥 사각형·공 원. */
export function shadowOf(kind: ShapeKind, view: ShadowView): ShadowForm {
  if (kind === 'sphere') return 'circle';
  if (kind === 'box') return 'square';
  return view === 'top' ? 'circle' : 'square';
}
