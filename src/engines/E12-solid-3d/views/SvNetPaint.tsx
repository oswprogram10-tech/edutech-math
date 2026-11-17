/**
 * E12 `surface-volume` 전개도 칠하기 무대.
 *
 * - 접혀 있으면 상자 그림(`SvBoxStage`), 펼치면 십자형 전개도를 그린다. 바뀔 때 400ms 페이드
 *   애니메이션을 쓰고 `prefers-reduced-motion`이면 바로 바꾼다(CSS).
 * - 칠한 면은 색과 무늬를 함께 쓰고, 칠하지 않은 면은 흰 바탕에 1cm 칸 격자만 있다.
 * - 칠한 넓이 수를 쓰지 않는다. 치수 글자("4cm")만 붙인다.
 */
import { netBounds, netLayout } from '../sv/geometry';
import { solid3dStrings as S } from '../strings.ko';
import type { SvAction, SvState } from '../types';
import styles from '../View.module.css';
import type { XrayFaceId } from '../xray/geometry';
import { SvBoxStage, SV_STAGE_H, SV_STAGE_W } from './SvBoxStage';
import { paintFill, paintKeyOf, SV_PAINT_STYLES, useSvUid } from './svPaint';
import { SvPatternDefs } from './svShared';

const PAD_X = 64;
const PAD_Y = 36;
const MAX_CELL = 56;

const SHORT_NAMES: Readonly<Record<XrayFaceId, string>> = {
  front: '앞',
  back: '뒤',
  left: '왼',
  right: '오른',
  top: '위',
  bottom: '아래',
};

interface SvNetPaintProps {
  readonly state: SvState;
  readonly readOnly: boolean;
  readonly dispatch: (action: SvAction) => void;
  readonly onLiveMessage: (msg: string) => void;
}

export function SvNetPaint({ state, readOnly, dispatch, onLiveMessage }: SvNetPaintProps) {
  const uid = useSvUid();
  const [w, d, h] = state.dims;

  if (!state.unfolded) {
    return (
      <SvBoxStage
        key="box"
        state={state}
        readOnly={readOnly}
        dispatch={dispatch}
        onLiveMessage={onLiveMessage}
      />
    );
  }

  const { cols, rows } = netBounds(w, d, h);
  const cell = Math.min((SV_STAGE_W - 2 * PAD_X) / cols, (SV_STAGE_H - 2 * PAD_Y) / rows, MAX_CELL);
  const originX = (SV_STAGE_W - cols * cell) / 2;
  const originY = (SV_STAGE_H - rows * cell) / 2;
  const layout = netLayout(w, d, h);
  const painted = new Set<string>(state.painted);
  const canPaint = !readOnly && state.step === 'paint';

  const toggle = (face: XrayFaceId) => {
    if (!canPaint) return;
    const was = painted.has(face);
    dispatch({ type: 'paint-face', face });
    onLiveMessage(was ? S.sv.live.unpainted : S.sv.live.painted);
  };

  const topFace = layout.find((f) => f.face === 'top');
  const leftFace = layout.find((f) => f.face === 'left');
  const rightFace = layout.find((f) => f.face === 'right');

  const pill = (testId: string, x: number, y: number, text: string) => (
    <text
      key={testId}
      data-testid={testId}
      x={x}
      y={y}
      textAnchor="middle"
      fontSize={20}
      fontWeight={800}
      fill="#1d2330"
      stroke="#fbfaf6"
      strokeWidth={5}
      paintOrder="stroke"
    >
      {text}
    </text>
  );

  return (
    <svg
      key="net"
      className={`${styles.xrayStageSvg} ${styles.svFadeIn}`}
      data-testid="sv-net-stage"
      viewBox={`0 0 ${SV_STAGE_W} ${SV_STAGE_H}`}
      width={SV_STAGE_W}
      height={SV_STAGE_H}
      role="group"
      aria-label={S.sv.netLabel}
    >
      <SvPatternDefs uid={uid} />
      {layout.map(({ face, x, y, w: fw, h: fh, flipped }) => {
        const isPainted = painted.has(face);
        const key = paintKeyOf(face, state.settings.pairColors);
        const px = originX + x * cell;
        const py = originY + y * cell;
        const name = S.sv.faceNames[face];
        return (
          <g
            key={face}
            data-testid={`sv-face-${face}`}
            data-painted={isPainted ? 'true' : 'false'}
            data-flipped={flipped ? 'true' : undefined}
            role={canPaint ? 'button' : undefined}
            tabIndex={canPaint ? 0 : undefined}
            aria-pressed={canPaint ? isPainted : undefined}
            aria-label={canPaint ? S.sv.faceAria(name, isPainted) : undefined}
            style={canPaint ? { cursor: 'pointer' } : undefined}
            onClick={() => toggle(face)}
            onKeyDown={(e) => {
              if (!canPaint) return;
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggle(face);
              }
            }}
          >
            <rect
              x={px}
              y={py}
              width={fw * cell}
              height={fh * cell}
              fill={isPainted ? paintFill(uid, key) : '#ffffff'}
            />
            {Array.from({ length: fw - 1 }, (_, i) => (
              <line
                key={`v${i}`}
                x1={px + (i + 1) * cell}
                y1={py}
                x2={px + (i + 1) * cell}
                y2={py + fh * cell}
                stroke={isPainted ? SV_PAINT_STYLES[key].fg : '#cbd5e1'}
                strokeOpacity={isPainted ? 0.55 : 1}
                strokeWidth={1}
              />
            ))}
            {Array.from({ length: fh - 1 }, (_, i) => (
              <line
                key={`h${i}`}
                x1={px}
                y1={py + (i + 1) * cell}
                x2={px + fw * cell}
                y2={py + (i + 1) * cell}
                stroke={isPainted ? SV_PAINT_STYLES[key].fg : '#cbd5e1'}
                strokeOpacity={isPainted ? 0.55 : 1}
                strokeWidth={1}
              />
            ))}
            <rect
              x={px}
              y={py}
              width={fw * cell}
              height={fh * cell}
              fill="none"
              stroke="#1e293b"
              strokeWidth={2.5}
              strokeLinejoin="round"
            />
            <text
              x={px + (fw * cell) / 2}
              y={py + (fh * cell) / 2 + 6}
              textAnchor="middle"
              fontSize={16}
              fontWeight={800}
              fill="#334155"
              stroke="#ffffff"
              strokeWidth={4}
              paintOrder="stroke"
              pointerEvents="none"
            >
              {SHORT_NAMES[face]}
            </text>
          </g>
        );
      })}
      {topFace
        ? pill(
            'sv-net-length-w',
            originX + (topFace.x + topFace.w / 2) * cell,
            originY + topFace.y * cell - 10,
            S.sv.lengthLabel(w),
          )
        : null}
      {leftFace
        ? pill(
            'sv-net-length-d',
            originX + (leftFace.x + leftFace.w / 2) * cell,
            originY + leftFace.y * cell - 10,
            S.sv.lengthLabel(d),
          )
        : null}
      {rightFace
        ? pill(
            'sv-net-length-h',
            originX + (rightFace.x + rightFace.w) * cell + 26,
            originY + (rightFace.y + rightFace.h / 2) * cell + 7,
            S.sv.lengthLabel(h),
          )
        : null}
    </svg>
  );
}
