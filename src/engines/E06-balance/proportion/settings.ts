/**
 * proportion 설정 정규화. 어긋나면 throw하지 않고 `error`를 켠다(화면이 오류 문구를 보인다).
 * 항은 1~30의 정수만 받는다(0·소수·분수는 설정 오류). equation과 cards를 함께 주면 오류,
 * 둘 다 없으면 샌드박스 기본 `3 : 5 = □ : 20`이다.
 */
import { DEFAULT_SLIDER, MAX_CARDS, MAX_SLIDER, MAX_TERM, MIN_CARDS, MIN_TERM } from './types';
import type { ProportionConfig, ProportionLook, ProportionState } from './types';

export const DEFAULT_EQUATION = '3 : 5 = □ : 20';

function warn(message: string): void {
  if (import.meta.env?.DEV) console.warn(`[E06] ${message}`);
}

/** "3 : 5 = □ : 20" → ['3','5',null,'20']. 네 항이 아니거나 항이 범위 밖이거나 □가 둘 이상이면 null. */
export function parseEquation(text: unknown): (string | null)[] | null {
  if (typeof text !== 'string') return null;
  const halves = text.split('=');
  if (halves.length !== 2) return null;
  const terms: (string | null)[] = [];
  for (const half of halves) {
    const parts = half.split(':');
    if (parts.length !== 2) return null;
    for (const part of parts) {
      const token = part.trim();
      if (token === '□') {
        terms.push(null);
      } else if (/^[1-9]\d?$/.test(token)) {
        const n = Number(token);
        if (n < MIN_TERM || n > MAX_TERM) return null;
        terms.push(String(n));
      } else {
        return null;
      }
    }
  }
  return terms.filter((term) => term === null).length <= 1 ? terms : null;
}

/** 네 항을 "a : b = c : d" 글자로 쓴다(□는 null → □). */
export function equationText(terms: readonly (string | null)[]): string {
  const t = terms.map((term) => term ?? '□');
  return `${t[0]} : ${t[1]} = ${t[2]} : ${t[3]}`;
}

function lookOf(value: unknown): ProportionLook {
  return value === 'grid' || value === 'symbols' ? value : 'scale';
}

function sliderOf(value: unknown): { min: number; max: number } | null {
  if (value === undefined) return { ...DEFAULT_SLIDER };
  if (value === null || typeof value !== 'object') return null;
  const { min, max } = value as { min?: unknown; max?: unknown };
  if (typeof min !== 'number' || typeof max !== 'number') return null;
  if (!Number.isInteger(min) || !Number.isInteger(max)) return null;
  if (min < 1 || max > MAX_SLIDER || min > max) return null;
  return { min, max };
}

export function normalizeProportion(config: ProportionConfig | undefined): ProportionState {
  const base: ProportionState = {
    mode: 'proportion',
    error: null,
    settings: {
      look: lookOf(config?.look),
      pairSelect: config?.pairSelect === true,
      slider: { ...DEFAULT_SLIDER },
    },
    cards: [],
    terms: [],
    boxIndex: null,
    tryValue: null,
    tries: [],
    cardIndex: null,
    pair: null,
  };
  const fail = (code: string, message: string): ProportionState => {
    warn(message);
    return { ...base, error: code };
  };

  const slider = sliderOf(config?.unknownSlider);
  if (slider === null) {
    return fail('slider', `unknownSlider는 1 이상 ${MAX_SLIDER} 이하의 정수 min ≤ max여야 합니다.`);
  }
  const withSlider: ProportionState = { ...base, settings: { ...base.settings, slider } };

  const hasEquation = config?.equation !== undefined;
  const hasCards = config?.cards !== undefined;
  if (hasEquation && hasCards) {
    return fail('source', 'equation과 cards는 함께 쓸 수 없습니다.');
  }

  if (hasCards) {
    const raw: unknown = config?.cards;
    if (!Array.isArray(raw) || raw.length < MIN_CARDS || raw.length > MAX_CARDS) {
      return fail('cards', `cards는 ${MIN_CARDS}~${MAX_CARDS}장이어야 합니다.`);
    }
    const cards: string[][] = [];
    for (const item of raw as unknown[]) {
      const terms = parseEquation(item);
      if (terms === null || terms.some((term) => term === null)) {
        return fail('cards', '카드는 □ 없는 비례식(항은 1~30의 정수)이어야 합니다.');
      }
      cards.push(terms as string[]);
    }
    return { ...withSlider, cards };
  }

  const terms = parseEquation(hasEquation ? config?.equation : DEFAULT_EQUATION);
  if (terms === null) {
    return fail(
      'equation',
      'equation은 "3 : 5 = □ : 20"처럼 네 항(1~30의 정수, □는 0~1개)이어야 합니다.',
    );
  }
  const boxIndex = terms.indexOf(null);
  return { ...withSlider, terms, boxIndex: boxIndex === -1 ? null : boxIndex };
}
