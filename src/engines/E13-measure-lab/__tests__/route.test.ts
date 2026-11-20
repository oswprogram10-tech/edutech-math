/** E13 map-route 순수 로직 테스트: 설정, 경로 만들기, 합계·diff·bestDiff, predicates, JSON 왕복. */
import { describe, expect, it } from 'vitest';
import { assertSerializable } from '../../../core/engine-sdk';
import { routePredicates } from '../route/events';
import { observeRoute } from '../route/observe';
import { createRouteState, reduceRoute } from '../route/reduce';
import { bestDiffOf } from '../route/settings';
import type { RouteAction, RouteConfig, RouteState } from '../route/types';
import { boardHeight, fillWidth, targetX } from '../route/layout';
import definition from '../index';

const sample: RouteConfig = {
  mode: 'map-route',
  map: 'sample-town-01',
  segmentsM: { 'school-library': 450, 'library-park': 620, 'school-park': 980 },
  targetM: 1000,
  from: 'school',
};

function make(config: RouteConfig = sample): RouteState {
  return createRouteState(config);
}
function play(state: RouteState, ...actions: RouteAction[]): RouteState {
  return actions.reduce(reduceRoute, state);
}
const seg = (key: string): RouteAction => ({ type: 'add-segment', key });
const obs = (state: RouteState) => observeRoute(state);

describe('설정', () => {
  it('설정이 mode뿐이면 샌드박스 기본(명세 예시의 세 구간)을 쓴다', () => {
    const state = make({ mode: 'map-route' });
    expect(state.error).toBeNull();
    expect(state.segments.map((s) => s.key)).toEqual([
      'school-library',
      'library-park',
      'school-park',
    ]);
    expect(state.targetM).toBe(1000);
    expect(state.path).toEqual([]);
  });

  it('from이 있으면 경로가 거기서 시작하고, 없으면 비어 있다', () => {
    expect(make().path).toEqual(['school']);
    expect(make({ ...sample, from: undefined }).path).toEqual([]);
  });

  it('targetM 기본은 1000이다', () => {
    expect(make({ ...sample, targetM: undefined }).targetM).toBe(1000);
  });

  it.each([
    ['지도에 없는 노드', { segmentsM: { 'school-zoo': 100 } }],
    ['모르는 지도', { map: 'other-town' }],
    ['키 형식이 틀림', { segmentsM: { school: 100 } }],
    ['같은 노드를 잇는 구간', { segmentsM: { 'school-school': 100 } }],
    ['길이 0', { segmentsM: { 'school-library': 0 } }],
    ['길이가 소수', { segmentsM: { 'school-library': 450.5 } }],
    ['길이가 음수', { segmentsM: { 'school-library': -5 } }],
    ['길이가 글', { segmentsM: { 'school-library': '450' as unknown as number } }],
    ['같은 구간을 두 방향으로 적음', { segmentsM: { 'school-library': 1, 'library-school': 2 } }],
    ['구간이 하나도 없음', { segmentsM: {} }],
    ['구간 목록이 없음', { segmentsM: undefined }],
    ['from이 지도에 없음', { from: 'zoo' }],
    ['from이 구간에 닿지 않음', { from: 'market' }],
    ['to가 구간에 닿지 않음', { to: 'post' }],
    ['from과 to가 같음', { from: 'school', to: 'school' }],
    ['targetM이 0', { targetM: 0 }],
    ['targetM이 소수', { targetM: 10.5 }],
  ] as const)('잘못된 설정(%s)은 오류 상태이고 조작은 거절된다', (_name, partial) => {
    const state = make({ ...sample, ...partial } as RouteConfig);
    expect(state.error).not.toBeNull();
    expect(play(state, { type: 'start', node: 'school' }, seg('school-library'))).toBe(state);
    expect(obs(state)).toMatchObject({ error: true, misconceptions: [] });
  });

  it('경계: 길이 1과 9999, targetM 1과 99999는 허용', () => {
    expect(make({ ...sample, segmentsM: { 'school-library': 1 } }).error).toBeNull();
    expect(make({ ...sample, segmentsM: { 'school-library': 9999 } }).error).toBeNull();
    expect(make({ ...sample, targetM: 1 }).error).toBeNull();
    expect(make({ ...sample, targetM: 99999 }).error).toBeNull();
  });
});

