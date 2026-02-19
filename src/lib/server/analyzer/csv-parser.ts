/**
 * Parser de archivos de aportes (CSV, Excel .xlsx)
 *
 * Formatos soportados:
 *
 * CSV con separador coma:
 *   cuil_cuit,nombre,tot_remunerativo,cant_legajos,monto_concepto
 *   20-12345678-9,CABRERA SILVIO VICTOR,2285254.37,2,22852.54
 *
 * CSV con separador punto y coma (Excel argentino):
 *   cuil_cuit;nombre;tot_remunerativo;cant_legajos;monto_concepto
 *   20-12345678-9;CABRERA SILVIO VICTOR;2.285.254,37;2;22.852,54
 *
 * CSV con separador tab:
 *   cuil_cuit\tnombre\ttot_remunerativo\tcant_legajos\tmonto_concepto
 *
 * Excel .xlsx: primera hoja, mismas columnas (detecta headers por nombre)
 *
 * Maneja: BOM de UTF-8, encoding Latin-1, headers en cualquier orden,
 * montos en formato argentino/inglés/plano.
 */

import { sumarMontos, redondearMonto } from '$lib/utils/currency.js';
import type { ListadoPDFResult, PersonaAporte } from '$lib/utils/analyzer-pdf-ia/types/index.js';

// ============================================================================
// DETECCIÓN DE HEADERS
// ============================================================================

const HEADER_PATTERNS: Record<string, RegExp> = {
  cuilCuit: /^(cuil|cuit|cuil.?cuit|cuit.?cuil|documento|dni|doc)/i,
  nombre: /^(nombre|apellido|empleado|agente|persona|nombre.?apellido|apellido.?nombre)/i,
  totalRemunerativo: /^(tot.?rem|total.?rem|remunerativ|sueldo|bruto|haberes|rem)/i,
  cantidadLegajos: /^(cant.?leg|legajo|cant|cantidad)/i,
  montoConcepto: /^(monto.?con|monto|concepto|aporte|importe|descuento)/i,
};

interface ColumnMapping {
  cuilCuit: number;
  nombre: number;
  totalRemunerativo: number;
  cantidadLegajos: number;
  montoConcepto: number;
}

/**
 * Detecta la columna de cada campo por el nombre del header.
 * Si no puede detectar, usa posiciones fijas (0,1,2,3,4).
 */
