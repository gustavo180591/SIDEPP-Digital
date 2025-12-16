import { json, type RequestHandler } from '@sveltejs/kit';
import { unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { requireAdmin } from '$lib/server/auth/middleware';
import { prisma } from '$lib/server/db';
import { CONFIG } from '$lib/server/config';

const ANALYZER_DIR = join(CONFIG.UPLOAD_DIR, 'analyzer');
const HASH_INDEX = join(ANALYZER_DIR, 'hash-index.json');

// Cargar índice de hashes
async function loadHashIndex(): Promise<Record<string, { fileName: string; savedName: string; savedPath: string }>> {
  try {
    const buf = await readFile(HASH_INDEX, 'utf8');
    return JSON.parse(buf) as Record<string, { fileName: string; savedName: string; savedPath: string }>;
  } catch {
    return {};
  }
}

// Guardar índice de hashes
async function saveHashIndex(index: Record<string, { fileName: string; savedName: string; savedPath: string }>): Promise<void> {
  await writeFile(HASH_INDEX, Buffer.from(JSON.stringify(index, null, 2), 'utf8'));
}

export const DELETE: RequestHandler = async (event) => {
  // Verificar que es ADMIN
  const authResult = await requireAdmin(event);
  if (authResult.error) {
    return json({ error: authResult.error }, { status: authResult.status });
  }

  const fileId = event.params.id;

  if (!fileId) {
    return json({ error: 'ID de archivo requerido' }, { status: 400 });
  }

  try {
    // Buscar el archivo en la BD
    const pdfFile = await prisma.pdfFile.findUnique({
      where: { id: fileId },
      include: {
        contributionLine: true,
        period: {
          include: {
            transfer: true,
            pdfFiles: true
          }
        }
      }
    });

    if (!pdfFile) {
      return json({ error: 'Archivo no encontrado' }, { status: 404 });
    }

    console.log(`[DELETE FILE] Iniciando eliminación de archivo: ${pdfFile.fileName} (${fileId})`);

    // 1. Eliminar ContributionLines asociadas
    if (pdfFile.contributionLine.length > 0) {
      console.log(`[DELETE FILE] Eliminando ${pdfFile.contributionLine.length} contribution lines...`);
      await prisma.contributionLine.deleteMany({
        where: { pdfFileId: fileId }
      });
    }

    // 2. Eliminar el PdfFile de la BD
    console.log(`[DELETE FILE] Eliminando registro de BD...`);
    await prisma.pdfFile.delete({
      where: { id: fileId }
    });

    // 3. Eliminar archivo físico del disco
    if (pdfFile.bufferHash) {
      const hashIndex = await loadHashIndex();
      const hashEntry = hashIndex[pdfFile.bufferHash];

      if (hashEntry?.savedPath) {
        console.log(`[DELETE FILE] Eliminando archivo físico: ${hashEntry.savedPath}`);
        if (existsSync(hashEntry.savedPath)) {
          await unlink(hashEntry.savedPath);
          console.log(`[DELETE FILE] Archivo físico eliminado`);
        } else {
          console.log(`[DELETE FILE] Archivo físico no encontrado en disco`);
        }

        // 4. Limpiar entrada del hash-index.json
        delete hashIndex[pdfFile.bufferHash];
        await saveHashIndex(hashIndex);
        console.log(`[DELETE FILE] Entrada de hash eliminada del índice`);
      }
    }

    // 5. Si el período queda sin archivos, eliminarlo también (junto con BankTransfer)
    if (pdfFile.period) {
      const remainingFiles = pdfFile.period.pdfFiles.filter(f => f.id !== fileId);

      if (remainingFiles.length === 0) {
        console.log(`[DELETE FILE] Período sin archivos, eliminando período: ${pdfFile.period.id}`);

        // Eliminar BankTransfer si existe
        if (pdfFile.period.transfer) {
          await prisma.bankTransfer.delete({
            where: { id: pdfFile.period.transfer.id }
          });
          console.log(`[DELETE FILE] BankTransfer eliminado`);
        }

        // Eliminar PayrollPeriod
        await prisma.payrollPeriod.delete({
          where: { id: pdfFile.period.id }
        });
        console.log(`[DELETE FILE] PayrollPeriod eliminado`);
      }
    }

    console.log(`[DELETE FILE] Eliminación completada exitosamente`);

    return json({
      success: true,
      message: 'Archivo eliminado correctamente',
      deletedFile: {
        id: fileId,
        fileName: pdfFile.fileName,
        type: pdfFile.type
      }
    });

  } catch (error) {
    console.error('[DELETE FILE] Error durante eliminación:', error);
    return json({
      error: 'Error al eliminar el archivo',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
};
