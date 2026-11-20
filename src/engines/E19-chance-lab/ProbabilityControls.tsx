/**
 * E19 가능성 모드(words·spinner·simulate) 조작 칸(SVG 밖). 모든 조작에 48px 이상 단추가 있다.
 * 장치 편집(회전판 칸·주머니 구슬)은 spinner·simulate가 함께 쓴다.
 */
import { Btn } from './Btn';
import { DeviceFigure } from './DeviceFigure';
import { outcomeName, usePatternPrefix } from './outcome';
import { PatternDefs, Swatch } from './PatternDefs';
import { E19_STRINGS as S } from './strings.ko';
import { OUTCOMES } from './types';
import type { Device, Outcome, SimulateState, SpinnerState, WordsState } from './types';
import type { ChanceUi } from './useChanceUi';
import styles from './View.module.css';

interface Props<T> {
  readonly state: T;
  readonly ui: ChanceUi;
  readonly readOnly: boolean;
}

/** 칸을 더할 때 아직 안 쓴 색을 먼저 고른다(모두 쓰고 있으면 고른 칸 다음 색). */
function colorToAdd(device: Device, selected: Outcome): Outcome {
  if (device.type !== 'spinner') return nextColor(selected);
  return OUTCOMES.find((c) => !device.sectors.some((s) => s.color === c)) ?? nextColor(selected);
}

function nextColor(color: Outcome): Outcome {
  const index = OUTCOMES.indexOf(color);
  return OUTCOMES[(index + 1) % OUTCOMES.length] ?? 'red';
}

export function WordsControls({ state, ui, readOnly }: Props<WordsState>) {
  const placed = state.cards.filter((c) => state.placements[c.id] !== null).length;
  const B = S.words.buttons;
  return (
    <div className={styles.sideStack} data-testid="chance-controls">
      <p className={styles.instructions}>{S.words.instructions}</p>
      <p className={styles.made} data-testid="chance-placed">
        {S.words.placedText(placed, state.cards.length)}
      </p>
      <div className={styles.row} role="group" aria-label={S.controlsLabel}>
        <Btn
          label={B.prevCard}
          action="prev-card"
          disabled={readOnly}
          onClick={() => ui.moveWordsCard(-1)}
        />
        <Btn
          label={B.nextCard}
          action="next-card"
          disabled={readOnly}
          onClick={() => ui.moveWordsCard(1)}
        />
        <Btn
          label={B.prevSlot}
          action="prev-slot"
          disabled={readOnly}
          onClick={() => ui.moveWordsSlot(-1)}
        />
        <Btn
          label={B.nextSlot}
          action="next-slot"
          disabled={readOnly}
          onClick={() => ui.moveWordsSlot(1)}
        />
        <Btn label={B.place} action="place" primary disabled={readOnly} onClick={ui.placeWords} />
        <Btn label={B.unplace} action="unplace" disabled={readOnly} onClick={ui.unplaceWords} />
        <Btn
          label={B.reset}
          action="reset"
          disabled={readOnly}
          onClick={() => ui.send({ type: 'reset' })}
        />
      </div>
      <p className={styles.status} role="status" data-testid="chance-message">
        {ui.message ?? ''}
      </p>
    </div>
  );
}

