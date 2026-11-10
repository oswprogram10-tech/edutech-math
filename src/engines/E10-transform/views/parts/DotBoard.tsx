/**
 * 데칼코마니 점판. 9×7 점, 가운데 세로선 x = 4가 접는 선이다.
 * 물감은 색과 모양(●▲■◆)을 함께 다르게 해 색만으로 구분하지 않는다.
 */
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import type { RefObject } from 'react';
import type { CPA } from '../../../../core/engine-sdk';
import { pointerToLogical } from '../../../../core/engine-sdk';
import type { BoardRect } from '../../layout';
import { transformStrings as S } from '../../strings.ko';
import type { DecalDot, Pt } from '../../types';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../../types';

const DOT_BOARD: BoardRect = {
  x: 104,
  y: 192,
  width: 792,
  height: 616,
  cell: 88,
  grid: 9,
};

const MARK_TEXT = S.line.decal.marks;
const MARK_COLOR = ['#b42318', '#1d4fa8', '#1f7a4d', '#7c3aed'] as const;

interface DotBoardProps {
  readonly svgRef: RefObject<SVGSVGElement>;
  readonly dots: readonly DecalDot[];
  readonly folded: boolean;
  readonly cursor: Pt;
  readonly focused: boolean;
  readonly readOnly: boolean;
  readonly cpa: CPA;
  readonly targetSize: number;
  readonly onKeyDown: (event: ReactKeyboardEvent<SVGSVGElement>) => void;
  readonly onPick: (at: Pt) => void;
}

function dotXY(at: Pt) {
  return {
    x: DOT_BOARD.x + at[0] * DOT_BOARD.cell,
    y: DOT_BOARD.y + at[1] * DOT_BOARD.cell,
  };
}

export function DotBoard({
  svgRef,
  dots,
  folded,
  cursor,
  focused,
  readOnly,
  cpa,
  targetSize,
  onKeyDown,
  onPick,
}: DotBoardProps) {
  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (readOnly) return;
    const point = pointerToLogical(event, svgRef.current, {
      width: LOGICAL_WIDTH,
      height: LOGICAL_HEIGHT,
    });
    const index = Math.round((point.x - DOT_BOARD.x) / DOT_BOARD.cell);
    const row = Math.round((point.y - DOT_BOARD.y) / DOT_BOARD.cell);
    if (index < 0 || index > 8 || row < 0 || row > 6) return;
    onPick([index, row]);
  };

  return (
    <svg
      ref={svgRef}
      className={undefined}
      viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`}
      role="group"
      aria-label={S.canvasLabel['line-symmetry']}
      tabIndex={readOnly ? -1 : 0}
      data-testid="transform-canvas"
      data-motion="full"
      data-cpa={cpa}
      data-target-size={targetSize}
      style={{
        display: 'block',
        width: '100%',
        maxWidth: 720,
        aspectRatio: '1 / 1',
        borderRadius: 16,
        background: '#fbfaf6',
        border: '1px solid #d7deea',
        touchAction: 'none',
      }}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
    >
      <rect width={LOGICAL_WIDTH} height={LOGICAL_HEIGHT} fill="#fbfaf6" />
      <rect
        x={DOT_BOARD.x}
        y={DOT_BOARD.y}
        width={DOT_BOARD.width}
        height={DOT_BOARD.height}
        fill="#fffdf7"
        stroke="#c9d2e2"
        strokeWidth={2}
      />
      {Array.from({ length: 7 }, (_, row) =>
        Array.from({ length: 9 }, (_, index) => {
          const xy = dotXY([index, row]);
          return <circle key={`dot-${index}-${row}`} cx={xy.x} cy={xy.y} r={4} fill="#9aa7bd" />;
        }),
      )}
      <line
        x1={DOT_BOARD.x + 4 * DOT_BOARD.cell}
        y1={DOT_BOARD.y - 24}
        x2={DOT_BOARD.x + 4 * DOT_BOARD.cell}
        y2={DOT_BOARD.y + DOT_BOARD.height + 24}
        stroke="#7c3aed"
        strokeWidth={3}
        strokeDasharray="12 9"
        data-fold-line
      />
      {dots.map((dot) => {
        const xy = dotXY(dot.at);
        return (
          <g key={`ink-${dot.at[0]}-${dot.at[1]}`} data-dot={`${dot.at[0]},${dot.at[1]}`}>
            <circle cx={xy.x} cy={xy.y} r={20} fill="#ffffff" fillOpacity={0.85} />
            <text
              x={xy.x}
              y={xy.y + 11}
              textAnchor="middle"
              fontSize={34}
              fontWeight={800}
              fill={MARK_COLOR[dot.mark]}
            >
              {MARK_TEXT[dot.mark]}
            </text>
          </g>
        );
      })}
      {folded
        ? dots.map((dot) => {
            const mirror: Pt = [8 - dot.at[0], dot.at[1]];
            const xy = dotXY(mirror);
            return (
              <g key={`mirror-${dot.at[0]}-${dot.at[1]}`} opacity={0.7} data-dot-mirror>
                <text
                  x={xy.x}
                  y={xy.y + 11}
                  textAnchor="middle"
                  fontSize={34}
                  fontWeight={800}
                  fill={MARK_COLOR[dot.mark]}
                >
                  {MARK_TEXT[dot.mark]}
                </text>
              </g>
            );
          })
        : null}
      {focused ? (
        <circle
          data-cursor
          cx={dotXY(cursor).x}
          cy={dotXY(cursor).y}
          r={26}
          fill="none"
          stroke="#e8872e"
          strokeWidth={3}
          strokeDasharray="7 5"
        />
      ) : null}
    </svg>
  );
}
