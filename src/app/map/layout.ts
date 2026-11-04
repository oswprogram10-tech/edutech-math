/**
 * 별자리 배치 순수 함수.
 *
 * 하늘을 네 구역(수와 연산 / 변화와 관계 / 도형과 측정 / 자료와 가능성)으로 나누고,
 * 구역 안에서 단원을 (학년, 학기, 순서) 순으로 구역 중심에서 바깥으로 나선 위에 놓는다.
 * 개념 별은 단원 자리 둘레의 작은 원에 둔다.
 *
 * 좌표는 화면 좌표(number)다. 수학 값(Rational)이 아니므로 부동소수를 써도 된다.
 * 같은 입력이면 항상 같은 좌표가 나온다(결정적).
 */
import type { UnitDomain, UnitSummary } from '../content-units';

export type { UnitDomain } from '../content-units';

export const MAP_WIDTH = 1000;
export const MAP_HEIGHT = 1000;

/** 별 그림의 반지름(논리 좌표). 터치 판정은 화면 픽셀 기준으로 따로 한다. */
export const STAR_RADIUS = 9;

/** 개념 별 사이 최소 거리(논리 좌표). 테스트가 이 값을 지킨다. */
export const MIN_STAR_DISTANCE = 16;

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const UNIT_SPIRAL_RADIUS = 188;
const CONCEPT_RING_RADIUS = 18;

const ZONE_ORDER: readonly UnitDomain[] = ['number', 'change', 'geometry', 'data'];

const ZONE_CENTERS: Readonly<Record<UnitDomain, { readonly x: number; readonly y: number }>> = {
  number: { x: MAP_WIDTH * 0.25, y: MAP_HEIGHT * 0.25 },
  change: { x: MAP_WIDTH * 0.75, y: MAP_HEIGHT * 0.25 },
  geometry: { x: MAP_WIDTH * 0.25, y: MAP_HEIGHT * 0.75 },
  data: { x: MAP_WIDTH * 0.75, y: MAP_HEIGHT * 0.75 },
};

export interface LayoutConcept {
  readonly id: string;
  readonly unit: string;
  readonly label: string;
  /** `buildKnowledgeGraph`가 단원 선수를 개념으로 펼친 뒤의 값. */
  readonly prerequisites: readonly string[];
}

export interface StarPoint {
  /** 별자리 안에서 안정적인 순서. DOM에 개념 ID를 쓰지 않고 이 값만 쓴다. */
  readonly index: number;
  readonly conceptId: string;
  readonly unitId: string;
  readonly label: string;
  readonly x: number;
  readonly y: number;
}

export interface UnitPoint {
  readonly unitId: string;
  readonly domain: UnitDomain;
  readonly x: number;
  readonly y: number;
}

/** 선의 끝점은 개념 별 또는 단원 자리다(단원 ID 선수). */
export interface StarLink {
  readonly from: string;
  readonly to: string;
}

export interface MapZone {
  readonly domain: UnitDomain;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly labelX: number;
  readonly labelY: number;
  readonly labelAnchor: 'start' | 'end';
}

export interface StarMapLayout {
  readonly width: number;
  readonly height: number;
  readonly stars: readonly StarPoint[];
  readonly units: readonly UnitPoint[];
  readonly links: readonly StarLink[];
  readonly zones: readonly MapZone[];
}

/**
 * 누른 자리에서 가장 가까운 별 하나를 고른다.
 *
 * 손가락 굵기를 감안해 `radius` 안쪽이면 누른 것으로 본다. 가장 가까운 별이
 * 꺼진 단원의 별이면 `undefined`를 돌려준다. 꺼진 점 옆에 켜진 별이 바짝
 * 붙어 있을 때 꺼진 점을 눌러도 옆 별이 열리지 않게 하기 위해서다.
 */
