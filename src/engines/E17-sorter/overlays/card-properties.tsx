/**
 * 힌트 ② card-properties (MC-GEO-PROTOTYPE-ONLY).
 *
 * 대상 카드를 P 표시와 함께 그리고, **이미 물은 질문**마다 그 카드의 답만 나열한다.
 * 묻지 않은 질문은 쓰지 않는다(비밀 카드 정보를 더 주지 않기 위해).
 */
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import { PANEL } from '../layout';
import { deckUnit } from '../deck';
import { answerQuestion, quadProps } from '../properties';
import { sorterStrings as S } from '../strings.ko';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import type { SorterConfig, SorterState } from '../types';
import { CardShape, SorterDefs } from '../views/CardShape';
import { marksOn, targetCard } from './helpers';

export function CardPropertiesOverlay({
  state,
  config,
  args,
}: OverlayProps<SorterConfig, SorterState>) {
  const card = targetCard(state, args);
  if (!card || card.points.length !== 4) return null;
  const props = quadProps(card);
  const asked = state.mode === 'secret-rule' ? state.asked.map((entry) => entry.question) : [];
  const unit = deckUnit([card], PANEL.width - 90, PANEL.height - 240, 14);
  const center = { x: PANEL.x + PANEL.width / 2, y: PANEL.y + 150 };
  const startY = PANEL.y + 268;

  return (
    <CanvasAlignedOverlay
      testId="card-properties"
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
        {S.overlay.cardProperties}
      </text>
      <CardShape card={card} unit={unit} center={center} showMarks={marksOn(config)} />
      {asked.length === 0 ? (
        <text x={PANEL.x + 18} y={startY} fontSize={16} fill="#6b7486">
          {S.overlay.propertiesEmpty}
        </text>
      ) : (
        asked.map((question, index) => {
          const answer = answerQuestion(question, props);
          return (
            <g key={`${question}-${index}`}>
              <text
                x={PANEL.x + 18}
                y={startY + index * 20}
                fontSize={15}
                fontWeight={600}
                fill="#1d2330"
              >
                {S.questionShort[question]}
              </text>
              <text
                x={PANEL.x + PANEL.width - 24}
                y={startY + index * 20}
                textAnchor="end"
                fontSize={15}
                fontWeight={700}
                fill={answer ? '#1c7c54' : '#c2410c'}
              >
                {answer ? S.secret.yes : S.secret.no}
              </text>
            </g>
          );
        })
      )}
    </CanvasAlignedOverlay>
  );
}
