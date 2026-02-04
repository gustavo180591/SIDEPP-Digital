import { error, type RequestHandler } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/auth/middleware';
import { prisma } from '$lib/server/db';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

export const GET: RequestHandler = async (event) => {
	// Requerir autenticación
	const auth = await requireAuth(event);
	if (auth.error) {
		throw error(auth.status || 401, auth.error);
	}

	const fileId = event.params.id;

	if (!fileId) {
		throw error(400, 'ID de archivo requerido');
	}

	try {
		// Buscar el archivo en la BD
		const pdfFile = await prisma.pdfFile.findUnique({
			where: { id: fileId }
		});

		if (!pdfFile) {
			throw error(404, 'Archivo no encontrado');
		}

		if (!pdfFile.storagePath) {
			throw error(404, 'El archivo no tiene ruta de almacenamiento');
		}

		// Verificar que el archivo existe en el disco
		if (!existsSync(pdfFile.storagePath)) {
			throw error(404, 'El archivo físico no existe en el servidor');
		}

		// Leer el archivo
		const fileBuffer = await readFile(pdfFile.storagePath);

		// Verificar si es para ver inline o descargar
		const viewMode = event.url.searchParams.get('view') === 'true';
		const disposition = viewMode
			? `inline; filename="${pdfFile.fileName || 'documento.pdf'}"`
			: `attachment; filename="${pdfFile.fileName || 'documento.pdf'}"`;

		return new Response(fileBuffer, {
			status: 200,
			headers: {
				'Content-Type': 'application/pdf',
				'Content-Disposition': disposition,
				'Content-Length': fileBuffer.length.toString(),
				'Cache-Control': 'private, max-age=3600'
			}
		});
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}
		console.error('[DOWNLOAD FILE] Error:', err);
		throw error(500, 'Error al descargar el archivo');
	}
};
