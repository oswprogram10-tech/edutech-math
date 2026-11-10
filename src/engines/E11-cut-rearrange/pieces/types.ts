/** slice·formula-derive 모드의 설정·상태·Action. */
import type { RPoint } from '../rpoint';

export type PieceMode = 'slice' | 'formula-derive';

export type PieceTool = 'move' | 'scissors' | 'rotate90' | 'hinge180' | 'duplicate';

export type FormulaShapeType = 'parallelogram' | 'triangle' | 'trapezoid' | 'rhombus';

export type FormulaShape =
  | {
      readonly type: 'parallelogram';
      readonly base: number;
      readonly height: number;
      readonly skew: number;
    }
  | {
      readonly type: 'triangle';
      readonly base: number;
      readonly height: number;
      readonly apex: number;
    }
  | {
      readonly type: 'trapezoid';
      readonly top: number;
      readonly bottom: number;
      readonly height: number;
      readonly offset: number;
    }
  | { readonly type: 'rhombus'; readonly diagonals: readonly [number, number] };

export interface SliceConfig {
  readonly mode?: 'slice';
  /** 정수 격자 꼭짓점. 볼록하고 판 안이어야 한다. 하나라도 어기면 기본값. */
  readonly polygons?: readonly (readonly (readonly [number, number])[])[];
  readonly tools?: readonly ('scissors' | 'rotate90')[];
  /** 0이면 모눈을 숨긴다. 0보다 크면 1칸 모눈. */
  readonly grid?: number;
}

export interface FormulaDeriveConfig {
  readonly mode?: 'formula-derive';
  readonly shape?: FormulaShape;
  readonly tools?: readonly ('scissors' | 'hinge180' | 'duplicate' | 'rotate90')[];
  readonly grid?: number;
  /** 기본 1, 0~3. */
  readonly maxCopies?: number;
  readonly unitCover?: 'never' | 'after-assemble';
}

export interface Piece {
  readonly id: string;
  readonly vertices: readonly RPoint[];
  readonly copy: boolean;
}

export interface PieceHinge {
  readonly piece: string;
  readonly at: RPoint;
}

export interface PiecesSettings {
  readonly tools: readonly PieceTool[];
  readonly grid: number;
  readonly maxCopies: number;
  readonly unitCover: 'never' | 'after-assemble';
  readonly shapeType: FormulaShapeType | 'polygon';
  readonly initial: readonly (readonly RPoint[])[];
}

export interface PiecesState {
  readonly mode: PieceMode;
  readonly pieces: readonly Piece[];
  readonly nextId: number;
  readonly cuts: number;
  readonly copies: number;
  readonly used: readonly PieceTool[];
  readonly lastHinge: PieceHinge | null;
  readonly settings: PiecesSettings;
}

export type PiecesAction =
  | { readonly type: 'cut'; readonly piece: string; readonly from: RPoint; readonly to: RPoint }
  | { readonly type: 'move-piece'; readonly piece: string; readonly by: RPoint }
  | { readonly type: 'rotate-piece'; readonly piece: string; readonly turns: 1 | -1 }
  | { readonly type: 'hinge'; readonly piece: string; readonly at: RPoint }
  | { readonly type: 'duplicate'; readonly piece: string };

/** 외곽 도형의 가장 좁은 이름. */
export type OutlineKind =
  | 'triangle'
  | 'square'
  | 'rectangle'
  | 'rhombus'
  | 'parallelogram'
  | 'trapezoid'
  | 'quadrilateral'
  | 'polygon';
