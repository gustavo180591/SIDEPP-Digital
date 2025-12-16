<script lang="ts">
  import { invalidateAll, goto } from '$app/navigation';
  import { page } from '$app/stores';

  export let data: {
    periods: Array<{
      id: string;
      month: number | null;
      year: number | null;
      institution: { id: string; name: string | null; cuit: string | null } | null;
      transfer: { id: string; importe: string | null; operationNo: string | null; datetime: Date | null } | null;
      pdfFiles: Array<{
        id: string;
        fileName: string;
        type: string | null;
        totalAmount: string | null;
        peopleCount: number | null;
        createdAt: Date;
        bufferHash: string | null;
      }>;
    }>;
    institutions: Array<{ id: string; name: string | null }>;
    years: number[];
    months: Array<{ value: number; label: string }>;
    filters: { institutionId: string; year: string; month: string };
  };

  let selectedInstitution = data.filters.institutionId;
  let selectedYear = data.filters.year;
  let selectedMonth = data.filters.month;

  let expandedPeriods: Set<string> = new Set();
  let deletingFile: string | null = null;
  let deletingPeriod: string | null = null;
  let confirmDelete: { type: 'file' | 'period'; id: string; name: string } | null = null;
  let notification: { type: 'success' | 'error'; message: string } | null = null;

  function togglePeriod(periodId: string) {
    if (expandedPeriods.has(periodId)) {
      expandedPeriods.delete(periodId);
    } else {
      expandedPeriods.add(periodId);
    }
    expandedPeriods = expandedPeriods;
  }

  function applyFilters() {
    const params = new URLSearchParams();
    if (selectedInstitution) params.set('institution', selectedInstitution);
    if (selectedYear) params.set('year', selectedYear);
    if (selectedMonth) params.set('month', selectedMonth);
    goto(`?${params.toString()}`);
  }

  function clearFilters() {
    selectedInstitution = '';
    selectedYear = '';
    selectedMonth = '';
    goto('?');
  }

  function showNotification(type: 'success' | 'error', message: string) {
    notification = { type, message };
    setTimeout(() => {
      notification = null;
    }, 5000);
  }

  async function deleteFile(fileId: string) {
    deletingFile = fileId;
    try {
      const response = await fetch(`/api/admin/files/${fileId}`, {
        method: 'DELETE'
      });
      const result = await response.json();

      if (response.ok) {
        showNotification('success', `Archivo "${result.deletedFile?.fileName || ''}" eliminado correctamente`);
        await invalidateAll();
      } else {
        showNotification('error', result.error || 'Error al eliminar el archivo');
      }
    } catch (err) {
      showNotification('error', 'Error de conexión al eliminar el archivo');
    } finally {
      deletingFile = null;
      confirmDelete = null;
    }
  }

  async function deletePeriod(periodId: string) {
    deletingPeriod = periodId;
    try {
      const response = await fetch(`/api/admin/periods/${periodId}`, {
        method: 'DELETE'
      });
      const result = await response.json();

      if (response.ok) {
        showNotification('success', `Período ${result.deletedPeriod?.month}/${result.deletedPeriod?.year} eliminado (${result.deletedPeriod?.filesDeleted} archivos)`);
        await invalidateAll();
      } else {
        showNotification('error', result.error || 'Error al eliminar el período');
      }
    } catch (err) {
      showNotification('error', 'Error de conexión al eliminar el período');
    } finally {
      deletingPeriod = null;
      confirmDelete = null;
    }
  }

  function formatDate(date: Date | string | null): string {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function formatMoney(amount: string | null): string {
    if (!amount) return '-';
    const num = parseFloat(amount);
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(num);
  }

  function getFileTypeLabel(type: string | null): string {
    switch (type) {
      case 'SUELDO': return 'Sueldos';
      case 'FOPID': return 'FOPID';
      case 'AGUINALDO': return 'Aguinaldo';
      case 'COMPROBANTE': return 'Transferencia';
      default: return type || 'Desconocido';
    }
  }

  function getFileTypeColor(type: string | null): string {
    switch (type) {
      case 'SUELDO': return 'bg-blue-100 text-blue-800';
      case 'FOPID': return 'bg-green-100 text-green-800';
      case 'AGUINALDO': return 'bg-yellow-100 text-yellow-800';
      case 'COMPROBANTE': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  function getMonthName(month: number | null): string {
    if (!month) return '-';
    return data.months.find(m => m.value === month)?.label || '-';
  }
</script>

<svelte:head>
  <title>Gestión de Archivos - Admin</title>
</svelte:head>

<div class="p-6 max-w-7xl mx-auto">
  <!-- Notificación -->
  {#if notification}
    <div
      class="fixed top-4 right-4 z-50 px-6 py-4 rounded-lg shadow-lg transition-all duration-300 {notification.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}"
    >
      <div class="flex items-center gap-3">
        {#if notification.type === 'success'}
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
          </svg>
        {:else}
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        {/if}
        <span>{notification.message}</span>
        <button on:click={() => notification = null} class="ml-2 hover:opacity-75">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
    </div>
  {/if}

  <!-- Modal de confirmación -->
  {#if confirmDelete}
    <div class="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-center justify-center p-4">
      <div class="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
            </svg>
          </div>
          <h3 class="text-lg font-semibold text-gray-900">Confirmar eliminación</h3>
        </div>

        <p class="text-gray-600 mb-6">
          {#if confirmDelete.type === 'file'}
            ¿Estás seguro de eliminar el archivo <strong>"{confirmDelete.name}"</strong>? Esta acción no se puede deshacer.
          {:else}
            ¿Estás seguro de eliminar el período completo? Se eliminarán <strong>todos los archivos</strong> asociados. Esta acción no se puede deshacer.
          {/if}
        </p>

        <div class="flex gap-3 justify-end">
          <button
            on:click={() => confirmDelete = null}
            class="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cancelar
          </button>
          <button
            on:click={() => confirmDelete?.type === 'file' ? deleteFile(confirmDelete.id) : deletePeriod(confirmDelete.id)}
            disabled={deletingFile !== null || deletingPeriod !== null}
            class="px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {#if deletingFile !== null || deletingPeriod !== null}
              <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Eliminando...
            {:else}
              Eliminar
            {/if}
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Header -->
  <div class="mb-8">
    <h1 class="text-2xl font-bold text-gray-900">Gestión de Archivos</h1>
    <p class="text-gray-600 mt-1">Administra los archivos PDF cargados y sus períodos asociados</p>
  </div>

  <!-- Filtros -->
  <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div>
        <label for="institution" class="block text-sm font-medium text-gray-700 mb-1">Institución</label>
        <select
          id="institution"
          bind:value={selectedInstitution}
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">Todas</option>
          {#each data.institutions as inst}
            <option value={inst.id}>{inst.name || 'Sin nombre'}</option>
          {/each}
        </select>
      </div>

      <div>
        <label for="year" class="block text-sm font-medium text-gray-700 mb-1">Año</label>
        <select
          id="year"
          bind:value={selectedYear}
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">Todos</option>
          {#each data.years as year}
            <option value={year.toString()}>{year}</option>
          {/each}
        </select>
      </div>

      <div>
        <label for="month" class="block text-sm font-medium text-gray-700 mb-1">Mes</label>
        <select
          id="month"
          bind:value={selectedMonth}
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">Todos</option>
          {#each data.months as month}
            <option value={month.value.toString()}>{month.label}</option>
          {/each}
        </select>
      </div>

      <div class="flex items-end gap-2">
        <button
          on:click={applyFilters}
          class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Filtrar
        </button>
        <button
          on:click={clearFilters}
          class="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          Limpiar
        </button>
      </div>
    </div>
  </div>

  <!-- Lista de períodos -->
  {#if data.periods.length === 0}
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
      <svg class="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
      </svg>
      <p class="text-gray-500 text-lg">No hay períodos cargados</p>
      <p class="text-gray-400 text-sm mt-1">Los archivos subidos aparecerán aquí</p>
    </div>
  {:else}
    <div class="space-y-4">
      {#each data.periods as period (period.id)}
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <!-- Cabecera del período -->
          <div
            class="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
            on:click={() => togglePeriod(period.id)}
            on:keydown={(e) => e.key === 'Enter' && togglePeriod(period.id)}
            role="button"
            tabindex="0"
          >
            <div class="flex items-center gap-4">
              <div class="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                </svg>
              </div>
              <div>
                <div class="font-semibold text-gray-900">
                  {getMonthName(period.month)} {period.year}
                </div>
                <div class="text-sm text-gray-500">
                  {period.institution?.name || 'Sin institución'}
                  {#if period.institution?.cuit}
                    <span class="text-gray-400">({period.institution.cuit})</span>
                  {/if}
                </div>
              </div>
            </div>

            <div class="flex items-center gap-4">
              <div class="flex items-center gap-2">
                <span class="text-sm text-gray-500">{period.pdfFiles.length} archivos</span>
                {#if period.transfer}
                  <span class="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                    Transferencia OK
                  </span>
                {/if}
              </div>

              <button
                on:click|stopPropagation={() => confirmDelete = { type: 'period', id: period.id, name: `${getMonthName(period.month)} ${period.year}` }}
                class="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Eliminar período completo"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                </svg>
              </button>

              <svg
                class="w-5 h-5 text-gray-400 transition-transform duration-200 {expandedPeriods.has(period.id) ? 'rotate-180' : ''}"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
              </svg>
            </div>
          </div>

          <!-- Archivos del período (expandible) -->
          {#if expandedPeriods.has(period.id)}
            <div class="border-t border-gray-200 bg-gray-50">
              {#if period.pdfFiles.length === 0}
                <div class="p-4 text-center text-gray-500 text-sm">
                  No hay archivos en este período
                </div>
              {:else}
                <div class="divide-y divide-gray-200">
                  {#each period.pdfFiles as file (file.id)}
                    <div class="p-4 flex items-center justify-between hover:bg-gray-100 transition-colors">
                      <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded bg-red-100 flex items-center justify-center">
                          <svg class="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd"></path>
                          </svg>
                        </div>
                        <div>
                          <div class="font-medium text-gray-900 text-sm">{file.fileName}</div>
                          <div class="text-xs text-gray-500">
                            {formatDate(file.createdAt)}
                            {#if file.peopleCount}
                              · {file.peopleCount} personas
                            {/if}
                            {#if file.totalAmount}
                              · {formatMoney(file.totalAmount)}
                            {/if}
                          </div>
                        </div>
                      </div>

                      <div class="flex items-center gap-3">
                        <span class="px-2 py-1 text-xs font-medium rounded-full {getFileTypeColor(file.type)}">
                          {getFileTypeLabel(file.type)}
                        </span>

                        <button
                          on:click={() => confirmDelete = { type: 'file', id: file.id, name: file.fileName }}
                          disabled={deletingFile === file.id}
                          class="p-1.5 text-red-600 hover:bg-red-100 rounded transition-colors disabled:opacity-50"
                          title="Eliminar archivo"
                        >
                          {#if deletingFile === file.id}
                            <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          {:else}
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                            </svg>
                          {/if}
                        </button>
                      </div>
                    </div>
                  {/each}
                </div>
              {/if}

              <!-- Info de transferencia si existe -->
              {#if period.transfer}
                <div class="p-4 bg-purple-50 border-t border-purple-100">
                  <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded bg-purple-100 flex items-center justify-center">
                      <svg class="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path>
                      </svg>
                    </div>
                    <div>
                      <div class="font-medium text-purple-900 text-sm">Transferencia bancaria</div>
                      <div class="text-xs text-purple-700">
                        {formatMoney(period.transfer.importe)}
                        {#if period.transfer.operationNo}
                          · Op. {period.transfer.operationNo}
                        {/if}
                        {#if period.transfer.datetime}
                          · {formatDate(period.transfer.datetime)}
                        {/if}
                      </div>
                    </div>
                  </div>
                </div>
              {/if}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}

  <!-- Estadísticas -->
  <div class="mt-6 bg-gray-50 rounded-lg p-4">
    <div class="text-sm text-gray-600">
      <span class="font-medium">{data.periods.length}</span> períodos ·
      <span class="font-medium">{data.periods.reduce((acc, p) => acc + p.pdfFiles.length, 0)}</span> archivos totales
    </div>
  </div>
</div>
