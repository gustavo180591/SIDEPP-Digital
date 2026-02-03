<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { PageHeader, SearchBox, SearchableSelect } from '$lib/components/shared';
  import { PdfTable } from '$lib/components/pdfs';
  import type { PdfFileWithPeriod } from '$lib/db/services/pdfService';

  export let data: any;

  let searchTerm = data.search || '';
  let yearFilter = data.year || '';
  let monthFilter = data.month || '';
  let searchTimeout: NodeJS.Timeout;

  // Opciones para los filtros
  const yearOptions = [
    { value: '', label: 'Todos los años' },
    ...Array.from({ length: 10 }, (_, i) => {
      const year = new Date().getFullYear() - i;
      return { value: String(year), label: String(year) };
    })
  ];

  const monthOptions = [
    { value: '', label: 'Todos los meses' },
    { value: '1', label: 'Enero' },
    { value: '2', label: 'Febrero' },
    { value: '3', label: 'Marzo' },
    { value: '4', label: 'Abril' },
    { value: '5', label: 'Mayo' },
    { value: '6', label: 'Junio' },
    { value: '7', label: 'Julio' },
    { value: '8', label: 'Agosto' },
    { value: '9', label: 'Septiembre' },
    { value: '10', label: 'Octubre' },
    { value: '11', label: 'Noviembre' },
    { value: '12', label: 'Diciembre' }
  ];

  // Reaccionar a cambios en los filtros
  $: if (yearFilter !== data.year) {
    handleYearFilter();
  }
  $: if (monthFilter !== data.month) {
    handleMonthFilter();
  }

  // Función para construir URL con filtros
  function buildUrl(filters: Record<string, string>) {
    const url = new URL($page.url);
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        url.searchParams.set(key, value);
      } else {
        url.searchParams.delete(key);
      }
    });
    return url.toString();
  }

  // Función para búsqueda automática con debounce
  function handleSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      const url = buildUrl({
        search: searchTerm,
        year: yearFilter,
        month: monthFilter,
        page: '1'
      });
      goto(url);
    }, 500);
  }

  // Función para filtrar por año
  function handleYearFilter() {
    const url = buildUrl({
      search: searchTerm,
      year: yearFilter,
      month: monthFilter,
      page: '1'
    });
    goto(url);
  }

  // Función para filtrar por mes
  function handleMonthFilter() {
    const url = buildUrl({
      search: searchTerm,
      year: yearFilter,
      month: monthFilter,
      page: '1'
    });
    goto(url);
  }

  // Función para ver detalles de un PDF
  function viewPdfDetails(pdf: any) {
    const pdfFileId = pdf?.id;
    goto(`/dashboard/instituciones/${data.institution.id}/comprobantes/${pdfFileId}`);
  }
</script>

<svelte:head>
  <title>Comprobantes - {data.institution.name} - SIDEPP Digital</title>
</svelte:head>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <!-- Header con navegación -->
    <div class="flex items-center gap-3 mb-6">
      {#if data.user?.role === 'ADMIN'}
      <a href="/dashboard/instituciones" class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:shadow-md transition-all">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
        </svg>
        Volver a Instituciones
      </a>
      {/if}
      <a href="/dashboard/instituciones/{data.institution.id}" class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:shadow-md transition-all">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
        </svg>
        Ver Institución
      </a>
    </div>

    <!-- Estadísticas -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
      <div class="bg-white overflow-hidden shadow-lg hover:shadow-xl rounded-xl transition-all duration-300 hover:scale-105 border border-red-100">
        <div class="p-6">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <div class="w-14 h-14 bg-gradient-to-br from-red-600 to-red-700 rounded-xl flex items-center justify-center shadow-md">
                <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
              </div>
            </div>
            <div class="ml-5 w-0 flex-1">
              <dl>
                <dt class="text-sm font-semibold text-gray-600 truncate">Total Comprobantes</dt>
                <dd class="text-2xl font-bold text-gray-900">{data.stats.totalPdfs}</dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      <div class="bg-white overflow-hidden shadow-lg hover:shadow-xl rounded-xl transition-all duration-300 hover:scale-105 border border-green-100">
        <div class="p-6">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <div class="w-14 h-14 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-md">
                <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"></path>
                </svg>
              </div>
            </div>
            <div class="ml-5 w-0 flex-1">
              <dl>
                <dt class="text-sm font-semibold text-gray-600 truncate">Monto Total Remunerativo</dt>
                <dd class="text-2xl font-bold text-gray-900">
                  ${Number(data.stats.totalRemunerativo).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      <div class="bg-white overflow-hidden shadow-lg hover:shadow-xl rounded-xl transition-all duration-300 hover:scale-105 border border-purple-100">
        <div class="p-6">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <div class="w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-md">
                <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
                </svg>
              </div>
            </div>
            <div class="ml-5 w-0 flex-1">
              <dl>
                <dt class="text-sm font-semibold text-gray-600 truncate">Monto Total del Concepto</dt>
                <dd class="text-2xl font-bold text-gray-900">
                  ${Number(data.stats.totalConcepto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Lista de Comprobantes -->
    <div class="bg-white shadow-xl rounded-xl border border-gray-100 p-6">
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-xl font-bold text-gray-900">Comprobantes de Pago</h2>
      </div>

      <!-- Filtros -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <!-- Buscador -->
        <div>
          <label class="block text-sm font-semibold text-gray-700 mb-2">
            Buscar comprobante
          </label>
          <input
            type="text"
            bind:value={searchTerm}
            on:input={handleSearch}
            placeholder="Buscar por nombre o concepto..."
            class="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all shadow-sm"
          />
        </div>

        <!-- Filtro por año -->
        <div>
          <label class="block text-sm font-semibold text-gray-700 mb-2">
            Año
          </label>
          <SearchableSelect
            options={yearOptions}
            bind:value={yearFilter}
            placeholder="Buscar año..."
            name="year"
          />
        </div>

        <!-- Filtro por mes -->
        <div>
          <label class="block text-sm font-semibold text-gray-700 mb-2">
            Mes
          </label>
          <SearchableSelect
            options={monthOptions}
            bind:value={monthFilter}
            placeholder="Buscar mes..."
            name="month"
          />
        </div>
      </div>
        
        <!-- Tabla de comprobantes -->
        <PdfTable 
          pdfs={data.pdfs || []} 
          pagination={data.pagination || {
            currentPage: 1,
            totalPages: 1,
            totalItems: data.pdfs?.length || 0,
            itemsPerPage: 10
          }}
          {buildUrl}
          {goto}
          onView={viewPdfDetails}
        />
    </div>
</div>