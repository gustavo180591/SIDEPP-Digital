export interface PDFExtractionResult {
  hasText: boolean;
  text: string;
  imageBase64: string; // Imagen en base64 para Vision API
}

/**
 * Extrae texto de un PDF usando pdfjs-dist (100% Node.js)
 * Adaptado para trabajar con Buffer en lugar de path de archivo
 * Nota: No usamos pdf-parse porque Vite lo redirige a un shim
 */
export async function extractPDFContent(buffer: Buffer): Promise<PDFExtractionResult> {
  try {
    // Usar pdfjs-dist directamente (evita el shim de pdf-parse)
    const text = await extractTextWithPdfJs(buffer);
    const hasText = text.length > 50;

    if (hasText) {
      return {
        hasText: true,
        text,
        imageBase64: '',
      };
    }

    // PDF sin texto suficiente - necesita Vision API
    console.log(`      -> PDF con imágenes detectado, requiere Vision API`);

    // Convertir buffer a base64 para enviar a Vision API
    const imageBase64 = buffer.toString('base64');

    return {
      hasText: false,
      text: '',
      imageBase64,
    };
  } catch (error) {
    console.error('Error extrayendo contenido del PDF:', error);
    throw error;
  }
}

/**
 * Extrae texto de un PDF usando pdfjs-dist (método alternativo)
 * Mejor para PDFs con layout complejo
 */
export async function extractTextWithPdfJs(buffer: Buffer): Promise<string> {
  try {
    // Usamos la build legacy para Node y deshabilitamos worker
    const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf.mjs');

    const uint8 = new Uint8Array(buffer);
    const loadingTask = pdfjs.getDocument({ data: uint8, useWorker: false });
    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages ?? 1;

    let allText = '';
    for (let p = 1; p <= numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      const items = content.items as Array<any>;

      const linesMap = new Map<number, Array<{ x: number; str: string }>>();
      for (const it of items) {
        const tx = it.transform; // [a,b,c,d,e,f]
        const y = Math.round(tx[5]);
        const x = Math.round(tx[4]);
        const str = String(it.str || '').trim();
        if (!str) continue;
        if (!linesMap.has(y)) linesMap.set(y, []);
        linesMap.get(y)!.push({ x, str });
      }
      const orderedY = Array.from(linesMap.keys()).sort((a, b) => b - a);
      for (const y of orderedY) {
        const parts = linesMap.get(y)!.sort((a, b) => a.x - b.x).map((p) => p.str);
        const line = parts.join(' ').replace(/\s{2,}/g, ' ').trim();
        if (line) allText += line + '\n';
      }
    }

    return allText;
  } catch (e) {
    console.error('[extractTextWithPdfJs] ERROR durante la extracción:', e);
    return '';
  }
}

/**
 * Limpia el texto extraído para reducir tokens enviados a OpenAI
 */
export function cleanTextForAI(text: string): string {
  return text
    .replace(/\s{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/---\s*Pagina\s*\d+\s*---/gi, '')
    .replace(/Warning:.*$/gm, '')
    .trim();
}

/**
 * Detecta el tipo de documento basado en el contenido del texto
 */
export function detectDocumentType(text: string): 'LISTADO_APORTES' | 'TRANSFERENCIA' | 'UNKNOWN' {
  if (text.includes('TOTALES POR CONCEPTO - PERSONAS')) {
    return 'LISTADO_APORTES';
  }
  if (text.includes('Transferencia a terceros banco Macro')) {
    return 'TRANSFERENCIA';
  }
  return 'UNKNOWN';
}
