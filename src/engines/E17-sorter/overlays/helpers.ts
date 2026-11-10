/**
 * E17 오버레이 공용 도우미. 정답(어느 칸·어느 이름)을 계산하지 않는다.
 * 학생이 그린 카드 하나를 고르거나, 지금 모양의 성질을 다시 계산한다.
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

/** 오버레이 대상 카드. `args.card`가 없으면 모드 기본값에서 고르고, 없으면 null. */
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

/** 오버레이 패널에 카드 하나가 크게 들어가는 배율. */
export function panelUnit(card: DeckCard): number {
  return deckUnit([card], PANEL.width - 80, PANEL.height - 120, 20);
}

export function panelCenter(): { readonly x: number; readonly y: number } {
  return boxCenter(PANEL);
}

/** 이 카드가 실제 그려진 자리(굵은 테두리용). */
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

/** 밑변으로 쓸 변 번호. 삼각형은 길이가 하나뿐인 변, 없으면 가장 긴 변. 사각형은 가장 긴 변. */
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

/** 오버레이의 P 표시는 설정 marks를 본다(오버레이에서는 C 단계 제외). */
export function marksOn(config: SorterConfig): boolean {
  const record = argsOf(config);
  return record['marks'] !== 'hide';
}
