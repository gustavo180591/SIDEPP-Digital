// src/lib/server/pdf/parse-listado.ts
import pdf from 'pdf-parse';
import { Prisma } from '@prisma/client';
import type { PdfFile } from '@prisma/client';
import { prisma } from '$lib/server/db';

/* ===== Tipos ===== */
export interface ParseResult {
  success: boolean;
  count: number;
  total: Prisma.Decimal;
  processed: number;
  skipped: number;
  errors: string[];
  warnings: string[];
  details: Array<{ lineNumber: number; line: string; error?: string; warning?: string }>;
  // Datos específicos de tabla
  tableData?: {
    personas?: number;
    totalRemunerativo?: number;
    cantidadLegajos?: number;
    montoConcepto?: number;
  };
}

/* ===== Util simple de log ===== */
const log = {
  info: (..._a: unknown[]) => {},
  warn: (..._a: unknown[]) => {},
  error: (...a: unknown[]) => console.error('[parse-listado]', ...a),
  debug: (..._a: unknown[]) => {}
};

/* ===== Patrones ===== */
const PATTERNS = {
  DATE: /(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/,
  CUIT: /(\d{2}[- ]?\d{8}[- ]?\d)/,
  AMOUNT: /(\d{1,3}(?:\.\d{3})*(?:,\d+)?)/, // 12.345,67 | 12345,67 | 123
  // Patrones mejorados para datos específicos de tabla
  PERSONAS: /(?:cantidad de personas|cantidad personas)[\s:]*(\d+)/i,
  TOTAL_REMUNERATIVO: /(?:total|tot)[\s]*(?:remunerativo|rem)[\s:]*(\d{1,3}(?:\.\d{3})*(?:,\d+)?)/i,
  CANTIDAD_LEGAJOS: /(?:cantidad|legajos?)[\s:]*(\d+)/i,
  MONTO_CONCEPTO: /(?:monto|concepto)[\s:]*(\d{1,3}(?:\.\d{3})*(?:,\d+)?)/i,
  // Patrón para filas de la tabla: NOMBRE APELLIDO 12345.67 1 123.45
  TABLE_ROW: /^([A-ZÁÉÍÓÚÑ\s]+?)\s+(\d{1,3}(?:\.\d{3})*(?:,\d+)?)\s+(\d+)\s+(\d{1,3}(?:\.\d{3})*(?:,\d+)?)$/
};

type LineType = 'header' | 'data' | 'footer' | 'unknown';

/* ===== Heurísticas de línea ===== */
function detectLineType(line: string): LineType {
  const lower = line.toLowerCase();

  const isHeader =
    /(cuit|cuil|dni|nombre|apellido|importe|monto|per[ií]odo|mes\/año)/i.test(lower);
  if (isHeader) return 'header';

  const isFooter = /(p[aá]g(?:\.|ina)|total|cantidad)/i.test(lower);
  if (isFooter) return 'footer';

  if (PATTERNS.CUIT.test(line) && PATTERNS.AMOUNT.test(line)) return 'data';

  return 'unknown';
}

/* ===== Extracción básica por línea ===== */
export function extractLineData(line: string): {
  cuit?: string; fecha?: string; importe?: string; nombre?: string;
} {
  const out: Record<string, string> = {};

  const cuitMatch = line.match(PATTERNS.CUIT);
  if (cuitMatch) out.cuit = cuitMatch[1].replace(/[^\d]/g, '');

  const dateMatch = line.match(PATTERNS.DATE);
  if (dateMatch) out.fecha = dateMatch[1];

  // último número como importe
  const lastAmountMatch = line.match(new RegExp(`${PATTERNS.AMOUNT.source}$` ));
  if (lastAmountMatch) {
    out.importe = lastAmountMatch[1].replace(/\./g, '').replace(',', '.');
  }

  // nombre entre CUIT y importe
  if (cuitMatch?.index !== undefined && lastAmountMatch?.index !== undefined) {
    const start = cuitMatch.index + cuitMatch[0].length;
    const end = lastAmountMatch.index;
    if (start < end) {
      out.nombre = line.substring(start, end).trim().replace(/\s{2,}/g, ' ');
    }
  } else {
    // fallback: si no hay importe, quedate con lo no-numérico como nombre
    if (!out.importe) {
      const nameGuess = line.replace(/\s*\d[\d.,/-]*/g, '').trim();
      if (nameGuess) out.nombre = nameGuess;
    }
  }

  return out as { cuit?: string; fecha?: string; importe?: string; nombre?: string };
}

/* ===== Extracción de datos específicos de tabla ===== */
function extractTableData(text: string): {
  personas?: number;
  totalRemunerativo?: number;
  cantidadLegajos?: number;
  montoConcepto?: number;
} {
  const result: Record<string, number> = {};
  
  log.debug('Extrayendo datos específicos de tabla...');
  
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  
  // Buscar la sección de totales
  const totalesIndex = lines.findIndex(line => /totales?/i.test(line));
  if (totalesIndex !== -1) {
    log.debug('Sección de totales encontrada en línea:', totalesIndex);
    
    // Buscar "Cantidad de Personas: X" en las líneas siguientes
    for (let i = totalesIndex; i < Math.min(totalesIndex + 5, lines.length); i++) {
      const line = lines[i];
      log.debug('Analizando línea de totales:', line);
      
      // Buscar cantidad de personas
      const personasMatch = line.match(PATTERNS.PERSONAS);
      if (personasMatch && !result.personas) {
        result.personas = parseInt(personasMatch[1]);
        log.debug('Personas encontradas en totales:', result.personas);
      }
      
      // Buscar el monto total (último número en la línea)
      const montoMatch = line.match(/(\d{1,3}(?:\.\d{3})*(?:,\d+)?)\s*$/);
      if (montoMatch && !result.montoConcepto) {
        const amount = montoMatch[1].replace(/\./g, '').replace(',', '.');
        result.montoConcepto = parseFloat(amount);
        log.debug('Monto del concepto encontrado en totales:', result.montoConcepto);
      }
    }
  }
  
  // Calcular totales de la tabla si no se encontraron en la sección de totales
  if (!result.personas || !result.montoConcepto) {
    log.debug('Calculando totales de la tabla...');
    let totalPersonas = 0;
    let totalMonto = 0;
    let totalLegajos = 0;
    let totalRemunerativo = 0;
    
    // Buscar líneas que parecen filas de datos
    for (const line of lines) {
      const rowMatch = line.match(PATTERNS.TABLE_ROW);
      if (rowMatch) {
        totalPersonas++;
        const remunerativo = parseFloat(rowMatch[2].replace(/\./g, '').replace(',', '.'));
        const legajos = parseInt(rowMatch[3]);
        const monto = parseFloat(rowMatch[4].replace(/\./g, '').replace(',', '.'));
        
        totalRemunerativo += remunerativo;
        totalLegajos += legajos;
        totalMonto += monto;
        
        log.debug('Fila encontrada:', {
          nombre: rowMatch[1].trim(),
          remunerativo,
          legajos,
          monto
        });
      }
    }
    
    // Usar los totales calculados si no se encontraron en la sección de totales
    if (totalPersonas > 0) {
      if (!result.personas) result.personas = totalPersonas;
      if (!result.totalRemunerativo) result.totalRemunerativo = totalRemunerativo;
      if (!result.cantidadLegajos) result.cantidadLegajos = totalLegajos;
      if (!result.montoConcepto) result.montoConcepto = totalMonto;
      
      log.debug('Totales calculados de la tabla:', {
        personas: totalPersonas,
        totalRemunerativo,
        cantidadLegajos: totalLegajos,
        montoConcepto: totalMonto
      });
    }
  }
  
  log.debug('Datos de tabla extraídos:', result);
  return result;
}

/* ===== Parse principal ===== */
export async function parseListado(fileBuffer: Buffer, pdfFile: PdfFile): Promise<ParseResult> {
  if (!pdfFile.periodId) throw new Error('Falta periodId en PdfFile para parsear LISTADO');

  const res: ParseResult = {
    success: true,
    count: 0,
    total: new Prisma.Decimal(0),
    processed: 0,
    skipped: 0,
    errors: [],
    warnings: [],
    details: []
  };

  log.info(`Iniciando parse de "${pdfFile.fileName}" (periodId=${pdfFile.periodId})` );

  // 1) Extraer texto del PDF
  let text = '';
  try {
    const data = await pdf(fileBuffer);
    text = (data.text || '').trim();
    log.debug('PDF parseado', { pages: data.numpages ?? 'n/a' });
  } catch (e) {
    const msg = 'Error al leer el PDF (¿está escaneado sin texto?)';
    res.success = false;
    res.errors.push(msg);
    log.error(msg, e);
    return res;
  }

  if (!text) {
    const msg = 'El PDF no contiene texto extraíble';
    res.success = false;
    res.errors.push(msg);
    log.warn(msg);
    return res;
  }

  // Extraer datos específicos de tabla
  const tableData = extractTableData(text);
  res.tableData = tableData;

  // 2) Dividir en líneas y clasificar
  const rawLines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const lines = rawLines.map((content, i) => ({
    number: i + 1,
    content,
    type: detectLineType(content) as LineType
  }));

  const dataLines = lines.filter((l) => l.type === 'data');
  if (dataLines.length === 0) {
    const msg = 'No se detectaron líneas de aporte (CUIT + monto)';
    res.success = false;
    res.errors.push(msg);
    log.warn(msg);
    return res;
  }

  // 3) Construcción de contribuciones
  const contribs: Prisma.ContributionLineCreateManyInput[] = [];
  let total = new Prisma.Decimal(0);

  for (const line of dataLines) {
    res.processed++;

    // Intentar parsear como fila de tabla primero: NOMBRE APELLIDO totalRem quantity conceptAmount
    const rowMatch = line.content.match(PATTERNS.TABLE_ROW);

    if (rowMatch) {
      // Patrón de tabla detectado
      const name = rowMatch[1].trim();
      const totalRem = new Prisma.Decimal(rowMatch[2].replace(/\./g, '').replace(',', '.'));
      const quantity = parseInt(rowMatch[3]);
      const conceptAmount = new Prisma.Decimal(rowMatch[4].replace(/\./g, '').replace(',', '.'));

      contribs.push({
        pdfFileId: pdfFile.id,
        name,
        totalRem,
        quantity,
        conceptAmount,
        status: 'PENDING'
      });

      total = total.plus(conceptAmount);
      res.count++;
    } else {
      // Fallback: parseo antiguo (solo CUIT + monto)
      const d = extractLineData(line.content);

      if (!d.importe) {
        res.skipped++;
        const warning = 'No se pudo extraer el importe';
        res.warnings.push(warning);
        res.details.push({ lineNumber: line.number, line: line.content, warning });
        continue;
      }

      const amount = new Prisma.Decimal(d.importe);
      const rawName = (d.nombre || '').trim() || (d.cuit ? `CUIT ${d.cuit}`  : 'SIN_NOMBRE');

      contribs.push({
        pdfFileId: pdfFile.id,
        name: rawName,
        conceptAmount: amount,
        status: 'PENDING'
      });

      total = total.plus(amount);
      res.count++;
    }
  }

  if (contribs.length === 0) {
    const msg = 'No se pudo construir ninguna línea válida de aporte';
    res.success = false;
    res.errors.push(msg);
    log.warn(msg);
    return res;
  }

  // 4) Persistencia
  await prisma.$transaction(async (tx) => {
    await tx.contributionLine.createMany({
      data: contribs,
      skipDuplicates: true
    });

    // Actualizar los datos del PdfFile con los totales calculados
    await tx.pdfFile.update({
      where: { id: pdfFile.id },
      data: {
        peopleCount: contribs.length,
        totalAmount: total
      }
    });
  });

  // 5) Resumen
  res.total = total;
  log.info('Parse de listado completado', {
    fileName: pdfFile.fileName,
    periodId: pdfFile.periodId,
    lines: dataLines.length,
    created: contribs.length,
    total: total.toString()
  });

  return res;
}
