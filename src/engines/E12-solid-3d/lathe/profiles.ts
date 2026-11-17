/**
 * E12 `lathe` 모드 도형·붙이는 변·결과 입체·단면 모양(순수 함수, 이름과 정수만 다룬다).
 *
 * 판정은 이름으로 한다. 길이(칸)는 정수이고, 그림에 쓰는 실수 좌표는 `render.ts`에만 둔다.
 */

export type LatheProfile = 'rectangle' | 'right-triangle' | 'semicircle';
export type LatheEdge =
  'long' | 'short' | 'leg-vertical' | 'leg-horizontal' | 'hypotenuse' | 'diameter';
export type LatheSolid = 'cylinder' | 'cone' | 'sphere' | 'double-cone';
export type LathePlane = 'perpendicular' | 'through-axis';
export type SectionShape = 'circle' | 'rectangle' | 'isosceles-triangle' | 'rhombus' | 'point';

export const LATHE_PROFILES: readonly LatheProfile[] = [
  'rectangle',
  'right-triangle',
  'semicircle',
];
export const LATHE_PLANES: readonly LathePlane[] = ['perpendicular', 'through-axis'];

/** 도형마다 붙일 수 있는 변(고정 순서). */
export const PROFILE_EDGES: Readonly<Record<LatheProfile, readonly LatheEdge[]>> = {
  rectangle: ['long', 'short'],
  'right-triangle': ['leg-vertical', 'leg-horizontal', 'hypotenuse'],
  semicircle: ['diameter'],
};

/** 도형의 크기(칸, 정수). 직사각형 가로×세로, 직각삼각형 밑변×높이, 반원은 반지름 `w`. */
export const PROFILE_SIZE: Readonly<
  Record<LatheProfile, { readonly w: number; readonly h: number }>
> = {
  rectangle: { w: 2, h: 4 },
  'right-triangle': { w: 2, h: 4 },
  semicircle: { w: 2, h: 4 },
};

/** 수평 레이저 높이 단계 0~10. */
export const LASER_MAX_STEP = 10;

/** 회전 각도 단위(도)와 한 바퀴. */
export const ANGLE_STEP = 30;
export const FULL_TURN = 360;

export function isLatheProfile(value: unknown): value is LatheProfile {
  return value === 'rectangle' || value === 'right-triangle' || value === 'semicircle';
}

export function isLatheEdge(value: unknown): value is LatheEdge {
  return (
    value === 'long' ||
    value === 'short' ||
    value === 'leg-vertical' ||
    value === 'leg-horizontal' ||
    value === 'hypotenuse' ||
    value === 'diameter'
  );
}

export function isLathePlane(value: unknown): value is LathePlane {
  return value === 'perpendicular' || value === 'through-axis';
}

export function isLatheSolid(value: unknown): value is LatheSolid {
  return value === 'cylinder' || value === 'cone' || value === 'sphere' || value === 'double-cone';
}

export function edgesOf(profile: LatheProfile): readonly LatheEdge[] {
  return PROFILE_EDGES[profile];
}

export function isEdgeOf(profile: LatheProfile, edge: unknown): edge is LatheEdge {
  return isLatheEdge(edge) && PROFILE_EDGES[profile].includes(edge);
}

/** 도형을 그 변에 붙여 돌린 결과 입체. 이 도형에 없는 변이면 null. */
export function solidOf(profile: LatheProfile, edge: LatheEdge): LatheSolid | null {
  if (!isEdgeOf(profile, edge)) return null;
  if (profile === 'rectangle') return 'cylinder';
  if (profile === 'semicircle') return 'sphere';
  return edge === 'hypotenuse' ? 'double-cone' : 'cone';
}

/**
 * 입체를 레이저로 자른 단면 모양. `t`는 수평 레이저 높이 단계(0~10 정수, 아래가 0).
 * 원뿔은 꼭짓점이 위쪽(t=10), 구·팽이 모양은 양 끝(t=0·10)에서 점이 된다.
 * 정수가 아니거나 범위 밖의 t는 null.
 */
export function sectionOf(solid: LatheSolid, plane: LathePlane, t: number): SectionShape | null {
  if (plane === 'through-axis') {
    switch (solid) {
      case 'cylinder':
        return 'rectangle';
      case 'cone':
        return 'isosceles-triangle';
      case 'sphere':
        return 'circle';
      case 'double-cone':
        return 'rhombus';
    }
  }
  if (!Number.isInteger(t) || t < 0 || t > LASER_MAX_STEP) return null;
  switch (solid) {
    case 'cylinder':
      return 'circle';
    case 'cone':
      return t === LASER_MAX_STEP ? 'point' : 'circle';
    case 'sphere':
    case 'double-cone':
      return t === 0 || t === LASER_MAX_STEP ? 'point' : 'circle';
  }
}

/** 각도를 0~360의 30 단위로 맞춘다. 유한한 수가 아니면 null. */
export function snapAngle(angle: unknown): number | null {
  if (typeof angle !== 'number' || !Number.isFinite(angle)) return null;
  const clamped = Math.min(FULL_TURN, Math.max(0, angle));
  return Math.round(clamped / ANGLE_STEP) * ANGLE_STEP;
}
