/**
 * E03 log-zoom(큰 수 줌아웃) 순수 reduce.
 *
 * 화면 범위는 언제나 `[0, levels[level]]`이고, 단계가 바뀌어도 점·카드를 지우지 않는다.
 * 범위 밖 값은 View가 오른쪽 끝에 "→"로 표시한다(카드 5번).
 * 기존 decimal 줌(`zoom`)과 섞지 않으려고 새 Action `log-zoom`을 쓴다.
 */
import { Rational } from '../../core/math/rational';
import { levelTick, normalizeLevels } from './log';
import { configRational, makeBaseState, normalizeCards, ONE, ZERO } from './state-helpers';
import { parseValue } from './ticks';
import { bumpCounts } from './types';
import type { NumberLineConfig, NumberLineState } from './types';

export function createLogZoomState(config: NumberLineConfig): NumberLineState {
  const levels = normalizeLevels(config.levels);
  const rawLevel = config.startLevel ?? 0;
  const startLevel = Number.isFinite(rawLevel)
    ? Math.min(Math.max(Math.trunc(rawLevel), 0), levels.length - 1)
    : 0;
  const max = levels[startLevel] ?? Rational.of(10);
  const unit = levelTick(max, config.snap === 'major' ? 'major' : 'minor');

  const startValue = configRational(config.start);
  const stepValue = configRational(config.step);
  const skip =
    startValue && stepValue && !stepValue.isZero() && !stepValue.isNegative()
      ? { start: startValue.toJSON(), rows: [{ step: stepValue.toJSON(), hops: [] }] }
      : null;

  return makeBaseState({
    mode: 'log-zoom',
    min: ZERO,
    max,
    unit,
    cards: normalizeCards(config.cards),
    logZoom: { level: startLevel, levels: levels.map((level) => level.toJSON()) },
    skip,
  });
}

/** 단계만 바뀐다. 맨 끝에서는 null(무시). */
export function reduceLogZoom(state: NumberLineState, level: number): NumberLineState | null {
  const logZoom = state.logZoom;
  if (!logZoom || !Number.isFinite(level)) return null;
  const nextLevel = Math.min(Math.max(Math.trunc(level), 0), logZoom.levels.length - 1);
  if (nextLevel === logZoom.level) return null;

  const max = parseValue(logZoom.levels[nextLevel]);
  if (!max) return null;
  const oldMax = parseValue(logZoom.levels[logZoom.level]) ?? max;
  const oldUnit = parseValue(state.unit) ?? ONE;
  // 이전 단계의 작은 눈금 비(10 또는 100)를 그대로 새 단계에 쓴다.
  const factor = oldUnit.isZero() ? Rational.of(100) : oldMax.div(oldUnit);
  const unit = factor.isZero() ? levelTick(max, 'minor') : max.div(factor);

  return {
    ...state,
    min: ZERO.toJSON(),
    max: max.toJSON(),
    viewMin: ZERO.toJSON(),
    viewMax: max.toJSON(),
    unit: unit.toJSON(),
    logZoom: { ...logZoom, level: nextLevel },
    counts: bumpCounts(state.counts, 'zoomed'),
  };
}
