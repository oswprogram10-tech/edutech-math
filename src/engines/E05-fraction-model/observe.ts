/**
 * E05의 관찰 결과.
 *
 * 판정·힌트는 이 값만 본다. 화면 좌표나 내부 조각 목록은 내보내지 않는다.
 * 수의 값은 모두 Rational 문자열(`"3/4"`, `"5"`)로 넣는다.
 */
import { Rational } from '../../core/math';
import type { JsonValue, Observation } from '../../core/engine-sdk';
import { cutDirectionCount, cutSignature, piecesAreEqual } from './geometry';
import { decimalLabel, denominatorNumber, gcd, mixedLabel, numeratorNumber } from './fractions';
import { overlayCells, piecesOf, simplifyView } from './reduce';
import type { EventCounts, FractionModelConfig, FractionModelState } from './types';

interface WholeEntry {
  readonly [key: string]: JsonValue;
  parts: number;
  equal: boolean;
  shaded: number;
  value: string;
  raw: string;
  reduced: string;
}

function wholeEntry(parts: number, shaded: number, equal = true): WholeEntry {
  const safeParts = Math.max(1, Math.trunc(parts));
  const safeShaded = Math.max(0, Math.trunc(shaded));
  const value = Rational.of(safeShaded, safeParts);
  return {
    parts: safeParts,
    equal,
    shaded: safeShaded,
    value: value.toString(),
    raw: `${safeShaded}/${safeParts}`,
    reduced: value.toString(),
  };
}

function improperEntry(parts: number, numerator: number): WholeEntry {
  const safeParts = Math.max(1, Math.trunc(parts));
  const safeNumerator = Math.max(0, Math.trunc(numerator));
  const value = Rational.of(safeNumerator, safeParts);
  return {
    parts: safeParts,
    equal: true,
    shaded: safeNumerator,
    value: value.toString(),
    raw: `${safeNumerator}/${safeParts}`,
    reduced: value.toString(),
  };
}

function countsRecord(counts: EventCounts): Record<string, number> {
  return {
    partitioned: counts.partitioned,
    shaded: counts.shaded,
    valueChanged: counts.valueChanged,
    fused: counts.fused,
    brokeWhole: counts.brokeWhole,
    overlaid: counts.overlaid,
    refined: counts.refined,
    coarsened: counts.coarsened,
  };
}

function isIrreducibleFraction(value: Rational): boolean {
  const numerator = numeratorNumber(value);
  const denominator = denominatorNumber(value);
  if (numerator === null || denominator === null) return false;
  return gcd(numerator, denominator) === 1 || numerator === 0;
}

