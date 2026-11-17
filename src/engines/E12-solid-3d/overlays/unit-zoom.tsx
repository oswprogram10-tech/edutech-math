/**
 * 힌트 ② `unit-zoom` (MC-VOLUME-UNIT-CONVERT-100):
 * 1cm³ 쌓기나무 한 줄(1m 막대) → 그 줄을 쌓은 한 층(정사각형 판) → 층을 쌓은 큰 정육면체를 차례로 그린다.
 * 막대에는 "1m = 100cm" 길이 표시만 쓰고, 개수 결과는 쓰지 않는다.
 */
import type { OverlayProps } from '../../../core/engine-sdk';
import { solid3dStrings as S } from '../strings.ko';
import type { SolidConfig, SolidState } from '../types';
import { NET_CARD_H, NET_CARD_HEADER_H, NET_CARD_W, NetHelperBox } from './NetHelperBox';
import { SvIsoBoxMini } from './svMini';
import { isoBoxSize, svOverlayAnchor } from './svMiniSize';

const INNER_W = NET_CARD_W;
const INNER_H = NET_CARD_H - NET_CARD_HEADER_H;
const COL_W = INNER_W / 3;
const CUBE_UNIT = 9;

function Arrow({ x, y }: { readonly x: number; readonly y: number }) {
  return (
    <polygon
      points={`${x + 6},${y} ${x - 2},${y - 5} ${x - 2},${y + 5}`}
      fill="#475569"
      data-testid="unit-zoom-arrow"
    />
  );
}

export function UnitZoomOverlay({ state }: OverlayProps<SolidConfig, SolidState>) {
  if (state.mode !== 'surface-volume') return null;
  const cubeSize = isoBoxSize(3, 3, 3, CUBE_UNIT);
  const midY = (INNER_H - 20) / 2;
  const barLen = COL_W - 14;
  const squares = 8;
  const sq = barLen / squares;
  const plate = COL_W - 22;
  const plateN = 6;
  const cell = plate / plateN;
  const labelStyle = { fontSize: 11, fontWeight: 800, fill: '#475569' } as const;

  return (
    <NetHelperBox
      testId="unit-zoom"
      titleTestId="unit-zoom-title"
      title={S.sv.overlay.unitZoomTitle}
      canvasSelector={svOverlayAnchor(state.settings.variant)}
    >
      <g data-testid="unit-zoom-row" transform={`translate(7, ${midY - 8})`}>
        {Array.from({ length: squares }, (_, i) => (
          <rect
            key={i}
            x={i * sq}
            y={0}
            width={sq}
            height={sq}
            fill="#dbe7ff"
            stroke="#334155"
            strokeWidth={1}
          />
        ))}
        <line x1={0} y1={sq + 8} x2={barLen} y2={sq + 8} stroke="#475569" strokeWidth={1.6} />
        <line x1={0} y1={sq + 4} x2={0} y2={sq + 12} stroke="#475569" strokeWidth={1.6} />
        <line x1={barLen} y1={sq + 4} x2={barLen} y2={sq + 12} stroke="#475569" strokeWidth={1.6} />
        <text
          x={barLen / 2}
          y={sq + 26}
          textAnchor="middle"
          fontSize={10.5}
          fontWeight={800}
          fill="#1d2330"
          data-testid="unit-zoom-length"
        >
          {S.sv.overlay.unitZoomLength}
        </text>
      </g>
      <Arrow x={COL_W - 2} y={midY} />
      <g data-testid="unit-zoom-layer" transform={`translate(${COL_W + 11}, ${midY - plate / 2})`}>
        {Array.from({ length: plateN * plateN }, (_, i) => (
          <rect
            key={i}
            x={(i % plateN) * cell}
            y={Math.floor(i / plateN) * cell}
            width={cell}
            height={cell}
            fill="#dbe7ff"
            stroke="#334155"
            strokeWidth={0.8}
          />
        ))}
      </g>
      <Arrow x={2 * COL_W - 2} y={midY} />
      <g
        data-testid="unit-zoom-cube"
        transform={`translate(${2 * COL_W + (COL_W - cubeSize.width) / 2}, ${midY - cubeSize.height / 2})`}
      >
        <SvIsoBoxMini w={3} d={3} h={3} unit={CUBE_UNIT} kind="cubes" idPrefix="uz" />
      </g>
      <text x={COL_W / 2} y={INNER_H - 8} textAnchor="middle" {...labelStyle}>
        {S.sv.overlay.unitZoomRow}
      </text>
      <text x={COL_W * 1.5} y={INNER_H - 8} textAnchor="middle" {...labelStyle}>
        {S.sv.overlay.unitZoomLayer}
      </text>
      <text x={COL_W * 2.5} y={INNER_H - 8} textAnchor="middle" {...labelStyle}>
        {S.sv.overlay.unitZoomCube}
      </text>
    </NetHelperBox>
  );
}
