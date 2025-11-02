import PDFParser from 'pdf2json';
import type {
  TransferenciaPDFResult,
  TransferenciaPDFCompletoResult,
  PDFData,
  PDFPage,
  PDFTextItem
} from './types/index.js';

/**
 * Normaliza un CUIT removiendo guiones y espacios
 */
function normalizeCuit(cuit: string | null): string | null {
  if (!cuit) return null;
  return cuit.replace(/[-\s]/g, '');
}

/**
 * Separa fecha y hora del formato "11:06 AM 05/12/2024"
 * Retorna { fecha: "05/12/2024", hora: "11:06 AM" } o null si no coincide
 */
function separarFechaHora(fechaHora: string | null): { fecha: string | null; hora: string | null } {
  if (!fechaHora) return { fecha: null, hora: null };
  
  const match = fechaHora.match(/(\d{1,2}:\d{2}\s+(?:AM|PM))\s+(\d{2}\/\d{2}\/\d{4})/);
  if (match) {
    return { hora: match[1], fecha: match[2] };
  }
  
  return { fecha: null, hora: null };
}

/**
 * Extrae importeATransferir e importeTotal del texto del PDF
 * Si no se encuentran, usa el importe principal como fallback
 */
function extraerImportesAdicionales(textoCompleto: string, importePrincipal: number | null): { importeATransferir: number | null; importeTotal: number | null } {
  let importeATransferir: number | null = null;
  let importeTotal: number | null = null;

  // Buscar "IMPORTE A TRANSFERIR" (en mayúsculas en el PDF)
  const importeTransferirMatch = textoCompleto.match(/IMPORTE\s+A\s+TRANSFERIR\s+\$?\s*([\d,]+\.?\d*)/i);
  if (importeTransferirMatch) {
    // Formato: XX,XXX.XX donde la coma es separador de miles
    const importeStr = importeTransferirMatch[1].replace(/,/g, '');
    importeATransferir = parseFloat(importeStr) || null;
  }

  // Buscar "Importe Total"
  const importeTotalMatch = textoCompleto.match(/Importe\s+Total\s+\$?\s*([\d,]+\.?\d*)/i);
  if (importeTotalMatch) {
    // Formato: XX,XXX.XX donde la coma es separador de miles
    const importeStr = importeTotalMatch[1].replace(/,/g, '');
    importeTotal = parseFloat(importeStr) || null;
  }

  // Usar importe principal como fallback si no se encontraron
  if (!importeATransferir && importePrincipal) {
    importeATransferir = importePrincipal;
  }
  if (!importeTotal && importePrincipal) {
    importeTotal = importePrincipal;
  }

  return { importeATransferir, importeTotal };
}

/**
 * Parsea un PDF de tipo "Transferencia a terceros banco Macro"
 * Funcion simple que recibe texto plano
 */
