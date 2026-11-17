/**
 * E12 `shapes-sort` 물건 그림(SVG).
 *
 * - `ShapeGlyph`: 64×64 좌표(바닥 y=58, 가운데 x=32)에 그리는 `<g>`. 장면 SVG 안에서 옮기고 돌려 쓴다.
 * - `ShapeIcon`: 단추 안에 넣는 독립 SVG.
 * 색은 꾸밈일 뿐이다. 모양이 달라서 색을 못 봐도 구별할 수 있다.
 */
import type { ShapeColor, ShapeKind, ShapePose, ShapeSize } from '../shapes/rules';
import {
  GLYPH_BOTTOM,
  GLYPH_BOX,
  GLYPH_CENTER_X,
  SHAPE_PALETTE,
  sizeScale,
} from './shapeGlyphMeta';

interface GlyphProps {
  readonly kind: ShapeKind;
  readonly pose: ShapePose;
  readonly color: ShapeColor;
  readonly size: ShapeSize;
}

export function ShapeGlyph({ kind, pose, color, size }: GlyphProps) {
  const pal = SHAPE_PALETTE[color];
  const s = sizeScale(size);
  const stroke = '#1d2330';
  const scaleAround = `translate(${GLYPH_CENTER_X} ${GLYPH_BOTTOM}) scale(${s}) translate(${-GLYPH_CENTER_X} ${-GLYPH_BOTTOM})`;
  return (
    <g transform={scaleAround} data-glyph={kind} strokeLinejoin="round" strokeLinecap="round">
      {kind === 'box' ? (
        <>
          <polygon points="8,20 32,32 32,58 8,46" fill={pal.main} stroke={stroke} strokeWidth={2} />
          <polygon
            points="32,32 56,20 56,46 32,58"
            fill={pal.dark}
            stroke={stroke}
            strokeWidth={2}
          />
          <polygon
            points="32,8 56,20 32,32 8,20"
            fill={pal.light}
            stroke={stroke}
            strokeWidth={2}
          />
        </>
      ) : null}
      {kind === 'cylinder' && pose !== 'lying' ? (
        <>
          <path
            d="M14 16 L14 50 A18 7 0 0 0 50 50 L50 16 Z"
            fill={pal.main}
            stroke={stroke}
            strokeWidth={2}
          />
          <ellipse
            cx={32}
            cy={16}
            rx={18}
            ry={7}
            fill={pal.light}
            stroke={stroke}
            strokeWidth={2}
          />
        </>
      ) : null}
      {kind === 'cylinder' && pose === 'lying' ? (
        <>
          <path
            d="M14 24 L50 24 A7 17 0 0 1 50 58 L14 58 A7 17 0 0 1 14 24 Z"
            fill={pal.main}
            stroke={stroke}
            strokeWidth={2}
          />
          <ellipse
            cx={50}
            cy={41}
            rx={7}
            ry={17}
            fill={pal.light}
            stroke={stroke}
            strokeWidth={2}
          />
        </>
      ) : null}
      {kind === 'sphere' ? (
        <>
          <circle cx={32} cy={34} r={24} fill={pal.main} stroke={stroke} strokeWidth={2} />
          <ellipse cx={24} cy={24} rx={8} ry={5} fill="#ffffff" fillOpacity={0.55} />
        </>
      ) : null}
    </g>
  );
}

interface IconProps extends GlyphProps {
  readonly px: number;
  readonly className?: string;
}

export function ShapeIcon({ px, className, ...glyph }: IconProps) {
  return (
    <svg
      className={className}
      width={px}
      height={px}
      viewBox={`0 0 ${GLYPH_BOX} ${GLYPH_BOX}`}
      aria-hidden="true"
      focusable="false"
    >
      <ShapeGlyph {...glyph} />
    </svg>
  );
}
