/**
 * 힌트 ② long-chain (MC-PATTERN-RECURSIVE-ONLY).
 * 표 아래에 "+k, +k, +k, … (x번)" 사슬을 그린다. 처음 몇 개만 그리고 나머지는 "… 97번 더"로 줄인다.
 * k는 학생 표의 이웃 차이(○가 1 커질 때 □의 차이)다. □ 값은 쓰지 않는다.
 */
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import { functionStrings as S } from '../strings.ko';
import { footTop } from '../table-layout';
import type { FunctionConfig, FunctionState } from '../types';
import { RELATION_CANVAS, onGrid, argsOf, neighborPairs, overlayData, signed } from './helpers';

const SHOWN = 3;
const CHIP_W = 64;
const CHIP_H = 30;
const GAP = 22;

export function LongChainOverlay({ state, args }: OverlayProps<FunctionConfig, FunctionState>) {
  if (onGrid(state)) return null;
  const { columns, layout } = overlayData(state);
  const pair = neighborPairs(columns)[0];
  if (pair === undefined) return null;
  const raw = argsOf(args).x;
  const total = typeof raw === 'number' && Number.isInteger(raw) && raw >= 1 ? raw : 100;
  const k = pair.dy.div(pair.dx);
  const shown = Math.min(SHOWN, total);
  const top = footTop(layout) + 4;
  const rest = total - shown;

  return (
    <CanvasAlignedOverlay
      testId="long-chain"
      canvasSelector={RELATION_CANVAS}
      logicalWidth={layout.width}
      logicalHeight={layout.height}
    >
      {Array.from({ length: shown }, (_, i) => {
        const x = 8 + i * (CHIP_W + GAP);
        return (
          <g key={i} data-testid="long-chain-step">
            <rect
              x={x}
              y={top}
              width={CHIP_W}
              height={CHIP_H}
              rx={15}
              fill="#fff4e0"
              stroke="#c0731a"
              strokeWidth={3}
            />
            <text
              x={x + CHIP_W / 2}
              y={top + CHIP_H / 2}
              fontSize={17}
              fontWeight={800}
              textAnchor="middle"
              dominantBaseline="central"
              fill="#8a4b00"
            >
              {signed(k)}
            </text>
            <path
              d={`M${x + CHIP_W + 3} ${top + CHIP_H / 2} L${x + CHIP_W + GAP - 3} ${top + CHIP_H / 2}`}
              stroke="#c0731a"
              strokeWidth={3}
              strokeLinecap="round"
            />
          </g>
        );
      })}
      <text
        x={8 + shown * (CHIP_W + GAP)}
        y={top + CHIP_H / 2}
        fontSize={22}
        fontWeight={800}
        dominantBaseline="central"
        fill="#8a4b00"
      >
        …
      </text>
      <text
        x={8}
        y={top + CHIP_H + 20}
        fontSize={16}
        fontWeight={700}
        fill="#3d485c"
        data-testid="long-chain-more"
      >
        {rest > 0 ? `${S.overlay.chainMore(rest)} ` : ''}
        {S.overlay.chainTotal(total)}
      </text>
    </CanvasAlignedOverlay>
  );
}
