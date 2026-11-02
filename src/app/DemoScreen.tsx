/**
 * `#/demo` — S4 교사 시연 모드(전자칠판).
 *
 * - 엔진/과제에서 교구를 골라 채점 없이 자유 조작한다.
 * - 펜 주석은 화면 상태로만 두고 저장하지 않는다.
 * - 되감기는 Action 목록을 처음부터 재생한다.
 * - 2분할은 공유 코드 두 개를 읽기 전용으로 나란히 보여 준다(학생 번호 없음).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentType } from 'react';
import { createHistory, listEngineIds, loadEngine } from '../core/engine-sdk';
import type { CPA, EngineId, LoadedEngine } from '../core/engine-sdk';
import {
  applyActionWithLinks,
  applyControl,
  contentUnitIds,
  createSharePayload,
  createSlotHistories,
  decodeSharePayload,
  encodeSharePayload,
  loadUnitContent,
  replayShare,
  ShareDialog,
} from '../core/runner';
import type {
  ContentTask,
  ShareAction,
  ShareLink,
  ShareView,
  SlotControl,
  SlotHistories,
  SlotView,
  UnitContent,
} from '../core/runner';
import { shareHash } from '../core/storage';
import { toJsonValue } from '../core/runner/json';
import { PenLayer } from './PenLayer';
import type { PenMode, PenStroke } from './PenLayer';
import { demoStrings } from './strings.ko';
import styles from './DemoScreen.module.css';

interface DemoSlot extends SlotView {
  readonly engine: EngineId;
  readonly mode: string;
  readonly cpa: CPA;
}

interface DemoSession {
  readonly views: readonly ShareView[];
  readonly links: readonly ShareLink[];
  readonly slots: readonly DemoSlot[];
}

interface Timeline {
  readonly actions: readonly ShareAction[];
  readonly cursor: number;
}

interface PaneState {
  readonly input: string;
  readonly session: DemoSession | null;
  readonly actions: readonly ShareAction[];
  readonly cursor: number;
  readonly error: string | null;
}

type PaneSide = 'left' | 'right';
type DemoPaneTuple = readonly [PaneState, PaneState];

const EMPTY_PANE: PaneState = {
  input: '',
  session: null,
  actions: [],
  cursor: 0,
  error: null,
};

const EMPTY_TIMELINE: Timeline = { actions: [], cursor: 0 };

function resolveSession(
  views: readonly ShareView[],
  links: readonly ShareLink[],
  definitions: ReadonlyMap<EngineId, LoadedEngine>,
): DemoSession | null {
  const slots: DemoSlot[] = [];
  for (const view of views) {
    const definition = definitions.get(view.engine);
    if (!definition) return null;
    slots.push({
      slot: view.slot,
      definition,
      config: view.config,
      engine: view.engine,
      mode: view.mode,
      cpa: view.cpa,
    });
  }
  return { views, links, slots };
}

function taskViews(task: ContentTask): ShareView[] {
  const specs = task.views ?? [
    {
      slot: 'main',
      engine: task.engine,
      mode: task.mode,
      cpa: task.cpa,
      config: task.config,
    },
  ];
  return specs.map((spec) => ({
    slot: spec.slot,
    engine: spec.engine,
    mode: spec.mode,
    cpa: spec.cpa,
    config: toJsonValue(spec.config),
  }));
}

function loadPane(code: string, definitions: ReadonlyMap<EngineId, LoadedEngine>): PaneState {
  const decoded = decodeSharePayload(code.trim());
  if (!decoded.ok) {
    return { input: code, session: null, actions: [], cursor: 0, error: decoded.message };
  }
  const session = resolveSession(decoded.payload.views, decoded.payload.links, definitions);
  if (!session) {
    return { input: code, session: null, actions: [], cursor: 0, error: demoStrings.noEngine };
  }
  try {
    replayShare(session.slots, decoded.payload.actions);
  } catch {
    return { input: code, session: null, actions: [], cursor: 0, error: demoStrings.invalidCode };
  }
  return {
    input: code,
    session,
    actions: decoded.payload.actions,
    cursor: decoded.payload.actions.length,
    error: null,
  };
}

function EngineThumb({ definition }: { readonly definition: LoadedEngine }) {
  const state = useMemo(() => {
    try {
      return definition.createInitialState({} as never);
    } catch {
      return null;
    }
  }, [definition]);

  if (state === null) {
    return <span className={styles.thumbMissing} aria-hidden="true" />;
  }

  const View = definition.View as unknown as ComponentType<Record<string, unknown>>;
  return (
    <span className={styles.thumb} aria-hidden="true">
      <View
        {...({
          config: {},
          state,
          dispatch: () => undefined,
          cpa: 'C',
          mode: definition.modes[0] ?? 'free',
          readOnly: true,
          targetSize: 64,
        } satisfies Record<string, unknown>)}
      />
    </span>
  );
}

interface DemoStageViewProps {
  readonly session: DemoSession;
  readonly states: Readonly<Record<string, unknown>>;
  readonly readOnly: boolean;
  readonly zoom: number;
  readonly prefix: string;
  readonly dispatch?: (slot: string, action: unknown) => void;
  readonly pen?: {
    readonly mode: PenMode;
    readonly strokes: readonly PenStroke[];
    readonly onChange: (strokes: readonly PenStroke[]) => void;
  };
}

function DemoStageView({
  session,
  states,
  readOnly,
  zoom,
  prefix,
  dispatch,
  pen,
}: DemoStageViewProps) {
  return (
    <div className={styles.stage} data-testid={prefix}>
      <div
        className={styles.zoomInner}
        data-testid={`${prefix}-zoom`}
        data-zoom={zoom}
        style={{ transform: `scale(${zoom})` }}
      >
        <div className={styles.panels} data-panel-count={session.slots.length}>
          {session.slots.map((slot, index) => {
            const state = states[slot.slot];
            const View = slot.definition.View as unknown as ComponentType<Record<string, unknown>>;
            return (
              <section
                key={slot.slot}
                className={styles.panel}
                data-testid={`${prefix}-slot-${slot.slot}`}
              >
                {session.slots.length > 1 ? (
                  <h3 className={styles.slotLabel}>{index + 1}</h3>
                ) : null}
                <View
                  {...({
                    config: slot.config,
                    state,
                    dispatch: (action: unknown) => dispatch?.(slot.slot, action),
                    cpa: slot.cpa,
                    mode: slot.mode,
                    readOnly,
                    targetSize: 64,
                  } satisfies Record<string, unknown>)}
                />
              </section>
            );
          })}
        </div>
        {pen ? <PenLayer mode={pen.mode} strokes={pen.strokes} onChange={pen.onChange} /> : null}
      </div>
    </div>
  );
}

interface SplitPaneProps {
  readonly side: PaneSide;
  readonly title: string;
  readonly pane: PaneState;
  readonly zoom: number;
  readonly onInput: (value: string) => void;
  readonly onOpen: () => void;
  readonly onCursor: (value: number) => void;
}

function SplitPane({ side, title, pane, zoom, onInput, onOpen, onCursor }: SplitPaneProps) {
  const states = useMemo(() => {
    if (!pane.session) return {};
    try {
      return replayShare(pane.session.slots, pane.actions, pane.cursor);
    } catch {
      return {};
    }
  }, [pane.session, pane.actions, pane.cursor]);

  return (
    <section
      className={styles.pane}
      data-testid={`demo-pane-${side}`}
      aria-label={title}
      data-pane-readonly="true"
    >
      <header className={styles.paneHeader}>
        <h2 className={styles.paneTitle}>{title}</h2>
        <span className={styles.badge}>{demoStrings.paneReadOnly}</span>
      </header>

      <form
        className={styles.paneForm}
        onSubmit={(event) => {
          event.preventDefault();
          onOpen();
        }}
      >
        <label className={styles.paneField}>
          <span>{demoStrings.panePaste}</span>
          <input
            className={styles.input}
            type="text"
            value={pane.input}
            data-testid={`pane-input-${side}`}
            onChange={(event) => onInput(event.currentTarget.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <button type="submit" className={styles.toolButton} data-testid={`pane-open-${side}`}>
          {demoStrings.paneOpen}
        </button>
      </form>

      {pane.error ? (
        <p className={styles.error} role="alert">
          {pane.error}
        </p>
      ) : null}

      {pane.session ? (
        <>
          <DemoStageView
            session={pane.session}
            states={states}
            readOnly
            zoom={zoom}
            prefix={`pane-${side}`}
          />
          <label className={styles.rewind}>
            <span>
              {demoStrings.paneRewind}{' '}
              {demoStrings.rewindPosition(pane.cursor, pane.actions.length)}
            </span>
            <input
              className={styles.range}
              type="range"
              min={0}
              max={pane.actions.length}
              step={1}
              value={pane.cursor}
              data-testid={`pane-rewind-${side}`}
              onChange={(event) => onCursor(Number(event.currentTarget.value))}
            />
          </label>
        </>
      ) : (
        <p className={styles.paneEmpty}>{demoStrings.paneEmpty}</p>
      )}
    </section>
  );
}

interface DemoScreenProps {
  /** `#s=<code>`로 열었을 때 왼쪽 칸에 넣을 공유 코드. */
  readonly code?: string;
}

