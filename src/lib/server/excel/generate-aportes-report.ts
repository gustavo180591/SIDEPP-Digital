import * as XLSX from 'xlsx';
import type { ReporteAportesPorPeriodo } from '$lib/db/services/reportService';

interface ExcelReportParams {
  reporte: ReporteAportesPorPeriodo;
  institutionName: string;
  startMonth: string;
  endMonth: string;
}

/**
 * Formatea un mes de 'YYYY-MM' a 'MM/YY'
 */
function formatMonth(mes: string): string {
  const [year, month] = mes.split('-');
  return `${month}/${year.slice(2)}`;
}

/**
 * Genera un archivo Excel con el reporte de aportes por período
 */
export function generateAportesReportExcel(params: ExcelReportParams): Buffer {
  const { reporte, institutionName, startMonth, endMonth } = params;

  // Crear workbook
  const wb = XLSX.utils.book_new();

  // Preparar datos para la hoja principal
  const data: (string | number)[][] = [];

  // Fila de título
  data.push([`Reporte de Aportes - ${institutionName}`]);
  data.push([`Período: ${formatMonth(startMonth)} a ${formatMonth(endMonth)}`]);
  data.push([]); // Fila vacía

  // Cabecera principal
  const headerRow1: (string | number)[] = ['Apellido y Nombre', 'DNI'];
  const headerRow2: (string | number)[] = ['', ''];

  // Agregar columnas de meses
  for (const mes of reporte.mesesOrdenados) {
    headerRow1.push(formatMonth(mes), '');
    headerRow2.push('Tot. Rem.', 'Concepto');
  }

  // Agregar columna de totales
  headerRow1.push('TOTALES', '');
  headerRow2.push('Tot. Rem.', 'Concepto');

  data.push(headerRow1);
  data.push(headerRow2);

  // Datos de afiliados
  for (const afiliado of reporte.afiliados) {
    const row: (string | number)[] = [afiliado.fullName, afiliado.dni || ''];

    let totalRemunerativo = 0;
    let totalConcepto = 0;

    for (const mes of reporte.mesesOrdenados) {
      const aporte = afiliado.meses[mes];
      if (aporte) {
        row.push(aporte.totalRemunerativo, aporte.montoConcepto);
        totalRemunerativo += aporte.totalRemunerativo;
        totalConcepto += aporte.montoConcepto;
      } else {
        row.push('', '');
      }
    }

    // Agregar totales del afiliado
    row.push(totalRemunerativo, totalConcepto);

    data.push(row);
  }

  // Fila de totales generales
  const totalesRow: (string | number)[] = ['TOTALES', ''];
  let grandTotalRemunerativo = 0;
  let grandTotalConcepto = 0;

  for (const mes of reporte.mesesOrdenados) {
    const totales = reporte.totalesPorMes[mes];
    if (totales) {
      totalesRow.push(totales.totalRemunerativo, totales.montoConcepto);
      grandTotalRemunerativo += totales.totalRemunerativo;
      grandTotalConcepto += totales.montoConcepto;
    } else {
      totalesRow.push(0, 0);
    }
  }

  // Agregar gran total
  totalesRow.push(grandTotalRemunerativo, grandTotalConcepto);

  data.push(totalesRow);

  // Crear hoja de cálculo
  const ws = XLSX.utils.aoa_to_sheet(data);

  // Configurar anchos de columna
  const colWidths: { wch: number }[] = [
    { wch: 35 }, // Nombre
    { wch: 12 } // DNI
  ];

  // Anchos para columnas de meses
  for (let i = 0; i < reporte.mesesOrdenados.length + 1; i++) {
    colWidths.push({ wch: 12 }); // Tot. Rem.
    colWidths.push({ wch: 12 }); // Concepto
  }

  ws['!cols'] = colWidths;

  // Merge cells para el título
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: Math.min(5, 2 + reporte.mesesOrdenados.length * 2) } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: Math.min(5, 2 + reporte.mesesOrdenados.length * 2) } }
  ];

  // Merge cells para headers de meses
  let col = 2;
  for (let i = 0; i < reporte.mesesOrdenados.length + 1; i++) {
    ws['!merges'].push({ s: { r: 3, c: col }, e: { r: 3, c: col + 1 } });
    col += 2;
  }

  // Agregar hoja al workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Aportes');

  // Generar buffer
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  return buffer;
}

/**
 * Genera nombre de archivo para el Excel
 */
export function generateExcelFileName(institutionName: string, startMonth: string, endMonth: string): string {
  const sanitizedName = institutionName
    .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 50);

  return `Reporte-Aportes-${sanitizedName}-${startMonth}-a-${endMonth}.xlsx`;
}
