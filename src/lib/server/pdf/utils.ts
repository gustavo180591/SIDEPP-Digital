import { readFile as readFileFs } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';

export interface PdfMetadata {
  title?: string;
  author?: string;
  subject?: string;
  creator?: string;
  producer?: string;
  keywords?: string[];
  creationDate?: Date;
  modificationDate?: Date;
  pageCount: number;
  isEncrypted: boolean;
}

/**
 * Extrae metadatos de un archivo PDF
 */
export async function extractPdfMetadata(filePath: string): Promise<PdfMetadata> {
  try {
    const fileBuffer = await readFileFs(filePath);
    const pdfDoc = await PDFDocument.load(fileBuffer, {
      ignoreEncryption: true, // Intentar leer aunque esté encriptado
      throwOnInvalidObject: false, // No fallar en objetos inválidos
    });
    
    // Extraer metadatos básicos
    const metadata: PdfMetadata = {
      title: pdfDoc.getTitle() || undefined,
      author: pdfDoc.getAuthor() || undefined,
      subject: pdfDoc.getSubject() || undefined,
      creator: pdfDoc.getCreator() || undefined,
      producer: pdfDoc.getProducer() || undefined,
      keywords: pdfDoc.getKeywords(),
      creationDate: pdfDoc.getCreationDate() || undefined,
      modificationDate: pdfDoc.getModificationDate() || undefined,
      pageCount: pdfDoc.getPageCount(),
      isEncrypted: pdfDoc.isEncrypted(),
    };

    return metadata;
  } catch (error) {
    console.error('Error al extraer metadatos del PDF:', error);
    // Si falla la extracción de metadatos, devolver un objeto vacío en lugar de fallar
    return {
      pageCount: 0,
      isEncrypted: false
    };
  }
}

/**
 * Procesa el texto extraído de un PDF
 */
export function extractTextFromPdf(text: string): { cleanText: string; lines: string[] } {
  if (!text || typeof text !== 'string') {
    return { cleanText: '', lines: [] };
  }

  try {
    // Normalizar saltos de línea y espacios
    const normalizedText = text
      .replace(/\r\n/g, '\n')  // Normalizar saltos de línea
      .replace(/[\u200B-\u200D\uFEFF]/g, '')  // Eliminar caracteres invisibles
      .replace(/\s+/g, ' ')  // Reemplazar múltiples espacios por uno solo
      .trim();

    // Dividir en líneas y limpiar cada una
    const lines = normalizedText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    return {
      cleanText: normalizedText,
      lines
    };
  } catch (error) {
    console.error('Error al procesar el texto del PDF:', error);
    return {
      cleanText: text,
      lines: text.split('\n').filter(line => line.trim().length > 0)
    };
  }
}

export function extractAmount(text: string): number | null {
  // Buscar montos con formato $ 1.234,56 o 1.234,56
  const amountMatch = text.match(/\$?\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/);
  if (!amountMatch) return null;
  
  return parseFloat(amountMatch[1].replace(/\./g, '').replace(',', '.'));
}

export function extractDate(text: string): Date | null {
  // Buscar fechas en formato DD/MM/YYYY o DD-MM-YYYY
  const dateMatch = text.match(/(\d{2})[\/.-](\d{2})[\/.-](\d{4})/);
  if (!dateMatch) return null;

  const [, day, month, year] = dateMatch;
  return new Date(`${year}-${month}-${day}T12:00:00.000Z`);
}
