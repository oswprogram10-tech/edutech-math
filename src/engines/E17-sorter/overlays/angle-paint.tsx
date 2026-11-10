/**
 * 힌트 ② angle-paint (MC-GEO-ACUTE-TRI-ONE-ANGLE).
 *
 * 대상 삼각형의 세 각을 모두 부채꼴로 칠하고, 가장 큰 각만 빗금·굵은 호로 표시한다.
 * "둔각" 같은 이름은 쓰지 않는다. 기본 대상은 `acute` 행에 놓인 카드 중 각이
 * 예각이 아닌 첫 카드다.
 */
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import { PANEL, cardScreenPoints } from '../layout';
import { deckCards } from '../deck';
import type { DeckCard } from '../deck';
import { triangleProps } from '../properties';
import { sorterStrings as S } from '../strings.ko';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import type { SorterConfig, SorterState } from '../types';
import { CardShape, SorterDefs } from '../views/CardShape';
import { arcPath, sectorPath } from '../views/CardShape';
import { argsOf, marksOn, panelCenter, panelUnit, stringArg } from './helpers';

function angleTarget(state: SorterState, args: unknown): DeckCard | null {
  if (state.mode !== 'venn') return null;
  const requested = stringArg(argsOf(args), 'card');
  const cards = deckCards('triangles-12');
  if (requested !== null) {
    return cards.find((card) => card.id === requested) ?? null;
  }
  const acute = cards.find((card) => {
    const cell = state.placements[card.id];
    return (
      cell !== null &&
      cell !== undefined &&
      cell.startsWith('acute|') &&
      triangleProps(card).angles !== 'acute'
    );
  });
  if (acute) return acute;
  return cards.find((card) => card.id === state.lastPlaced) ?? null;
}

export function AnglePaintOverlay({
  state,
  config,
  args,
}: OverlayProps<SorterConfig, SorterState>) {
  const card = angleTarget(state, args);
  if (!card) return null;
  const unit = panelUnit(card);
  const center = panelCenter();
  const points = cardScreenPoints(card, unit, center);
  const props = triangleProps(card);
  const largest = props.largestAngle;
  const largestPoint = points[largest];
  return (
    <CanvasAlignedOverlay
      testId="angle-paint"
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
        {S.overlay.anglePaint}
      </text>
      <CardShape card={card} unit={unit} center={center} showMarks={marksOn(config)} />
      {points.map((vertex, index) => {
        const previous = points[(index - 1 + points.length) % points.length];
        const next = points[(index + 1) % points.length];
        if (!previous || !next) return null;
        const radius =
          Math.min(
            Math.hypot(previous.x - vertex.x, previous.y - vertex.y),
            Math.hypot(next.x - vertex.x, next.y - vertex.y),
          ) * 0.3;
        const highlighted = index === largest;
        return (
          <g key={`angle-${index}`}>
            <path
              d={sectorPath(vertex, previous, next, radius)}
              fill={highlighted ? 'url(#sorter-hatch)' : '#2f6fde'}
              fillOpacity={highlighted ? 0.55 : 0.2}
              stroke={highlighted ? '#c2410c' : '#2f6fde'}
              strokeWidth={highlighted ? 4 : 2}
            />
            {highlighted ? (
              <path
                d={arcPath(vertex, previous, next, radius + 10)}
                fill="none"
                stroke="#c2410c"
                strokeWidth={6}
                strokeLinecap="round"
              />
            ) : null}
          </g>
        );
      })}
      {largestPoint ? (
        <text
          x={largestPoint.x}
          y={largestPoint.y + 40}
          textAnchor="middle"
          fontSize={16}
          fontWeight={700}
          fill="#c2410c"
        >
          {S.overlay.largestAngle}
        </text>
      ) : null}
    </CanvasAlignedOverlay>
  );
}
