const PDFParser = require('pdf2json');

/**
 * Parsea un PDF de tipo "Listado de Aportes" (TOTALES POR CONCEPTO - PERSONAS)
 * Funcion simple que recibe texto plano
 */
function parseListadoPDF(text, filename) {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line);
  const textoCompleto = lines.join(' ');

  const resultado = {
    tipo: 'LISTADO_APORTES',
    archivo: filename,
    fecha: null,
    pagina: null,
    empresa: {
      nombre: null,
      direccion: null,
      cuit: null
    },
    concepto: null,
    periodo: null,
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

  // Extraer pagina
  const paginaMatch = textoCompleto.match(/Página:\s*(\d+)/);
  if (paginaMatch) {
    resultado.pagina = parseInt(paginaMatch[1]);
  }

  // Extraer concepto
  const conceptoMatch = textoCompleto.match(/Concepto:\s*([^\n]+?)(?=\s+(?:Noviembre|Octubre|Septiembre|Enero|Febrero|Marzo|Abril|Mayo|Junio|Julio|Agosto|Diciembre|Periodo:))/);
  if (conceptoMatch) {
    resultado.concepto = conceptoMatch[1].trim();
  }

  // Extraer periodo
  const periodoMatch = textoCompleto.match(/(Enero|Febrero|Marzo|Abril|Mayo|Junio|Julio|Agosto|Septiembre|Octubre|Noviembre|Diciembre)\s*-\s*(\d{4})/);
  if (periodoMatch) {
    resultado.periodo = `${periodoMatch[1]} ${periodoMatch[2]}`;
  }

  // Extraer datos de la empresa
  const empresaMatch = textoCompleto.match(/(?:Página:\s*\d+\s+)([^0-9]+?)\s+(Ruta[^0-9]+?)\s+(\d{2}-\d{8}-\d)/);
  if (empresaMatch) {
    resultado.empresa.nombre = empresaMatch[1].trim();
    resultado.empresa.direccion = empresaMatch[2].trim();
    resultado.empresa.cuit = empresaMatch[3].trim();
  }

  // Extraer datos de personas
  const personasRegex = /([A-ZÑÁÉÍÓÚ]+(?:\s+[A-ZÑÁÉÍÓÚ]+)+)\s+(\d+)\s+([\d,.]+)\s+([\d,.]+)/g;
  let match;

  while ((match = personasRegex.exec(textoCompleto)) !== null) {
    const nombreCompleto = match[1].trim();
    const cantidadLegajos = parseInt(match[2]);
    const montoConcepto = parseFloat(match[3].replace(',', ''));
    const totalRemunerativo = parseFloat(match[4].replace(',', ''));

    // Validar que no sea un encabezado
    if (nombreCompleto.includes('PERSONAS') || nombreCompleto.includes('CANTIDAD')) {
      continue;
    }

    resultado.personas.push({
      nombre: nombreCompleto,
      cantidadLegajos: cantidadLegajos,
      montoConcepto: montoConcepto,
      totalRemunerativo: totalRemunerativo
    });
  }

  // Extraer totales
  const totalPersonasMatch = textoCompleto.match(/Cantidad de Personas:\s*Totales:\s*(\d+)/);
  if (totalPersonasMatch) {
    resultado.totales.cantidadPersonas = parseInt(totalPersonasMatch[1]);
  }

  const montoTotalMatch = textoCompleto.match(/Totales:\s*\d+\s+([\d,.]+)/);
  if (montoTotalMatch) {
    resultado.totales.montoTotal = parseFloat(montoTotalMatch[1].replace(',', ''));
  }

  return resultado;
}

/**
 * Extrae datos completos del PDF usando pdf2json con analisis por paginas
 */
