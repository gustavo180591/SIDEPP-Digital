<script lang="ts">
  import AnalysisTable from './AnalysisTable.svelte';
  import SearchableSelect from './shared/SearchableSelect.svelte';

  // Props
  export let institutions: Array<{ id: string; name: string | null }> = [];

  // Opciones para los selects de mes y año
  const monthOptions = [
    { value: '01', label: 'Enero' },
    { value: '02', label: 'Febrero' },
    { value: '03', label: 'Marzo' },
    { value: '04', label: 'Abril' },
    { value: '05', label: 'Mayo' },
    { value: '06', label: 'Junio' },
    { value: '07', label: 'Julio' },
    { value: '08', label: 'Agosto' },
    { value: '09', label: 'Septiembre' },
    { value: '10', label: 'Octubre' },
    { value: '11', label: 'Noviembre' },
    { value: '12', label: 'Diciembre' }
  ];

  const yearOptions = Array.from({ length: 31 }, (_, i) => ({
    value: String(2010 + i),
    label: String(2010 + i)
  }));

  // Opciones de instituciones reactivas
  $: institutionOptions = institutions.map((inst) => ({
    value: inst.id,
    label: inst.name || 'Sin nombre'
  }));

  // ============================================================================
  // ESTADO DEL FORMULARIO - NUEVO FLUJO DE 2 PASOS
  // ============================================================================

  type UploadState = 'idle' | 'analyzing' | 'preview' | 'confirming' | 'success' | 'error';

  let state: UploadState = 'idle';
  let stageMessage: string = '';

  let fileInputSueldos: HTMLInputElement | null = null;
  let fileInputFopid: HTMLInputElement | null = null;
  let fileInputAguinaldo: HTMLInputElement | null = null;
  let fileInputTransfer: HTMLInputElement | null = null;

  let selectedMonth: string = '';
  let selectedYear: string = '';
  let selectedInstitutionId: string = '';

  // Auto-seleccionar institución si solo hay una
  $: if (institutions.length === 1 && !selectedInstitutionId) {
    selectedInstitutionId = institutions[0].id;
  }

  // Computed value para selectedPeriod en formato YYYY-MM
  $: selectedPeriod = selectedMonth && selectedYear ? `${selectedYear}-${selectedMonth}` : '';

  // Mostrar input de Aguinaldo solo en Junio (06) o Diciembre (12)
  $: showAguinaldo = selectedMonth === '06' || selectedMonth === '12';

  // ============================================================================
  // TIPOS PARA EL NUEVO FLUJO
  // ============================================================================

  type PreviewResult = {
    success: boolean;
    type?: 'APORTES' | 'TRANSFERENCIA';
    fileName?: string;
    bufferHash?: string;
    bufferBase64?: string;
    isDuplicate?: boolean;
    duplicateInfo?: { pdfFileId: string; existingFileName: string };
    analysis?: any;
    institution?: { id: string; name: string | null; cuit: string | null } | null;
    peopleCount?: number;
    totalAmount?: number;
    conceptType?: 'FOPID' | 'SUELDO' | 'DESCONOCIDO';
    transferAmount?: number;
    isMultiple?: boolean;
    transferCount?: number;
    error?: string;
    details?: string;
  };

  type BatchPreviewResult = {
    sessionId: string;
    previews: {
      sueldos?: PreviewResult;
      fopid?: PreviewResult;
      aguinaldo?: PreviewResult;
      transferencia?: PreviewResult;
    };
    validation: {
      totalAportes: number;
      totalTransferencia: number;
      diferencia: number;
      coinciden: boolean;
      porcentajeDiferencia: number;
      warnings: string[];
    };
    allFilesValid: boolean;
  };

  type BatchSaveResult = {
    success: boolean;
    error?: string;
    periodId: string | null;
    savedFiles: {
      sueldos?: { pdfFileId: string; contributionLineCount: number };
      fopid?: { pdfFileId: string; contributionLineCount: number };
      aguinaldo?: { pdfFileId: string; contributionLineCount: number };
      transferencia?: { pdfFileId: string; bankTransferId: string };
    };
  };

  // ============================================================================
  // RESULTADOS
  // ============================================================================

  let previewResult: BatchPreviewResult | null = null;
  let saveResult: BatchSaveResult | null = null;
  let errorMessage: string | null = null;
  let personCountWarning: string | null = null;

  // Detectar diferencias en cantidad de personas entre archivos
  $: {
    personCountWarning = null;

    if (previewResult?.previews) {
      const sueldosCount = (previewResult.previews.sueldos as any)?.peopleCount || 0;
      const fopidCount = (previewResult.previews.fopid as any)?.peopleCount || 0;
      const aguinaldoCount = (previewResult.previews.aguinaldo as any)?.peopleCount || 0;

      const countData: {label: string, count: number}[] = [];
      if (sueldosCount > 0) countData.push({label: 'Sueldos', count: sueldosCount});
      if (fopidCount > 0) countData.push({label: 'FOPID', count: fopidCount});
      if (showAguinaldo && aguinaldoCount > 0) countData.push({label: 'Aguinaldo', count: aguinaldoCount});

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
  }

  // ============================================================================
  // FUNCIONES PRINCIPALES
  // ============================================================================

  /**
   * PASO 1: Analizar archivos (sin guardar)
   */
  async function analyzeFiles(e: Event) {
    e.preventDefault();
    errorMessage = null;
    previewResult = null;
    saveResult = null;

    const fileSueldos = fileInputSueldos?.files?.[0];
    const fileFopid = fileInputFopid?.files?.[0];
    const fileAguinaldo = fileInputAguinaldo?.files?.[0];
    const fileTransfer = fileInputTransfer?.files?.[0];

    // Validaciones
    if (!selectedMonth || !selectedYear) {
      errorMessage = 'Debes seleccionar el mes y año del período.';
      return;
    }

    if (!selectedInstitutionId) {
      errorMessage = 'Debes seleccionar una institución.';
      return;
    }

    if (!fileSueldos || !fileFopid) {
      errorMessage = 'Debes subir los archivos: Aportes Sueldos y Aportes FOPID.';
      return;
    }

    if (showAguinaldo && !fileAguinaldo) {
      errorMessage = 'Debes subir el archivo de Aportes Aguinaldo para Junio o Diciembre.';
      return;
    }

    if (!fileTransfer) {
      errorMessage = 'Debes subir el archivo de Transferencia Bancaria.';
      return;
    }

    state = 'analyzing';
    stageMessage = 'Preparando archivos para análisis...';

    try {
      const formData = new FormData();
      formData.append('files', fileSueldos);
      formData.append('files', fileFopid);
      if (showAguinaldo && fileAguinaldo) {
        formData.append('files', fileAguinaldo);
      }
      formData.append('files', fileTransfer);
      formData.append('selectedPeriod', selectedPeriod);
      formData.append('institutionId', selectedInstitutionId);

      stageMessage = 'Analizando archivos con IA...';

      const response = await fetch('/api/analyzer-pdf-preview', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Error al analizar los archivos');
      }

      previewResult = data;
      state = 'preview';

      console.log('=== PREVIEW RESULT ===');
      console.log('Session ID:', previewResult?.sessionId);
      console.log('Validation:', previewResult?.validation);
      console.log('=====================');

    } catch (err) {
      state = 'error';
      errorMessage = err instanceof Error ? err.message : 'Error desconocido';
    }
  }

  /**
   * PASO 2: Confirmar y guardar
   */
  async function confirmAndSave() {
    if (!previewResult) return;

    state = 'confirming';
    stageMessage = 'Guardando archivos...';

    try {
      // Obtener la institución detectada de los previews
      let detectedInstitutionId = selectedInstitutionId;
      for (const preview of Object.values(previewResult.previews)) {
        if (preview && preview.success && preview.institution) {
          detectedInstitutionId = preview.institution.id;
          break;
        }
      }

      const response = await fetch('/api/analyzer-pdf-confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionId: previewResult.sessionId,
          selectedPeriod: {
            month: parseInt(selectedMonth),
            year: parseInt(selectedYear)
          },
          institutionId: detectedInstitutionId,
          previews: previewResult.previews,
          forceConfirm: !previewResult.validation.coinciden
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || data.message || 'Error al guardar los archivos');
      }

      saveResult = data;
      state = 'success';

      console.log('=== SAVE RESULT ===');
      console.log('Period ID:', saveResult?.periodId);
      console.log('Saved Files:', saveResult?.savedFiles);
      console.log('==================');

    } catch (err) {
      state = 'error';
      errorMessage = err instanceof Error ? err.message : 'Error desconocido';
    }
  }

  /**
   * Cancelar y volver al inicio
   */
  function cancelPreview() {
    state = 'idle';
    previewResult = null;
    errorMessage = null;
  }

  /**
   * Resetear todo el formulario
   */
  function resetForm() {
    state = 'idle';
    stageMessage = '';
    previewResult = null;
    saveResult = null;
    errorMessage = null;
    personCountWarning = null;

    if (fileInputSueldos) fileInputSueldos.value = '';
    if (fileInputFopid) fileInputFopid.value = '';
    if (fileInputAguinaldo) fileInputAguinaldo.value = '';
    if (fileInputTransfer) fileInputTransfer.value = '';

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Helper para formatear moneda
  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(amount);
  }

  // Helper para obtener nombre de mes
  function getMonthName(month: string): string {
    const months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    return months[parseInt(month) - 1] || month;
  }
