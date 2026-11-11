import { useCallback, useEffect, useRef, useState } from 'react';
import type { jsPDF } from 'jspdf';
import { previewPdf } from '@/services/pdfService';

export function usePdfPreview() {
  const [url, setUrl] = useState<string | null>(null);
  const owned = useRef<string | null>(null);
  const generation = useRef(0);
  const busy = useRef(false);
  const clear = useCallback(() => {
    generation.current++;
    if (owned.current) URL.revokeObjectURL(owned.current);
    owned.current = null;
    setUrl(null);
  }, []);
  useEffect(() => () => {
    generation.current++;
    if (owned.current) URL.revokeObjectURL(owned.current);
    owned.current = null;
  }, []);
  const open = useCallback(async (generate: () => Promise<{ pdf: jsPDF; filename: string }> | { pdf: jsPDF; filename: string }) => {
    if (busy.current) return false;
    busy.current = true;
    clear();
    const current = generation.current;
    try {
      const { pdf, filename } = await generate();
      if (current !== generation.current) return false;
      const next = await previewPdf(pdf, filename);
      if (current !== generation.current) {
        if (next) URL.revokeObjectURL(next);
        return false;
      }
      owned.current = next;
      setUrl(next);
      return next !== null;
    } finally { busy.current = false; }
  }, [clear]);
  return { url, open, clear };
}
