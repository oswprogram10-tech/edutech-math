/**
 * E12 `shapes-sort` 모드 Observation 생성(순수 함수).
 *
 * `mysteryKind`·`rampResult`·`trials`는 판정용이다. 학생 화면에는 쓰지 않는다.
 */
import type { JsonValue, Observation } from '../../../core/engine-sdk';
import type { ShapesState } from '../types';
import { itemOf, partOf } from './reduce';
import { rampResult, type ShapeKind } from './rules';

function uniqueKinds(kinds: readonly ShapeKind[]): ShapeKind[] {
  const out: ShapeKind[] = [];
  for (const kind of kinds) if (!out.includes(kind)) out.push(kind);
  return out;
}

export function observeShapes(state: ShapesState): Observation {
  const selectedItem = itemOf(state, state.selected);
  const rampPart = state.rampItem === null ? null : partOf(state, state.rampItem);
  const tower = state.tower.flatMap((id) => {
    const part = partOf(state, id);
    return part ? [{ kind: part.kind, pose: part.pose }] : [];
  });

  const obs: Record<string, JsonValue> = {
    mode: state.mode,
    scene: state.settings.scene,
    selected: state.selected,
    selectedKind: selectedItem ? selectedItem.kind : null,
    trials: state.trials.map((t) => ({ kind: t.kind, pose: t.pose, result: t.result })),
    triedKinds: uniqueKinds(state.trials.map((t) => t.kind)),
    rolledKinds: uniqueKinds(state.trials.filter((t) => t.result === 'roll').map((t) => t.kind)),
    rampPlayed: state.rampPlayed,
    rampResult: state.rampPlayed && rampPart ? rampResult(rampPart.kind, rampPart.pose) : null,
    tower,
    towerHeight: tower.length,
    towerKinds: uniqueKinds(tower.map((t) => t.kind)),
    fallenCount: state.fallen.length,
    cluesShown: state.cluesShown,
    mysteryKind: state.settings.mystery ? state.settings.mystery.kind : null,
  };
  return obs;
}
