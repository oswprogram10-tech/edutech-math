/**
 * 세 모드가 함께 쓰는 틀. 왼쪽(또는 위) 판 영역 + 오른쪽(또는 아래) 조작 묶음,
 * 식 입력 칸, 키패드(수·식), 물리 키보드 입력을 맡는다.
 * 규칙 입력의 맞고 틀림은 여기서 알리지 않는다(표의 ✓/✕만 있다).
 */
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode, RefObject } from 'react';
import type { TargetSize } from '../../core/engine-sdk';
import { formatRelation } from '../../core/math';
import { ExprPad, NumberPad } from './Keypad';
import { tryParse } from './relation-check';
import { ruleKey } from './reduce';
import { functionStrings as S } from './strings.ko';
import type { FunctionAction, FunctionState } from './types';
import styles from './View.module.css';

export interface FrameProps {
  readonly state: FunctionState;
  readonly dispatch: (action: FunctionAction) => void;
  readonly targetSize: TargetSize;
  readonly readOnly: boolean;
  readonly instruction: string;
  /** 판 영역(그림·상자·표). */
  readonly board: ReactNode;
  readonly boardRef?: RefObject<HTMLDivElement>;
  readonly boardScroll?: boolean;
  readonly boardTall?: boolean;
  /** 조작 묶음의 모드별 부분(입력 줄·슬라이더·표). */
  readonly side: ReactNode;
  readonly status?: string;
}

const OPERATORS = new Set([...'+−×÷=']);

/** 글자 하나. 연산자·등호는 앞뒤를 띄워 보인다(글자 자체는 그대로, 간격은 CSS). */
function RuleChar({ char }: { readonly char: string }) {
  return OPERATORS.has(char) ? <span className={styles.op}>{char}</span> : <>{char}</>;
}

/**
 * 입력 칸 글자. 시험한 뒤(읽힌 식, 입력이 그대로)에는 formatRelation 결과("□ = ○ + 2")를 보이고,
 * 입력 중에는 연산자 앞뒤를 띄워 보인다. 읽지 못한 자리는 밑줄로 보인다.
 */
function RuleText({ state }: { readonly state: FunctionState }) {
  const text = state.ruleText;
  const tested = state.tested;
  const same = tested !== null && tested.text === text;
  if (same && tested.ok) {
    const parsed = tryParse(text);
    if (parsed.ok) return <>{formatRelation(parsed.rel)}</>;
  }
  const at = same && !tested.ok && tested.errorAt !== null ? tested.errorAt : null;
  if (text === '' && at === null) {
    return <span className={styles.placeholder}>{S.rule.placeholder}</span>;
  }
  const chars = [...text];
  return (
    <>
      {chars.map((char, index) =>
        index === at ? (
          <u key={index} data-testid="rule-error-mark" className={styles.errorMark}>
            <RuleChar char={char} />
          </u>
        ) : (
          <RuleChar key={index} char={char} />
        ),
      )}
      {at !== null && at >= chars.length ? (
        <u data-testid="rule-error-mark" className={styles.errorMark}>
          {' '}
        </u>
      ) : null}
    </>
  );
}

export function Frame({
  state,
  dispatch,
  targetSize,
  readOnly,
  instruction,
  board,
  boardRef,
  boardScroll = false,
  boardTall = false,
  side,
  status = '',
}: FrameProps) {
  const settings = state.settings;
  const target = state.target;
  const showRulePad = settings.ruleInput && target === 'rule';
  const wrongRule =
    state.tested !== null && !state.tested.ok && state.tested.text === state.ruleText;

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (readOnly || event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key;
    const onButton = event.target instanceof HTMLButtonElement;
    if (key === 'Enter') {
      if (onButton) return;
      event.preventDefault();
      event.stopPropagation();
      if (target === 'rule') dispatch({ type: 'test-rule' });
      else if (state.mode === 'black-box') dispatch({ type: 'insert-input' });
      else if (settings.ruleInput) dispatch({ type: 'focus', target: 'rule' });
      return;
    }
    if (key === 'Backspace') {
      event.preventDefault();
      event.stopPropagation();
      dispatch({ type: 'backspace', target });
      return;
    }
    if (key.length !== 1) return;
    if (/^[0-9]$/.test(key)) {
      event.preventDefault();
      event.stopPropagation();
      dispatch({ type: 'type', target, key });
      return;
    }
    if (target !== 'rule') {
      if (key === '/') {
        event.preventDefault();
        event.stopPropagation();
        dispatch({ type: 'type', target, key });
      }
      return;
    }
    const mapped =
      key === 'o' || key === 'O' ? '○' : key === 'b' || key === 'B' ? '□' : ruleKey(key);
    if (mapped !== null) {
      event.preventDefault();
      event.stopPropagation();
      dispatch({ type: 'type', target: 'rule', key: mapped });
    }
  };

  return (
    <div
      className={styles.wrap}
      data-target-size={targetSize}
      data-mode={state.mode}
      onKeyDown={onKeyDown}
    >
      <div className={styles.stageRow}>
        <div
          ref={boardRef}
          className={styles.boardArea}
          data-scroll={boardScroll ? 'true' : 'false'}
          data-tall={boardTall ? 'true' : undefined}
          data-testid="function-board"
        >
          {board}
        </div>
        <div className={styles.sideStack}>
          <p className={styles.instructions}>{instruction}</p>
          {side}
          {settings.ruleInput ? (
            <div className={styles.ruleBlock}>
              <div
                role="textbox"
                aria-readonly="true"
                aria-label={S.rule.fieldLabel}
                tabIndex={readOnly ? -1 : 0}
                className={styles.field}
                data-active={target === 'rule' ? 'true' : undefined}
                data-testid="rule-input"
                onFocus={() => {
                  if (!readOnly && target !== 'rule') dispatch({ type: 'focus', target: 'rule' });
                }}
                onClick={() => {
                  if (!readOnly && target !== 'rule') dispatch({ type: 'focus', target: 'rule' });
                }}
              >
                <RuleText state={state} />
              </div>
              {wrongRule ? (
                <p className={styles.status} role="status" data-testid="rule-recheck">
                  {S.rule.recheck}
                </p>
              ) : null}
            </div>
          ) : null}
          {showRulePad ? (
            <ExprPad
              disabled={readOnly}
              onKey={(key) => dispatch({ type: 'type', target: 'rule', key })}
              onBackspace={() => dispatch({ type: 'backspace', target: 'rule' })}
              onClear={() => dispatch({ type: 'clear', target: 'rule' })}
              onTest={() => dispatch({ type: 'test-rule' })}
            />
          ) : (
            <NumberPad
              disabled={readOnly}
              onKey={(key) => dispatch({ type: 'type', target: 'input', key })}
              onBackspace={() => dispatch({ type: 'backspace', target: 'input' })}
              onDone={
                settings.ruleInput && state.mode !== 'black-box'
                  ? () => dispatch({ type: 'focus', target: 'rule' })
                  : null
              }
            />
          )}
        </div>
      </div>
      <p className={styles.srOnly} aria-live="polite" data-testid="function-live">
        {status}
      </p>
    </div>
  );
}
