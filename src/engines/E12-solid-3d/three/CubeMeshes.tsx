/**
 * E12 3D 쌓기나무 메시·테두리·색/무늬 CanvasTexture·반투명·강조 렌더링.
 */
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import type { CubeColor, CubeItem, FocusCell, GridCoord } from '../types';
import { CUBE_INK, CUBE_PALETTE, FOCUS_STROKE, matchesFocus } from '../views/focusMatch';
import type { PressGestureHandlers } from '../views/usePressGesture';
import { toWorld } from './camera';

interface CubeMeshesProps {
  readonly cubes: readonly CubeItem[];
  readonly grid: readonly [number, number];
  readonly maxHeight: number;
  readonly colorHints: boolean;
  readonly translucent: boolean;
  readonly layerFocus?: number | null;
  readonly cursor: GridCoord;
  readonly focus: FocusCell | null;
  readonly readOnly: boolean;
  readonly editable?: boolean;
  readonly press?: PressGestureHandlers;
}

const CUBE_COLORS: readonly CubeColor[] = ['plain', 'red', 'blue', 'yellow', 'green'];
const noopRaycast = () => {};

function drawShapeOnCanvas(
  ctx: CanvasRenderingContext2D,
  color: CubeColor,
  markColor: string,
): void {
  if (color === 'plain') return;
  const c = 64;
  ctx.fillStyle = markColor;

  if (color === 'red') {
    ctx.beginPath();
    ctx.arc(c, c, 21, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  if (color === 'blue') {
    ctx.beginPath();
    ctx.moveTo(c, c - 24);
    ctx.lineTo(c + 22, c + 18);
    ctx.lineTo(c - 22, c + 18);
    ctx.closePath();
    ctx.fill();
    return;
  }
  if (color === 'yellow') {
    ctx.fillRect(c - 18, c - 18, 36, 36);
    return;
  }
  ctx.beginPath();
  ctx.moveTo(c, c - 24);
  ctx.lineTo(c + 24, c);
  ctx.lineTo(c, c + 24);
  ctx.lineTo(c - 24, c);
  ctx.closePath();
  ctx.fill();
}

function createCubeTexture(color: CubeColor): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const palette = CUBE_PALETTE[color];
  ctx.fillStyle = color === 'plain' ? palette.top : palette.front;
  ctx.fillRect(0, 0, 128, 128);
  drawShapeOnCanvas(ctx, color, palette.mark);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function buildCubeResources() {
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const edgesGeo = new THREE.EdgesGeometry(boxGeo);
  const inkEdgeMat = new THREE.LineBasicMaterial({ color: CUBE_INK });
  const focusEdgeMat = new THREE.LineBasicMaterial({ color: FOCUS_STROKE });

  const textures = new Map<CubeColor, THREE.CanvasTexture>();
  const materials = new Map<string, THREE.MeshLambertMaterial>();

  for (const color of CUBE_COLORS) {
    const texture = createCubeTexture(color);
    if (texture) textures.set(color, texture);
    const palette = CUBE_PALETTE[color];

    for (const variant of [
      { key: 'o', transparent: false, opacity: 1 },
      { key: 't', transparent: true, opacity: 0.35 },
      { key: 'l', transparent: true, opacity: 0.2 },
    ] as const) {
      const mat = new THREE.MeshLambertMaterial({
        color: texture ? '#ffffff' : color === 'plain' ? palette.top : palette.front,
        map: texture ?? undefined,
        transparent: variant.transparent,
        opacity: variant.opacity,
        depthWrite: !variant.transparent,
      });
      materials.set(`${color}-${variant.key}`, mat);
    }
  }

  return {
    boxGeo,
    edgesGeo,
    inkEdgeMat,
    focusEdgeMat,
    materials,
    touchTextures() {
      for (const texture of textures.values()) {
        texture.needsUpdate = true;
      }
    },
    dispose() {
      for (const texture of textures.values()) {
        texture.dispose();
      }
      for (const material of materials.values()) {
        material.dispose();
      }
      inkEdgeMat.dispose();
      focusEdgeMat.dispose();
      edgesGeo.dispose();
      boxGeo.dispose();
    },
  };
}

export function CubeMeshes({
  cubes,
  grid,
  maxHeight,
  colorHints,
  translucent,
  layerFocus = null,
  cursor,
  focus,
  readOnly,
  editable = true,
  press,
}: CubeMeshesProps) {
  const resources = useMemo(() => buildCubeResources(), []);

  useEffect(() => {
    resources.touchTextures();
    return () => {
      resources.dispose();
    };
  }, [resources]);

  const rows = grid[1];

  return (
    <group>
      {cubes.map((cube) => {
        const effectiveColor: CubeColor = colorHints ? cube.color : 'plain';
        const matVariant =
          layerFocus !== null ? (cube.z === layerFocus - 1 ? 'o' : 'l') : translucent ? 't' : 'o';
        const material = resources.materials.get(`${effectiveColor}-${matVariant}`);
        if (!material) return null;
        const pos = toWorld(cube.x, cube.y, cube.z, grid);
        const isFocused = matchesFocus(cube, focus, rows, maxHeight);
        const isCursorCol = !readOnly && editable && cursor[0] === cube.x && cursor[1] === cube.y;

        return (
          <group key={`cube3d-${cube.x}-${cube.y}-${cube.z}`} position={[pos[0], pos[1], pos[2]]}>
            <mesh
              geometry={resources.boxGeo}
              material={material}
              onPointerDown={
                press
                  ? (e: ThreeEvent<PointerEvent>) => {
                      e.stopPropagation();
                      press.onPointerDown(e, cube.x, cube.y);
                    }
                  : undefined
              }
              onPointerMove={
                press
                  ? (e: ThreeEvent<PointerEvent>) => {
                      e.stopPropagation();
                      press.onPointerMove(e);
                    }
                  : undefined
              }
              onPointerUp={
                press
                  ? (e: ThreeEvent<PointerEvent>) => {
                      e.stopPropagation();
                      press.onPointerUp(e, cube.x, cube.y);
                    }
                  : undefined
              }
              onPointerCancel={
                press
                  ? (e: ThreeEvent<PointerEvent>) => {
                      e.stopPropagation();
                      press.onPointerCancel(e);
                    }
                  : undefined
              }
            />
            <lineSegments
              geometry={resources.edgesGeo}
              material={resources.inkEdgeMat}
              raycast={noopRaycast}
            />
            {isFocused || isCursorCol ? (
              <>
                <lineSegments
                  geometry={resources.edgesGeo}
                  material={resources.focusEdgeMat}
                  scale={1.015}
                  raycast={noopRaycast}
                />
                {isFocused ? (
                  <lineSegments
                    geometry={resources.edgesGeo}
                    material={resources.focusEdgeMat}
                    scale={1.028}
                    raycast={noopRaycast}
                  />
                ) : null}
              </>
            ) : null}
          </group>
        );
      })}
    </group>
  );
}
