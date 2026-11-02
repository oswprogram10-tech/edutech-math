/**
 * 응답 슬롯의 순수 reducer.
 *
 * 키패드 버튼 한 번, 카드 선택 한 번이 Action 하나다. 상태는 JSON으로
 * 직렬화할 수 있는 문자열·배열·객체만 쓴다. 수의 값은 observe에서
 * `Rational`로 계산한다.
 */
import type {
  ChoiceField,
  NumberField,
  NumberFieldState,
  NumberForm,
  NumberPart,
  OrderField,
  ResponseAction,
  ResponseConfig,
  ResponseField,
  ResponseFieldState,
  ResponseState,
  SortField,
  SortFieldState,
} from './types';
import { defaultPart, partsOf } from './types';

const MAX_DIGITS = 9;

function numberInitial(field: NumberField): NumberFieldState {
  const form = field.forms[0] ?? 'integer';
  return {
    kind: 'number',
    forms: [...field.forms],
    form,
    activePart: defaultPart(form),
    whole: '',
    numerator: '',
    denominator: '',
    decimal: '',
  };
}

function choiceInitial(field: ChoiceField): ResponseFieldState {
  return { kind: 'choice', multiple: field.multiple, selected: [] };
}

function orderInitial(field: OrderField): ResponseFieldState {
  return { kind: 'order', order: field.items.map((item) => item.id) };
}

function compareInitial(): ResponseFieldState {
  return { kind: 'compare', symbol: null };
}

function sortInitial(field: SortField): SortFieldState {
  const bins: Record<string, string[]> = {};
  for (const bin of field.bins) bins[bin.id] = [];
  return {
    kind: 'sort',
    bins,
    unsorted: field.cards.map((card) => card.id),
    picked: null,
  };
}

function initialField(field: ResponseField): ResponseFieldState {
  switch (field.kind) {
    case 'number':
      return numberInitial(field);
    case 'choice':
      return choiceInitial(field);
    case 'order':
      return orderInitial(field);
    case 'compare':
      return compareInitial();
    case 'sort':
      return sortInitial(field);
  }
}

export function createInitialState(config: ResponseConfig): ResponseState {
  const fields: Record<string, ResponseFieldState> = {};
  for (const field of config.fields ?? []) fields[field.id] = initialField(field);
  return { fields };
}

function withField(
  state: ResponseState,
  id: string,
  update: (field: ResponseFieldState) => ResponseFieldState,
): ResponseState {
  const current = state.fields[id];
  if (!current) return state;
  const next = update(current);
  if (next === current) return state;
  return { fields: { ...state.fields, [id]: next } };
}

function partOf(form: NumberForm, part: NumberPart): NumberPart {
  return partsOf(form).includes(part) ? part : defaultPart(form);
}

function appendDigit(text: string, key: string): string {
  const digits = text.replace('.', '').length;
  if (digits >= MAX_DIGITS) return text;
  return `${text}${key}`;
}

function reduceNumberKey(field: NumberFieldState, key: string): NumberFieldState {
  const part = partOf(field.form, field.activePart);
  if (key === 'clear') {
    return {
      ...field,
      whole: '',
      numerator: '',
      denominator: '',
      decimal: '',
      activePart: defaultPart(field.form),
    };
  }

  const current = field[part];
  let next: string;
  if (key === 'backspace') {
    next = current.slice(0, -1);
  } else if (/^\d$/.test(key)) {
    next = appendDigit(current, key);
  } else if (key === '.') {
    if (field.form !== 'decimal' || current.includes('.')) return field;
    next = appendDigit(current, key);
  } else {
    return field;
  }

  if (next === current) return field;
  return { ...field, [part]: next };
}

function toggleSelection(
  selected: readonly string[],
  option: string,
  multiple: boolean,
): readonly string[] {
  const has = selected.includes(option);
  if (!multiple) return has ? [] : [option];
  return has ? selected.filter((id) => id !== option) : [...selected, option].sort();
}

function moveOrder(order: readonly string[], item: string, direction: -1 | 1): readonly string[] {
  const index = order.indexOf(item);
  if (index < 0) return order;
  const target = index + direction;
  if (target < 0 || target >= order.length) return order;
  const next = [...order];
  const [value] = next.splice(index, 1);
  if (value === undefined) return order;
  next.splice(target, 0, value);
  return next;
}

