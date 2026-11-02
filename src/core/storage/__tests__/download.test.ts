// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadJson } from '../export';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('downloadJson', () => {
  it('JSON Blob을 만들어 내려받고 URL을 해제한다', () => {
    vi.useFakeTimers();
    const createObjectURL = vi.fn((blob: Blob) => {
      void blob;
      return 'blob:test';
    });
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });

    let downloaded: string | undefined;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloaded = this.download;
    });

    const url = downloadJson('mathexplorer-1-2026-11-02.json', { hello: 'world' });

    expect(url).toBe('blob:test');
    expect(downloaded).toBe('mathexplorer-1-2026-11-02.json');
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const [blob] = createObjectURL.mock.calls[0] ?? [];
    expect(blob).toBeInstanceOf(Blob);
    if (!blob) throw new Error('Blob을 만들지 않았습니다.');
    expect(blob.type).toBe('application/json');
    expect(blob.size).toBeGreaterThan(0);
    expect(document.querySelector('a')).toBeNull();

    vi.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test');
  });
});