function DeviceEditor({ state, ui, readOnly }: Props<SpinnerState | SimulateState>) {
  const device = state.device;
  const disabled = readOnly || !state.editable;
  const B = S.device.buttons;
  if (device.type === 'bag') {
    return (
      <div className={styles.group} role="group" aria-label={S.device.bagLabel}>
        {OUTCOMES.map((color) => {
          const count = device.marbles.find((m) => m.color === color)?.count ?? 0;
          const name = outcomeName(color);
          return (
            <div key={color} className={styles.deviceRow} data-color={color}>
              <Swatch outcome={color} />
              <span className={styles.deviceName}>{name}</span>
              <Btn
                label={B.less(name)}
                action={`marble-less-${color}`}
                disabled={disabled}
                onClick={() => ui.send({ type: 'marble-set', color, count: count - 1 })}
              />
              <span className={styles.deviceCount} data-testid={`marble-count-${color}`}>
                {count}
              </span>
              <Btn
                label={B.more(name)}
                action={`marble-more-${color}`}
                disabled={disabled}
                onClick={() => ui.send({ type: 'marble-set', color, count: count + 1 })}
              />
            </div>
          );
        })}
      </div>
    );
  }
  const index = ui.selectedSector;
  const sector = device.sectors[index];
  return (
    <div className={styles.group} role="group" aria-label={S.device.spinnerLabel}>
      <p className={styles.made} data-testid="sector-selected">
        {sector === undefined
          ? ''
          : S.device.sectorLabel(index + 1, outcomeName(sector.color), sector.size)}
      </p>
      <div className={styles.row}>
        <Btn label={B.prevSector} action="sector-prev" onClick={() => ui.moveSector(-1)} />
        <Btn label={B.nextSector} action="sector-next" onClick={() => ui.moveSector(1)} />
        <Btn
          label={B.recolor}
          action="sector-recolor"
          disabled={disabled || sector === undefined}
          onClick={() =>
            sector !== undefined &&
            ui.send({ type: 'sector-color', index, color: nextColor(sector.color) })
          }
        />
        <Btn
          label={B.smaller}
          action="sector-smaller"
          disabled={disabled || sector === undefined}
          onClick={() =>
            sector !== undefined && ui.send({ type: 'sector-size', index, size: sector.size - 1 })
          }
        />
        <Btn
          label={B.bigger}
          action="sector-bigger"
          disabled={disabled || sector === undefined}
          onClick={() =>
            sector !== undefined && ui.send({ type: 'sector-size', index, size: sector.size + 1 })
          }
        />
        <Btn
          label={B.addSector}
          action="sector-add"
          disabled={disabled}
          onClick={() =>
            ui.send({ type: 'sector-add', color: colorToAdd(device, sector?.color ?? 'red') })
          }
        />
        <Btn
          label={B.removeSector}
          action="sector-remove"
          disabled={disabled}
          onClick={() => ui.send({ type: 'sector-remove', index })}
        />
      </div>
    </div>
  );
}

export function SpinnerControls({ state, ui, readOnly }: Props<SpinnerState>) {
  const bag = state.device.type === 'bag';
  return (
    <div className={styles.sideStack} data-testid="chance-controls">
      <p className={styles.instructions}>{S.spinner.instructions}</p>
      <p className={styles.made} data-testid="chance-trials">
        {S.spinner.trialsText(state.trials)}
      </p>
      <div className={styles.row} role="group" aria-label={S.controlsLabel}>
        <Btn
          label={bag ? S.spinner.bagSpin : S.spinner.spin}
          action="spin"
          primary
          disabled={readOnly}
          onClick={ui.spin}
        />
        <Btn
          label={S.spinner.reset}
          action="reset"
          disabled={readOnly}
          onClick={() => ui.send({ type: 'reset' })}
        />
      </div>
      <DeviceEditor state={state} ui={ui} readOnly={readOnly} />
      <p className={styles.status} role="status" data-testid="chance-message">
        {ui.message ?? ''}
      </p>
    </div>
  );
}

export function SimulateControls({ state, ui, readOnly }: Props<SimulateState>) {
  const prefix = usePatternPrefix('sim');
  const bag = state.device.type === 'bag';
  return (
    <div className={styles.sideStack} data-testid="chance-controls">
      <p className={styles.instructions}>{S.simulate.instructions}</p>
      <svg
        className={styles.miniDevice}
        viewBox="0 0 160 130"
        role="img"
        aria-label={bag ? S.device.bagLabel : S.device.spinnerLabel}
        data-testid="chance-mini-device"
      >
        <PatternDefs prefix={prefix} />
        <DeviceFigure
          device={state.device}
          cx={80}
          cy={bag ? 62 : 65}
          r={bag ? 52 : 58}
          prefix={prefix}
          selected={state.device.type === 'spinner' ? ui.selectedSector : null}
          onSelect={state.editable && !readOnly ? ui.selectSector : undefined}
          fontSize={14}
        />
      </svg>
      <div className={styles.row} role="group" aria-label={S.controlsLabel}>
        {state.batches.map((batch) => (
          <Btn
            key={batch}
            label={S.simulate.runButton(batch)}
            action={`run-${batch}`}
            primary
            disabled={readOnly}
            onClick={() => ui.run(batch)}
          />
        ))}
        <Btn
          label={S.simulate.clear}
          action="clear"
          disabled={readOnly}
          onClick={() => ui.send({ type: 'clear' })}
        />
        <Btn
          label={S.simulate.reset}
          action="reset"
          disabled={readOnly}
          onClick={() => ui.send({ type: 'reset' })}
        />
      </div>
      <DeviceEditor state={state} ui={ui} readOnly={readOnly} />
      <p className={styles.status} role="status" data-testid="chance-message">
        {ui.message ?? ''}
      </p>
    </div>
  );
}
