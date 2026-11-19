/**
 * E15 growth 모드 화면: 단계별 쌓기나무 그림(보기 판)과 표(단계 | 개수 | 늘어난 수), 숫자 패드.
 *
 * 맞고 틀림은 표시하지 않는다(✓/✕ 없음). 늘어난 개수·정답 개수를 숫자 배지로 쓰지 않는다.
 * 그림에서 늘어난 쌓기나무는 진한 색 + 굵은 윤곽 + 점 무늬로 강조한다(색만으로 구분하지 않는다).
 * 쌓기나무가 화면 24px보다 작아지면 줄이지 않고 판 안에서 스크롤한다.
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useRenderedSize } from '../../core/engine-sdk';
import type { EngineViewProps } from '../../core/engine-sdk';
import { GrowthKeypad } from './GrowthKeypad';
import { blankKeys, cellKey, parseCellKey, stageCount } from './growth';
import type { GrowthRow } from './growth';
import { CUBE, cubeFaces, growthLayout } from './growth-layout';
import type { PlacedCube } from './growth-layout';
import { patternStrings as S } from './strings.ko';
import type { GrowthState, PatternAction, PatternConfig } from './types';
import styles from './View.module.css';

type GrowthViewProps = Omit<EngineViewProps<PatternConfig, GrowthState, PatternAction>, 'state'> & {
  readonly state: GrowthState;
};

/** 쌓기나무 한 개의 최소 화면 크기(px). 이보다 작아지면 줄이지 않고 판 안에서 스크롤한다. */
const MIN_CUBE_PX = 24;
const MAX_FIT = 1.6;

const GROWTH_COLORS = {
  oldTop: '#dbe7ff',
  oldLeft: '#b8cdf6',
  oldRight: '#9db8ee',
  oldStroke: '#1d4fa8',
  newTop: '#ffd27a',
  newLeft: '#f2a63a',
  newRight: '#db8a1c',
  newStroke: '#4a2400',
  ink: '#1d2330',
} as const;

