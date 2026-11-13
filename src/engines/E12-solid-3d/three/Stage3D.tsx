/**
 * E12 3D Three.js / React Three Fiber 무대 (지연 로딩 전용 default export).
 *
 * - 직교 카메라 + OrbitControls(target = (0, 0, 0)), frameloop="demand"
 * - 3D WebGL <canvas> 위에 같은 크기의 투명 SVG `cubes-3d-canvas`를 겹쳐
 *   판 맞춤 E2E와 힌트 ② `CanvasAlignedOverlay`가 정확히 무대 상자를 찾게 한다.
 * - `probe` 모드에서는 5×5×4 = 100개 쌓기나무 장면의 평균 fps만 재고 보고한다.
 */
import { useEffect, useMemo, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { computeStageLayout } from '../layout';
import type { CubeItem, CubesState, ViewTurn } from '../types';
import styles from '../View.module.css';
import type { PressGestureHandlers } from '../views/usePressGesture';
import {
  CAMERA_DISTANCE,
  MAX_POLAR_RAD,
  computeFitZoom,
  shortestAngleDelta,
  sphericalToPosition,
  targetAnglesForPreset,
} from './camera';
import type { CameraPreset } from './camera';
import { CubeMeshes } from './CubeMeshes';
import { FloorTiles } from './FloorTiles';
import { useFpsProbe } from './probe';

export type { CameraPreset };

export interface CameraRequest {
  readonly preset: CameraPreset;
  readonly seq: number;
}

export interface Stage3DProps {
  readonly state: CubesState;
  readonly readOnly: boolean;
  readonly press: PressGestureHandlers;
  readonly cameraRequest: CameraRequest;
  readonly onContextLost: () => void;
  readonly probe?: boolean;
  readonly onProbeComplete?: (fps: number) => void;
}

const PROBE_CUBES: readonly CubeItem[] = (() => {
  const list: CubeItem[] = [];
  for (let x = 0; x < 5; x += 1) {
    for (let y = 0; y < 5; y += 1) {
      for (let z = 0; z < 4; z += 1) {
        list.push({ x, y, z, color: 'plain', locked: false });
      }
    }
  }
  return list;
})();

const CAMERA_ANIM_MS = 300;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function applyCameraZoom(camera: THREE.Camera, zoom: number): void {
  if (camera instanceof THREE.OrthographicCamera || camera instanceof THREE.PerspectiveCamera) {
    camera.zoom = zoom;
    camera.updateProjectionMatrix();
  }
}

function ProbeRig({ onComplete }: { readonly onComplete: (fps: number) => void }) {
  const { get, size } = useThree();
  useEffect(() => {
    const zoom = computeFitZoom(size.width, size.height, 5, 5, 4);
    applyCameraZoom(get().camera, zoom);
  }, [get, size.width, size.height]);

  useFpsProbe(true, onComplete);

  return (
    <>
      <color attach="background" args={['#fbfaf6']} />
      <ambientLight intensity={0.78} />
      <directionalLight position={[6, 12, 5]} intensity={0.9} />
      <CubeMeshes
        cubes={PROBE_CUBES}
        grid={[5, 5]}
        maxHeight={4}
        colorHints={false}
        translucent={false}
        cursor={[0, 0]}
        focus={null}
        readOnly
      />
    </>
  );
}

interface CameraRigProps {
  readonly cols: number;
  readonly rows: number;
  readonly maxHeight: number;
  readonly viewTurn: ViewTurn;
  readonly rotationLocked: boolean;
  readonly cameraRequest: CameraRequest;
}

function CameraRig({
  cols,
  rows,
  maxHeight,
  viewTurn,
  rotationLocked,
  cameraRequest,
}: CameraRigProps) {
  const { camera, gl, size, invalidate, get } = useThree();
  const controlsRef = useRef<OrbitControls | null>(null);
  const animRef = useRef<{
    active: boolean;
    startMs: number;
    startAzimuth: number;
    startPolar: number;
    deltaAzimuth: number;
    deltaPolar: number;
    targetAzimuth: number;
    targetPolar: number;
  }>({
    active: false,
    startMs: 0,
    startAzimuth: 0,
    startPolar: 0,
    deltaAzimuth: 0,
    deltaPolar: 0,
    targetAzimuth: 0,
    targetPolar: 0,
  });
  const initializedRef = useRef(false);
  const lastSeqRef = useRef<number>(-1);
  const lastTurnRef = useRef<ViewTurn>(viewTurn);

  useEffect(() => {
    const controls = new OrbitControls(camera, gl.domElement);
    controls.target.set(0, 0, 0);
    controls.enablePan = false;
    controls.enableZoom = !rotationLocked;
    controls.enableRotate = !rotationLocked;
    controls.minPolarAngle = 0;
    controls.maxPolarAngle = MAX_POLAR_RAD;
    controls.mouseButtons = {
      LEFT: null,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE,
    };
    controls.touches = {
      ONE: null,
      TWO: THREE.TOUCH.DOLLY_ROTATE,
    };
    controlsRef.current = controls;

    const onChange = () => {
      invalidate();
    };
    controls.addEventListener('change', onChange);

    return () => {
      controls.removeEventListener('change', onChange);
      controls.dispose();
      if (controlsRef.current === controls) {
        controlsRef.current = null;
      }
    };
  }, [camera, gl, invalidate, rotationLocked]);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    controls.enableRotate = !rotationLocked;
    controls.enableZoom = !rotationLocked;
    const fitZoom = computeFitZoom(size.width, size.height, cols, rows, maxHeight);
    controls.minZoom = fitZoom * 0.6;
    controls.maxZoom = fitZoom * 2;
    applyCameraZoom(get().camera, fitZoom);
    controls.update();
    invalidate();
  }, [get, cols, rows, maxHeight, size.width, size.height, rotationLocked, invalidate]);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const preset = lastTurnRef.current !== viewTurn ? 'iso' : cameraRequest.preset;
    const { azimuth, polar } = targetAnglesForPreset(preset, viewTurn);

    const isFirst = !initializedRef.current;
    const immediate =
      isFirst || prefersReducedMotion() || (rotationLocked && lastTurnRef.current === viewTurn);
    const changed =
      isFirst || lastSeqRef.current !== cameraRequest.seq || lastTurnRef.current !== viewTurn;
    initializedRef.current = true;
    lastSeqRef.current = cameraRequest.seq;
    lastTurnRef.current = viewTurn;
    if (!changed) return;

    if (immediate) {
      animRef.current.active = false;
      const [px, py, pz] = sphericalToPosition(CAMERA_DISTANCE, polar, azimuth);
      camera.position.set(px, py, pz);
      controls.target.set(0, 0, 0);
      controls.update();
      invalidate();
      return;
    }

    const offset = camera.position.clone().sub(controls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    animRef.current = {
      active: true,
      startMs: performance.now(),
      startAzimuth: spherical.theta,
      startPolar: spherical.phi,
      deltaAzimuth: shortestAngleDelta(spherical.theta, azimuth),
      deltaPolar: polar - spherical.phi,
      targetAzimuth: azimuth,
      targetPolar: polar,
    };
    invalidate();
  }, [camera, cameraRequest.preset, cameraRequest.seq, viewTurn, rotationLocked, invalidate]);

  useFrame(() => {
    const anim = animRef.current;
    const controls = controlsRef.current;
    if (!anim.active || !controls) return;

    const elapsed = performance.now() - anim.startMs;
    const rawT = Math.min(1, elapsed / CAMERA_ANIM_MS);
    const t = 1 - Math.pow(1 - rawT, 3);

    const azimuth = rawT >= 1 ? anim.targetAzimuth : anim.startAzimuth + anim.deltaAzimuth * t;
    const polar = rawT >= 1 ? anim.targetPolar : anim.startPolar + anim.deltaPolar * t;
    const [px, py, pz] = sphericalToPosition(CAMERA_DISTANCE, polar, azimuth);
    camera.position.set(px, py, pz);
    controls.target.set(0, 0, 0);
    controls.update();

    if (rawT >= 1) {
      anim.active = false;
    } else {
      invalidate();
    }
  });

  return null;
}

