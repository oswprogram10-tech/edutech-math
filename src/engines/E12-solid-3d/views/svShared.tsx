/** E12 `surface-volume` 칠하기 무늬 정의(SVG `<defs>`). 색만으로 구분하지 않도록 점·줄·격자 무늬를 함께 쓴다. */
import { SV_PAINT_STYLES } from './svPaint';

export function SvPatternDefs({ uid }: { readonly uid: string }) {
  const fb = SV_PAINT_STYLES.fb;
  const lr = SV_PAINT_STYLES.lr;
  const tb = SV_PAINT_STYLES.tb;
  const one = SV_PAINT_STYLES.one;
  return (
    <defs>
      <pattern id={`${uid}-fb`} patternUnits="userSpaceOnUse" width={10} height={10}>
        <rect width={10} height={10} fill={fb.bg} />
        <circle cx={5} cy={5} r={1.9} fill={fb.fg} />
      </pattern>
      <pattern id={`${uid}-lr`} patternUnits="userSpaceOnUse" width={9} height={9}>
        <rect width={9} height={9} fill={lr.bg} />
        <path d="M-1,10 L10,-1" stroke={lr.fg} strokeWidth={2} />
      </pattern>
      <pattern id={`${uid}-tb`} patternUnits="userSpaceOnUse" width={10} height={10}>
        <rect width={10} height={10} fill={tb.bg} />
        <path d="M5,0 V10 M0,5 H10" stroke={tb.fg} strokeWidth={1.4} />
      </pattern>
      <pattern id={`${uid}-one`} patternUnits="userSpaceOnUse" width={8} height={8}>
        <rect width={8} height={8} fill={one.bg} />
        <path d="M-1,9 L9,-1" stroke={one.fg} strokeWidth={1.8} />
      </pattern>
    </defs>
  );
}