function detectColumns(headers: string[]): ColumnMapping {
  const cleaned = headers.map(h => h.trim().replace(/^["']|["']$/g, ''));

  const mapping: Partial<ColumnMapping> = {};

  for (let i = 0; i < cleaned.length; i++) {
    const header = cleaned[i];
    if (!header) continue;

    for (const [field, pattern] of Object.entries(HEADER_PATTERNS)) {
      if (pattern.test(header) && !(field in mapping)) {
        mapping[field as keyof ColumnMapping] = i;
        break;
      }
    }
  }

  // Si detectamos al menos nombre y monto, usamos el mapping detectado
  if ('nombre' in mapping && 'montoConcepto' in mapping) {
    return {
      cuilCuit: mapping.cuilCuit ?? -1,
      nombre: mapping.nombre!,
      totalRemunerativo: mapping.totalRemunerativo ?? -1,
      cantidadLegajos: mapping.cantidadLegajos ?? -1,
      montoConcepto: mapping.montoConcepto!,
    };
  }

  // Fallback: posiciones fijas (formato original)
  return {
    cuilCuit: 0,
    nombre: 1,
    totalRemunerativo: 2,
    cantidadLegajos: 3,
    montoConcepto: 4,
  };
}

// ============================================================================
// PARSING DE EXCEL .XLSX
// ============================================================================

/**
 * Parsea un archivo Excel .xlsx y retorna un ListadoPDFResult
 */
export function parseAportesExcel(buffer: Buffer, fileName: string): ListadoPDFResult {
  // Dynamic import para no romper si xlsx no está instalado
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const XLSX = require('xlsx');

  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('El archivo Excel está vacío (no tiene hojas)');
  }

  const sheet = workbook.Sheets[sheetName];
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  if (rows.length < 2) {
    throw new Error('El archivo Excel debe tener al menos una fila de encabezados y una fila de datos');
  }

  const headers = rows[0].map((h: any) => String(h || ''));
  const columns = detectColumns(headers);

  const personas: PersonaAporte[] = [];
  const errors: string[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((cell: any) => !cell && cell !== 0)) continue;

    const nombre = String(row[columns.nombre] || '').trim().toUpperCase();
    if (!nombre) {
      errors.push(`Fila ${i + 1}: nombre vacío`);
      continue;
    }

    const cuilCuit = columns.cuilCuit >= 0
      ? normalizeCuilCuit(String(row[columns.cuilCuit] || ''))
      : '';

    const totalRemunerativo = columns.totalRemunerativo >= 0
      ? parseMontoValue(row[columns.totalRemunerativo])
      : 0;

    const cantidadLegajos = columns.cantidadLegajos >= 0
      ? parseInt(String(row[columns.cantidadLegajos] || '0'), 10)
      : 1;

    const montoConcepto = parseMontoValue(row[columns.montoConcepto]);

    if (isNaN(totalRemunerativo)) {
      errors.push(`Fila ${i + 1}: total remunerativo inválido`);
      continue;
    }

    if (isNaN(cantidadLegajos) || cantidadLegajos < 0) {
      errors.push(`Fila ${i + 1}: cantidad de legajos inválida`);
      continue;
    }

    if (isNaN(montoConcepto)) {
      errors.push(`Fila ${i + 1}: monto concepto inválido`);
      continue;
    }

    personas.push({
      nombre,
      totalRemunerativo: redondearMonto(totalRemunerativo),
      cantidadLegajos: cantidadLegajos || 1,
      montoConcepto: redondearMonto(montoConcepto),
      cuilCuit: cuilCuit || undefined,
    });
  }

  if (personas.length === 0) {
    const errorDetail = errors.length > 0 ? `. Errores: ${errors.join('; ')}` : '';
    throw new Error(`No se encontraron datos válidos en el Excel${errorDetail}`);
  }

  const montoTotal = sumarMontos(...personas.map(p => p.montoConcepto));

  if (errors.length > 0) {
    console.warn(`[excel-parser] ${errors.length} filas con errores en ${fileName}:`, errors.slice(0, 5));
  }

  return {
    tipo: 'LISTADO_APORTES',
    archivo: fileName,
    escuela: { nombre: null, cuit: null, direccion: null },
    fecha: null,
    periodo: null,
    concepto: null,
    personas,
    totales: {
      cantidadPersonas: personas.length,
      montoTotal: redondearMonto(montoTotal),
    },
  };
}

// ============================================================================
// PARSING DE CSV
// ============================================================================

/**
 * Parsea un CSV de aportes y retorna un ListadoPDFResult.
 * Soporta: coma, punto y coma, tab como separadores.
 * Soporta: BOM UTF-8, encoding Latin-1, headers flexibles.
 */
export function parseAportesCSV(buffer: Buffer, fileName: string): ListadoPDFResult {
  const text = bufferToText(buffer);
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);

  if (lines.length < 2) {
    throw new Error('El archivo CSV debe tener al menos una fila de encabezados y una fila de datos');
  }

  const separator = detectSeparator(lines[0]);
  const headerCols = parseCsvLine(lines[0], separator);
  const columns = detectColumns(headerCols);

  const minCols = Math.max(columns.nombre, columns.montoConcepto) + 1;

  const personas: PersonaAporte[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = parseCsvLine(line, separator);
    if (cols.length < minCols) {
      errors.push(`Línea ${i + 1}: se esperaban al menos ${minCols} columnas, tiene ${cols.length}`);
      continue;
    }

    const nombre = cols[columns.nombre]?.trim().toUpperCase() || '';
    if (!nombre) {
      errors.push(`Línea ${i + 1}: nombre vacío`);
      continue;
    }

    const cuilCuit = columns.cuilCuit >= 0
      ? normalizeCuilCuit(cols[columns.cuilCuit]?.trim() || '')
      : '';

    const totalRemunerativo = columns.totalRemunerativo >= 0
      ? parseMontoCSV(cols[columns.totalRemunerativo]?.trim() || '')
      : 0;

    const cantidadLegajos = columns.cantidadLegajos >= 0
      ? parseInt(cols[columns.cantidadLegajos]?.trim() || '0', 10)
      : 1;

    const montoConcepto = parseMontoCSV(cols[columns.montoConcepto]?.trim() || '');

    if (isNaN(totalRemunerativo)) {
      errors.push(`Línea ${i + 1}: total remunerativo inválido "${cols[columns.totalRemunerativo]?.trim()}"`);
      continue;
    }

    if (isNaN(cantidadLegajos) || cantidadLegajos < 0) {
      errors.push(`Línea ${i + 1}: cantidad de legajos inválida "${cols[columns.cantidadLegajos]?.trim()}"`);
      continue;
    }

    if (isNaN(montoConcepto)) {
      errors.push(`Línea ${i + 1}: monto concepto inválido "${cols[columns.montoConcepto]?.trim()}"`);
      continue;
    }

    personas.push({
      nombre,
      totalRemunerativo: redondearMonto(totalRemunerativo),
      cantidadLegajos: cantidadLegajos || 1,
      montoConcepto: redondearMonto(montoConcepto),
      cuilCuit: cuilCuit || undefined,
    });
  }

  if (personas.length === 0) {
    const errorDetail = errors.length > 0 ? `. Errores: ${errors.join('; ')}` : '';
    throw new Error(`No se encontraron datos válidos en el CSV${errorDetail}`);
  }

  const montoTotal = sumarMontos(...personas.map(p => p.montoConcepto));

  if (errors.length > 0) {
    console.warn(`[csv-parser] ${errors.length} líneas con errores en ${fileName}:`, errors.slice(0, 5));
  }

  return {
    tipo: 'LISTADO_APORTES',
    archivo: fileName,
    escuela: { nombre: null, cuit: null, direccion: null },
    fecha: null,
    periodo: null,
    concepto: null,
    personas,
    totales: {
      cantidadPersonas: personas.length,
      montoTotal: redondearMonto(montoTotal),
    },
  };
}

