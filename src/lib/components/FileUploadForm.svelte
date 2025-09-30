<script lang="ts">
  import AnalysisTable from './AnalysisTable.svelte';

  let fileInput: HTMLInputElement | null = null;
  let uploading = false;
  let selectedPeriod: string = '';
  let allowOCR: boolean = true;
  type Checks = {
    sumTotal?: number;
    declaredTotal?: number | null;
    totalMatches?: boolean;
    detectedPeriod?: { month?: number | null; year?: number | null; raw?: string | null };
    selectedPeriod?: { month?: number | null; year?: number | null } | null;
    periodMatches?: boolean | null;
  };

  let result: null | {
    fileName: string;
    savedName: string;
    savedPath: string;
    size: number;
    mimeType: string;
    status: string;
    classification?: 'comprobante' | 'listado' | 'desconocido';
    needsOCR?: boolean;
    preview?: {
      listado?: {
        count: number;
        total: number;
        rows: Array<{ lineNumber: number; cuit?: string; fecha?: string; importe?: string; nombre?: string }>;
        tableData?: {
          personas?: number;
          totalRemunerativo?: number;
          cantidadLegajos?: number;
          montoConcepto?: number;
        };
        personas?: Array<{
          nombre: string;
          totRemunerativo: number;
          cantidadLegajos: number;
          montoConcepto: number;
        }>;
      };
    };
    checks?: Checks;
  } = null;
  let errorMessage: string | null = null;

  async function onSubmit(e: Event) {
    e.preventDefault();
    errorMessage = null;
    result = null;
    const file = fileInput?.files?.[0];
    if (!file) {
      errorMessage = 'Selecciona un archivo PDF.';
      return;
    }
    uploading = true;
    try {
      const form = new FormData();
      form.append('file', file);
      if (selectedPeriod) {
        form.append('selectedPeriod', selectedPeriod);
      }
      form.append('allowOCR', String(allowOCR));
      const res = await fetch('/api/analyzer-pdf', {
        method: 'POST',
        body: form
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Error al subir el archivo');
      }
      result = data;
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : 'Error desconocido';
    } finally {
      uploading = false;
    }
  }
</script>

<form class="rounded-lg border border-gray-200 bg-white shadow-md" on:submit|preventDefault={onSubmit}>
  <div class="p-6 space-y-4">
    <h2 class="text-lg font-semibold">Analizador de PDF</h2>
    <p class="text-sm text-gray-600">Sube un PDF y lo clasificamos como comprobante o listado.</p>

    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div>
        <label for="period" class="mb-1 block text-sm font-medium text-gray-700">Mes/Año</label>
        <input
          id="period"
          type="month"
          bind:value={selectedPeriod}
          class="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        />
      </div>
      <div>
        <label for="pdf" class="mb-1 block text-sm font-medium text-gray-700">Archivo PDF</label>
      <input
          id="pdf"
        bind:this={fileInput}
        type="file"
        accept="application/pdf"
        class="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:cursor-not-allowed disabled:bg-gray-100"
        disabled={uploading}
      />
      </div>
    </div>

    <div class="flex items-center gap-2">
      <input id="allowocr" type="checkbox" bind:checked={allowOCR} class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
      <label for="allowocr" class="text-sm text-gray-700">Permitir OCR si es necesario</label>
    </div>

    <div class="flex justify-end">
      <button class="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed" disabled={uploading}>
        {#if uploading}
          Subiendo...
        {:else}
          Subir y analizar
        {/if}
      </button>
    </div>

    {#if errorMessage}
      <div class="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        <span>{errorMessage}</span>
      </div>
    {/if}

    {#if result}
      <div class="my-2 border-t border-gray-200"></div>
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div class="text-sm text-gray-500">Archivo</div>
          <div class="mt-1 text-base font-medium truncate max-w-[22rem]" title={result.fileName}>{result.fileName}</div>
          <div class="mt-1 text-sm text-gray-500">{(result.size / 1024).toFixed(1)} KB</div>
        </div>
        <div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div class="text-sm text-gray-500">Clasificación</div>
          <div class="mt-1 text-base font-medium">
            {#if result.classification === 'comprobante'}
              <span class="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">Comprobante</span>
            {:else if result.classification === 'listado'}
              <span class="inline-flex items-center rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-medium text-sky-800">Listado</span>
            {:else}
              <span class="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">Desconocido</span>
            {/if}
          </div>
          {#if result.needsOCR}
            <div class="mt-1 text-sm text-gray-500">Se intentará OCR</div>
          {/if}
        </div>
        <div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div class="text-sm text-gray-500">Estado</div>
          <div class="mt-1 text-base font-medium">
            <span class="inline-flex items-center rounded-full border border-gray-300 px-2.5 py-0.5 text-xs font-medium text-gray-700">{result.status}</span>
          </div>
          <div class="mt-1 text-sm text-gray-500">{result.mimeType}</div>
        </div>
      </div>
      {#if result.preview?.listado}
        <div class="mt-4">
          <AnalysisTable
            title="TOTALES POR CONCEPTO - PERSONAS"
            concept="Apte. Sindical SIDEPP (1%)"
            personas={result.preview.listado.personas || []}
            tableData={result.preview.listado.tableData}
          />
        </div>
      {/if}
      {#if result.checks}
        <div class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div class="rounded-lg border border-gray-200 bg-white p-4">
            <div class="text-sm text-gray-500">Comparación de totales</div>
            <div class="mt-2 text-sm">
              <div>Calculado: <span class="font-medium">{new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(result.checks.sumTotal || 0)}</span></div>
              <div>Declarado en PDF: <span class="font-medium">{result.checks.declaredTotal == null ? '—' : new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(result.checks.declaredTotal)}</span></div>
              <div class="mt-2">Coincide: 
                {#if result.checks.totalMatches}
                  <span class="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">Sí</span>
                {:else}
                  <span class="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">No</span>
                {/if}
              </div>
            </div>
          </div>
          <div class="rounded-lg border border-gray-200 bg-white p-4">
            <div class="text-sm text-gray-500">Comparación de período</div>
            <div class="mt-2 text-sm">
              <div>Detectado en PDF: <span class="font-medium">{result.checks.detectedPeriod?.raw || `${result.checks.detectedPeriod?.month ?? '—'}/${result.checks.detectedPeriod?.year ?? '—'}`}</span></div>
              <div>Seleccionado: <span class="font-medium">{result.checks.selectedPeriod ? `${result.checks.selectedPeriod.month?.toString().padStart(2,'0')}/${result.checks.selectedPeriod.year}` : '—'}</span></div>
              <div class="mt-2">Coincide: 
                {#if result.checks.periodMatches}
                  <span class="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">Sí</span>
                {:else}
                  <span class="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">No</span>
          {/if}
        </div>
          </div>
        </div>
      </div>
      {/if}
    {/if}
  </div>
</form>


