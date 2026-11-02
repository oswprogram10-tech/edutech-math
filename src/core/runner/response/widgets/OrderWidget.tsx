/**
 * 순서 정하기 위젯.
 * 위/아래 버튼과 끌기(Pointer Events)를 모두 지원한다. 키보드만으로도 끝낼 수 있다.
 */
import { useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { EngineId, LoadedEngine, TargetSize } from '../../../engine-sdk';
import type { OrderField, OrderFieldState, ResponseAction } from '../types';
import { FigureView } from '../FigureView';
import { responseStrings as S } from '../strings.ko';
import styles from '../ResponseView.module.css';

interface OrderWidgetProps {
  readonly field: OrderField;
  readonly state: OrderFieldState;
  readonly dispatch: (action: ResponseAction) => void;
  readonly readOnly: boolean;
  readonly targetSize: TargetSize;
  readonly definitions?: ReadonlyMap<EngineId, LoadedEngine>;
}

export function OrderWidget({
  field,
  state,
  dispatch,
  readOnly,
  targetSize,
  definitions,
}: OrderWidgetProps) {
  const dragging = useRef<string | null>(null);
  const itemById = new Map(field.items.map((item) => [item.id, item]));

  const onPointerDown = (event: ReactPointerEvent<HTMLLIElement>, id: string) => {
    if (readOnly) return;
    if ((event.target as HTMLElement).closest('button')) return;
    dragging.current = id;
  };

  const onPointerUp = (id: string) => {
    const from = dragging.current;
    dragging.current = null;
    if (!from || from === id) return;
    dispatch({
      type: 'order-reorder',
      field: field.id,
      item: from,
      toIndex: state.order.indexOf(id),
    });
  };

  return (
    <ol
      className={styles.order}
      aria-label={S.orderGroup}
      data-response-kind="order"
      data-response-field={field.id}
    >
      {state.order.map((id, index) => {
        const item = itemById.get(id);
        const label = item?.label ?? S.orderItem(index);
        return (
          <li
            key={id}
            className={styles.orderItem}
            data-order-id={id}
            onPointerDown={(event) => onPointerDown(event, id)}
            onPointerUp={() => onPointerUp(id)}
            onPointerCancel={() => {
              dragging.current = null;
            }}
          >
            <span className={styles.orderIndex} aria-hidden="true">
              {index + 1}
            </span>
            <span className={styles.orderContent}>
              {item?.figure ? <FigureView figure={item.figure} definitions={definitions} /> : null}
              <span>{label}</span>
            </span>
            <span className={styles.orderButtons}>
              <button
                type="button"
                style={{ minWidth: targetSize, minHeight: targetSize }}
                aria-label={`${label} ${S.orderUp}`}
                disabled={readOnly || index === 0}
                onClick={() => dispatch({ type: 'order-up', field: field.id, item: id })}
              >
                <span aria-hidden="true">↑</span>
              </button>
              <button
                type="button"
                style={{ minWidth: targetSize, minHeight: targetSize }}
                aria-label={`${label} ${S.orderDown}`}
                disabled={readOnly || index === state.order.length - 1}
                onClick={() => dispatch({ type: 'order-down', field: field.id, item: id })}
              >
                <span aria-hidden="true">↓</span>
              </button>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
