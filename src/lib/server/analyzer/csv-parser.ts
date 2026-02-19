/**
 * Parser de CSV para archivos de aportes
 *
 * Formato esperado:
 * cuil_cuit,nombre,tot_remunerativo,cant_legajos,monto_concepto
 * 20-12345678-9,CABRERA SILVIO VICTOR,2285254.37,2,22852.54
 *
 * Retorna el mismo ListadoPDFResult que la IA para mantener compatibilidad.
 * Usa currency.js para precisión decimal.
 */

import { sumarMontos, redondearMonto } from '$lib/utils/currency.js';
import type { ListadoPDFResult, PersonaAporte } from '$lib/utils/analyzer-pdf-ia/types/index.js';

/**
 * Parsea un CSV de aportes y retorna un ListadoPDFResult
 */
export function parseAportesCSV(buffer: Buffer, fileName: string): ListadoPDFResult {
  const text = buffer.toString('utf-8');
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);

  if (lines.length < 2) {
    throw new Error('El archivo CSV debe tener al menos una fila de encabezados y una fila de datos');
  }

  // Primera línea: headers (se ignoran, pero validamos que tenga 5 columnas)
  const headerLine = lines[0];
  const headerCols = parseCsvLine(headerLine);
  if (headerCols.length < 5) {
    throw new Error(`El CSV debe tener al menos 5 columnas (tiene ${headerCols.length}). Formato: cuil_cuit,nombre,tot_remunerativo,cant_legajos,monto_concepto`);
  }

  const personas: PersonaAporte[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = parseCsvLine(line);
    if (cols.length < 5) {
      errors.push(`Línea ${i + 1}: se esperaban 5 columnas, tiene ${cols.length}`);
      continue;
    }

    const cuilCuit = normalizeCuilCuit(cols[0].trim());
    const nombre = cols[1].trim().toUpperCase();
    const totalRemunerativo = parseMontoCSV(cols[2].trim());
    const cantidadLegajos = parseInt(cols[3].trim(), 10);
    const montoConcepto = parseMontoCSV(cols[4].trim());

    if (!nombre) {
      errors.push(`Línea ${i + 1}: nombre vacío`);
      continue;
    }

    if (isNaN(totalRemunerativo)) {
      errors.push(`Línea ${i + 1}: total remunerativo inválido "${cols[2].trim()}"`);
      continue;
    }

    if (isNaN(cantidadLegajos) || cantidadLegajos < 0) {
      errors.push(`Línea ${i + 1}: cantidad de legajos inválida "${cols[3].trim()}"`);
      continue;
    }

    if (isNaN(montoConcepto)) {
      errors.push(`Línea ${i + 1}: monto concepto inválido "${cols[4].trim()}"`);
      continue;
    }

    personas.push({
      nombre,
      totalRemunerativo: redondearMonto(totalRemunerativo),
      cantidadLegajos,
      montoConcepto: redondearMonto(montoConcepto),
      cuilCuit: cuilCuit || undefined
    });
  }

  if (personas.length === 0) {
    const errorDetail = errors.length > 0 ? `. Errores: ${errors.join('; ')}` : '';
    throw new Error(`No se encontraron datos válidos en el CSV${errorDetail}`);
  }

  // Calcular totales con currency.js
  const montoTotal = sumarMontos(...personas.map(p => p.montoConcepto));

  if (errors.length > 0) {
    console.warn(`[csv-parser] ${errors.length} líneas con errores en ${fileName}:`, errors.slice(0, 5));
  }

  return {
    tipo: 'LISTADO_APORTES',
    archivo: fileName,
    escuela: {
      nombre: null,
      cuit: null,
      direccion: null
    },
    fecha: null,
    periodo: null,
    concepto: null,
    personas,
    totales: {
      cantidadPersonas: personas.length,
      montoTotal: redondearMonto(montoTotal)
    }
  };
}

/**
 * Parsea una línea CSV respetando comillas
 */
function parseCsvLine(line: string): string[] {
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
    } else if (char === ',' && !inQuotes) {
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
 * Parsea un monto desde string CSV
 * Acepta: "2285254.37", "2285254,37", "2.285.254,37"
 */
function parseMontoCSV(value: string): number {
  if (!value) return NaN;

  // Limpiar espacios y símbolos de moneda
  let clean = value.replace(/[$\s]/g, '');

  // Detectar formato argentino: punto como separador de miles, coma como decimal
  // Si tiene coma y punto, el último determina el decimal
  if (clean.includes(',') && clean.includes('.')) {
    const lastComma = clean.lastIndexOf(',');
    const lastDot = clean.lastIndexOf('.');
    if (lastComma > lastDot) {
      // Formato: 2.285.254,37 (argentino)
      clean = clean.replace(/\./g, '').replace(',', '.');
    } else {
      // Formato: 2,285,254.37 (inglés)
      clean = clean.replace(/,/g, '');
    }
  } else if (clean.includes(',') && !clean.includes('.')) {
    // Solo coma: podría ser decimal argentino
    // Si hay una sola coma con 1-2 dígitos después, es decimal
    const parts = clean.split(',');
    if (parts.length === 2 && parts[1].length <= 2) {
      clean = clean.replace(',', '.');
    } else {
      // Múltiples comas = separador de miles en formato inglés
      clean = clean.replace(/,/g, '');
    }
  }

  return parseFloat(clean);
}

/**
 * Normaliza un CUIL/CUIT removiendo guiones y espacios
 */
function normalizeCuilCuit(value: string): string {
  return value.replace(/[-\s]/g, '');
}
