/** E13 length 설정 검사·정리와 틈·겹침 계산, 자석. 측정값은 Rational로만 계산한다. */
import { Rational } from '../../../core/math';
import { rat, ratFromConfig } from '../rat';
import { E13_STRINGS as S } from '../strings.ko';
import { unitLength, unitOf } from '../units';
import { BAND_EXTRA_CM } from './types';
import type { LengthConfig, MeasureState, Piece } from './types';

const ZERO = Rational.of(0);
const ONE = Rational.of(1);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 설정이 `mode`뿐이면 샌드박스 기본(연필 12cm, 클립·1cm 블록, 자 만들기)을 쓴다. */
export function sandboxDefault(): LengthConfig {
  return {
    mode: 'length',
    object: { name: 'pencil', lengthCm: '12' },
    units: ['clip-3cm', 'cm-block'],
    buildRuler: true,
  };
}

function failure(): MeasureState {
  return {
    mode: 'length',
    error: S.configError,
    objectName: '',
    objectCm: '0',
    units: [],
    showGapOverlap: true,
    buildRuler: false,
    demo: null,
    pieces: [],
    rulerMade: false,
    labels: {},
    moves: 0,
  };
}

export function normalizeLength(config: LengthConfig): MeasureState {
  const source: unknown =
    isRecord(config) && Object.keys(config).every((key) => key === 'mode')
      ? sandboxDefault()
      : config;
  if (!isRecord(source)) return failure();
  const object = source['object'];
  if (!isRecord(object)) return failure();
  const name = object['name'];
  const objectCm = ratFromConfig(object['lengthCm']);
  if (typeof name !== 'string' || name.length === 0 || objectCm === null) return failure();
  if (objectCm.compareTo(ZERO) <= 0 || objectCm.compareTo(Rational.of(100)) > 0) return failure();
  const rawUnits = source['units'];
  if (!Array.isArray(rawUnits) || rawUnits.length === 0) return failure();
  const units: string[] = [];
  for (const id of rawUnits as unknown[]) {
    if (typeof id !== 'string' || unitOf(id) === undefined) return failure();
    if (!units.includes(id)) units.push(id);
  }
  let demo: MeasureState['demo'] = null;
  if (source['demoSpans'] !== undefined) {
    const raw = source['demoSpans'];
    if (!isRecord(raw)) return failure();
    const demoCm = ratFromConfig(raw['objectCm']);
    const demoName = raw['objectName'];
    if (typeof demoName !== 'string' || demoName.length === 0 || demoCm === null) return failure();
    if (demoCm.compareTo(ZERO) <= 0 || demoCm.compareTo(Rational.of(200)) > 0) return failure();
    demo = { objectName: demoName, objectCm: demoCm.toString() };
  }
  return {
    mode: 'length',
    error: null,
    objectName: name,
    objectCm: objectCm.toString(),
    units,
    showGapOverlap: source['showGapOverlap'] !== false,
    buildRuler: source['buildRuler'] === true,
    demo,
    pieces: [],
    rulerMade: false,
    labels: {},
    moves: 0,
  };
}

// ── 길이 계산 ────────────────────────────────────────────

export function objectLength(state: Pick<MeasureState, 'objectCm'>): Rational {
  return rat(state.objectCm) ?? ZERO;
}

/** 띠 범위(cm): 0 ~ 물건 길이 + 15. */
export function bandLength(state: Pick<MeasureState, 'objectCm'>): Rational {
  return objectLength(state).add(Rational.of(BAND_EXTRA_CM));
}

export function pieceStart(piece: Piece): Rational {
  return rat(piece.start) ?? ZERO;
}

export function pieceLength(piece: Piece): Rational {
  return unitLength(piece.unit) ?? ZERO;
}

export function pieceEnd(piece: Piece): Rational {
  return pieceStart(piece).add(pieceLength(piece));
}

/** 시작 위치 순(같으면 놓은 순서)으로 정렬한 조각. */
export function sortedPieces(pieces: readonly Piece[]): Piece[] {
  return pieces
    .map((piece, index) => ({ piece, index }))
    .sort((a, b) => {
      const byStart = pieceStart(a.piece).compareTo(pieceStart(b.piece));
      return byStart !== 0 ? byStart : a.index - b.index;
    })
    .map(({ piece }) => piece);
}

export interface Span {
  readonly from: Rational;
  readonly to: Rational;
}

