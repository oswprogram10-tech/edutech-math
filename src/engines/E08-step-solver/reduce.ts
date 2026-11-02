/**
 * E08 단계 풀이의 순수 reducer.
 *
 * 키 하나 = Action 하나. 모든 상태는 JSON 직렬화 가능한 문자열·숫자·배열·객체로만
 * 이루어진다. 학생이 쓴 표기는 토큰에 그대로 남기고, 값 계산은 `expression.ts`가
 * `core/math`로 한다. 여기서는 문자열을 수로 바꾸지 않는다.
 */
import { stepSolverStrings } from './strings.ko';
import { fieldsOf, firstField, lastField, tokensFromText } from './expression';
import type {
  NumberToken,
  OperatorKind,
  StepLine,
  StepMode,
  StepSolverAction,
  StepSolverConfig,
  StepSolverState,
  Token,
  TokenCursor,
  TokenField,
} from './types';

const MAX_DIGITS = 7;
const DEFAULT_START = '1/2 + 1/3';
const DEFAULT_SAMPLE = ['1/2 + 1/3', '2/5'];

function lineFromText(id: string, text: string, fixed: boolean): StepLine {
  let tokens: Token[];
  try {
    tokens = tokensFromText(text);
  } catch {
    throw new Error(stepSolverStrings.configError(text));
  }
  return { id, tokens, label: null, fixed };
}

function emptyLine(id: string): StepLine {
  return { id, tokens: [], label: null, fixed: false };
}

function modeOf(config: StepSolverConfig): StepMode {
  return config.mode ?? 'lines';
}

export function createInitialState(config: StepSolverConfig): StepSolverState {
  const mode = modeOf(config);
  const checkEachLine = config.checkEachLine ?? true;
  const diagnose = config.diagnose ?? true;
  const stepLabels = config.stepLabels ? [...config.stepLabels] : [];
  const allowFreeOrder = config.allowFreeOrder ?? true;

  if (mode === 'debug') {
    const sampleIndex = Math.max(0, Math.trunc(config.sample ?? 0));
    const chosen = config.debugSamples?.[sampleIndex] ?? {
      lines: DEFAULT_SAMPLE,
    };
    const texts = chosen.lines.length > 0 ? chosen.lines : DEFAULT_SAMPLE;
    const samples = texts.map((text, index) => lineFromText(`sample-${index}`, text, true));
    const correction = emptyLine('fix-0');
    return {
      mode,
      lines: [correction],
      samples,
      cursor: { lineId: correction.id, token: 0, field: 'value' },
      nextLineId: 1,
      selectedLine: null,
      checkEachLine,
      diagnose,
      stepLabels,
      allowFreeOrder,
    };
  }

  const startText = config.start ?? config.problem ?? DEFAULT_START;
  const start = lineFromText('line-0', startText, true);
  const first = emptyLine('line-1');
  return {
    mode,
    lines: [start, first],
    samples: [],
    cursor: { lineId: first.id, token: 0, field: 'value' },
    nextLineId: 2,
    selectedLine: null,
    checkEachLine,
    diagnose,
    stepLabels,
    allowFreeOrder,
  };
}

function lineIndex(state: StepSolverState, lineId: string): number {
  return state.lines.findIndex((line) => line.id === lineId);
}

function editableLine(state: StepSolverState): StepLine | null {
  const cursorLine = state.cursor
    ? state.lines.find((line) => line.id === state.cursor?.lineId)
    : undefined;
  if (cursorLine && !cursorLine.fixed) return cursorLine;
  return state.lines.find((line) => !line.fixed) ?? null;
}

function withLine(
  state: StepSolverState,
  lineId: string,
  update: (line: StepLine) => StepLine,
  cursor?: TokenCursor | null,
): StepSolverState {
  const index = lineIndex(state, lineId);
  if (index < 0) return state;
  const lines = state.lines.map((line, current) => (current === index ? update(line) : line));
  return { ...state, lines, cursor: cursor === undefined ? state.cursor : cursor };
}

