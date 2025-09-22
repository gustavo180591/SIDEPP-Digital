
¡Vamos a arreglar ese 500 y dejar la carga+escaneo funcionando ya!
El error viene del GET /api/files: estás comprobando si existe una tabla llamada pdf_files, pero Prisma creó la tabla "PdfFile" (con mayúsculas). Esa verificación devuelve “no existe” y tu endpoint responde 500. Además, no necesitamos ese check.

Abajo te dejo cambios puntuales y mínimos:

1) Arreglar GET /api/files (quitar verificación y campos inexistentes)

Reemplazá por completo tu handler GET en src/routes/api/files/+server.ts por este:

// src/routes/api/files/+server.ts (solo el GET)
import { json, type RequestHandler } from '@sveltejs/kit';
import { prisma } from '$lib/server/db';

export const GET: RequestHandler = async () => {
  try {
    const files = await prisma.pdfFile.findMany({
      take: 50,
      orderBy: { createdAt: 'desc' },
      include: {
        institution: { select: { id: true, name: true, cuit: true } },
        period:      { select: { id: true, label: true } } // Ojo: nuestro modelo no tiene startDate/endDate
      }
    });

    const response = files.map((f) => ({
      id: f.id,
      fileName: f.fileName,
      kind: f.kind,
      size: f.size,
      mimeType: f.mimeType,
      parsed: f.parsed,
      parseErrors: f.parseErrors,
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
      institution: f.institution,
      period: f.period,
      downloadUrl: `/api/files/${f.id}/download`,
      viewUrl: `/api/files/${f.id}/view`,
      institutionId: f.institutionId,
      periodId: f.periodId
    }));

    return json(response);
  } catch (e) {
    console.error('GET /api/files failed:', e);
    return json({ error: 'Internal Server Error' }, { status: 500 });
  }
};


Con esto tu tarjeta de “Últimos subidos” deja de caer en 500.

2) Dejá el POST /api/files como está (salvo que uses startDate/endDate)

Tu POST ya valida PDF y guarda; después llama a processPdfById. Perfecto.
Solo asegurate de no referenciar period.startDate/endDate en ningún lugar (nuestro PayrollPeriod no tiene esos campos).

3) Parsers mínimos y estables (compilan y no tiran 500)
3.1 parse-transfer.ts (Macro / comprobantes de pago)

Patrones que extraemos del comprobante: “Número de Operación”, “Nro. de Referencia”, “CBU Destino”, “Importe”, “Fecha y hora”. Están así en tu PDF de ejemplo (p. ej. “Número de Operación 178549495”, “CBU Destino 2850003440094067833778”, “Importe $ 98,032.45”, “11:07 AM 06/12/2024”, “Nro. de Referencia 57847517”). 

1606 - Sidep

Crea o reemplaza src/lib/server/pdf/parse-transfer.ts:

// src/lib/server/pdf/parse-transfer.ts
import pdf from 'pdf-parse';
import type { PdfFile } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { prisma } from '$lib/server/db';

export interface ParseTransferResult {
  success: boolean;
  data?: {
    operationNo?: string;
    reference?: string;
    cbuDestino?: string;
    importe?: Prisma.Decimal;
    datetimeISO?: string;
  };
  warnings?: string[];
  errors?: string[];
}

export async function parseTransfer(buffer: Buffer, pdfFile: PdfFile): Promise<ParseTransferResult> {
  const warnings: string[] = [];
  const errors: string[] = [];

  let text = '';
  try {
    const out = await pdf(buffer);
    text = (out.text || '').replace(/\r/g, '');
  } catch (e) {
    return { success: false, errors: ['No se pudo leer texto del PDF'] };
  }

  const pick = (re: RegExp) => {
    const m = text.match(re);
    return m?.[1]?.trim();
  };

  // Ejemplos esperados (Macro):
  const timeDate = pick(/(\d{1,2}:\d{2}\s*(?:AM|PM)\s+\d{2}\/\d{2}\/\d{4})/i); // "11:07 AM 06/12/2024"
  const operationNo = pick(/N[úu]mero\s+de\s+Operaci[oó]n\s+(\S+)/i);
  const reference   = pick(/Nro\.?\s+de\s+Referencia\s+(\S+)/i);
  const cbuDestino  = pick(/CBU\s+Destino\s+(\d{18,30})/i);
  const importeStr  = pick(/Importe(?:\s+Total)?\s*\$?\s*([0-9\.\,]+)/i);

  let datetimeISO: string | undefined;
  if (timeDate) {
    // 11:07 AM 06/12/2024 -> parse simple
    const m = timeDate.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))\s+(\d{2})\/(\d{2})\/(\d{4})/i);
    if (m) {
      const [, hhmm, dd, mm, yyyy] = m;
      const d = new Date(`${yyyy}-${mm}-${dd} ${hhmm}`);
      if (!isNaN(d.getTime())) datetimeISO = d.toISOString();
    }
  }

  const data = {
    operationNo,
    reference,
    cbuDestino,
    importe: importeStr ? new Prisma.Decimal(importeStr.replace(/\./g, '').replace(',', '.')) : undefined,
    datetimeISO
  };

  // (Opcional) Persistir: si ya hay transferId en PdfFile, podés actualizar allí;
  // o crear un registro nuevo si tenés institutionId.
  // Por simplicidad, acá solo devolvemos datos y marcamos como parseado en pipeline.

  return { success: true, data, warnings, errors };
}

