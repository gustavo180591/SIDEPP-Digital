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
}

/* ===== Util simple de log ===== */
const log = {
  info: (...a: unknown[]) => console.log('[parse-listado]', ...a),
  warn: (...a: unknown[]) => console.warn('[parse-listado]', ...a),
  error: (...a: unknown[]) => console.error('[parse-listado]', ...a),
  debug: (...a: unknown[]) => console.debug('[parse-listado]', ...a)
};

/* ===== Patrones ===== */
const PATTERNS = {
  DATE: /(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/,
  CUIT: /(\d{2}[- ]?\d{8}[- ]?\d)/,
  AMOUNT: /(\d{1,3}(?:\.\d{3})*(?:,\d+)?)/ // 12.345,67 | 12345,67 | 123
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
      periodId: pdfFile.periodId,
      rawName,
      conceptAmount: amount,
      status: 'PENDING'
    });

    total = total.plus(amount);
    res.count++;
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

    // actualizar totales del período sin increment sobre NULL
    const period = await tx.payrollPeriod.findUnique({
      where: { id: pdfFile.periodId! },
      select: { peopleCount: true, totalAmount: true }
    });

    const newPeople = (period?.peopleCount ?? 0) + contribs.length;
    const prevTotal = new Prisma.Decimal(period?.totalAmount ?? 0);
    const newTotal = prevTotal.plus(total);

    await tx.payrollPeriod.update({
      where: { id: pdfFile.periodId! },
      data: {
        peopleCount: newPeople,
        totalAmount: newTotal
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
