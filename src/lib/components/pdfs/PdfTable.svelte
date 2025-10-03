<script lang="ts">
  import { DataTable } from '$lib/components/shared';
  import type { PdfFileWithPeriod } from '$lib/db/services/pdfService';
  
  export let pdfs: PdfFileWithPeriod[];
  export let pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
  };
  export let buildUrl: (filters: Record<string, string>) => string;
  export let goto: (url: string) => void;
  export let onView: (pdf: PdfFileWithPeriod) => void;
  export let loading: boolean = false;

  const columns = [
    {
      key: 'fileName',
      label: 'Archivo',
      render: (pdf: PdfFileWithPeriod) => `
        <div class="flex items-center gap-3">
          <div class="flex-shrink-0">
            <svg class="w-8 h-8 text-red-500" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clip-rule="evenodd"></path>
            </svg>
          </div>
          <div>
            <div class="font-medium text-gray-900">${pdf.fileName}</div>
            <div class="text-sm text-gray-500">
              Subido: ${new Date(pdf.createdAt).toLocaleDateString('es-AR')}
            </div>
          </div>
        </div>
      `
    },
    {
      key: 'period',
      label: 'Período',
      render: (pdf: PdfFileWithPeriod) => `
        <div class="text-sm">
          <div class="font-medium text-gray-900">
            ${pdf.period.month.toString().padStart(2, '0')}/${pdf.period.year}
          </div>
          <div class="text-gray-500">
            ${pdf.period.concept || 'Sin concepto'}
          </div>
        </div>
      `
    },

    
    {
      key: 'transfer',
      label: 'Transferencia',
      render: (pdf: PdfFileWithPeriod) => {
        if (pdf.period.transfer) {
          return `
            <div class="text-sm">
              <div class="font-medium text-green-600">Completada</div>
              <div class="text-gray-500">
                ${pdf.period.transfer.operationNo || 'Sin número'}
              </div>
            </div>
          `;
        }
        return '<span class="badge badge-warning">Pendiente</span>';
      }
    },
    {
      key: 'status',
      label: 'Estado',
      render: (pdf: PdfFileWithPeriod) => {
        const hasTransfer = !!pdf.period.transfer;
        return `
          <span class="badge ${hasTransfer ? 'badge-success' : 'badge-warning'}">
            ${hasTransfer ? 'Procesado' : 'Pendiente'}
          </span>
        `;
      }
    }
  ];

  const actions = [
    {
      label: 'Ver Detalles',
      icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
      color: 'btn-info',
      onClick: onView
    }
  ];

  const emptyState = {
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    title: 'No hay comprobantes',
    description: 'No se han cargado comprobantes para esta institución',
    action: null
  };
</script>

<DataTable 
  data={pdfs}
  {columns}
  {actions}
  {emptyState}
  {pagination}
  {buildUrl}
  {goto}
  {loading}
/>
