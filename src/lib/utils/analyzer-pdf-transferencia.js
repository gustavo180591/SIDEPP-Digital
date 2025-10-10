import PDFParser from 'pdf2json';

/**
 * Parsea un PDF de tipo "Transferencia a terceros banco Macro"
 * Funcion simple que recibe texto plano
 */
function parseTransferenciaPDF(text, filename) {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line);
  const textoCompleto = lines.join(' ');

  const resultado = {
    tipo: 'TRANSFERENCIA',
    archivo: filename,
    transferencia: {
      titular: null,
      cbu: null,
      numeroOperacion: null,
      fechaHora: null,
      importe: null,
      cuentaOrigen: null,
      banco: null,
      tipoOperacion: null,
      referencia: null
    },
    beneficiario: {
      nombre: null,
      cuit: null,
      domicilio: null,
      condicionIVA: null
    },
    ordenante: {
      nombre: null,
      domicilio: null,
      cuit: null,
      iibb: null
    }
  };

  // Extraer datos de transferencia
  const cbuMatch = textoCompleto.match(/(\d{22})/);
  if (cbuMatch) {
    resultado.transferencia.cbu = cbuMatch[1];
  }

  const numeroOpMatch = textoCompleto.match(/N�mero de Operaci�n[|\s]+(\d+)/i);
  if (numeroOpMatch) {
    resultado.transferencia.numeroOperacion = numeroOpMatch[1];
  }

  const fechaHoraMatch = textoCompleto.match(/(\d{1,2}:\d{2}\s+(?:AM|PM)\s+\d{2}\/\d{2}\/\d{4})/);
  if (fechaHoraMatch) {
    resultado.transferencia.fechaHora = fechaHoraMatch[1];
  }

  const importeMatch = textoCompleto.match(/\$\s*([\d,.]+)/);
  if (importeMatch) {
    resultado.transferencia.importe = importeMatch[1];
  }

  const cuentaMatch = textoCompleto.match(/CC\s+\$\s+(\d+)/);
  if (cuentaMatch) {
    resultado.transferencia.cuentaOrigen = cuentaMatch[1];
  }

  const bancoMatch = textoCompleto.match(/Banco[|\s]+([\w\s]+?)(?=\||CUIT)/);
  if (bancoMatch) {
    resultado.transferencia.banco = bancoMatch[1].trim();
  }

  const tipoOpMatch = textoCompleto.match(/Tipo de operaci�n[|\s]+(\w+)/i);
  if (tipoOpMatch) {
    resultado.transferencia.tipoOperacion = tipoOpMatch[1];
  }

  const refMatch = textoCompleto.match(/Nro\.\s+de\s+Referencia[|\s]+(\d+)/i);
  if (refMatch) {
    resultado.transferencia.referencia = refMatch[1];
  }

  // Extraer beneficiario
  const beneficiarioMatch = textoCompleto.match(/SINDICATO DE DOCENTES DE\s+EDUCACION PUBLICA/i);
  if (beneficiarioMatch) {
    resultado.beneficiario.nombre = 'SINDICATO DE DOCENTES DE EDUCACION PUBLICA';
  }

  const cuitBenefMatch = textoCompleto.match(/CUIT[\/\s]+CUIL[|\s]+(\d{2}-\d{8}-\d)/i);
  if (cuitBenefMatch) {
    resultado.beneficiario.cuit = cuitBenefMatch[1];
  }

  // Extraer ordenante
  const ordenanteMatch = textoCompleto.match(/Ordenante[|\s]+([^|]+?)(?=\s+Banco)/);
  if (ordenanteMatch) {
    resultado.ordenante.nombre = ordenanteMatch[1].trim();
  }

  const domOrdenanteMatch = textoCompleto.match(/Av\.\s+Eduardo\s+Madero[^|]+?Buenos\s+Aires/);
  if (domOrdenanteMatch) {
    resultado.ordenante.domicilio = domOrdenanteMatch[0];
  }

  const cuitOrdenanteMatch = textoCompleto.match(/IVA\s+RI:\s+CUIT\s+N�\s+(\d{2}-\d{8}-\d)/);
  if (cuitOrdenanteMatch) {
    resultado.ordenante.cuit = cuitOrdenanteMatch[1];
  }

  const iibbMatch = textoCompleto.match(/IIBB:\s+([\d.-]+)/);
  if (iibbMatch) {
    resultado.ordenante.iibb = iibbMatch[1];
  }

  // Extraer domicilio beneficiario
  const domBenefMatch = textoCompleto.match(/RN\s+\d+[^|]+?VALLE/);
  if (domBenefMatch) {
    resultado.beneficiario.domicilio = domBenefMatch[0];
  }

  const condIVAMatch = textoCompleto.match(/(EXEN\s+-\s+EXENTO)/);
  if (condIVAMatch) {
    resultado.beneficiario.condicionIVA = condIVAMatch[1];
  }

  const cuitBenef2Match = textoCompleto.match(/CUIT\/CUIL\s+(\d{11})/);
  if (cuitBenef2Match && !resultado.beneficiario.cuit) {
    const cuit = cuitBenef2Match[1];
    resultado.beneficiario.cuit = `${cuit.substr(0,2)}-${cuit.substr(2,8)}-${cuit.substr(10,1)}`;
  }

  return resultado;
}