export function nearestStar(
  stars: readonly StarPoint[],
  enabledUnits: ReadonlySet<string>,
  point: { readonly x: number; readonly y: number },
  radius: number,
): StarPoint | undefined {
  let best: StarPoint | undefined;
  let bestDistance = radius * radius;
  for (const star of stars) {
    const dx = star.x - point.x;
    const dy = star.y - point.y;
    const distance = dx * dx + dy * dy;
    if (distance <= bestDistance) {
      bestDistance = distance;
      best = star;
    }
  }
  return best && enabledUnits.has(best.unitId) ? best : undefined;
}

function compareUnits(a: UnitSummary, b: UnitSummary): number {
  return (
    a.grade - b.grade || a.semester - b.semester || a.order - b.order || a.id.localeCompare(b.id)
  );
}

function zones(): readonly MapZone[] {
  const halfWidth = MAP_WIDTH / 2;
  const halfHeight = MAP_HEIGHT / 2;
  const labelInset = 18;

  return ZONE_ORDER.map((domain) => {
    const center = ZONE_CENTERS[domain];
    const left = center.x < halfWidth;
    const top = center.y < halfHeight;
    const x = left ? 0 : halfWidth;
    const y = top ? 0 : halfHeight;
    return {
      domain,
      x,
      y,
      width: halfWidth,
      height: halfHeight,
      labelX: left ? x + labelInset : x + halfWidth - labelInset,
      labelY: top ? y + labelInset + 10 : y + halfHeight - labelInset,
      labelAnchor: left ? 'start' : 'end',
    } as const;
  });
}

/**
 * 단원·개념 목록을 별자리 좌표로 바꾼다.
 *
 * 개념의 선수가 개념 ID면 그 별로, 단원 ID면 그 단원 자리로 선을 긋는다.
 * 없는 선수는 선을 긋지 않는다(데이터 검사는 check:specs가 맡는다).
 */
export function layoutStars(
  units: readonly UnitSummary[],
  concepts: readonly LayoutConcept[],
): StarMapLayout {
  const unitPositions = new Map<string, UnitPoint>();
  const stars: StarPoint[] = [];
  const starByConcept = new Map<string, StarPoint>();

  ZONE_ORDER.forEach((domain, zoneIndex) => {
    const zoneUnits = units.filter((unit) => unit.domain === domain).sort(compareUnits);
    if (zoneUnits.length === 0) return;

    const center = ZONE_CENTERS[domain];
    const offset = zoneIndex * 0.9;

    zoneUnits.forEach((unit, unitIndex) => {
      const distance = UNIT_SPIRAL_RADIUS * Math.sqrt((unitIndex + 0.5) / zoneUnits.length);
      const angle = unitIndex * GOLDEN_ANGLE + offset;
      const unitX = center.x + distance * Math.cos(angle);
      const unitY = center.y + distance * Math.sin(angle);

      unitPositions.set(unit.id, { unitId: unit.id, domain, x: unitX, y: unitY });

      const unitConcepts = concepts.filter((concept) => concept.unit === unit.id);
      unitConcepts.forEach((concept, conceptIndex) => {
        const conceptAngle =
          (conceptIndex / Math.max(unitConcepts.length, 1)) * Math.PI * 2 + unitIndex * 0.55;
        const star: StarPoint = {
          index: stars.length,
          conceptId: concept.id,
          unitId: unit.id,
          label: concept.label,
          x: unitX + CONCEPT_RING_RADIUS * Math.cos(conceptAngle),
          y: unitY + CONCEPT_RING_RADIUS * Math.sin(conceptAngle),
        };
        stars.push(star);
        starByConcept.set(concept.id, star);
      });
    });
  });

  const links: StarLink[] = [];
  const seen = new Set<string>();
  for (const concept of concepts) {
    if (!starByConcept.has(concept.id)) continue;
    for (const prerequisite of concept.prerequisites) {
      if (!starByConcept.has(prerequisite) && !unitPositions.has(prerequisite)) continue;
      const key = `${concept.id}\u0000${prerequisite}`;
      if (seen.has(key)) continue;
      seen.add(key);
      links.push({ from: concept.id, to: prerequisite });
    }
  }

  return {
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    stars,
    units: [...unitPositions.values()],
    links,
    zones: zones(),
  };
}
