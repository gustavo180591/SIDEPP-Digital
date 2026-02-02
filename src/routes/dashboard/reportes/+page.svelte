<script lang="ts">
  import { PageHeader } from '$lib/components/shared';
  import type { ReporteAportesPorPeriodo } from '$lib/db/services/reportService';

  let { data }: { data: any } = $props();

  let loading = $state(false);
  let reporte: ReporteAportesPorPeriodo | null = $state(null);
  let error = $state('');

  // Filtros
  let selectedInstitution = $state('');
  let startMonth = $state(data.monthsRange.minMonth || '');
  let endMonth = $state(data.monthsRange.maxMonth || '');

  // Filtros de tabla
  let searchTerm = $state('');
  let sortColumn = $state<string>('fullName');
  let sortDirection = $state<'asc' | 'desc'>('asc');

  // Paginación
  let currentPage = $state(1);
  let itemsPerPage = $state(50);

  // Computed: datos filtrados y ordenados
  let filteredData = $derived.by(() => {
    if (!reporte) return [];

    let filtered = reporte.afiliados;

    // Filtrar por búsqueda
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (a) =>
          a.fullName.toLowerCase().includes(term) ||
          a.dni.toLowerCase().includes(term)
      );
    }

    // Ordenar
    filtered = [...filtered].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      if (sortColumn === 'fullName') {
        aValue = a.fullName;
        bValue = b.fullName;
      } else if (sortColumn === 'dni') {
        aValue = a.dni;
        bValue = b.dni;
      } else if (sortColumn.startsWith('mes-')) {
        // Ordenar por mes específico
        const mes = sortColumn.replace('mes-', '');
        aValue = a.meses[mes]?.montoConcepto || 0;
        bValue = b.meses[mes]?.montoConcepto || 0;
      }

      if (typeof aValue === 'string') {
        return sortDirection === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      } else {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }
    });

    return filtered;
  });

  // Computed: datos paginados
  let paginatedData = $derived.by(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return filteredData.slice(start, end);
  });

  // Computed: número total de páginas
  let totalPages = $derived(Math.ceil(filteredData.length / itemsPerPage));

  // Función para cargar reporte
  async function loadReporte() {
    if (!startMonth || !endMonth) {
      error = 'Debe seleccionar un período válido';
      return;
    }

    loading = true;
    error = '';
    reporte = null;

    try {
      const params = new URLSearchParams({
        startMonth,
        endMonth
      });

      if (selectedInstitution) {
        params.append('institutionId', selectedInstitution);
      }

      const response = await fetch(`/api/reports/aportes-por-periodo?${params}`);

      if (!response.ok) {
        throw new Error('Error al cargar el reporte');
      }

      reporte = await response.json();
      currentPage = 1; // Reset pagination
    } catch (err) {
      error = err instanceof Error ? err.message : 'Error desconocido';
      console.error('Error al cargar reporte:', err);
    } finally {
      loading = false;
    }
  }

  // Función para exportar PDF
  async function exportPdf() {
    if (!startMonth || !endMonth) {
      alert('Debe seleccionar un período válido');
      return;
    }

    try {
      const params = new URLSearchParams({
        startMonth,
        endMonth
      });

      if (selectedInstitution) {
        params.append('institutionId', selectedInstitution);
      }

      const response = await fetch(`/api/reports/aportes-por-periodo/export?${params}`);

      if (!response.ok) {
        throw new Error('Error al exportar el PDF');
      }

      // Descargar el archivo
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      // Obtener nombre de archivo del header Content-Disposition
      const disposition = response.headers.get('Content-Disposition');
      const filenameMatch = disposition?.match(/filename="(.+)"/);
      const filename = filenameMatch ? filenameMatch[1] : 'reporte-aportes.pdf';

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      alert('Error al exportar PDF: ' + (err instanceof Error ? err.message : 'Error desconocido'));
      console.error('Error al exportar PDF:', err);
    }
  }

  // Función para ordenar
  function handleSort(column: string) {
    if (sortColumn === column) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortColumn = column;
      sortDirection = 'asc';
    }
  }

  // Función para cambiar página
  function goToPage(page: number) {
    if (page >= 1 && page <= totalPages) {
      currentPage = page;
    }
  }

  // Formatear mes para display
  function formatMonth(mes: string): string {
    const [year, month] = mes.split('-');
    return `${month}/${year.slice(2)}`;
  }
