/**
 * T045 tiling: 정사각형 타일로 방을 빈틈없이 덮는 화면.
 *
 * - 고른 타일 크기(학생 입력)만 숫자로 보인다.
 * - 타일 개수·남는 칸 수·덮이는지 여부는 글자로 쓰지 않는다(그림만).
 * - 슬라이더·−/+·방향키로 끌기 없이 조작한다.
 */
import type { EngineViewProps } from '../../../core/engine-sdk';
import { tilingRoomRects } from '../layout';
import type { TileRoomRect } from '../layout';
import { arrayAreaStrings as S } from '../strings.ko';
import type { ArrayAreaAction, ArrayAreaConfig, ArrayAreaState } from '../types';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import styles from '../View.module.css';

const PAPER = '#fbfaf6';
const INK = '#1d2330';
const BLUE = '#2f6fde';
const RED = '#c2410c';

function Room({
  rect,
  label,
  width,
  height,
  tileSize,
  showGrid,
  roomKey,
}: {
  readonly rect: TileRoomRect;
  readonly label: string;
  readonly width: number;
  readonly height: number;
  readonly tileSize: number | null;
  readonly showGrid: boolean;
  readonly roomKey: string;
}) {
  const fullCols = tileSize === null ? 0 : Math.floor(width / tileSize);
  const fullRows = tileSize === null ? 0 : Math.floor(height / tileSize);
  const coveredWidth = fullCols * (tileSize ?? 0);
  const coveredHeight = fullRows * (tileSize ?? 0);
  const cellWidth = rect.width / Math.max(1, width);
  const cellHeight = rect.height / Math.max(1, height);

  return (
    <g data-room={roomKey} data-tile-size={tileSize ?? ''}>
      <text x={rect.x} y={rect.y - 16} fontSize={18} fontWeight={700} fill={INK}>
        {label}
      </text>
      <rect
        x={rect.x}
        y={rect.y}
        width={rect.width}
        height={rect.height}
        fill="#ffffff"
        stroke={INK}
        strokeWidth={2}
      />
      {showGrid
        ? Array.from({ length: Math.max(0, width - 1) }, (_, index) => (
            <line
              key={`${roomKey}-v-${index}`}
              x1={rect.x + (index + 1) * cellWidth}
              y1={rect.y}
              x2={rect.x + (index + 1) * cellWidth}
              y2={rect.y + rect.height}
              stroke="#c9d2e0"
              strokeWidth={1}
            />
          ))
        : null}
      {showGrid
        ? Array.from({ length: Math.max(0, height - 1) }, (_, index) => (
            <line
              key={`${roomKey}-h-${index}`}
              x1={rect.x}
              y1={rect.y + (index + 1) * cellHeight}
              x2={rect.x + rect.width}
              y2={rect.y + (index + 1) * cellHeight}
              stroke="#c9d2e0"
              strokeWidth={1}
            />
          ))
        : null}

      {tileSize !== null
        ? Array.from({ length: fullRows }, (_, row) =>
            Array.from({ length: fullCols }, (_, col) => (
              <rect
                key={`${roomKey}-tile-${row}-${col}`}
                x={rect.x + col * tileSize * cellWidth}
                y={rect.y + row * tileSize * cellHeight}
                width={tileSize * cellWidth}
                height={tileSize * cellHeight}
                fill="#dbe7ff"
                fillOpacity={0.9}
                stroke={BLUE}
                strokeWidth={2}
              />
            )),
          )
        : null}

      {tileSize !== null && coveredWidth < width ? (
        <rect
          x={rect.x + coveredWidth * cellWidth}
          y={rect.y}
          width={(width - coveredWidth) * cellWidth}
          height={rect.height}
          fill="url(#e04-leftover-hatch)"
          stroke={RED}
          strokeWidth={2}
          data-leftover={roomKey}
        />
      ) : null}
      {tileSize !== null && coveredHeight < height ? (
        <rect
          x={rect.x}
          y={rect.y + coveredHeight * cellHeight}
          width={coveredWidth * cellWidth}
          height={(height - coveredHeight) * cellHeight}
          fill="url(#e04-leftover-hatch)"
          stroke={RED}
          strokeWidth={2}
          data-leftover={roomKey}
        />
      ) : null}
    </g>
  );
}

