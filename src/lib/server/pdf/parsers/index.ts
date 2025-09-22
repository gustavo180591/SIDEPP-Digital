import type { PdfFile } from '@prisma/client';
import { parseListado, type ParseResult as ListadoParseResult } from '../parse-listado';
import { parseTransfer } from '../parse-transfer';
import { logger } from '../utils/logger';

export interface ParserResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  warnings?: string[];
}

function maybeWarnings(x: unknown): string[] {
  if (x && typeof x === 'object' && 'warnings' in x) {
    const w = (x as { warnings?: unknown }).warnings;
    return Array.isArray(w) ? w : [];
  }
  return [];
}

export interface PdfParser<T = unknown> {
  name: string;
  description: string;
  patterns: (string | RegExp)[];
  parse: (buffer: Buffer, pdfFile: PdfFile) => Promise<ParserResult<T>>;
}

// Lista de parsers disponibles
const parsers: PdfParser[] = [
  {
    name: 'listado',
    description: 'Parser para archivos de listado de aportes',
    patterns: [/listado/i, /aportes/i],
    parse: async (buffer: Buffer, pdfFile: PdfFile) => {
      try {
        const result = await parseListado(buffer, pdfFile);
        return {
          success: result.success,
          data: result,
          warnings: result.warnings ?? []
        } as ParserResult<ListadoParseResult>;
      } catch (error) {
        logger.error('Error en parser de listado', { error });
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Error desconocido al procesar listado'
        };
      }
    }
  },
  {
    name: 'transferencia',
    description: 'Parser para archivos de transferencia',
    patterns: [/transferencia/i, /pago/i],
    parse: async (buffer: Buffer, pdfFile: PdfFile) => {
      try {
        const data = await parseTransfer(buffer, pdfFile);
        // 'data' quizá NO tiene warnings; si algún día los trae, los recogemos
        return {
          success: true,
          data,
          warnings: maybeWarnings(data)
        };
      } catch (error) {
        logger.error('Error en parser de transferencia', { error });
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Error desconocido al procesar transferencia'
        };
      }
    }
  }
];

export async function detectAndParse(buffer: Buffer, pdfFile: PdfFile): Promise<ParserResult> {
  // Primero intentamos identificar el tipo de PDF por su nombre
  const fileName = pdfFile.fileName.toLowerCase();
  
  for (const parser of parsers) {
    const isMatch = parser.patterns.some((pattern: string | RegExp) =>
      typeof pattern === 'string' ? fileName.includes(pattern.toLowerCase()) : pattern.test(fileName)
    );

    if (isMatch) {
      logger.info(`Usando parser: ${parser.name}`, { fileName });
      return parser.parse(buffer, pdfFile);
    }
  }

  // Si no se encontró un parser específico, intentamos con el parser por defecto
  logger.warn('No se encontró un parser específico, usando parser por defecto', { fileName });
  try {
    // Intenta con el parser de listado como predeterminado
    const result = await parseListado(buffer, pdfFile);
    return {
      success: true,
      data: result,
      warnings: [
        'El tipo de documento no pudo ser determinado automáticamente',
        ...(result.warnings || [])
      ]
    };
  } catch (error) {
    logger.error('Error al procesar con el parser por defecto', { error });
    return {
      success: false,
      error: 'No se pudo procesar el archivo. El formato no es compatible.'
    };
  }
}

export function getAvailableParsers() {
  return parsers.map(({ name, description }) => ({ name, description }));
}
