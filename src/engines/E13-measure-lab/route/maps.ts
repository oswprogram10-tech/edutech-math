/**
 * E13 `map-route`의 가상 동네 지도. 노드 좌표는 판(논리 1000 너비) 위 고정 좌표이고, 길은 설정의
 * `segmentsM`에 있는 구간만 그린다. 길 모양은 곧은 선이라 길이(m)와 그려진 길이는 비례하지 않는다.
 */

export interface MapNode {
  readonly x: number;
  readonly y: number;
  /** 이름 글이 원 위쪽에 오는가(기본은 아래쪽). 위쪽 가장자리 노드가 다른 길 글과 겹치지 않게 한다. */
  readonly nameAbove?: boolean;
}

export interface MapDef {
  readonly nodes: Readonly<Record<string, MapNode>>;
}

export const DEFAULT_MAP = 'sample-town-01';

export const MAPS: Readonly<Record<string, MapDef>> = {
  'sample-town-01': {
    nodes: {
      school: { x: 150, y: 150 },
      library: { x: 470, y: 78, nameAbove: true },
      park: { x: 800, y: 160 },
      market: { x: 250, y: 300 },
      station: { x: 540, y: 310 },
      post: { x: 850, y: 300 },
    },
  },
};

/** 노드 원 반지름(논리 px). */
export const NODE_R = 34;