export function TilingView({
  state,
  dispatch,
  cpa,
  readOnly = false,
  scale = 1,
  targetSize,
}: EngineViewProps<ArrayAreaConfig, ArrayAreaState, ArrayAreaAction>) {
  const { settings } = state;
  const rooms = tilingRoomRects(settings.width, settings.height, settings.compare);
  const sizes = settings.tileSizes;
  const index = state.tileSize === null ? -1 : sizes.indexOf(state.tileSize);
  const selectedIndex = index < 0 ? 0 : index;
  const choose = (next: number | undefined) => {
    if (next === undefined) return;
    dispatch({ type: 'set-tile', size: next });
  };

  return (
    <div className={styles.wrap} data-target-size={targetSize} style={{ width: `${100 * scale}%` }}>
      <div className={styles.toolbar}>
        <div className={styles.group}>
          <span className={styles.groupLabel}>{S.tiling.tileSize}</span>
          <button
            type="button"
            className={styles.iconButton}
            aria-label={S.tiling.smallerTile}
            onClick={() => choose(sizes[selectedIndex - 1])}
            disabled={readOnly || index <= 0}
          >
            −
          </button>
          <span className={styles.count} data-testid="tile-size">
            {state.tileSize === null ? '–' : S.tiling.tileSizeValue(state.tileSize)}
          </span>
          <button
            type="button"
            className={styles.iconButton}
            aria-label={S.tiling.biggerTile}
            onClick={() => choose(sizes[index < 0 ? 0 : index + 1])}
            disabled={readOnly || index >= sizes.length - 1}
          >
            +
          </button>
        </div>
        <input
          type="range"
          min={0}
          max={Math.max(0, sizes.length - 1)}
          step={1}
          value={selectedIndex}
          aria-label={S.tiling.tileSize}
          data-testid="tile-slider"
          disabled={readOnly}
          onChange={(event) => choose(sizes[Number(event.target.value)])}
        />
        <button
          type="button"
          className={styles.button}
          onClick={() => dispatch({ type: 'record-tile' })}
          disabled={readOnly || state.tileSize === null}
        >
          {S.tiling.record}
        </button>
        {state.recordedSizes.length > 0 ? (
          <span className={styles.badge} data-testid="recorded-sizes-badge">
            {S.tiling.recorded(state.recordedSizes.length)}
          </span>
        ) : null}
        <span className={styles.hint}>{S.instructions.tiling}</span>
      </div>

      <svg
        className={styles.canvas}
        viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`}
        role="group"
        aria-label={settings.compare === null ? S.tiling.canvasLabel : S.tiling.compareCanvasLabel}
        data-testid="array-canvas"
        data-cpa={cpa}
        data-tile-size={state.tileSize ?? ''}
      >
        <rect width={LOGICAL_WIDTH} height={LOGICAL_HEIGHT} fill={PAPER} />
        <defs>
          <pattern
            id="e04-leftover-hatch"
            width={10}
            height={10}
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line x1={0} y1={0} x2={0} y2={10} stroke={RED} strokeWidth={2.4} />
          </pattern>
        </defs>
        <Room
          rect={rooms.a}
          label={S.tiling.roomA}
          width={settings.width}
          height={settings.height}
          tileSize={state.tileSize}
          showGrid={settings.showGrid !== 'never'}
          roomKey="a"
        />
        {rooms.b !== null && settings.compare !== null ? (
          <Room
            rect={rooms.b}
            label={S.tiling.roomB}
            width={settings.compare.width}
            height={settings.compare.height}
            tileSize={state.tileSize}
            showGrid={settings.showGrid !== 'never'}
            roomKey="b"
          />
        ) : null}
      </svg>
    </div>
  );
}
