import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { FileViewer } from '@capacitor/file-viewer';
import { Share } from '@capacitor/share';
import type { jsPDF } from 'jspdf';

export type PdfErrorCode = 'PDF_GENERATION_FAILED' | 'PDF_WRITE_FAILED' | 'PDF_OPEN_FAILED' | 'PDF_SHARE_FAILED';
const messages: Record<PdfErrorCode, string> = {
  PDF_GENERATION_FAILED: 'No se pudo generar un PDF válido.',
  PDF_WRITE_FAILED: 'No se pudo guardar el archivo PDF en el dispositivo.',
  PDF_OPEN_FAILED: 'No se pudo abrir el PDF. Comprueba que tienes una aplicación para leer PDF.',
  PDF_SHARE_FAILED: 'No se pudo abrir el selector para compartir o guardar el PDF.',
};
export class PdfError extends Error {
  constructor(public readonly code: PdfErrorCode) { super(messages[code]); }
}
export function pdfErrorMessage(error: unknown): string {
  const failure = error instanceof PdfError ? error : new PdfError('PDF_GENERATION_FAILED');
  if (import.meta.env.DEV) console.warn('[PDF]', { code: failure.code });
  return failure.message;
}
export const isNativePdf = () => Capacitor.isNativePlatform();
export const pdfDownloadMessage = () => isNativePdf()
  ? 'Selector de exportación cerrado. El archivo solo se guarda si elegiste un destino.'
  : 'PDF descargado correctamente.';
export function pdfFilename(name: string): string {
  const base = name.replace(/\.pdf$/i, '').replace(/[^\p{L}\p{N}._-]+/gu, '_').replace(/^\.+/, '').slice(0, 160);
  return (base || 'documento') + '.pdf';
}
function pdfBytes(pdf: jsPDF): Uint8Array {
  try {
    const bytes = new Uint8Array(pdf.output('arraybuffer'));
    if (String.fromCharCode(...bytes.slice(0, 5)) !== '%PDF-') throw new PdfError('PDF_GENERATION_FAILED');
    return bytes;
  } catch { throw new PdfError('PDF_GENERATION_FAILED'); }
}
export function createPdfPreviewUrl(pdf: jsPDF): string {
  const bytes = pdfBytes(pdf);
  return URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
}
const cacheRoot = 'inventarya-pdf';
let writes: Promise<unknown> = Promise.resolve();
/** Only this service's cache is pruned; exported copies belong to the user.
 * Keep the last 20 files per action and at most 24 hours of old previews/exports.
 */
async function writePdf(pdf: jsPDF, filename: string, purpose: 'preview' | 'export'): Promise<string> {
  const bytes = pdfBytes(pdf);
  const task = writes.then(async () => {
    try {
      // mkdir recursive is idempotent when its parent already exists.
      const root = await Filesystem.readdir({ path: '', directory: Directory.Cache });
      if (!root.files.some((file) => file.name === cacheRoot)) {
        await Filesystem.mkdir({ path: cacheRoot, directory: Directory.Cache, recursive: true });
      }
      const entries = await Filesystem.readdir({ path: cacheRoot, directory: Directory.Cache });
      const prefix = purpose + '-';
      const old = entries.files.filter((file) => file.type === 'directory' && file.name.startsWith(prefix))
        .sort((a, b) => b.mtime - a.mtime);
      for (const [index, entry] of old.entries()) {
        if (index >= 19 || entry.mtime < Date.now() - 86400000) {
          await Filesystem.rmdir({ path: cacheRoot + '/' + entry.name, directory: Directory.Cache, recursive: true });
        }
      }
      const path = cacheRoot + '/' + prefix + crypto.randomUUID() + '/' + pdfFilename(filename);
      let binary = '';
      for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      await Filesystem.writeFile({ path, directory: Directory.Cache, data: btoa(binary), recursive: true });
      const { uri } = await Filesystem.getUri({ path, directory: Directory.Cache });
      return uri;
    } catch { throw new PdfError('PDF_WRITE_FAILED'); }
  });
  // Keep serialization available after failure; the caller still receives the rejection.
  writes = task.then(() => undefined, (error: unknown) => { pdfErrorMessage(error); });
  return task;
}
export async function previewPdf(pdf: jsPDF, filename: string): Promise<string | null> {
  if (!isNativePdf()) return createPdfPreviewUrl(pdf);
  const uri = await writePdf(pdf, filename, 'preview');
  try { await FileViewer.openDocumentFromLocalPath({ path: uri }); }
  catch { throw new PdfError('PDF_OPEN_FAILED'); }
  return null;
}
export async function downloadPdf(pdf: jsPDF, filename: string): Promise<void> {
  if (!isNativePdf()) {
    pdfBytes(pdf);
    await pdf.save(pdfFilename(filename), { returnPromise: true });
    return;
  }
  const uri = await writePdf(pdf, filename, 'export');
  try { await Share.share({ title: 'PDF de ventas', files: [uri], dialogTitle: 'Compartir o guardar PDF' }); }
  catch { throw new PdfError('PDF_SHARE_FAILED'); }
}
