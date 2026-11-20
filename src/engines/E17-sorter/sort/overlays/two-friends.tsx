/**
 * 힌트 ② two-friends (MC-SORT-SUBJECTIVE).
 * "친구 1"·"친구 2" 작은 상자 그림 둘을 나란히 그린다. 같은 단추 네 장(b01·b06·b10·b11 고정)이
 * 친구마다 다르게 나뉜 고정 그림이다. 어느 쪽이 옳다고 말하지 않는다.
 */
import type { OverlayProps } from '../../../../core/engine-sdk';
import { sortCardById } from '../../decks';
import type { SorterConfig, SorterState } from '../../types';
import { CardArt } from '../art';
import { SORT_WIDTH, sortBoardHeight } from '../layout';
import { sortStrings as S } from '../strings.ko';
import { SortOverlayFrame } from './frame';

const INK = '#1d2330';

interface Friend {
  readonly title: string;
  readonly groups: readonly (readonly string[])[];
}

const FRIENDS: readonly Friend[] = [
  { title: S.overlay.friend1, groups: [['b01', 'b06', 'b10'], ['b11']] },
  {
    title: S.overlay.friend2,
    groups: [
      ['b01', 'b11'],
      ['b06', 'b10'],
    ],
  },
];

export function TwoFriendsOverlay({ state }: OverlayProps<SorterConfig, SorterState>) {
  if (state.mode !== 'sort') return null;
  const height = sortBoardHeight();
  const panel = { x: 70, y: 40, width: SORT_WIDTH - 140, height: height - 80 };
  const half = panel.width / 2;
  return (
    <SortOverlayFrame testId="two-friends">
      <rect
        x={panel.x}
        y={panel.y}
        width={panel.width}
        height={panel.height}
        rx={16}
        fill="#ffffff"
        fillOpacity={0.97}
        stroke="#c9d2e2"
        strokeWidth={3}
      />
      <text
        x={SORT_WIDTH / 2}
        y={panel.y + 38}
        textAnchor="middle"
        fontSize={22}
        fontWeight={700}
        fill={INK}
      >
        {S.overlay.twoFriends}
      </text>
      {FRIENDS.map((friend, friendIndex) => {
        const left = panel.x + friendIndex * half;
        return (
          <g key={friend.title} data-friend={friendIndex + 1}>
            <text
              x={left + half / 2}
              y={panel.y + 80}
              textAnchor="middle"
              fontSize={22}
              fontWeight={700}
              fill="#1d4fa8"
            >
              {friend.title}
            </text>
            {friend.groups.map((group, groupIndex) => {
              const boxWidth = half / 2 - 30;
              const boxX = left + 20 + groupIndex * (boxWidth + 20);
              const boxY = panel.y + 100;
              const boxHeight = panel.height - 130;
              return (
                <g key={groupIndex}>
                  <rect
                    x={boxX}
                    y={boxY}
                    width={boxWidth}
                    height={boxHeight}
                    rx={12}
                    fill="#f4f7fc"
                    stroke="#9aa7c0"
                    strokeWidth={3}
                  />
                  {group.map((id, index) => {
                    const card = sortCardById('buttons-12', id);
                    if (!card) return null;
                    const cols = 2;
                    const cx = boxX + boxWidth / (cols * 2) + (index % cols) * (boxWidth / cols);
                    const cy = boxY + 52 + Math.floor(index / cols) * 78;
                    return <CardArt key={id} card={card} size={56} x={cx} y={cy} />;
                  })}
                </g>
              );
            })}
          </g>
        );
      })}
    </SortOverlayFrame>
  );
}