export function DemoScreen({ code }: DemoScreenProps) {
  const [engines, setEngines] = useState<ReadonlyMap<EngineId, LoadedEngine> | null>(null);
  const [engineError, setEngineError] = useState(false);
  const [units, setUnits] = useState<readonly UnitContent[] | null>(null);
  const [unitsError, setUnitsError] = useState(false);
  const [tab, setTab] = useState<'engine' | 'task'>('engine');
  const [pending, setPending] = useState<LoadedEngine | null>(null);
  const [session, setSession] = useState<DemoSession | null>(null);
  const [histories, setHistories] = useState<SlotHistories | null>(null);
  const [timeline, setTimeline] = useState<Timeline>(EMPTY_TIMELINE);
  const [zoom, setZoom] = useState<number>(1);
  const [pen, setPen] = useState<PenMode>('off');
  const [strokes, setStrokes] = useState<readonly PenStroke[]>([]);
  const [split, setSplit] = useState(false);
  const [panes, setPanes] = useState<DemoPaneTuple>([EMPTY_PANE, EMPTY_PANE]);
  const [share, setShare] = useState<{ readonly code: string; readonly link: string } | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);

  const historiesRef = useRef<SlotHistories | null>(null);
  const timelineRef = useRef<Timeline>(EMPTY_TIMELINE);
  const groupRef = useRef(0);
  const routeLoadedRef = useRef(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const ids = listEngineIds();
        const loaded = await Promise.all(
          ids.map(async (id) => [id, await loadEngine(id)] as const),
        );
        if (active) setEngines(new Map(loaded));
      } catch (error) {
        console.warn('[demo] 엔진을 불러오지 못했습니다.', error);
        if (active) setEngineError(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const loaded = await Promise.all(contentUnitIds().map((id) => loadUnitContent(id)));
        if (active) setUnits(loaded);
      } catch (error) {
        console.warn('[demo] 단원 콘텐츠를 불러오지 못했습니다.', error);
        if (active) setUnitsError(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!code || !engines || routeLoadedRef.current) return;
    routeLoadedRef.current = true;
    setSplit(true);
    setPanes((current) => [loadPane(code, engines), current[1]]);
  }, [code, engines]);

  function commitHistories(next: SlotHistories | null): void {
    historiesRef.current = next;
    setHistories(next);
  }

  function commitTimeline(next: Timeline): void {
    timelineRef.current = next;
    setTimeline(next);
  }

  function openViews(views: readonly ShareView[], links: readonly ShareLink[]): void {
    if (!engines) return;
    const next = resolveSession(views, links, engines);
    if (!next) {
      setOpenError(demoStrings.noEngine);
      return;
    }
    try {
      const initial = createSlotHistories(next.slots);
      groupRef.current = 0;
      setSession(next);
      commitHistories(initial);
      commitTimeline(EMPTY_TIMELINE);
      setStrokes([]);
      setPen('off');
      setOpenError(null);
    } catch (error) {
      console.warn('[demo] 교구 상태를 만들지 못했습니다.', error);
      setOpenError(demoStrings.loadError);
    }
  }

  function openEngineMode(mode: string): void {
    if (!pending) return;
    openViews(
      [
        {
          slot: 'main',
          engine: pending.id,
          mode,
          cpa: 'C',
          config: { mode },
        },
      ],
      [],
    );
    setPending(null);
  }

  function openTask(task: ContentTask): void {
    openViews(taskViews(task), task.links ?? []);
  }

  function act(slot: string, action: unknown): void {
    const currentSession = session;
    const current = historiesRef.current;
    if (!currentSession || !current) return;

    const currentTimeline = timelineRef.current;
    const live = currentTimeline.cursor === currentTimeline.actions.length;
    const base = live
      ? current
      : createHistory(
          replayShare(currentSession.slots, currentTimeline.actions, currentTimeline.cursor),
        );

    let result;
    try {
      result = applyActionWithLinks(currentSession.slots, currentSession.links, base, slot, action);
    } catch (error) {
      console.warn('[demo] 조작을 적용하지 못했습니다.', error);
      return;
    }

    groupRef.current += 1;
    const group = `g${groupRef.current}`;
    const entries: ShareAction[] = result.applied.map((item) => ({
      slot: item.slot,
      action: item.action,
      group,
    }));
    // 되감은 상태에서 조작하면 그 뒤 기록을 버리고 여기서 이어 간다(결정 5).
    const actions = [...currentTimeline.actions.slice(0, currentTimeline.cursor), ...entries];
    commitHistories(result.histories);
    commitTimeline({ actions, cursor: actions.length });
  }

  function control(value: SlotControl): void {
    const currentSession = session;
    if (!currentSession) return;
    const currentTimeline = timelineRef.current;
    const live = currentTimeline.cursor === currentTimeline.actions.length;
    const current = historiesRef.current;
    if (!current) return;

    const base = live
      ? current
      : createHistory(
          replayShare(currentSession.slots, currentTimeline.actions, currentTimeline.cursor),
        );
    const next = applyControl(base, value);
    if (next === base) return;

    const actions = [
      ...currentTimeline.actions.slice(0, currentTimeline.cursor),
      { control: value },
    ];
    commitHistories(next);
    commitTimeline({ actions, cursor: actions.length });
  }

  function resetStage(): void {
    if (!session) return;
    try {
      groupRef.current = 0;
      commitHistories(createSlotHistories(session.slots));
      commitTimeline(EMPTY_TIMELINE);
      setStrokes([]);
      setPen('off');
    } catch (error) {
      console.warn('[demo] 교구를 초기화하지 못했습니다.', error);
      setOpenError(demoStrings.loadError);
    }
  }

  function leaveStage(): void {
    setSession(null);
    commitHistories(null);
    commitTimeline(EMPTY_TIMELINE);
    setStrokes([]);
    setPen('off');
    setOpenError(null);
    setShareError(null);
  }

  function makeCode(): void {
    if (!session) return;
    const actions = timeline.actions.slice(0, timeline.cursor);
    const payload = createSharePayload(session.views, session.links, actions);
    const encoded = encodeSharePayload(payload);
    if (!encoded.ok) {
      setShareError(encoded.error === 'TOO_LONG' ? demoStrings.tooLong : demoStrings.codeFailed);
      return;
    }
    setShareError(null);
    const base = window.location.href.split('#')[0] ?? window.location.href;
    setShare({ code: encoded.code, link: `${base}${shareHash(encoded.code)}` });
  }

  function updatePane(index: 0 | 1, update: (pane: PaneState) => PaneState): void {
    setPanes((current) =>
      index === 0 ? [update(current[0]), current[1]] : [current[0], update(current[1])],
    );
  }

  function openPane(index: 0 | 1): void {
    if (!engines) return;
    const pane = panes[index];
    updatePane(index, () => loadPane(pane.input, engines));
  }

  const live = timeline.cursor === timeline.actions.length;
  const states = useMemo(() => {
    if (!session || !histories) return {};
    if (live) return histories.present;
    try {
      return replayShare(session.slots, timeline.actions, timeline.cursor);
    } catch {
      return histories.present;
    }
  }, [session, histories, timeline, live]);

  const canUndo = live && (histories?.past.length ?? 0) > 0;
  const canRedo = live && (histories?.future.length ?? 0) > 0;

  const splitPanes = (
    <div className={styles.split} data-testid="demo-split">
      <div className={styles.toolbar} role="toolbar" aria-label={demoStrings.tools}>
        <div className={styles.zoomGroup} role="group" aria-label={demoStrings.zoom}>
          {[1, 1.5, 2].map((value) => (
            <button
              key={value}
              type="button"
              className={styles.toolButton}
              aria-pressed={zoom === value}
              data-testid={`zoom-${value}`}
              onClick={() => setZoom(value)}
            >
              {value === 1
                ? demoStrings.zoomActual
                : value === 1.5
                  ? demoStrings.zoomOneHalf
                  : demoStrings.zoomDouble}
            </button>
          ))}
        </div>
        <button type="button" className={styles.toolButton} onClick={() => setSplit(false)}>
          {demoStrings.singleView}
        </button>
      </div>
      <div className={styles.splitHint}>{demoStrings.splitHint}</div>
      <div className={styles.splitPanes}>
        <SplitPane
          side="left"
          title={demoStrings.paneLeft}
          pane={panes[0]}
          zoom={zoom}
          onInput={(value) => updatePane(0, (pane) => ({ ...pane, input: value }))}
          onOpen={() => openPane(0)}
          onCursor={(value) => updatePane(0, (pane) => ({ ...pane, cursor: value }))}
        />
        <SplitPane
          side="right"
          title={demoStrings.paneRight}
          pane={panes[1]}
          zoom={zoom}
          onInput={(value) => updatePane(1, (pane) => ({ ...pane, input: value }))}
          onOpen={() => openPane(1)}
          onCursor={(value) => updatePane(1, (pane) => ({ ...pane, cursor: value }))}
        />
      </div>
    </div>
  );

  const picker = (
    <div className={styles.picker}>
      <div className={styles.tabs} role="tablist" aria-label={demoStrings.tabs}>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'engine'}
          className={styles.tab}
          onClick={() => setTab('engine')}
        >
          {demoStrings.engineTab}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'task'}
          className={styles.tab}
          onClick={() => setTab('task')}
        >
          {demoStrings.taskTab}
        </button>
      </div>

      {tab === 'engine' ? (
        <section className={styles.tabPanel} aria-label={demoStrings.engineTab}>
          <p className={styles.hint}>{demoStrings.engineHint}</p>
          <ul className={styles.cards}>
            {[...(engines?.values() ?? [])].map((definition) => (
              <li key={definition.id}>
                <div
                  role="button"
                  tabIndex={0}
                  className={styles.card}
                  data-testid={`engine-card-${definition.id}`}
                  onClick={() => setPending(definition)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    setPending(definition);
                  }}
                >
                  <EngineThumb definition={definition} />
                  <span className={styles.cardName}>{definition.name}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className={styles.tabPanel} aria-label={demoStrings.taskTab}>
          <p className={styles.hint}>{demoStrings.taskHint}</p>
          {unitsError ? (
            <p className={styles.error} role="alert">
              {demoStrings.unitError}
            </p>
          ) : units === null ? (
            <p role="status">{demoStrings.unitLoading}</p>
          ) : (
            <div className={styles.units}>
              {units.map((unit) => (
                <details key={unit.unit} className={styles.unit}>
                  <summary className={styles.summary}>{unit.title}</summary>
                  {unit.activities.map((activity) => (
                    <section key={activity.id} className={styles.activity}>
                      <h3 className={styles.activityTitle}>{activity.title}</h3>
                      <ul className={styles.tasks}>
                        {activity.tasks.map((task) => (
                          <li key={task.id}>
                            <button
                              type="button"
                              className={styles.taskButton}
                              data-testid={`task-${task.id}`}
                              onClick={() => openTask(task)}
                            >
                              {task.prompt}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </details>
              ))}
            </div>
          )}
        </section>
      )}

      {pending ? (
        <section className={styles.modeBox} aria-labelledby="mode-heading">
          <h2 id="mode-heading" className={styles.modeTitle}>
            {demoStrings.modeHeading}
          </h2>
          <p className={styles.hint}>{demoStrings.modeHint}</p>
          <div className={styles.modes}>
            {pending.modes.map((mode) => (
              <button
                key={mode}
                type="button"
                className={styles.toolButton}
                data-testid={`mode-${mode}`}
                onClick={() => openEngineMode(mode)}
              >
                {mode}
              </button>
            ))}
            <button type="button" className={styles.toolButton} onClick={() => setPending(null)}>
              {demoStrings.cancel}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );

  const player = session ? (
    <div className={styles.player}>
      <div className={styles.toolbar} role="toolbar" aria-label={demoStrings.tools}>
        <div className={styles.penGroup} role="group" aria-label={demoStrings.pen}>
          {(['black', 'red', 'blue'] as const).map((color) => (
            <button
              key={color}
              type="button"
              className={styles.toolButton}
              data-pen-color={color}
              aria-pressed={pen === color}
              onClick={() => setPen(pen === color ? 'off' : color)}
            >
              {color === 'black'
                ? demoStrings.penBlack
                : color === 'red'
                  ? demoStrings.penRed
                  : demoStrings.penBlue}
            </button>
          ))}
          <button
            type="button"
            className={styles.toolButton}
            aria-pressed={pen === 'eraser'}
            data-testid="pen-eraser"
            onClick={() => setPen(pen === 'eraser' ? 'off' : 'eraser')}
          >
            {demoStrings.eraser}
          </button>
          <button
            type="button"
            className={styles.toolButton}
            disabled={pen === 'off'}
            onClick={() => setPen('off')}
          >
            {demoStrings.penOff}
          </button>
        </div>

        <button
          type="button"
          className={styles.toolButton}
          onClick={() => control('undo')}
          disabled={!canUndo}
        >
          {demoStrings.undo}
        </button>
        <button
          type="button"
          className={styles.toolButton}
          onClick={() => control('redo')}
          disabled={!canRedo}
        >
          {demoStrings.redo}
        </button>
        <button type="button" className={styles.toolButton} onClick={resetStage}>
          {demoStrings.reset}
        </button>

        <div className={styles.zoomGroup} role="group" aria-label={demoStrings.zoom}>
          {[1, 1.5, 2].map((value) => (
            <button
              key={value}
              type="button"
              className={styles.toolButton}
              aria-pressed={zoom === value}
              data-testid={`zoom-${value}`}
              onClick={() => setZoom(value)}
            >
              {value === 1
                ? demoStrings.zoomActual
                : value === 1.5
                  ? demoStrings.zoomOneHalf
                  : demoStrings.zoomDouble}
            </button>
          ))}
        </div>

        <label className={styles.rewind}>
          <span>
            {demoStrings.rewind}{' '}
            {demoStrings.rewindPosition(timeline.cursor, timeline.actions.length)}
          </span>
          <input
            className={styles.range}
            type="range"
            min={0}
            max={timeline.actions.length}
            step={1}
            value={timeline.cursor}
            data-testid="demo-rewind"
            onChange={(event) =>
              commitTimeline({ ...timelineRef.current, cursor: Number(event.currentTarget.value) })
            }
          />
        </label>
        <button
          type="button"
          className={styles.toolButton}
          disabled={live}
          onClick={() =>
            commitTimeline({ ...timelineRef.current, cursor: timelineRef.current.actions.length })
          }
        >
          {demoStrings.rewindNow}
        </button>

        <button type="button" className={styles.toolButton} onClick={() => setSplit(true)}>
          {demoStrings.splitView}
        </button>
        <button type="button" className={styles.toolButton} onClick={makeCode}>
          {demoStrings.makeCode}
        </button>
        <button type="button" className={styles.toolButton} onClick={leaveStage}>
          {demoStrings.changeStage}
        </button>
      </div>

      {!live ? (
        <p className={styles.note} role="status">
          {demoStrings.rewindReadOnly}
        </p>
      ) : null}
      {openError ? (
        <p className={styles.error} role="alert">
          {openError}
        </p>
      ) : null}
      {shareError ? (
        <p className={styles.error} role="alert">
          {shareError}
        </p>
      ) : null}

      <DemoStageView
        session={session}
        states={states}
        readOnly={!live}
        zoom={zoom}
        prefix="demo-stage"
        dispatch={act}
        pen={{ mode: pen, strokes, onChange: setStrokes }}
      />
    </div>
  ) : (
    picker
  );

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <h1 className={styles.title}>{demoStrings.title}</h1>
        <nav className={styles.nav} aria-label={demoStrings.title}>
          <a className={styles.navLink} href="#/teacher">
            {demoStrings.back}
          </a>
          <a className={styles.navLink} href="#/">
            {demoStrings.home}
          </a>
        </nav>
      </header>

      {engineError ? (
        <p className={styles.error} role="alert">
          {demoStrings.loadError}
        </p>
      ) : engines === null ? (
        <p className={styles.note} role="status">
          {demoStrings.loading}
        </p>
      ) : split ? (
        splitPanes
      ) : (
        player
      )}

      {share ? (
        <ShareDialog code={share.code} link={share.link} onClose={() => setShare(null)} />
      ) : null}
    </main>
  );
}
