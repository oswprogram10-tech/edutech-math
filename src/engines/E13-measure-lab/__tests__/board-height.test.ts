import { describe, expect, it } from 'vitest';
import { TANK, boardHeight as compareHeight } from '../compare/geometry';
import { boardHeight as estimateHeight, RULER } from '../estimate/layout';
import { BAND_H, boardHeight as lengthHeight, geoOf } from '../length/layout';
import { boardHeight as trainHeight, geoOf as trainGeoOf } from '../train/layout';

const MAX = 600;

describe('E13 모드별 논리 높이 (T223)', () => {
  it('estimate: 자 아래 끝 + 여백이고 설정과 무관하다', () => {
    expect(estimateHeight()).toBe(RULER.top + RULER.height + 30);
    expect(estimateHeight()).toBe(384);
  });

  describe('length', () => {
    const base = { objectCm: '12', demo: null, mergeRule: false, buildRuler: false };

    it('띠만 있으면 띠 아래 끝 + 여백(202)이지만 너무 납작하지 않게 바닥 390', () => {
      expect(geoOf(base).bandBottom + 30).toBe(202);
      expect(lengthHeight(base)).toBe(390);
    });

    it('자 만들기가 있으면 눈금 칸 아래 끝 + 여백(바닥 390 이상)', () => {
      const withRuler = { ...base, buildRuler: true };
      expect(geoOf(withRuler).slotBottom + 30).toBe(322);
      expect(lengthHeight(withRuler)).toBe(390);
    });

    it('뼘 시연은 위쪽 자리를 더한다', () => {
      const demo = { objectName: 'desk', objectCm: '60' };
      expect(lengthHeight({ ...base, objectCm: '60', demo })).toBe(390);
      expect(lengthHeight({ ...base, objectCm: '60', demo, buildRuler: true })).toBe(492);
    });

    it('합체 규칙은 1m 줄자 오버레이 자리(위쪽 120px)를 포함한다', () => {
      const merge = { ...base, mergeRule: true };
      expect(geoOf(merge).objectTop).toBeGreaterThanOrEqual(120);
      expect(lengthHeight(merge)).toBe(390);
      expect(lengthHeight({ ...merge, buildRuler: true })).toBe(402);
    });

    it('틈·겹침 오버레이(띠 위 26px ~ 띠 아래 BAND_H+52)가 판 안에 들어온다', () => {
      for (const state of [base, { ...base, mergeRule: true }]) {
        const geo = geoOf(state);
        expect(geo.bandTop - 26 + BAND_H + 52).toBeLessThanOrEqual(lengthHeight(state));
      }
    });

    it('600을 넘지 않는다', () => {
      const demo = { objectName: 'desk', objectCm: '60' };
      expect(
        lengthHeight({ ...base, demo, mergeRule: true, buildRuler: true }),
      ).toBeLessThanOrEqual(MAX);
    });
  });

  describe('unit-train', () => {
    it('큰 칸(기본 1m 70cm + 2m 50cm)은 블록 한 줄 자리까지 478', () => {
      const state = { m: 3, rods: 12, blocks: 0 };
      expect(trainHeight(state)).toBe(478);
      // 블록을 풀어도(한 줄 안) 높이가 늘지 않는다.
      expect(trainHeight({ m: 3, rods: 11, blocks: 10 })).toBe(478);
    });

    it('위쪽 100px(1m 줄자 오버레이 자리)과 뺄 길이 표가 판 안에 있다', () => {
      expect(trainHeight({ m: 1, rods: 0, blocks: 0 })).toBeGreaterThan(190);
    });

    it('작은 칸(1m 칸이 10개를 넘으면)은 칸이 작아져 더 낮다', () => {
      const state = { m: 12, rods: 0, blocks: 0 };
      expect(trainGeoOf(state).big).toBe(false);
      expect(trainHeight(state)).toBe(384);
    });

    it('블록이 아주 많으면 600에서 멈춘다', () => {
      expect(trainHeight({ m: 0, rods: 0, blocks: 990 })).toBe(MAX);
    });
  });

  describe('compare-direct', () => {
    it('길이·넓이는 끌어 놓을 수 있는 범위가 모두 들어가 600이다', () => {
      expect(compareHeight({ attribute: 'length', pour: false })).toBe(600);
      expect(compareHeight({ attribute: 'area', pour: false })).toBe(600);
    });

    it('들이는 수조 아래 끝(붓기가 있으면 이름표까지) + 여백이고 수조 오버레이 자리를 포함한다', () => {
      expect(compareHeight({ attribute: 'capacity', pour: false })).toBe(570);
      expect(compareHeight({ attribute: 'capacity', pour: true })).toBe(598);
      expect(compareHeight({ attribute: 'capacity', pour: false })).toBeGreaterThanOrEqual(
        TANK.bottom,
      );
    });
  });
});
