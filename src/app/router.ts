/**
 * 작은 해시 라우터.
 *
 * GitHub Pages는 `/map` 같은 경로를 새로고침하면 404가 나므로 모든 화면은
 * 해시 주소를 쓴다. 라우터 라이브러리를 쓰지 않고 순수 함수로 파싱한다.
 */
import type { EngineId } from '../core/engine-sdk';

export type Route =
  | { readonly kind: 'home' }
  | { readonly kind: 'map' }
  | { readonly kind: 'activity'; readonly activityId: string }
  | { readonly kind: 'teacher' }
  | { readonly kind: 'demo'; readonly code?: string }
  | { readonly kind: 'sandbox'; readonly engineId: EngineId }
  | { readonly kind: 'run'; readonly unitId: string };

const ACTIVITY_ID_PATTERN = /^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)+$/;
const UNIT_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const ENGINE_ID_PATTERN = /^E\d{2}$/;

export function parseRoute(hash: string): Route {
  const value = hash.startsWith('#') ? hash.slice(1) : hash;

  if (value === '' || value === '/') return { kind: 'home' };

  if (value === '/map') return { kind: 'map' };
  if (value === '/teacher') return { kind: 'teacher' };
  if (value === '/demo') return { kind: 'demo' };

  // 공유 링크(`#s=<code>`)는 시연 모드를 그 코드로 연다.
  if (value.startsWith('s=')) {
    const code = value.slice(2);
    if (code.length > 0) return { kind: 'demo', code };
  }

  const activity = /^\/activity\/([^/]+)$/.exec(value);
  if (activity?.[1] && ACTIVITY_ID_PATTERN.test(activity[1])) {
    return { kind: 'activity', activityId: activity[1] };
  }

  const sandbox = /^\/sandbox\/(E\d{2})$/.exec(value);
  if (sandbox?.[1] && ENGINE_ID_PATTERN.test(sandbox[1])) {
    return { kind: 'sandbox', engineId: sandbox[1] as EngineId };
  }

  const run = /^\/run\/([^/]+)$/.exec(value);
  if (run?.[1] && UNIT_ID_PATTERN.test(run[1])) {
    return { kind: 'run', unitId: run[1] };
  }

  return { kind: 'home' };
}

/** 활동 ID(`demo.A1`)에서 단원 ID(`demo`)를 얻는다. */
export function unitIdOfActivity(activityId: string): string {
  const index = activityId.lastIndexOf('.');
  return index > 0 ? activityId.slice(0, index) : activityId;
}

export function routeHash(route: Route): string {
  switch (route.kind) {
    case 'home':
      return '#/';
    case 'map':
      return '#/map';
    case 'activity':
      return `#/activity/${route.activityId}`;
    case 'teacher':
      return '#/teacher';
    case 'demo':
      return route.code ? `#s=${route.code}` : '#/demo';
    case 'sandbox':
      return `#/sandbox/${route.engineId}`;
    case 'run':
      return `#/run/${route.unitId}`;
  }
}

/** 해시를 바꾼다. 같은 해시면 아무 일도 하지 않는다. */
export function navigate(route: Route): void {
  const next = routeHash(route);
  if (window.location.hash !== next) window.location.hash = next;
}