function allowedField(token: Token | undefined, field: TokenField): TokenField {
  if (token === undefined) return 'value';
  const fields = fieldsOf(token);
  return fields.includes(field) ? field : (fields[0] ?? 'value');
}

function cursorFor(line: StepLine, token: number, field: TokenField): TokenCursor {
  const clamped = Math.max(0, Math.min(token, line.tokens.length));
  return {
    lineId: line.id,
    token: clamped,
    field: allowedField(line.tokens[clamped], field),
  };
}

function cursorLine(state: StepSolverState): StepLine | null {
  if (state.cursor) {
    const found = state.lines.find((line) => line.id === state.cursor?.lineId);
    if (found && !found.fixed) return found;
  }
  return editableLine(state);
}

function replaceToken(tokens: readonly Token[], index: number, token: Token): Token[] {
  return tokens.map((current, position) => (position === index ? token : current));
}

function appendDigit(current: string, digit: string, max: number): string {
  if (current === '0') return digit;
  if (current.length >= max) return current;
  return `${current}${digit}`;
}

function editNumberToken(token: NumberToken, field: TokenField, digit: string): NumberToken {
  if (token.kind === 'fraction') {
    if (field === 'den') return { ...token, den: appendDigit(token.den, digit, 3) };
    return { ...token, num: appendDigit(token.num, digit, 3) };
  }
  if (token.kind === 'mixed') {
    if (field === 'whole') return { ...token, whole: appendDigit(token.whole, digit, 2) };
    if (field === 'den') return { ...token, den: appendDigit(token.den, digit, 3) };
    return { ...token, num: appendDigit(token.num, digit, 3) };
  }
  return { ...token, value: appendDigit(token.value, digit, MAX_DIGITS) };
}

function enterDigit(state: StepSolverState, digit: string): StepSolverState {
  if (!/^\d$/.test(digit)) return state;
  const line = cursorLine(state);
  if (!line) return state;
  const cursor = state.cursor ?? cursorFor(line, 0, 'value');
  const token = line.tokens[cursor.token];

  if (token === undefined) {
    const inserted: Token = { kind: 'integer', value: digit };
    const tokens = [...line.tokens, inserted];
    return withLine(state, line.id, (current) => ({ ...current, tokens }), {
      lineId: line.id,
      token: tokens.length - 1,
      field: 'value',
    });
  }

  if (
    token.kind === 'integer' ||
    token.kind === 'decimal' ||
    token.kind === 'fraction' ||
    token.kind === 'mixed'
  ) {
    let next = editNumberToken(token, cursor.field, digit);
    if (token.kind === 'decimal' && !token.value.includes('.') && cursor.field === 'value') {
      next = { kind: 'decimal', value: appendDigit(token.value, digit, MAX_DIGITS) };
    }
    const tokens = replaceToken(line.tokens, cursor.token, next);
    return withLine(state, line.id, (current) => ({ ...current, tokens }));
  }

  const inserted: Token = { kind: 'integer', value: digit };
  const tokens = [
    ...line.tokens.slice(0, cursor.token + 1),
    inserted,
    ...line.tokens.slice(cursor.token + 1),
  ];
  return withLine(state, line.id, (current) => ({ ...current, tokens }), {
    lineId: line.id,
    token: cursor.token + 1,
    field: 'value',
  });
}

function decimalPoint(state: StepSolverState): StepSolverState {
  const line = cursorLine(state);
  if (!line) return state;
  const cursor = state.cursor ?? cursorFor(line, 0, 'value');
  const token = line.tokens[cursor.token];

  if (token?.kind === 'integer') {
    const next: Token = { kind: 'decimal', value: `${token.value}.` };
    const tokens = replaceToken(line.tokens, cursor.token, next);
    return withLine(state, line.id, (current) => ({ ...current, tokens }), {
      lineId: line.id,
      token: cursor.token,
      field: 'value',
    });
  }
  if (token?.kind === 'decimal') return state;
  if (token !== undefined && token.kind !== 'op' && token.kind !== 'lparen') return state;

  const inserted: Token = { kind: 'decimal', value: '0.' };
  const at = cursor.token;
  const tokens = [...line.tokens.slice(0, at), inserted, ...line.tokens.slice(at)];
  return withLine(state, line.id, (current) => ({ ...current, tokens }), {
    lineId: line.id,
    token: at,
    field: 'value',
  });
}

