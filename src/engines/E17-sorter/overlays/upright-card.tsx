/**
 * 힌트 ② upright-card (MC-GEO-TRI-ISOSCELES-ORIENT, MC-GEO-RHOMBUS-ORIENT).
 *
 * 학생이 다룬 카드 하나를 돋보기 판에 크게 그리고, 그 카드를 돌려 밑변이 수평으로
 * 아래에 오게 한 반투명 그림을 겹친다. 어느 칸·어느 이름이 정답인지는 그리지 않는다.
 */
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import { PANEL, cardScreenPoints } from '../layout';
import { sorterStrings as S } from '../strings.ko';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import type { SorterConfig, SorterState } from '../types';
import { CardShape, SorterDefs, uprightPolygon } from '../views/CardShape';
import { baseSideIndex, cardFrameOf, marksOn, panelCenter, panelUnit, targetCard } from './helpers';

export function UprightCardOverlay({
  state,
  config,
  args,
}: OverlayProps<SorterConfig, SorterState>) {
  const card = targetCard(state, args);
  if (!card) return null;
  const unit = panelUnit(card);
  const center = panelCenter();
  const points = cardScreenPoints(card, unit, center);
  const ghost = uprightPolygon(points, baseSideIndex(card), {
    x: PANEL.x + 24,
    y: PANEL.y + 58,
    width: PANEL.width - 48,
    height: PANEL.height - 78,
  });
  const frame = cardFrameOf(state, card);
  const polygon = ghost
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ');

  return (
    <CanvasAlignedOverlay
      testId="upright-card"
      canvasSelector={'svg[data-testid="sorter-canvas"]'}
      logicalWidth={LOGICAL_WIDTH}
      logicalHeight={LOGICAL_HEIGHT}
    >
      <SorterDefs />
      <rect
        x={PANEL.x}
        y={PANEL.y}
        width={PANEL.width}
        height={PANEL.height}
        fill="#ffffff"
        stroke="#c9d2e2"
        strokeWidth={2}
        rx={14}
      />
      <text x={PANEL.x + 18} y={PANEL.y + 34} fontSize={17} fontWeight={700} fill="#1d2330">
        {S.overlay.uprightCard}
      </text>
      <CardShape card={card} unit={unit} center={center} showMarks={marksOn(config)} />
      {ghost.length >= 3 ? (
        <path
          d={`${polygon} Z`}
          fill="none"
          stroke="#2f6fde"
          strokeWidth={5}
          strokeDasharray="14 9"
          strokeLinejoin="round"
          opacity={0.75}
        />
      ) : null}
      {frame ? (
        <rect
          x={frame.x + 2}
          y={frame.y + 2}
          width={frame.width - 4}
          height={frame.height - 4}
          fill="none"
          stroke="#e8872e"
          strokeWidth={5}
          rx={10}
          strokeDasharray="12 8"
        />
      ) : null}
    </CanvasAlignedOverlay>
  );
}