// ============================================================================
// FUNCIONES AUXILIARES
// ============================================================================

/**
 * Convierte un buffer a texto, manejando BOM y encoding Latin-1.
 */
function bufferToText(buffer: Buffer): string {
  let text = buffer.toString('utf-8');

  // Quitar BOM de UTF-8
  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1);
  }

  // Detectar Latin-1 leído como UTF-8 (e.g., "Ã±" en vez de "ñ")
  if (/Ã[\x80-\xBF]/.test(text)) {
    try {
      text = buffer.toString('latin1');
      if (text.charCodeAt(0) === 0xEF && text.charCodeAt(1) === 0xBB && text.charCodeAt(2) === 0xBF) {
        text = text.slice(3);
      }
    } catch {
      // Si falla, usar el texto UTF-8 original
    }
  }

  return text;
}

/**
 * Auto-detecta el separador: coma, punto y coma, o tab.
 */
function detectSeparator(headerLine: string): string {
  const tabs = (headerLine.match(/\t/g) || []).length;
  const semicolons = (headerLine.match(/;/g) || []).length;
  const commas = (headerLine.match(/,/g) || []).length;

  if (tabs >= 4 && tabs >= semicolons && tabs >= commas) {
    return '\t';
  }

  if (semicolons >= 4 && semicolons >= commas) {
    return ';';
  }

  return ',';
}

/**
 * Parsea una línea CSV respetando comillas.
 */
function parseCsvLine(line: string, separator: string = ','): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === separator && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

/**
 * Parsea un monto que puede venir como número (desde Excel) o como string.
 */
function parseMontoValue(value: any): number {
  if (typeof value === 'number') return value;
  return parseMontoCSV(String(value || ''));
}

/**
 * Parsea un monto desde string CSV.
 * Acepta: "2285254.37", "2285254,37", "2.285.254,37", "$2.285.254,37"
 */
function parseMontoCSV(value: string): number {
  if (!value) return NaN;

  let clean = value.replace(/[$\s]/g, '');

  if (clean.includes(',') && clean.includes('.')) {
    const lastComma = clean.lastIndexOf(',');
    const lastDot = clean.lastIndexOf('.');
    if (lastComma > lastDot) {
      clean = clean.replace(/\./g, '').replace(',', '.');
    } else {
      clean = clean.replace(/,/g, '');
    }
  } else if (clean.includes(',') && !clean.includes('.')) {
    const parts = clean.split(',');
    if (parts.length === 2 && parts[1].length <= 2) {
      clean = clean.replace(',', '.');
    } else {
      clean = clean.replace(/,/g, '');
    }
  }

  return parseFloat(clean);
}

/**
 * Normaliza un CUIL/CUIT removiendo guiones, puntos y espacios.
 */
function normalizeCuilCuit(value: string): string {
  return value.replace(/[-.\s]/g, '');
}
