import { beforeAll, describe, expect, it } from 'vitest';
import { loadKnowledgeGraph } from '../../../core/knowledge';
import type { KnowledgeGraph } from '../../../core/knowledge';
import { loadUnitSummaries } from '../../content-units';
import type { UnitSummary } from '../../content-units';
import { MAP_HEIGHT, MAP_WIDTH, MIN_STAR_DISTANCE, layoutStars, nearestStar } from '../layout';
import type { LayoutConcept, StarMapLayout } from '../layout';

function layoutConcepts(graph: KnowledgeGraph): LayoutConcept[] {
  const concepts: LayoutConcept[] = [];
  for (const id of graph.conceptOrder) {
    const node = graph.concepts.get(id);
    if (!node) continue;
    concepts.push({
      id: node.id,
      unit: node.unit,
      label: node.label,
      prerequisites: node.prerequisites,
    });
  }
  return concepts;
}

describe('layoutStars', () => {
  let units: readonly UnitSummary[];
  let concepts: LayoutConcept[];
  let layout: StarMapLayout;

  beforeAll(async () => {
    const [loadedUnits, graph] = await Promise.all([loadUnitSummaries(), loadKnowledgeGraph()]);
    units = loadedUnits;
    concepts = layoutConcepts(graph);
    layout = layoutStars(units, concepts);
  });

  it('실데이터의 단원 71개와 개념 279개를 모두 배치한다', () => {
    expect(units).toHaveLength(71);
    expect(concepts).toHaveLength(279);
    expect(layout.stars).toHaveLength(279);
    expect(layout.units).toHaveLength(71);
    expect(new Set(layout.stars.map((star) => star.conceptId)).size).toBe(279);
  });

  it('같은 데이터면 항상 같은 좌표가 나온다', () => {
    const again = layoutStars(units, concepts);
    expect(again.stars).toEqual(layout.stars);
    expect(again.units).toEqual(layout.units);
    expect(again.links).toEqual(layout.links);
    expect(again.zones).toEqual(layout.zones);
  });

  it('모든 별이 자기 영역 구역 안에 있다', () => {
    const domainByUnit = new Map(units.map((unit) => [unit.id, unit.domain]));
    for (const star of layout.stars) {
      const domain = domainByUnit.get(star.unitId);
      expect(domain).toBeDefined();
      expect(Number.isFinite(star.x)).toBe(true);
      expect(Number.isFinite(star.y)).toBe(true);
      expect(star.x).toBeGreaterThanOrEqual(0);
      expect(star.x).toBeLessThanOrEqual(MAP_WIDTH);
      expect(star.y).toBeGreaterThanOrEqual(0);
      expect(star.y).toBeLessThanOrEqual(MAP_HEIGHT);

      const left = star.x < MAP_WIDTH / 2;
      const top = star.y < MAP_HEIGHT / 2;
      expect({ domain, left, top }).toEqual({
        domain,
        left: domain === 'number' || domain === 'geometry',
        top: domain === 'number' || domain === 'change',
      });
    }
  });

  it('개념 별은 서로 최소 거리 이상 떨어진다', () => {
    let minimum = Number.POSITIVE_INFINITY;
    let closest: readonly [string, string] = ['', ''];
    for (let i = 0; i < layout.stars.length; i += 1) {
      const a = layout.stars[i];
      if (!a) continue;
      for (let j = i + 1; j < layout.stars.length; j += 1) {
        const b = layout.stars[j];
        if (!b) continue;
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        if (distance < minimum) {
          minimum = distance;
          closest = [a.conceptId, b.conceptId];
        }
      }
    }
    expect(minimum, `가장 가까운 별: ${closest.join(' / ')}`).toBeGreaterThanOrEqual(
      MIN_STAR_DISTANCE,
    );
  });

  it('선수 관계 선은 개념 별이나 단원 자리로 이어진다', () => {
    const starIds = new Set(layout.stars.map((star) => star.conceptId));
    const unitIds = new Set(layout.units.map((unit) => unit.unitId));
    expect(layout.links.length).toBeGreaterThan(0);
    for (const link of layout.links) {
      expect(starIds.has(link.from)).toBe(true);
      expect(starIds.has(link.to) || unitIds.has(link.to)).toBe(true);
    }
  });

  it('네 구역이 수와 연산·변화와 관계·도형과 측정·자료와 가능성 순서다', () => {
    expect(layout.zones.map((zone) => zone.domain)).toEqual([
      'number',
      'change',
      'geometry',
      'data',
    ]);
  });
});

describe('nearestStar', () => {
  const stars = [
    { index: 0, conceptId: 'on', unitId: 'u1', label: '켜진 별', x: 100, y: 100 },
    { index: 1, conceptId: 'off', unitId: 'u2', label: '꺼진 별', x: 112, y: 100 },
  ];

  it('누른 자리에서 가장 가까운 켜진 별을 고른다', () => {
    const picked = nearestStar(stars, new Set(['u1']), { x: 104, y: 100 }, 24);
    expect(picked?.conceptId).toBe('on');
  });

  it('가장 가까운 별이 꺼진 단원이면 아무것도 고르지 않는다', () => {
    // 꺼진 점을 정확히 눌렀다. 옆의 켜진 별이 반경 안에 있어도 열리면 안 된다.
    expect(nearestStar(stars, new Set(['u1']), { x: 112, y: 100 }, 24)).toBeUndefined();
  });

  it('반경 밖을 누르면 아무것도 고르지 않는다', () => {
    expect(nearestStar(stars, new Set(['u1', 'u2']), { x: 100, y: 130 }, 24)).toBeUndefined();
  });

  it('꺼진 단원도 켜져 있으면 가장 가까운 별을 고른다', () => {
    const picked = nearestStar(stars, new Set(['u1', 'u2']), { x: 112, y: 100 }, 24);
    expect(picked?.conceptId).toBe('off');
  });
});
