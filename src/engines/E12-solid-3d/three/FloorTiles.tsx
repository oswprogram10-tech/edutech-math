/**
 * E12 3D 바닥 격자 타일·커서 테두리·"앞" 방향 표시.
 */
import { useMemo } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import { solid3dStrings as S } from '../strings.ko';
import type { FocusCell, GridCoord } from '../types';
import { FOCUS_STROKE, isTopFloorFocused } from '../views/focusMatch';
import type { PressGestureHandlers } from '../views/usePressGesture';
import { floorTileWorld } from './camera';

interface FloorTilesProps {
  readonly cols: number;
  readonly rows: number;
  readonly cursor: GridCoord;
  readonly focus: FocusCell | null;
  readonly frontMarker: boolean;
  readonly readOnly: boolean;
  readonly press: PressGestureHandlers;
}

const TILE_GEO = new THREE.BoxGeometry(0.96, 0.04, 0.96);
const TILE_EDGES = new THREE.EdgesGeometry(TILE_GEO);
const TILE_BASE_MAT = new THREE.MeshLambertMaterial({ color: '#f1f5f9' });
const TILE_FOCUS_MAT = new THREE.MeshLambertMaterial({ color: '#ffedd5' });
const TILE_EDGE_MAT = new THREE.LineBasicMaterial({ color: '#94a3b8' });
const TILE_FOCUS_EDGE_MAT = new THREE.LineBasicMaterial({ color: FOCUS_STROKE });
const CURSOR_FRAME_MAT = new THREE.MeshBasicMaterial({ color: FOCUS_STROKE });

const CURSOR_STRIPS: readonly {
  readonly pos: readonly [number, number, number];
  readonly size: readonly [number, number];
}[] = [
  { pos: [0, 0.025, -0.45], size: [0.96, 0.07] },
  { pos: [0, 0.025, 0.45], size: [0.96, 0.07] },
  { pos: [-0.45, 0.025, 0], size: [0.07, 0.96] },
  { pos: [0.45, 0.025, 0], size: [0.07, 0.96] },
];

const noopRaycast = () => {};

let cachedFrontTexture: THREE.CanvasTexture | null = null;

function getFrontMarkerTexture(): THREE.CanvasTexture | null {
  if (cachedFrontTexture) return cachedFrontTexture;
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#1d4fa8';
  ctx.fillStyle = '#1d4fa8';
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // 위쪽(무대 앞 가장자리 쪽)을 향하는 화살표
  ctx.beginPath();
  ctx.moveTo(128, 66);
  ctx.lineTo(128, 18);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(128, 10);
  ctx.lineTo(108, 36);
  ctx.lineTo(148, 36);
  ctx.closePath();
  ctx.fill();

  ctx.font = '800 58px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(S.front, 128, 114);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  cachedFrontTexture = texture;
  return texture;
}

export function FloorTiles({
  cols,
  rows,
  cursor,
  focus,
  frontMarker,
  readOnly,
  press,
}: FloorTilesProps) {
  const tiles = useMemo(() => {
    const items: {
      readonly x: number;
      readonly y: number;
      readonly pos: readonly [number, number, number];
    }[] = [];
    for (let x = 0; x < cols; x += 1) {
      for (let y = 0; y < rows; y += 1) {
        items.push({ x, y, pos: floorTileWorld(x, y, [cols, rows]) });
      }
    }
    return items;
  }, [cols, rows]);

  const frontTexture = useMemo(() => (frontMarker ? getFrontMarkerTexture() : null), [frontMarker]);

  const handleDown = (event: ThreeEvent<PointerEvent>, x: number, y: number) => {
    event.stopPropagation();
    press.onPointerDown(event, x, y);
  };

  const handleUp = (event: ThreeEvent<PointerEvent>, x: number, y: number) => {
    event.stopPropagation();
    press.onPointerUp(event, x, y);
  };

  return (
    <group>
      {tiles.map(({ x, y, pos }) => {
        const isTopFocus = isTopFloorFocused(x, y, focus, rows);
        const isCursor = !readOnly && cursor[0] === x && cursor[1] === y;
        return (
          <group key={`tile-${x}-${y}`} position={[pos[0], -0.02, pos[2]]}>
            <mesh
              geometry={TILE_GEO}
              material={isTopFocus ? TILE_FOCUS_MAT : TILE_BASE_MAT}
              onPointerDown={(e) => handleDown(e, x, y)}
              onPointerMove={(e) => {
                e.stopPropagation();
                press.onPointerMove(e);
              }}
              onPointerUp={(e) => handleUp(e, x, y)}
              onPointerCancel={(e) => {
                e.stopPropagation();
                press.onPointerCancel(e);
              }}
            />
            <lineSegments
              geometry={TILE_EDGES}
              material={isTopFocus ? TILE_FOCUS_EDGE_MAT : TILE_EDGE_MAT}
              raycast={noopRaycast}
            />
            {isCursor
              ? CURSOR_STRIPS.map((strip, idx) => (
                  <mesh
                    key={`cursor-strip-${idx}`}
                    position={[strip.pos[0], strip.pos[1], strip.pos[2]]}
                    rotation={[-Math.PI / 2, 0, 0]}
                    material={CURSOR_FRAME_MAT}
                    raycast={noopRaycast}
                  >
                    <planeGeometry args={[strip.size[0], strip.size[1]]} />
                  </mesh>
                ))
              : null}
          </group>
        );
      })}

      {frontMarker && frontTexture ? (
        <mesh
          position={[0, 0.015, rows / 2 + 0.56]}
          rotation={[-Math.PI / 2, 0, 0]}
          raycast={noopRaycast}
        >
          <planeGeometry args={[1.3, 0.82]} />
          <meshBasicMaterial map={frontTexture} transparent depthWrite={false} />
        </mesh>
      ) : null}
    </group>
  );
}