describe('경로 만들기', () => {
  it('학교→도서관→공원은 합 1070, 목표와의 차 70', () => {
    const state = play(make(), seg('school-library'), seg('library-park'));
    expect(state.path).toEqual(['school', 'library', 'park']);
    expect(obs(state)).toMatchObject({ totalM: 1070, diffFromTarget: 70, path: state.path });
  });

  it('학교→공원은 합 980, 차 20, bestDiff 20이고 closestToTarget', () => {
    const state = play(make(), seg('school-park'));
    expect(obs(state)).toMatchObject({
      totalM: 980,
      diffFromTarget: 20,
      bestDiff: 20,
      reachedTo: true,
    });
    expect(routePredicates['closestToTarget']?.(obs(state), undefined)).toBe(true);
    const longer = play(make(), seg('school-library'), seg('library-park'));
    expect(routePredicates['closestToTarget']?.(obs(longer), undefined)).toBe(false);
  });

  it('구간 키는 순서가 거꾸로여도(도서관에서 학교 쪽으로) 이어진다', () => {
    const state = play(make({ ...sample, from: 'library' }), seg('school-library'));
    expect(state.path).toEqual(['library', 'school']);
  });

  it('끝에 닿지 않은 구간은 거절한다', () => {
    const state = make();
    expect(play(state, seg('library-park'))).toBe(state);
    const next = play(state, seg('school-library'));
    // 도서관에 있으니 학교-공원 구간은 닿지 않는다.
    expect(play(next, seg('school-park'))).toBe(next);
  });

  it('같은 구간을 두 번 쓰면 거절한다', () => {
    const state = play(make(), seg('school-library'));
    expect(play(state, seg('school-library'))).toBe(state);
  });

  it('없는 구간 키는 거절한다', () => {
    const state = make();
    expect(play(state, seg('school-zoo'))).toBe(state);
  });

  it('출발 전(from 없음)에는 구간을 거절하고, start로 출발한다', () => {
    const state = make({ ...sample, from: undefined });
    expect(play(state, seg('school-library'))).toBe(state);
    const started = play(state, { type: 'start', node: 'park' });
    expect(started.path).toEqual(['park']);
    expect(play(started, seg('school-park')).path).toEqual(['park', 'school']);
  });

  it('start는 from이 있거나 이미 출발했거나 구간에 닿지 않은 노드면 거절한다', () => {
    const fixed = make();
    expect(play(fixed, { type: 'start', node: 'library' })).toBe(fixed);
    const free = make({ ...sample, from: undefined });
    expect(play(free, { type: 'start', node: 'market' })).toBe(free);
    expect(play(free, { type: 'start', node: 'zoo' })).toBe(free);
    const started = play(free, { type: 'start', node: 'school' });
    expect(play(started, { type: 'start', node: 'park' })).toBe(started);
  });

  it('undo는 마지막 구간을 지우고, 지울 구간이 없으면 거절한다', () => {
    const state = make();
    expect(play(state, { type: 'undo' })).toBe(state);
    const two = play(state, seg('school-library'), seg('library-park'));
    const one = play(two, { type: 'undo' });
    expect(one.path).toEqual(['school', 'library']);
    expect(one.used).toEqual(['school-library']);
    // 지운 구간은 다시 쓸 수 있다.
    expect(play(one, seg('library-park')).path).toEqual(['school', 'library', 'park']);
  });

  it('reset은 처음(from이 있으면 거기서 시작, 없으면 빈 경로)으로 되돌리고, 이미 처음이면 거절한다', () => {
    const fixed = make();
    expect(play(fixed, { type: 'reset' })).toBe(fixed);
    const done = play(fixed, seg('school-park'), { type: 'reset' });
    expect(done.path).toEqual(['school']);
    expect(done.used).toEqual([]);
    const free = make({ ...sample, from: undefined });
    const started = play(free, { type: 'start', node: 'school' });
    expect(play(started, { type: 'reset' }).path).toEqual([]);
  });

  it('모든 구간을 한 바퀴 돌아 같은 노드를 다시 지나도 구간이 다르면 이어진다', () => {
    const state = play(make(), seg('school-library'), seg('library-park'), seg('school-park'));
    expect(state.path).toEqual(['school', 'library', 'park', 'school']);
    expect(obs(state)['totalM']).toBe(2050);
  });
});

