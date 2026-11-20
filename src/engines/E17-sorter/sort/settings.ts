/** sort 설정 정규화. 잘못된 설정은 `error` 문구를 달아 돌려준다(예외를 던지지 않는다). */
import { deckDefinition, isSortDeckName } from '../decks';
import type { SortDeckName } from '../decks';
import { allowedCriteria, binIdsFor, criterionValues } from './criteria';
import { sortStrings as S } from './strings.ko';
import { ALL_BIN_IDS } from './types';
import type { BinId, BinLabelMode, CountTableMode, RenderMode, SortSettings } from './types';

function recordOf(value: unknown): Readonly<Record<string, unknown>> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Readonly<Record<string, unknown>>;
}

function stringList(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const list: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') return null;
    list.push(item);
  }
  return list;
}

function fail(partial: Partial<SortSettings>): SortSettings {
  return {
    deck: 'buttons-12',
    cards: [],
    criterionChoice: null,
    bins: 3,
    binLabels: 'none',
    conveyor: false,
    countTable: false,
    prefill: {},
    render: 'color',
    ...partial,
    error: S.configError,
  };
}

export function sortSettings(config: unknown): SortSettings {
  const record = recordOf(config) ?? {};
  const deckValue = record['deck'] ?? 'buttons-12';
  if (!isSortDeckName(deckValue)) return fail({});
  const deck: SortDeckName = deckValue;
  const definition = deckDefinition(deck);
  const knownIds = new Set(definition.cards.map((card) => card.id));

  let cards: string[] = definition.cards.map((card) => card.id);
  if (record['cards'] !== undefined) {
    const list = stringList(record['cards']);
    if (list === null || list.length === 0) return fail({ deck });
    if (new Set(list).size !== list.length) return fail({ deck });
    if (list.some((id) => !knownIds.has(id))) return fail({ deck });
    cards = list;
  }

  let criterionChoice: string[] | null = null;
  if (record['criterionChoice'] !== undefined) {
    const list = stringList(record['criterionChoice']);
    const allowed = allowedCriteria(deck);
    if (list === null || list.length === 0) return fail({ deck, cards });
    if (new Set(list).size !== list.length) return fail({ deck, cards });
    if (list.some((criterion) => !allowed.includes(criterion))) return fail({ deck, cards });
    criterionChoice = list;
  }

  const labelValue = record['binLabels'];
  let binLabels: BinLabelMode = criterionChoice !== null ? 'criterion-values' : 'none';
  if (labelValue !== undefined) {
    if (
      labelValue !== 'criterion-values' &&
      labelValue !== 'student-choice-icon' &&
      labelValue !== 'none'
    ) {
      return fail({ deck, cards });
    }
    binLabels = labelValue;
  }
  // 기준 고르기가 있으면 상자 이름은 기준 값이다. 기준 값 이름을 쓰려면 기준 고르기가 있어야 한다.
  if (criterionChoice !== null) binLabels = 'criterion-values';
  else if (binLabels === 'criterion-values') return fail({ deck, cards });

  let bins = binLabels === 'none' || binLabels === 'student-choice-icon' ? 3 : 0;
  if (record['bins'] !== undefined) {
    const value = record['bins'];
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 4) {
      return fail({ deck, cards });
    }
    bins = value;
  }

  const conveyor = record['conveyor'] === true;
  const tableValue = record['countTable'];
  let countTable: CountTableMode = false;
  if (tableValue === 'student' || tableValue === 'auto') countTable = tableValue;
  else if (tableValue !== undefined && tableValue !== false) return fail({ deck, cards });
  const renderValue = record['render'];
  const render: RenderMode = renderValue === 'gray' ? 'gray' : 'color';

  const prefill: Record<string, string[]> = {};
  if (record['prefill'] !== undefined) {
    const raw = recordOf(record['prefill']);
    if (raw === null || criterionChoice !== null) return fail({ deck, cards });
    const binIds = binIdsFor(bins) as string[];
    const used = new Set<string>();
    for (const [bin, value] of Object.entries(raw)) {
      const list = stringList(value);
      if (list === null || !(ALL_BIN_IDS as readonly string[]).includes(bin)) {
        return fail({ deck, cards });
      }
      if (!binIds.includes(bin)) return fail({ deck, cards });
      for (const id of list) {
        if (!cards.includes(id) || used.has(id)) return fail({ deck, cards });
        used.add(id);
      }
      prefill[bin] = list;
    }
  }

  return {
    deck,
    cards,
    criterionChoice,
    bins,
    binLabels,
    conveyor,
    countTable,
    prefill,
    render,
    error: null,
  };
}

/** 지금 상자 id 목록. 기준을 고르는 설정은 기준을 고른 뒤에만 상자가 있다. */
export function activeBinIds(settings: SortSettings, criterion: string | null): BinId[] {
  if (settings.criterionChoice !== null) {
    if (criterion === null) return [];
    return binIdsFor(criterionValues(settings.deck, criterion).length);
  }
  return binIdsFor(settings.bins);
}
