/**
 * E13 `map-route`(가상 동네 지도에서 길 구간을 이어 경로 만들기)의 설정·상태·Action 타입.
 * 구간 길이(m)와 경로 합은 정수다. 경로 합계는 Observation에만 있고 화면 글에는 쓰지 않는다.
 */

export interface RouteConfig {
  mode?: 'map-route';
  /** 지도 이름. 기본 `sample-town-01`. */
  map?: string;
  /** `"<a>-<b>"` → 구간 길이(정수 m). 두 노드는 지도에 있어야 한다. */
  segmentsM?: Readonly<Record<string, number>>;
  /** 있으면 경로가 거기서 시작한다. */
  from?: string;
  /** 있으면 reachedTo는 끝 노드가 이것인지로 정한다. */
  to?: string;
  /** 기본 1000. */
  targetM?: number;
}

export interface RouteSegment {
  /** 설정에 적힌 그대로의 키(`school-library`). */
  readonly key: string;
  readonly a: string;
  readonly b: string;
  readonly m: number;
}

export interface RouteState {
  readonly mode: 'map-route';
  /** null이 아니면 설정 오류. 화면은 오류 문구만 보인다. */
  readonly error: string | null;
  readonly map: string;
  readonly segments: readonly RouteSegment[];
  readonly from: string | null;
  readonly to: string | null;
  readonly targetM: number;
  /** 지나온 노드 순서(출발 노드 포함). 아직 출발하지 않았으면 빈 배열. */
  readonly path: readonly string[];
  /** 경로에 붙은 구간 키(차례대로). */
  readonly used: readonly string[];
  readonly moves: number;
}

export type RouteAction =
  | { readonly type: 'start'; readonly node: string }
  | { readonly type: 'add-segment'; readonly key: string }
  | { readonly type: 'undo' }
  | { readonly type: 'reset' };

export const ROUTE_CANVAS_SELECTOR = 'svg[data-testid="route-canvas"]';