function insertToken(state: StepSolverState, token: Token): StepSolverState {
  const line = cursorLine(state);
  if (!line) return state;
  const cursor = state.cursor ?? cursorFor(line, line.tokens.length, 'value');
  const at = Math.max(0, Math.min(cursor.token, line.tokens.length));
  const tokens = [...line.tokens.slice(0, at), token, ...line.tokens.slice(at)];

  if (token.kind === 'fraction' || token.kind === 'mixed') {
    return withLine(state, line.id, (current) => ({ ...current, tokens }), {
      lineId: line.id,
      token: at,
      field: firstField(token),
    });
  }
  if (token.kind === 'integer' || token.kind === 'decimal') {
    return withLine(state, line.id, (current) => ({ ...current, tokens }), {
      lineId: line.id,
      token: at,
      field: 'value',
    });
  }
  return withLine(state, line.id, (current) => ({ ...current, tokens }), {
    lineId: line.id,
    token: Math.min(at + 1, tokens.length),
    field: 'value',
  });
}

function tokenIsEmpty(token: NumberToken, field: TokenField): boolean {
  if (token.kind === 'fraction') {
    return (field === 'den' ? token.den : token.num).length === 0;
  }
  if (token.kind === 'mixed') {
    if (field === 'whole') return token.whole.length === 0;
    if (field === 'den') return token.den.length === 0;
    return token.num.length === 0;
  }
  return token.value.length === 0;
}

function removeFieldChar(token: NumberToken, field: TokenField): NumberToken {
  if (token.kind === 'fraction') {
    if (field === 'den') return { ...token, den: token.den.slice(0, -1) };
    return { ...token, num: token.num.slice(0, -1) };
  }
  if (token.kind === 'mixed') {
    if (field === 'whole') return { ...token, whole: token.whole.slice(0, -1) };
    if (field === 'den') return { ...token, den: token.den.slice(0, -1) };
    return { ...token, num: token.num.slice(0, -1) };
  }
  if (token.kind === 'decimal') {
    const value = token.value.slice(0, -1);
    return value.includes('.') ? { kind: 'decimal', value } : { kind: 'integer', value };
  }
  return { ...token, value: token.value.slice(0, -1) };
}

function tokenIsEmptyAfter(token: NumberToken, field: TokenField): boolean {
  const next = removeFieldChar(token, field);
  if (next.kind === 'fraction') return next.num.length === 0 && next.den.length === 0;
  if (next.kind === 'mixed') {
    return next.whole.length === 0 && next.num.length === 0 && next.den.length === 0;
  }
  return next.value.length === 0;
}

