/**
 * 힌트 ② unit-groups.
 * 내 컵의 블록을 기준 컵 한 묶음(예: 우유 4 + 시럽 1)씩 점선 고리로 묶는다.
 * 묶음에 안 들어가는 블록은 빗금으로 둔다. 몇 묶음인지는 글로 쓰지 않는다.
 * 블록이 없는 look(ratio)이거나 기준 컵·내 컵이 없으면 그리지 않는다.
 */
import { useId } from 'react';
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import { mixCups } from '../layout';
import type { Block } from '../layout';
import { CANVAS_SELECTOR, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import type { Ingredient, RatioConfig, RatioState } from '../types';

function groupCount(have: number, per: number): number {
  return per === 0 ? Number.POSITIVE_INFINITY : Math.floor(have / per);
}

function bounds(blocks: readonly Block[]) {
  const left = Math.min(...blocks.map((b) => b.x));
  const top = Math.min(...blocks.map((b) => b.y));
  const right = Math.max(...blocks.map((b) => b.x + b.w));
  const bottom = Math.max(...blocks.map((b) => b.y + b.h));
  return { x: left - 3, y: top - 3, w: right - left + 6, h: bottom - top + 6 };
}

export function UnitGroupsOverlay({ state }: OverlayProps<RatioConfig, RatioState>) {
  const hatchId = `e20-ug-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  if (state.mode !== 'mix' || state.error !== null || state.settings.look === 'ratio') return null;
  if (state.reference === null || state.reference.milk + state.reference.syrup === 0) return null;
  const cup = mixCups(state).find((c) => c.role === 'cup');
  if (!cup || cup.blocks.length === 0) return null;
  const per: Record<Ingredient, number> = {
    milk: state.reference.milk,
    syrup: state.reference.syrup,
  };
  const found = Math.min(groupCount(cup.milk, per.milk), groupCount(cup.syrup, per.syrup));
  const groups = Number.isFinite(found) ? found : 0;

  const rings: { group: number; kind: Ingredient; box: ReturnType<typeof bounds> }[] = [];
  const leftover: Block[] = [];
  for (const kind of ['milk', 'syrup'] as const) {
    const ofKind = cup.blocks.filter((b) => b.kind === kind);
    for (let g = 0; g < groups; g += 1) {
      const members = ofKind.filter(
        (b) => b.index >= g * per[kind] && b.index < (g + 1) * per[kind],
      );
      if (members.length > 0) rings.push({ group: g, kind, box: bounds(members) });
    }
    leftover.push(...ofKind.filter((b) => b.index >= groups * per[kind]));
  }

  return (
    <CanvasAlignedOverlay
      testId="overlay-unit-groups"
      canvasSelector={CANVAS_SELECTOR}
      logicalWidth={LOGICAL_WIDTH}
      logicalHeight={LOGICAL_HEIGHT}
    >
      <defs>
        <pattern
          id={hatchId}
          width={8}
          height={8}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line x1={0} y1={0} x2={0} y2={8} stroke="#c0392b" strokeWidth={3} />
        </pattern>
      </defs>
      {leftover.map((block) => (
        <rect
          key={`left-${block.kind}-${block.index}`}
          x={block.x + 1}
          y={block.y + 1}
          width={block.w - 2}
          height={block.h - 2}
          fill={`url(#${hatchId})`}
          fillOpacity={0.85}
          stroke="#c0392b"
          strokeWidth={2}
          data-part="leftover"
          data-kind={block.kind}
        />
      ))}
      {rings.map((ring) => (
        <rect
          key={`ring-${ring.kind}-${ring.group}`}
          x={ring.box.x}
          y={ring.box.y}
          width={ring.box.w}
          height={ring.box.h}
          rx={8}
          fill="none"
          stroke="#2f6fde"
          strokeWidth={3.5}
          strokeDasharray="8 5"
          data-part="group-ring"
          data-group={ring.group}
          data-kind={ring.kind}
        />
      ))}
    </CanvasAlignedOverlay>
  );
}
