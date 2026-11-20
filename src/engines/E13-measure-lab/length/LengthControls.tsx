/**
 * E13 length 조작 칸(SVG 밖). 단위 상자(트레이)·숫자 카드는 끌어 놓거나 눌러서 놓는다.
 * 모든 조작에 단추나 키보드 대체가 있다. 물건의 길이를 글로 알려 주지 않는다.
 */
import type { RefObject } from 'react';
import { Btn } from '../Btn';
import { num } from '../rat';
import { E13_STRINGS as S } from '../strings.ko';
import { unitOf } from '../units';
import styles from '../View.module.css';
import { TICK_COUNT, geoOf } from './layout';
import { rulerReady } from './settings';
import { TrayButton } from './TrayButton';
import type { MeasureState } from './types';
import type { LengthUi } from './useLengthUi';

export interface LengthControlsProps {
  readonly svgRef: RefObject<SVGSVGElement>;
  readonly state: MeasureState;
  readonly ui: LengthUi;
  readonly readOnly: boolean;
}

export function LengthControls({ svgRef, state, ui, readOnly }: LengthControlsProps) {
  const geo = geoOf(state);
  const lockedPieces = readOnly || state.rulerMade;
  return (
    <div className={styles.sideStack} data-testid="measure-controls">
      <p className={styles.instructions}>{S.length.instructions}</p>
      <p className={styles.status} role="status" data-testid="measure-message">
        {ui.message ?? ''}
      </p>
      <div className={styles.group}>
        <p className={styles.caption}>{S.length.trayCaption}</p>
        <div className={styles.tray} role="group" aria-label={S.length.trayCaption}>
          {state.units.map((id) => {
            const def = unitOf(id);
            const name = S.length.unitNames[id] ?? id;
            return (
              <TrayButton
                key={id}
                svgRef={svgRef}
                label={S.length.trayButton(name)}
                action={`unit:${id}`}
                disabled={lockedPieces}
                onTap={() => ui.addAtEnd(id)}
                onDrop={(point) => ui.dropUnit(id, point)}
                onGhost={(point) =>
                  ui.setGhost(point ? { kind: 'unit', unit: id, x: point.x, y: point.y } : null)
                }
              >
                <span
                  className={styles.swatch}
                  aria-hidden="true"
                  style={{
                    width: `${Math.max(14, Math.min(60, num(def?.cm ?? '1') * geo.ppc * 0.5))}px`,
                    background: def?.fill,
                    color: def?.stroke,
                  }}
                />
                {name}
              </TrayButton>
            );
          })}
        </div>
      </div>
      <div className={styles.row} role="group" aria-label={S.controlsLabel}>
        <Btn
          label={S.length.removeLast}
          action="remove-last"
          disabled={lockedPieces || state.pieces.length === 0}
          onClick={ui.removeLast}
        />
        {state.buildRuler ? (
          <Btn
            label={S.length.makeRuler}
            action="make-ruler"
            primary
            disabled={readOnly || state.rulerMade || !rulerReady(state)}
            onClick={() => ui.send({ type: 'make-ruler' })}
          />
        ) : null}
        <Btn
          label={S.reset}
          action="reset"
          disabled={readOnly}
          onClick={() => ui.send({ type: 'reset' })}
        />
      </div>
      {state.buildRuler && !state.rulerMade ? (
        <p className={styles.instructions}>{S.length.rulerHint}</p>
      ) : null}
      {state.rulerMade ? (
        <div className={styles.group}>
          <p className={styles.instructions}>{S.length.rulerMadeNote}</p>
          <p className={styles.caption}>
            {S.length.cardTray}
            {ui.card === null ? '' : ` · ${S.length.selectedCard(ui.card)}`}
          </p>
          <div className={styles.tray} role="group" aria-label={S.length.cardTray}>
            {Array.from({ length: TICK_COUNT }, (_, value) => (
              <TrayButton
                key={value}
                svgRef={svgRef}
                label={S.length.cardButton(value)}
                action={`card:${value}`}
                disabled={readOnly}
                pressed={ui.card === value}
                onTap={() => ui.selectCard(value)}
                onDrop={(point) => ui.dropCard(value, point)}
                onGhost={(point) =>
                  ui.setGhost(point ? { kind: 'card', value, x: point.x, y: point.y } : null)
                }
              >
                {value}
              </TrayButton>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
