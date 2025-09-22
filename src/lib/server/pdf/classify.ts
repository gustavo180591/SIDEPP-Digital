import type { PdfKind } from '@prisma/client';

export function classify(fileName: string): PdfKind {
  const lowerName = fileName.toLowerCase();
  
  // Patrones para identificar listados
  if (
    lowerName.includes('listado') ||
    lowerName.includes('liquidacion') ||
    lowerName.includes('aportes') ||
    lowerName.match(/\b(?:ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)[a-z]*\s*\d{4}\b/i)
  ) {
    return 'LISTADO';
  }
  
  // Patrones para identificar transferencias
  if (
    lowerName.includes('transferencia') ||
    lowerName.includes('pago') ||
    lowerName.includes('comprobante') ||
    lowerName.includes('banco') ||
    lowerName.match(/\d{2}[-./]\d{2}[-./]\d{4}/) // Fechas
  ) {
    return 'TRANSFER';
  }
  
  // Por defecto, asumimos que es un listado
  return 'LISTADO';
}
