import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import type { Member, Institution } from '@prisma/client';

interface MemberWithInstitution extends Member {
  institucion: Institution | null;
}

interface GenerateMembersListPdfOptions {
  members: MemberWithInstitution[];
}

/**
 * Genera un PDF con el listado completo de afiliados
 */
export async function generateMembersListPdf(
  options: GenerateMembersListPdfOptions
): Promise<Uint8Array> {
  const { members } = options;

  // Crear documento PDF
  const pdfDoc = await PDFDocument.create();

  // Cargar fuentes
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Configuración de página
  const pageWidth = 595; // A4 portrait
  const pageHeight = 842;
  const margin = 40;
  const fontSize = 10;
  const headerFontSize = 14;
  const lineHeight = 16;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let yPosition = pageHeight - margin;

  // Función para sanitizar texto (remover caracteres no soportados por PDF)
  const sanitizeText = (text: string): string => {
    // Reemplazar caracteres especiales con equivalentes ASCII
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remover acentos
      .replace(/[^\x00-\x7F]/g, '') // Remover caracteres no ASCII
      .replace(/[�]/g, ''); // Remover caracteres de reemplazo
  };

  // Título
  const title = sanitizeText('Listado Completo de Afiliados');
  const subtitle = sanitizeText(`Total: ${members.length} afiliados`);

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
    size: 11,
    font: font,
    color: rgb(0.3, 0.3, 0.3)
  });

  yPosition -= 30;

  // Calcular anchos de columnas
  const colOrden = 80;
  const colMatricula = 80;
  const colNombre = 200;
  const colInstitucion = 150;
  const colDni = 80;
  const colNacionalidad = 100;
  const colEstado = 60;
  const colFechaIngreso = 90;

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

  // Función para truncar texto
  const truncateText = (text: string, maxWidth: number, size: number): string => {
    const sanitizedText = sanitizeText(text);
    const textWidth = font.widthOfTextAtSize(sanitizedText, size);
    if (textWidth <= maxWidth) return sanitizedText;

    let truncated = sanitizedText;
    while (font.widthOfTextAtSize(truncated + '...', size) > maxWidth && truncated.length > 0) {
      truncated = truncated.slice(0, -1);
    }
    return truncated + '...';
  };

  // Dibujar encabezados de tabla
  let xPosition = margin;

  drawCenteredText('Nro. Orden', xPosition, yPosition, colOrden, fontSize, fontBold);
  xPosition += colOrden;

  drawCenteredText('Nro. Matricula', xPosition, yPosition, colMatricula, fontSize, fontBold);
  xPosition += colMatricula;

  drawCenteredText('Nombre y Apellido', xPosition, yPosition, colNombre, fontSize, fontBold);
  xPosition += colNombre;

  drawCenteredText('Institución', xPosition, yPosition, colInstitucion, fontSize, fontBold);
  xPosition += colInstitucion;

  drawCenteredText('DNI', xPosition, yPosition, colDni, fontSize, fontBold);
  xPosition += colDni;

  drawCenteredText('Nacionalidad', xPosition, yPosition, colNacionalidad, fontSize, fontBold);
  xPosition += colNacionalidad;

  drawCenteredText('Estado', xPosition, yPosition, colEstado, fontSize, fontBold);
  xPosition += colEstado;

  drawCenteredText('Fecha Ingreso', xPosition, yPosition, colFechaIngreso, fontSize, fontBold);

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
      drawCenteredText('Nro. Orden', xPos, yPosition, colOrden, fontSize, fontBold);
      xPos += colOrden;
      drawCenteredText('Nro. Matricula', xPos, yPosition, colMatricula, fontSize, fontBold);
      xPos += colMatricula;
      drawCenteredText('Nombre y Apellido', xPos, yPosition, colNombre, fontSize, fontBold);
      xPos += colNombre;
      drawCenteredText('Institución', xPos, yPosition, colInstitucion, fontSize, fontBold);
      xPos += colInstitucion;
      drawCenteredText('DNI', xPos, yPosition, colDni, fontSize, fontBold);
      xPos += colDni;
      drawCenteredText('Nacionalidad', xPos, yPosition, colNacionalidad, fontSize, fontBold);
      xPos += colNacionalidad;
      drawCenteredText('Estado', xPos, yPosition, colEstado, fontSize, fontBold);
      xPos += colEstado;
      drawCenteredText('Fecha Ingreso', xPos, yPosition, colFechaIngreso, fontSize, fontBold);

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
  for (const member of members) {
    checkNewPage();

    xPosition = margin;

    // Nro. Orden
    drawCenteredText(sanitizeText(member.numeroOrden || '-'), xPosition, yPosition, colOrden, fontSize, font);
    xPosition += colOrden;

    // Nro. Matricula
    drawCenteredText(sanitizeText(member.numeroMatricula || '-'), xPosition, yPosition, colMatricula, fontSize, font);
    xPosition += colMatricula;

    // Nombre
    const nombreText = truncateText(member.fullName || '-', colNombre - 5, fontSize);
    page.drawText(nombreText, {
      x: xPosition + 2,
      y: yPosition,
      size: fontSize,
      font: font,
      color: rgb(0, 0, 0)
    });
    xPosition += colNombre;

    // Institución
    const institucionText = truncateText(member.institucion?.name || 'Sin institucion', colInstitucion - 5, fontSize);
    page.drawText(institucionText, {
      x: xPosition + 2,
      y: yPosition,
      size: fontSize,
      font: font,
      color: rgb(0, 0, 0)
    });
    xPosition += colInstitucion;

    // DNI
    drawCenteredText(sanitizeText(member.documentoIdentidad || '-'), xPosition, yPosition, colDni, fontSize, font);
    xPosition += colDni;

    // Nacionalidad
    const nacionalidadText = truncateText(member.nacionalidad || '-', colNacionalidad - 5, fontSize);
    page.drawText(nacionalidadText, {
      x: xPosition + 2,
      y: yPosition,
      size: fontSize,
      font: font,
      color: rgb(0, 0, 0)
    });
    xPosition += colNacionalidad;

    // Estado
    const estadoText = member.status === 'active' ? 'Activo' : 'Inactivo';
    const estadoColor = member.status === 'active' ? rgb(0, 0.5, 0) : rgb(0.8, 0.5, 0);
    page.drawText(estadoText, {
      x: xPosition,
      y: yPosition,
      size: fontSize,
      font: font,
      color: estadoColor
    });
    xPosition += colEstado;

    // Fecha de Ingreso
    const fechaIngresoText = member.createdAt
      ? new Date(member.createdAt).toLocaleDateString('es-AR')
      : '-';
    drawCenteredText(sanitizeText(fechaIngresoText), xPosition, yPosition, colFechaIngreso, fontSize, font);

    yPosition -= lineHeight;
  }

  // Agregar footer con fecha de generación
  const now = new Date();
  const footer = sanitizeText(`Generado el ${now.toLocaleDateString('es-AR')} a las ${now.toLocaleTimeString('es-AR')}`);

  const pages = pdfDoc.getPages();
  for (let i = 0; i < pages.length; i++) {
    const currentPage = pages[i];
    currentPage.drawText(footer, {
      x: margin,
      y: 20,
      size: 8,
      font: font,
      color: rgb(0.5, 0.5, 0.5)
    });

    currentPage.drawText(sanitizeText(`Pagina ${i + 1} de ${pages.length}`), {
      x: pageWidth - margin - 80,
      y: 20,
      size: 8,
      font: font,
      color: rgb(0.5, 0.5, 0.5)
    });
  }

  // Generar PDF
  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}