export function parseTransferenciaPDF(text: string, filename: string): TransferenciaPDFResult {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line);
  const textoCompleto = lines.join(' ');

  // Variables temporales para extracción
  let cbuDestino: string | null = null;
  let numeroOperacion: string | null = null;
  let fechaHora: string | null = null;
  let importe: number | null = null;
  let cuentaOrigen: string | null = null;
  let banco: string | null = null;
  let tipoOperacion: string | null = null;
  let referencia: string | null = null;
  let titular: string | null = null;
  let beneficiarioNombre: string | null = null;
  let beneficiarioCuit: string | null = null;
  let ordenanteNombre: string | null = null;
  let ordenanteDomicilio: string | null = null;
  let ordenanteCuit: string | null = null;

  // Extraer CBU destino
  const cbuMatch = textoCompleto.match(/(\d{22})/);
  if (cbuMatch) {
    cbuDestino = cbuMatch[1];
  }

  // Extraer fecha y hora
  const fechaHoraMatch = textoCompleto.match(/(\d{1,2}:\d{2}\s+(?:AM|PM)\s+\d{2}\/\d{2}\/\d{4})/);
  if (fechaHoraMatch) {
    fechaHora = fechaHoraMatch[1];

    // Extraer número de operación - buscar después de la fecha/hora
    const fechaIndex = textoCompleto.indexOf(fechaHoraMatch[1]);
    const despuesFecha = textoCompleto.substring(fechaIndex + fechaHoraMatch[1].length, fechaIndex + fechaHoraMatch[1].length + 50);
    const numeroOpMatch = despuesFecha.match(/(\d{9})/);
    if (numeroOpMatch) {
      numeroOperacion = numeroOpMatch[1];
    }
  }
  const { fecha, hora } = separarFechaHora(fechaHora);

  // Extraer importe principal - buscar después de "Importe" y antes de "2850..." (CBU)
  const importeMatch = textoCompleto.match(/Importe\s+[^$]*\$\s*([\d,]+\.?\d*)/i);
  if (importeMatch) {
    // El formato es XX,XXX.XX donde la coma es separador de miles
    const importeStr = importeMatch[1].replace(/,/g, '');
    importe = parseFloat(importeStr) || null;
  }

  // Extraer importes adicionales
  const { importeATransferir, importeTotal } = extraerImportesAdicionales(textoCompleto, importe);

  // Extraer cuenta origen
  const cuentaMatch = textoCompleto.match(/CC\s+\$\s*(\d+)/);
  if (cuentaMatch) {
    cuentaOrigen = `CC $${cuentaMatch[1]}`;
  }

  // Extraer banco - capturar cualquier banco después de "Banco" en la sección de datos
  // Buscar en la sección de "Datos de la Operación" no en los datos del banco emisor
  const bancoMatch = textoCompleto.match(/CBU\s+Destino[^B]*?Banco\s+(\w+)/i);
  if (bancoMatch) {
    banco = bancoMatch[1];
  } else {
    // Fallback: buscar cualquier banco que no sea seguido de "S.A." (datos del emisor)
    const bancoMatch2 = textoCompleto.match(/Banco\s+(\w+)(?!\s+S\.A\.)/);
    if (bancoMatch2) {
      banco = bancoMatch2[1];
    }
  }

  // Extraer tipo operación
  const tipoOpMatch = textoCompleto.match(/Tipo de operación[|\s]+(\w+)/i);
  if (tipoOpMatch) {
    tipoOperacion = tipoOpMatch[1];
  }

  // Extraer referencia
  const refMatch = textoCompleto.match(/Nro\.\s+de\s+Referencia[|\s]+(\d+)/i);
  if (refMatch) {
    referencia = refMatch[1];
  }

  // Extraer beneficiario
  const beneficiarioMatch = textoCompleto.match(/SINDICATO DE DOCENTES DE\s+EDUCACION PUBLICA/i);
  if (beneficiarioMatch) {
    beneficiarioNombre = 'SINDICATO DE DOCENTES DE EDUCACION PUBLICA';
  }

  // Extraer CUIT beneficiario - mantener formato con guiones
  const cuitBenefMatch = textoCompleto.match(/CUIT\s*\/\s*CUIL\s+(\d{2}-\d{8}-\d)/);
  if (cuitBenefMatch) {
    beneficiarioCuit = cuitBenefMatch[1];
  } else {
    const cuitBenef2Match = textoCompleto.match(/CUIT\s*\/\s*CUIL\s+(\d{11})/);
    if (cuitBenef2Match) {
      const cuit = cuitBenef2Match[1];
      beneficiarioCuit = `${cuit.substr(0,2)}-${cuit.substr(2,8)}-${cuit.substr(10,1)}`;
    }
  }

  // Extraer ordenante - buscar nombre después de los datos del banco (IIBB)
  // El ordenante viene después de "Ordenante" y antes del domicilio
  const ordenanteMatch1 = textoCompleto.match(/Ordenante\s+(?:Banco[^I]+?IIBB:[^A-Z]*?)?([A-Z][A-Z\s\d]+?)(?=\s+(?:RN|Av\.|Calle|[A-Z]+\s+\d+|EXEN|CUIT))/);
  if (ordenanteMatch1) {
    ordenanteNombre = ordenanteMatch1[1].trim();
  } else {
    // Fallback: buscar después de IIBB hasta encontrar indicios de domicilio
    const ordenanteMatch2 = textoCompleto.match(/IIBB:[^\n]*?\s+([A-Z][A-Z\s\d]+?)(?=\s+(?:RN|Av\.|Calle|CP:|EXEN))/);
    if (ordenanteMatch2) {
      ordenanteNombre = ordenanteMatch2[1].trim();
    }
  }

  // Extraer domicilio ordenante - buscar después del nombre del ordenante
  // Intentar múltiples patrones comunes de domicilio

  // Patrón 1: RN (Ruta Nacional) con formato completo
  let domMatch = textoCompleto.match(/(RN\s+\d+[^E]+?(?:VALLE|[A-Z\s]+?))\s+(?:EXEN|CUIT)/);
  if (domMatch) {
    ordenanteDomicilio = domMatch[1].trim();
  } else {
    // Patrón 2: Avenida con ciudad
    domMatch = textoCompleto.match(/((?:Av\.|Avenida)[^C]+?(?:Ciudad|Buenos Aires|CABA)[^E]*?)\s+(?:EXEN|CUIT)/i);
    if (domMatch) {
      ordenanteDomicilio = domMatch[1].trim();
    } else {
      // Patrón 3: Calle con número y opcionalmente CP
      domMatch = textoCompleto.match(/((?:Calle|C\.)\s+[A-Z\s]+?\d+[^E]*?(?:CP[:\s]*\d+)?)\s+(?:EXEN|CUIT)/i);
      if (domMatch) {
        ordenanteDomicilio = domMatch[1].trim();
      } else {
        // Patrón 4: Cualquier texto entre el nombre y EXEN/CUIT que parezca domicilio
        if (ordenanteNombre) {
          const nombreIndex = textoCompleto.indexOf(ordenanteNombre);
          if (nombreIndex >= 0) {
            const despuesNombre = textoCompleto.substring(nombreIndex + ordenanteNombre.length, nombreIndex + ordenanteNombre.length + 200);
            const domMatch2 = despuesNombre.match(/^\s*([A-Z][A-Z\s\d:.-]+?)(?=\s+(?:EXEN|CUIT))/);
            if (domMatch2) {
              ordenanteDomicilio = domMatch2[1].trim();
            }
          }
        }
      }
    }
  }

  // Extraer CUIT ordenante - buscar en sección del ordenante, no del banco
  // Primero intentar capturar el CUIT que viene después del domicilio del ordenante
  const cuitOrdenanteMatch = textoCompleto.match(/(?:RN\s+\d+[^C]*?CUIT[\/\s]*CUIL\s+)(\d{11})/);
  if (cuitOrdenanteMatch) {
    ordenanteCuit = cuitOrdenanteMatch[1];
  } else {
    // Buscar CUIT sin formato cerca de EXEN - EXENTO (que está en la sección del ordenante)
    const cuitOrdenanteMatch2 = textoCompleto.match(/EXEN\s*-\s*EXENTO\s+CUIT[\/\s]*CUIL\s+(\d{11})/);
    if (cuitOrdenanteMatch2) {
      ordenanteCuit = cuitOrdenanteMatch2[1];
    }
  }

  // Extraer titular - buscar en la tabla de datos después de "Titular"
  const titularMatch1 = textoCompleto.match(/Titular\s+(SINDICATO\s+DE\s+DOCENTES\s+DE\s+EDUCACION\s+PUBLICA)/);
  if (titularMatch1) {
    titular = titularMatch1[1];
  } else {
    // Patrón genérico: buscar después de Titular hasta CUIT/CUIL
    const titularMatch2 = textoCompleto.match(/Titular\s+([A-Z\s]+?)(?=\s+CUIT\s*\/\s*CUIL)/);
    if (titularMatch2) {
      titular = titularMatch2[1].trim();
    } else if (beneficiarioNombre) {
      // Usar beneficiarioNombre como fallback
      titular = beneficiarioNombre;
    }
  }

  // Construir resultado con nueva estructura
  const resultado: TransferenciaPDFResult = {
    tipo: 'TRANSFERENCIA',
    archivo: filename,
    titulo: 'Transferencia a terceros banco Macro',
    nroReferencia: referencia,
    nroOperacion: numeroOperacion,
    fecha: fecha,
    hora: hora,
    ordenante: {
      cuit: ordenanteCuit,
      nombre: ordenanteNombre,
      domicilio: ordenanteDomicilio
    },
    operacion: {
      cuentaOrigen: cuentaOrigen,
      importe: importe,
      cbuDestino: cbuDestino,
      banco: banco,
      titular: titular,
      cuit: beneficiarioCuit,
      tipoOperacion: tipoOperacion,
      importeATransferir: importeATransferir,
      importeTotal: importeTotal
    }
  };

  return resultado;
}

