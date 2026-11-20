/**
 * E19 결과 4색(빨강·파랑·노랑·초록). 색만으로 전달하지 않도록 무늬(민·빗금·점·격자)와 이름 글을 함께 쓴다.
 */
import { useId } from 'react';
import { E19_STRINGS as S } from './strings.ko';
import type { Outcome } from './types';

export const OUTCOME_COLOR: Readonly<Record<Outcome, string>> = {
  red: '#d9534f',
  blue: '#4a90e2',
  yellow: '#f2c230',
  green: '#3fae6a',
};
export const OUTCOME_INK = '#1d2330';

export function outcomeName(outcome: Outcome): string {
  return S.outcomes[outcome];
}

export function fillOf(prefix: string, outcome: Outcome): string {
  return `url(#${prefix}-${outcome})`;
}

/** 이 컴포넌트 하나가 쓸 고유 prefix. */
export function usePatternPrefix(label: string): string {
  return `e19-${label}-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
}
