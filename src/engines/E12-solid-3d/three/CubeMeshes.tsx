/**
 * E12 3D 쌓기나무 메시·테두리·색/무늬 CanvasTexture·반투명·강조 렌더링.
 */
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
  readonly cursor: GridCoord;
  readonly focus: FocusCell | null;
  readonly readOnly: boolean;
  readonly press?: PressGestureHandlers;
}

const CUBE_GEO = new THREE.BoxGeometry(1, 1, 1);
const CUBE_EDGES_GEO = new THREE.EdgesGeometry(CUBE_GEO);
const INK_EDGE_MAT = new THREE.LineBasicMaterial({ color: CUBE_INK });
const FOCUS_EDGE_MAT = new THREE.LineBasicMaterial({ color: FOCUS_STROKE });

const materialCache = new Map<string, THREE.MeshLambertMaterial>();
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
  // green diamond ◆
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

function getCubeMaterial(color: CubeColor, translucent: boolean): THREE.MeshLambertMaterial {
  const key = `${color}-${translucent ? 't' : 'o'}`;
  const existing = materialCache.get(key);
  if (existing) return existing;

  const texture = createCubeTexture(color);
  const palette = CUBE_PALETTE[color];
  const material = new THREE.MeshLambertMaterial({
    color: texture ? '#ffffff' : color === 'plain' ? palette.top : palette.front,
    map: texture ?? undefined,
    transparent: translucent,
    opacity: translucent ? 0.35 : 1,
    depthWrite: !translucent,
  });
  materialCache.set(key, material);
  return material;
}

export function CubeMeshes({
  cubes,
  grid,
  maxHeight,
  colorHints,
  translucent,
  cursor,
  focus,
  readOnly,
  press,
}: CubeMeshesProps) {
  const rows = grid[1];

  return (
    <group>
      {cubes.map((cube) => {
        const effectiveColor: CubeColor = colorHints ? cube.color : 'plain';
        const material = getCubeMaterial(effectiveColor, translucent);
        const pos = toWorld(cube.x, cube.y, cube.z, grid);
        const isFocused = matchesFocus(cube, focus, rows, maxHeight);
        const isCursorCol = !readOnly && cursor[0] === cube.x && cursor[1] === cube.y;

        return (
          <group key={`cube3d-${cube.x}-${cube.y}-${cube.z}`} position={[pos[0], pos[1], pos[2]]}>
            <mesh
              geometry={CUBE_GEO}
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
            <lineSegments geometry={CUBE_EDGES_GEO} material={INK_EDGE_MAT} raycast={noopRaycast} />
            {isFocused || isCursorCol ? (
              <>
                <lineSegments
                  geometry={CUBE_EDGES_GEO}
                  material={FOCUS_EDGE_MAT}
                  scale={1.015}
                  raycast={noopRaycast}
                />
                {isFocused ? (
                  <lineSegments
                    geometry={CUBE_EDGES_GEO}
                    material={FOCUS_EDGE_MAT}
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
