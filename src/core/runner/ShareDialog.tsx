/**
 * 공유 코드 대화 상자.
 *
 * 학생 '보여 주기'(S3)와 시연 모드 코드 만들기가 같이 쓴다.
 * QR 라이브러리는 실제로 필요할 때만 동적으로 불러와 첫 화면 번들을 지킨다.
 */
import { useEffect, useRef, useState } from 'react';
import { runnerStrings } from './strings.ko';
import styles from './ShareDialog.module.css';

/** QR 한 장에 담기 좋은 코드 길이. 넘으면 코드·링크만 보여 준다. */
const QR_CODE_MAX_LENGTH = 2000;

interface ShareDialogProps {
  readonly code: string;
  readonly link: string;
  readonly onClose: () => void;
}

export function ShareDialog({ code, link, onClose }: ShareDialogProps) {
  const [qrState, setQrState] = useState<{
    readonly code: string;
    readonly svg: string | null;
    readonly failed: boolean;
  }>({ code: '', svg: null, failed: false });
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const tooLong = code.length > QR_CODE_MAX_LENGTH;
  const qr = qrState.code === code ? qrState.svg : null;
  const qrFailed = tooLong || (qrState.code === code && qrState.failed);

  useEffect(() => {
    if (tooLong) return;
    let active = true;

    void (async () => {
      try {
        const { default: qrcode } = await import('qrcode-generator');
        if (!active) return;
        const qrCode = qrcode(0, 'M');
        qrCode.addData(code);
        qrCode.make();
        setQrState({
          code,
          svg: qrCode.createSvgTag({ cellSize: 4, margin: 4, scalable: true }),
          failed: false,
        });
      } catch (error) {
        if (!active) return;
        console.warn('[runner] QR을 만들지 못했습니다.', error);
        setQrState({ code, svg: null, failed: true });
      }
    })();

    return () => {
      active = false;
    };
  }, [code, tooLong]);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (previous?.isConnected) previous.focus();
    };
  }, [onClose]);

  // 바깥을 눌러도 닫되, 대화 상자 안 클릭은 무시한다.
  return (
    <div
      className={styles.backdrop}
      data-testid="share-backdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-title"
      >
        <h2 id="share-title" className={styles.title}>
          {runnerStrings.shareTitle}
        </h2>
        <p className={styles.hint}>{runnerStrings.shareHint}</p>

        <label className={styles.field}>
          <span>{runnerStrings.shareCodeLabel}</span>
          <input
            className={styles.input}
            type="text"
            readOnly
            value={code}
            data-testid="share-code"
            onFocus={(event) => event.currentTarget.select()}
          />
        </label>

        <label className={styles.field}>
          <span>{runnerStrings.shareLinkLabel}</span>
          <input
            className={styles.input}
            type="text"
            readOnly
            value={link}
            data-testid="share-link"
            onFocus={(event) => event.currentTarget.select()}
          />
        </label>

        <div className={styles.qrBox} data-testid="share-qr">
          {qr ? (
            // qrcode-generator가 만든 SVG 문자열이다. 외부 입력이 섞이지 않는다.
            <div className={styles.qr} dangerouslySetInnerHTML={{ __html: qr }} />
          ) : qrFailed ? (
            <p className={styles.qrNote}>{runnerStrings.shareQrTooLarge}</p>
          ) : (
            <p className={styles.qrNote} role="status">
              {runnerStrings.shareQrLoading}
            </p>
          )}
        </div>

        <button ref={closeRef} type="button" className={styles.close} onClick={onClose}>
          {runnerStrings.shareClose}
        </button>
      </div>
    </div>
  );
}