export default function Stage3D({
  state,
  readOnly,
  press,
  cameraRequest,
  onContextLost,
  probe = false,
  onProbeComplete,
}: Stage3DProps) {
  const { settings } = state;
  const [cols, rows] = settings.grid;
  const layout = computeStageLayout(cols, rows, settings.maxHeight);
  const activePointersRef = useRef<Set<number>>(new Set());
  const cleanupContextRef = useRef<(() => void) | null>(null);

  const initialPos = useMemo(() => {
    const { azimuth, polar } = targetAnglesForPreset('iso', 0);
    return sphericalToPosition(CAMERA_DISTANCE, polar, azimuth);
  }, []);

  useEffect(() => {
    return () => {
      cleanupContextRef.current?.();
      cleanupContextRef.current = null;
    };
  }, []);

  if (probe && onProbeComplete) {
    return (
      <div className={styles.probeLayer} aria-hidden="true">
        <Canvas
          orthographic
          frameloop="always"
          dpr={[1, 2]}
          gl={{ antialias: true }}
          camera={{ position: [initialPos[0], initialPos[1], initialPos[2]], near: 0.1, far: 100 }}
          style={{ width: '100%', height: '100%', display: 'block' }}
        >
          <ProbeRig onComplete={onProbeComplete} />
        </Canvas>
      </div>
    );
  }

  const onHostPointerDownCapture = (event: ReactPointerEvent<HTMLDivElement>) => {
    activePointersRef.current.add(event.pointerId);
    if (activePointersRef.current.size >= 2) {
      press.cancel();
    }
  };

  const onHostPointerEndCapture = (event: ReactPointerEvent<HTMLDivElement>) => {
    activePointersRef.current.delete(event.pointerId);
  };

  return (
    <div
      className={styles.stage3dHost}
      onPointerDownCapture={onHostPointerDownCapture}
      onPointerUpCapture={onHostPointerEndCapture}
      onPointerCancelCapture={onHostPointerEndCapture}
    >
      <Canvas
        orthographic
        frameloop="demand"
        dpr={[1, 2]}
        gl={{ antialias: true }}
        camera={{ position: [initialPos[0], initialPos[1], initialPos[2]], near: 0.1, far: 100 }}
        style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none' }}
        onCreated={({ gl }) => {
          cleanupContextRef.current?.();
          const canvasEl = gl.domElement;
          const handleLost = (e: Event) => {
            e.preventDefault();
            onContextLost();
          };
          canvasEl.addEventListener('webglcontextlost', handleLost);
          cleanupContextRef.current = () => {
            canvasEl.removeEventListener('webglcontextlost', handleLost);
          };
        }}
      >
        <color attach="background" args={['#fbfaf6']} />
        <ambientLight intensity={0.78} />
        <directionalLight position={[6, 12, 5]} intensity={0.9} />
        <CameraRig
          cols={cols}
          rows={rows}
          maxHeight={settings.maxHeight}
          viewTurn={state.viewTurn}
          rotationLocked={settings.rotationLocked}
          cameraRequest={cameraRequest}
        />
        <FloorTiles
          cols={cols}
          rows={rows}
          cursor={state.cursor}
          focus={state.focus}
          frontMarker={settings.frontMarker}
          readOnly={readOnly}
          press={press}
        />
        <CubeMeshes
          cubes={state.cubes}
          grid={settings.grid}
          maxHeight={settings.maxHeight}
          colorHints={settings.colorHints}
          translucent={state.translucent}
          cursor={state.cursor}
          focus={state.focus}
          readOnly={readOnly}
          press={press}
        />
      </Canvas>
      <svg
        className={styles.overlay3dMirror}
        viewBox={`0 0 ${layout.viewBox.width} ${layout.viewBox.height}`}
        data-testid="cubes-3d-canvas"
        aria-hidden="true"
      />
    </div>
  );
}
