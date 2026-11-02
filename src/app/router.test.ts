import { describe, expect, it } from 'vitest';
import { parseRoute, routeHash, unitIdOfActivity } from './router';

describe('parseRoute', () => {
  it('빈 해시와 /는 시작 화면이다', () => {
    expect(parseRoute('')).toEqual({ kind: 'home' });
    expect(parseRoute('#')).toEqual({ kind: 'home' });
    expect(parseRoute('#/')).toEqual({ kind: 'home' });
  });

  it('지도·활동·교사 화면을 해시로 구분한다', () => {
    expect(parseRoute('#/map')).toEqual({ kind: 'map' });
    expect(parseRoute('#/activity/demo.A1')).toEqual({
      kind: 'activity',
      activityId: 'demo.A1',
    });
    expect(parseRoute('#/activity/g5s1u4.A1')).toEqual({
      kind: 'activity',
      activityId: 'g5s1u4.A1',
    });
    expect(parseRoute('#/teacher')).toEqual({ kind: 'teacher' });
  });

  it('개발·점검용 샌드박스와 실행 화면을 그대로 둔다', () => {
    expect(parseRoute('#/sandbox/E00')).toEqual({ kind: 'sandbox', engineId: 'E00' });
    expect(parseRoute('#/run/demo')).toEqual({ kind: 'run', unitId: 'demo' });
  });

  it('알 수 없는 주소는 시작 화면으로 돌린다', () => {
    expect(parseRoute('#/activity')).toEqual({ kind: 'home' });
    expect(parseRoute('#/activity/..%2Fsecret')).toEqual({ kind: 'home' });
    expect(parseRoute('#/sandbox/E0')).toEqual({ kind: 'home' });
    expect(parseRoute('#/run/demo/extra')).toEqual({ kind: 'home' });
  });
});

describe('unitIdOfActivity', () => {
  it('마지막 점 앞부분을 단원 ID로 쓴다', () => {
    expect(unitIdOfActivity('demo.A1')).toBe('demo');
    expect(unitIdOfActivity('g5s1u4.A1')).toBe('g5s1u4');
    expect(unitIdOfActivity('demo')).toBe('demo');
  });
});

describe('routeHash', () => {
  it('parseRoute와 왕복한다', () => {
    for (const hash of [
      '#/',
      '#/map',
      '#/activity/demo.A1',
      '#/teacher',
      '#/sandbox/E00',
      '#/run/demo',
    ]) {
      expect(routeHash(parseRoute(hash))).toBe(hash);
    }
  });
});
