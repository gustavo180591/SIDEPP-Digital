import { spawn } from 'child_process';
import { writeFile, readFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

export interface PDFExtractionResult {
  hasText: boolean;
  text: string;
  imagesBase64: string[]; // Imágenes en base64 para Vision API (una por página)
}

/**
 * Convierte TODAS las páginas de un PDF a imágenes PNG usando pdftoppm
 * Requiere poppler-utils instalado (apt-get install poppler-utils)
 * Retorna un array de imágenes en base64 (una por página)
 */
async function convertPdfToImages(buffer: Buffer): Promise<string[]> {
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 8);
  const tmpPdf = join(tmpdir(), `analyzer-${timestamp}-${randomId}.pdf`);
  const outPrefix = join(tmpdir(), `analyzer-${timestamp}-${randomId}`);
  const generatedFiles: string[] = [];

  try {
    // Guardar PDF temporal
    await writeFile(tmpPdf, buffer);

    // Convertir TODAS las páginas a PNG usando pdftoppm (poppler-utils)
    await new Promise<void>((resolve, reject) => {
      const proc = spawn('pdftoppm', [
        '-png',           // Formato PNG
        '-r', '150',      // Resolución 150 DPI
        // Sin -f y -l para convertir TODAS las páginas
        tmpPdf,
        outPrefix
      ]);

      let stderr = '';
      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`pdftoppm exited with code ${code}: ${stderr}`));
        }
      });

      proc.on('error', (err) => {
        reject(new Error(`Failed to start pdftoppm: ${err.message}`));
      });
    });

    // Buscar todas las imágenes generadas (pdftoppm genera -1.png, -2.png, etc.)
    const imagesBase64: string[] = [];
    let pageNum = 1;

    while (true) {
      const imgPath = `${outPrefix}-${pageNum}.png`;
      try {
        const imgBuffer = await readFile(imgPath);
        imagesBase64.push(imgBuffer.toString('base64'));
        generatedFiles.push(imgPath);
        pageNum++;
      } catch {
        // No hay más páginas
        break;
      }
    }

    // Limpiar archivos temporales
    await unlink(tmpPdf).catch(() => {});
    for (const file of generatedFiles) {
      await unlink(file).catch(() => {});
    }

    if (imagesBase64.length === 0) {
      throw new Error('No se pudo convertir ninguna página del PDF');
    }

    return imagesBase64;

  } catch (error) {
    // Limpiar en caso de error
    await unlink(tmpPdf).catch(() => {});
    for (const file of generatedFiles) {
      await unlink(file).catch(() => {});
    }
    console.error('[convertPdfToImages] Error:', error);
    throw error;
  }
}

/**
 * Extrae texto de un PDF usando pdfjs-dist (100% Node.js)
 * Adaptado para trabajar con Buffer en lugar de path de archivo
 * Si el PDF no tiene texto, lo convierte a imagen para Vision API
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
        imagesBase64: [],
      };
    }

    // PDF sin texto suficiente - convertir TODAS las páginas a imágenes para Vision API
    const imagesBase64 = await convertPdfToImages(buffer);

    return {
      hasText: false,
      text: '',
      imagesBase64,
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
    const standardFontDataUrl = `${process.cwd()}/node_modules/pdfjs-dist/standard_fonts/`;

    const uint8 = new Uint8Array(buffer);
    const loadingTask = pdfjs.getDocument({ data: uint8, useWorker: false, standardFontDataUrl });
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
    console.error('[extractTextWithPdfJs] Error durante la extracción:', e);
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
