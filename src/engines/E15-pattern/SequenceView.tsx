/**
 * E15 sequence 모드 화면: 규칙 이어 가기·만들기·소리·바꾸기(translate).
 *
 * 트랙은 SVG 하나(`pattern-canvas`)이고 칸은 `data-testid`로 찾는다.
 * 소리만 듣는 주어진 칸(`sound-only`)은 토큰을 DOM에 두지 않는다(`data-token`·aria 포함).
 * 이 화면은 `expected`(정답 이어 가기)를 읽지 않는다. 맞고 틀림을 색으로 보이지 않는다.
 * 되돌린 무늬의 ✕는 학생의 암호를 되돌린 결과와 과제가 준 보내는 무늬를 견준 모양 표시다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { useRenderedSize } from '../../core/engine-sdk';
import type { EngineViewProps } from '../../core/engine-sdk';
import { audioSupported, noteOfToken, playNote, unlockAudio } from './audio';
import { CELL, LABEL_FONT, trackLayout } from './layout';
import type { Box } from './layout';
import { restoredFrom } from './pattern';
import { patternStrings as S } from './strings.ko';
import { TokenGlyph } from './tokens';
import type { PatternAction, PatternConfig, SequenceState } from './types';
import styles from './View.module.css';

type SequenceViewProps = Omit<
  EngineViewProps<PatternConfig, SequenceState, PatternAction>,
  'state'
> & { readonly state: SequenceState };

const STEP_MS = 500;
const DRAG_PX = 8;

function SoundCard({
  box,
  note,
  showBar,
}: {
  readonly box: Box;
  readonly note: number;
  readonly showBar: boolean;
}) {
  const scale = box.size / 84;
  const bar = Math.min(box.size - 26, 8 + note * 7);
  return (
    <g>
      <g transform={`translate(${box.x + 20 * scale} ${box.y + 10 * scale}) scale(${1.9 * scale})`}>
        <path d="M3 9v6h4l5 4V5L7 9H3z" fill="#5b6577" />
        <path
          d="M16 9c1.4 1.4 1.4 4.6 0 6M19 6c3 3 3 9 0 12"
          fill="none"
          stroke="#5b6577"
          strokeWidth={1.6}
          strokeLinecap="round"
        />
      </g>
      {showBar ? (
        <rect
          x={box.x + box.size - 22}
          y={box.y + box.size - 8 - bar}
          width={12}
          height={bar}
          fill="#5b6577"
          rx={2}
        />
      ) : null}
      <text
        x={box.x + 14 * scale}
        y={box.y + box.size - 12 * scale}
        fontSize={26 * scale}
        fontWeight={800}
        fill="#3d485c"
      >
        ?
      </text>
    </g>
  );
}

export function SequenceView({ state, dispatch, targetSize, readOnly = false }: SequenceViewProps) {
  const { settings, slots, cursor, sent } = state;
  const layout = useMemo(() => trackLayout(settings, sent), [settings, sent]);
  const boardRef = useRef<HTMLDivElement>(null);
  const board = useRenderedSize(boardRef);
  // 판에 맞춘 칸이 targetSize보다 작아지면 칸을 targetSize로 두고 판 안에서 세로로 스크롤한다.
  let sizeStyle: { width: string; height: string } | undefined;
  if (board.width > 0 && board.height > 0) {
    const fit = Math.min(
      Math.min(board.width, layout.width) / layout.width,
      board.height / layout.height,
    );
    if (fit * CELL < targetSize) {
      const scale = targetSize / CELL;
      sizeStyle = {
        width: `${layout.width * scale}px`,
        height: `${layout.height * scale}px`,
      };
    }
  }
  const soundOnly = settings.givenDisplay === 'sound-only';
  const translate = settings.variant === 'translate';
  const order = useMemo(
    () => [
      ...new Set(
        translate
          ? [...settings.palette, ...settings.given]
          : [...settings.items, ...settings.given],
      ),
    ],
    [settings, translate],
  );
  const noteOf = useCallback(
    (token: string) => noteOfToken(token, settings.notes, order),
    [settings.notes, order],
  );
  const soundOn = settings.sound !== 'none';
  const canSound = audioSupported();

  const [playIndex, setPlayIndex] = useState<number | null>(null);
  const [playToken, setPlayToken] = useState<string | null>(null);
  const [live, setLive] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [ghost, setGhost] = useState<{ token: string; x: number; y: number } | null>(null);
  const press = useRef<{ token: string; x: number; y: number; dragging: boolean } | null>(null);
  const suppressClick = useRef(false);

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  const stop = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    setPlayIndex(null);
    setPlayToken(null);
  }, []);

  const play = () => {
    if (readOnly) return;
    if (playIndex !== null) {
      stop();
      return;
    }
    unlockAudio();
    dispatch({ type: 'play' });
    const tokens: string[] = [...settings.given];
    for (const slot of slots) {
      if (slot === null) break;
      tokens.push(slot);
    }
    const step = (index: number) => {
      const token = tokens[index];
      if (token === undefined) {
        stop();
        return;
      }
      setPlayIndex(index);
      setPlayToken(token);
      if (soundOn) playNote(noteOf(token));
      timer.current = setTimeout(() => step(index + 1), STEP_MS);
    };
    if (tokens.length === 0) return;
    step(0);
  };

  const doPlace = (slot: number, token: string) => {
    if (readOnly) return;
    stop();
    dispatch({ type: 'place', slot, token });
    setLive(S.sequence.placed(slot + 1, S.tokenName(token)));
  };

  const doClear = (slot: number) => {
    if (readOnly) return;
    stop();
    dispatch({ type: 'clear-slot', slot });
    setLive(S.sequence.cleared(slot + 1));
  };

  const pickToken = (token: string) => {
    if (soundOn) {
      unlockAudio();
      playNote(noteOf(token));
    }
    doPlace(cursor, token);
  };

  const onSlotClick = (index: number) => {
    if (readOnly) return;
    if (slots[index] === null) {
      dispatch({ type: 'move-cursor', slot: index });
    } else {
      dispatch({ type: 'move-cursor', slot: index });
      doClear(index);
    }
  };

  const onKeyDown = (event: ReactKeyboardEvent<SVGSVGElement>) => {
    if (readOnly) return;
    const key = event.key;
    if (key === 'ArrowLeft' || key === 'ArrowUp') {
      event.preventDefault();
      dispatch({ type: 'move-cursor', slot: cursor - 1 });
    } else if (key === 'ArrowRight' || key === 'ArrowDown') {
      event.preventDefault();
      dispatch({ type: 'move-cursor', slot: cursor + 1 });
    } else if (key === 'Backspace' || key === 'Delete') {
      event.preventDefault();
      doClear(cursor);
    } else if (key === 'p' || key === 'P') {
      event.preventDefault();
      play();
    } else if (/^[1-9]$/.test(key)) {
      const token = settings.palette[Number.parseInt(key, 10) - 1];
      if (token !== undefined) {
        event.preventDefault();
        pickToken(token);
      }
    }
  };

  // 팔레트 카드 끌어 놓기(Pointer Events). 8px 넘게 움직이면 끌기다.
  const onPalettePointerDown = (event: ReactPointerEvent<HTMLButtonElement>, token: string) => {
    if (readOnly) return;
    press.current = { token, x: event.clientX, y: event.clientY, dragging: false };
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch {
      // 캡처를 지원하지 않는 환경.
    }
  };
  const onPalettePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const current = press.current;
    if (!current) return;
    if (!current.dragging) {
      if (Math.hypot(event.clientX - current.x, event.clientY - current.y) <= DRAG_PX) return;
      current.dragging = true;
    }
    setGhost({ token: current.token, x: event.clientX, y: event.clientY });
  };
  const finishDrag = (event: ReactPointerEvent<HTMLButtonElement>, drop: boolean) => {
    const current = press.current;
    press.current = null;
    setGhost(null);
    if (!current || !current.dragging) return;
    suppressClick.current = true;
    if (!drop || typeof document.elementFromPoint !== 'function') return;
    const target = document.elementFromPoint(event.clientX, event.clientY);
    const cell = target?.closest('[data-testid^="pattern-slot-"]');
    const testId = cell?.getAttribute('data-testid') ?? '';
    const match = /^pattern-slot-(\d+)$/.exec(testId);
    if (!match?.[1]) return;
    const slot = Number.parseInt(match[1], 10);
    dispatch({ type: 'move-cursor', slot });
    if (soundOn) playNote(noteOf(current.token));
    doPlace(slot, current.token);
  };

  const onPaletteClick = (token: string) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    pickToken(token);
  };

  const restored = sent ? restoredFrom(settings.given, slots) : [];

  const givenIndexPlaying = (i: number) => playIndex === i;
  const slotIndexPlaying = (j: number) => playIndex === settings.given.length + j;

  const cellRect = (
    box: Box,
    kind: 'given' | 'slot' | 'restored',
    playing: boolean,
    selected: boolean,
    filled: boolean,
  ) => (
    <rect
      x={box.x}
      y={box.y}
      width={box.size}
      height={box.size}
      rx={12}
      fill={kind === 'slot' ? '#ffffff' : '#eceff5'}
      stroke={playing ? '#e8872e' : selected ? '#1d4fa8' : '#8b96ab'}
      strokeWidth={playing ? 8 : selected ? 6 : 3}
      strokeDasharray={kind === 'slot' && !filled && !selected ? '10 7' : undefined}
    />
  );

  const mover = settings.motion ? (
    <svg
      className={styles.mover}
      viewBox="0 0 100 100"
      role="img"
      aria-label={S.sequence.moverLabel}
      data-testid="pattern-mover"
      data-playing={playIndex !== null ? 'true' : 'false'}
      data-pose={moverPose(settings.items, playToken)}
    >
      <TokenGlyph
        token={moverPose(settings.items, playToken)}
        x={0}
        y={0}
        size={100}
        look="color"
      />
    </svg>
  ) : null;

  const instruction = soundOnly
    ? S.sequence.soundInstructions
    : translate
      ? S.sequence.instructions.translate
      : settings.given.length === 0
        ? S.sequence.instructions.free
        : S.sequence.instructions.extend;

  return (
    <div className={styles.wrap} data-target-size={targetSize} data-mode="sequence">
      <div className={styles.stageRow}>
        <div ref={boardRef} className={styles.boardArea} data-scroll={sizeStyle ? 'true' : 'false'}>
          <svg
            data-testid="pattern-canvas"
            className={styles.trackSvg}
            data-scroll={sizeStyle ? 'true' : 'false'}
            style={sizeStyle ?? { aspectRatio: `${layout.width} / ${layout.height}` }}
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            role="application"
            aria-label={S.sequence.trackLabel}
            tabIndex={0}
            onKeyDown={onKeyDown}
          >
            <title>{S.sequence.canvasLabel}</title>
            <g data-testid="pattern-track">
              {layout.labels.map((label) => (
                <text
                  key={`${label.kind}-${label.y}`}
                  x={label.x}
                  y={label.y}
                  fontSize={LABEL_FONT}
                  fontWeight={700}
                  fill="#3d485c"
                  dominantBaseline="central"
                >
                  {label.kind === 'source'
                    ? S.sequence.rowSource
                    : label.kind === 'target'
                      ? S.sequence.rowTarget
                      : S.sequence.rowRestored}
                </text>
              ))}

              {translate
                ? layout.given.map((box, i) => {
                    const lower = layout.slots[i];
                    if (!lower) return null;
                    return (
                      <line
                        key={`link-${i}`}
                        x1={box.x + box.size / 2}
                        y1={box.y + box.size}
                        x2={lower.x + lower.size / 2}
                        y2={lower.y}
                        stroke="#c9d2e2"
                        strokeWidth={4}
                      />
                    );
                  })
                : null}

              {layout.given.map((box, i) => {
                const token = settings.given[i] ?? '';
                const playing = givenIndexPlaying(i);
                if (soundOnly) {
                  return (
                    <g
                      key={`given-${i}`}
                      data-testid={`pattern-given-${i}`}
                      data-playing={playing ? 'true' : undefined}
                      role="img"
                      aria-label={S.sequence.soundCard(i + 1)}
                    >
                      {cellRect(box, 'given', playing, false, true)}
                      <SoundCard box={box} note={noteOf(token)} showBar={soundOn && !canSound} />
                    </g>
                  );
                }
                return (
                  <g
                    key={`given-${i}`}
                    data-testid={`pattern-given-${i}`}
                    data-token={token}
                    data-playing={playing ? 'true' : undefined}
                    role="img"
                    aria-label={S.sequence.givenTokenLabel(i + 1, S.tokenName(token))}
                  >
                    {cellRect(box, 'given', playing, false, true)}
                    <TokenGlyph
                      token={token}
                      x={box.x}
                      y={box.y}
                      size={box.size}
                      look={settings.look}
                      symbols={settings.symbols}
                    />
                  </g>
                );
              })}

              {layout.slots.map((box, j) => {
                const token = slots[j] ?? null;
                const playing = slotIndexPlaying(j);
                const selected = j === cursor;
                return (
                  <g
                    key={`slot-${j}`}
                    data-testid={`pattern-slot-${j}`}
                    data-token={token ?? undefined}
                    data-selected={selected ? 'true' : undefined}
                    data-playing={playing ? 'true' : undefined}
                    role="button"
                    aria-label={
                      token === null
                        ? S.sequence.blankLabel(j + 1)
                        : S.sequence.filledLabel(j + 1, S.tokenName(token))
                    }
                    style={{ cursor: readOnly ? 'default' : 'pointer' }}
                    onClick={() => onSlotClick(j)}
                  >
                    {cellRect(box, 'slot', playing, selected, token !== null)}
                    {token !== null ? (
                      <TokenGlyph
                        token={token}
                        x={box.x}
                        y={box.y}
                        size={box.size}
                        look={settings.look}
                        symbols={settings.symbols}
                      />
                    ) : null}
                    {selected ? (
                      <polygon
                        data-testid="pattern-cursor"
                        points={`${box.x + box.size / 2 - 11},${box.y + box.size + 20} ${box.x + box.size / 2 + 11},${box.y + box.size + 20} ${box.x + box.size / 2},${box.y + box.size + 6}`}
                        fill="#1d4fa8"
                      >
                        <title>{S.sequence.cursorMark}</title>
                      </polygon>
                    ) : null}
                  </g>
                );
              })}

              {layout.restored.map((box, i) => {
                const token = restored[i] ?? null;
                const same = token !== null && token === settings.given[i];
                const mismatch = (slots[i] ?? null) !== null && !same;
                return (
                  <g
                    key={`restored-${i}`}
                    data-testid={`pattern-restored-${i}`}
                    data-mismatch={mismatch ? 'true' : undefined}
                  >
                    {cellRect(box, 'restored', false, false, true)}
                    {token !== null && !soundOnly ? (
                      <TokenGlyph
                        token={token}
                        x={box.x}
                        y={box.y}
                        size={box.size}
                        look={settings.look}
                        symbols={settings.symbols}
                      />
                    ) : null}
                    {token !== null && soundOnly ? (
                      <text
                        x={box.x + box.size / 2}
                        y={box.y + box.size / 2}
                        fontSize={40}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill="#5b6577"
                      >
                        ?
                      </text>
                    ) : null}
                    {mismatch ? (
                      <g
                        stroke="#1d2330"
                        strokeWidth={6}
                        strokeLinecap="round"
                        data-testid={`pattern-restored-x-${i}`}
                      >
                        <line
                          x1={box.x + 10}
                          y1={box.y + 10}
                          x2={box.x + box.size - 10}
                          y2={box.y + box.size - 10}
                        />
                        <line
                          x1={box.x + box.size - 10}
                          y1={box.y + 10}
                          x2={box.x + 10}
                          y2={box.y + box.size - 10}
                        />
                      </g>
                    ) : null}
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        <div className={styles.sideStack}>
          <p className={styles.instructions}>{instruction}</p>

          <div
            className={styles.palette}
            role="group"
            aria-label={S.sequence.palette}
            data-testid="pattern-palette"
          >
            {settings.palette.map((token, index) => (
              <button
                key={token}
                type="button"
                className={styles.paletteCard}
                data-token={token}
                aria-label={S.tokenName(token)}
                disabled={readOnly}
                onClick={() => onPaletteClick(token)}
                onPointerDown={(event) => onPalettePointerDown(event, token)}
                onPointerMove={onPalettePointerMove}
                onPointerUp={(event) => finishDrag(event, true)}
                onPointerCancel={(event) => finishDrag(event, false)}
              >
                <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
                  <TokenGlyph
                    token={token}
                    x={0}
                    y={0}
                    size={100}
                    look={settings.look}
                    symbols={settings.symbols}
                  />
                </svg>
                <span className={styles.paletteKey} aria-hidden="true">
                  {index < 9 ? index + 1 : ''}
                </span>
              </button>
            ))}
          </div>

          <div className={styles.toolbar} role="toolbar">
            <button type="button" className={styles.button} onClick={play} disabled={readOnly}>
              {playIndex !== null ? S.sequence.playing : S.sequence.play}
            </button>
            <button
              type="button"
              className={styles.button}
              disabled={readOnly}
              onClick={() => {
                stop();
                dispatch({ type: 'clear-all' });
                setLive(S.sequence.allCleared);
              }}
            >
              {S.sequence.clearAll}
            </button>
            {translate ? (
              <button
                type="button"
                className={styles.button}
                disabled={readOnly}
                onClick={() => {
                  dispatch({ type: 'send' });
                  setLive(S.sequence.sent);
                }}
              >
                {S.sequence.send}
              </button>
            ) : null}
          </div>

          {soundOn && !canSound ? (
            <p className={styles.status} role="status">
              {S.sequence.noSound}
            </p>
          ) : null}

          {mover}
        </div>
      </div>

      <p className={styles.srOnly} aria-live="polite" data-testid="pattern-live">
        {live}
      </p>

      {ghost ? (
        <svg
          className={styles.ghost}
          style={{ left: ghost.x - 32, top: ghost.y - 32 }}
          viewBox="0 0 100 100"
          width={64}
          height={64}
          aria-hidden="true"
        >
          <TokenGlyph
            token={ghost.token}
            x={0}
            y={0}
            size={100}
            look={settings.look}
            symbols={settings.symbols}
          />
        </svg>
      ) : null}
    </div>
  );
}

/** 동작 캐릭터 자세: items 0·1·2번 토큰이 박수·점프·만세, 그 밖은 박수. 재생 전은 박수. */
function moverPose(items: readonly string[], token: string | null): string {
  if (token === null) return 'clap';
  const index = items.indexOf(token);
  return index === 1 ? 'jump' : index === 2 ? 'hands-up' : 'clap';
}