/**
 * Extrae datos completos del PDF usando pdf2json con analisis por paginas
 */
async function parseTransferenciaPDFCompleto(pdfPath) {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();

    pdfParser.on('pdfParser_dataError', errData => reject(errData.parserError));

    pdfParser.on('pdfParser_dataReady', pdfData => {
      const resultado = {
        tipo: 'TRANSFERENCIA',
        metadata: {
          creator: pdfData.Meta.Creator,
          creationDate: pdfData.Meta.CreationDate,
          totalPaginas: pdfData.Pages.length
        },
        transferencia: {
          titular: null,
          cbu: null,
          numeroOperacion: null,
          fechaHora: null,
          importe: null,
          cuentaOrigen: null,
          banco: null,
          tipoOperacion: null,
          referencia: null
        },
        beneficiario: {
          nombre: null,
          cuit: null,
          domicilio: null,
          condicionIVA: null
        },
        ordenante: {
          nombre: null,
          domicilio: null,
          cuit: null,
          iibb: null
        }
      };

      // Procesar paginas
      pdfData.Pages.forEach((page, pageIndex) => {
        // Agrupar textos por linea
        const lineas = {};
        page.Texts.forEach(item => {
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

        let textoCompleto = '';

        lineasOrdenadas.forEach(y => {
          const textosLinea = lineas[y].sort((a, b) => a.x - b.x);
          const textoLineaCompleto = textosLinea.map(t => t.texto).join(' ');
          textoCompleto += textoLineaCompleto + ' ';

          // Extraer CBU
          if (!resultado.transferencia.cbu) {
            const cbuMatch = textoLineaCompleto.match(/(\d{22})/);
            if (cbuMatch) {
              resultado.transferencia.cbu = cbuMatch[1];
            }
          }

          // Extraer numero de operacion
          if (!resultado.transferencia.numeroOperacion && textoLineaCompleto.includes('Operaci�n')) {
            const numMatch = textoLineaCompleto.match(/(\d{9})/);
            if (numMatch) {
              resultado.transferencia.numeroOperacion = numMatch[1];
            }
          }

          // Extraer fecha y hora
          if (!resultado.transferencia.fechaHora) {
            const fechaMatch = textoLineaCompleto.match(/(\d{1,2}:\d{2}\s+(?:AM|PM)\s+\d{2}\/\d{2}\/\d{4})/);
            if (fechaMatch) {
              resultado.transferencia.fechaHora = fechaMatch[1];
            }
          }

          // Extraer importe
          if (!resultado.transferencia.importe) {
            const importeMatch = textoLineaCompleto.match(/\$\s*([\d,.]+)/);
            if (importeMatch && importeMatch[1].includes(',')) {
              resultado.transferencia.importe = importeMatch[1];
            }
          }

          // Extraer cuenta origen
          if (!resultado.transferencia.cuentaOrigen && textoLineaCompleto.includes('CC')) {
            const cuentaMatch = textoLineaCompleto.match(/CC\s+\$\s+(\d+)/);
            if (cuentaMatch) {
              resultado.transferencia.cuentaOrigen = cuentaMatch[1];
            }
          }

          // Extraer banco
          if (!resultado.transferencia.banco && textoLineaCompleto.includes('Banco')) {
            const bancoMatch = textoLineaCompleto.match(/Banco\s+(\w+)/);
            if (bancoMatch) {
              resultado.transferencia.banco = bancoMatch[1];
            }
          }

          // Extraer tipo operacion
          if (!resultado.transferencia.tipoOperacion && textoLineaCompleto.includes('Tipo de operaci�n')) {
            const tipoMatch = textoLineaCompleto.match(/Tipo de operaci�n\s+(\w+)/);
            if (tipoMatch) {
              resultado.transferencia.tipoOperacion = tipoMatch[1];
            }
          }

          // Extraer referencia
          if (!resultado.transferencia.referencia && textoLineaCompleto.includes('Referencia')) {
            const refMatch = textoLineaCompleto.match(/Referencia\s+(\d+)/);
            if (refMatch) {
              resultado.transferencia.referencia = refMatch[1];
            }
          }

          // Extraer beneficiario
          if (!resultado.beneficiario.nombre && textoLineaCompleto.includes('SINDICATO')) {
            if (textoLineaCompleto.includes('EDUCACION')) {
              resultado.beneficiario.nombre = 'SINDICATO DE DOCENTES DE EDUCACION PUBLICA';
            }
          }

          // Extraer CUIT beneficiario
          if (!resultado.beneficiario.cuit) {
            const cuitMatch = textoLineaCompleto.match(/(?:CUIT\/CUIL|CUIT)\s+(\d{2}[\s-]?\d{8}[\s-]?\d)/);
            if (cuitMatch) {
              const cuit = cuitMatch[1].replace(/[\s-]/g, '');
              resultado.beneficiario.cuit = `${cuit.substr(0,2)}-${cuit.substr(2,8)}-${cuit.substr(10,1)}`;
            }
          }

          // Extraer domicilio beneficiario
          if (!resultado.beneficiario.domicilio && textoLineaCompleto.includes('RN')) {
            const domMatch = textoLineaCompleto.match(/RN\s+\d+[^|]+/);
            if (domMatch) {
              resultado.beneficiario.domicilio = domMatch[0].trim();
            }
          }

          // Extraer condicion IVA
          if (!resultado.beneficiario.condicionIVA && textoLineaCompleto.includes('EXEN')) {
            const ivaMatch = textoLineaCompleto.match(/(EXEN\s+-\s+EXENTO)/);
            if (ivaMatch) {
              resultado.beneficiario.condicionIVA = ivaMatch[1];
            }
          }

          // Extraer ordenante
          if (!resultado.ordenante.nombre && textoLineaCompleto.includes('Ordenante')) {
            const ordMatch = textoLineaCompleto.match(/Ordenante\s+([^|]+)/);
            if (ordMatch) {
              resultado.ordenante.nombre = ordMatch[1].trim();
            }
          }

          // Extraer domicilio ordenante
          if (!resultado.ordenante.domicilio && textoLineaCompleto.includes('Eduardo Madero')) {
            const domOrdMatch = textoLineaCompleto.match(/Av\.\s+Eduardo[^|]+?Buenos Aires/);
            if (domOrdMatch) {
              resultado.ordenante.domicilio = domOrdMatch[0].trim();
            }
          }

          // Extraer CUIT ordenante
          if (!resultado.ordenante.cuit && textoLineaCompleto.includes('IVA RI')) {
            const cuitOrdMatch = textoLineaCompleto.match(/CUIT\s+N�\s+(\d{2}-\d{8}-\d)/);
            if (cuitOrdMatch) {
              resultado.ordenante.cuit = cuitOrdMatch[1];
            }
          }

          // Extraer IIBB
          if (!resultado.ordenante.iibb && textoLineaCompleto.includes('IIBB')) {
            const iibbMatch = textoLineaCompleto.match(/IIBB:\s+([\d.-]+)/);
            if (iibbMatch) {
              resultado.ordenante.iibb = iibbMatch[1];
            }
          }
        });
      });

      resolve(resultado);
    });

    pdfParser.loadPDF(pdfPath);
  });
}

export {
  parseTransferenciaPDF,
  parseTransferenciaPDFCompleto
};