function reorder(order: readonly string[], item: string, toIndex: number): readonly string[] {
  const index = order.indexOf(item);
  if (index < 0) return order;
  const target = Math.max(0, Math.min(order.length - 1, Math.trunc(toIndex)));
  if (target === index) return order;
  const next = [...order];
  const [value] = next.splice(index, 1);
  if (value === undefined) return order;
  next.splice(target, 0, value);
  return next;
}

function withoutCard(
  field: SortFieldState,
  card: string,
): { readonly bins: Record<string, string[]>; readonly unsorted: string[] } {
  const bins: Record<string, string[]> = {};
  for (const [bin, cards] of Object.entries(field.bins)) {
    bins[bin] = cards.filter((id) => id !== card);
  }
  return { bins, unsorted: field.unsorted.filter((id) => id !== card) };
}

function placeCard(field: SortFieldState, card: string, bin: string): SortFieldState {
  if (!Object.prototype.hasOwnProperty.call(field.bins, bin)) return field;
  const cleaned = withoutCard(field, card);
  const target = cleaned.bins[bin] ?? [];
  return {
    ...field,
    bins: { ...cleaned.bins, [bin]: [...target, card].sort() },
    unsorted: cleaned.unsorted,
    picked: null,
  };
}

export function reduce(state: ResponseState, action: ResponseAction): ResponseState {
  switch (action.type) {
    case 'number-form':
      return withField(state, action.field, (field) => {
        if (field.kind !== 'number' || !field.forms.includes(action.form)) return field;
        return { ...field, form: action.form, activePart: defaultPart(action.form) };
      });
    case 'number-focus':
      return withField(state, action.field, (field) => {
        if (field.kind !== 'number') return field;
        const part = partOf(field.form, action.part);
        return part === field.activePart ? field : { ...field, activePart: part };
      });
    case 'number-key':
      return withField(state, action.field, (field) =>
        field.kind === 'number' ? reduceNumberKey(field, action.key) : field,
      );
    case 'number-clear':
      return withField(state, action.field, (field) =>
        field.kind === 'number' ? reduceNumberKey(field, 'clear') : field,
      );
    case 'choice-toggle':
      return withField(state, action.field, (field) => {
        if (field.kind !== 'choice') return field;
        return {
          ...field,
          selected: toggleSelection(field.selected, action.option, field.multiple),
        };
      });
    case 'order-up':
      return withField(state, action.field, (field) => {
        if (field.kind !== 'order') return field;
        const order = moveOrder(field.order, action.item, -1);
        return order === field.order ? field : { ...field, order };
      });
    case 'order-down':
      return withField(state, action.field, (field) => {
        if (field.kind !== 'order') return field;
        const order = moveOrder(field.order, action.item, 1);
        return order === field.order ? field : { ...field, order };
      });
    case 'order-reorder':
      return withField(state, action.field, (field) => {
        if (field.kind !== 'order') return field;
        const order = reorder(field.order, action.item, action.toIndex);
        return order === field.order ? field : { ...field, order };
      });
    case 'compare-set':
      return withField(state, action.field, (field) =>
        field.kind === 'compare' ? { ...field, symbol: action.symbol } : field,
      );
    case 'sort-pick':
      return withField(state, action.field, (field) => {
        if (field.kind !== 'sort') return field;
        const exists =
          field.unsorted.includes(action.card) ||
          Object.values(field.bins).some((cards) => cards.includes(action.card));
        if (!exists) return field;
        const picked = field.picked === action.card ? null : action.card;
        return picked === field.picked ? field : { ...field, picked };
      });
    case 'sort-place':
      return withField(state, action.field, (field) => {
        if (field.kind !== 'sort' || field.picked === null) return field;
        return placeCard(field, field.picked, action.bin);
      });
    case 'sort-place-card':
      return withField(state, action.field, (field) =>
        field.kind === 'sort' ? placeCard(field, action.card, action.bin) : field,
      );
    case 'sort-remove':
      return withField(state, action.field, (field) => {
        if (field.kind !== 'sort') return field;
        const cleaned = withoutCard(field, action.card);
        if (cleaned.unsorted.includes(action.card)) return field;
        return {
          ...field,
          bins: cleaned.bins,
          unsorted: [...cleaned.unsorted, action.card].sort(),
          picked: null,
        };
      });
  }
}
