/**
 * E18 distortion(그래프 왜곡) 화면: 탭(내 그래프·예시) · 조작 줄 · 막대그래프(SVG) · 기사 제목 줄 · 체크리스트.
 *
 * 체크리스트는 학생이 "문제 있음"으로 고른 항목만 보인다. 맞고 틀림은 화면에 나타내지 않는다.
 */
import { useRef } from 'react';
import type { KeyboardEvent } from 'react';
import type { EngineViewProps } from '../../core/engine-sdk';
import { DistortionCanvas } from './DistortionCanvas';
import { graphStrings as S } from './strings.ko';
import type {
  DistortionControl,
  DistortionState,
  GraphAction,
  GraphConfig,
  GraphState,
} from './types';
import { HEADLINE_MAX } from './types';
import styles from './View.module.css';

type DistortionViewProps = Omit<EngineViewProps<GraphConfig, GraphState, GraphAction>, 'state'> & {
  readonly state: DistortionState;
};

export function DistortionView({
  state,
  dispatch,
  readOnly = false,
  targetSize,
}: DistortionViewProps) {
  const { settings } = state;
  const distortion = settings.distortion;
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  if (distortion === null) return null;

  const unit = settings.valueLabel;
  const examples = distortion.examples;
  const example = state.exampleIndex > 0 ? (examples[state.exampleIndex - 1] ?? null) : null;
  const has = (control: DistortionControl) => distortion.controls.includes(control);

  const moveTab = (event: KeyboardEvent<HTMLDivElement>) => {
    const count = examples.length + 1;
    let target: number | null = null;
    if (event.key === 'ArrowRight') target = (state.exampleIndex + 1) % count;
    else if (event.key === 'ArrowLeft') target = (state.exampleIndex + count - 1) % count;
    else if (event.key === 'Home') target = 0;
    else if (event.key === 'End') target = count - 1;
    if (target === null) return;
    event.preventDefault();
    dispatch({ type: 'show-example', index: target });
    tabRefs.current[target]?.focus();
  };

  const tabLabels = [
    S.distortion.ownTab,
    ...examples.map((_, index) => S.distortion.exampleTab(index + 1)),
  ];
  const tabs =
    examples.length > 0 ? (
      <div
        className={styles.distTabs}
        role="tablist"
        aria-label={S.distortion.tabs}
        data-testid="distortion-tabs"
        onKeyDown={moveTab}
      >
        {tabLabels.map((label, index) => (
          <button
            key={label}
            ref={(node) => {
              tabRefs.current[index] = node;
            }}
            type="button"
            role="tab"
            aria-selected={state.exampleIndex === index}
            tabIndex={state.exampleIndex === index ? 0 : -1}
            className={styles.distTab}
            data-tab={index}
            disabled={readOnly}
            onClick={() => dispatch({ type: 'show-example', index })}
          >
            {label}
          </button>
        ))}
      </div>
    ) : null;

  const controls =
    example === null ? (
      <div className={styles.distControls} data-testid="distortion-controls">
        {has('yStart') ? (
          <div
            className={styles.scaleRow}
            role="radiogroup"
            aria-label={S.distortion.startGroup}
            data-testid="distortion-start-row"
          >
            <span className={styles.rowLabel}>{S.distortion.startGroup}</span>
            {distortion.yStartOptions.map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={state.yStart === option}
                className={styles.button}
                data-y-start={option}
                disabled={readOnly}
                onClick={() => dispatch({ type: 'set-y-start', value: option })}
              >
                {S.distortion.startOption(option)}
              </button>
            ))}
          </div>
        ) : null}
        {has('yStep') ? (
          <div
            className={styles.scaleRow}
            role="radiogroup"
            aria-label={S.distortion.stepGroup}
            data-testid="distortion-step-row"
          >
            <span className={styles.rowLabel}>{S.distortion.stepGroup}</span>
            {distortion.yStepOptions.map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={state.yStep === option}
                className={styles.button}
                data-y-step={option}
                disabled={readOnly}
                onClick={() => dispatch({ type: 'set-y-step', value: option })}
              >
                {S.distortion.stepOption(option, unit)}
              </button>
            ))}
          </div>
        ) : null}
        <div className={styles.scaleRow}>
          {has('wavyLine') ? (
            <button
              type="button"
              role="switch"
              aria-checked={state.wavy}
              aria-label={S.distortion.wavyAria}
              className={styles.button}
              data-testid="distortion-wavy-toggle"
              disabled={readOnly}
              onClick={() => dispatch({ type: 'toggle-wavy' })}
            >
              {S.distortion.wavy}
            </button>
          ) : null}
          {has('groupItems')
            ? distortion.groupOptions.map((group) => (
                <button
                  key={group.label}
                  type="button"
                  role="switch"
                  aria-checked={state.groups.includes(group.label)}
                  className={styles.button}
                  data-group={group.label}
                  disabled={readOnly}
                  onClick={() => dispatch({ type: 'toggle-group', label: group.label })}
                >
                  {S.distortion.groupOption(group.label)}
                </button>
              ))
            : null}
          <button
            type="button"
            className={styles.button}
            data-testid="graph-reset"
            disabled={readOnly}
            onClick={() => dispatch({ type: 'reset-graph' })}
          >
            {S.distortion.reset}
          </button>
        </div>
      </div>
    ) : null;

  const marked = example === null ? [] : (state.exampleMarks[example.id] ?? []);
  const checklist =
    example !== null ? (
      <fieldset className={styles.checklist} data-testid="distortion-checklist" disabled={readOnly}>
        <legend>{S.distortion.checklistLabel}</legend>
        {distortion.checklist.map((item) => (
          <label key={item} className={styles.checkItem} data-item={item}>
            <input
              type="checkbox"
              className={styles.checkBox}
              checked={marked.includes(item)}
              aria-label={S.distortion.problemAria(S.distortion.items[item])}
              onChange={() => dispatch({ type: 'toggle-example-mark', example: example.id, item })}
            />
            <span className={styles.checkText}>{S.distortion.items[item]}</span>
            <span className={styles.checkTag}>{S.distortion.problem}</span>
          </label>
        ))}
      </fieldset>
    ) : null;

  const headline =
    example === null && distortion.headlineCards.length > 0 ? (
      <div className={styles.headline} data-testid="distortion-headline">
        <div className={styles.headlineText} role="status" aria-label={S.distortion.headlineLabel}>
          <span className={styles.rowLabel}>{S.distortion.headlineLabel}</span>
          <span data-testid="headline-text">
            {state.headline.length > 0 ? state.headline.join(' ') : S.distortion.headlineEmpty}
          </span>
        </div>
        <div
          className={styles.scaleRow}
          role="group"
          aria-label={S.distortion.headlineCards}
          data-testid="headline-cards"
        >
          {distortion.headlineCards.map((card) => (
            <button
              key={card}
              type="button"
              className={styles.button}
              data-card={card}
              disabled={readOnly || state.headline.length >= HEADLINE_MAX}
              onClick={() => dispatch({ type: 'add-headline', card })}
            >
              {card}
            </button>
          ))}
          <button
            type="button"
            className={styles.button}
            data-testid="headline-clear"
            disabled={readOnly || state.headline.length === 0}
            onClick={() => dispatch({ type: 'clear-headline' })}
          >
            {S.distortion.headlineClear}
          </button>
        </div>
      </div>
    ) : null;

  return (
    <div
      className={styles.wrap}
      data-target-size={targetSize}
      data-mode="distortion"
      data-example-index={state.exampleIndex}
    >
      {tabs}
      {controls}
      <div className={styles.distBody} data-example={example === null ? undefined : 'true'}>
        <div className={styles.distBoard}>
          <div className={styles.boardArea}>
            <DistortionCanvas state={state} targetSize={targetSize} />
          </div>
          {example !== null && example.grouped !== '' ? (
            <p className={styles.distNote} data-testid="distortion-grouped">
              {example.grouped}
            </p>
          ) : null}
        </div>
        {checklist}
      </div>
      {headline}
    </div>
  );
}
