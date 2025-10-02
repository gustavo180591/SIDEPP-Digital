import { error } from '@sveltejs/kit';
import { InstitutionService } from '$lib/db/services/institutionService';
import { PdfService } from '$lib/db/services/pdfService';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url }) => {
  const institutionId = params.id;
  
  if (!institutionId) {
    throw error(400, 'ID de institución requerido');
  }

  try {
    // Obtener los datos de la institución
    const institution = await InstitutionService.getById(institutionId);
    
    if (!institution) {
      throw error(404, 'Institución no encontrada');
    }

    // Obtener parámetros de búsqueda y paginación
    const search = url.searchParams.get('search') || '';
    const year = url.searchParams.get('year') ? parseInt(url.searchParams.get('year')!) : undefined;
    const month = url.searchParams.get('month') ? parseInt(url.searchParams.get('month')!) : undefined;
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');

    // Obtener los PDFs de la institución con filtros
    const pdfs = await PdfService.getByInstitution(institutionId, {
      search,
      year,
      month
    }, {
      page,
      limit
    });

    // Obtener estadísticas
    const stats = await PdfService.getStats(institutionId);

    return {
      institution,
      pdfs: pdfs.data,
      pagination: {
        currentPage: pdfs.meta.currentPage,
        totalPages: pdfs.meta.lastPage,
        totalItems: pdfs.meta.total,
        itemsPerPage: pdfs.meta.perPage
      },
      search,
      year,
      month,
      stats
    };
  } catch (err) {
    console.error('Error al cargar comprobantes:', err);
    throw error(500, 'Error interno del servidor');
  }
};

