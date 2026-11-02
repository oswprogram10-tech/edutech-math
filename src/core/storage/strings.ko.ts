/** 저장소 계층의 교사·학생 안내 문구. 화면에 하드코딩하지 않는다. */
export const storageStrings = {
  memoryFallback:
    '이 기기에서는 저장 공간을 쓸 수 없어요. 창을 닫으면 기록이 사라지니, 기록은 바로 내보내 주세요.',
  qrTooLarge: '기록이 많아 QR 코드로는 담을 수 없어요. 파일로 내보내기를 써 주세요.',
  shareCodeTooLong: '공유 코드가 너무 길어요. 파일로 내보내기를 써 주세요.',
  invalidShareCode: '공유 코드를 읽을 수 없어요.',
  exportReady: '기록을 내보낼 수 있어요.',
  importSkipPrefix: '건너뜀',
  importReasons: {
    'invalid-json': 'JSON 파일이 아니에요.',
    'wrong-format': 'MathExplorer 내보내기 파일이 아니에요.',
    'wrong-version': '지원하지 않는 파일 버전이에요.',
    'invalid-shape': '파일 안의 기록 형식이 올바르지 않아요.',
    'unsafe-data': '화면 좌표가 들어 있어 저장할 수 없어요.',
  },
} as const;

export type ImportFailureReason = keyof typeof storageStrings.importReasons;
