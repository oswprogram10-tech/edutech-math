/** tangram 모드의 설정·상태·Action. */
import type { PieceKind, PieceSet } from './pieces';
import type { SurdD, SurdJson } from './surd';

export type SPointJson = readonly [SurdJson, SurdJson];

export interface TangramPieceConfig {
  readonly kind: string;
  readonly rot?: number;
  readonly flip?: boolean;
}

export interface TangramConfig {
  readonly mode?: 'tangram';
  readonly pieceSet?: PieceSet;
  readonly silhouette?: string;
  readonly pieces?: readonly (string | TangramPieceConfig)[];
  /** 화면 px. 기본 24, 8~48로 자른다. */
  readonly snapTolerancePx?: number;
  /** 칠교 45·90, 패턴 블록 30·60·90. */
  readonly rotationStep?: number;
  readonly showPieceOutlines?: boolean | 'first-task-only';
  readonly allowFlip?: boolean;
  /** 조각 고르기 과제. 켜면 끌기 대신 탭으로 고른다. */
  readonly selectMode?: boolean;
}

export interface TangramSettings {
  readonly pieceSet: PieceSet;
  readonly silhouette: string;
  readonly snapTolerancePx: number;
  readonly rotationStep: number;
  readonly showPieceOutlines: boolean;
  readonly allowFlip: boolean;
  readonly selectMode: boolean;
  readonly d: SurdD;
}

export interface TangramPiece {
  readonly id: string;
  readonly kind: PieceKind;
  readonly rot: number;
  readonly flip: boolean;
  readonly at: SPointJson;
}

export interface TangramState {
  readonly mode: 'tangram';
  readonly pieces: readonly TangramPiece[];
  readonly selected: readonly string[];
  readonly nextId: number;
  readonly settings: TangramSettings;
}

export type TangramAction =
  | { readonly type: 'place-piece'; readonly piece: string; readonly at: SPointJson }
  | { readonly type: 'turn-piece'; readonly piece: string }
  | { readonly type: 'flip-piece'; readonly piece: string }
  | { readonly type: 'add-piece'; readonly kind: string; readonly at: SPointJson }
  | { readonly type: 'remove-piece'; readonly piece: string }
  | { readonly type: 'toggle-select'; readonly piece: string };
