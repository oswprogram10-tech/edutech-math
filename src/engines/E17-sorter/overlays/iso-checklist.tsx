/**
 * 힌트 ② iso-checklist (MC-GEO-EQUI-NOT-ISO).
 *
 * 대상 삼각형을 변 눈금과 함께 크게 그리고, "이등변삼각형 조건: 두 변의 길이가 같다"
 * 한 줄과 그 카드의 계산 결과 ✓/✗만 쓴다. 도형 이름은 쓰지 않는다.
 */
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import { PANEL } from '../layout';
import { deckCards, deckUnit } from '../deck';
import type { DeckCard } from '../deck';
import { triangleProps } from '../properties';
import { sorterStrings as S } from '../strings.ko';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import type { SorterConfig, SorterState } from '../types';
import { CardShape, SorterDefs } from '../views/CardShape';
import { argsOf, marksOn, stringArg } from './helpers';

function isoCard(state: SorterState, args: unknown): DeckCard | null {
  const cards = deckCards('triangles-12');
  const requested = stringArg(argsOf(args), 'card');
  if (requested !== null) return cards.find((card) => card.id === requested) ?? null;
  if (state.mode === 'venn') {
    const placed = cards.find((card) => {
      const cell = state.placements[card.id];
      return cell !== null && cell !== undefined && triangleProps(card).sides === 'equilateral';
    });
    if (placed) return placed;
  }
  return cards.find((card) => triangleProps(card).sides === 'equilateral') ?? null;
}

export function IsoChecklistOverlay({
  state,
  config,
  args,
}: OverlayProps<SorterConfig, SorterState>) {
  const card = isoCard(state, args);
  if (!card) return null;
  const unit = deckUnit([card], PANEL.width - 80, PANEL.height - 200, 16);
  const center = { x: PANEL.x + PANEL.width / 2, y: PANEL.y + 176 };
  const isosceles = triangleProps(card).sides !== 'scalene';
  return (
    <CanvasAlignedOverlay
      testId="iso-checklist"
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
        {S.overlay.isoChecklist}
      </text>
      <CardShape card={card} unit={unit} center={center} showMarks={marksOn(config)} />
      <text
        x={PANEL.x + 18}
        y={PANEL.y + PANEL.height - 66}
        fontSize={16}
        fontWeight={600}
        fill="#1d2330"
      >
        {S.overlay.isoCondition}
      </text>
      <text
        x={PANEL.x + 18}
        y={PANEL.y + PANEL.height - 28}
        fontSize={24}
        fontWeight={700}
        fill={isosceles ? '#1c7c54' : '#c2410c'}
      >
        {S.hierarchy.conditionResult(isosceles)}
      </text>
      <text
        x={PANEL.x + 52}
        y={PANEL.y + PANEL.height - 28}
        fontSize={16}
        fontWeight={600}
        fill="#3d485c"
      >
        {isosceles ? S.secret.youAreRight : ''}
      </text>
    </CanvasAlignedOverlay>
  );
}
