/** E13 estimate 설정 검사·정리와 자 끌기 자석. 측정값은 Rational로만 계산한다. */
import { Rational } from '../../../core/math';
import { rat } from '../rat';
import { E13_STRINGS as S } from '../strings.ko';
import { MAX_OFFSET_CM } from './types';
import type { EstimateConfig, EstimateState } from './types';

const ZERO = Rational.of(0);
const ONE = Rational.of(1);
const TWENTY = Rational.of(20);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 설정이 `mode`뿐이면 샌드박스 기본(크레파스 6.7cm, 자 눈금 3에서 시작, 어림 먼저)을 쓴다. */
export function sandboxDefault(): EstimateConfig {
  return {
    mode: 'estimate',
    object: { name: 'crayon', lengthCm: '6.7' },
    ruler: { offsetCm: 3, draggable: true },
    estimateFirst: true,
  };
}

/** 0.1 격자 Rational(문자열 또는 숫자). 격자가 아니면 null. */
function tenthGrid(value: unknown): Rational | null {
  let parsed: Rational | null = null;
  if (typeof value === 'string') parsed = rat(value);
  else if (typeof value === 'number' && Number.isFinite(value)) {
    const scaled = Math.round(value * 10);
    if (Math.abs(value * 10 - scaled) < 1e-9) parsed = Rational.of(scaled, 10);
  }
  if (parsed === null) return null;
  return parsed.mul(Rational.of(10)).isInteger() ? parsed : null;
}

/** 자 눈금 설정(정수 0~5). 숫자 또는 정수 문자열. */
function offsetFromConfig(value: unknown): Rational | null {
  let parsed: Rational | null = null;
  if (typeof value === 'number') {
    if (Number.isInteger(value)) parsed = Rational.of(value);
  } else {
    parsed = rat(value);
  }
  if (parsed === null || !parsed.isInteger()) return null;
  if (parsed.compareTo(ZERO) < 0 || parsed.compareTo(Rational.of(MAX_OFFSET_CM)) > 0) return null;
  return parsed;
}

function failure(): EstimateState {
  return {
    mode: 'estimate',
    error: S.configError,
    objectName: '',
    lengthCm: '0',
    initialOffset: '0',
    rulerOffset: '0',
    draggable: false,
    estimateFirst: false,
    estimate: null,
    estimateLocked: false,
    rulerMoves: 0,
    moves: 0,
  };
}

export function normalizeEstimate(config: EstimateConfig): EstimateState {
  const source: unknown =
    isRecord(config) && Object.keys(config).every((key) => key === 'mode')
      ? sandboxDefault()
      : config;
  if (!isRecord(source)) return failure();
  const object = source['object'];
  if (!isRecord(object)) return failure();
  const name = object['name'];
  const length = tenthGrid(object['lengthCm']);
  if (typeof name !== 'string' || name.length === 0 || length === null) return failure();
  if (length.compareTo(ONE) < 0 || length.compareTo(TWENTY) > 0) return failure();
  const ruler = source['ruler'];
  if (ruler !== undefined && !isRecord(ruler)) return failure();
  let offset = ZERO;
  if (ruler?.['offsetCm'] !== undefined) {
    const parsed = offsetFromConfig(ruler['offsetCm']);
    if (parsed === null) return failure();
    offset = parsed;
  }
  return {
    mode: 'estimate',
    error: null,
    objectName: name,
    lengthCm: length.toString(),
    initialOffset: offset.toString(),
    rulerOffset: offset.toString(),
    draggable: ruler?.['draggable'] !== false,
    estimateFirst: source['estimateFirst'] === true,
    estimate: null,
    estimateLocked: false,
    rulerMoves: 0,
    moves: 0,
  };
}

export function objectLength(state: Pick<EstimateState, 'lengthCm'>): Rational {
  return rat(state.lengthCm) ?? ZERO;
}

export function offsetOf(state: Pick<EstimateState, 'rulerOffset'>): Rational {
  return rat(state.rulerOffset) ?? ZERO;
}

/** 자 눈금(물건 왼쪽 끝 위치)으로 둘 수 있는 값인가(0.5 격자, 0~5). */
export function validOffset(value: Rational): boolean {
  return (
    value.mul(Rational.of(2)).isInteger() &&
    value.compareTo(ZERO) >= 0 &&
    value.compareTo(Rational.of(MAX_OFFSET_CM)) <= 0
  );
}

/** 물건 끝이 가리키는 자 눈금(Rational). */
export function endTick(state: Pick<EstimateState, 'rulerOffset' | 'lengthCm'>): Rational {
  return offsetOf(state).add(objectLength(state));
}

/** 반올림한 정수 cm(6.5는 7). */
export function nearestCm(state: Pick<EstimateState, 'lengthCm'>): number {
  return Number(objectLength(state).add(Rational.of(1, 2)).integerPart());
}

/**
 * 자를 끌어 놓을 때 쓰는 자석. raw(자 눈금으로 환산한 물건 왼쪽 끝, 그림용 number)를 0.5 격자로 맞추고,
 * 영점에서 1cm 안이면 0에 붙인다. 0~5 밖이면 안으로 당긴다.
 */
export function snapRulerOffset(raw: number): Rational {
  if (!Number.isFinite(raw) || raw <= 1) return ZERO;
  const clamped = Math.min(raw, MAX_OFFSET_CM);
  return Rational.of(Math.round(clamped * 2), 2);
}

/** 어림 먼저이고 아직 어림을 넣지 않았으면 자를 그리지 않는다(자 끌기도 거절한다). */
export function rulerHidden(
  state: Pick<EstimateState, 'estimateFirst' | 'estimateLocked'>,
): boolean {
  return state.estimateFirst && !state.estimateLocked;
}
