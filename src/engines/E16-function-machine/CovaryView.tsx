/**
 * covary 모드 화면: 슬라이더로 ○를 바꾸면 그림과 □가 함께 변하고 대응표가 채워진다.
 * 빈칸 줄(`blankRows`)에서는 장면 아래 □ 글자를 쓰지 않는다(그림은 그대로 그린다).
 */
import { useRef } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import type { EngineViewProps, TargetSize } from '../../core/engine-sdk';
import { Rational } from '../../core/math';
import { Frame } from './Frame';
import { RelationTable } from './RelationTable';
import { columnsOf, hiddenOf, safeSolve, visibleMarks } from './relation-check';
import { buildScene } from './scenes';
import { functionStrings as S } from './strings.ko';
import type { CovaryState, FunctionAction, FunctionConfig } from './types';
import styles from './View.module.css';

type CovaryViewProps = Omit<
  EngineViewProps<FunctionConfig, CovaryState, FunctionAction>,
  'state'
> & {
  readonly state: CovaryState;
};

interface SliderProps {
  readonly min: number;
  readonly max: number;
  readonly value: number;
  readonly targetSize: TargetSize;
  readonly readOnly: boolean;
  readonly onChange: (value: number) => void;
}

/** ←/→/Home/End와 끌기(Pointer Events)를 받는 슬라이더. 손잡이는 targetSize 이상이다. */
function Slider({ min, max, value, targetSize, readOnly, onChange }: SliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const ratio = max > min ? (value - min) / (max - min) : 0;

  const fromPointer = (clientX: number) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const span = rect.width - targetSize;
    if (span <= 0) return;
    const r = Math.min(1, Math.max(0, (clientX - rect.left - targetSize / 2) / span));
    onChange(Math.round(min + r * (max - min)));
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (readOnly) return;
    let next: number | null = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next = value + 1;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next = value - 1;
    else if (event.key === 'Home') next = min;
    else if (event.key === 'End') next = max;
    if (next === null) return;
    event.preventDefault();
    event.stopPropagation();
    onChange(Math.min(max, Math.max(min, next)));
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (readOnly) return;
    dragging.current = true;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    fromPointer(event.clientX);
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragging.current) fromPointer(event.clientX);
  };
  const stopDrag = () => {
    dragging.current = false;
  };

  return (
    <div
      ref={trackRef}
      className={styles.sliderTrack}
      data-testid="covary-slider"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={stopDrag}
      onPointerCancel={stopDrag}
    >
      <div className={styles.sliderRail} aria-hidden="true" />
      <div
        role="slider"
        tabIndex={readOnly ? -1 : 0}
        aria-label={S.covary.sliderLabel}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={S.covary.sliderValue(String(value))}
        aria-orientation="horizontal"
        className={styles.sliderKnob}
        data-testid="covary-knob"
        style={{ left: `calc((100% - ${targetSize}px) * ${ratio})` }}
        onKeyDown={onKeyDown}
      >
        {value}
      </div>
    </div>
  );
}

export function CovaryView({ state, dispatch, targetSize, readOnly = false }: CovaryViewProps) {
  const { settings } = state;
  const columns = columnsOf(state);
  const x = Number(state.x);
  const blank = settings.blankRows.includes(x);
  const hidden = hiddenOf(settings.rule);
  const y = hidden === null ? null : safeSolve(hidden, Rational.of(x));
  const dotCount = y !== null && y.isInteger() ? Number(y.integerPart()) : null;
  const scene = buildScene(settings.scene, settings.look, x, dotCount);
  const readout =
    blank || y === null ? S.covary.valueOnly(state.x) : S.covary.valueBoth(state.x, y.toString());

  const board = (
    <>
      {settings.look === 'none' ? null : (
        <svg
          data-testid="scene-canvas"
          className={styles.figureSvg}
          viewBox={`0 0 ${scene.width} ${scene.height}`}
          role="img"
          aria-label={S.scenes[settings.scene] ?? S.covary.sceneLabel}
        >
          <title>{S.scenes[settings.scene] ?? S.covary.sceneLabel}</title>
          <rect x={0} y={0} width={scene.width} height={scene.height} fill="#fbfaf6" />
          {scene.node}
        </svg>
      )}
      <p className={styles.readout} data-testid="scene-readout">
        {readout}
      </p>
    </>
  );

  const side = (
    <>
      <Slider
        min={settings.xMin}
        max={settings.xMax}
        value={x}
        targetSize={targetSize}
        readOnly={readOnly}
        onChange={(value) => dispatch({ type: 'set-x', x: String(value) })}
      />
      <RelationTable
        columns={columns}
        xLabel={settings.xLabel}
        yLabel={settings.yLabel}
        active={state.active}
        highlight={state.x}
        holds={visibleMarks(state, columns)}
        readOnly={readOnly}
        scale={1}
        onActivate={(cell) => dispatch({ type: 'activate', cell })}
      />
    </>
  );

  return (
    <Frame
      state={state}
      dispatch={dispatch}
      targetSize={targetSize}
      readOnly={readOnly}
      instruction={S.covary.instructions}
      board={board}
      side={side}
      status={readout}
    />
  );
}