export interface Analysis {
  /** 틈(앞 틈 포함)과 겹침 구간. */
  readonly gaps: readonly Span[];
  readonly overlaps: readonly Span[];
  readonly startsAtZero: boolean;
  readonly reachesEnd: boolean;
  readonly exact: boolean;
}

/** 조각을 시작 위치 순으로 놓고 이웃끼리 비교해 틈·겹침을 센다. 첫 조각이 0이 아니면 앞 틈이다. */
export function analyze(state: Pick<MeasureState, 'pieces' | 'objectCm'>): Analysis {
  const sorted = sortedPieces(state.pieces);
  const gaps: Span[] = [];
  const overlaps: Span[] = [];
  const first = sorted[0];
  if (first === undefined) {
    return { gaps, overlaps, startsAtZero: false, reachesEnd: false, exact: false };
  }
  const startsAtZero = pieceStart(first).isZero();
  if (!startsAtZero) gaps.push({ from: ZERO, to: pieceStart(first) });
  let reach = pieceStart(first);
  for (const piece of sorted) {
    const start = pieceStart(piece);
    const end = pieceEnd(piece);
    if (start.compareTo(reach) > 0) gaps.push({ from: reach, to: start });
    else if (start.compareTo(reach) < 0) {
      overlaps.push({ from: start, to: end.compareTo(reach) < 0 ? end : reach });
    }
    if (end.compareTo(reach) > 0) reach = end;
  }
  const last = sorted[sorted.length - 1];
  const reachesEnd = last !== undefined && pieceEnd(last).equals(objectLength(state));
  return {
    gaps,
    overlaps,
    startsAtZero,
    reachesEnd,
    exact: gaps.length === 0 && overlaps.length === 0 && startsAtZero && reachesEnd,
  };
}

/** 앞쪽부터 cm-block 열 개가 0~9에 틈 없이 놓여 있는가(자 만들기 조건). */
export function rulerReady(state: Pick<MeasureState, 'pieces'>): boolean {
  const sorted = sortedPieces(state.pieces);
  if (sorted.length < 10) return false;
  for (let i = 0; i < 10; i += 1) {
    const piece = sorted[i];
    if (!piece || piece.unit !== 'cm-block' || !pieceStart(piece).equals(Rational.of(i))) {
      return false;
    }
  }
  return true;
}

/** 조각이 놓일 수 있는 시작 위치인가(0.5 격자, 띠 안). */
export function validStart(
  state: Pick<MeasureState, 'objectCm'>,
  unit: string,
  start: Rational,
): boolean {
  const length = unitLength(unit);
  if (length === null) return false;
  if (!start.mul(Rational.of(2)).isInteger()) return false;
  if (start.compareTo(ZERO) < 0) return false;
  return start.add(length).compareTo(bandLength(state)) <= 0;
}

/**
 * 끌어 놓을 때 쓰는 자석. raw(cm)를 0.5 격자로 맞추고, 마지막 조각 끝에서 1cm 안이면 그 끝에 붙인다
 * (조각이 없으면 0). 1cm를 넘으면 놓은 자리에 둔다. 띠 밖이면 띠 안으로 당긴다.
 * `excludeIndex`는 옮기는 중인 조각이다.
 */
export function snapStart(
  state: Pick<MeasureState, 'pieces' | 'objectCm'>,
  unit: string,
  raw: number,
  excludeIndex: number | null = null,
): Rational {
  const length = unitLength(unit) ?? ZERO;
  const maxStart = bandLength(state).sub(length);
  let start = Rational.of(Math.round(raw * 2), 2);
  if (start.compareTo(ZERO) < 0) start = ZERO;
  if (start.compareTo(maxStart) > 0) start = maxStart;
  const others = state.pieces.filter((_, index) => index !== excludeIndex);
  const last = sortedPieces(others).pop();
  const target = last === undefined ? ZERO : pieceEnd(last);
  if (start.sub(target).abs().compareTo(ONE) <= 0 && target.compareTo(maxStart) <= 0) {
    return target;
  }
  return start;
}

/** 새 조각을 끝에 붙일 시작 위치(조각이 없으면 0). 띠 밖이면 null. */
export function endStart(
  state: Pick<MeasureState, 'pieces' | 'objectCm'>,
  unit: string,
): Rational | null {
  const last = sortedPieces(state.pieces).pop();
  const start = last === undefined ? ZERO : pieceEnd(last);
  return validStart(state, unit, start) ? start : null;
}
