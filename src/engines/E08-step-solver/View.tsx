/**
 * E08 단계 풀이 화면.
 *
 * - 수식 키패드·키보드로 토큰을 넣는다(자유 텍스트 입력 없음).
 * - 줄마다 앞 줄과 값이 같은지 ✓/✗/·로 보여 준다(색 외에 기호).
 * - 깨진 줄에는 학생이 쓴 수와 앞 줄 값만 쓴 반례 상자를 띄운다.
 * - debug는 친구 풀이를 고르고 고친 줄 하나를 쓴다.
 */
import { useEffect, useMemo, useRef } from 'react';
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Rational } from '../../core/math';
import type { EngineViewProps } from '../../core/engine-sdk';
import { analyzeState, barRatio, firstDiagnosis } from './analyze';
import type { Diagnosis, LineAnalysis } from './analyze';
import { firstField } from './expression';
import { operatorAction, reduce } from './reduce';
import { stepSolverStrings as S } from './strings.ko';
import type {
  OperatorKind,
  StepLine,
  StepSolverAction,
  StepSolverConfig,
  StepSolverState,
  Token,
  TokenField,
} from './types';
import styles from './View.module.css';

type KeySpec =
  | { readonly kind: 'digit'; readonly digit: string; readonly testId: string }
  | { readonly kind: 'operator'; readonly op: OperatorKind; readonly testId: string }
  | {
      readonly kind:
        | 'fraction'
        | 'mixed'
        | 'decimal'
        | 'lparen'
        | 'rparen'
        | 'box'
        | 'backspace'
        | 'add-line'
        | 'remove-line';
      readonly testId: string;
    };

const DEFAULT_KEYS = [
  'digits',
  'fraction',
  'mixed',
  'decimal',
  'add',
  'sub',
  'mul',
  'div',
  'lparen',
  'rparen',
  'box',
  'backspace',
  'add-line',
  'remove-line',
] as const;

