import { writeFile, unlink } from 'node:fs/promises';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import crypto from 'node:crypto';

import { CONFIG } from './config';

const UPLOAD_DIR = CONFIG.UPLOAD_DIR;
export const ANALYZER_DIR = join(UPLOAD_DIR, 'analyzer');

// Asegurar que los directorios existen al cargar el modulo
if (!existsSync(UPLOAD_DIR)) {
  mkdirSync(UPLOAD_DIR, { recursive: true, mode: 0o755 });
}
if (!existsSync(ANALYZER_DIR)) {
  mkdirSync(ANALYZER_DIR, { recursive: true, mode: 0o755 });
}

/**
 * Genera un nombre de archivo unico usando UUID para evitar colisiones.
 */
export function generateFileName(originalName: string): string {
  const ext = originalName.split('.').pop() || 'pdf';
  return `${crypto.randomUUID()}.${ext}`;
}

/**
 * Construye el path absoluto para un archivo en el directorio analyzer.
 */
export function getAnalyzerFilePath(fileName: string): string {
  return join(ANALYZER_DIR, fileName);
}

/**
 * Guarda un buffer en el directorio analyzer.
 * Retorna el storagePath absoluto del archivo guardado.
 */
export async function saveAnalyzerFile(buffer: Buffer, originalName: string): Promise<string> {
  const fileName = generateFileName(originalName);
  const storagePath = getAnalyzerFilePath(fileName);
  await writeFile(storagePath, buffer);
  return storagePath;
}

/**
 * Elimina un archivo por su storagePath.
 * Retorna true si se elimino, false si no existia.
 * No lanza error si el archivo no existe.
 */
export async function deleteFile(storagePath: string): Promise<boolean> {
  try {
    if (existsSync(storagePath)) {
      await unlink(storagePath);
      return true;
    }
    return false;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error(`Error eliminando archivo: ${storagePath}`, err);
    }
    return false;
  }
}

/**
 * Verifica si un archivo existe en disco.
 */
export function fileExists(storagePath: string): boolean {
  return existsSync(storagePath);
}
