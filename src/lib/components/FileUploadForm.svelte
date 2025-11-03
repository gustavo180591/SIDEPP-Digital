<script lang="ts">
  import AnalysisTable from './AnalysisTable.svelte';

  let fileInputSueldos: HTMLInputElement | null = null;
  let fileInputFopid: HTMLInputElement | null = null;
  let fileInputAguinaldo: HTMLInputElement | null = null;
  let fileInputTransfer: HTMLInputElement | null = null;
  let uploading = false;
  let uploadingStage: string = '';
  let selectedMonth: string = '';
  let selectedYear: number | string = '';
  let allowOCR: boolean = true;

  // Computed value para selectedPeriod en formato YYYY-MM
  $: selectedPeriod = selectedMonth && selectedYear ? `${selectedYear}-${selectedMonth}` : '';

  // Mostrar input de Aguinaldo solo en Junio (06) o Diciembre (12)
  $: showAguinaldo = selectedMonth === '06' || selectedMonth === '12';
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
  let resultAguinaldo: AnalyzerResult | null = null;
  let resultTransfer: AnalyzerResult | null = null;

  let aportesTotal: number | null = null;
  let transferImporte: number | null = null;
  let totalsMatch: boolean | null = null;
  let errorMessage: string | null = null;
  let personCountWarning: string | null = null;

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

  // Detectar diferencias en cantidad de personas entre archivos
  $: {
    personCountWarning = null;

    const sueldosCount = resultSueldos?.preview?.listado?.tableData?.personas || resultSueldos?.preview?.listado?.count || 0;
    const fopidCount = resultFopid?.preview?.listado?.tableData?.personas || resultFopid?.preview?.listado?.count || 0;
    const aguinaldoCount = resultAguinaldo?.preview?.listado?.tableData?.personas || resultAguinaldo?.preview?.listado?.count || 0;

    // Crear lista de contadores no-cero con sus etiquetas
    const countData: {label: string, count: number}[] = [];
    if (sueldosCount > 0) countData.push({label: 'Sueldos', count: sueldosCount});
    if (fopidCount > 0) countData.push({label: 'FOPID', count: fopidCount});
    if (showAguinaldo && aguinaldoCount > 0) countData.push({label: 'Aguinaldo', count: aguinaldoCount});

    // Verificar si hay diferencias
    if (countData.length > 1) {
      const counts = countData.map(d => d.count);
      const minCount = Math.min(...counts);
      const maxCount = Math.max(...counts);

      if (minCount !== maxCount) {
        const differences = countData
          .map(d => `${d.label}: ${d.count} ${d.count === 1 ? 'persona' : 'personas'}`)
          .join(', ');
        personCountWarning = `Se detectaron diferencias en la cantidad de personas entre archivos. ${differences}`;
      }
    }
  }

  async function onSubmit(e: Event) {
    e.preventDefault();
    errorMessage = null;
    resultSueldos = null;
    resultFopid = null;
    resultAguinaldo = null;
    resultTransfer = null;
    aportesTotal = null;
    transferImporte = null;
    totalsMatch = null;

    const fileSueldos = fileInputSueldos?.files?.[0];
    const fileFopid = fileInputFopid?.files?.[0];
    const fileAguinaldo = fileInputAguinaldo?.files?.[0];
    const fileTransfer = fileInputTransfer?.files?.[0];

    // Validar período (mes y año requeridos)
    if (!selectedMonth || !selectedYear) {
      errorMessage = 'Debes seleccionar el mes y año del período.';
      return;
    }

    // Validar archivos requeridos
    if (!fileSueldos || !fileFopid) {
      errorMessage = 'Debes subir los archivos: Aportes Sueldos y Aportes FOPID.';
      return;
    }

    // Validar aguinaldo si es Junio o Diciembre
    if (showAguinaldo && !fileAguinaldo) {
      errorMessage = 'Debes subir el archivo de Aportes Aguinaldo para Junio o Diciembre.';
      return;
    }

    // Validar transferencia bancaria
    if (!fileTransfer) {
      errorMessage = 'Debes subir el archivo de Transferencia Bancaria.';
      return;
    }

    uploading = true;
    uploadingStage = 'Preparando archivos...';
    try {
      const makeForm = (file: File) => {
        const f = new FormData();
        f.append('file', file);
        if (selectedPeriod) f.append('selectedPeriod', selectedPeriod);
        f.append('allowOCR', String(allowOCR));
        return f;
      };

      // Preparar todas las promesas
      const promises: Promise<Response>[] = [
        fetch('/api/analyzer-pdf-aportes', { method: 'POST', body: makeForm(fileSueldos) }),
        fetch('/api/analyzer-pdf-aportes', { method: 'POST', body: makeForm(fileFopid) }),
        fetch('/api/analyzer-pdf-bank', { method: 'POST', body: makeForm(fileTransfer) })
      ];

      // Agregar Aguinaldo si corresponde
      if (showAguinaldo && fileAguinaldo) {
        promises.splice(2, 0, fetch('/api/analyzer-pdf-aportes', { method: 'POST', body: makeForm(fileAguinaldo) }));
      }

      uploadingStage = `Analizando ${promises.length} archivo${promises.length > 1 ? 's' : ''}...`;
      const responses = await Promise.all(promises);

      uploadingStage = 'Procesando resultados...';
      const dataArray = await Promise.all(responses.map(r => r.json()));

      // Asignar resultados según orden
      let idx = 0;
      resultSueldos = dataArray[idx++];
      resultFopid = dataArray[idx++];
      if (showAguinaldo && fileAguinaldo) {
        resultAguinaldo = dataArray[idx++];
      }
      resultTransfer = dataArray[idx++];

      // Validar errores
      if (!responses[0].ok) {
        throw new Error(resultSueldos?.error || resultSueldos?.message || 'Error en Aportes Sueldos');
      }
      if (!responses[1].ok) {
        throw new Error(resultFopid?.error || resultFopid?.message || 'Error en Aportes FOPID');
      }
      if (showAguinaldo && fileAguinaldo && !responses[2].ok) {
        throw new Error(resultAguinaldo?.error || resultAguinaldo?.message || 'Error en Aportes Aguinaldo');
      }
      const transferResponseIdx = showAguinaldo && fileAguinaldo ? 3 : 2;
      if (!responses[transferResponseIdx].ok) {
        throw new Error(resultTransfer?.error || resultTransfer?.message || 'Error en Transferencia Bancaria');
      }

      // Calcular totales
      uploadingStage = 'Calculando totales y validaciones...';
      const totalSueldos = sumFromResult(resultSueldos);
      const totalFopid = sumFromResult(resultFopid);
      const totalAguinaldo = showAguinaldo ? sumFromResult(resultAguinaldo) : 0;
      aportesTotal = totalSueldos + totalFopid + totalAguinaldo;

      console.log('=== RESUMEN DE TOTALES ===');
      console.log('Total Aportes Sueldos:', totalSueldos);
      console.log('Total Aportes FOPID:', totalFopid);
      if (showAguinaldo) console.log('Total Aportes Aguinaldo:', totalAguinaldo);
      console.log('SUMA TOTAL APORTES:', aportesTotal);

      transferImporte = typeof resultTransfer?.transferAmount === 'number' ? resultTransfer.transferAmount : null;
      console.log('Importe Transferencia Bancaria:', transferImporte);

      if (aportesTotal != null && transferImporte != null) {
        const diferencia = Math.abs(aportesTotal - transferImporte);
        totalsMatch = diferencia < 0.5;
        console.log('Diferencia:', diferencia);
        console.log('¿Coinciden?:', totalsMatch ? 'SÍ' : 'NO');
      }
      console.log('=========================');
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : 'Error desconocido';
    } finally {
      uploading = false;
    }
  }

  function resetForm() {
    // Limpiar resultados
    resultSueldos = null;
    resultFopid = null;
    resultAguinaldo = null;
    resultTransfer = null;

    // Limpiar cálculos
    aportesTotal = null;
    transferImporte = null;
    totalsMatch = null;

    // Limpiar errores y advertencias
    errorMessage = null;
    personCountWarning = null;

    // Resetear estado de carga
    uploading = false;
    uploadingStage = '';

    // Limpiar archivos seleccionados
    if (fileInputSueldos) fileInputSueldos.value = '';
    if (fileInputFopid) fileInputFopid.value = '';
    if (fileInputAguinaldo) fileInputAguinaldo.value = '';
    if (fileInputTransfer) fileInputTransfer.value = '';

    // Scroll al inicio
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
</script>

<form class="bg-white shadow-xl rounded-xl border border-gray-100" on:submit|preventDefault={onSubmit}>
  <div class="p-6 space-y-4">
    <div class="flex items-center gap-3 mb-4">
      <div class="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
        <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
        </svg>
      </div>
      <div>
        <h2 class="text-xl font-bold text-gray-900">Analizador de PDF</h2>
        <p class="text-sm text-gray-600">Sube un PDF y lo clasificamos como comprobante o listado.</p>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div>
        <label for="period" class="mb-1 block text-sm font-medium text-gray-700">Mes/Año <span class="text-red-500">*</span></label>
        <div class="grid grid-cols-2 gap-2">
          <select
            id="month"
            bind:value={selectedMonth}
            required
            class="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          >
            <option value="">Seleccionar mes</option>
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
          <select
            id="year"
            bind:value={selectedYear}
            required
            class="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          >
            <option value="">Seleccionar año</option>
            {#each Array.from({ length: 31 }, (_, i) => 2010 + i) as year}
              <option value={year}>{year}</option>
            {/each}
          </select>
        </div>
      </div>
      <div></div>
    </div>

    <div class="flex flex-col gap-4">
      <div>
        <label for="pdf-sueldos" class="mb-1 block text-sm font-medium text-gray-700">Aportes Sueldos (PDF) <span class="text-red-500">*</span></label>
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
        <label for="pdf-fopid" class="mb-1 block text-sm font-medium text-gray-700">Aportes FOPID (PDF) <span class="text-red-500">*</span></label>
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
      {#if showAguinaldo}
        <div>
          <label for="pdf-aguinaldo" class="mb-1 block text-sm font-medium text-gray-700">
            Aportes Aguinaldo (PDF) <span class="text-red-500">*</span>
            <span class="text-xs text-gray-500">(Solo Junio/Diciembre)</span>
          </label>
          <input
            id="pdf-aguinaldo"
            bind:this={fileInputAguinaldo}
            type="file"
            accept="application/pdf"
            class="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:cursor-not-allowed disabled:bg-gray-100"
            disabled={uploading}
            required
          />
        </div>
      {/if}
      <div>
        <label for="pdf-transfer" class="mb-1 block text-sm font-medium text-gray-700">Transferencia Bancaria (PDF) <span class="text-red-500">*</span></label>
        <input
          id="pdf-transfer"
          bind:this={fileInputTransfer}
          type="file"
          accept="application/pdf"
          class="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:cursor-not-allowed disabled:bg-gray-100"
          disabled={uploading}
          required
        />
      </div>
    </div>

    <div class="flex items-center gap-2">
      <input id="allowocr" type="checkbox" bind:checked={allowOCR} class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
      <label for="allowocr" class="text-sm text-gray-700">Permitir OCR si es necesario</label>
    </div>

    <div class="flex justify-end pt-4 border-t border-gray-200">
      <button class="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100" disabled={uploading}>
        {#if uploading}
          <svg class="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {uploadingStage || 'Subiendo...'}
        {:else}
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
          </svg>
          Subir y analizar
        {/if}
      </button>
    </div>

    {#if errorMessage}
      <div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
        <div class="flex items-center gap-2">
          <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <span>{errorMessage}</span>
        </div>
      </div>

      <!-- Botón de Reset después de error -->
      <div class="mt-4 flex justify-center">
        <button
          type="button"
          on:click={resetForm}
          class="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-green-600 to-emerald-600 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500/50"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
          </svg>
          Intentar Nuevamente
        </button>
      </div>
    {/if}

      {#if resultSueldos || resultFopid || resultAguinaldo || resultTransfer}
      <div class="my-4 border-t border-gray-200 pt-4"></div>

      <!-- Card de Resumen Ejecutivo -->
      <div class="mb-6 rounded-xl border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 shadow-lg p-6">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
            </svg>
          </div>
          <div>
            <h3 class="text-xl font-bold text-green-900">Procesamiento Exitoso</h3>
            <p class="text-sm text-green-700">Todos los archivos fueron analizados correctamente</p>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <!-- Columna Izquierda -->
          <div class="space-y-3">
            {#if resultSueldos?.preview?.listado?.tableData?.institucion || resultTransfer?.preview?.listado?.tableData?.institucion}
              <div class="flex items-start gap-2">
                <svg class="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
                </svg>
                <div class="flex-1">
                  <p class="text-xs font-medium text-gray-600">Institución</p>
                  <p class="text-sm font-semibold text-gray-900">
                    {resultSueldos?.preview?.listado?.tableData?.institucion?.nombre || resultTransfer?.preview?.listado?.tableData?.institucion?.nombre || 'No detectada'}
                  </p>
                  {#if resultSueldos?.preview?.listado?.tableData?.institucion?.cuit || resultTransfer?.preview?.listado?.tableData?.institucion?.cuit}
                    <p class="text-xs text-gray-500">
                      CUIT: {resultSueldos?.preview?.listado?.tableData?.institucion?.cuit || resultTransfer?.preview?.listado?.tableData?.institucion?.cuit}
                    </p>
                  {/if}
                </div>
              </div>
            {/if}

            <div class="flex items-start gap-2">
              <svg class="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
              </svg>
              <div class="flex-1">
                <p class="text-xs font-medium text-gray-600">Período</p>
                <p class="text-sm font-semibold text-gray-900">
                  {selectedMonth && selectedYear ? `${['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][parseInt(selectedMonth)-1]} ${selectedYear}` : 'No especificado'}
                </p>
              </div>
            </div>

            <div class="flex items-start gap-2">
              <svg class="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
              </svg>
              <div class="flex-1">
                <p class="text-xs font-medium text-gray-600">Personas Procesadas</p>
                <p class="text-sm font-semibold text-gray-900">
                  {resultSueldos?.preview?.listado?.tableData?.personas || resultSueldos?.preview?.listado?.count || 0}
                </p>
              </div>
            </div>
          </div>

          <!-- Columna Derecha -->
          <div class="space-y-3">
            <div class="flex items-start gap-2">
              <svg class="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <div class="flex-1">
                <p class="text-xs font-medium text-gray-600">Total Aportes</p>
                <p class="text-lg font-bold text-green-700">
                  {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(aportesTotal || 0)}
                </p>
              </div>
            </div>

            <div class="flex items-start gap-2">
              <svg class="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path>
              </svg>
              <div class="flex-1">
                <p class="text-xs font-medium text-gray-600">Transferencia Bancaria</p>
                <p class="text-lg font-bold text-green-700">
                  {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(transferImporte || 0)}
                </p>
              </div>
            </div>

            <div class="flex items-start gap-2">
              {#if totalsMatch}
                <svg class="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              {:else}
                <svg class="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              {/if}
              <div class="flex-1">
                <p class="text-xs font-medium text-gray-600">Estado de Validación</p>
                {#if totalsMatch}
                  <p class="text-sm font-semibold text-green-700">✅ Totales Coinciden</p>
                {:else}
                  <p class="text-sm font-semibold text-red-700">❌ Discrepancia Detectada</p>
                  <p class="text-xs text-red-600">
                    Diferencia: {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Math.abs((aportesTotal || 0) - (transferImporte || 0)))}
                  </p>
                {/if}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Alerta de diferencias en cantidad de personas -->
      {#if personCountWarning}
        <div class="mb-6 rounded-xl border-2 border-yellow-300 bg-gradient-to-br from-yellow-50 to-amber-50 shadow-md p-5">
          <div class="flex items-start gap-3">
            <div class="w-10 h-10 bg-yellow-500 rounded-full flex items-center justify-center flex-shrink-0">
              <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
              </svg>
            </div>
            <div class="flex-1">
              <h4 class="text-base font-bold text-yellow-900 mb-1">Atención: Diferencias Detectadas</h4>
              <p class="text-sm text-yellow-800">{personCountWarning}</p>
              <p class="text-xs text-yellow-700 mt-2">
                Esto podría indicar que hay personas nuevas, personas que salieron, o inconsistencias en los archivos. Revise cuidadosamente las tablas abajo.
              </p>
            </div>
          </div>
        </div>
      {/if}

      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
        {#if resultSueldos}
          <div class="rounded-lg border border-gray-200 bg-white shadow-sm p-4 hover:shadow-md transition-shadow">
            <div class="text-sm font-semibold text-gray-600 mb-2">Aportes Sueldos</div>
            <div class="mt-1 text-base font-medium text-gray-900 truncate max-w-[22rem]" title={resultSueldos.fileName}>{resultSueldos.fileName}</div>
            <div class="mt-1 text-sm text-gray-500">{(resultSueldos.size / 1024).toFixed(1)} KB</div>
          </div>
        {/if}
        {#if resultFopid}
          <div class="rounded-lg border border-gray-200 bg-white shadow-sm p-4 hover:shadow-md transition-shadow">
            <div class="text-sm font-semibold text-gray-600 mb-2">Aportes FOPID</div>
            <div class="mt-1 text-base font-medium text-gray-900 truncate max-w-[22rem]" title={resultFopid.fileName}>{resultFopid.fileName}</div>
            <div class="mt-1 text-sm text-gray-500">{(resultFopid.size / 1024).toFixed(1)} KB</div>
          </div>
        {/if}
        {#if resultAguinaldo}
          <div class="rounded-lg border border-gray-200 bg-white shadow-sm p-4 hover:shadow-md transition-shadow">
            <div class="text-sm font-semibold text-gray-600 mb-2">Aportes Aguinaldo</div>
            <div class="mt-1 text-base font-medium text-gray-900 truncate max-w-[22rem]" title={resultAguinaldo.fileName}>{resultAguinaldo.fileName}</div>
            <div class="mt-1 text-sm text-gray-500">{(resultAguinaldo.size / 1024).toFixed(1)} KB</div>
          </div>
        {/if}
        {#if resultTransfer}
          <div class="rounded-lg border border-gray-200 bg-white shadow-sm p-4 hover:shadow-md transition-shadow">
            <div class="text-sm font-semibold text-gray-600 mb-2">Transferencia Bancaria</div>
            <div class="mt-1 text-base font-medium text-gray-900 truncate max-w-[22rem]" title={resultTransfer.fileName}>{resultTransfer.fileName}</div>
            <div class="mt-1 text-sm text-gray-500">{(resultTransfer.size / 1024).toFixed(1)} KB</div>
          </div>
        {/if}
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
      {#if resultAguinaldo?.preview?.listado}
        <div class="mt-4">
          <AnalysisTable
            title="TOTALES POR CONCEPTO - PERSONAS (AGUINALDO)"
            concept="Aguinaldo"
            personas={resultAguinaldo.preview.listado.personas || []}
            tableData={resultAguinaldo.preview.listado.tableData}
          />
        </div>
      {/if}

      {#if aportesTotal != null || transferImporte != null}
        <div class="mt-6 border-t border-gray-200 pt-4">
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div class="rounded-lg border border-gray-200 bg-white shadow-sm p-6">
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
              {#if resultAguinaldo}
                <div class="flex justify-between items-center">
                  <span class="text-gray-600">Aportes Aguinaldo:</span>
                  <span class="font-medium">{new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(sumFromResult(resultAguinaldo))}</span>
                </div>
              {/if}
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
            <div class="rounded-lg border border-gray-200 bg-white shadow-sm p-6">
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

          <!-- Botón de Reset -->
          <div class="mt-6 pt-4 border-t border-gray-200 flex justify-center">
            <button
              type="button"
              on:click={resetForm}
              class="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-green-600 to-emerald-600 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500/50"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
              </svg>
              Nuevo Análisis
            </button>
          </div>
        </div>
      {/if}
    {/if}
  </div>
</form>


