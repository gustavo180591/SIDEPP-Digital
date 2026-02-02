import { json, type RequestHandler } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/auth/middleware';
import { prisma } from '$lib/server/db';
import { deleteFile } from '$lib/server/storage';

export const DELETE: RequestHandler = async (event) => {
  // Verificar que es ADMIN
  const authResult = await requireAdmin(event);
  if (authResult.error) {
    return json({ error: authResult.error }, { status: authResult.status });
  }

  const periodId = event.params.id;

  if (!periodId) {
    return json({ error: 'ID de período requerido' }, { status: 400 });
  }

  try {
    // Buscar el período con todos sus datos relacionados
    const period = await prisma.payrollPeriod.findUnique({
      where: { id: periodId },
      include: {
        institution: true,
        transfer: true,
        pdfFiles: {
          include: {
            contributionLine: true
          }
        }
      }
    });

    if (!period) {
      return json({ error: 'Período no encontrado' }, { status: 404 });
    }

    console.log(`[DELETE PERIOD] Iniciando eliminación de período: ${period.month}/${period.year} - ${period.institution?.name || 'Sin institución'}`);
    console.log(`[DELETE PERIOD] Archivos a eliminar: ${period.pdfFiles.length}`);

    // 1. Recopilar paths de archivos físicos desde la DB
    const filesToDelete = period.pdfFiles
      .filter(f => f.storagePath)
      .map(f => f.storagePath!);

    // 2. Eliminar todas las ContributionLines de todos los PdfFiles
    const contributionLineIds = period.pdfFiles.flatMap(f => f.contributionLine.map(cl => cl.id));
    if (contributionLineIds.length > 0) {
      console.log(`[DELETE PERIOD] Eliminando ${contributionLineIds.length} contribution lines...`);
      await prisma.contributionLine.deleteMany({
        where: { id: { in: contributionLineIds } }
      });
    }

    // 3. Eliminar todos los PdfFiles del período
    if (period.pdfFiles.length > 0) {
      console.log(`[DELETE PERIOD] Eliminando ${period.pdfFiles.length} archivos PDF de la BD...`);
      await prisma.pdfFile.deleteMany({
        where: { periodId: periodId }
      });
    }

    // 4. Eliminar BankTransfer si existe
    if (period.transfer) {
      console.log(`[DELETE PERIOD] Eliminando BankTransfer: ${period.transfer.id}`);
      await prisma.bankTransfer.delete({
        where: { id: period.transfer.id }
      });
    }

    // 5. Eliminar el PayrollPeriod
    console.log(`[DELETE PERIOD] Eliminando PayrollPeriod: ${periodId}`);
    await prisma.payrollPeriod.delete({
      where: { id: periodId }
    });

    // 6. Eliminar archivos físicos del disco
    let filesDeletedCount = 0;
    for (const filePath of filesToDelete) {
      const deleted = await deleteFile(filePath);
      if (deleted) {
        filesDeletedCount++;
        console.log(`[DELETE PERIOD] Archivo físico eliminado: ${filePath}`);
      }
    }

    console.log(`[DELETE PERIOD] Eliminación completada exitosamente`);

    return json({
      success: true,
      message: 'Período eliminado correctamente',
      deletedPeriod: {
        id: periodId,
        month: period.month,
        year: period.year,
        institution: period.institution?.name || null,
        filesDeleted: period.pdfFiles.length,
        physicalFilesDeleted: filesDeletedCount,
        contributionLinesDeleted: contributionLineIds.length,
        bankTransferDeleted: !!period.transfer
      }
    });

  } catch (error) {
    console.error('[DELETE PERIOD] Error durante eliminación:', error);
    return json({
      error: 'Error al eliminar el período',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
};
