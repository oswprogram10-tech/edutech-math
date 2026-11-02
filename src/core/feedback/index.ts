// T012 힌트·오개념 공개 API. 실행기와 앱은 이 파일만 import한다.
export {
  MISCONCEPTIONS,
  backtrackTarget,
  diagnoseDetectorOf,
  diagnoseObservation,
  misconceptionOf,
} from './misconceptions';
export type { Misconception, MisconceptionDetect } from './misconceptions';

export { fillHintTemplate, hintLevelFor, selectHint } from './hints';
export type { DefaultHint, HintLevel, HintRequest, HintSelection, RuleHint } from './hints';

export { feedbackStrings } from './strings.ko';
