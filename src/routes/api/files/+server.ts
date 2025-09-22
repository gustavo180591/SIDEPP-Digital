import { processPdfById } from '$lib/server/pdf/pipeline';
import { prisma } from '$lib/server/db';
import { error, json, type RequestHandler } from '@sveltejs/kit';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileTypeFromBuffer } from 'file-type';
// No necesitamos importar File ya que usamos el tipo nativo de SvelteKit

// Importar configuración centralizada
import { CONFIG } from '$lib/server/config';

// Usar la configuración centralizada
const { UPLOAD_DIR, MAX_FILE_SIZE } = CONFIG;

// El directorio ya debería estar creado por la configuración
console.log(`📁 Usando directorio de subidas: ${UPLOAD_DIR}`);

/**
 * Obtiene la lista de archivos PDF subidos
 */
export const GET: RequestHandler = async () => {
  console.log('🔍 [GET] /api/files - Iniciando solicitud');
  
  try {
    // 1. Verificar conexión a la base de datos
    try {
      await prisma.$connect();
      console.log('✅ Conexión a la base de datos establecida');
    } catch (dbError) {
      const error = dbError as Error;
      console.error('❌ Error al conectar a la base de datos:', {
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
      return json({ 
        error: 'Database Connection Error',
        message: 'No se pudo conectar a la base de datos',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }, { status: 500 });
    }

    // 2. Obtener archivos
    let files;
    try {
      console.log('🔍 Buscando archivos en la base de datos...');
      files = await prisma.pdfFile.findMany({
        take: 50,
        orderBy: { createdAt: 'desc' },
        include: {
          institution: { select: { id: true, name: true, cuit: true } },
          period: { select: { id: true, label: true } }
        }
      });
      console.log(`✅ Se encontraron ${files.length} archivos`);
    } catch (queryError) {
      const error = queryError as Error;
      console.error('❌ Error al consultar archivos:', {
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
      return json({
        error: 'Database Query Error',
        message: 'Error al consultar los archivos',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }, { status: 500 });
    }

    // 3. Mapear la respuesta
    try {
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
    } catch (mappingError) {
      const error = mappingError as Error;
      console.error('❌ Error al mapear la respuesta:', {
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
      return json({
        error: 'Response Mapping Error',
        message: 'Error al formatear la respuesta',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }, { status: 500 });
    }
  } catch (e) {
    const error = e as Error;
    console.error('❌ Error inesperado en GET /api/files:', {
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });
    
    return json({
      error: 'Internal Server Error',
      message: 'Ocurrió un error inesperado',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      timestamp: new Date().toISOString()
    }, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-store',
        'X-Error-Type': 'UnexpectedError'
      }
    });
  }
};

export const POST: RequestHandler = async ({ request }) => {
  console.log('📤 [POST] /api/files - Iniciando subida de archivo');
  
  try {
    // Verificar que la solicitud sea un FormData
    const contentType = request.headers.get('content-type');
    if (!contentType || !contentType.includes('multipart/form-data')) {
      console.error('❌ Content-Type no es multipart/form-data');
      return json(
        { error: 'Formato de solicitud no válido. Se esperaba multipart/form-data' },
        { status: 400 }
      );
    }
    
    // Verificar conexión a la base de datos
    try {
      await prisma.$connect();
      console.log('✅ Conexión a la base de datos establecida');
    } catch (dbError) {
      const error = dbError as Error;
      console.error('❌ Error al conectar a la base de datos:', {
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
      return json(
        { 
          error: 'Error de conexión a la base de datos',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined 
        },
        { status: 500 }
      );
    }
    
    // Obtener el archivo del formulario
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      console.error('❌ No se proporcionó ningún archivo en el formulario');
      return json(
        { error: 'No se proporcionó ningún archivo' },
        { status: 400 }
      );
    }
    
    console.log(`📄 Archivo recibido: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`);
    
    // Validar el tamaño del archivo
    if (file.size > MAX_FILE_SIZE) {
      console.error(`❌ El archivo excede el tamaño máximo de ${MAX_FILE_SIZE / 1024 / 1024}MB`);
      return json(
        { error: `El archivo excede el tamaño máximo de ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 413 }
      );
    }
    
    // Leer los primeros bytes para verificar la firma del PDF
    const buffer = await file.arrayBuffer().then(ab => Buffer.from(ab));
    
    // Validar el tipo de archivo
    const fileType = await fileTypeFromBuffer(buffer);
    
    console.log('🔍 Tipo de archivo detectado:', fileType);
    
    if (!fileType || fileType.mime !== 'application/pdf') {
      console.error(`❌ Tipo de archivo no permitido: ${fileType?.mime || 'desconocido'}`);
      return json(
        { error: 'Solo se permiten archivos PDF' },
        { status: 400 }
      );
    }
    
    // Verificar la firma del PDF (primeros 4 bytes)
    if (!buffer.slice(0, 4).equals(Buffer.from('%PDF'))) {
      console.error('❌ El archivo no parece ser un PDF válido');
      return json(
        { error: 'El archivo no parece ser un PDF válido' },
        { status: 400 }
      );
    }
    
    // Generar nombre de archivo único
    const timestamp = Date.now();
    const fileExt = file.name.split('.').pop() || 'pdf';
    const fileName = `${timestamp}.${fileExt}`;
    const filePath = join(UPLOAD_DIR, fileName);

    // Guardar el archivo
    try {
      await writeFile(filePath, buffer);
      console.log(`✅ Archivo guardado en: ${filePath}`);
      
      // Guardar en la base de datos
      const savedFile = await prisma.pdfFile.create({
        data: {
          fileName: file.name,
          storagePath: filePath,
          kind: 'LISTADO', // Se actualizará durante el procesamiento
          size: file.size,
          mimeType: file.type || 'application/pdf',
          institutionId: formData.get('institutionId')?.toString() || null,
          periodId: formData.get('periodId')?.toString() || null,
          parsed: false,
          parseErrors: null
        }
      });
      
      // Procesar el PDF en segundo plano
      processPdfById(savedFile.id).catch(console.error);
      
      return json(savedFile, { status: 201 });
      
    } catch (saveError) {
      console.error('❌ Error al guardar el archivo:', saveError);
      throw error(500, `Error al guardar el archivo: ${saveError instanceof Error ? saveError.message : 'Error desconocido'}`);
    }
    
  } catch (err: unknown) {
    console.error('Error uploading file:', err);
    if (err && typeof err === 'object' && 'status' in err && 'body' in err) {
      throw err; // Errores ya formateados
    }
    throw error(500, 'Error al procesar el archivo');
  }
}

// PDF processing is now handled through the pipeline import