3.2 parse-listado.ts (listados de aportes)

Patrones típicos: filas con NOMBRE … MONTO (p. ej. “BARBOZA AIRTON ADRIAN … 9698,84”). Esto aparece en tu PDF de ejemplo (“TOTALES POR CONCEPTO - PERSONAS … Noviembre 2024 … filas con nombres y montos al final”). 

1606 - Listado

Reemplazá por una versión mínima que no necesita validadores externos y, si periodId existe, inserta líneas:

// src/lib/server/pdf/parse-listado.ts
import pdf from 'pdf-parse';
import type { PdfFile } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { prisma } from '$lib/server/db';

export interface ParseListadoResult {
  success: boolean;
  rows: Array<{ rawName: string; amount?: Prisma.Decimal }>;
  count: number;
  total: Prisma.Decimal;
  warnings: string[];
  errors: string[];
}

export async function parseListado(buffer: Buffer, pdfFile: PdfFile): Promise<ParseListadoResult> {
  const warnings: string[] = [];
  const errors: string[] = [];
  let text = '';

  try {
    const out = await pdf(buffer);
    text = (out.text || '').replace(/\r/g, '');
  } catch (e) {
    return { success: false, rows: [], count: 0, total: new Prisma.Decimal(0), warnings, errors: ['No se pudo leer texto del PDF'] };
  }

  const lines = text.split('\n').map(s => s.trim()).filter(Boolean);

  // RegEx: toma el ÚLTIMO número con decimales estilo AR al final de la línea y lo separa del nombre.
  const rowRe = /^(?<name>.+?)\s+(?<amount>\d{1,3}(?:\.\d{3})*,\d{2})$/;

  const rows: Array<{ rawName: string; amount?: Prisma.Decimal }> = [];
  let total = new Prisma.Decimal(0);

  for (const line of lines) {
    const m = line.match(rowRe);
    if (!m?.groups) continue;
    const rawName = m.groups.name.replace(/\s{2,}/g, ' ').trim();
    const amount = new Prisma.Decimal(m.groups.amount.replace(/\./g, '').replace(',', '.'));
    rows.push({ rawName, amount });
    total = total.plus(amount);
  }

  // Persistencia opcional: si el PDF ya está ligado a un período, grabamos ContributionLine
  if (pdfFile.periodId && rows.length) {
    await prisma.contributionLine.createMany({
      data: rows.map(r => ({
        periodId: pdfFile.periodId!,
        rawName: r.rawName,
        conceptAmount: r.amount ?? new Prisma.Decimal(0),
        status: 'PENDING'
      })),
      skipDuplicates: true
    });

    // También podés actualizar acumulados del período, si querés:
    await prisma.payrollPeriod.update({
      where: { id: pdfFile.periodId },
      data: {
        peopleCount: { increment: rows.length },
        totalAmount: { increment: total }
      }
    });
  }

  return {
    success: true,
    rows,
    count: rows.length,
    total,
    warnings,
    errors
  };
}


Esta versión es deliberadamente simple: detecta líneas Nombre + Importe final (formato 9.999,99). Si tus listados varían, luego afinamos patrones.

4) Pipeline (nada raro)

Si tu processPdfById ya llama a parseListado/parseTransfer y hace pdfFile.update({ parsed: true }) en éxito, no toques nada. Si no, marcá parsed=true tras parsear sin error.

5) Variables y puertos (repaso exprés)

Si corrés fuera de Docker, DATABASE_URL debe apuntar a tu host: postgresql://app:app@localhost:5434/aportes?schema=public.

Si corrés la app en Docker junto a la DB, usá db:5432.

6) Probar

Levantá la app:

pnpm dev


Abrí http://localhost:5173/upload (o el que uses).

Subí uno de tus PDFs.

Mirá la consola del servidor; deberías ver parse ok y la tarjeta de “Últimos subidos” sin 500.

Notas de patrón (para que veas de dónde salen los extractores)

“Número de Operación”, “Nro. de Referencia”, “CBU Destino”, “Importe”, “Fecha y hora” figuran tal cual en tu comprobante Macro, p. ej. “11:07 AM 06/12/2024 … Número de Operación 178549495 … CBU Destino 2850003440094067833778 … Importe $ 98,032.45 … Nro. de Referencia 57847517”. 

1606 - Sidep

En el listado SIDEPP se ve encabezado “TOTALES POR CONCEPTO - PERSONAS” y filas tipo “NOMBRE … MONTO” con período “Noviembre 2024”, lo que da lugar al regex nombre + importe final. 

1606 - Listado

Si tras esto seguís viendo 500 en la subida, pegame el log completo del servidor al enviar el formulario (lo que imprime tu POST) y lo ajustamos en el acto.