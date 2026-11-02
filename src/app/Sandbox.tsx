/**
 * 엔진 샌드박스(E2E·교사 시연용).
 * URL 해시 `#/sandbox/E00`으로 열린다. 학생 메뉴에는 노출하지 않는다.
 * 나중에 T007 교사 시연 모드가 이 화면을 대체·확장한다.
 */
import { useEffect, useMemo, useState } from 'react';
import { OverlayLayer, loadEngine, useHistory, usePinch } from '../core/engine-sdk';
import type { EngineId, LoadedEngine, TargetSize } from '../core/engine-sdk';
import { sandboxStrings } from './strings.ko';
import styles from './Sandbox.module.css';

interface EngineSandboxProps {
  definition: LoadedEngine;
}

function EngineSandbox({ definition }: EngineSandboxProps) {
  const config = useMemo(() => ({}) as never, []);
  const initial = useMemo(() => definition.createInitialState(config), [definition, config]);
  const { state, dispatch, undo, redo, canUndo, canRedo } = useHistory(definition.reduce, initial);
  const pinch = usePinch({ initialScale: 1, min: 1, max: 2, step: 0.25 });
  const [targetSize, setTargetSize] = useState<TargetSize>(48);
  const [readOnly, setReadOnly] = useState(false);
  const [overlay, setOverlay] = useState<string | null>(null);

  const overlayNames = Object.keys(definition.overlays ?? {});
  const mode = definition.modes[0] ?? 'default';
  const observation = definition.observe(state, config);
  const View = definition.View;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
      ) {
        return;
      }
      const modifier = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      if (modifier && key === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (modifier && key === 'y') {
        event.preventDefault();
        redo();
      } else if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        pinch.zoomIn();
      } else if (event.key === '-' || event.key === '_') {
        event.preventDefault();
        pinch.zoomOut();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, redo, pinch]);

  return (
    <main className={styles.sandbox}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{definition.name}</h1>
          <p className={styles.meta}>
            {sandboxStrings.engineLabel} {definition.id} · {sandboxStrings.modeLabel} {mode}
          </p>
        </div>
        <a className={styles.back} href="#">
          {sandboxStrings.back}
        </a>
      </header>

      <div className={styles.controls} role="toolbar" aria-label={sandboxStrings.controls}>
        <button type="button" onClick={undo} disabled={!canUndo}>
          {sandboxStrings.undo}
        </button>
        <button type="button" onClick={redo} disabled={!canRedo}>
          {sandboxStrings.redo}
        </button>
        <button type="button" onClick={pinch.zoomOut} disabled={!pinch.canZoomOut}>
          {sandboxStrings.zoomOut}
        </button>
        <span className={styles.scale} aria-live="polite">
          {Math.round(pinch.scale * 100)}%
        </span>
        <button type="button" onClick={pinch.zoomIn} disabled={!pinch.canZoomIn}>
          {sandboxStrings.zoomIn}
        </button>
        <button
          type="button"
          aria-pressed={targetSize === 64}
          onClick={() => setTargetSize((current) => (current === 48 ? 64 : 48))}
        >
          {targetSize === 64 ? sandboxStrings.target64 : sandboxStrings.target48}
        </button>
        <button
          type="button"
          aria-pressed={readOnly}
          onClick={() => setReadOnly((current) => !current)}
        >
          {sandboxStrings.readOnly}
        </button>
        {overlayNames.length > 0 ? (
          <button
            type="button"
            aria-pressed={overlay !== null}
            onClick={() => setOverlay((current) => (current ? null : (overlayNames[0] ?? null)))}
          >
            {sandboxStrings.overlay}
          </button>
        ) : null}
      </div>

      <div className={styles.stage} {...pinch.handlers}>
        <View
          config={config}
          state={state}
          dispatch={dispatch}
          cpa="C"
          mode={mode}
          readOnly={readOnly}
          scale={pinch.scale}
          targetSize={targetSize}
        />
        {overlay ? (
          <OverlayLayer
            definition={definition}
            overlay={overlay}
            config={config}
            state={state}
            scale={pinch.scale}
          />
        ) : null}
      </div>

      <section className={styles.observationBox}>
        <h2 className={styles.observationTitle}>{sandboxStrings.observation}</h2>
        <output className={styles.observation} data-testid="observation" aria-live="polite">
          {JSON.stringify(observation)}
        </output>
      </section>
    </main>
  );
}

interface SandboxProps {
  engineId: EngineId;
}

export function Sandbox({ engineId }: SandboxProps) {
  const [definition, setDefinition] = useState<LoadedEngine | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadEngine(engineId)
      .then((loaded) => {
        if (!cancelled) setDefinition(loaded);
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : String(reason));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [engineId]);

  if (error) {
    return (
      <main className={styles.sandbox}>
        <p role="alert">{sandboxStrings.loadError}</p>
        <p className={styles.meta}>{error}</p>
        <a href="#">{sandboxStrings.back}</a>
      </main>
    );
  }

  if (!definition) {
    return (
      <main className={styles.sandbox}>
        <p role="status">{sandboxStrings.loading}</p>
      </main>
    );
  }

  return <EngineSandbox key={definition.id} definition={definition} />;
}
