/** E13 `length` 모드의 단위 목록. 길이는 Rational 문자열(cm)이다. */
import { Rational } from '../../core/math';

export interface UnitDef {
  readonly id: string;
  readonly cm: string;
  /** 조각 색(채움). 색만으로 구분하지 않도록 이름 글과 함께 쓴다. */
  readonly fill: string;
  readonly stroke: string;
}

export const UNITS: readonly UnitDef[] = [
  { id: 'hand-span-a', cm: '15', fill: '#ffd9b3', stroke: '#b55a00' },
  { id: 'hand-span-b', cm: '12', fill: '#f9c7d6', stroke: '#a3265a' },
  { id: 'clip-3cm', cm: '3', fill: '#cfe0ff', stroke: '#2f6fde' },
  { id: 'cm-block', cm: '1', fill: '#d4f0d0', stroke: '#2a7a2a' },
  { id: 'eraser-5cm', cm: '5', fill: '#e6d9f7', stroke: '#6b3fb0' },
];

export function unitOf(id: string): UnitDef | undefined {
  return UNITS.find((unit) => unit.id === id);
}

/** 단위 길이(cm). 모르는 단위면 null. */
export function unitLength(id: string): Rational | null {
  const unit = unitOf(id);
  return unit === undefined ? null : Rational.parse(unit.cm);
}
