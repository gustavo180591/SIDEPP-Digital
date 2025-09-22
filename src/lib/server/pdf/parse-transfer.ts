import pdf from 'pdf-parse';
import { Prisma } from '@prisma/client';
import { prisma } from '$lib/server/db';
import type { PdfFile } from '@prisma/client';

export async function parseTransfer(fileBuffer: Buffer, pdfFile: PdfFile) {
  const data = await pdf(fileBuffer);
  const text = data.text;

  // Buscar fecha en formato DD/MM/YYYY o DD-MM-YYYY
  const dateMatch = text.match(/(\d{2})[/.-](\d{2})[/.-](\d{4})/);
  if (!dateMatch) {
    throw new Error('No se pudo detectar la fecha en el comprobante');
  }

  const [, day, month, year] = dateMatch;
  const transferDate = new Date(`${year}-${month}-${day}T12:00:00.000Z`);

  // Buscar monto (formato $ 1.234,56 o 1.234,56)
  const amountMatch = text.match(/\$?\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/);
  if (!amountMatch) {
    throw new Error('No se pudo detectar el monto en el comprobante');
  }

  const amount = new Prisma.Decimal(amountMatch[1].replace(/\./g, '').replace(',', '.'));

  // Buscar número de referencia/operación
  const refMatch = text.match(/(?:Referencia|Ref\.?|Operación|N°?\s*Op\.?)[:\s]*(\w+)/i);
  const reference = refMatch ? refMatch[1].trim() : null;

  // Buscar CBU/CVU destino
  const cbuMatch = text.match(/(?:CBU|CVU)[:\s]*(\d{20,22})/i);
  const cbuDestino = cbuMatch ? cbuMatch[1] : null;

  // Buscar cuenta origen
  const cuentaMatch = text.match(/(?:Cuenta|Origen)[:\s]*(\d+[-\s]?\d*[/]?\d*)/i);
  const cuentaOrigen = cuentaMatch ? cuentaMatch[1].trim() : null;

  // Crear la transferencia en la base de datos
  const transfer = await prisma.bankTransfer.create({
    data: {
      institutionId: pdfFile.institutionId!,
      datetime: transferDate,
      reference,
      operationNo: reference, // Usar la referencia como número de operación por ahora
      cbuDestino,
      cuentaOrigen,
      importe: amount,
      pdfFiles: { connect: { id: pdfFile.id } },
    },
  });

  return transfer;
}
