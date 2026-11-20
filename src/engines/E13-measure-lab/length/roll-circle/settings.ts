/**
 * E13 roll-circle 설정 검사·정리. 지름은 정수 cm 문자열(1~10, 1~6개, 중복 없음).
 * 설정이 `mode`·`variant`뿐이면 샌드박스 기본(지름 2·3·5·8·10cm)을 쓴다.
 */
import { E13_STRINGS as S } from '../../strings.ko';
import type { RollConfig, RollState } from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function sandboxDefault(): RollConfig {
  return {
    mode: 'length',
    variant: 'roll-circle',
    diameters: ['2', '3', '5', '8', '10'],
    unit: 'cm',
    precision: '0.01',
  };
}

function failure(): RollState {
  return {
    mode: 'length',
    variant: 'roll-circle',
    error: S.configError,
    diameters: [],
    precision: '0.01',
    diameterStickTool: true,
    logEnabled: true,
    diameter: '',
    rolled: false,
    measuredCm: null,
    sticks: 0,
    log: [],
    moves: 0,
  };
}

/** 1~10의 정수 문자열인가(공백·소수·앞자리 0은 거절). */
function validDiameter(value: unknown): value is string {
  if (typeof value !== 'string' || !/^(10|[1-9])$/.test(value)) return false;
  return true;
}

export function normalizeRoll(config: RollConfig): RollState {
  const source: unknown =
    isRecord(config) && Object.keys(config).every((key) => key === 'mode' || key === 'variant')
      ? sandboxDefault()
      : config;
  if (!isRecord(source) || source['variant'] !== 'roll-circle') return failure();
  const diameters = source['diameters'];
  if (!Array.isArray(diameters) || diameters.length < 1 || diameters.length > 6) return failure();
  if (!diameters.every(validDiameter)) return failure();
  if (new Set(diameters).size !== diameters.length) return failure();
  const unit = source['unit'];
  if (unit !== undefined && unit !== 'cm') return failure();
  const precision = source['precision'];
  if (precision !== undefined && precision !== '0.01' && precision !== '0.001') return failure();
  const stickTool = source['diameterStickTool'];
  const log = source['log'];
  if (stickTool !== undefined && typeof stickTool !== 'boolean') return failure();
  if (log !== undefined && typeof log !== 'boolean') return failure();
  const list = diameters as string[];
  return {
    mode: 'length',
    variant: 'roll-circle',
    error: null,
    diameters: [...list],
    precision: precision ?? '0.01',
    diameterStickTool: stickTool ?? true,
    logEnabled: log ?? true,
    diameter: list[0] as string,
    rolled: false,
    measuredCm: null,
    sticks: 0,
    log: [],
    moves: 0,
  };
}

/** precision 글에서 소수 자릿수(2 또는 3). */
export function precisionDigits(state: Pick<RollState, 'precision'>): number {
  return state.precision === '0.001' ? 3 : 2;
}
