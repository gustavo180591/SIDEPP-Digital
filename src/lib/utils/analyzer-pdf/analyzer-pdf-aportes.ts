import PDFParser from 'pdf2json';
import type {
  ListadoPDFResult,
  ListadoPDFCompletoResult,
  Escuela,
  PersonaAporte,
  Totales,
  PaginaData,
  TotalesGenerales,
  PDFMetadataInfo,
  PDFData,
  PDFPage,
  PDFTextItem
} from './types/index.js';

/**
 * Parsea un PDF de tipo "Listado de Aportes" (TOTALES POR CONCEPTO - PERSONAS)
 * Funcion simple que recibe texto plano
 */
export function parseListadoPDF(text: string, filename: string): ListadoPDFResult {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line);
  const textoCompleto = lines.join(' ');

  const resultado: ListadoPDFResult = {
    tipo: 'LISTADO_APORTES',
    archivo: filename,
    escuela: {
      nombre: null,
      direccion: null,
      cuit: null
    },
    fecha: null,
    periodo: null,
    concepto: null,
    personas: [],
    totales: {
      cantidadPersonas: 0,
      montoTotal: 0
    }
  };

  // Extraer fecha
  const fechaMatch = textoCompleto.match(/Fecha:\s*(\d{1,2}\/\d{1,2}\/\d{4})/);
  if (fechaMatch) {
    resultado.fecha = fechaMatch[1];
  }

  // Extraer escuela - formato: "Página: 1 EFA San Bonifacio Ruta Nac. 14 Km 1200 30-64012797-6"
  const escuelaMatch = textoCompleto.match(/Página:\s*\d+\s+(.+?)\s+(Ruta.+?)\s+(\d{2}-\d{8}-\d)/);
  if (escuelaMatch) {
    resultado.escuela.nombre = escuelaMatch[1].trim().toUpperCase();
    resultado.escuela.direccion = escuelaMatch[2].trim();
    resultado.escuela.cuit = escuelaMatch[3].trim();
  }

  // Extraer concepto
  const conceptoMatch = textoCompleto.match(/Concepto:\s+(.+?)(?=\s+(?:Periodo:|Noviembre|Octubre|Septiembre|Enero|Febrero|Marzo|Abril|Mayo|Junio|Julio|Agosto|Diciembre|FOPID))/);
  if (conceptoMatch) {
    resultado.concepto = conceptoMatch[1].trim();
  }

  // Extraer periodo - primero verificar si es FOPID (formato: "FOPID Periodo:")
  const fopidMatch = textoCompleto.match(/FOPID\s+Periodo:/);
  if (fopidMatch) {
    resultado.periodo = 'FOPID';
  } else {
    // Si no es FOPID, buscar formato mensual y convertir a MM/YYYY
    const periodoMatch = textoCompleto.match(/(Enero|Febrero|Marzo|Abril|Mayo|Junio|Julio|Agosto|Septiembre|Octubre|Noviembre|Diciembre)\s*-\s*(\d{4})/);
    if (periodoMatch) {
      const meses: { [key: string]: string } = {
        'Enero': '01', 'Febrero': '02', 'Marzo': '03', 'Abril': '04',
        'Mayo': '05', 'Junio': '06', 'Julio': '07', 'Agosto': '08',
        'Septiembre': '09', 'Octubre': '10', 'Noviembre': '11', 'Diciembre': '12'
      };
      resultado.periodo = `${meses[periodoMatch[1]]}/${periodoMatch[2]}`;
    }
  }

  // Extraer datos de personas - preservar espacios múltiples
  const personasRegex = /([A-ZÑÁÉÍÓÚ]+\s{1,3}[A-ZÑÁÉÍÓÚ]+(?:\s{1,3}[A-ZÑÁÉÍÓÚ]+)?)\s+(\d+)\s+([\d,.]+)\s+([\d,.]+)/g;
  let match: RegExpExecArray | null;

  while ((match = personasRegex.exec(textoCompleto)) !== null) {
    const nombreCompleto = match[1]; // NO usar trim() para preservar espacios dobles
    const cantidadLegajos = parseInt(match[2], 10);
    // En el PDF el orden de las columnas es: Tot Remunerativo | Cantidad Legajos | Monto del Concepto
    // Pero en el texto extraído viene: Nombre | Cantidad | Tot Remunerativo | Monto Concepto
    const totalRemunerativo = parseFloat(match[4].replace(/,/g, '')); // match[4] es Tot Remunerativo
    const montoConcepto = parseFloat(match[3].replace(/,/g, '')); // match[3] es Monto del Concepto

    // Validar que no sea un encabezado
    if (nombreCompleto.includes('PERSONAS') || nombreCompleto.includes('CANTIDAD')) {
      continue;
    }

    resultado.personas.push({
      nombre: nombreCompleto,
      totalRemunerativo: totalRemunerativo,
      cantidadLegajos: cantidadLegajos,
      montoConcepto: montoConcepto
    });
  }

  // Extraer totales
  const totalPersonasMatch = textoCompleto.match(/Cantidad de Personas:\s*Totales:\s*(\d+)/);
  if (totalPersonasMatch) {
    resultado.totales.cantidadPersonas = parseInt(totalPersonasMatch[1], 10);
  }

  const montoTotalMatch = textoCompleto.match(/Totales:\s*\d+\s+([\d,.]+)/);
  if (montoTotalMatch) {
    resultado.totales.montoTotal = parseFloat(montoTotalMatch[1].replace(/,/g, ''));
  }

  return resultado;
}

