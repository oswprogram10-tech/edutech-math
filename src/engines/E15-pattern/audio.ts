/**
 * E15 소리. Web Audio API(OscillatorNode)로 직접 만든다. 오디오 파일·외부 라이브러리는 없다.
 *
 * - `AudioContext`(또는 `webkitAudioContext`)가 있을 때만 쓴다. 기능 감지는 `audioSupported()`.
 * - iPad Safari는 첫 사용자 동작 안에서 만들고 `resume()`해야 소리가 난다.
 *   그래서 `unlockAudio()`는 단추 누름 같은 사용자 동작 안에서만 부른다.
 * - 주파수는 소리 값이지 화면 값이 아니므로 number를 쓴다.
 */

type AudioContextCtor = new () => AudioContext;

interface AudioWindow {
  AudioContext?: AudioContextCtor;
  webkitAudioContext?: AudioContextCtor;
}

function ctorOf(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null;
  const scope = window as unknown as AudioWindow;
  return scope.AudioContext ?? scope.webkitAudioContext ?? null;
}

/** Web Audio를 쓸 수 있는가(기능 감지). */
export function audioSupported(): boolean {
  return ctorOf() !== null;
}

let context: AudioContext | null = null;

/** 첫 사용자 동작에서 부른다. 만들 수 없으면 null. */
export function unlockAudio(): AudioContext | null {
  const Ctor = ctorOf();
  if (Ctor === null) return null;
  try {
    context ??= new Ctor();
    if (context.state === 'suspended') void context.resume().catch(() => undefined);
    return context;
  } catch {
    return null;
  }
}

/** 장음계 오음(도·레·미·솔·라)의 도에서 반음 수. */
const PENTATONIC_SEMITONES: readonly number[] = [0, 2, 4, 7, 9];
const BASE_FREQUENCY = 261.63;

/** 음 번호 n(0 = 도, 1 = 레, 2 = 미, 3 = 솔, 4 = 라, 5 = 높은 도 ...)의 주파수(Hz). */
export function noteFrequency(note: number): number {
  const n = Math.max(0, Math.trunc(note));
  const octave = Math.floor(n / PENTATONIC_SEMITONES.length);
  const semitones = PENTATONIC_SEMITONES[n % PENTATONIC_SEMITONES.length] ?? 0;
  return BASE_FREQUENCY * 2 ** (semitones / 12) * 2 ** octave;
}

/** 음 하나를 0.35초 사인파로 낸다(짧은 감쇠). 소리를 낼 수 없으면 false. */
export function playNote(note: number): boolean {
  const ctx = unlockAudio();
  if (ctx === null) return false;
  try {
    const now = ctx.currentTime;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = noteFrequency(note);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.25, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.36);
    return true;
  } catch {
    return false;
  }
}

/** 토큰의 음 번호. `notes`에 없으면 `order`(토큰 순서)에 따라 도·미·솔·라·높은 도·높은 레. */
const DEFAULT_NOTES: readonly number[] = [0, 2, 3, 4, 5, 6];

export function noteOfToken(
  token: string,
  notes: Readonly<Record<string, number>>,
  order: readonly string[],
): number {
  const given = notes[token];
  if (given !== undefined) return given;
  const index = order.indexOf(token);
  if (index < 0) return 0;
  return DEFAULT_NOTES[index] ?? index;
}
