/** 고르기 위젯. 선택지는 콘텐츠 순서 그대로 두고, 고른 상태를 체크 표시로도 보여 준다. */
import type { EngineId, LoadedEngine, TargetSize } from '../../../engine-sdk';
import type { ChoiceField, ChoiceFieldState, ResponseAction } from '../types';
import { FigureView } from '../FigureView';
import { responseStrings as S } from '../strings.ko';
import styles from '../ResponseView.module.css';

interface ChoiceWidgetProps {
  readonly field: ChoiceField;
  readonly state: ChoiceFieldState;
  readonly dispatch: (action: ResponseAction) => void;
  readonly readOnly: boolean;
  readonly targetSize: TargetSize;
  readonly definitions?: ReadonlyMap<EngineId, LoadedEngine>;
}

export function ChoiceWidget({
  field,
  state,
  dispatch,
  readOnly,
  targetSize,
  definitions,
}: ChoiceWidgetProps) {
  return (
    <div
      className={styles.choice}
      role="group"
      aria-label={S.choiceGroup}
      data-response-kind="choice"
      data-response-field={field.id}
    >
      {field.options.map((option, index) => {
        const selected = state.selected.includes(option.id);
        const label = option.label ?? S.choiceOption(index);
        return (
          <button
            key={option.id}
            type="button"
            className={`${styles.option} ${selected ? styles.optionSelected : ''}`}
            style={{ minHeight: targetSize }}
            aria-pressed={selected}
            aria-label={label}
            data-option-id={option.id}
            disabled={readOnly}
            onClick={() => dispatch({ type: 'choice-toggle', field: field.id, option: option.id })}
          >
            {option.figure ? <FigureView figure={option.figure} definitions={definitions} /> : null}
            <span className={styles.optionLabel}>{label}</span>
            {selected ? (
              <span className={styles.check} aria-hidden="true">
                ✓
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
