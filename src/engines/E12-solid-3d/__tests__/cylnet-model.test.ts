import { describe, expect, it } from 'vitest';
import { Rational } from '../../../core/math';
import {
  circumference,
  halves,
  measureNet,
  parsePi,
  seamOf,
  tenths,
  widthFits,
} from '../cylnet/model';

const R = (text: string) => Rational.parse(text);

describe('E12 cylinder-net 원주', () => {
  it('2 × π × r를 Rational로 센다', () => {
    expect(circumference(R('2'), R('3.14')).toDecimalString()).toBe('12.56');
    expect(circumference(R('0.5'), R('3')).toDecimalString()).toBe('3');
    expect(circumference(R('5'), R('3.1')).toDecimalString()).toBe('31');
    expect(circumference(R('1'), R('3.14')).toDecimalString()).toBe('6.28');
  });

  it('원주율 문자열은 3.14·3.1·3만 읽고 그 밖은 3.14로 돌린다', () => {
    expect(parsePi('3.1').toDecimalString()).toBe('3.1');
    expect(parsePi('3').toDecimalString()).toBe('3');
    expect(parsePi('3.15').toDecimalString()).toBe('3.14');
    expect(parsePi('abc').toDecimalString()).toBe('3.14');
  });

  it('상태 정수 단위를 Rational로 바꾼다', () => {
    expect(tenths(126).toDecimalString()).toBe('12.6');
    expect(tenths(40).toDecimalString()).toBe('4');
    expect(halves(5).toDecimalString()).toBe('2.5');
    expect(halves(4).toDecimalString()).toBe('2');
  });
});

describe('E12 cylinder-net 가로 맞음', () => {
  const circ = circumference(R('2'), R('3.14'));
  it('원주 12.56에서 0.1 이내(12.46~12.66)는 맞는다', () => {
    expect(widthFits(R('12.46'), circ)).toBe(true);
    expect(widthFits(R('12.66'), circ)).toBe(true);
    expect(widthFits(R('12.56'), circ)).toBe(true);
  });
  it('12.45와 12.67은 맞지 않는다', () => {
    expect(widthFits(R('12.45'), circ)).toBe(false);
    expect(widthFits(R('12.67'), circ)).toBe(false);
  });
  it('0.1 단위 상태에서는 12.5와 12.6이 맞고 12.4와 12.7은 아니다', () => {
    expect(widthFits(tenths(125), circ)).toBe(true);
    expect(widthFits(tenths(126), circ)).toBe(true);
    expect(widthFits(tenths(124), circ)).toBe(false);
    expect(widthFits(tenths(127), circ)).toBe(false);
  });
});

describe('E12 cylinder-net seam·전개도 맞음', () => {
  const circ = circumference(R('2'), R('3.14'));
  it('seam은 가로만 보고 정한다', () => {
    expect(seamOf(R('12.6'), circ)).toBe('closed');
    expect(seamOf(R('4'), circ)).toBe('gap');
    expect(seamOf(R('20'), circ)).toBe('overlap');
    expect(seamOf(R('12.45'), circ)).toBe('gap');
    expect(seamOf(R('12.67'), circ)).toBe('overlap');
  });

  const target = { radius: R('2'), height: R('5'), pi: R('3.14') };
  it('반지름·세로·가로가 모두 맞아야 valid다', () => {
    const ok = measureNet({ width: R('12.6'), radius: R('2'), height: R('5') }, target);
    expect(ok).toMatchObject({ widthFits: true, radiusMatches: true, heightMatches: true });
    expect(ok.valid).toBe(true);
    expect(ok.seam).toBe('closed');
  });
  it('반지름이 다르면 valid가 아니다(가로는 그 반지름의 원주로 잰다)', () => {
    const bad = measureNet({ width: R('12.6'), radius: R('2.5'), height: R('5') }, target);
    expect(bad.radiusMatches).toBe(false);
    expect(bad.widthFits).toBe(false);
    expect(bad.valid).toBe(false);
    const fitsOwn = measureNet({ width: R('15.7'), radius: R('2.5'), height: R('5') }, target);
    expect(fitsOwn.widthFits).toBe(true);
    expect(fitsOwn.seam).toBe('closed');
    expect(fitsOwn.valid).toBe(false);
  });
  it('세로가 다르면 valid가 아니다', () => {
    const bad = measureNet({ width: R('12.6'), radius: R('2'), height: R('4.5') }, target);
    expect(bad.heightMatches).toBe(false);
    expect(bad.valid).toBe(false);
  });
});