</script>

<form class="bg-white shadow-xl rounded-xl border border-gray-100" on:submit|preventDefault={analyzeFiles}>
  <div class="p-6 space-y-4">
    <!-- Header -->
    <div class="flex items-center gap-3 mb-4">
      <div class="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
        <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
        </svg>
      </div>
      <div>
        <h2 class="text-xl font-bold text-gray-900">Analizador de PDF</h2>
        <p class="text-sm text-gray-600">
          {#if state === 'idle'}
            Sube los archivos para analizarlos antes de guardar.
          {:else if state === 'analyzing'}
            Analizando archivos...
          {:else if state === 'preview'}
            Revisa el análisis y confirma para guardar.
          {:else if state === 'confirming'}
            Guardando archivos...
          {:else if state === 'success'}
            ¡Archivos guardados exitosamente!
          {:else if state === 'error'}
            Error en el procesamiento.
          {/if}
        </p>
      </div>
    </div>

    <!-- ========== ESTADO: IDLE - Formulario de selección ========== -->
    {#if state === 'idle' || state === 'analyzing'}
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label for="period" class="mb-1 block text-sm font-medium text-gray-700">Mes/Año <span class="text-red-500">*</span></label>
          <div class="grid grid-cols-2 gap-2">
            <SearchableSelect
              options={monthOptions}
              bind:value={selectedMonth}
              placeholder="Buscar mes..."
              required
              name="month"
              disabled={state === 'analyzing'}
            />
            <SearchableSelect
              options={yearOptions}
              bind:value={selectedYear}
              placeholder="Buscar año..."
              required
              name="year"
              disabled={state === 'analyzing'}
            />
          </div>
        </div>
        <div>
          <label for="institution" class="mb-1 block text-sm font-medium text-gray-700">Institución <span class="text-red-500">*</span></label>
          <SearchableSelect
            options={institutionOptions}
            bind:value={selectedInstitutionId}
            placeholder={institutions.length === 0 ? 'No hay instituciones asignadas' : 'Buscar institución...'}
            required
            disabled={institutions.length <= 1 || state === 'analyzing'}
            name="institution"
          />
          {#if institutions.length === 1}
            <p class="mt-1 text-xs text-gray-500">Institución asignada automáticamente</p>
          {/if}
        </div>
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
            disabled={state === 'analyzing'}
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
            disabled={state === 'analyzing'}
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
              disabled={state === 'analyzing'}
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
            disabled={state === 'analyzing'}
            required
          />
        </div>
      </div>

      <div class="flex justify-end pt-4 border-t border-gray-200">
        <button
          type="submit"
          class="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          disabled={state === 'analyzing'}
        >
          {#if state === 'analyzing'}
            <svg class="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            {stageMessage || 'Analizando...'}
          {:else}
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
            Analizar Archivos
          {/if}
        </button>
      </div>
    {/if}

    <!-- ========== ESTADO: PREVIEW - Mostrar resultados del análisis ========== -->
    {#if state === 'preview' && previewResult}
      <div class="my-4 border-t border-gray-200 pt-4"></div>

      <!-- Alerta de Error Bloqueante (si hay archivos con error) -->
      {#if !previewResult.allFilesValid}
        <div class="mb-6 rounded-xl border-2 border-red-300 bg-gradient-to-br from-red-50 to-rose-50 shadow-lg p-6">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0">
              <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </div>
            <div>
              <h3 class="text-xl font-bold text-red-900">Error: No se puede guardar</h3>
              <p class="text-sm text-red-700">
                Uno o más archivos tienen errores de análisis. Revisa los archivos marcados en rojo abajo y vuelve a subirlos.
              </p>
            </div>
          </div>
        </div>
      {/if}

      <!-- Card de Resumen del Preview -->
      <div class="mb-6 rounded-xl border-2 {!previewResult.allFilesValid ? 'border-red-200 bg-gradient-to-br from-red-50/50 to-rose-50/50' : previewResult.validation.coinciden ? 'border-green-200 bg-gradient-to-br from-green-50 to-emerald-50' : 'border-yellow-200 bg-gradient-to-br from-yellow-50 to-amber-50'} shadow-lg p-6">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-12 h-12 {!previewResult.allFilesValid ? 'bg-red-500' : previewResult.validation.coinciden ? 'bg-green-500' : 'bg-yellow-500'} rounded-full flex items-center justify-center">
            {#if !previewResult.allFilesValid}
              <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            {:else if previewResult.validation.coinciden}
              <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
              </svg>
            {:else}
              <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
              </svg>
            {/if}
          </div>
          <div>
            <h3 class="text-xl font-bold {!previewResult.allFilesValid ? 'text-red-900' : previewResult.validation.coinciden ? 'text-green-900' : 'text-yellow-900'}">
              {#if !previewResult.allFilesValid}
                Análisis con Errores
              {:else if previewResult.validation.coinciden}
                Análisis Exitoso
              {:else}
                Atención: Diferencias Detectadas
              {/if}
            </h3>
            <p class="text-sm {!previewResult.allFilesValid ? 'text-red-700' : previewResult.validation.coinciden ? 'text-green-700' : 'text-yellow-700'}">
              {#if !previewResult.allFilesValid}
                Revisa los archivos con error antes de continuar.
              {:else if previewResult.validation.coinciden}
                Los totales coinciden. Puede confirmar para guardar.
              {:else}
                Diferencia de {formatCurrency(previewResult.validation.diferencia)}
              {/if}
            </p>
          </div>
        </div>

        <!-- Warnings -->
        {#if previewResult.validation.warnings.length > 0}
          <div class="mb-4 p-3 bg-yellow-100 rounded-lg border border-yellow-300">
            <p class="text-sm font-medium text-yellow-800 mb-1">Advertencias:</p>
            <ul class="text-sm text-yellow-700 list-disc list-inside">
              {#each previewResult.validation.warnings as warning}
                <li>{warning}</li>
              {/each}
            </ul>
          </div>
        {/if}

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <!-- Columna Izquierda -->
          <div class="space-y-3">
            <div class="flex items-start gap-2">
              <svg class="w-5 h-5 text-gray-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
              </svg>
              <div class="flex-1">
                <p class="text-xs font-medium text-gray-600">Período</p>
                <p class="text-sm font-semibold text-gray-900">
                  {getMonthName(selectedMonth)} {selectedYear}
                </p>
              </div>
            </div>

            <div class="flex items-start gap-2">
              <svg class="w-5 h-5 text-gray-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <div class="flex-1">
                <p class="text-xs font-medium text-gray-600">Total Aportes</p>
                <p class="text-lg font-bold text-gray-900">
                  {formatCurrency(previewResult.validation.totalAportes)}
                </p>
              </div>
            </div>
          </div>

          <!-- Columna Derecha -->
          <div class="space-y-3">
            <div class="flex items-start gap-2">
              <svg class="w-5 h-5 text-gray-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path>
              </svg>
              <div class="flex-1">
                <p class="text-xs font-medium text-gray-600">Transferencia Bancaria</p>
                <p class="text-lg font-bold text-gray-900">
                  {formatCurrency(previewResult.validation.totalTransferencia)}
                </p>
              </div>
            </div>

            <div class="flex items-start gap-2">
              {#if previewResult.validation.coinciden}
                <svg class="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              {:else}
                <svg class="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              {/if}
              <div class="flex-1">
                <p class="text-xs font-medium text-gray-600">Diferencia</p>
                <p class="text-sm font-semibold {previewResult.validation.coinciden ? 'text-green-700' : 'text-red-700'}">
                  {previewResult.validation.coinciden ? 'Totales coinciden' : formatCurrency(previewResult.validation.diferencia)}
                </p>
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
              <h4 class="text-base font-bold text-yellow-900 mb-1">Atención: Diferencias en Personas</h4>
              <p class="text-sm text-yellow-800">{personCountWarning}</p>
            </div>
          </div>
        </div>
      {/if}

      <!-- Detalles de cada archivo -->
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
        {#if previewResult.previews.sueldos}
          <div class="rounded-lg border {previewResult.previews.sueldos.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'} shadow-sm p-4">
            <div class="flex items-center gap-2 mb-2">
              {#if previewResult.previews.sueldos.success}
                <svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
              {:else}
                <svg class="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              {/if}
              <span class="text-sm font-semibold text-gray-600">Aportes Sueldos</span>
            </div>
            <div class="text-base font-medium text-gray-900 truncate" title={previewResult.previews.sueldos.fileName}>{previewResult.previews.sueldos.fileName}</div>
            {#if previewResult.previews.sueldos.success}
              <div class="mt-1 text-sm text-gray-600">{(previewResult.previews.sueldos as any).peopleCount || 0} personas</div>
              <div class="text-sm font-semibold text-gray-900">{formatCurrency((previewResult.previews.sueldos as any).totalAmount || 0)}</div>
            {:else}
              <div class="mt-1 text-sm text-red-600">{previewResult.previews.sueldos.error}</div>
            {/if}
          </div>
        {/if}

        {#if previewResult.previews.fopid}
          <div class="rounded-lg border {previewResult.previews.fopid.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'} shadow-sm p-4">
            <div class="flex items-center gap-2 mb-2">
              {#if previewResult.previews.fopid.success}
                <svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
              {:else}
                <svg class="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              {/if}
              <span class="text-sm font-semibold text-gray-600">Aportes FOPID</span>
            </div>
            <div class="text-base font-medium text-gray-900 truncate" title={previewResult.previews.fopid.fileName}>{previewResult.previews.fopid.fileName}</div>
            {#if previewResult.previews.fopid.success}
              <div class="mt-1 text-sm text-gray-600">{(previewResult.previews.fopid as any).peopleCount || 0} personas</div>
              <div class="text-sm font-semibold text-gray-900">{formatCurrency((previewResult.previews.fopid as any).totalAmount || 0)}</div>
            {:else}
              <div class="mt-1 text-sm text-red-600">{previewResult.previews.fopid.error}</div>
            {/if}
          </div>
        {/if}

        {#if previewResult.previews.aguinaldo}
          <div class="rounded-lg border {previewResult.previews.aguinaldo.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'} shadow-sm p-4">
            <div class="flex items-center gap-2 mb-2">
              {#if previewResult.previews.aguinaldo.success}
                <svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
              {:else}
                <svg class="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              {/if}
              <span class="text-sm font-semibold text-gray-600">Aportes Aguinaldo</span>
            </div>
            <div class="text-base font-medium text-gray-900 truncate" title={previewResult.previews.aguinaldo.fileName}>{previewResult.previews.aguinaldo.fileName}</div>
            {#if previewResult.previews.aguinaldo.success}
              <div class="mt-1 text-sm text-gray-600">{(previewResult.previews.aguinaldo as any).peopleCount || 0} personas</div>
              <div class="text-sm font-semibold text-gray-900">{formatCurrency((previewResult.previews.aguinaldo as any).totalAmount || 0)}</div>
            {:else}
              <div class="mt-1 text-sm text-red-600">{previewResult.previews.aguinaldo.error}</div>
            {/if}
          </div>
        {/if}

        {#if previewResult.previews.transferencia}
          <div class="rounded-lg border {previewResult.previews.transferencia.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'} shadow-sm p-4">
            <div class="flex items-center gap-2 mb-2">
              {#if previewResult.previews.transferencia.success}
                <svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
              {:else}
                <svg class="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              {/if}
              <span class="text-sm font-semibold text-gray-600">Transferencia</span>
            </div>
            <div class="text-base font-medium text-gray-900 truncate" title={previewResult.previews.transferencia.fileName}>{previewResult.previews.transferencia.fileName}</div>
            {#if previewResult.previews.transferencia.success}
              <div class="text-sm font-semibold text-gray-900">{formatCurrency((previewResult.previews.transferencia as any).transferAmount || 0)}</div>
              {#if (previewResult.previews.transferencia as any).isMultiple}
                <div class="mt-1 text-xs text-gray-500">{(previewResult.previews.transferencia as any).transferCount} transferencias</div>
              {/if}
            {:else}
              <div class="mt-1 text-sm text-red-600">{previewResult.previews.transferencia.error}</div>
            {/if}
          </div>
        {/if}
      </div>

      <!-- Tablas de detalle (si hay datos de personas) -->
      {#if previewResult.previews.sueldos?.success && (previewResult.previews.sueldos as any).analysis?.personas?.length > 0}
        <div class="mt-4">
          <AnalysisTable
            title="TOTALES POR CONCEPTO - SUELDOS"
            concept="Apte. Sindical SIDEPP (1%)"
            personas={(previewResult.previews.sueldos as any).analysis.personas || []}
            tableData={{
              personas: (previewResult.previews.sueldos as any).peopleCount,
              montoConcepto: (previewResult.previews.sueldos as any).totalAmount
            }}
          />
        </div>
      {/if}

      {#if previewResult.previews.fopid?.success && (previewResult.previews.fopid as any).analysis?.personas?.length > 0}
        <div class="mt-4">
          <AnalysisTable
            title="TOTALES POR CONCEPTO - FOPID"
            concept="FOPID"
            personas={(previewResult.previews.fopid as any).analysis.personas || []}
            tableData={{
              personas: (previewResult.previews.fopid as any).peopleCount,
              montoConcepto: (previewResult.previews.fopid as any).totalAmount
            }}
          />
        </div>
      {/if}

      <!-- Botones de acción -->
      <div class="mt-6 pt-4 border-t border-gray-200 flex flex-col sm:flex-row justify-center gap-4">
        <button
          type="button"
          on:click={cancelPreview}
          class="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg shadow hover:bg-gray-50 transition-all focus:outline-none focus:ring-2 focus:ring-gray-300"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
          </svg>
          Cancelar y Corregir
        </button>

        {#if !previewResult.allFilesValid}
          <!-- Bloquear guardado si hay errores en archivos -->
          <div class="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium text-red-700 bg-red-100 border border-red-300 rounded-lg">
            <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
            </svg>
            <span>No se puede guardar: corrige los archivos con error</span>
          </div>
        {:else}
          <button
            type="button"
            on:click={confirmAndSave}
            class="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white {previewResult.validation.coinciden ? 'bg-gradient-to-r from-green-600 to-emerald-600' : 'bg-gradient-to-r from-yellow-600 to-orange-600'} rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500/50"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
            </svg>
            {previewResult.validation.coinciden ? 'Confirmar y Guardar' : 'Guardar de Todos Modos'}
          </button>
        {/if}
      </div>
    {/if}

    <!-- ========== ESTADO: CONFIRMING - Guardando ========== -->
    {#if state === 'confirming'}
      <div class="my-8 flex flex-col items-center justify-center">
        <svg class="animate-spin h-12 w-12 text-blue-600 mb-4" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p class="text-lg font-medium text-gray-700">{stageMessage}</p>
        <p class="text-sm text-gray-500 mt-2">Por favor espere...</p>
      </div>
    {/if}

    <!-- ========== ESTADO: SUCCESS - Guardado exitoso ========== -->
    {#if state === 'success' && saveResult}
      <div class="my-4 border-t border-gray-200 pt-4"></div>

      <div class="mb-6 rounded-xl border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 shadow-lg p-6">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
            </svg>
          </div>
          <div>
            <h3 class="text-xl font-bold text-green-900">¡Guardado Exitoso!</h3>
            <p class="text-sm text-green-700">Todos los archivos fueron guardados correctamente.</p>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <p class="text-xs font-medium text-gray-600">Período</p>
            <p class="text-sm font-semibold text-gray-900">{getMonthName(selectedMonth)} {selectedYear}</p>
          </div>
          <div>
            <p class="text-xs font-medium text-gray-600">ID del Período</p>
            <p class="text-sm font-mono text-gray-700">{saveResult.periodId}</p>
          </div>
        </div>

        <div class="mt-4 pt-4 border-t border-green-200">
          <p class="text-xs font-medium text-gray-600 mb-2">Archivos guardados:</p>
          <div class="flex flex-wrap gap-2">
            {#if saveResult.savedFiles.sueldos}
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Sueldos ({saveResult.savedFiles.sueldos.contributionLineCount} personas)
              </span>
            {/if}
            {#if saveResult.savedFiles.fopid}
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                FOPID ({saveResult.savedFiles.fopid.contributionLineCount} personas)
              </span>
            {/if}
            {#if saveResult.savedFiles.aguinaldo}
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Aguinaldo ({saveResult.savedFiles.aguinaldo.contributionLineCount} personas)
              </span>
            {/if}
            {#if saveResult.savedFiles.transferencia}
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                Transferencia
              </span>
            {/if}
          </div>
        </div>
      </div>

      <div class="flex justify-center">
        <button
          type="button"
          on:click={resetForm}
          class="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-green-600 to-emerald-600 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500/50"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
          </svg>
          Nuevo Análisis
        </button>
      </div>
    {/if}

    <!-- ========== ESTADO: ERROR ========== -->
    {#if state === 'error' || errorMessage}
      <div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
        <div class="flex items-center gap-2">
          <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <span>{errorMessage}</span>
        </div>
      </div>

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
  </div>
</form>
