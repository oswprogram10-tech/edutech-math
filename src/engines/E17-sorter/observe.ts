/**
 * E17의 관찰 결과. 판정·힌트는 이 값만 본다.
 *
 * - 카드 이름·목표 칸·정답 트리 이름은 넣지 않는다.
 * - 비밀 카드 id도 넣지 않는다(판정은 `solved`로 충분).
 */
import type { Observation } from '../../core/engine-sdk';
import { deckCards } from './deck';
import {
  blanksCorrect,
  answerQuestion,
  fitsCell,
  hierarchyProps,
  quadNames,
  quadNode,
  quadProps,
  sideMatches,
  triangleProps,
  wrongBlankNodes,
} from './properties';
import type { QuadProps } from './properties';
import type {
  CardId,
  CellKey,
  HierarchyState,
  QuadName,
  SecretRuleState,
  SorterState,
  VennState,
} from './types';

function parse(cell: CellKey): { readonly row: string; readonly col: string } | null {
  const [row, col] = cell.split('|');
  if (row === undefined || col === undefined) return null;
  return { row, col };
}

function vennObservation(state: VennState): Observation {
  const cards = deckCards(state.deck);
  const placed = cards.filter((card) => {
    const cell = state.placements[card.id];
    return cell !== null && cell !== undefined;
  });
  const wrongCards = placed
    .filter((card) => {
      const cell = state.placements[card.id];
      return (
        cell !== null &&
        cell !== undefined &&
        !fitsCell(card, cell, state.settings.rows, state.settings.cols)
      );
    })
    .map((card) => card.id)
    .sort();
  const allPlaced = cards.every((card) => {
    const cell = state.placements[card.id];
    return cell !== null && cell !== undefined;
  });

  const misconceptions = new Set<string>();
  for (const card of placed) {
    const cell = state.placements[card.id];
    if (cell === null || cell === undefined) continue;
    const parsed = parse(cell);
    if (!parsed) continue;
    const props = triangleProps(card);
    if (parsed.row === 'acute' && props.angles === 'obtuse') {
      misconceptions.add('MC-GEO-ACUTE-TRI-ONE-ANGLE');
    }
    if (
      !card.prototype &&
      props.sides === 'isosceles-only' &&
      !sideMatches(props.sides, parsed.col as never)
    ) {
      misconceptions.add('MC-GEO-TRI-ISOSCELES-ORIENT');
    }
  }

  return {
    mode: state.mode,
    placements: Object.fromEntries(
      cards.map((card) => [card.id, state.placements[card.id] ?? null]),
    ),
    placedCount: placed.length,
    allPlaced,
    wrongCards,
    allCorrect: allPlaced && wrongCards.length === 0,
    impossibleMarked: [...state.impossible].sort(),
    checks: state.checks,
    misconceptions: [...misconceptions].sort(),
  };
}

function propsById(cards: ReturnType<typeof deckCards>): ReadonlyMap<CardId, QuadProps> {
  return new Map(cards.map((card) => [card.id, quadProps(card)]));
}

/**
 * 지운 카드 중 지금까지 물은 모든 질문의 답이 비밀 카드와 같은 카드(=모순).
 * 질문이 하나도 없으면 지운 카드 전부가 여기에 들어간다.
 */
export function wrongEliminationsOf(state: SecretRuleState): CardId[] {
  const props = propsById(deckCards(state.deck));
  return state.eliminated
    .filter((id) => {
      const cardProps = props.get(id);
      if (!cardProps) return false;
      return state.asked.every(
        (entry) => answerQuestion(entry.question, cardProps) === entry.answer,
      );
    })
    .sort();
}

function secretObservation(state: SecretRuleState): Observation {
  const cards = deckCards(state.deck);
  const wrongEliminations = wrongEliminationsOf(state);

  const swapErrors = state.swap.log.filter((entry) => entry.answer !== entry.truth).length;
  const misconceptions = new Set<string>();
  for (const id of wrongEliminations) {
    const card = cards.find((candidate) => candidate.id === id);
    if (!card || card.prototype) continue;
    misconceptions.add('MC-GEO-PROTOTYPE-ONLY');
    if (quadProps(card).allSidesEqual) misconceptions.add('MC-GEO-RHOMBUS-ORIENT');
  }
  if (swapErrors > 0 && state.swap.secret !== null) {
    const mine = cards.find((card) => card.id === state.swap.secret);
    if (mine && !mine.prototype) {
      misconceptions.add('MC-GEO-PROTOTYPE-ONLY');
      if (quadProps(mine).allSidesEqual) misconceptions.add('MC-GEO-RHOMBUS-ORIENT');
    }
  }

  return {
    mode: state.mode,
    variant: state.variant,
    role: state.role,
    questionCount: state.asked.length,
    askedQuestions: state.asked.map((entry) => entry.question),
    eliminated: [...state.eliminated].sort(),
    remaining: cards.length - state.eliminated.length,
    wrongEliminations,
    solved: state.solved,
    guessCount: state.guesses.length,
    swapPicked: state.swap.secret !== null,
    swapAnswers: state.swap.log.length,
    swapErrors,
    swapDone: state.swap.done,
    misconceptions: [...misconceptions].sort(),
  };
}

function hierarchyObservation(state: HierarchyState): Observation {
  const { props } = hierarchyProps(state.toggles);
  const node = quadNode(props, state.settings.trapezoidDefinition);
  const names = quadNames(props, state.settings.trapezoidDefinition);
  const blanks: Record<string, string | null> = {};
  let filled = 0;
  for (const blank of state.settings.treeBlanks) {
    const value = state.blanks[blank] ?? null;
    blanks[blank] = value;
    if (value !== null) filled += 1;
  }
  const correct = blanksCorrect(state.blanks, state.settings.treeBlanks);
  const wrong = wrongBlankNodes(state.blanks, state.settings.treeBlanks);

  return {
    mode: state.mode,
    toggles: [...state.toggles],
    currentNode: node,
    names,
    parallelPairs: props.parallelPairs,
    allSidesEqual: props.allSidesEqual,
    rightAngleCount: props.rightAngles.length,
    trapezoidDefinition: state.settings.trapezoidDefinition,
    blanks,
    blanksFilled: filled,
    blanksCorrect: correct,
    wrongBlanks: wrong,
    misconceptions: [],
  };
}

export function observe(state: SorterState): Observation {
  if (state.mode === 'venn') return vennObservation(state);
  if (state.mode === 'secret-rule') return secretObservation(state);
  return hierarchyObservation(state);
}

/** 현재 모양의 가장 좁은 이름(hierarchy 오버레이·View 공용). */
export function currentNodeOf(state: HierarchyState): QuadName {
  const { props } = hierarchyProps(state.toggles);
  return quadNode(props, state.settings.trapezoidDefinition);
}

/** 카드 성질(뷰·오버레이 공용). 카드가 없으면 null. */
export function cardPropsOf(deck: 'triangles-12' | 'quadrilaterals-16', cardId: CardId) {
  const card = deckCards(deck).find((candidate) => candidate.id === cardId);
  return card ? quadProps(card) : null;
}