function backspace(state: StepSolverState): StepSolverState {
  const line = cursorLine(state);
  if (!line) return state;
  const cursor = state.cursor ?? cursorFor(line, 0, 'value');
  const token = line.tokens[cursor.token];
  if (token === undefined) {
    if (line.tokens.length === 0) return state;
    const tokens = line.tokens.slice(0, -1);
    return withLine(state, line.id, (current) => ({ ...current, tokens }), {
      lineId: line.id,
      token: tokens.length,
      field: 'value',
    });
  }

  const isNumber =
    token.kind === 'integer' ||
    token.kind === 'decimal' ||
    token.kind === 'fraction' ||
    token.kind === 'mixed';

  if (!isNumber) {
    const tokens = line.tokens.filter((_, index) => index !== cursor.token);
    return withLine(state, line.id, (current) => ({ ...current, tokens }), {
      lineId: line.id,
      token: Math.max(0, cursor.token - 1),
      field: 'value',
    });
  }

  if (tokenIsEmpty(token, cursor.field)) {
    const fields = fieldsOf(token);
    const position = fields.indexOf(cursor.field);
    if (position > 0) {
      return withLine(state, line.id, (current) => current, {
        lineId: line.id,
        token: cursor.token,
        field: fields[position - 1] ?? 'value',
      });
    }
    const tokens = line.tokens.filter((_, index) => index !== cursor.token);
    return withLine(state, line.id, (current) => ({ ...current, tokens }), {
      lineId: line.id,
      token: Math.max(0, cursor.token - 1),
      field: 'value',
    });
  }

  if (tokenIsEmptyAfter(token, cursor.field)) {
    const tokens = line.tokens.filter((_, index) => index !== cursor.token);
    return withLine(state, line.id, (current) => ({ ...current, tokens }), {
      lineId: line.id,
      token: Math.max(0, cursor.token - 1),
      field: 'value',
    });
  }

  const next = removeFieldChar(token, cursor.field);
  const tokens = replaceToken(line.tokens, cursor.token, next);
  return withLine(state, line.id, (current) => ({ ...current, tokens }));
}

function moveField(state: StepSolverState, delta: 1 | -1): StepSolverState {
  const line = cursorLine(state);
  if (!line) return state;
  const cursor = state.cursor ?? cursorFor(line, 0, 'value');
  const token = line.tokens[cursor.token];
  if (token === undefined) {
    if (delta < 0 && line.tokens.length > 0) {
      return withLine(state, line.id, (current) => current, {
        lineId: line.id,
        token: line.tokens.length - 1,
        field: lastField(line.tokens[line.tokens.length - 1]),
      });
    }
    return withLine(state, line.id, (current) => current, {
      lineId: line.id,
      token: line.tokens.length,
      field: 'value',
    });
  }
  const fields = fieldsOf(token);
  const position = fields.indexOf(cursor.field);
  const nextPosition = position + delta;
  if (nextPosition >= 0 && nextPosition < fields.length) {
    return withLine(state, line.id, (current) => current, {
      lineId: line.id,
      token: cursor.token,
      field: fields[nextPosition] ?? 'value',
    });
  }

  const nextToken = cursor.token + delta;
  if (nextToken < 0) {
    return withLine(state, line.id, (current) => current, {
      lineId: line.id,
      token: cursor.token,
      field: fields[0] ?? 'value',
    });
  }
  if (nextToken >= line.tokens.length) {
    return withLine(state, line.id, (current) => current, {
      lineId: line.id,
      token: line.tokens.length,
      field: 'value',
    });
  }
  return withLine(state, line.id, (current) => current, {
    lineId: line.id,
    token: nextToken,
    field: delta > 0 ? firstField(line.tokens[nextToken]) : lastField(line.tokens[nextToken]),
  });
}

function moveToken(state: StepSolverState, delta: 1 | -1): StepSolverState {
  const line = cursorLine(state);
  if (!line) return state;
  const cursor = state.cursor ?? cursorFor(line, 0, 'value');
  const nextToken = Math.max(0, Math.min(line.tokens.length, cursor.token + delta));
  return withLine(state, line.id, (current) => current, {
    lineId: line.id,
    token: nextToken,
    field: delta > 0 ? firstField(line.tokens[nextToken]) : lastField(line.tokens[nextToken]),
  });
}

function addLine(state: StepSolverState): StepSolverState {
  if (state.mode === 'debug') return state;
  const id = `line-${state.nextLineId}`;
  const line = emptyLine(id);
  return {
    ...state,
    lines: [...state.lines, line],
    cursor: { lineId: id, token: 0, field: 'value' },
    nextLineId: state.nextLineId + 1,
  };
}