export function observe(state: FractionModelState, config: FractionModelConfig): Observation {
  const counts = countsRecord(state.counters);
  const base = {
    mode: state.mode,
    cutSignature: '',
    commonGrid: null as number | null,
    counts,
    partitioned: counts['partitioned'] ?? 0,
    valueChanged: counts['valueChanged'] ?? 0,
    fused: counts['fused'] ?? 0,
    brokeWhole: counts['brokeWhole'] ?? 0,
    overlaid: counts['overlaid'] ?? 0,
    refined: counts['refined'] ?? 0,
    coarsened: counts['coarsened'] ?? 0,
  };

  switch (state.mode) {
    case 'partition': {
      const pieces = piecesOf(state);
      const parts = pieces.length;
      const shaded = state.shaded.filter((index) => index < parts).length;
      const equal = piecesAreEqual(pieces, state.tolerance);
      const simplify = simplifyView(state);
      const entry = wholeEntry(parts, shaded, equal);
      return {
        ...base,
        wholes: [entry],
        cutSignature: cutSignature(state.cuts),
        cutDirections: cutDirectionCount(state.cuts),
        commonGrid: null,
        fixedParts: state.fixedParts,
        equal,
        shaded,
        irreducible: simplify.irreducible,
        simplify:
          state.simplify === null
            ? null
            : {
                numerator: state.simplify.numerator,
                denominator: state.simplify.denominator,
                groupSize: simplify.groupSize,
                groupCount: simplify.groupCount,
                groupedNumerator: simplify.groupedNumerator,
                groupedDenominator: simplify.groupedDenominator,
                irreducible: simplify.irreducible,
              },
        fraction: config.fraction ?? null,
      };
    }

    case 'shade': {
      const entry = wholeEntry(state.parts, state.shaded.length);
      return {
        ...base,
        wholes: [entry],
        commonGrid: null,
        equal: true,
        shaded: state.shaded.length,
        parts: state.parts,
        irreducible: state.shaded.length === 0 || gcd(state.shaded.length, state.parts) === 1,
        refineFactors: config.refine ? [...config.refine] : null,
        coarsen: config.coarsen ?? false,
      };
    }

    case 'compare': {
      const wholes = state.bars.map((bar) => wholeEntry(bar.parts, bar.shaded.length));
      const values = wholes.map((entry) => Rational.parse(entry.value));
      const largestIndex = values.reduce(
        (best, value, index) =>
          best === -1 || value.compareTo(values[best] ?? Rational.of(0)) > 0 ? index : best,
        -1,
      );
      return {
        ...base,
        wholes,
        commonGrid: null,
        bars: state.bars.map((bar, index) => ({
          ...wholeEntry(bar.parts, bar.shaded.length),
          label: bar.label ?? null,
          selected: state.selectedBar === index,
        })),
        selectedBar: state.selectedBar,
        largestIndex,
        align: state.align,
        equal: true,
        irreducible: false,
      };
    }

    case 'overlay-slicer': {
      const cells = overlayCells(state);
      const a = Rational.parse(state.a);
      const b = Rational.parse(state.b);
      const aDen = denominatorNumber(a) ?? 1;
      const bDen = denominatorNumber(b) ?? 1;
      return {
        ...base,
        wholes: [
          improperEntry(aDen, numeratorNumber(a) ?? 0),
          improperEntry(bDen, numeratorNumber(b) ?? 0),
        ],
        commonGrid: state.grid,
        overlaid: state.overlaid,
        a: state.a,
        b: state.b,
        aCells: cells?.a ?? null,
        bCells: cells?.b ?? null,
        orientation: state.orientation,
        equal: true,
        irreducible: isIrreducibleFraction(a) && isIrreducibleFraction(b),
      };
    }

    case 'discrete': {
      const groups = Math.max(1, Math.floor(state.items / state.groupSize));
      const selected = state.selectedGroups.filter((index) => index < groups).length;
      const entry = wholeEntry(groups, selected);
      return {
        ...base,
        wholes: [entry],
        commonGrid: null,
        groupSize: state.groupSize,
        groups,
        items: state.items,
        selectedGroups: [...state.selectedGroups],
        selectedCount: selected * state.groupSize,
        icon: state.icon,
        showFractionOf: state.showFractionOf,
        equal: true,
        irreducible: isIrreducibleFraction(Rational.of(selected, groups)),
      };
    }

    case 'mixed': {
      if (state.kind === 'problem') {
        const a = state.a !== null ? Rational.parse(state.a) : Rational.of(0);
        const b = state.b !== null ? Rational.parse(state.b) : Rational.of(0);
        const aDen = denominatorNumber(a) ?? 1;
        const bDen = denominatorNumber(b) ?? 1;
        return {
          ...base,
          wholes: [
            improperEntry(aDen, numeratorNumber(a) ?? 0),
            improperEntry(bDen, numeratorNumber(b) ?? 0),
          ],
          commonGrid: state.commonGrid,
          a: state.a,
          b: state.b,
          op: state.op,
          combined: state.combined,
          result: state.result,
          resultMixed: state.result !== null ? mixedLabel(Rational.parse(state.result)) : null,
          borrowed: state.borrowed,
          naturalPart: state.naturalPart,
          pieceCount: state.pieceCount,
          pieceDenominator: state.pieceDenominator,
          pieceValue:
            state.pieceCount !== null && state.pieceDenominator !== null
              ? `${state.pieceCount}/${state.pieceDenominator}`
              : null,
          equal: true,
          irreducible:
            state.result !== null ? isIrreducibleFraction(Rational.parse(state.result)) : false,
        };
      }
      const total = state.wholes * state.denominator + state.pieces;
      const value = Rational.of(total, state.denominator);
      const improper = improperEntry(state.denominator, total);
      const reducibleWhole = gcd(total, state.denominator) !== 1 && total !== 0;
      return {
        ...base,
        wholes: [improper],
        commonGrid: null,
        kind: 'convert',
        denominator: state.denominator,
        wholeCount: state.wholes,
        remainderNumerator: state.pieces,
        improperNumerator: total,
        improperLabel: improper.raw,
        mixedLabel: mixedLabel(value),
        value: value.toString(),
        fusedCount: state.counters.fused,
        brokeWholeCount: state.counters.brokeWhole,
        equal: true,
        irreducible: !reducibleWhole && state.pieces < state.denominator,
      };
    }

    case 'add-sub': {
      const a = Rational.parse(state.a);
      const b = Rational.parse(state.b);
      const aDen = denominatorNumber(a) ?? 1;
      const bDen = denominatorNumber(b) ?? 1;
      const result = state.result !== null ? Rational.parse(state.result) : null;
      return {
        ...base,
        wholes: [
          improperEntry(aDen, numeratorNumber(a) ?? 0),
          improperEntry(bDen, numeratorNumber(b) ?? 0),
        ],
        commonGrid: state.commonGrid,
        op: state.op,
        a: state.a,
        b: state.b,
        aMixed: mixedLabel(a),
        bMixed: mixedLabel(b),
        combined: state.combined,
        result: state.result,
        resultMixed: result !== null ? mixedLabel(result) : null,
        strategy: state.strategy,
        borrowed: state.borrowed,
        requireCommonGrid: state.requireCommonGrid,
        equal: true,
        irreducible: result !== null ? isIrreducibleFraction(result) : false,
      };
    }

    case 'decimal-grid': {
      const total = state.size * state.size;
      const layers = Array.from({ length: state.layers }, (_, index) => {
        const cells = state.shaded.filter(
          (cell) => cell >= index * total && cell < (index + 1) * total,
        ).length;
        const value = Rational.of(cells, total);
        return {
          index,
          cells,
          total,
          value: value.toString(),
          decimal: decimalLabel(value),
          current: state.layer === index,
        };
      });
      const totalShaded = layers.reduce((sum, layer) => sum + layer.cells, 0);
      const combined = Rational.of(totalShaded, total * state.layers);
      return {
        ...base,
        wholes: layers.map((layer) => wholeEntry(layer.total, layer.cells)),
        commonGrid: null,
        size: state.size,
        layer: state.layer,
        layers,
        totalShaded,
        value: combined.toString(),
        equal: true,
        irreducible: totalShaded === 0,
      };
    }
  }
}
