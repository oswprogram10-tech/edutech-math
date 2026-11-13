/**
 * E12 3D 성능 측정 훅 (`probe` 모드 전용).
 *
 * - 처음 20프레임은 워밍업으로 버리고, 다음 60프레임의 평균 fps를 구한다.
 * - 3초 안에 60프레임을 못 채우면 그때까지의 평균 fps를 쓰고, 0프레임이면 0을 돌려준다.
 * - 카메라를 프레임마다 조금씩 돌려 실제로 100개 쌓기나무 장면이 그려지게 한다.
 */
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { CAMERA_DISTANCE, ISO_POLAR_RAD, sphericalToPosition } from './camera';

const WARMUP_FRAMES = 20;
const MEASURE_FRAMES = 60;
const PROBE_TIMEOUT_MS = 3000;

export function useFpsProbe(active: boolean, onComplete: (fps: number) => void): void {
  const { camera } = useThree();
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const stateRef = useRef<{
    totalFrames: number;
    measuredFrames: number;
    measureStartMs: number;
    azimuth: number;
    done: boolean;
  }>({
    totalFrames: 0,
    measuredFrames: 0,
    measureStartMs: 0,
    azimuth: Math.PI / 4,
    done: false,
  });

  useEffect(() => {
    if (!active) return undefined;
    stateRef.current = {
      totalFrames: 0,
      measuredFrames: 0,
      measureStartMs: 0,
      azimuth: Math.PI / 4,
      done: false,
    };

    const timerId = window.setTimeout(() => {
      const s = stateRef.current;
      if (s.done) return;
      s.done = true;
      if (s.measuredFrames <= 0) {
        onCompleteRef.current(0);
        return;
      }
      const elapsed = Math.max(1, performance.now() - s.measureStartMs);
      onCompleteRef.current((s.measuredFrames * 1000) / elapsed);
    }, PROBE_TIMEOUT_MS);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [active]);

  useFrame((_, delta) => {
    if (!active) return;
    const s = stateRef.current;
    if (s.done) return;

    s.azimuth += Math.max(0.016, Math.min(delta, 0.1)) * 0.9;
    const [cx, cy, cz] = sphericalToPosition(CAMERA_DISTANCE, ISO_POLAR_RAD, s.azimuth);
    camera.position.set(cx, cy, cz);
    camera.lookAt(0, 0, 0);

    s.totalFrames += 1;
    if (s.totalFrames <= WARMUP_FRAMES) {
      if (s.totalFrames === WARMUP_FRAMES) {
        s.measureStartMs = performance.now();
      }
      return;
    }

    s.measuredFrames += 1;
    if (s.measuredFrames >= MEASURE_FRAMES) {
      s.done = true;
      const elapsed = Math.max(1, performance.now() - s.measureStartMs);
      onCompleteRef.current((s.measuredFrames * 1000) / elapsed);
    }
  });
}
