/**
 * E17 ?�버?�이 공용 ?�우�? ?�답(?�느 칸·어???�름)?� 계산?��? ?�는??
 * ?�생???�룬 카드 ?�나�?고르거나, ?�재 모양???�질�??�시 계산?�다.
 */
import { dist2Scaled } from '../../../core/math';
import { boxCenter, PANEL, secretCardBox, vennCardFrame } from '../layout';
import { deckCards, deckUnit } from '../deck';
import type { DeckCard } from '../deck';
import { wrongEliminationsOf } from '../observe';
import { cardPoints, cardScale } from '../properties';
import type { CardId, SorterConfig, SorterState } from '../types';

export function argsOf(args: unknown): Readonly<Record<string, unknown>> {
  if (args === null || typeof args !== 'object' || Array.isArray(args)) return {};
  return args as Readonly<Record<string, unknown>>;
}

export function stringArg(args: Readonly<Record<string, unknown>>, key: string): string | null {
  const value = args[key];
  return typeof value === 'string' ? value : null;
}

export function stringListArg(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function cardIn(deck: 'triangles-12' | 'quadrilaterals-16', id: CardId | null): DeckCard | null {
  if (id === null) return null;
  return deckCards(deck).find((card) => card.id === id) ?? null;
}

/** ?�버?�이 ?�??카드. `args.card` ??모드 기본�????�으�?null. */
export function targetCard(state: SorterState, args: unknown): DeckCard | null {
  const requested = stringArg(argsOf(args), 'card');
  if (state.mode === 'venn') {
    return cardIn('triangles-12', requested ?? state.lastPlaced);
  }
  if (state.mode === 'secret-rule') {
    const wrong = wrongEliminationsOf(state);
    const fallback = wrong[wrong.length - 1] ?? state.swap.secret;
    return cardIn('quadrilaterals-16', requested ?? fallback);
  }
  return null;
}

/** ?�보�????�에 카드 ?�나가 ?�게 ?�어가??배율. */
export function panelUnit(card: DeckCard): number {
  return deckUnit([card], PANEL.width - 80, PANEL.height - 120, 20);
}

export function panelCenter(): { readonly x: number; readonly y: number } {
  return boxCenter(PANEL);
}

/** ?�??카드???�제 ?�면 ?�리(굵�? ?�두리용). */
export function cardFrameOf(
  state: SorterState,
  card: DeckCard,
): {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
} | null {
  if (state.mode === 'venn') {
    const frame = vennCardFrame(state, card.id);
    return frame ? frame.box : null;
  }
  if (state.mode === 'secret-rule') {
    const index = deckCards(state.deck).findIndex((candidate) => candidate.id === card.id);
    if (index < 0) return null;
    return secretCardBox(index);
  }
  return null;
}

/** 밑�??�로 ??변 번호. ?�각?��? 길이가 ?�나뿐인 변, ?�으�?가??�?변. ?�각?��? 가??�?변. */
export function baseSideIndex(card: DeckCard): number {
  const points = cardPoints(card);
  const scale = cardScale(card);
  const lengths = points.map((point, index) =>
    dist2Scaled(point, points[(index + 1) % points.length] ?? point, scale),
  );
  const at = (index: number) => lengths[index] ?? lengths[0];
  if (points.length === 3) {
    for (let index = 0; index < lengths.length; index += 1) {
      const mine = at(index);
      const unique = lengths.every((other, otherIndex) =>
        otherIndex === index ? true : !(mine && mine.equals(other)),
      );
      if (unique) return index;
    }
  }
  let best = 0;
  for (let index = 1; index < lengths.length; index += 1) {
    const candidate = at(index);
    const current = at(best);
    if (candidate && current && candidate.compareTo(current) > 0) best = index;
  }
  return best;
}

/** ?�버?�이??P ?�시???�정 `marks`�?본다(?�버?�이????�� C ?�계 ??. */
export function marksOn(config: SorterConfig): boolean {
  const record = argsOf(config);
  return record['marks'] !== 'hide';
}
