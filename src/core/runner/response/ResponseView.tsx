/**
 * 응답 슬롯 화면.
 *
 * 한 과제에 여러 필드가 있을 수 있다(예: 분수와 소수를 따로 쓰기). 필드 순서는
 * 콘텐츠에 적힌 순서 그대로다. 제출 전에도 제출 뒤에도 맞고 틀림을 표시하지 않는다.
 */
import { useState } from 'react';
import type { EngineId, EngineViewProps, LoadedEngine } from '../../engine-sdk';
import type { ResponseAction, ResponseConfig, ResponseState } from './types';
import { ChoiceWidget } from './widgets/ChoiceWidget';
import { CompareWidget } from './widgets/CompareWidget';
import { NumberKeypad, NumberWidget } from './widgets/NumberWidget';
import { OrderWidget } from './widgets/OrderWidget';
import { SortWidget } from './widgets/SortWidget';
import { responseStrings as S } from './strings.ko';
import styles from './ResponseView.module.css';

export type ResponseViewProps = EngineViewProps<ResponseConfig, ResponseState, ResponseAction> & {
  /** 그림 선택지를 그릴 때 쓰는 엔진 정의. 실행기가 넘긴다. */
  readonly definitions?: ReadonlyMap<EngineId, LoadedEngine>;
};

export function ResponseView({
  config,
  state,
  dispatch,
  readOnly = false,
  targetSize,
  definitions,
}: ResponseViewProps) {
  // 수 필드가 둘 이상이면 키패드를 하나만 두고, 마지막으로 누른 필드에 입력한다.
  // 필드마다 키패드를 붙이면 작은 판에서 아래 필드가 잘린다.
  const numberIds = config.fields
    .filter((field) => field.kind === 'number')
    .map((field) => field.id);
  const multiNumber = numberIds.length > 1;
  const [activeNumber, setActiveNumber] = useState<string | null>(null);
  const keypadTarget =
    activeNumber !== null && numberIds.includes(activeNumber) ? activeNumber : numberIds[0];

  return (
    <div
      className={styles.response}
      data-testid="response"
      data-multi-number={multiNumber ? 'true' : undefined}
      aria-label={S.name}
    >
      {config.fields.map((field, index) => {
        const fieldState = state.fields[field.id];
        if (!fieldState) return null;
        const label = S.fieldLabel(field.label, index);
        let widget = null;
        switch (field.kind) {
          case 'number':
            if (fieldState.kind === 'number') {
              widget = (
                <NumberWidget
                  field={field}
                  state={fieldState}
                  dispatch={dispatch}
                  readOnly={readOnly}
                  targetSize={targetSize}
                  definitions={definitions}
                  showKeypad={!multiNumber}
                  onActivate={() => setActiveNumber(field.id)}
                />
              );
            }
            break;
          case 'choice':
            if (fieldState.kind === 'choice') {
              widget = (
                <ChoiceWidget
                  field={field}
                  state={fieldState}
                  dispatch={dispatch}
                  readOnly={readOnly}
                  targetSize={targetSize}
                  definitions={definitions}
                />
              );
            }
            break;
          case 'order':
            if (fieldState.kind === 'order') {
              widget = (
                <OrderWidget
                  field={field}
                  state={fieldState}
                  dispatch={dispatch}
                  readOnly={readOnly}
                  targetSize={targetSize}
                  definitions={definitions}
                />
              );
            }
            break;
          case 'compare':
            if (fieldState.kind === 'compare') {
              widget = (
                <CompareWidget
                  field={field}
                  state={fieldState}
                  dispatch={dispatch}
                  readOnly={readOnly}
                  targetSize={targetSize}
                />
              );
            }
            break;
          case 'sort':
            if (fieldState.kind === 'sort') {
              widget = (
                <SortWidget
                  field={field}
                  state={fieldState}
                  dispatch={dispatch}
                  readOnly={readOnly}
                  targetSize={targetSize}
                />
              );
            }
            break;
        }
        return (
          <section key={field.id} className={styles.field} data-response-label={label}>
            <h4 className={styles.fieldTitle}>{label}</h4>
            {widget}
          </section>
        );
      })}
      {multiNumber && keypadTarget ? (
        <NumberKeypad
          fieldId={keypadTarget}
          dispatch={dispatch}
          readOnly={readOnly}
          targetSize={targetSize}
        />
      ) : null}
    </div>
  );
}