describe('reachedTo·bestDiff', () => {
  const big: RouteConfig = {
    mode: 'map-route',
    segmentsM: {
      'school-library': 450,
      'library-park': 620,
      'school-park': 980,
      'school-market': 300,
      'market-station': 500,
      'station-park': 250,
    },
    from: 'school',
    to: 'park',
    targetM: 1000,
  };

  it('to가 있으면 끝 노드가 to일 때만 reachedTo다', () => {
    const state = make(big);
    const mid = play(state, seg('school-library'));
    expect(obs(mid)['reachedTo']).toBe(false);
    expect(routePredicates['reachedTo']?.(obs(mid), undefined)).toBe(false);
    const at = play(mid, seg('library-park'));
    expect(obs(at)['reachedTo']).toBe(true);
  });

  it('bestDiff는 from에서 to까지 단순 경로의 diff 최솟값이다', () => {
    // 학교→공원 경로: 980(20), 450+620=1070(70), 300+500+250=1050(50), 학교-도서관-공원 외 …
    expect(bestDiffOf(make(big))).toBe(20);
    expect(obs(make(big))['bestDiff']).toBe(20);
  });

  it('목표 근처 경로가 따로 있으면 bestDiff가 더 작아진다', () => {
    const near = make({ ...big, segmentsM: { ...big.segmentsM, 'station-park': 200 } });
    // 300+500+200 = 1000 → diff 0
    expect(bestDiffOf(near)).toBe(0);
    const best = play(near, seg('school-market'), seg('market-station'), seg('station-park'));
    expect(routePredicates['closestToTarget']?.(obs(best), undefined)).toBe(true);
    const other = play(near, seg('school-park'));
    expect(routePredicates['closestToTarget']?.(obs(other), undefined)).toBe(false);
  });

  it('to가 없으면 모든 단순 경로(어느 노드에서 시작해도)를 센다', () => {
    const free = make({ ...sample, from: undefined, to: undefined });
    expect(bestDiffOf(free)).toBe(20);
    expect(obs(free)['bestDiff']).toBe(20);
  });

  it('to가 없으면 구간을 하나라도 이으면 reachedTo, 아무 구간도 없으면 아니다', () => {
    const free = make({ ...sample, to: undefined });
    expect(obs(free)['reachedTo']).toBe(false);
    expect(obs(play(free, seg('school-library')))['reachedTo']).toBe(true);
  });

  it('구간이 없는 처음 상태는 closestToTarget이 아니다', () => {
    expect(routePredicates['closestToTarget']?.(obs(make()), undefined)).toBe(false);
  });
});

describe('predicates·JSON·엔진', () => {
  it('pathIs: 노드 순서가 정확히 같을 때만 참', () => {
    const state = play(make(), seg('school-library'), seg('library-park'));
    const p = routePredicates['pathIs'];
    expect(p?.(obs(state), { nodes: ['school', 'library', 'park'] })).toBe(true);
    expect(p?.(obs(state), { nodes: ['school', 'park'] })).toBe(false);
    expect(p?.(obs(state), { nodes: ['school', 'library'] })).toBe(false);
    expect(p?.(obs(state), {})).toBe(false);
  });

  it('totalIs: 합이 m일 때 참(0은 거절)', () => {
    const state = play(make(), seg('school-library'), seg('library-park'));
    const p = routePredicates['totalIs'];
    expect(p?.(obs(state), { m: 1070 })).toBe(true);
    expect(p?.(obs(state), { m: 1000 })).toBe(false);
    expect(p?.(obs(make()), { m: 0 })).toBe(false);
    expect(p?.(obs(state), {})).toBe(false);
  });

  it('상태와 Observation이 JSON으로 왕복한다', () => {
    const state = play(make(), seg('school-library'));
    assertSerializable(state);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
    assertSerializable(obs(state));
  });

  it('논리 높이는 600 이하이고 목표 막대 좌표가 판 안이다', () => {
    expect(boardHeight()).toBeLessThanOrEqual(600);
    expect(fillWidth(0, 1000)).toBe(0);
    expect(fillWidth(600, 1000)).toBeCloseTo(400, 5);
    // 막대 끝(목표 × 1.2)을 넘으면 막대 끝에서 멈춘다.
    expect(fillWidth(5000, 1000)).toBe(800);
    expect(targetX()).toBeCloseTo(100 + 800 / 1.2, 5);
  });

  it('엔진 정의: 모드·예약된 predicates·emit', () => {
    expect(definition.modes).toContain('map-route');
    expect(definition.predicates).toHaveProperty('closestToTarget');
    const a = definition.createInitialState({ mode: 'map-route', segmentsM: sample.segmentsM });
    expect(a.mode).toBe('map-route');
    const b = definition.reduce(a, { type: 'start', node: 'school' });
    expect(b).not.toBe(a);
    expect(definition.emit?.(a, a, { type: 'reset' })).toEqual([]);
    expect(definition.emit?.(a, b, { type: 'start', node: 'school' })).toEqual([
      { name: 'measure-changed', payload: { moved: true } },
    ]);
    expect(definition.observe(b, { mode: 'map-route' })).toMatchObject({ mode: 'map-route' });
  });
});