const DIGITS: readonly string[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

function keySpecsFor(name: string): KeySpec[] {
  switch (name) {
    case 'digits':
      return DIGITS.map((digit) => ({ kind: 'digit', digit, testId: digit }));
    case 'fraction':
      return [{ kind: 'fraction', testId: 'fraction' }];
    case 'mixed':
      return [{ kind: 'mixed', testId: 'mixed' }];
    case 'decimal':
    case '.':
      return [{ kind: 'decimal', testId: 'decimal' }];
    case 'add':
    case '+':
      return [{ kind: 'operator', op: 'add', testId: 'add' }];
    case 'sub':
    case '-':
    case '−':
      return [{ kind: 'operator', op: 'sub', testId: 'sub' }];
    case 'mul':
    case '*':
    case '×':
      return [{ kind: 'operator', op: 'mul', testId: 'mul' }];
    case 'div':
    case '/':
    case '÷':
      return [{ kind: 'operator', op: 'div', testId: 'div' }];
    case 'lparen':
    case '(':
      return [{ kind: 'lparen', testId: 'lparen' }];
    case 'rparen':
    case ')':
      return [{ kind: 'rparen', testId: 'rparen' }];
    case 'box':
    case '□':
      return [{ kind: 'box', testId: 'box' }];
    case 'backspace':
    case 'delete':
      return [{ kind: 'backspace', testId: 'backspace' }];
    case 'add-line':
      return [{ kind: 'add-line', testId: 'add-line' }];
    case 'remove-line':
      return [{ kind: 'remove-line', testId: 'remove-line' }];
    default:
      return [];
  }
}

function keypadKeys(keypad: readonly string[] | undefined): KeySpec[] {
  const names = keypad && keypad.length > 0 ? keypad : DEFAULT_KEYS;
  const seen = new Set<string>();
  const result: KeySpec[] = [];
  for (const name of names) {
    for (const spec of keySpecsFor(name)) {
      if (seen.has(spec.testId)) continue;
      seen.add(spec.testId);
      result.push(spec);
    }
  }
  return result;
}

function keyLabel(key: KeySpec): string {
  if (key.kind === 'digit') return key.digit;
  if (key.kind === 'operator') return S.opSymbols[key.op];
  switch (key.kind) {
    case 'fraction':
      return 'a/b';
    case 'mixed':
      return '1 a/b';
    case 'decimal':
      return '.';
    case 'lparen':
      return '(';
    case 'rparen':
      return ')';
    case 'box':
      return '□';
    case 'backspace':
      return '⌫';
    case 'add-line':
      return '+ 줄';
    case 'remove-line':
      return '− 줄';
  }
}

function keyAria(key: KeySpec): string {
  if (key.kind === 'digit') return S.keyDigit(key.digit);
  if (key.kind === 'operator') return S.opNames[key.op];
  switch (key.kind) {
    case 'fraction':
      return S.keyFraction;
    case 'mixed':
      return S.keyMixed;
    case 'decimal':
      return S.keyDecimal;
    case 'lparen':
      return S.keyLParen;
    case 'rparen':
      return S.keyRParen;
    case 'box':
      return S.keyBox;
    case 'backspace':
      return S.keyBackspace;
    case 'add-line':
      return S.addLine;
    case 'remove-line':
      return S.lineKey;
  }
}

function actionFor(key: KeySpec, activeLineId: string): StepSolverAction {
  if (key.kind === 'digit') return { type: 'enter-digit', digit: key.digit };
  if (key.kind === 'operator') return operatorAction(key.op);
  switch (key.kind) {
    case 'fraction':
      return { type: 'insert-token', token: { kind: 'fraction', num: '', den: '' } };
    case 'mixed':
      return {
        type: 'insert-token',
        token: { kind: 'mixed', whole: '', num: '', den: '' },
      };
    case 'decimal':
      return { type: 'decimal-point' };
    case 'lparen':
      return { type: 'insert-token', token: { kind: 'lparen' } };
    case 'rparen':
      return { type: 'insert-token', token: { kind: 'rparen' } };
    case 'box':
      return { type: 'insert-token', token: { kind: 'box' } };
    case 'backspace':
      return { type: 'backspace' };
    case 'add-line':
      return { type: 'add-line' };
    case 'remove-line':
      return { type: 'remove-line', lineId: activeLineId };
  }
}

function fieldText(token: Token, field: TokenField): string {
  switch (token.kind) {
    case 'integer':
    case 'decimal':
      return token.value;
    case 'fraction':
      return field === 'den' ? token.den : token.num;
    case 'mixed':
      if (field === 'whole') return token.whole;
      if (field === 'den') return token.den;
      return token.num;
    default:
      return '';
  }
}

function tokenText(token: Token): string {
  switch (token.kind) {
    case 'integer':
    case 'decimal':
      return token.value;
    case 'fraction':
      return `${token.num}/${token.den}`;
    case 'mixed':
      return `${token.whole} ${token.num}/${token.den}`;
    case 'op':
      return S.opSymbols[token.op];
    case 'lparen':
      return '(';
    case 'rparen':
      return ')';
    case 'box':
      return '□';
  }
}

function checkSymbol(value: boolean | null): string {
  if (value === true) return S.checkCorrectMark;
  if (value === false) return S.checkWrongMark;
  return S.checkNeutralMark;
}

function checkLabel(value: boolean | null): string {
  if (value === true) return S.checkCorrect;
  if (value === false) return S.checkWrong;
  return S.checkNeutral;
}

function checkClass(value: boolean | null): string {
  if (value === true) return styles.checkCorrect ?? '';
  if (value === false) return styles.checkWrong ?? '';
  return styles.checkNeutral ?? '';
}

function CheckBadge({
  value,
  testId,
}: {
  readonly value: boolean | null;
  readonly testId?: string;
}) {
  return (
    <span
      className={`${styles.check} ${checkClass(value)}`}
      role="img"
      aria-label={checkLabel(value)}
      data-testid={testId}
    >
      {checkSymbol(value)}
    </span>
  );
}

function FractionDisplay({ token }: { readonly token: Token }) {
  if (token.kind !== 'fraction') return null;
  return (
    <span className={styles.fraction} aria-label={tokenText(token)}>
      <span className={styles.fractionPart}>{token.num}</span>
      <span className={styles.fractionBar} aria-hidden="true" />
      <span className={styles.fractionPart}>{token.den}</span>
    </span>
  );
}

function TokenDisplay({ tokens }: { readonly tokens: readonly Token[] }) {
  return (
    <>
      {tokens.map((token, index) => {
        if (token.kind === 'fraction') {
          return <FractionDisplay key={`token-${index}`} token={token} />;
        }
        if (token.kind === 'mixed') {
          return (
            <span key={`token-${index}`} className={styles.mixed} aria-label={tokenText(token)}>
              <span className={styles.mixedWhole}>{token.whole}</span>
              <span className={styles.fraction} aria-hidden="true">
                <span className={styles.fractionPart}>{token.num}</span>
                <span className={styles.fractionBar} />
                <span className={styles.fractionPart}>{token.den}</span>
              </span>
            </span>
          );
        }
        return (
          <span
            key={`token-${index}`}
            className={token.kind === 'op' ? styles.op : styles.plainToken}
          >
            {tokenText(token)}
          </span>
        );
      })}
    </>
  );
}

interface EditableTokenProps {
  readonly token: Token;
  readonly lineId: string;
  readonly lineIndex: number;
  readonly tokenIndex: number;
  readonly state: StepSolverState;
  readonly dispatch: (action: StepSolverAction) => void;
  readonly readOnly: boolean;
}

function EditableToken({
  token,
  lineId,
  lineIndex,
  tokenIndex,
  state,
  dispatch,
  readOnly,
}: EditableTokenProps) {
  const active = (field: TokenField): boolean =>
    state.cursor?.lineId === lineId &&
    state.cursor.token === tokenIndex &&
    state.cursor.field === field;

  const select = (field: TokenField): void => {
    if (readOnly) return;
    dispatch({ type: 'select-token', lineId, token: tokenIndex, field });
  };

  const fieldButton = (field: TokenField) => {
    const text = fieldText(token, field);
    const testId = `token-${lineIndex}-${tokenIndex}-${field}`;
    return (
      <button
        key={field}
        type="button"
        className={`${styles.field} ${active(field) ? styles.fieldActive : ''}`}
        data-testid={testId}
        data-active={active(field)}
        aria-label={`${S.cellLabel(lineIndex, field)} ${text.length > 0 ? text : S.emptyField}`}
        disabled={readOnly}
        onFocus={() => {
          if (!readOnly && !active(field)) select(field);
        }}
        onClick={(event) => {
          event.stopPropagation();
          select(field);
        }}
      >
        {text.length > 0 ? text : <span className={styles.blankField}>·</span>}
      </button>
    );
  };

  if (token.kind === 'fraction') {
    return (
      <span className={styles.token} data-token-kind="fraction">
        <span className={styles.fraction}>
          {fieldButton('num')}
          <span className={styles.fractionBar} aria-hidden="true" />
          {fieldButton('den')}
        </span>
      </span>
    );
  }
  if (token.kind === 'mixed') {
    return (
      <span className={styles.token} data-token-kind="mixed">
        <span className={styles.mixed}>
          {fieldButton('whole')}
          <span className={styles.fraction}>
            {fieldButton('num')}
            <span className={styles.fractionBar} aria-hidden="true" />
            {fieldButton('den')}
          </span>
        </span>
      </span>
    );
  }
  const field = firstField(token);
  const activeField = active(field);
  return (
    <button
      type="button"
      className={`${styles.tokenButton} ${activeField ? styles.fieldActive : ''} ${
        token.kind === 'op' ? styles.op : ''
      }`}
      data-testid={`token-${lineIndex}-${tokenIndex}-${field}`}
      data-active={activeField}
      aria-label={`${S.cellLabel(lineIndex, field)} ${tokenText(token)}`}
      disabled={readOnly}
      onFocus={() => {
        if (!readOnly && !active(field)) select(field);
      }}
      onClick={(event) => {
        event.stopPropagation();
        select(field);
      }}
    >
      {tokenText(token)}
    </button>
  );
}

interface LineRowProps {
  readonly line: StepLine;
  readonly lineIndex: number;
  readonly analysis: LineAnalysis | undefined;
  readonly state: StepSolverState;
  readonly dispatch: (action: StepSolverAction) => void;
  readonly readOnly: boolean;
  readonly showCheck: boolean;
  readonly showRemove: boolean;
  readonly showLabel: boolean;
  readonly diagnosis: Diagnosis | null;
  readonly cpa: 'C' | 'P' | 'A';
}

function Counterexample({
  diagnosis,
  cpa,
}: {
  readonly diagnosis: Diagnosis;
  readonly cpa: 'C' | 'P' | 'A';
}) {
  const previous = Rational.parse(diagnosis.previousValue);
  const student = Rational.parse(diagnosis.studentValue);
  const maximum = previous.compareTo(student) >= 0 ? previous : student;
  const previousRatio = barRatio(previous, maximum);
  const studentRatio = barRatio(student, maximum);

  const message = (() => {
    switch (diagnosis.code) {
      case 'MC-FRAC-ADD-DENOM':
        return S.messageAddDenom(diagnosis.studentExpr, diagnosis.leftText);
      case 'MC-FRAC-ADD-DENOM-HALF':
        return S.messageAddDenomHalf(diagnosis.studentExpr, diagnosis.leftText);
      case 'MC-FRAC-ADD-NO-CONVERT-NUM':
        return S.messageNoConvert(diagnosis.studentExpr, diagnosis.leftText);
      case 'MC-FRAC-BORROW-AS-TEN':
        return S.messageBorrowAsTen(diagnosis.studentExpr);
      case 'MC-FRAC-WHOLE-MINUS':
        return S.messageWholeMinus(diagnosis.studentExpr);
      default:
        return S.messageGeneric(diagnosis.studentExpr);
    }
  })();

  return (
    <div className={styles.counterexample} data-testid="counterexample" role="note">
      <p className={styles.counterTitle}>{S.counterexampleTitle}</p>
      <p className={styles.counterMessage}>{message}</p>
      {cpa === 'A' ? null : (
        <div
          className={styles.bars}
          data-testid="counterexample-bars"
          role="img"
          aria-label={S.barCheckLabel}
        >
          <div className={styles.barRow}>
            <span className={styles.barLabel}>{S.barPrevious}</span>
            <span className={styles.barTrack}>
              <span
                className={`${styles.barFill} ${styles.barPrevious}`}
                style={{ width: `${Math.round(previousRatio * 100)}%` }}
              />
            </span>
          </div>
          <div className={styles.barRow}>
            <span className={styles.barLabel}>{S.barCurrent}</span>
            <span className={styles.barTrack}>
              <span
                className={`${styles.barFill} ${styles.barCurrent}`}
                style={{ width: `${Math.round(studentRatio * 100)}%` }}
              />
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function LineRow({
  line,
  lineIndex,
  analysis,
  state,
  dispatch,
  readOnly,
  showCheck,
  showRemove,
  showLabel,
  diagnosis,
  cpa,
}: LineRowProps) {
  const equivalent = showCheck ? (analysis?.equivalentToPrev ?? null) : null;
  const canRemove = showRemove && !line.fixed && !readOnly;

  return (
    <li
      className={`${styles.line} ${equivalent === false ? styles.lineBroken : ''}`}
      data-testid={`line-${lineIndex}`}
    >
      <span className={styles.lineIndex}>{lineIndex + 1}</span>
      {lineIndex > 0 ? (
        <span className={styles.equals} aria-hidden="true">
          {S.equals}
        </span>
      ) : (
        <span className={styles.equalsPlaceholder} aria-hidden="true" />
      )}
      <span className={styles.tokens} data-editor="true">
        {line.tokens.length === 0 ? (
          <span className={styles.blankLine}>{S.emptyField}</span>
        ) : (
          line.tokens.map((token, tokenIndex) => {
            return (
              <EditableToken
                key={`token-${tokenIndex}`}
                token={token}
                lineId={line.id}
                lineIndex={lineIndex}
                tokenIndex={tokenIndex}
                state={state}
                dispatch={dispatch}
                readOnly={readOnly}
              />
            );
          })
        )}
      </span>
      {showCheck ? (
        <CheckBadge value={equivalent} testId={`check-${lineIndex}`} />
      ) : (
        <span className={styles.checkPlaceholder} aria-hidden="true" />
      )}
      {canRemove ? (
        <button
          type="button"
          className={styles.removeLine}
          data-testid={`remove-${lineIndex}`}
          aria-label={S.deleteLine(lineIndex)}
          onClick={() => dispatch({ type: 'remove-line', lineId: line.id })}
        >
          ×
        </button>
      ) : null}
      {showLabel && state.stepLabels.length > 0 ? (
        <label className={styles.labelPick}>
          <span className={styles.labelCaption}>{S.stepLabelTitle}</span>
          <select
            aria-label={S.stepLabelFor(lineIndex)}
            value={line.label ?? ''}
            disabled={readOnly}
            onChange={(event) =>
              dispatch({
                type: 'set-label',
                lineId: line.id,
                label: event.target.value === '' ? null : event.target.value,
              })
            }
          >
            <option value="">{S.stepLabelNone}</option>
            {state.stepLabels.map((label) => (
              <option key={label} value={label}>
                {label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {diagnosis ? <Counterexample diagnosis={diagnosis} cpa={cpa} /> : null}
    </li>
  );
}

function activeLineOf(state: StepSolverState): StepLine | null {
  if (state.cursor) {
    const found = state.lines.find((line) => line.id === state.cursor?.lineId);
    if (found && !found.fixed) return found;
  }
  return state.lines.find((line) => !line.fixed) ?? null;
}

export function StepSolverView({
  config,
  state,
  dispatch,
  cpa,
  readOnly = false,
  targetSize,
}: EngineViewProps<StepSolverConfig, StepSolverState, StepSolverAction>) {
  const analysis = useMemo(() => analyzeState(state), [state]);
  const diagnosis = useMemo(() => firstDiagnosis(state), [state]);
  const keys = useMemo(() => keypadKeys(config.keypad), [config.keypad]);
  const rootRef = useRef<HTMLDivElement>(null);
  const focusPending = useRef<string | null>(null);

  const isDebug = state.mode === 'debug';
  const activeLine = activeLineOf(state);
  const activeLineId = activeLine?.id ?? '';

  const lineIndexOf = (lineId: string): number => {
    if (isDebug && state.lines[0]?.id === lineId) return state.samples.length;
    return state.lines.findIndex((line) => line.id === lineId);
  };

  useEffect(() => {
    const testId = focusPending.current;
    if (testId === null) return;
    focusPending.current = null;
    const element = rootRef.current?.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
    element?.focus();
  }, [state.cursor]);

  const focusCursor = (action: StepSolverAction): void => {
    const next = reduce(state, action);
    if (next === state) return;
    const cursor = next.cursor;
    if (cursor) {
      const index = lineIndexOf(cursor.lineId);
      focusPending.current = `token-${index}-${cursor.token}-${cursor.field}`;
    }
    dispatch(action);
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (readOnly) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target;
    if (
      target instanceof HTMLElement &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable)
    ) {
      return;
    }

    const inEditor =
      target === rootRef.current ||
      (target instanceof HTMLElement && target.closest('[data-editor="true"]') !== null);

    const key = event.key;
    if (/^[0-9]$/.test(key)) {
      event.preventDefault();
      dispatch({ type: 'enter-digit', digit: key });
      return;
    }
    if (key === '.' || key === ',') {
      event.preventDefault();
      dispatch({ type: 'decimal-point' });
      return;
    }
    if (key === '+') {
      event.preventDefault();
      dispatch(operatorAction('add'));
      return;
    }
    if (key === '-' || key === '−') {
      event.preventDefault();
      dispatch(operatorAction('sub'));
      return;
    }
    if (key === '*' || key === '×') {
      event.preventDefault();
      dispatch(operatorAction('mul'));
      return;
    }
    if (key === '/' || key === '÷') {
      event.preventDefault();
      dispatch(operatorAction('div'));
      return;
    }
    if (key === '(' || key === ')') {
      event.preventDefault();
      dispatch({
        type: 'insert-token',
        token: { kind: key === '(' ? 'lparen' : 'rparen' },
      });
      return;
    }
    if (key === '□') {
      event.preventDefault();
      dispatch({ type: 'insert-token', token: { kind: 'box' } });
      return;
    }
    if (key === 'Backspace') {
      event.preventDefault();
      dispatch({ type: 'backspace' });
      return;
    }
    if (inEditor && key === 'Tab') {
      event.preventDefault();
      focusCursor({ type: 'move-field', delta: event.shiftKey ? -1 : 1 });
      return;
    }
    if (inEditor && key === 'ArrowLeft') {
      event.preventDefault();
      focusCursor({ type: 'move-token', delta: -1 });
      return;
    }
    if (inEditor && key === 'ArrowRight') {
      event.preventDefault();
      focusCursor({ type: 'move-token', delta: 1 });
      return;
    }
    if (inEditor && key === 'ArrowUp') {
      event.preventDefault();
      focusCursor({ type: 'move-field', delta: -1 });
      return;
    }
    if (inEditor && key === 'ArrowDown') {
      event.preventDefault();
      focusCursor({ type: 'move-field', delta: 1 });
      return;
    }
  };

  const rootStyle = { '--target': `${targetSize}px` } as CSSProperties;
  const showLabels = state.mode === 'fraction-steps' && state.stepLabels.length > 0;
  const sampleCount = state.samples.length;
  const correctionAnalysis = analysis.lines[sampleCount];
  const selected = state.selectedLine;

  return (
    <div
      className={styles.root}
      style={rootStyle}
      data-testid="step-solver"
      data-target-size={targetSize}
      tabIndex={0}
      role="group"
      aria-label={S.canvasLabel}
      onKeyDown={handleKeyDown}
    >
      <p className={styles.instructions}>{S.instructions[state.mode]}</p>

      {isDebug ? (
        <section className={styles.sampleSection} aria-label={S.sampleTitle}>
          <h3 className={styles.sectionTitle}>{S.sampleTitle}</h3>
          <p className={styles.samplePrompt}>{S.samplePick}</p>
          <ol className={styles.lines}>
            {state.samples.map((line, index) => (
              <li key={line.id} className={styles.sampleRow}>
                <button
                  type="button"
                  className={`${styles.sampleLine} ${
                    selected === index ? styles.sampleSelected : ''
                  }`}
                  data-testid={`sample-line-${index}`}
                  aria-pressed={selected === index}
                  aria-label={selected === index ? S.sampleSelected(index) : S.sampleLine(index)}
                  disabled={readOnly}
                  onClick={() => dispatch({ type: 'select-line', line: index })}
                >
                  <span className={styles.lineIndex}>{index + 1}</span>
                  {index > 0 ? (
                    <span className={styles.equals} aria-hidden="true">
                      {S.equals}
                    </span>
                  ) : (
                    <span className={styles.equalsPlaceholder} aria-hidden="true" />
                  )}
                  <span className={styles.sampleTokens}>
                    <TokenDisplay tokens={line.tokens} />
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {isDebug && selected === null ? (
        <p className={styles.samplePrompt} data-testid="correction-prompt">
          {S.samplePick}
        </p>
      ) : null}

      {isDebug ? (
        selected !== null && state.lines[0] ? (
          <section className={styles.correctionSection} aria-label={S.correctionTitle}>
            <h3 className={styles.sectionTitle}>{S.correctionTitle}</h3>
            <ol className={styles.lines}>
              <LineRow
                line={state.lines[0]}
                lineIndex={sampleCount}
                analysis={correctionAnalysis}
                state={state}
                dispatch={dispatch}
                readOnly={readOnly}
                showCheck
                showRemove={false}
                showLabel={false}
                diagnosis={null}
                cpa={cpa}
              />
            </ol>
          </section>
        ) : null
      ) : (
        <ol className={styles.lines} aria-label={S.canvasLabel}>
          {state.lines.map((line, index) => (
            <LineRow
              key={line.id}
              line={line}
              lineIndex={index}
              analysis={analysis.lines[index]}
              state={state}
              dispatch={dispatch}
              readOnly={readOnly}
              showCheck={index > 0 && state.checkEachLine}
              showRemove
              showLabel={showLabels}
              diagnosis={diagnosis !== null && diagnosis.line === index ? diagnosis : null}
              cpa={cpa}
            />
          ))}
        </ol>
      )}

      <div className={styles.keypad} role="group" aria-label={S.keypadLabel}>
        {keys.map((key) => {
          const isLineKey = key.kind === 'add-line' || key.kind === 'remove-line';
          const disabled =
            readOnly ||
            (key.kind === 'add-line' && isDebug) ||
            (key.kind === 'remove-line' && (isDebug || activeLine === null || activeLine.fixed));
          return (
            <button
              key={`key-${key.testId}`}
              type="button"
              className={`${styles.key} ${isLineKey ? styles.lineKey : ''}`}
              data-testid={`key-${key.testId}`}
              aria-label={keyAria(key)}
              disabled={disabled}
              onClick={() => dispatch(actionFor(key, activeLineId))}
            >
              {keyLabel(key)}
            </button>
          );
        })}
      </div>

      <p className={styles.keyboardHint}>{S.keyboardHint}</p>
    </div>
  );
}