async function parseListadoPDFCompleto(pdfPath) {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();

    pdfParser.on('pdfParser_dataError', errData => reject(errData.parserError));

    pdfParser.on('pdfParser_dataReady', pdfData => {
      const resultado = {
        tipo: 'LISTADO_APORTES',
        metadata: {
          creator: pdfData.Meta.Creator,
          creationDate: pdfData.Meta.CreationDate,
          totalPaginas: pdfData.Pages.length
        },
        empresa: {
          nombre: null,
          direccion: null,
          cuit: null
        },
        concepto: null,
        periodo: null,
        paginas: []
      };

      // Procesar cada pagina
      pdfData.Pages.forEach((page, pageIndex) => {
        const paginaData = {
          numero: pageIndex + 1,
          fecha: null,
          personas: [],
          totales: {
            cantidadPersonas: 0,
            montoTotal: 0
          }
        };

        // Agrupar textos por linea (coordenada Y)
        const lineas = {};
        page.Texts.forEach(item => {
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
        const filasTabla = [];

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

            // Empresa - buscar patron: Nombre | Direccion | CUIT
            if (!resultado.empresa.nombre) {
              const empresaMatch = textoLineaCompleto.match(/([A-ZÑÁÉÍÓÚ][A-Za-zñáéíóú\s]+?)\s+(Ruta[^|]+?)\s+(\d{2}-\d{8}-\d)/);
              if (empresaMatch) {
                resultado.empresa.nombre = empresaMatch[1].trim();
                resultado.empresa.direccion = empresaMatch[2].trim();
                resultado.empresa.cuit = empresaMatch[3].trim();
              }
            }

            // Concepto - buscar entre "Concepto:" y el mes
            if (!resultado.concepto && textoLineaCompleto.includes('Concepto:')) {
              const conceptoMatch = textoLineaCompleto.match(/Concepto:\s+([^|]+?)\s+(?:Noviembre|Octubre|Septiembre|Enero|Febrero|Marzo|Abril|Mayo|Junio|Julio|Agosto|Diciembre)/);
              if (conceptoMatch) {
                resultado.concepto = conceptoMatch[1].trim();
              }
            }

            // Periodo
            if (!resultado.periodo) {
              const periodoMatch = textoLineaCompleto.match(/(Enero|Febrero|Marzo|Abril|Mayo|Junio|Julio|Agosto|Septiembre|Octubre|Noviembre|Diciembre)\s*-\s*(\d{4})/);
              if (periodoMatch) {
                resultado.periodo = `${periodoMatch[1]} ${periodoMatch[2]}`;
              }
            }
          }

          // Detectar filas de datos - buscar patron NOMBRE | numero | numero.decimal | numero.decimal
          // Buscar todas las ocurrencias en la linea
          const personasRegex = /([A-ZÑÁÉÍÓÚ]+\s+[A-ZÑÁÉÍÓÚ]+(?:\s+[A-ZÑÁÉÍÓÚ]+)?)\s+(\d+)\s+([\d.]+)\s+([\d.]+)/g;
          let personaMatch;

          while ((personaMatch = personasRegex.exec(textoLineaCompleto)) !== null) {
            const nombre = personaMatch[1].trim();

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
              cantidadLegajos: parseInt(personaMatch[2]),
              montoConcepto: parseFloat(personaMatch[3]),
              totalRemunerativo: parseFloat(personaMatch[4])
            });
          }
        });

        // Asignar personas encontradas
        paginaData.personas = filasTabla;

        // Extraer totales de esta pagina
        const totalPersonasMatch = textoCompleto.match(/Cantidad de Personas:\s*Totales:\s*(\d+)/);
        if (totalPersonasMatch) {
          paginaData.totales.cantidadPersonas = parseInt(totalPersonasMatch[1]);
        }

        const montoTotalMatch = textoCompleto.match(/Totales:\s*(\d+)\s+([\d,.]+)/);
        if (montoTotalMatch) {
          paginaData.totales.montoTotal = parseFloat(montoTotalMatch[2].replace(',', ''));
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

module.exports = {
  parseListadoPDF,
  parseListadoPDFCompleto
};
