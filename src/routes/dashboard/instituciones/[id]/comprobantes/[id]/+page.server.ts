import { error } from '@sveltejs/kit';
import { InstitutionService } from '$lib/db/services/institutionService';
import { PayrollService } from '$lib/db/services/payrollService';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url }) => {
  // Resolver IDs con fallbacks de URL
  let urlInstitutionId: string | undefined = params.id as string | undefined;
  let payrollId: string | undefined = (params as any).id_1 ?? (params as any).pdfId ?? (params as any).pid;

  if (!urlInstitutionId || !payrollId) {
    const segments = url.pathname.split('/').filter(Boolean);
    // .../dashboard/instituciones/{instId}/comprobantes/{payrollId}
    const idx = segments.findIndex((s) => s === 'instituciones');
    if (idx >= 0) {
      urlInstitutionId = urlInstitutionId || segments[idx + 1];
      payrollId = payrollId || segments[idx + 3];
    }
  }
  
  if (!payrollId) {
    throw error(400, 'ID de nómina (payroll) requerido');
  }

  try {
  // Obtener el payroll (con pdfFile y contribution lines)
  const payroll = await PayrollService.getById(payrollId);
  console.log("payroll: ", payroll)
  if (!payroll) {
      throw error(404, 'Comprobante no encontrado');
  }

  // Validar que tenga institutionId
  if (!payroll.institutionId) {
    throw error(400, 'El período de nómina no tiene institución asociada');
  }

  // Validar que tenga al menos un PDF
  if (!payroll.pdfFile) {
    throw error(404, 'No hay archivos PDF asociados a este período de nómina');
  }

  // Usar la institución del payroll para garantizar consistencia
  const institutionIdFromPayroll: string = payroll.institutionId;
  const institution = await InstitutionService.getById(institutionIdFromPayroll);
  if (!institution) {
    throw error(404, 'Institución no encontrada');
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
      pdfFile: serialize(payroll.pdfFile),
      contributionLines: serialize(payroll.pdfFile?.contributionLine ?? []),
      payroll: serialize(payroll)
    };
  } catch (err: any) {
    console.error('Error al cargar comprobante:', err);
    if (err?.status && typeof err.status === 'number') {
      throw err;
    }
    throw error(500, 'Error interno del servidor');
  }
};

