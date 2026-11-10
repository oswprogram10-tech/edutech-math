/**
 * 이동 하나를 450ms 동안 `requestAnimationFrame`으로 보간한다.
 *
 * 최종 도형을 그대로 두고, 진행률 0에서 이동 직전 모습이 되도록 SVG 변환을
 * 건다. 밀기는 평행이동, 돌리기는 중심 둘레 회전, 뒤집기는 축 방향으로
 * −1에서 1까지 늘이기다. 보간 값은 화면 좌표(number)이고 상태에 넣지 않는다.
 */
import { useEffect, useRef, useState } from 'react';
import { applyMovesUpTo } from '../../moves';
import { figureBounds } from '../../square';
import { ptXY } from '../../layout';
import type { BoardRect } from '../../layout';
import type { CPA } from '../../../../core/engine-sdk';
import type { Move, SquareFigure } from '../../types';
import { easeInOut, MOVE_DURATION_MS } from './motion';

export interface MoveAnimationResult {
  readonly transform: string | null;
  readonly animating: boolean;
}

export interface SlideAnimationDelta {
  readonly dx: number;
  readonly dy: number;
}

interface MoveAnimationInput {
  readonly start: SquareFigure;
  readonly moves: readonly Move[];
  readonly rect: BoardRect;
  readonly cpa: CPA;
  readonly reduced: boolean;
}

function moveKey(move: Move): string {
  if (move.kind === 'slide') return `s${move.dx},${move.dy}`;
  if (move.kind === 'flip') return `f${move.side}`;
  return `t${move.direction}${move.angle}${move.center[0]},${move.center[1]}`;
}

/** 움직임 목록의 내용 키. 같은 내용이면 배열이 매 렌더 새로 만들어져도 같다. */
export function movesKey(moves: readonly Move[]): string {
  return moves.map(moveKey).join('|');
}

/**
 * 마지막 밀기에서 이번에 새로 더해진 변화량.
 *
 * 밀기 두 번은 한 기록으로 합쳐지므로, 합 전체를 다시 보간하면 직전 자리에서
 * 출발하지 않고 훨씬 뒤에서 미끄러진다. 병합된 경우에는 늘어난 만큼만 돌려준다.
 */
export function slideAnimationDelta(
  previous: readonly Move[],
  moves: readonly Move[],
): SlideAnimationDelta | null {
  const last = moves[moves.length - 1];
  if (!last || last.kind !== 'slide') return null;
  const previousLast = previous[previous.length - 1];
  if (previousLast?.kind === 'slide' && previous.length === moves.length) {
    return { dx: last.dx - previousLast.dx, dy: last.dy - previousLast.dy };
  }
  return { dx: last.dx, dy: last.dy };
}

export function transformOf(
  start: SquareFigure,
  moves: readonly Move[],
  rect: BoardRect,
  progress: number,
  slideDelta?: SlideAnimationDelta | null,
): string | null {
  const last = moves[moves.length - 1];
  if (!last) return null;
  const remain = 1 - easeInOut(progress);
  if (last.kind === 'slide') {
    const dx = slideDelta?.dx ?? last.dx;
    const dy = slideDelta?.dy ?? last.dy;
    return `translate(${(dx * rect.cell * remain).toFixed(2)} ${(dy * rect.cell * remain).toFixed(2)})`;
  }
  if (last.kind === 'turn') {
    const center = ptXY(rect, last.center);
    const signed = last.direction === 'cw' ? last.angle : -last.angle;
    return `rotate(${(-signed * remain).toFixed(2)} ${center.x.toFixed(2)} ${center.y.toFixed(2)})`;
  }
  // 뒤집기 축은 결과 도형의 맞은편 변이다. 오른쪽으로 뒤집으면 결과 도형의
  // 왼쪽 변이, 왼쪽으로 뒤집으면 오른쪽 변이 접는 축이 된다.
  const final = applyMovesUpTo(start, moves, moves.length);
  const bounds = figureBounds(final);
  const scale = -1 + 2 * easeInOut(progress);
  if (last.side === 'left' || last.side === 'right') {
    const axis = last.side === 'right' ? bounds.minX : bounds.maxX;
    const x = rect.x + axis * rect.cell;
    return `matrix(${scale.toFixed(4)} 0 0 1 ${(x * (1 - scale)).toFixed(2)} 0)`;
  }
  const axis = last.side === 'down' ? bounds.minY : bounds.maxY;
  const y = rect.y + axis * rect.cell;
  return `matrix(1 0 0 ${scale.toFixed(4)} 0 ${(y * (1 - scale)).toFixed(2)})`;
}

export function useMoveAnimation({
  start,
  moves,
  rect,
  cpa,
  reduced,
}: MoveAnimationInput): MoveAnimationResult {
  const [progress, setProgress] = useState(1);
  const [delta, setDelta] = useState<SlideAnimationDelta | null>(null);
  const previousMoves = useRef<readonly Move[]>(moves);
  const previousKey = useRef(movesKey(moves));

  useEffect(() => {
    const currentKey = movesKey(moves);
    if (currentKey === previousKey.current) return;
    const previous = previousMoves.current;
    previousMoves.current = moves;
    previousKey.current = currentKey;
    const nextDelta = slideAnimationDelta(previous, moves);
    const last = moves[moves.length - 1];
    const eligible = last !== undefined && moves.length >= previous.length;
    const settle = (): (() => void) => {
      // effect 본문에서 바로 setState를 부르지 않도록 마이크로태스크로 미룬다.
      let cancelled = false;
      const run = () => {
        if (cancelled) return;
        setDelta(null);
        setProgress(1);
      };
      if (typeof queueMicrotask === 'function') queueMicrotask(run);
      else void Promise.resolve().then(run);
      return () => {
        cancelled = true;
      };
    };
    if (!eligible || reduced || cpa === 'A') return settle();
    if (typeof requestAnimationFrame !== 'function' || typeof performance === 'undefined') {
      return settle();
    }
    let frame = 0;
    let started: number | null = null;
    let first = true;
    const tick = (now: number) => {
      if (started === null) started = now;
      const value = Math.min(1, (now - started) / MOVE_DURATION_MS);
      if (first) {
        first = false;
        setDelta(nextDelta);
      }
      setProgress(value);
      if (value < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [moves, reduced, cpa]);

  const animating = progress < 1;
  return {
    transform: animating ? transformOf(start, moves, rect, progress, delta) : null,
    animating,
  };
}
