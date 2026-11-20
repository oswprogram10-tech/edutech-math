/**
 * E19 장치 그림(회전판 원판 또는 구슬 주머니). svg 안에 끼우는 <g>다.
 * 회전판은 위(12시)에서 시계 방향으로 칸을 놓고, 주머니는 구슬을 5개씩 줄지어 그린다.
 * 칸 번호·무늬로 색 없이도 구분한다.
 */
import { OUTCOME_INK, fillOf } from './outcome';
import { sectorAngles, unitSlots } from './device';
import type { SectorAngle } from './device';
import type { Device } from './types';

const ACCENT = '#e8872e';

function polar(cx: number, cy: number, r: number, deg: number): { x: number; y: number } {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

export interface DeviceFigureProps {
  readonly device: Device;
  readonly cx: number;
  readonly cy: number;
  readonly r: number;
  readonly prefix: string;
  /** 회전판에서 고른 칸. */
  readonly selected?: number | null;
  /** 주머니에서 마지막으로 꺼낸 자리. */
  readonly pick?: number | null;
  readonly onSelect?: (index: number) => void;
  readonly fontSize?: number;
}

export function DeviceFigure({
  device,
  cx,
  cy,
  r,
  prefix,
  selected = null,
  pick = null,
  onSelect,
  fontSize = 22,
}: DeviceFigureProps) {
  if (device.type === 'spinner') {
    const angles = sectorAngles(device);
    const single = device.sectors.length === 1;
    return (
      <g data-part="device" data-device="spinner">
        {device.sectors.map((sector, i) => {
          const a = angles[i];
          if (!a) return null;
          const p1 = polar(cx, cy, r, a.from);
          const p2 = polar(cx, cy, r, a.to);
          const large = a.to - a.from > 180 ? 1 : 0;
          const label = polar(cx, cy, r * 0.62, a.mid);
          return (
            <g
              key={i}
              data-part="sector"
              data-index={i}
              data-color={sector.color}
              data-size={sector.size}
              data-selected={selected === i ? 'true' : undefined}
              onPointerDown={onSelect ? () => onSelect(i) : undefined}
              style={onSelect ? { cursor: 'pointer' } : undefined}
            >
              {single ? (
                <circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill={fillOf(prefix, sector.color)}
                  stroke={OUTCOME_INK}
                  strokeWidth={3}
                />
              ) : (
                <path
                  d={`M ${cx} ${cy} L ${p1.x} ${p1.y} A ${r} ${r} 0 ${large} 1 ${p2.x} ${p2.y} Z`}
                  fill={fillOf(prefix, sector.color)}
                  stroke={OUTCOME_INK}
                  strokeWidth={3}
                  strokeLinejoin="round"
                />
              )}
              <circle
                cx={label.x}
                cy={label.y}
                r={fontSize * 0.7}
                fill="#ffffff"
                stroke={OUTCOME_INK}
                strokeWidth={2}
              />
              <text
                x={label.x}
                y={label.y + fontSize * 0.36}
                textAnchor="middle"
                fontSize={fontSize}
                fontWeight={800}
                fill={OUTCOME_INK}
              >
                {i + 1}
              </text>
            </g>
          );
        })}
        {selected !== null && angles[selected] ? (
          <SelectedRing angle={angles[selected]} cx={cx} cy={cy} r={r} single={single} />
        ) : null}
      </g>
    );
  }
  // 주머니
  const slots = unitSlots(device);
  const mr = r * 0.13;
  return (
    <g data-part="device" data-device="bag">
      <path
        d={`M ${cx - r * 0.35} ${cy - r * 0.62} L ${cx - r * 0.55} ${cy - r * 0.32} L ${cx - r} ${cy - r * 0.32} Q ${cx - r * 1.04} ${cy + r} ${cx - r * 0.7} ${cy + r} L ${cx + r * 0.7} ${cy + r} Q ${cx + r * 1.04} ${cy + r} ${cx + r} ${cy - r * 0.32} L ${cx + r * 0.55} ${cy - r * 0.32} L ${cx + r * 0.35} ${cy - r * 0.62} Z`}
        fill="#f1e4c8"
        stroke="#8a6a2f"
        strokeWidth={4}
        strokeLinejoin="round"
      />
      {slots.map((color, i) => {
        const x = cx - r * 0.68 + (i % 5) * r * 0.34;
        const y = cy - r * 0.08 + Math.floor(i / 5) * r * 0.3;
        return (
          <g key={i} data-part="marble" data-index={i} data-color={color}>
            <circle
              cx={x}
              cy={y}
              r={mr}
              fill={fillOf(prefix, color)}
              stroke={OUTCOME_INK}
              strokeWidth={2}
            />
            {pick === i ? (
              <circle
                data-part="picked"
                cx={x}
                cy={y}
                r={mr + 5}
                fill="none"
                stroke={ACCENT}
                strokeWidth={4}
              />
            ) : null}
          </g>
        );
      })}
    </g>
  );
}

function SelectedRing({
  angle,
  cx,
  cy,
  r,
  single,
}: {
  readonly angle: SectorAngle;
  readonly cx: number;
  readonly cy: number;
  readonly r: number;
  readonly single: boolean;
}) {
  if (single) {
    return (
      <circle
        data-part="selected-ring"
        cx={cx}
        cy={cy}
        r={r + 6}
        fill="none"
        stroke={ACCENT}
        strokeWidth={6}
        strokeDasharray="12 7"
      />
    );
  }
  const p1 = polar(cx, cy, r + 6, angle.from);
  const p2 = polar(cx, cy, r + 6, angle.to);
  const large = angle.to - angle.from > 180 ? 1 : 0;
  return (
    <path
      data-part="selected-ring"
      d={`M ${cx} ${cy} L ${p1.x} ${p1.y} A ${r + 6} ${r + 6} 0 ${large} 1 ${p2.x} ${p2.y} Z`}
      fill="none"
      stroke={ACCENT}
      strokeWidth={6}
      strokeDasharray="12 7"
      strokeLinejoin="round"
    />
  );
}
