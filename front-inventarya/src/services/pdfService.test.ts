import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { jsPDF } from 'jspdf';

const mocks = vi.hoisted(() => ({
  isNative: false,
  readdir: vi.fn(),
  mkdir: vi.fn(),
  rmdir: vi.fn(),
  writeFile: vi.fn(),
  getUri: vi.fn(),
  openDocument: vi.fn(),
  share: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => mocks.isNative,
  },
}));

vi.mock('@capacitor/filesystem', () => ({
  Directory: { Cache: 'CACHE' },
  Filesystem: {
    readdir: mocks.readdir,
    mkdir: mocks.mkdir,
    rmdir: mocks.rmdir,
    writeFile: mocks.writeFile,
    getUri: mocks.getUri,
  },
}));

vi.mock('@capacitor/file-viewer', () => ({
  FileViewer: {
    openDocumentFromLocalPath: mocks.openDocument,
  },
}));

vi.mock('@capacitor/share', () => ({
  Share: {
    share: mocks.share,
  },
}));

function createMockPdf(isValid = true): jsPDF {
  const content = isValid ? '%PDF-1.4 test content' : 'INVALID';
  const encoder = new TextEncoder();
  const buffer = encoder.encode(content).buffer;
  return {
    output: vi.fn().mockReturnValue(buffer),
    save: vi.fn().mockResolvedValue(true),
  } as unknown as jsPDF;
}

describe('pdfService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isNative = false;
    mocks.readdir.mockResolvedValue({ files: [] });
    mocks.mkdir.mockResolvedValue(undefined);
    mocks.rmdir.mockResolvedValue(undefined);
    mocks.writeFile.mockResolvedValue(undefined);
    mocks.getUri.mockResolvedValue({ uri: 'file:///data/user/0/cache/ticket.pdf' });
    mocks.openDocument.mockResolvedValue(undefined);
    mocks.share.mockResolvedValue(undefined);
  });

  describe('pdfFilename helper', () => {
    it('cleans special characters and ensures .pdf extension', async () => {
      const { pdfFilename } = await import('./pdfService');
      expect(pdfFilename('Ticket #123 / Tienda')).toBe('Ticket_123_Tienda.pdf');
      expect(pdfFilename('report.pdf')).toBe('report.pdf');
      expect(pdfFilename('...')).toBe('documento.pdf');
    });
  });

  describe('web environment', () => {
    it('download uses web save behavior', async () => {
      mocks.isNative = false;
      const { downloadPdf } = await import('./pdfService');
      const pdf = createMockPdf(true);

      await downloadPdf(pdf, 'ticket-1.pdf');
      expect(pdf.save).toHaveBeenCalledWith('ticket-1.pdf', { returnPromise: true });
      expect(mocks.writeFile).not.toHaveBeenCalled();
      expect(mocks.share).not.toHaveBeenCalled();
    });

    it('preview generates a blob url on web', async () => {
      mocks.isNative = false;
      const { previewPdf } = await import('./pdfService');
      const pdf = createMockPdf(true);

      const url = await previewPdf(pdf, 'ticket-1.pdf');
      expect(typeof url).toBe('string');
      expect(url).toMatch(/^blob:/);
      expect(mocks.openDocument).not.toHaveBeenCalled();
    });

    it('throws PDF_GENERATION_FAILED on invalid PDF bytes', async () => {
      mocks.isNative = false;
      const { previewPdf } = await import('./pdfService');
      const badPdf = createMockPdf(false);

      await expect(previewPdf(badPdf, 'ticket.pdf')).rejects.toThrow('No se pudo generar un PDF válido.');
    });
  });

  describe('android native environment', () => {
    beforeEach(() => {
      mocks.isNative = true;
    });

    it('does not use pdf.save() or return blob url for preview', async () => {
      const { previewPdf } = await import('./pdfService');
      const pdf = createMockPdf(true);

      const result = await previewPdf(pdf, 'ticket-1.pdf');
      expect(result).toBeNull();
      expect(pdf.save).not.toHaveBeenCalled();
      expect(mocks.writeFile).toHaveBeenCalled();
      expect(mocks.openDocument).toHaveBeenCalledWith({
        path: 'file:///data/user/0/cache/ticket.pdf',
      });
    });

    it('downloadPdf writes file and triggers native share', async () => {
      const { downloadPdf } = await import('./pdfService');
      const pdf = createMockPdf(true);

      await downloadPdf(pdf, 'ticket-123.pdf');
      expect(pdf.save).not.toHaveBeenCalled();
      expect(mocks.writeFile).toHaveBeenCalled();
      expect(mocks.share).toHaveBeenCalledWith({
        title: 'PDF de ventas',
        files: ['file:///data/user/0/cache/ticket.pdf'],
        dialogTitle: 'Compartir o guardar PDF',
      });
    });

    it('propagates PDF_WRITE_FAILED when filesystem fails', async () => {
      mocks.writeFile.mockRejectedValue(new Error('disk full'));
      const { downloadPdf } = await import('./pdfService');
      const pdf = createMockPdf(true);

      await expect(downloadPdf(pdf, 'ticket.pdf')).rejects.toThrow(
        'No se pudo guardar el archivo PDF en el dispositivo.'
      );
    });

    it('propagates PDF_OPEN_FAILED when file viewer fails', async () => {
      mocks.openDocument.mockRejectedValue(new Error('no viewer app'));
      const { previewPdf } = await import('./pdfService');
      const pdf = createMockPdf(true);

      await expect(previewPdf(pdf, 'ticket.pdf')).rejects.toThrow(
        'No se pudo abrir el PDF. Comprueba que tienes una aplicación para leer PDF.'
      );
    });

    it('propagates PDF_SHARE_FAILED when share fails', async () => {
      mocks.share.mockRejectedValue(new Error('share canceled with error'));
      const { downloadPdf } = await import('./pdfService');
      const pdf = createMockPdf(true);

      await expect(downloadPdf(pdf, 'ticket.pdf')).rejects.toThrow(
        'No se pudo abrir el selector para compartir o guardar el PDF.'
      );
    });
  });
});
