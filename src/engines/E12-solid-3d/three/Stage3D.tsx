/**
 * E12 3D Three.js / React Three Fiber 무대 (지연 로딩 전용 default export).
 *
 * - 직교 카메라 + OrbitControls(target = 상자 중심 또는 위에서 (0,0,0)), frameloop="demand"
 * - 3D WebGL <canvas> 위에 같은 크기의 투명 SVG `cubes-3d-canvas`(preserveAspectRatio="xMinYMin meet")를 겹쳐
 *   판 맞춤 E2E와 힌트 ② `CanvasAlignedOverlay`가 정확히 무대 상자를 찾게 한다.
 * - `probe` 모드에서는 5×5×4 = 100개 쌓기나무 장면의 평균 fps만 재고 보고한다.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { computeStageLayout } from '../layout';
import { solid3dStrings as S } from '../strings.ko';
import type { CubeItem, CubesState, ViewTurn } from '../types';
import styles from '../View.module.css';
import type { PressGestureHandlers } from '../views/usePressGesture';
import {
  CAMERA_DISTANCE,
  MAX_POLAR_RAD,
  clampStageLabelPoint,
  computeFitZoom,
  frontMarkerWorld,
  shortestAngleDelta,
  sphericalToPosition,
  targetAnglesForPreset,
  targetForPreset,
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
  readonly editable?: boolean;
  readonly press: PressGestureHandlers;
  readonly cameraRequest: CameraRequest;
  readonly onContextLost: () => void;
  readonly onUnitPxChange?: (unitPx: number) => void;
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

function applyCameraPose(
  camera: THREE.Camera,
  controls: OrbitControls,
  target: readonly [number, number, number],
  polar: number,
  azimuth: number,
): void {
  const [ox, oy, oz] = sphericalToPosition(CAMERA_DISTANCE, polar, azimuth);
  controls.target.set(target[0], target[1], target[2]);
  camera.position.set(target[0] + ox, target[1] + oy, target[2] + oz);
  controls.update();
}

function ProbeRig({ onComplete }: { readonly onComplete: (fps: number) => void }) {
  const { get, size } = useThree();
  useEffect(() => {
    const { azimuth, polar } = targetAnglesForPreset('iso', 0);
    const zoom = computeFitZoom(size.width, size.height, 5, 5, 4, azimuth, polar);
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
  readonly frontMarker: boolean;
  readonly frontLabelRef: RefObject<HTMLSpanElement | null>;
  readonly cameraRequest: CameraRequest;
  readonly onUnitPxChange?: (unitPx: number) => void;
}

function CameraRig({
  cols,
  rows,
  maxHeight,
  viewTurn,
  rotationLocked,
  frontMarker,
  frontLabelRef,
  cameraRequest,
  onUnitPxChange,
}: CameraRigProps) {
  const { gl, size, invalidate, get } = useThree();
  const controlsRef = useRef<OrbitControls | null>(null);
  const projectedVecRef = useRef(new THREE.Vector3());

  const syncFrontLabel = useCallback(() => {
    const el = frontLabelRef.current;
    if (!el || !frontMarker || size.width <= 0 || size.height <= 0) return;
    const cam = get().camera;
    cam.updateMatrixWorld();
    cam.updateProjectionMatrix();
    const [wx, wy, wz] = frontMarkerWorld(rows);
    const v = projectedVecRef.current.set(wx, wy, wz).project(cam);
    const rawX = (v.x * 0.5 + 0.5) * size.width;
    const rawY = (-v.y * 0.5 + 0.5) * size.height;
    const clamped = clampStageLabelPoint(
      rawX,
      rawY,
      size.width,
      size.height,
      el.offsetWidth || 40,
      el.offsetHeight || 28,
    );
    el.style.left = `${clamped.x.toFixed(1)}px`;
    el.style.top = `${clamped.y.toFixed(1)}px`;
  }, [frontLabelRef, frontMarker, get, rows, size.width, size.height]);

  const syncFrontLabelRef = useRef(syncFrontLabel);
  useEffect(() => {
    syncFrontLabelRef.current = syncFrontLabel;
  }, [syncFrontLabel]);
  const animRef = useRef<{
    active: boolean;
    startMs: number;
    startAzimuth: number;
    startPolar: number;
    deltaAzimuth: number;
    deltaPolar: number;
    targetAzimuth: number;
    targetPolar: number;
    startTarget: readonly [number, number, number];
    endTarget: readonly [number, number, number];
  }>({
    active: false,
    startMs: 0,
    startAzimuth: 0,
    startPolar: 0,
    deltaAzimuth: 0,
    deltaPolar: 0,
    targetAzimuth: 0,
    targetPolar: 0,
    startTarget: [0, 0, 0],
    endTarget: [0, 0, 0],
  });
  const initializedRef = useRef(false);
  const lastSeqRef = useRef<number>(-1);
  const lastTurnRef = useRef<ViewTurn>(viewTurn);

  useEffect(() => {
    const cam = get().camera;
    const controls = new OrbitControls(cam, gl.domElement);
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
      syncFrontLabelRef.current();
      invalidate();
    };
    controls.addEventListener('change', onChange);

    return () => {
      controls.removeEventListener('change', onChange);
      controls.dispose();
      if (controlsRef.current === controls) {
        controlsRef.current = null;
      }
      initializedRef.current = false;
    };
  }, [get, gl, invalidate, rotationLocked]);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const cam = get().camera;

    controls.enableRotate = !rotationLocked;
    controls.enableZoom = !rotationLocked;

    const isFirst = !initializedRef.current;
    const turnChanged = lastTurnRef.current !== viewTurn;
    const seqChanged = lastSeqRef.current !== cameraRequest.seq;
    initializedRef.current = true;
    lastSeqRef.current = cameraRequest.seq;
    lastTurnRef.current = viewTurn;

    if (isFirst || turnChanged || seqChanged) {
      const preset: CameraPreset = isFirst || turnChanged ? 'iso' : cameraRequest.preset;
      const { azimuth, polar } = targetAnglesForPreset(preset, viewTurn);
      const nextTarget = targetForPreset(preset, maxHeight);
      const fitZoom = computeFitZoom(
        size.width,
        size.height,
        cols,
        rows,
        maxHeight,
        azimuth,
        polar,
      );

      controls.minZoom = fitZoom * 0.6;
      controls.maxZoom = fitZoom * 2;
      applyCameraZoom(cam, fitZoom);
      onUnitPxChange?.(Math.round(fitZoom));

      const immediate = isFirst || prefersReducedMotion() || (rotationLocked && !turnChanged);

      if (immediate) {
        animRef.current.active = false;
        applyCameraPose(cam, controls, nextTarget, polar, azimuth);
        syncFrontLabel();
        invalidate();
        return;
      }

      const offset = cam.position.clone().sub(controls.target);
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
        startTarget: [controls.target.x, controls.target.y, controls.target.z],
        endTarget: nextTarget,
      };
      syncFrontLabel();
      invalidate();
      return;
    }

    // 무대 크기나 격자 설정만 바뀌었을 때는 현재 카메라 회전각을 유지한 채 배율만 다시 맞춘다.
    let azimuth: number;
    let polar: number;
    if (animRef.current.active) {
      azimuth = animRef.current.targetAzimuth;
      polar = animRef.current.targetPolar;
    } else {
      const offset = cam.position.clone().sub(controls.target);
      const spherical = new THREE.Spherical().setFromVector3(offset);
      azimuth = spherical.theta;
      polar = spherical.phi;
    }

    const fitZoom = computeFitZoom(size.width, size.height, cols, rows, maxHeight, azimuth, polar);
    controls.minZoom = fitZoom * 0.6;
    controls.maxZoom = fitZoom * 2;
    applyCameraZoom(cam, fitZoom);
    controls.update();
    syncFrontLabel();
    onUnitPxChange?.(Math.round(fitZoom));
    invalidate();
  }, [
    get,
    cols,
    rows,
    maxHeight,
    size.width,
    size.height,
    cameraRequest.preset,
    cameraRequest.seq,
    viewTurn,
    rotationLocked,
    invalidate,
    onUnitPxChange,
    syncFrontLabel,
  ]);

  useFrame(() => {
    const anim = animRef.current;
    const controls = controlsRef.current;
    if (!anim.active || !controls) return;
    const cam = get().camera;

    const elapsed = performance.now() - anim.startMs;
    const rawT = Math.min(1, elapsed / CAMERA_ANIM_MS);
    const t = 1 - Math.pow(1 - rawT, 3);

    const azimuth = rawT >= 1 ? anim.targetAzimuth : anim.startAzimuth + anim.deltaAzimuth * t;
    const polar = rawT >= 1 ? anim.targetPolar : anim.startPolar + anim.deltaPolar * t;
    const tx =
      rawT >= 1
        ? anim.endTarget[0]
        : anim.startTarget[0] + (anim.endTarget[0] - anim.startTarget[0]) * t;
    const ty =
      rawT >= 1
        ? anim.endTarget[1]
        : anim.startTarget[1] + (anim.endTarget[1] - anim.startTarget[1]) * t;
    const tz =
      rawT >= 1
        ? anim.endTarget[2]
        : anim.startTarget[2] + (anim.endTarget[2] - anim.startTarget[2]) * t;

    applyCameraPose(cam, controls, [tx, ty, tz], polar, azimuth);
    syncFrontLabelRef.current();

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
  editable = true,
  press,
  cameraRequest,
  onContextLost,
  onUnitPxChange,
  probe = false,
  onProbeComplete,
}: Stage3DProps) {
  const { settings } = state;
  const [cols, rows] = settings.grid;
  const layout = computeStageLayout(cols, rows, settings.maxHeight);
  const activePointersRef = useRef<Set<number>>(new Set());
  const cleanupContextRef = useRef<(() => void) | null>(null);
  const frontLabelRef = useRef<HTMLSpanElement | null>(null);

  const initialPos = useMemo(() => {
    const { azimuth, polar } = targetAnglesForPreset('iso', 0);
    const target = targetForPreset('iso', settings.maxHeight);
    const [ox, oy, oz] = sphericalToPosition(CAMERA_DISTANCE, polar, azimuth);
    return [target[0] + ox, target[1] + oy, target[2] + oz] as const;
  }, [settings.maxHeight]);

  useEffect(() => {
    return () => {
      cleanupContextRef.current?.();
      cleanupContextRef.current = null;
    };
  }, []);

  if (probe && onProbeComplete) {
    const { azimuth, polar } = targetAnglesForPreset('iso', 0);
    const [px, py, pz] = sphericalToPosition(CAMERA_DISTANCE, polar, azimuth);
    return (
      <div className={styles.probeLayer} aria-hidden="true">
        <Canvas
          orthographic
          frameloop="always"
          dpr={[1, 2]}
          gl={{ antialias: true }}
          camera={{ position: [px, py + 2, pz], near: 0.1, far: 100 }}
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
          frontMarker={settings.frontMarker}
          frontLabelRef={frontLabelRef}
          cameraRequest={cameraRequest}
          onUnitPxChange={onUnitPxChange}
        />
        <FloorTiles
          cols={cols}
          rows={rows}
          cursor={state.cursor}
          focus={state.focus}
          frontMarker={settings.frontMarker}
          readOnly={readOnly}
          editable={editable}
          press={press}
        />
        <CubeMeshes
          cubes={state.cubes}
          grid={settings.grid}
          maxHeight={settings.maxHeight}
          colorHints={settings.colorHints}
          translucent={state.translucent}
          layerFocus={state.layerFocus}
          cursor={state.cursor}
          focus={state.focus}
          readOnly={readOnly}
          editable={editable}
          press={press}
        />
      </Canvas>
      <svg
        className={styles.overlay3dMirror}
        viewBox={`0 0 ${layout.viewBox.width} ${layout.viewBox.height}`}
        preserveAspectRatio="xMinYMin meet"
        data-testid="cubes-3d-canvas"
        aria-hidden="true"
      />
      {settings.frontMarker ? (
        <span
          ref={frontLabelRef}
          className={styles.frontLabel}
          data-testid="cubes-front-label"
          aria-hidden="true"
        >
          {S.front}
        </span>
      ) : null}
    </div>
  );
}
