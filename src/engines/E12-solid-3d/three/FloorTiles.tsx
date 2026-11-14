/**
 * E12 3D 바닥 격자 타일·커서 테두리·"앞" 방향 표시.
 */
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
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
  readonly editable?: boolean;
  readonly press: PressGestureHandlers;
}

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

function createFrontMarkerTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 144;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#1d4fa8';
  ctx.fillStyle = '#1d4fa8';
  ctx.lineWidth = 12;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // 위쪽(무대 앞 가장자리 쪽)을 향하는 화살표만 그린다("앞" 글자는 HTML 이름표가 맡는다).
  ctx.beginPath();
  ctx.moveTo(128, 118);
  ctx.lineTo(128, 36);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(128, 16);
  ctx.lineTo(100, 52);
  ctx.lineTo(156, 52);
  ctx.closePath();
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function buildFloorResources() {
  const tileGeo = new THREE.BoxGeometry(0.96, 0.04, 0.96);
  const tileEdges = new THREE.EdgesGeometry(tileGeo);
  const tileBaseMat = new THREE.MeshLambertMaterial({ color: '#f1f5f9' });
  const tileFocusMat = new THREE.MeshLambertMaterial({ color: '#ffedd5' });
  const tileEdgeMat = new THREE.LineBasicMaterial({ color: '#94a3b8' });
  const tileFocusEdgeMat = new THREE.LineBasicMaterial({ color: FOCUS_STROKE });
  const cursorFrameMat = new THREE.MeshBasicMaterial({ color: FOCUS_STROKE });

  return {
    tileGeo,
    tileEdges,
    tileBaseMat,
    tileFocusMat,
    tileEdgeMat,
    tileFocusEdgeMat,
    cursorFrameMat,
    dispose() {
      cursorFrameMat.dispose();
      tileFocusEdgeMat.dispose();
      tileEdgeMat.dispose();
      tileFocusMat.dispose();
      tileBaseMat.dispose();
      tileEdges.dispose();
      tileGeo.dispose();
    },
  };
}

export function FloorTiles({
  cols,
  rows,
  cursor,
  focus,
  frontMarker,
  readOnly,
  editable = true,
  press,
}: FloorTilesProps) {
  const resources = useMemo(() => buildFloorResources(), []);

  useEffect(() => {
    return () => {
      resources.dispose();
    };
  }, [resources]);

  const frontResource = useMemo(() => {
    const texture = frontMarker ? createFrontMarkerTexture() : null;
    const material = texture
      ? new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false })
      : null;
    return {
      texture,
      material,
      touch() {
        if (texture) texture.needsUpdate = true;
      },
      dispose() {
        material?.dispose();
        texture?.dispose();
      },
    };
  }, [frontMarker]);

  useEffect(() => {
    frontResource.touch();
    return () => {
      frontResource.dispose();
    };
  }, [frontResource]);

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
        const isCursor = !readOnly && editable && cursor[0] === x && cursor[1] === y;
        return (
          <group key={`tile-${x}-${y}`} position={[pos[0], -0.02, pos[2]]}>
            <mesh
              geometry={resources.tileGeo}
              material={isTopFocus ? resources.tileFocusMat : resources.tileBaseMat}
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
              geometry={resources.tileEdges}
              material={isTopFocus ? resources.tileFocusEdgeMat : resources.tileEdgeMat}
              raycast={noopRaycast}
            />
            {isCursor
              ? CURSOR_STRIPS.map((strip, idx) => (
                  <mesh
                    key={`cursor-strip-${idx}`}
                    position={[strip.pos[0], strip.pos[1], strip.pos[2]]}
                    rotation={[-Math.PI / 2, 0, 0]}
                    material={resources.cursorFrameMat}
                    raycast={noopRaycast}
                  >
                    <planeGeometry args={[strip.size[0], strip.size[1]]} />
                  </mesh>
                ))
              : null}
          </group>
        );
      })}

      {frontMarker && frontResource.material ? (
        <mesh
          position={[0, 0.015, rows / 2 + 0.34]}
          rotation={[-Math.PI / 2, 0, 0]}
          material={frontResource.material}
          raycast={noopRaycast}
        >
          <planeGeometry args={[1.05, 0.58]} />
        </mesh>
      ) : null}
    </group>
  );
}
