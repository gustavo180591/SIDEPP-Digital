import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
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

  // Cargar logo SIDEPP
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const logoPath = join(__dirname, '../../../../static/IsoLogoSIDEPP.jpg');
  const logoImageBytes = readFileSync(logoPath);
  const logoImage = await pdfDoc.embedJpg(logoImageBytes);
  const logoScale = 0.075; // 400% más pequeño que 0.3

  // Configuración de página
  const pageWidth = 842; // A4 landscape
  const pageHeight = 595;
  const margin = 40;
  const fontSize = 9;
  const headerFontSize = 14;
  const lineHeight = 14;

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

  // Título al principio
  const title = sanitizeText('Listado Completo de Afiliados');
  const subtitle = sanitizeText(`Total: ${members.length} afiliados`);

  page.drawText(title, {
    x: margin,
    y: yPosition - 5,
    size: headerFontSize,
    font: fontBold,
    color: rgb(0, 0, 0)
  });

  page.drawText(subtitle, {
    x: margin,
    y: yPosition - 25,
    size: 11,
    font: font,
    color: rgb(0.3, 0.3, 0.3)
  });

  // Dibujar logo pequeño al lado del texto
  const logoDims = logoImage.scale(logoScale);
  const titleWidth = fontBold.widthOfTextAtSize(title, headerFontSize);
  page.drawImage(logoImage, {
    x: margin + titleWidth + 20,
    y: yPosition - logoDims.height - 5,
    width: logoDims.width,
    height: logoDims.height
  });

  yPosition -= 50;

  // Calcular anchos de columnas
  const colOrden = 70;
  const colMatricula = 70;
  const colNombre = 180;
  const colInstitucion = 140;
  const colDni = 70;
  const colNacionalidad = 90;
  const colEstado = 60;
  const colCuotas = 80;

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

  drawCenteredText('Cuotas Pagadas', xPosition, yPosition, colCuotas, fontSize, fontBold);

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
      drawCenteredText('Cuotas Pagadas', xPos, yPosition, colCuotas, fontSize, fontBold);

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

    // Cuotas Pagadas (mostrar conteo de meses pagados en el año actual)
    const currentYear = new Date().getFullYear();
    const cuotasPagadas = member.createdAt && new Date(member.createdAt).getFullYear() === currentYear
      ? Math.floor((new Date().getTime() - new Date(member.createdAt).getTime()) / (1000 * 60 * 60 * 24 * 30)) + 1
      : '-';
    drawCenteredText(sanitizeText(String(cuotasPagadas)), xPosition, yPosition, colCuotas, fontSize, font);

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