</script>

<svelte:head>
  <title>Reportes de Aportes - SIDEPP Digital</title>
</svelte:head>

<div class="max-w-[95%] mx-auto px-4 sm:px-6 lg:px-8">
  <PageHeader
    title="Reportes de Aportes por Período"
    description="Visualice y exporte reportes de aportes mensuales de afiliados"
  />

  <!-- Filtros -->
  <div class="bg-white rounded-xl shadow-md p-6 mb-6 border border-gray-200">
    <h3 class="text-lg font-semibold text-gray-900 mb-4">Filtros de Reporte</h3>

    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <!-- Selector de institución -->
      <div>
        <label for="institution" class="block text-sm font-medium text-gray-700 mb-2">
          Institución
        </label>
        <select
          id="institution"
          bind:value={selectedInstitution}
          class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Todas las instituciones</option>
          {#each data.institutions as institution}
            <option value={institution.id}>{institution.name || institution.cuit}</option>
          {/each}
        </select>
      </div>

      <!-- Mes inicio -->
      <div>
        <label for="startMonth" class="block text-sm font-medium text-gray-700 mb-2">
          Mes Inicio
        </label>
        <input
          id="startMonth"
          type="month"
          bind:value={startMonth}
          class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <!-- Mes fin -->
      <div>
        <label for="endMonth" class="block text-sm font-medium text-gray-700 mb-2">
          Mes Fin
        </label>
        <input
          id="endMonth"
          type="month"
          bind:value={endMonth}
          class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <!-- Botón generar -->
      <div class="flex items-end">
        <button
          onclick={loadReporte}
          disabled={loading}
          class="w-full px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-lg hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
        >
          {loading ? 'Cargando...' : 'Generar Reporte'}
        </button>
      </div>
    </div>

    {#if error}
      <div class="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
        <p class="text-sm text-red-800">{error}</p>
      </div>
    {/if}
  </div>

  <!-- Resultados -->
  {#if reporte}
    <div class="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
      <!-- Header con búsqueda y exportar -->
      <div class="p-6 border-b border-gray-200">
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h3 class="text-lg font-semibold text-gray-900">
              {reporte.institution?.name || 'Todas las instituciones'}
            </h3>
            <p class="text-sm text-gray-600 mt-1">
              {reporte.afiliados.length} afiliados " {reporte.mesesOrdenados.length} meses
            </p>
          </div>

          <div class="flex gap-3 w-full md:w-auto">
            <!-- Búsqueda -->
            <input
              type="text"
              bind:value={searchTerm}
              placeholder="Buscar por nombre o DNI..."
              class="flex-1 md:w-64 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />

            <!-- Botón exportar PDF -->
            <button
              onclick={exportPdf}
              class="px-6 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-medium rounded-lg hover:from-green-700 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-all shadow-md hover:shadow-lg flex items-center gap-2 whitespace-nowrap"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Exportar PDF
            </button>
          </div>
        </div>
      </div>

      <!-- Tabla -->
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <!-- Columnas fijas -->
              <th
                onclick={() => handleSort('fullName')}
                class="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 sticky left-0 bg-gray-50 z-10"
              >
                <div class="flex items-center gap-2">
                  Apellido y nombre
                  {#if sortColumn === 'fullName'}
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {#if sortDirection === 'asc'}
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                      {:else}
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                      {/if}
                    </svg>
                  {/if}
                </div>
              </th>

              <th
                onclick={() => handleSort('dni')}
                class="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 sticky left-[240px] bg-gray-50 z-10"
              >
                <div class="flex items-center gap-2">
                  DNI
                  {#if sortColumn === 'dni'}
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {#if sortDirection === 'asc'}
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                      {:else}
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                      {/if}
                    </svg>
                  {/if}
                </div>
              </th>

              <!-- Columnas de meses -->
              {#each reporte.mesesOrdenados as mes}
                <th
                  colspan="2"
                  class="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider border-l border-gray-300"
                >
                  {formatMonth(mes)}
                </th>
              {/each}
            </tr>
            <tr>
              <th colspan="2" class="bg-gray-50"></th>
              {#each reporte.mesesOrdenados as mes}
                <th class="px-1 py-2 text-center text-xs font-medium text-gray-600 bg-green-50 border-l border-gray-300">
                  Tot. Rem.
                </th>
                <th class="px-1 py-2 text-center text-xs font-medium text-gray-600 bg-blue-50">
                  Concepto
                </th>
              {/each}
            </tr>
          </thead>

          <tbody class="bg-white divide-y divide-gray-200">
            {#each paginatedData as afiliado}
              <tr class="hover:bg-gray-50">
                <td class="px-4 py-3 text-sm text-gray-900 left-0 bg-white">{afiliado.fullName}</td>
                <td class="px-4 py-3 text-sm text-gray-600 left-[240px] bg-white">{afiliado.dni || '-'}</td>

                {#each reporte.mesesOrdenados as mes}
                  {@const aporte = afiliado.meses[mes]}
                  <td class="px-1 py-3 text-sm text-right text-gray-900 border-l border-gray-200">
                    {aporte ? aporte.totalRemunerativo.toFixed(2) : '-'}
                  </td>
                  <td class="px-1 py-3 text-sm text-right text-gray-900">
                    {aporte ? aporte.montoConcepto.toFixed(2) : '-'}
                  </td>
                {/each}
              </tr>
            {/each}

            <!-- Fila de totales -->
            <tr class="bg-gray-100 font-semibold">
              <td colspan="2" class="px-4 py-3 text-sm text-gray-900 sticky left-0 bg-gray-100">TOTALES</td>
              {#each reporte.mesesOrdenados as mes}
                {@const totales = reporte.totalesPorMes[mes]}
                <td class="px-1 py-3 text-sm text-right text-gray-900 border-l border-gray-300">
                  {totales ? totales.totalRemunerativo.toFixed(2) : '-'}
                </td>
                <td class="px-1 py-3 text-sm text-right text-gray-900">
                  {totales ? totales.montoConcepto.toFixed(2) : '-'}
                </td>
              {/each}
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Paginación -->
      {#if totalPages > 1}
        <div class="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <div class="text-sm text-gray-600">
            Mostrando {(currentPage - 1) * itemsPerPage + 1} a {Math.min(currentPage * itemsPerPage, filteredData.length)} de {filteredData.length} resultados
          </div>

          <div class="flex gap-2">
            <button
              onclick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              class="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Anterior
            </button>

            {#each Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const page = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
              return page <= totalPages ? page : null;
            }).filter(Boolean) as page}
              <button
                onclick={() => goToPage(page)}
                class="px-3 py-1 text-sm border rounded-md {currentPage === page ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 hover:bg-gray-50'}"
              >
                {page}
              </button>
            {/each}

            <button
              onclick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              class="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Siguiente
            </button>
          </div>
        </div>
      {/if}
    </div>
  {:else if !loading}
    <div class="bg-white rounded-xl shadow-md p-12 text-center border border-gray-200">
      <svg class="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <h3 class="text-lg font-semibold text-gray-900 mb-2">No hay datos para mostrar</h3>
      <p class="text-sm text-gray-600">
        Seleccione los filtros y haga clic en "Generar Reporte" para ver los datos
      </p>
    </div>
  {/if}

  {#if loading}
    <div class="bg-white rounded-xl shadow-md p-12 text-center border border-gray-200">
      <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
      <p class="text-sm text-gray-600">Cargando reporte...</p>
    </div>
  {/if}
</div>
