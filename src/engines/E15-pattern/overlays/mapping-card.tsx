/**
 * 힌트 ② mapping-card (MC-PATTERN-TRANSLATE).
 *
 * 학생이 채운 칸에서 보내는 토큰마다 처음 붙인 받는 토큰을 "사과 = 1" 모양 카드로 나열한다.
 * 같은 보내는 토큰에 다른 받는 토큰이 붙은 칸은 트랙에 ✕로 표시한다.
 * 소리만 듣는 설정(`sound-only`)에서는 보내는 토큰을 그리지 않고 "?"로 둔다.
 */
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import { trackLayout } from '../layout';
import { patternStrings as S } from '../strings.ko';
import { TokenGlyph } from '../tokens';
import type { PatternConfig, PatternState } from '../types';
import { PATTERN_CANVAS, sequenceOf } from './helpers';

const CARD_W = 140;
const CARD_H = 52;
const MAX_CARDS = 6;

export function MappingCardOverlay({ state }: OverlayProps<PatternConfig, PatternState>) {
  const sequence = sequenceOf(state);
  if (!sequence || sequence.settings.variant !== 'translate') return null;
  const { settings, slots } = sequence;
  const layout = trackLayout(settings, sequence.sent);
  const soundOnly = settings.givenDisplay === 'sound-only';

  const first = new Map<string, string>();
  slots.forEach((token, i) => {
    const from = settings.given[i];
    if (token === null || from === undefined) return;
    if (!first.has(from)) first.set(from, token);
  });
  const cards = [...first.entries()].slice(0, MAX_CARDS);
  const total = cards.length * CARD_W + (cards.length - 1) * 10;
  const left = (layout.width - total) / 2;

  const crosses = slots.flatMap((token, i) => {
    const from = settings.given[i];
    const box = layout.slots[i];
    if (token === null || from === undefined || !box) return [];
    return first.get(from) !== token ? [box] : [];
  });

  return (
    <CanvasAlignedOverlay
      testId="mapping-card"
      canvasSelector={PATTERN_CANVAS}
      logicalWidth={layout.width}
      logicalHeight={layout.height}
    >
      <text x={14} y={14} fontSize={16} fontWeight={700} fill="#3d485c" dominantBaseline="central">
        {S.overlay.mapping}
      </text>
      {cards.map(([from, to], index) => {
        const x = left + index * (CARD_W + 10);
        const y = 24;
        return (
          <g key={from} data-testid="mapping-card-item">
            <rect
              x={x}
              y={y}
              width={CARD_W}
              height={CARD_H}
              rx={12}
              fill="#ffffff"
              stroke="#2f6fde"
              strokeWidth={3}
            />
            {soundOnly ? (
              <text
                x={x + 28}
                y={y + CARD_H / 2}
                fontSize={28}
                fontWeight={800}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#5b6577"
              >
                ?
              </text>
            ) : (
              <TokenGlyph
                token={from}
                x={x + 6}
                y={y + 2}
                size={48}
                look={settings.look}
                symbols={settings.symbols}
              />
            )}
            <text
              x={x + CARD_W / 2}
              y={y + CARD_H / 2}
              fontSize={26}
              fontWeight={800}
              textAnchor="middle"
              dominantBaseline="central"
              fill="#1d2330"
            >
              =
            </text>
            <TokenGlyph
              token={to}
              x={x + CARD_W - 54}
              y={y + 2}
              size={48}
              look={settings.look}
              symbols={settings.symbols}
            />
          </g>
        );
      })}
      {crosses.map((box) => (
        <g
          key={`x-${box.x}-${box.y}`}
          stroke="#1d2330"
          strokeWidth={7}
          strokeLinecap="round"
          data-testid="mapping-card-x"
        >
          <line
            x1={box.x + 14}
            y1={box.y + 14}
            x2={box.x + box.size - 14}
            y2={box.y + box.size - 14}
          />
          <line
            x1={box.x + box.size - 14}
            y1={box.y + 14}
            x2={box.x + 14}
            y2={box.y + box.size - 14}
          />
        </g>
      ))}
    </CanvasAlignedOverlay>
  );
}
