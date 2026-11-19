/**
 * 힌트 ② replay-break (MC-PATTERN-LAST-ONLY).
 *
 * 학생 칸 가운데 이어 가기가 처음 달라지는 칸에 물결 표시와 "여기서 리듬이 바뀌어요"를 그린다.
 * "▶ 다시 듣기" 단추는 그 칸까지의 소리를 다시 들려 준다. 정답 토큰은 그리지 않는다.
 */
import { useEffect, useRef, useState } from 'react';
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import { noteOfToken, playNote, unlockAudio } from '../audio';
import { trackLayout } from '../layout';
import { continuation } from '../pattern';
import { patternStrings as S } from '../strings.ko';
import type { PatternConfig, PatternState } from '../types';
import { PATTERN_CANVAS, sequenceOf } from './helpers';

const STEP_MS = 500;

export function ReplayBreakOverlay({ state }: OverlayProps<PatternConfig, PatternState>) {
  const sequence = sequenceOf(state);
  const [step, setStep] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  if (!sequence || sequence.settings.variant !== 'extend') return null;
  const { settings, slots } = sequence;
  const expected = continuation(settings.given, slots.length);
  if (expected === null) return null;
  const breakAt = slots.findIndex((token, j) => token !== null && token !== expected[j]);
  if (breakAt < 0) return null;
  const layout = trackLayout(settings, sequence.sent);
  const box = layout.slots[breakAt];
  if (!box) return null;

  const order = [...new Set([...settings.items, ...settings.given])];
  const boxes = [...layout.given, ...layout.slots];

  const replay = () => {
    if (timer.current !== null) clearTimeout(timer.current);
    unlockAudio();
    const tokens: string[] = [...settings.given];
    for (let j = 0; j <= breakAt; j += 1) {
      const token = slots[j];
      if (token === null || token === undefined) break;
      tokens.push(token);
    }
    const run = (index: number) => {
      const token = tokens[index];
      if (token === undefined) {
        setStep(null);
        return;
      }
      setStep(index);
      if (settings.sound !== 'none') playNote(noteOfToken(token, settings.notes, order));
      timer.current = setTimeout(() => run(index + 1), STEP_MS);
    };
    run(0);
  };

  const cx = Math.min(layout.width - 200, Math.max(200, box.x + box.size / 2));
  const wave: string[] = [];
  for (let i = 0; i <= 8; i += 1) {
    const x = box.x + (box.size * i) / 8;
    const y = box.y + box.size + 8 + (i % 2 === 0 ? 0 : 8);
    wave.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  const lit = step !== null ? boxes[step] : null;

  return (
    <CanvasAlignedOverlay
      testId="replay-break"
      canvasSelector={PATTERN_CANVAS}
      logicalWidth={layout.width}
      logicalHeight={layout.height}
    >
      <path
        d={wave.join(' ')}
        fill="none"
        stroke="#e8872e"
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
        data-testid="replay-break-wave"
      />
      <rect
        x={box.x - 4}
        y={box.y - 4}
        width={box.size + 8}
        height={box.size + 8}
        rx={14}
        fill="none"
        stroke="#e8872e"
        strokeWidth={4}
        strokeDasharray="10 7"
      />
      <g>
        <rect
          x={cx - 190}
          y={box.y - 40}
          width={380}
          height={32}
          rx={10}
          fill="#fff7e6"
          stroke="#e8a13a"
          strokeWidth={2}
        />
        <text
          x={cx - 178}
          y={box.y - 24}
          fontSize={17}
          fontWeight={700}
          fill="#8a4b00"
          dominantBaseline="central"
        >
          {S.overlay.breakNote}
        </text>
        <g
          role="button"
          data-testid="replay-break-play"
          pointerEvents="auto"
          style={{ cursor: 'pointer' }}
          onClick={replay}
        >
          <rect x={cx + 52} y={box.y - 38} width={132} height={28} rx={8} fill="#2f6fde" />
          <text
            x={cx + 118}
            y={box.y - 24}
            fontSize={16}
            fontWeight={700}
            fill="#ffffff"
            textAnchor="middle"
            dominantBaseline="central"
          >
            {S.overlay.replay}
          </text>
        </g>
      </g>
      {lit ? (
        <rect
          x={lit.x - 3}
          y={lit.y - 3}
          width={lit.size + 6}
          height={lit.size + 6}
          rx={14}
          fill="none"
          stroke="#e8872e"
          strokeWidth={8}
          data-testid="replay-break-lit"
        />
      ) : null}
    </CanvasAlignedOverlay>
  );
}
