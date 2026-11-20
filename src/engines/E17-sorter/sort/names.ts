/** 카드·상자 이름(aria·상태 글용). 순수 함수. */
import type { SortCard } from '../decks';
import { criterionValues, parseIcon } from './criteria';
import { sortStrings as S } from './strings.ko';
import type { BinId, SortState } from './types';

export function cardNameOf(card: SortCard): string {
  if (card.name !== null) return card.name;
  return S.buttonLabel(
    String(card.attrs['color']),
    String(card.attrs['shape']),
    String(card.attrs['holes']),
  );
}

/** 상자 이름(컨트롤·aria용). 이름이 없으면 "상자 n". */
export function binNameOf(state: SortState, bin: BinId, index: number): string {
  if (state.settings.binLabels === 'criterion-values' && state.criterion !== null) {
    const value = criterionValues(state.settings.deck, state.criterion)[index];
    if (value !== undefined) return S.valueName(state.criterion, value);
  }
  if (state.settings.binLabels === 'student-choice-icon') {
    const icon = state.icons[bin] ?? null;
    const parsed = icon === null ? null : parseIcon(icon);
    if (parsed !== null) return S.valueName(parsed.attribute, parsed.value);
  }
  return S.binLabel(index + 1);
}
