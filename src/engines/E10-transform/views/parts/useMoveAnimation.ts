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

interface MoveAnimationInput {
  readonly start: SquareFigure;
  readonly moves: readonly Move[];
  readonly rect: BoardRect;
  readonly cpa: CPA;
  readonly reduced: boolean;
}

function transformOf(
  start: SquareFigure,
  moves: readonly Move[],
  rect: BoardRect,
  progress: number,
): string | null {
  const last = moves[moves.length - 1];
  if (!last) return null;
  const remain = 1 - easeInOut(progress);
  if (last.kind === 'slide') {
    return `translate(${(last.dx * rect.cell * remain).toFixed(2)} ${(last.dy * rect.cell * remain).toFixed(2)})`;
  }
  if (last.kind === 'turn') {
    const center = ptXY(rect, last.center);
    const signed = last.direction === 'cw' ? last.angle : -last.angle;
    return `rotate(${(-signed * remain).toFixed(2)} ${center.x.toFixed(2)} ${center.y.toFixed(2)})`;
  }
  const final = applyMovesUpTo(start, moves, moves.length);
  const bounds = figureBounds(final);
  const scale = -1 + 2 * easeInOut(progress);
  if (last.side === 'left' || last.side === 'right') {
    const axis = last.side === 'right' ? bounds.maxX : bounds.minX;
    const x = rect.x + axis * rect.cell;
    return `matrix(${scale.toFixed(4)} 0 0 1 ${(x * (1 - scale)).toFixed(2)} 0)`;
  }
  const axis = last.side === 'down' ? bounds.maxY : bounds.minY;
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
  const previous = useRef<readonly Move[]>(moves);

  useEffect(() => {
    if (previous.current === moves) return;
    const previousLength = previous.current.length;
    previous.current = moves;
    const last = moves[moves.length - 1];
    const eligible = last !== undefined && moves.length >= previousLength;
    const settle = (): (() => void) => {
      // effect 본문에서 바로 setState를 부르지 않도록 마이크로태스크로 미룬다.
      let cancelled = false;
      const run = () => {
        if (!cancelled) setProgress(1);
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
    const tick = (now: number) => {
      if (started === null) started = now;
      const value = Math.min(1, (now - started) / MOVE_DURATION_MS);
      setProgress(value);
      if (value < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [moves, reduced, cpa]);

  const animating = progress < 1;
  return {
    transform: animating ? transformOf(start, moves, rect, progress) : null,
    animating,
  };
}
