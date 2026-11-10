/** E17 분류기의 학생 문구. 화면에 하드코딩하지 않는다. */
import type {
  AngleCondition,
  ConstraintToggle,
  QuadName,
  QuestionId,
  SideCondition,
  SorterMode,
} from './types';

export const sorterStrings = {
  name: '분류기',
  modeNames: {
    venn: '표로 나누기',
    'secret-rule': '스무고개',
    hierarchy: '사각형 가족',
  } as Readonly<Record<SorterMode, string>>,
  canvasLabel: {
    venn: '도형 카드를 조건에 맞는 칸으로 나누는 판',
    'secret-rule': '사각형 카드가 놓인 판',
    hierarchy: '조건을 켜면 모양이 바뀌는 사각형과 이름 트리',
  } as Readonly<Record<SorterMode, string>>,
  instructions: {
    venn: '카드를 끌거나 눌러서 조건에 맞는 칸에 놓아 보세요.',
    'secret-rule': '질문을 하나씩 골라 비밀 카드를 찾아보세요. 지울 카드는 직접 눌러 뒤집어요.',
    hierarchy: '조건 스위치를 켜고, 이름 카드를 트리 빈칸에 넣어 보세요.',
  } as Readonly<Record<SorterMode, string>>,
  cardLabel: (number: number) => `카드 ${number}`,
  held: '들었어요',
  empty: '',

  angleCondition: {
    acute: '예각',
    right: '직각',
    obtuse: '둔각',
  } as Readonly<Record<AngleCondition, string>>,
  sideCondition: {
    equilateral: '세 변이 같음',
    isosceles: '두 변이 같음',
    'isosceles-only': '두 변만 같음',
    scalene: '세 변이 다름',
  } as Readonly<Record<SideCondition, string>>,

  venn: {
    toolImpossible: '불가능한 칸 표시',
    toolOn: '불가능한 칸 표시 켜짐',
    check: '맞는지 보기',
    trayLabel: '카드 칸',
    rowHeader: '각',
    colHeader: '변',
    heldStatus: (label: string) => `${label}을(를) 들었어요. 놓을 칸을 골라요.`,
    impossibleOn: (row: string, col: string) => `${row}·${col} 칸을 불가능으로 표시했어요.`,
    impossibleOff: (row: string, col: string) => `${row}·${col} 칸의 불가능 표시를 풀었어요.`,
    checkedStatus: (right: number, wrong: number) =>
      wrong > 0
        ? `맞는 카드 ${right}장, 다시 볼 카드 ${wrong}장이에요.`
        : `놓은 카드 ${right}장이 모두 조건에 맞아요.`,
    fitYes: '✓',
    fitNo: '✗',
    impossibleText: '불가능',
    moreCards: (count: number) => `+${count}`,
    hint: '카드에서 Enter: 들기 · 칸에서 Enter: 놓기 · 카드 칸에서 Enter: 돌려놓기 · Escape: 취소',
  },

  question: {
    'parallel-pairs>=1': '평행한 변이 한 쌍 이상 있나요?',
    'parallel-pairs==2': '평행한 변이 두 쌍 있나요?',
    'all-sides-equal': '네 변의 길이가 모두 같나요?',
    'has-right-angle': '직각이 하나 이상 있나요?',
    'all-angles-right': '네 각이 모두 직각인가요?',
    'opposite-sides-equal': '마주 보는 변의 길이가 각각 같나요?',
  } as Readonly<Record<QuestionId, string>>,
  questionShort: {
    'parallel-pairs>=1': '평행한 변 1쌍 이상',
    'parallel-pairs==2': '평행한 변 2쌍',
    'all-sides-equal': '네 변이 같음',
    'has-right-angle': '직각 1개 이상',
    'all-angles-right': '네 각이 직각',
    'opposite-sides-equal': '마주 보는 변이 같음',
  } as Readonly<Record<QuestionId, string>>,

  secret: {
    questionTitle: '질문 고르기',
    logTitle: '물은 질문',
    logEmpty: '아직 물은 질문이 없어요.',
    yes: '예',
    no: '아니요',
    remaining: (count: number) => `남은 카드 ${count}장`,
    questionCount: (count: number) => `질문 ${count}번`,
    toolGuess: '이 카드예요',
    newGame: '새 게임',
    switchRole: '역할 바꾸기',
    roleGuesser: '내가 맞히기',
    roleAnswerer: '내가 답하기',
    solved: '알았다! 비밀 카드를 찾았어요.',
    secretCard: '비밀 카드',
    mine: '내 카드',
    wrongGuess: '아니에요',
    pickMine: '내 카드로 쓸 카드를 골라 보세요.',
    computerQuestion: '컴퓨터 질문',
    answerYes: '예',
    answerNo: '아니요',
    swapDone: '알았다! 네 카드는 이 중에 있어요.',
    swapCandidates: (count: number) => `남은 후보 ${count}장`,
    candidate: '후보',
    youAreRight: '그렇구나.',
    evidence: {
      'parallel-pairs>=1': {
        yes: '그 카드는 평행한 변이 한 쌍 이상 있어요.',
        no: '그 카드는 평행한 변이 한 쌍도 없어요.',
      },
      'parallel-pairs==2': {
        yes: '그 카드는 평행한 변이 두 쌍 있어요.',
        no: '그 카드는 평행한 변이 두 쌍은 아니에요.',
      },
      'all-sides-equal': {
        yes: '그 카드는 네 변의 길이가 모두 같아요.',
        no: '그 카드는 네 변의 길이가 모두 같지는 않아요.',
      },
      'has-right-angle': {
        yes: '그 카드에는 직각이 있어요.',
        no: '그 카드에는 직각이 없어요.',
      },
      'all-angles-right': {
        yes: '그 카드는 네 각이 모두 직각이에요.',
        no: '그 카드는 네 각이 모두 직각은 아니에요.',
      },
      'opposite-sides-equal': {
        yes: '그 카드는 마주 보는 변의 길이가 각각 같아요.',
        no: '그 카드는 마주 보는 변의 길이가 각각 같지는 않아요.',
      },
    } as Readonly<Record<QuestionId, { readonly yes: string; readonly no: string }>>,
    hint: '카드에서 Enter: 지우기/되돌리기 · 질문 단추: 묻기',
  },

  toggle: {
    'one-parallel-pair': '평행한 변 한 쌍',
    'two-parallel-pairs': '평행한 변 두 쌍',
    'equal-sides': '네 변의 길이가 같음',
    'right-angle': '직각',
  } as Readonly<Record<ConstraintToggle, string>>,
  quadName: {
    quadrilateral: '사각형',
    trapezoid: '사다리꼴',
    parallelogram: '평행사변형',
    rhombus: '마름모',
    rectangle: '직사각형',
    square: '정사각형',
  } as Readonly<Record<QuadName, string>>,
  hierarchy: {
    toggleTitle: '조건',
    nameTitle: '이름 카드',
    heldStatus: (name: string) => `${name} 카드를 들었어요. 빈칸을 골라요.`,
    blankPosition: (number: number) => `빈칸 ${number}`,
    nowShape: '지금 모양',
    shapeLabel: '지금 만든 모양',
    treeLabel: '사각형 이름 트리',
    conditionResult: (yes: boolean) => (yes ? '✓' : '✗'),
    hint: '이름 카드에서 Enter: 들기 · 빈칸에서 Enter: 넣기/비우기',
  },

  overlay: {
    uprightCard: '가장 긴 변을 수평으로 돌린 그림',
    anglePaint: '세 각을 칠한 그림',
    isoChecklist: '이등변삼각형 조건 확인',
    cardProperties: '이 카드가 가진 성질',
    conditionChecklist: '지금 모양의 조건 확인',
    largestAngle: '가장 큰 각',
    isoCondition: '이등변삼각형 조건: 두 변의 길이가 같다',
    propertiesEmpty: '아직 물은 질문이 없어요.',
  },
} as const;
