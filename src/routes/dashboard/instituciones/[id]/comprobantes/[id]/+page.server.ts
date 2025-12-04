import { error } from '@sveltejs/kit';
import { InstitutionService } from '$lib/db/services/institutionService';
import { PdfService } from '$lib/db/services/pdfService';
import type { PageServerLoad } from './$types';

// Helper para verificar acceso a institución
function hasAccessToInstitution(user: App.Locals['user'], institutionId: string): boolean {
  if (!user) return false;
  if (user.role === 'ADMIN' || user.role === 'FINANZAS') return true;
  return user.institutions?.some(inst => inst.id === institutionId) || false;
}

export const load: PageServerLoad = async ({ params, url, locals }) => {
  // Resolver IDs con fallbacks de URL
  let urlInstitutionId: string | undefined = params.id as string | undefined;
  let pdfFileId: string | undefined = (params as any).id_1 ?? (params as any).pdfId ?? (params as any).pid;

  if (!urlInstitutionId || !pdfFileId) {
    const segments = url.pathname.split('/').filter(Boolean);
    // .../dashboard/instituciones/{instId}/comprobantes/{pdfFileId}
    const idx = segments.findIndex((s) => s === 'instituciones');
    if (idx >= 0) {
      urlInstitutionId = urlInstitutionId || segments[idx + 1];
      pdfFileId = pdfFileId || segments[idx + 3];
    }
  }

  if (!pdfFileId) {
    throw error(400, 'ID del archivo PDF requerido');
  }

  try {
    // Obtener el PDF específico con su período y transfer
    const pdfFile = await PdfService.getById(pdfFileId);
    if (!pdfFile) {
      throw error(404, 'Archivo PDF no encontrado');
    }

    // Validar que tenga período e institución
    if (!pdfFile.period || !pdfFile.period.institutionId) {
      throw error(400, 'El archivo PDF no tiene institución asociada');
    }

    // Validar que usuarios LIQUIDADOR solo puedan acceder a PDFs de sus instituciones
    if (locals.user?.role === 'LIQUIDADOR') {
      if (!locals.user.institutions || locals.user.institutions.length === 0) {
        throw error(403, 'Usuario sin institución asignada');
      }
      if (!hasAccessToInstitution(locals.user, pdfFile.period.institutionId)) {
        throw error(403, 'No tiene permiso para ver este archivo');
      }
    }

    // Obtener la institución
    const institution = await InstitutionService.getById(pdfFile.period.institutionId);
    if (!institution) {
      throw error(404, 'Institución no encontrada');
    }

    // Obtener las líneas de contribución solo si NO es tipo COMPROBANTE
    let contributionLines: any[] = [];
    if (pdfFile.type !== 'COMPROBANTE') {
      contributionLines = await PdfService.getContributionLines(pdfFileId);
    }

    // Serializar los Decimals a números para evitar errores de SvelteKit
    const serialize = (obj: any) => {
      return JSON.parse(JSON.stringify(obj, (key, value) => {
        if (value && typeof value === 'object' && value.constructor && value.constructor.name === 'Decimal') {
          return Number(value);
        }
        return value;
      }));
    };

    return {
      institution,
      pdfFile: serialize(pdfFile),
      contributionLines: serialize(contributionLines),
      payroll: serialize(pdfFile.period)
    };
  } catch (err: any) {
    console.error('Error al cargar archivo PDF:', err);
    if (err?.status && typeof err.status === 'number') {
      throw err;
    }
    throw error(500, 'Error interno del servidor');
  }
};