export function GrowthView({ state, dispatch, targetSize, readOnly = false }: GrowthViewProps) {
  const { settings } = state;
  const layout = useMemo(() => growthLayout(settings), [settings]);
  const boardRef = useRef<HTMLDivElement>(null);
  const board = useRenderedSize(boardRef);
  const tableRef = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState('');
  const patternId = `growth-dots-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  const blanks = useMemo(() => blankKeys(settings), [settings]);
  const table = settings.table;

  // 활성 칸이 키보드로 바뀌면 그 칸 단추로 초점을 옮긴다(표 안에 초점이 있을 때만).
  useEffect(() => {
    const root = tableRef.current;
    if (!root || state.active === null) return;
    if (!root.contains(document.activeElement)) return;
    const target = root.querySelector<HTMLElement>(`[data-cell="${state.active}"]`);
    if (target && target !== document.activeElement) target.focus();
  }, [state.active]);

  // 보기 판 크기: 판에 맞추되 쌓기나무가 MIN_CUBE_PX보다 작아지면 그 크기로 두고 판 안에서 스크롤한다.
  let sizeStyle: { width: string; height: string } | undefined;
  let scroll = false;
  let boardStyle: CSSProperties | undefined;
  if (layout) {
    if (board.width > 0 && board.height > 0) {
      const fit = Math.min(board.width / layout.width, board.height / layout.height, MAX_FIT);
      const minScale = MIN_CUBE_PX / CUBE;
      const scale = fit >= minScale - 0.005 ? fit : minScale;
      scroll = fit < minScale - 0.005;
      sizeStyle = { width: `${layout.width * scale}px`, height: `${layout.height * scale}px` };
    }
    boardStyle = {
      '--growth-min-h': `${Math.ceil((layout.height * MIN_CUBE_PX) / CUBE)}px`,
    } as CSSProperties;
  }

  const onTableKey = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (readOnly || event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key;
    const move = (dir: 'left' | 'right' | 'up' | 'down') => {
      event.preventDefault();
      dispatch({ type: 'move', dir });
    };
    if (key === 'ArrowLeft') move('left');
    else if (key === 'ArrowRight') move('right');
    else if (key === 'ArrowUp') move('up');
    else if (key === 'ArrowDown') move('down');
    else if (/^[0-9]$/.test(key)) {
      event.preventDefault();
      dispatch({ type: 'type', key });
    } else if (key === 'Backspace') {
      event.preventDefault();
      dispatch({ type: 'backspace' });
    } else if (key === 'Delete' || key === 'Escape') {
      event.preventDefault();
      dispatch({ type: 'clear' });
    }
  };

  const activate = (cell: string) => {
    if (readOnly || state.active === cell) return;
    dispatch({ type: 'activate', cell });
    const parsed = parseCellKey(cell);
    if (parsed) setLive(S.growth.live(parsed.stage, parsed.row));
  };

  const stages = table ? Array.from({ length: table.upTo }, (_, index) => index + 1) : [];
  const tabStop = state.active !== null && blanks.includes(state.active) ? state.active : blanks[0];

  const renderBlank = (stage: number, row: GrowthRow) => {
    const key = cellKey(stage, row);
    const value = state.cells[key] ?? '';
    const isActive = state.active === key;
    const label =
      value === ''
        ? row === 'count'
          ? S.growth.blankCount(stage)
          : S.growth.blankInc(stage)
        : row === 'count'
          ? S.growth.filledCount(stage, value)
          : S.growth.filledInc(stage, value);
    return (
      <button
        type="button"
        className={styles.growthCell}
        data-cell={key}
        data-active={isActive ? 'true' : undefined}
        data-filled={value === '' ? undefined : 'true'}
        aria-label={label}
        tabIndex={key === tabStop ? 0 : -1}
        disabled={readOnly}
        onClick={() => activate(key)}
        onFocus={() => activate(key)}
      >
        {value}
      </button>
    );
  };

  const renderCube = (placed: PlacedCube, index: number) => {
    if (!layout) return null;
    const isNew = placed.isNew;
    const fillTop = isNew ? GROWTH_COLORS.newTop : GROWTH_COLORS.oldTop;
    const fillLeft = isNew ? GROWTH_COLORS.newLeft : GROWTH_COLORS.oldLeft;
    const fillRight = isNew ? GROWTH_COLORS.newRight : GROWTH_COLORS.oldRight;
    const stroke = isNew ? GROWTH_COLORS.newStroke : GROWTH_COLORS.oldStroke;
    const strokeWidth = isNew ? 3 : 1.5;
    const common = { stroke, strokeWidth, strokeLinejoin: 'round' as const };
    const dots = isNew ? `url(#${patternId})` : undefined;
    return (
      <g
        key={`${placed.stage}-${index}`}
        data-stage={placed.stage}
        data-new={isNew ? 'true' : 'false'}
        data-x={placed.cube[0]}
        data-z={placed.cube[2]}
      >
        {layout.look === 'cubes' ? (
          (() => {
            const faces = cubeFaces(placed.left, placed.top);
            return (
              <>
                <polygon points={faces.left} fill={fillLeft} {...common} />
                <polygon points={faces.right} fill={fillRight} {...common} />
                <polygon points={faces.top} fill={fillTop} {...common} />
                {dots ? (
                  <>
                    <polygon points={faces.left} fill={dots} stroke="none" />
                    <polygon points={faces.right} fill={dots} stroke="none" />
                    <polygon points={faces.top} fill={dots} stroke="none" />
                  </>
                ) : null}
              </>
            );
          })()
        ) : (
          <>
            <rect
              x={placed.left + 0.5}
              y={placed.top + 0.5}
              width={CUBE - 1}
              height={CUBE - 1}
              fill={fillTop}
              {...common}
            />
            {dots ? (
              <rect
                x={placed.left + 0.5}
                y={placed.top + 0.5}
                width={CUBE - 1}
                height={CUBE - 1}
                fill={dots}
                stroke="none"
              />
            ) : null}
          </>
        )}
      </g>
    );
  };

  return (
    <div className={styles.wrap} data-target-size={targetSize} data-mode="growth">
      <div className={styles.stageRow}>
        {layout ? (
          <div
            ref={boardRef}
            className={styles.boardArea}
            data-scroll={scroll ? 'true' : 'false'}
            data-growth="true"
            style={boardStyle}
            data-testid="growth-board"
          >
            <svg
              data-testid="growth-canvas"
              className={styles.calcSvg}
              style={sizeStyle ?? { aspectRatio: `${layout.width} / ${layout.height}` }}
              viewBox={`0 0 ${layout.width} ${layout.height}`}
              role="group"
              aria-label={S.growth.canvasLabel}
            >
              <title>{S.growth.canvasLabel}</title>
              <defs>
                <pattern
                  id={patternId}
                  patternUnits="userSpaceOnUse"
                  width={8}
                  height={8}
                  patternTransform="rotate(0)"
                >
                  <circle cx={2} cy={2} r={1.4} fill={GROWTH_COLORS.newStroke} />
                  <circle cx={6} cy={6} r={1.4} fill={GROWTH_COLORS.newStroke} />
                </pattern>
              </defs>
              {layout.panels.map((panel) => (
                <g key={panel.stage} data-panel={panel.stage}>
                  {panel.cubes.map((placed, index) => renderCube(placed, index))}
                  <text
                    x={panel.labelX}
                    y={panel.labelY}
                    fontSize={17}
                    fontWeight={700}
                    fill="#3d485c"
                    textAnchor="middle"
                    dominantBaseline="central"
                  >
                    {S.growth.stageLabel(panel.stage)}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        ) : null}

        {table ? (
          <div className={styles.sideStack} data-solo={layout ? undefined : 'true'}>
            <section className={styles.calcSection}>
              <p className={styles.instructions}>{S.growth.instructions}</p>
              <div className={styles.growthTableScroll}>
                <div
                  ref={tableRef}
                  data-testid="growth-table"
                  role="group"
                  aria-label={S.growth.tableLabel}
                  onKeyDown={onTableKey}
                >
                  <table className={styles.growthTable}>
                    <tbody>
                      <tr>
                        <th scope="row" className={styles.growthHead}>
                          {S.growth.rowStage}
                        </th>
                        {stages.map((stage) => (
                          <th key={stage} scope="col" className={styles.growthStageHead}>
                            {stage}
                          </th>
                        ))}
                      </tr>
                      <tr>
                        <th scope="row" className={styles.growthHead}>
                          {S.growth.rowCount}
                        </th>
                        {stages.map((stage) => {
                          const key = cellKey(stage, 'count');
                          return (
                            <td key={stage} className={styles.growthTd}>
                              {blanks.includes(key) ? (
                                renderBlank(stage, 'count')
                              ) : (
                                <span
                                  className={styles.growthGiven}
                                  data-given={key}
                                  aria-label={S.growth.givenCount(
                                    stage,
                                    stageCount(settings.shape, stage),
                                  )}
                                >
                                  {stageCount(settings.shape, stage)}
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                      {table.increments === 'blank' ? (
                        <tr>
                          <th scope="row" className={styles.growthHead}>
                            {S.growth.rowInc}
                          </th>
                          {stages.map((stage) => (
                            <td key={stage} className={styles.growthTd}>
                              {stage >= 2 ? (
                                renderBlank(stage, 'inc')
                              ) : (
                                <span className={styles.growthGiven} aria-label={S.growth.noInc}>
                                  –
                                </span>
                              )}
                            </td>
                          ))}
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
              <GrowthKeypad
                disabled={readOnly}
                onKey={(key) => dispatch({ type: 'type', key })}
                onBackspace={() => dispatch({ type: 'backspace' })}
                onClear={() => dispatch({ type: 'clear' })}
              />
            </section>
          </div>
        ) : null}
      </div>
      <p className={styles.srOnly} aria-live="polite" data-testid="growth-live">
        {live}
      </p>
    </div>
  );
}
