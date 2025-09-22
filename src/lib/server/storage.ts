import { writeFile } from 'node:fs/promises';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import crypto from 'node:crypto';

// Importar configuración centralizada
import { CONFIG } from './config';

// Usar el directorio de subidas de la configuración
const UPLOAD_DIR = CONFIG.UPLOAD_DIR;

// Asegurarse de que el directorio de subidas exista
if (!existsSync(UPLOAD_DIR)) {
  mkdirSync(UPLOAD_DIR, { recursive: true, mode: 0o755 });
  console.log(`✅ Directorio de subidas creado en: ${UPLOAD_DIR}`);
}

export function safeName(original: string) {
  return original
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function saveUploadedFile(file: File) {
  try {
    // Verificar que el directorio existe
    if (!existsSync(UPLOAD_DIR)) {
      throw new Error(`El directorio de subidas no existe: ${UPLOAD_DIR}`);
    }
    
    const buf = Buffer.from(await file.arrayBuffer());
    const ts = new Date().toISOString().replace(/[:.]/g, '');
    const name = safeName(file.name || 'archivo.pdf');
    const fileName = `${ts}-${crypto.randomUUID()}-${name}`;
    const storagePath = join(UPLOAD_DIR, fileName);
    
    await writeFile(storagePath, buf);
    console.log(`✅ Archivo guardado en: ${storagePath}`);
    
    return { 
      fileName,
      storagePath,
      url: `/uploads/${fileName}` // URL relativa para acceder al archivo
    };
  } catch (error) {
    console.error('❌ Error al guardar el archivo:', error);
    throw new Error(`No se pudo guardar el archivo: ${error instanceof Error ? error.message : 'Error desconocido'}`);
  }
}