/**
 * Extrae datos completos del PDF usando pdf2json con analisis por paginas
 */
export async function parseListadoPDFCompleto(pdfPath: string): Promise<ListadoPDFCompletoResult> {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();

    pdfParser.on('pdfParser_dataError', (errData: any) => reject(errData.parserError));

    pdfParser.on('pdfParser_dataReady', (pdfData: PDFData) => {
      const resultado: ListadoPDFCompletoResult = {
        tipo: 'LISTADO_APORTES',
        metadata: {
          creator: pdfData.Meta.Creator,
          creationDate: pdfData.Meta.CreationDate,
          totalPaginas: pdfData.Pages.length
        },
        escuela: {
          nombre: null,
          direccion: null,
          cuit: null
        },
        concepto: null,
        periodo: null,
        paginas: [],
        totalesGenerales: {
          cantidadPersonas: 0,
          montoTotal: 0,
          totalRegistros: 0
        }
      };

      // Procesar cada pagina
      pdfData.Pages.forEach((page: PDFPage, pageIndex: number) => {
        const paginaData: PaginaData = {
          numero: pageIndex + 1,
          fecha: null,
          personas: [],
          totales: {
            cantidadPersonas: 0,
            montoTotal: 0
          }
        };

        // Agrupar textos por linea (coordenada Y)
        const lineas: Record<string, Array<{ x: number; texto: string; negrita?: boolean; tamanio?: number }>> = {};
        page.Texts.forEach((item: PDFTextItem) => {
          const y = Math.round(item.y * 100) / 100;
          const texto = decodeURIComponent(item.R[0]?.T || '');

          if (!lineas[y]) {
            lineas[y] = [];
          }
          lineas[y].push({
            x: item.x,
            texto: texto,
            negrita: item.R[0]?.TS?.[2] === 1,
            tamanio: item.R[0]?.TS?.[1] || 10
          });
        });

        // Ordenar lineas de arriba a abajo (Y descendente)
        const lineasOrdenadas = Object.keys(lineas).sort((a, b) => parseFloat(b) - parseFloat(a));

        let textoCompleto = '';
        const filasTabla: PersonaAporte[] = [];

        lineasOrdenadas.forEach(y => {
          // Ordenar textos de izquierda a derecha (X ascendente)
          const textosLinea = lineas[y].sort((a, b) => a.x - b.x);
          const textoLineaCompleto = textosLinea.map(t => t.texto).join(' ');

          textoCompleto += textoLineaCompleto + ' ';

          // Extraer informacion de encabezado (solo primera pagina)
          if (pageIndex === 0) {
            // Fecha
            if (textoLineaCompleto.includes('Fecha:')) {
              const fechaMatch = textoLineaCompleto.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
              if (fechaMatch) paginaData.fecha = fechaMatch[1];
            }

            // Escuela - buscar patron: Nombre | Direccion | CUIT
            if (!resultado.escuela.nombre) {
              const escuelaMatch = textoLineaCompleto.match(/(.+?)\s+(Ruta.+?)\s+(\d{2}-\d{8}-\d)/);
              if (escuelaMatch) {
                resultado.escuela.nombre = escuelaMatch[1].trim().toUpperCase();
                resultado.escuela.direccion = escuelaMatch[2].trim();
                resultado.escuela.cuit = escuelaMatch[3].trim();
              }
            }

            // Concepto - buscar antes de "Periodo:"
            if (!resultado.concepto && textoLineaCompleto.includes('Concepto:')) {
              const conceptoMatch = textoLineaCompleto.match(/Concepto:\s+([^P]+?)(?=\s+Periodo:)/);
              if (conceptoMatch) {
                resultado.concepto = conceptoMatch[1].trim();
              }
            }

            // Periodo - primero verificar si es FOPID (formato: "FOPID Periodo:")
            if (!resultado.periodo) {
              const fopidMatch = textoLineaCompleto.match(/FOPID\s+Periodo:/);
              if (fopidMatch) {
                resultado.periodo = 'FOPID';
              } else {
                // Si no es FOPID, buscar formato mensual y convertir a MM/YYYY
                const periodoMatch = textoLineaCompleto.match(/(Enero|Febrero|Marzo|Abril|Mayo|Junio|Julio|Agosto|Septiembre|Octubre|Noviembre|Diciembre)\s*-\s*(\d{4})/);
                if (periodoMatch) {
                  const meses: { [key: string]: string } = {
                    'Enero': '01', 'Febrero': '02', 'Marzo': '03', 'Abril': '04',
                    'Mayo': '05', 'Junio': '06', 'Julio': '07', 'Agosto': '08',
                    'Septiembre': '09', 'Octubre': '10', 'Noviembre': '11', 'Diciembre': '12'
                  };
                  resultado.periodo = `${meses[periodoMatch[1]]}/${periodoMatch[2]}`;
                }
              }
            }
          }

          // Detectar filas de datos - buscar patron NOMBRE | numero | numero.decimal | numero.decimal
          // Buscar todas las ocurrencias en la linea - preservar espacios múltiples
          const personasRegex = /([A-ZÑÁÉÍÓÚ]+\s{1,3}[A-ZÑÁÉÍÓÚ]+(?:\s{1,3}[A-ZÑÁÉÍÓÚ]+)?)\s+(\d+)\s+([\d.]+)\s+([\d.]+)/g;
          let personaMatch: RegExpExecArray | null;

          while ((personaMatch = personasRegex.exec(textoLineaCompleto)) !== null) {
            const nombre = personaMatch[1]; // NO usar trim() para preservar espacios dobles

            // Filtrar encabezados
            if (nombre.includes('PERSONAS') ||
                nombre.includes('CANTIDAD') ||
                nombre.includes('CONCEPTO') ||
                nombre.includes('REMUNERATIVO') ||
                nombre.includes('PERIODO')) {
              continue;
            }

            // Validar que tenga al menos 2 palabras (apellido y nombre)
            const palabras = nombre.split(/\s+/);
            if (palabras.length < 2) continue;

            filasTabla.push({
              nombre: nombre,
              totalRemunerativo: parseFloat(personaMatch[4]),
              cantidadLegajos: parseInt(personaMatch[2], 10),
              montoConcepto: parseFloat(personaMatch[3])
            });
          }
        });

        // Asignar personas encontradas
        paginaData.personas = filasTabla;

        // Extraer totales de esta pagina
        const totalPersonasMatch = textoCompleto.match(/Cantidad de Personas:\s*Totales:\s*(\d+)/);
        if (totalPersonasMatch) {
          paginaData.totales.cantidadPersonas = parseInt(totalPersonasMatch[1], 10);
        }

        const montoTotalMatch = textoCompleto.match(/Totales:\s*\d+\s+([\d,.]+)/);
        if (montoTotalMatch) {
          paginaData.totales.montoTotal = parseFloat(montoTotalMatch[1].replace(/,/g, ''));
        }

        resultado.paginas.push(paginaData);
      });

      // Calcular totales generales
      resultado.totalesGenerales = {
        cantidadPersonas: resultado.paginas.reduce((sum, p) => sum + p.totales.cantidadPersonas, 0),
        montoTotal: resultado.paginas.reduce((sum, p) => sum + p.totales.montoTotal, 0),
        totalRegistros: resultado.paginas.reduce((sum, p) => sum + p.personas.length, 0)
      };

      resolve(resultado);
    });

    pdfParser.loadPDF(pdfPath);
  });
}

