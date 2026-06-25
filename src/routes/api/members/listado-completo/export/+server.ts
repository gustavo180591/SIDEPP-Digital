import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { MemberService } from '$lib/db/services/memberService';
import { generateMembersListPdf } from '$lib/server/pdf/generate-members-list-pdf';
import { requireAuth } from '$lib/server/auth/middleware';

export const GET: RequestHandler = async (event) => {
  // Verificar autenticación
  const auth = await requireAuth(event);
  if (auth.error) {
    return json({ error: auth.error }, { status: auth.status || 401 });
  }

  // Validar permisos: solo ADMIN y LIQUIDADOR pueden exportar listado
  if (auth.user?.role !== 'ADMIN' && auth.user?.role !== 'LIQUIDADOR') {
    return json({ error: 'No tiene permisos para exportar el listado' }, { status: 403 });
  }

  try {
    let institutionIds: string[] | undefined;

    // Si el usuario es LIQUIDADOR, obtener solo sus instituciones
    if (auth.user?.role === 'LIQUIDADOR') {
      if (!auth.user.institutions || auth.user.institutions.length === 0) {
        return json({ error: 'Usuario sin institución asignada' }, { status: 403 });
      }
      institutionIds = auth.user.institutions.map(inst => inst.id);
    }

    // Obtener todos los miembros sin paginación
    const members = await MemberService.getAllWithoutPagination({
      institutionIds
    });

    // Generar PDF
    const pdfBytes = await generateMembersListPdf({ members });

    // Generar nombre de archivo con fecha
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const fileName = `listado-afiliados-${dateStr}.pdf`;

    // Retornar PDF
    return new Response(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`
      }
    });
  } catch (error) {
    console.error('Error al exportar listado de afiliados:', error);
    return new Response(
      JSON.stringify({
        error: 'Error al generar el PDF',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};
