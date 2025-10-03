<script lang="ts">
  import AnalysisTable from './AnalysisTable.svelte';

  let fileInputSueldos: HTMLInputElement | null = null;
  let fileInputFopid: HTMLInputElement | null = null;
  // let fileInputTransfer: HTMLInputElement | null = null; // TEMPORAL: Comentado para testing
  let uploading = false;
  let selectedMonth: string = '';
  let selectedYear: number | string = '';
  let allowOCR: boolean = true;

  // Computed value para selectedPeriod en formato YYYY-MM
  $: selectedPeriod = selectedMonth && selectedYear ? `${selectedYear}-${selectedMonth}` : '';
  type Checks = {
    sumTotal?: number;
    declaredTotal?: number | null;
    totalMatches?: boolean;
    detectedPeriod?: { month?: number | null; year?: number | null; raw?: string | null };
    selectedPeriod?: { month?: number | null; year?: number | null } | null;
    periodMatches?: boolean | null;
  };

  type AnalyzerResult = {
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
    transferAmount?: number | null;
  };

  let resultSueldos: AnalyzerResult | null = null;
  let resultFopid: AnalyzerResult | null = null;
  // let resultTransfer: AnalyzerResult | null = null; // TEMPORAL: Comentado para testing

  let aportesTotal: number | null = null;
  let transferImporte: number | null = null;
  let totalsMatch: boolean | null = null;
  let errorMessage: string | null = null;

  const sumFromResult = (r: AnalyzerResult | null): number => {
    if (!r) return 0;
    
    // PRIORIDAD 1: Usar tableData.montoConcepto si existe (total de la tabla de TOTALES)
    const tableAmount = r.preview?.listado?.tableData?.montoConcepto;
    if (typeof tableAmount === 'number' && Number.isFinite(tableAmount) && tableAmount > 0) {
      console.log('Usando tableData.montoConcepto:', tableAmount);
      return tableAmount;
    }
    
    // PRIORIDAD 2: Sumar desde el array de personas si existe
    const personas = r.preview?.listado?.personas || [];
    if (Array.isArray(personas) && personas.length > 0) {
      const total = personas.reduce((acc, p) => acc + (Number.isFinite(p.montoConcepto) ? p.montoConcepto : 0), 0);
      if (total > 0) {
        console.log('Sumando desde personas:', total, '(', personas.length, 'personas)');
        return total;
      }
    }
    
    // PRIORIDAD 3: Usar checks.sumTotal como fallback
    const checksTotal = r.checks?.sumTotal;
    if (typeof checksTotal === 'number' && Number.isFinite(checksTotal) && checksTotal > 0) {
      console.log('Usando checks.sumTotal:', checksTotal);
      return checksTotal;
    }
    
    console.warn('No se pudo extraer monto del concepto del resultado');
    return 0;
  };

  async function onSubmit(e: Event) {
    e.preventDefault();
    errorMessage = null;
    resultSueldos = null;
    resultFopid = null;
    // resultTransfer = null; // TEMPORAL: Comentado para testing
    aportesTotal = null;
    transferImporte = null;
    totalsMatch = null;

    const fileSueldos = fileInputSueldos?.files?.[0];
    const fileFopid = fileInputFopid?.files?.[0];
    // const fileTransfer = fileInputTransfer?.files?.[0]; // TEMPORAL: Comentado para testing

    // TEMPORAL: Solo validar los dos archivos de aportes
    if (!fileSueldos || !fileFopid) {
      errorMessage = 'Debes subir los dos archivos: Aportes Sueldos y Aportes FOPID.';
      return;
    }
    uploading = true;
    try {
      const makeForm = (file: File) => {
        const f = new FormData();
        f.append('file', file);
        if (selectedPeriod) f.append('selectedPeriod', selectedPeriod);
        f.append('allowOCR', String(allowOCR));
        return f;
      };

      // TEMPORAL: Solo procesar los dos archivos de aportes
      const [resSueldos, resFopid] = await Promise.all([
        fetch('/api/analyzer-pdf-aportes', { method: 'POST', body: makeForm(fileSueldos) }),
        fetch('/api/analyzer-pdf-aportes', { method: 'POST', body: makeForm(fileFopid) })
      ]);

      const [dataSueldos, dataFopid] = await Promise.all([
        resSueldos.json(),
        resFopid.json()
      ]);

      if (!resSueldos.ok) {
        console.error('Error en Aportes Sueldos:', dataSueldos);
        throw new Error(dataSueldos?.error || dataSueldos?.message || `Error en Aportes Sueldos (${resSueldos.status})`);
      }
      if (!resFopid.ok) {
        console.error('Error en Aportes FOPID:', dataFopid);
        throw new Error(dataFopid?.error || dataFopid?.message || `Error en Aportes FOPID (${resFopid.status})`);
      }

      resultSueldos = dataSueldos;
      resultFopid = dataFopid;
      // resultTransfer = dataTransfer; // TEMPORAL: Comentado para testing

      const totalSueldos = sumFromResult(resultSueldos);
      const totalFopid = sumFromResult(resultFopid);
      aportesTotal = totalSueldos + totalFopid;

      console.log('=== RESUMEN DE TOTALES ===');
      console.log('Total Aportes Sueldos:', totalSueldos);
      console.log('Total Aportes FOPID:', totalFopid);
      console.log('SUMA TOTAL APORTES:', aportesTotal);
      console.log('=========================')

      // TEMPORAL: Comentado para testing
      // transferImporte = typeof dataTransfer?.transferAmount === 'number' ? dataTransfer.transferAmount : null;
      // console.log('Importe Transferencia Bancaria:', transferImporte);
      // 
      // if (aportesTotal != null && transferImporte != null) {
      //   const diferencia = Math.abs(aportesTotal - transferImporte);
      //   totalsMatch = diferencia < 0.5;
      //   console.log('Diferencia:', diferencia);
      //   console.log('¿Coinciden?:', totalsMatch ? 'SÍ' : 'NO');
      // }
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
        <div class="grid grid-cols-2 gap-2">
          <select
            id="month"
            bind:value={selectedMonth}
            class="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          >
            <option value="">Mes</option>
            <option value="01">Enero</option>
            <option value="02">Febrero</option>
            <option value="03">Marzo</option>
            <option value="04">Abril</option>
            <option value="05">Mayo</option>
            <option value="06">Junio</option>
            <option value="07">Julio</option>
            <option value="08">Agosto</option>
            <option value="09">Septiembre</option>
            <option value="10">Octubre</option>
            <option value="11">Noviembre</option>
            <option value="12">Diciembre</option>
          </select>
          <input
            id="year"
            type="number"
            placeholder="Año"
            bind:value={selectedYear}
            min="2000"
            max="2099"
            class="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        </div>
      </div>
      <div></div>
    </div>

    <div class="flex flex-col gap-4">
      <div>
        <label for="pdf-sueldos" class="mb-1 block text-sm font-medium text-gray-700">Aportes Sueldos (PDF)</label>
        <input
          id="pdf-sueldos"
          bind:this={fileInputSueldos}
          type="file"
          accept="application/pdf"
          class="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:cursor-not-allowed disabled:bg-gray-100"
          disabled={uploading}
          required
        />
      </div>
      <div>
        <label for="pdf-fopid" class="mb-1 block text-sm font-medium text-gray-700">Aportes FOPID (PDF)</label>
        <input
          id="pdf-fopid"
          bind:this={fileInputFopid}
          type="file"
          accept="application/pdf"
          class="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:cursor-not-allowed disabled:bg-gray-100"
          disabled={uploading}
          required
        />
      </div>
      <!--        TEMPORAL: Comentado para testing 
      <!-- <div>
        <label for="pdf-transfer" class="mb-1 block text-sm font-medium text-gray-700">Transferencia bancaria (PDF)</label>
        <input
          id="pdf-transfer"
          bind:this={fileInputTransfer}
          type="file"
          accept="application/pdf"
          class="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:cursor-not-allowed disabled:bg-gray-100"
          disabled={uploading}
          required
        />
      </div> --> 
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

    {#if resultSueldos || resultFopid}
      <div class="my-2 border-t border-gray-200"></div>
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {#if resultSueldos}
          <div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div class="text-sm text-gray-500">Aportes Sueldos</div>
            <div class="mt-1 text-base font-medium truncate max-w-[22rem]" title={resultSueldos.fileName}>{resultSueldos.fileName}</div>
            <div class="mt-1 text-sm text-gray-500">{(resultSueldos.size / 1024).toFixed(1)} KB</div>
          </div>
        {/if}
        {#if resultFopid}
          <div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div class="text-sm text-gray-500">Aportes FOPID</div>
            <div class="mt-1 text-base font-medium truncate max-w-[22rem]" title={resultFopid.fileName}>{resultFopid.fileName}</div>
            <div class="mt-1 text-sm text-gray-500">{(resultFopid.size / 1024).toFixed(1)} KB</div>
          </div>
        {/if}
        <!-- TEMPORAL: Comentado para testing -->
        <!-- {#if resultTransfer}
          <div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div class="text-sm text-gray-500">Transferencia bancaria</div>
            <div class="mt-1 text-base font-medium truncate max-w-[22rem]" title={resultTransfer.fileName}>{resultTransfer.fileName}</div>
            <div class="mt-1 text-sm text-gray-500">{(resultTransfer.size / 1024).toFixed(1)} KB</div>
          </div>
        {/if} -->
      </div>

      {#if resultSueldos?.preview?.listado}
        <div class="mt-4">
          <AnalysisTable
            title="TOTALES POR CONCEPTO - PERSONAS"
            concept="Apte. Sindical SIDEPP (1%)"
            personas={resultSueldos.preview.listado.personas || []}
            tableData={resultSueldos.preview.listado.tableData}
          />
        </div>
      {/if}
      {#if resultFopid?.preview?.listado}
        <div class="mt-4">
          <AnalysisTable
            title="TOTALES POR CONCEPTO - PERSONAS (FOPID)"
            concept="FOPID"
            personas={resultFopid.preview.listado.personas || []}
            tableData={resultFopid.preview.listado.tableData}
          />
        </div>
      {/if}

      {#if aportesTotal != null || transferImporte != null}
        <div class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div class="rounded-lg border border-gray-200 bg-white p-4">
            <div class="text-sm font-semibold text-gray-700 mb-2">Comparación de Totales</div>
            <div class="mt-2 text-sm space-y-2">
              <div class="flex justify-between items-center">
                <span class="text-gray-600">Aportes Sueldos:</span>
                <span class="font-medium">{new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(sumFromResult(resultSueldos))}</span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-gray-600">Aportes FOPID:</span>
                <span class="font-medium">{new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(sumFromResult(resultFopid))}</span>
              </div>
              <div class="border-t border-gray-200 pt-2 flex justify-between items-center">
                <span class="text-gray-700 font-medium">Total Aportes:</span>
                <span class="font-semibold text-lg">{new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(aportesTotal ?? 0)}</span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-gray-700 font-medium">Transferencia Bancaria:</span>
                <span class="font-semibold text-lg">{transferImporte == null ? '—' : new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(transferImporte)}</span>
              </div>
              {#if totalsMatch !== null}
                <div class="mt-3 pt-2 border-t border-gray-200">
                  <div class="flex justify-between items-center">
                    <span class="text-gray-700 font-medium">Estado:</span>
                    {#if totalsMatch}
                      <span class="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-800">✓ Coinciden</span>
                    {:else}
                      <span class="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-sm font-semibold text-red-800">✗ No coinciden</span>
                    {/if}
                  </div>
                  {#if !totalsMatch}
                    <div class="mt-2 text-sm text-red-700 bg-red-50 p-2 rounded">
                      <span class="font-medium">Diferencia:</span> {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Math.abs((aportesTotal || 0) - (transferImporte || 0)))}
                    </div>
                  {/if}
                </div>
              {/if}
            </div>
          </div>
          {#if resultSueldos?.checks}
            <div class="rounded-lg border border-gray-200 bg-white p-4">
              <div class="text-sm text-gray-500">Comparación de período</div>
              <div class="mt-2 text-sm">
                <div>Detectado en PDF: <span class="font-medium">{resultSueldos.checks.detectedPeriod?.raw || `${resultSueldos.checks.detectedPeriod?.month ?? '—'}/${resultSueldos.checks.detectedPeriod?.year ?? '—'}`}</span></div>
                <div>Seleccionado: <span class="font-medium">{resultSueldos.checks.selectedPeriod ? `${resultSueldos.checks.selectedPeriod.month?.toString().padStart(2,'0')}/${resultSueldos.checks.selectedPeriod.year}` : '—'}</span></div>
                <div class="mt-2">Coincide: 
                  {#if resultSueldos.checks.periodMatches}
                    <span class="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">Sí</span>
                  {:else}
                    <span class="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">No</span>
                  {/if}
                </div>
              </div>
            </div>
          {/if}
        </div>
      {/if}
    {/if}
  </div>
</form>