/**
 * Extrae datos completos del PDF usando pdf2json con analisis por paginas
 */
export async function parseTransferenciaPDFCompleto(pdfPath: string): Promise<TransferenciaPDFCompletoResult> {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();

    pdfParser.on('pdfParser_dataError', (errData: any) => reject(errData.parserError));

    pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
      // Extraer nombre de archivo del path
      const filename = pdfPath.split('/').pop() || pdfPath.split('\\').pop() || 'unknown.pdf';
      
      // Variables temporales para extracción
      let cbuDestino: string | null = null;
      let numeroOperacion: string | null = null;
      let fechaHora: string | null = null;
      let importe: number | null = null;
      let cuentaOrigen: string | null = null;
      let banco: string | null = null;
      let tipoOperacion: string | null = null;
      let referencia: string | null = null;
      let titular: string | null = null;
      let beneficiarioNombre: string | null = null;
      let beneficiarioCuit: string | null = null;
      let ordenanteNombre: string | null = null;
      let ordenanteDomicilio: string | null = null;
      let ordenanteCuit: string | null = null;

      let textoCompleto = '';
      const todasLasLineas: string[] = [];

      // Procesar paginas
      pdfData.Pages.forEach((page: PDFPage, pageIndex: number) => {
        // Agrupar textos por linea
        const lineas: Record<string, Array<{ x: number; texto: string }>> = {};
        page.Texts.forEach((item: PDFTextItem) => {
          const y = Math.round(item.y * 100) / 100;
          const texto = decodeURIComponent(item.R[0]?.T || '');

          if (!lineas[y]) {
            lineas[y] = [];
          }
          lineas[y].push({
            x: item.x,
            texto: texto
          });
        });

        // Ordenar lineas
        const lineasOrdenadas = Object.keys(lineas).sort((a, b) => parseFloat(b) - parseFloat(a));

        lineasOrdenadas.forEach(y => {
          const textosLinea = lineas[y].sort((a, b) => a.x - b.x);
          const textoLineaCompleto = textosLinea.map(t => t.texto).join(' ');
          todasLasLineas.push(textoLineaCompleto);
          textoCompleto += textoLineaCompleto + ' ';

          // Extraer CBU
          if (!cbuDestino) {
            const cbuMatch = textoLineaCompleto.match(/(\d{22})/);
            if (cbuMatch) {
              cbuDestino = cbuMatch[1];
            }
          }

          // Extraer fecha y hora
          if (!fechaHora) {
            const fechaMatch = textoLineaCompleto.match(/(\d{1,2}:\d{2}\s+(?:AM|PM)\s+\d{2}\/\d{2}\/\d{4})/);
            if (fechaMatch) {
              fechaHora = fechaMatch[1];

              // Extraer número de operación - buscar después de la fecha/hora
              if (!numeroOperacion) {
                const fechaIndex = textoCompleto.indexOf(fechaMatch[1]);
                const despuesFecha = textoCompleto.substring(fechaIndex + fechaMatch[1].length, fechaIndex + fechaMatch[1].length + 50);
                const numeroOpMatch = despuesFecha.match(/(\d{9})/);
                if (numeroOpMatch) {
                  numeroOperacion = numeroOpMatch[1];
                }
              }
            }
          }

          // Extraer importe - formato con coma como separador de miles
          if (!importe && textoLineaCompleto.includes('Importe')) {
            const importeMatch = textoLineaCompleto.match(/Importe\s+[^$]*\$\s*([\d,]+\.?\d*)/i);
            if (importeMatch) {
              const importeStr = importeMatch[1].replace(/,/g, '');
              importe = parseFloat(importeStr) || null;
            }
          }

          // Extraer cuenta origen
          if (!cuentaOrigen && textoLineaCompleto.includes('CC')) {
            const cuentaMatch = textoLineaCompleto.match(/CC\s+\$\s*(\d+)/);
            if (cuentaMatch) {
              cuentaOrigen = `CC $${cuentaMatch[1]}`;
            }
          }

          // Extraer banco - capturar cualquier banco
          if (!banco && textoLineaCompleto.includes('Banco')) {
            const bancoMatch = textoLineaCompleto.match(/Banco\s+(\w+)(?!\s+S\.A\.)/);
            if (bancoMatch) {
              banco = bancoMatch[1];
            }
          }

          // Extraer tipo operacion
          if (!tipoOperacion && textoLineaCompleto.includes('Tipo de operación')) {
            const tipoMatch = textoLineaCompleto.match(/Tipo de operación\s+(\w+)/);
            if (tipoMatch) {
              tipoOperacion = tipoMatch[1];
            }
          }

          // Extraer referencia
          if (!referencia && textoLineaCompleto.includes('Referencia')) {
            const refMatch = textoLineaCompleto.match(/Referencia\s+(\d+)/);
            if (refMatch) {
              referencia = refMatch[1];
            }
          }

          // Extraer beneficiario
          if (!beneficiarioNombre && textoLineaCompleto.includes('SINDICATO')) {
            if (textoLineaCompleto.includes('EDUCACION')) {
              beneficiarioNombre = 'SINDICATO DE DOCENTES DE EDUCACION PUBLICA';
            }
          }

          // Extraer CUIT beneficiario - mantener formato con guiones
          if (!beneficiarioCuit) {
            const cuitMatch = textoLineaCompleto.match(/CUIT\s*\/\s*CUIL\s+(\d{2}-\d{8}-\d)/);
            if (cuitMatch) {
              beneficiarioCuit = cuitMatch[1];
            } else {
              const cuitMatch2 = textoLineaCompleto.match(/CUIT\s*\/\s*CUIL\s+(\d{11})/);
              if (cuitMatch2) {
                const cuit = cuitMatch2[1];
                beneficiarioCuit = `${cuit.substr(0,2)}-${cuit.substr(2,8)}-${cuit.substr(10,1)}`;
              }
            }
          }

          // Extraer ordenante - buscar cualquier nombre después de IIBB
          if (!ordenanteNombre && (textoLineaCompleto.includes('IIBB') || textoLineaCompleto.includes('Ordenante'))) {
            // Buscar nombre en mayúsculas antes de RN/Av./Calle/EXEN/CUIT
            const ordMatch = textoLineaCompleto.match(/(?:IIBB:[^\n]*?\s+|Ordenante\s+)([A-Z][A-Z\s\d]+?)(?=\s+(?:RN|Av\.|Calle|EXEN|CUIT))/);
            if (ordMatch) {
              ordenanteNombre = ordMatch[1].trim();
            }
          }

          // Extraer domicilio ordenante - múltiples formatos
          if (!ordenanteDomicilio) {
            // Patrón 1: RN (Ruta Nacional)
            if (textoLineaCompleto.includes('RN')) {
              const domRNMatch = textoLineaCompleto.match(/(RN\s+\d+[^E]+?)(?=\s+(?:EXEN|CUIT))/);
              if (domRNMatch) {
                ordenanteDomicilio = domRNMatch[1].trim();
              }
            }
            // Patrón 2: Avenida
            if (!ordenanteDomicilio && (textoLineaCompleto.includes('Av.') || textoLineaCompleto.includes('Avenida'))) {
              const domAvMatch = textoLineaCompleto.match(/((?:Av\.|Avenida)[^E]+?)(?=\s+(?:EXEN|CUIT))/i);
              if (domAvMatch) {
                ordenanteDomicilio = domAvMatch[1].trim();
              }
            }
            // Patrón 3: Calle
            if (!ordenanteDomicilio && textoLineaCompleto.includes('Calle')) {
              const domCalleMatch = textoLineaCompleto.match(/(Calle\s+[A-Z\s]+?\d+[^E]*?)(?=\s+(?:EXEN|CUIT))/i);
              if (domCalleMatch) {
                ordenanteDomicilio = domCalleMatch[1].trim();
              }
            }
          }

          // Extraer CUIT ordenante - buscar en sección del ordenante
          if (!ordenanteCuit) {
            if (textoLineaCompleto.includes('EXEN') || textoLineaCompleto.includes('EXENTO')) {
              const cuitOrdMatch = textoLineaCompleto.match(/CUIT[\/\s]*CUIL\s+(\d{11})/);
              if (cuitOrdMatch) {
                ordenanteCuit = cuitOrdMatch[1];
              }
            }
          }

          // Extraer titular - buscar en la tabla de datos
          if (!titular && textoLineaCompleto.includes('Titular')) {
            const titularMatch1 = textoLineaCompleto.match(/Titular\s+(SINDICATO\s+DE\s+DOCENTES\s+DE\s+EDUCACION\s+PUBLICA)/);
            if (titularMatch1) {
              titular = titularMatch1[1];
            } else {
              const titularMatch2 = textoLineaCompleto.match(/Titular\s+([A-Z\s]+?)(?=\s+CUIT\s*\/\s*CUIL)/);
              if (titularMatch2) {
                titular = titularMatch2[1].trim();
              }
            }
          }
        });

        // Si no se encontró titular, buscar en todo el texto
        if (!titular) {
          const titularGlobalMatch = textoCompleto.match(/Titular\s+(SINDICATO\s+DE\s+DOCENTES\s+DE\s+EDUCACION\s+PUBLICA)/);
          if (titularGlobalMatch) {
            titular = titularGlobalMatch[1];
          } else {
            const titularGenericoMatch = textoCompleto.match(/Titular\s+([A-Z\s]+?)(?=\s+CUIT\s*\/\s*CUIL)/);
            if (titularGenericoMatch) {
              titular = titularGenericoMatch[1].trim();
            }
          }
        }
      });

      // Si no se encontró titular pero sí el beneficiario, usarlo como fallback
      if (!titular && beneficiarioNombre) {
        titular = beneficiarioNombre;
      }

      // Si no se encontró ordenante, buscar en todo el texto completo
      if (!ordenanteNombre) {
        const ordGlobalMatch = textoCompleto.match(/(?:IIBB:[^\n]*?\s+|Ordenante\s+)([A-Z][A-Z\s\d]+?)(?=\s+(?:RN|Av\.|Calle|EXEN|CUIT))/);
        if (ordGlobalMatch) {
          ordenanteNombre = ordGlobalMatch[1].trim();
        }
      }

      // Si no se encontró domicilio, buscar en todo el texto completo
      if (!ordenanteDomicilio) {
        // Intentar RN con formato completo
        let domGlobalMatch = textoCompleto.match(/(RN\s+\d+\s+\d+\s+CP:\d+\s+[A-Z\s]+?VALLE)/);
        if (domGlobalMatch) {
          ordenanteDomicilio = domGlobalMatch[1].trim();
        } else {
          // Intentar RN simple
          domGlobalMatch = textoCompleto.match(/(RN\s+\d+[^E]+?)(?=\s+EXEN)/);
          if (domGlobalMatch) {
            ordenanteDomicilio = domGlobalMatch[1].trim();
          } else {
            // Intentar Avenida
            domGlobalMatch = textoCompleto.match(/((?:Av\.|Avenida)[^E]+?)(?=\s+EXEN)/i);
            if (domGlobalMatch) {
              ordenanteDomicilio = domGlobalMatch[1].trim();
            } else {
              // Intentar Calle
              domGlobalMatch = textoCompleto.match(/(Calle\s+[A-Z\s]+?\d+[^E]*?)(?=\s+EXEN)/i);
              if (domGlobalMatch) {
                ordenanteDomicilio = domGlobalMatch[1].trim();
              }
            }
          }
        }
      }

      // Separar fecha y hora
      const { fecha, hora } = separarFechaHora(fechaHora);

      // Extraer importes adicionales
      const { importeATransferir, importeTotal } = extraerImportesAdicionales(textoCompleto, importe);

      // Construir resultado con nueva estructura
      const resultado: TransferenciaPDFCompletoResult = {
        tipo: 'TRANSFERENCIA',
        metadata: {
          creator: pdfData.Meta.Creator,
          creationDate: pdfData.Meta.CreationDate,
          totalPaginas: pdfData.Pages.length
        },
        archivo: filename,
        titulo: 'Transferencia a terceros banco Macro',
        nroReferencia: referencia,
        nroOperacion: numeroOperacion,
        fecha: fecha,
        hora: hora,
        ordenante: {
          cuit: ordenanteCuit,
          nombre: ordenanteNombre,
          domicilio: ordenanteDomicilio
        },
        operacion: {
          cuentaOrigen: cuentaOrigen,
          importe: importe,
          cbuDestino: cbuDestino,
          banco: banco,
          titular: titular,
          cuit: beneficiarioCuit,
          tipoOperacion: tipoOperacion,
          importeATransferir: importeATransferir,
          importeTotal: importeTotal
        }
      };

      resolve(resultado);
    });

    pdfParser.loadPDF(pdfPath);
  });
}

