// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePdfPreview } from './usePdfPreview';
import type { jsPDF } from 'jspdf';

const mocks = vi.hoisted(() => ({
  previewResult: 'blob:https://localhost/mock-uuid' as string | null,
}));

vi.mock('@/services/pdfService', () => ({
  previewPdf: vi.fn().mockImplementation(async () => mocks.previewResult),
}));

describe('usePdfPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.previewResult = 'blob:https://localhost/mock-uuid';
    URL.revokeObjectURL = vi.fn();
  });

  it('manages preview url and revokes on clear', async () => {
    const { result } = renderHook(() => usePdfPreview());

    expect(result.current.url).toBeNull();

    await act(async () => {
      const opened = await result.current.open(() => ({
        pdf: {} as jsPDF,
        filename: 'test.pdf',
      }));
      expect(opened).toBe(true);
    });

    expect(result.current.url).toBe('blob:https://localhost/mock-uuid');

    act(() => {
      result.current.clear();
    });

    expect(result.current.url).toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:https://localhost/mock-uuid');
  });

  it('revokes url on unmount to avoid memory leaks', async () => {
    const { result, unmount } = renderHook(() => usePdfPreview());

    await act(async () => {
      await result.current.open(() => ({
        pdf: {} as jsPDF,
        filename: 'test.pdf',
      }));
    });

    expect(result.current.url).toBe('blob:https://localhost/mock-uuid');

    unmount();

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:https://localhost/mock-uuid');
  });

  it('returns false and keeps url null when native viewer opens directly', async () => {
    mocks.previewResult = null; // Native Android behavior
    const { result } = renderHook(() => usePdfPreview());

    await act(async () => {
      const opened = await result.current.open(() => ({
        pdf: {} as jsPDF,
        filename: 'native.pdf',
      }));
      expect(opened).toBe(false);
    });

    expect(result.current.url).toBeNull();
  });
});
