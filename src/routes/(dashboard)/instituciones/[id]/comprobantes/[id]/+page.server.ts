import { error } from '@sveltejs/kit';
import { InstitutionService } from '$lib/db/services/institutionService';
import { PdfService } from '$lib/db/services/pdfService';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
  const institutionId = params.id;
  const pdfId = params.id; // El segundo [id] en la ruta es el ID del PDF
  
  if (!institutionId || !pdfId) {
    throw error(400, 'ID de institución y PDF requeridos');
  }

  try {
    // Obtener los datos de la institución
    const institution = await InstitutionService.getById(institutionId);
    
    if (!institution) {
      throw error(404, 'Institución no encontrada');
    }

    // Obtener los datos del PDF
    const pdfFile = await PdfService.getById(pdfId);
    
    if (!pdfFile) {
      throw error(404, 'Comprobante no encontrado');
    }

    // Obtener las líneas de contribución
    const contributionLines = await PdfService.getContributionLines(pdfId);

    return {
      institution,
      pdfFile,
      contributionLines
    };
  } catch (err) {
    console.error('Error al cargar comprobante:', err);
    throw error(500, 'Error interno del servidor');
  }
};