function removeLine(state: StepSolverState, lineId: string): StepSolverState {
  if (state.mode === 'debug') return state;
  const index = lineIndex(state, lineId);
  if (index < 0) return state;
  const line = state.lines[index];
  if (!line || line.fixed) return state;

  const editableCount = state.lines.filter((candidate) => !candidate.fixed).length;
  if (editableCount <= 1) {
    // 마지막 학생 줄은 지우지 않고 빈 줄로 되돌린다. 늘 쓸 줄 하나는 남긴다.
    return withLine(state, lineId, (current) => ({ ...current, tokens: [], label: null }), {
      lineId,
      token: 0,
      field: 'value',
    });
  }

  const lines = state.lines.filter((candidate) => candidate.id !== lineId);
  const target = lines[Math.max(0, index - 1)] ?? lines[lines.length - 1];
  return {
    ...state,
    lines,
    cursor:
      state.cursor?.lineId === lineId && target
        ? { lineId: target.id, token: target.tokens.length, field: 'value' }
        : state.cursor,
  };
}

function selectLine(state: StepSolverState, selected: number): StepSolverState {
  if (state.mode !== 'debug') return state;
  if (!Number.isInteger(selected) || selected < 0 || selected >= state.samples.length) {
    return state;
  }
  if (state.selectedLine === selected) return state;
  const correction = state.lines[0];
  if (!correction) return state;
  const cleared: StepLine = { ...correction, tokens: [], label: null };
  return {
    ...state,
    lines: [cleared],
    selectedLine: selected,
    cursor: { lineId: cleared.id, token: 0, field: 'value' },
  };
}

function setLabel(state: StepSolverState, lineId: string, label: string | null): StepSolverState {
  if (label !== null && !state.stepLabels.includes(label)) return state;
  const index = lineIndex(state, lineId);
  if (index < 0) return state;

  if (label !== null && !state.allowFreeOrder) {
    const wanted = state.stepLabels.indexOf(label);
    const earlier = state.lines.slice(0, index);
    const later = state.lines.slice(index + 1);
    const earlierMax = earlier.reduce((max, line) => {
      const position = line.label === null ? -1 : state.stepLabels.indexOf(line.label);
      return Math.max(max, position);
    }, -1);
    const laterMin = later.reduce((min, line) => {
      const position =
        line.label === null ? Number.POSITIVE_INFINITY : state.stepLabels.indexOf(line.label);
      return Math.min(min, position);
    }, Number.POSITIVE_INFINITY);
    if (wanted < earlierMax || wanted > laterMin) return state;
  }

  return withLine(state, lineId, (line) => ({ ...line, label }));
}

function selectToken(
  state: StepSolverState,
  lineId: string,
  token: number,
  field: TokenField,
): StepSolverState {
  const line = state.lines.find((candidate) => candidate.id === lineId);
  if (!line || line.fixed) return state;
  if (!Number.isInteger(token) || token < 0 || token > line.tokens.length) return state;
  const next = cursorFor(line, token, field);
  const current = state.cursor;
  if (
    current &&
    current.lineId === next.lineId &&
    current.token === next.token &&
    current.field === next.field
  ) {
    return state;
  }
  return { ...state, cursor: next };
}

/** 모든 조작의 유일한 입구. 같은 Action 목록은 같은 상태를 재생한다. */
export function reduce(state: StepSolverState, action: StepSolverAction): StepSolverState {
  switch (action.type) {
    case 'select-token':
      return selectToken(state, action.lineId, action.token, action.field);
    case 'enter-digit':
      return enterDigit(state, action.digit);
    case 'decimal-point':
      return decimalPoint(state);
    case 'insert-token':
      return insertToken(state, action.token);
    case 'backspace':
      return backspace(state);
    case 'move-field':
      return moveField(state, action.delta);
    case 'move-token':
      return moveToken(state, action.delta);
    case 'add-line':
      return addLine(state);
    case 'remove-line':
      return removeLine(state, action.lineId);
    case 'select-line':
      return selectLine(state, action.line);
    case 'set-label':
      return setLabel(state, action.lineId, action.label);
  }
}

/** 키패드 연산 키를 Action으로 바꾼다. */
export function operatorAction(op: OperatorKind): StepSolverAction {
  return { type: 'insert-token', token: { kind: 'op', op } };
}
