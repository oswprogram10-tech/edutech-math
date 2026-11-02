export type MathErrorCode =
  | 'DIV_BY_ZERO'
  | 'PARSE'
  | 'NOT_TERMINATING'
  | 'NONLINEAR'
  | 'NO_BOX'
  | 'MULTIPLE_BOX'
  | 'NO_SOLUTION'
  | 'INFINITE_SOLUTIONS'
  | 'UNSAFE_NUMBER';

export interface MathErrorOptions {
  readonly position?: number;
}

const DEFAULT_MESSAGES: Record<MathErrorCode, string> = {
  DIV_BY_ZERO: '0으로 나눌 수 없습니다.',
  PARSE: '수식을 읽을 수 없습니다.',
  NOT_TERMINATING: '유한소수로 나타낼 수 없습니다.',
  NONLINEAR: '□에 대한 일차식이 아닙니다.',
  NO_BOX: '□가 없습니다.',
  MULTIPLE_BOX: '□가 여러 개 있습니다.',
  NO_SOLUTION: '해가 없습니다.',
  INFINITE_SOLUTIONS: '해가 무수히 많습니다.',
  UNSAFE_NUMBER: '안전하게 표현할 수 없는 수입니다.',
};

/** 수학 코어가 던지는 모든 오류. `code`로 분기한다. */
export class MathError extends Error {
  readonly code: MathErrorCode;
  readonly position: number | undefined;

  constructor(code: MathErrorCode, message?: string, options: MathErrorOptions = {}) {
    super(message ?? DEFAULT_MESSAGES[code]);
    this.name = 'MathError';
    this.code = code;
    this.position = options.position;
  }
}
