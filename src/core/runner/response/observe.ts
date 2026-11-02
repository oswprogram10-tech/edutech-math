/**
 * 응답 슬롯의 observe. 판정 경로는 `response.<필드id>.<키>`다.
 *
 * - number: `{ raw, value, form, valid, irreducible }`
 *   `raw`는 학생이 쓴 표기를 그대로 둔다(`4/10`, `1 2/9`, `0.40`).
 *   `value`는 `Rational.toJSON()`이고 무효면 null이다.
 * - choice: `{ selected: [id…] }` (id 오름차순)
 * - order: `{ order: [id…] }` (학생이 놓은 순서 그대로)
 * - compare: `{ symbol: '<' | '=' | '>' | null }`
 * - sort: `{ bins: { [binId]: [cardId…] }, unsorted: [cardId…] }` (id 오름차순)
 */
import type { JsonValue, Observation } from '../../engine-sdk';
import { Rational } from '../../math';
import type {
  NumberFieldState,
  ResponseConfig,
  ResponseFieldState,
  ResponseState,
  SortFieldState,
} from './types';

function rawOf(field: NumberFieldState): string {
  switch (field.form) {
    case 'integer':
      return field.whole;
    case 'decimal':
      return field.decimal;
    case 'fraction':
      if (field.numerator === '' && field.denominator === '') return '';
      return `${field.numerator}/${field.denominator}`;
    case 'mixed': {
      if (field.numerator === '' && field.denominator === '') return field.whole;
      const fraction = `${field.numerator}/${field.denominator}`;
      return field.whole === '' ? fraction : `${field.whole} ${fraction}`;
    }
  }
}

function digits(text: string): bigint | null {
  return /^\d+$/.test(text) ? BigInt(text) : null;
}

function valueOf(field: NumberFieldState): Rational | null {
  try {
    switch (field.form) {
      case 'integer': {
        const whole = digits(field.whole);
        return whole === null ? null : Rational.of(whole);
      }
      case 'decimal': {
        if (!/^\d+\.\d+$/.test(field.decimal)) return null;
        return Rational.parse(field.decimal);
      }
      case 'fraction': {
        const numerator = digits(field.numerator);
        const denominator = digits(field.denominator);
        if (numerator === null || denominator === null || denominator === 0n) return null;
        return Rational.of(numerator, denominator);
      }
      case 'mixed': {
        const whole = digits(field.whole);
        const numerator = digits(field.numerator);
        const denominator = digits(field.denominator);
        if (whole === null || numerator === null || denominator === null || denominator === 0n) {
          return null;
        }
        return Rational.of(whole * denominator + numerator, denominator);
      }
    }
  } catch {
    return null;
  }
}

function gcd(left: bigint, right: bigint): bigint {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) {
    const rest = a % b;
    a = b;
    b = rest;
  }
  return a;
}

function irreducibleOf(field: NumberFieldState): boolean {
  if (field.form !== 'fraction' && field.form !== 'mixed') return true;
  const numerator = digits(field.numerator);
  const denominator = digits(field.denominator);
  if (numerator === null || denominator === null || denominator === 0n) return false;
  return gcd(numerator, denominator) === 1n;
}

function numberObservation(field: NumberFieldState): Observation {
  const value = valueOf(field);
  return {
    raw: rawOf(field),
    value: value === null ? null : (value.toJSON() as JsonValue),
    form: field.form,
    valid: value !== null,
    irreducible: value !== null && irreducibleOf(field),
  };
}

function sortObservation(field: SortFieldState): Observation {
  const bins: Record<string, JsonValue> = {};
  for (const bin of Object.keys(field.bins).sort()) {
    bins[bin] = [...(field.bins[bin] ?? [])].sort();
  }
  return { bins, unsorted: [...field.unsorted].sort() };
}

function fieldObservation(field: ResponseFieldState): Observation {
  switch (field.kind) {
    case 'number':
      return numberObservation(field);
    case 'choice':
      return { selected: [...field.selected].sort() };
    case 'order':
      return { order: [...field.order] };
    case 'compare':
      return { symbol: field.symbol };
    case 'sort':
      return sortObservation(field);
  }
}

export function observe(state: ResponseState, config: ResponseConfig): Observation {
  void config;
  const fields: Record<string, JsonValue> = {};
  for (const [id, field] of Object.entries(state.fields)) {
    fields[id] = fieldObservation(field);
  }
  return fields;
}

/** 판정 슬롯 Observation과 응답 Observation을 합친다. 응답은 `response` 아래에만 둔다. */
export function judgeObservation(
  judge: Observation | undefined,
  response: Observation | undefined,
): Observation | undefined {
  if (!judge && !response) return undefined;
  return { ...(judge ?? {}), ...(response ? { response } : {}) };
}
