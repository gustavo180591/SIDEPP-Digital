import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import type { ReporteAportesPorPeriodo } from '$lib/db/services/reportService';

interface GeneratePdfOptions {
  reporte: ReporteAportesPorPeriodo;
  institutionName: string;
  startMonth: string;
  endMonth: string;
}

/**
 * Genera un PDF con el reporte de aportes por período
 */
export async function generateAportesReportPdf(
  options: GeneratePdfOptions
): Promise<Uint8Array> {
  const { reporte, institutionName, startMonth, endMonth } = options;

  // Crear documento PDF
  const pdfDoc = await PDFDocument.create();

  // Cargar fuentes
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Configuración de página
  const pageWidth = 842; // A4 landscape
  const pageHeight = 595;
  const margin = 40;
  const fontSize = 8;
  const headerFontSize = 12;
  const lineHeight = 12;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let yPosition = pageHeight - margin;

  // Título
  const title = `Reporte de Aportes - ${institutionName}`;
  const subtitle = `Período: ${startMonth} a ${endMonth}`;

  page.drawText(title, {
    x: margin,
    y: yPosition,
    size: headerFontSize,
    font: fontBold,
    color: rgb(0, 0, 0)
  });

  yPosition -= 20;

  page.drawText(subtitle, {
    x: margin,
    y: yPosition,
    size: 10,
    font: font,
    color: rgb(0.3, 0.3, 0.3)
  });

  yPosition -= 30;

  // Calcular anchos de columnas
  const { mesesOrdenados } = reporte;
  const numMeses = mesesOrdenados.length;

  // Columnas fijas
  const colNombreCompleto = 140;
  const colDni = 70;
  const fixedColsWidth = colNombreCompleto + colDni;

  // Columnas dinámicas (2 por mes: concepto y total rem)
  // Usar ancho fijo compacto en lugar de distribuir el espacio disponible
  const colMonthWidth = 50; // Ancho fijo para cada sub-columna
  const colPadding = 1; // Padding interno mínimo
  const colMonthGroupWidth = colMonthWidth * 2; // Ancho total del grupo de 2 columnas por mes

  // Función auxiliar para dibujar texto centrado
  const drawCenteredText = (
    text: string,
    x: number,
    y: number,
    width: number,
    size: number,
    textFont: typeof font
  ) => {
    const textWidth = textFont.widthOfTextAtSize(text, size);
    const centeredX = x + (width - textWidth) / 2;
    page.drawText(text, {
      x: Math.max(x, centeredX),
      y,
      size,
      font: textFont,
      color: rgb(0, 0, 0)
    });
  };

  // Función para dibujar texto alineado a la derecha con padding mínimo
  const drawRightAlignedText = (
    text: string,
    x: number,
    y: number,
    width: number,
    size: number,
    textFont: typeof font
  ) => {
    const textWidth = textFont.widthOfTextAtSize(text, size);
    const alignedX = x + width - textWidth - colPadding;
    page.drawText(text, {
      x: Math.max(x + colPadding, alignedX),
      y,
      size,
      font: textFont,
      color: rgb(0, 0, 0)
    });
  };

  // Función para truncar texto
  const truncateText = (text: string, maxWidth: number, size: number): string => {
    const textWidth = font.widthOfTextAtSize(text, size);
    if (textWidth <= maxWidth) return text;

    let truncated = text;
    while (font.widthOfTextAtSize(truncated + '...', size) > maxWidth && truncated.length > 0) {
      truncated = truncated.slice(0, -1);
    }
    return truncated + '...';
  };

  // Dibujar encabezados de tabla
  let xPosition = margin;

  // Headers fijos
  drawCenteredText('Apellido y Nombre', xPosition, yPosition, colNombreCompleto, fontSize, fontBold);
  xPosition += colNombreCompleto;

  drawCenteredText('DNI', xPosition, yPosition, colDni, fontSize, fontBold);
  xPosition += colDni;

  // Headers de meses - Primera fila: mes
  let xPosMes = margin + fixedColsWidth;
  for (const mes of mesesOrdenados) {
    const [year, month] = mes.split('-');
    const mesLabel = `${month}/${year.slice(2)}`;

    // Dibujar mes abarcando las 2 columnas
    drawCenteredText(mesLabel, xPosMes, yPosition + 10, colMonthGroupWidth, fontSize, fontBold);
    xPosMes += colMonthGroupWidth;
  }

  // Headers de meses - Segunda fila: Tot. Rem. y Concepto
  xPosition = margin + fixedColsWidth;
  for (const mes of mesesOrdenados) {
    // Total Rem
    drawCenteredText('Tot. Rem.', xPosition, yPosition, colMonthWidth, fontSize - 1, fontBold);
    xPosition += colMonthWidth;

    // Concepto
    drawCenteredText('Concepto', xPosition, yPosition, colMonthWidth, fontSize - 1, fontBold);
    xPosition += colMonthWidth;
  }

  // Línea debajo de headers
  yPosition -= 15;
  page.drawLine({
    start: { x: margin, y: yPosition },
    end: { x: pageWidth - margin, y: yPosition },
    thickness: 1,
    color: rgb(0, 0, 0)
  });

  yPosition -= lineHeight;

  // Función para crear nueva página si es necesario
  const checkNewPage = () => {
    if (yPosition < margin + 30) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      yPosition = pageHeight - margin;

      // Redibujar headers en nueva página
      let xPos = margin;
      drawCenteredText('Apellido y Nombre', xPos, yPosition, colNombreCompleto, fontSize, fontBold);
      xPos += colNombreCompleto;
      drawCenteredText('DNI', xPos, yPosition, colDni, fontSize, fontBold);
      xPos += colDni;

      // Headers de meses - Primera fila: mes
      let xPosMesNew = margin + fixedColsWidth;
      for (const mes of mesesOrdenados) {
        const [year, month] = mes.split('-');
        const mesLabel = `${month}/${year.slice(2)}`;

        // Dibujar mes abarcando las 2 columnas
        drawCenteredText(mesLabel, xPosMesNew, yPosition + 10, colMonthGroupWidth, fontSize, fontBold);
        xPosMesNew += colMonthGroupWidth;
      }

      // Headers de meses - Segunda fila: Tot. Rem. y Concepto
      xPos = margin + fixedColsWidth;
      for (const mes of mesesOrdenados) {
        drawCenteredText('Tot. Rem.', xPos, yPosition, colMonthWidth, fontSize - 1, fontBold);
        xPos += colMonthWidth;
        drawCenteredText('Concepto', xPos, yPosition, colMonthWidth, fontSize - 1, fontBold);
        xPos += colMonthWidth;
      }

      yPosition -= 15;
      page.drawLine({
        start: { x: margin, y: yPosition },
        end: { x: pageWidth - margin, y: yPosition },
        thickness: 1,
        color: rgb(0, 0, 0)
      });
      yPosition -= lineHeight;
    }
  };

  // Dibujar filas de afiliados
  for (const afiliado of reporte.afiliados) {
    checkNewPage();

    xPosition = margin;

    // Apellido y Nombre
    const nombreCompletoText = truncateText(afiliado.fullName, colNombreCompleto - 5, fontSize);
    page.drawText(nombreCompletoText, {
      x: xPosition + 2,
      y: yPosition,
      size: fontSize,
      font: font,
      color: rgb(0, 0, 0)
    });
    xPosition += colNombreCompleto;

    // DNI
    drawCenteredText(afiliado.dni || '-', xPosition, yPosition, colDni, fontSize, font);
    xPosition += colDni;

    // Montos por mes
    for (const mes of mesesOrdenados) {
      const aporte = afiliado.meses[mes];

      if (aporte) {
        // Total Rem
        const totalRemText = aporte.totalRemunerativo.toFixed(2);
        drawRightAlignedText(totalRemText, xPosition, yPosition, colMonthWidth, fontSize, font);
        xPosition += colMonthWidth;

        // Concepto
        const conceptoText = aporte.montoConcepto.toFixed(2);
        drawRightAlignedText(conceptoText, xPosition, yPosition, colMonthWidth, fontSize, font);
        xPosition += colMonthWidth;
      } else {
        // Sin datos
        drawCenteredText('-', xPosition, yPosition, colMonthWidth, fontSize, font);
        xPosition += colMonthWidth;
        drawCenteredText('-', xPosition, yPosition, colMonthWidth, fontSize, font);
        xPosition += colMonthWidth;
      }
    }

    yPosition -= lineHeight;
  }

  // Línea antes de totales
  yPosition -= 5;
  page.drawLine({
    start: { x: margin, y: yPosition },
    end: { x: pageWidth - margin, y: yPosition },
    thickness: 1,
    color: rgb(0, 0, 0)
  });

  yPosition -= lineHeight;
  checkNewPage();

  // Fila de totales
  xPosition = margin;

  page.drawText('TOTALES', {
    x: xPosition + 2,
    y: yPosition,
    size: fontSize,
    font: fontBold,
    color: rgb(0, 0, 0)
  });
  xPosition += colNombreCompleto + colDni;

  for (const mes of mesesOrdenados) {
    const totales = reporte.totalesPorMes[mes];

    if (totales) {
      // Total Rem
      const totalRemText = totales.totalRemunerativo.toFixed(2);
      drawRightAlignedText(totalRemText, xPosition, yPosition, colMonthWidth, fontSize, fontBold);
      xPosition += colMonthWidth;

      // Total Concepto
      const totalConceptoText = totales.montoConcepto.toFixed(2);
      drawRightAlignedText(totalConceptoText, xPosition, yPosition, colMonthWidth, fontSize, fontBold);
      xPosition += colMonthWidth;
    } else {
      drawCenteredText('-', xPosition, yPosition, colMonthWidth, fontSize, fontBold);
      xPosition += colMonthWidth;
      drawCenteredText('-', xPosition, yPosition, colMonthWidth, fontSize, fontBold);
      xPosition += colMonthWidth;
    }
  }

  // Agregar footer con fecha de generación
  const now = new Date();
  const footer = `Generado el ${now.toLocaleDateString('es-AR')} a las ${now.toLocaleTimeString('es-AR')}`;

  const pages = pdfDoc.getPages();
  for (let i = 0; i < pages.length; i++) {
    const currentPage = pages[i];
    currentPage.drawText(footer, {
      x: margin,
      y: 20,
      size: 7,
      font: font,
      color: rgb(0.5, 0.5, 0.5)
    });

    currentPage.drawText(`Página ${i + 1} de ${pages.length}`, {
      x: pageWidth - margin - 60,
      y: 20,
      size: 7,
      font: font,
      color: rgb(0.5, 0.5, 0.5)
    });
  }

  // Generar PDF
  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}

/**
 * Genera el nombre del archivo PDF
 */
export function generatePdfFileName(institutionName: string, startMonth: string, endMonth: string): string {
  const sanitizedName = institutionName
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

  return `reporte-${sanitizedName}-${startMonth}-a-${endMonth}.pdf`;
}
