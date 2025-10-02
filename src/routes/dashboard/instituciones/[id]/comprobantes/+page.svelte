<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { PageHeader, SearchBox } from '$lib/components/shared';
  import { PdfTable } from '$lib/components/pdfs';
  import type { PdfFileWithPeriod } from '$lib/db/services/pdfService';
  
  export let data: any;
  
  let searchTerm = data.search || '';
  let yearFilter = data.year || '';
  let monthFilter = data.month || '';
  let searchTimeout: NodeJS.Timeout;

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
  function viewPdfDetails(pdf: PdfFileWithPeriod) {
    goto(`/instituciones/${data.institution.id}/comprobantes/${pdf.id}`);
  }
</script>

<svelte:head>
  <title>Comprobantes - {data.institution.name} - SIDEPP Digital</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
  <div class="container mx-auto p-6">
    <!-- Header con navegación -->
    <div class="flex items-center gap-4 mb-6">
      <a href="/instituciones" class="btn btn-ghost btn-sm">
        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
        </svg>
        Volver a Instituciones
      </a>
      <a href="/instituciones/{data.institution.id}" class="btn btn-ghost btn-sm">
        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
        </svg>
        Ver Institución
      </a>
    </div>

    <!-- Estadísticas -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
      <div class="card bg-white shadow-sm">
        <div class="card-body">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <svg class="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
            </div>
            <div class="ml-4">
              <h3 class="text-lg font-medium text-gray-900">Total Comprobantes</h3>
              <p class="text-2xl font-bold text-blue-600">{data.stats.totalPdfs}</p>
            </div>
          </div>
        </div>
      </div>

      <div class="card bg-white shadow-sm">
        <div class="card-body">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <svg class="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"></path>
              </svg>
            </div>
            <div class="ml-4">
              <h3 class="text-lg font-medium text-gray-900">Monto Total</h3>
              <p class="text-2xl font-bold text-green-600">
                $${Number(data.stats.totalAmount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div class="card bg-white shadow-sm">
        <div class="card-body">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <svg class="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <div class="ml-4">
              <h3 class="text-lg font-medium text-gray-900">Últimos 30 días</h3>
              <p class="text-2xl font-bold text-orange-600">{data.stats.recentUploads}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Lista de Comprobantes -->
    <div class="card bg-white shadow-sm">
      <div class="card-body">
        <div class="flex justify-between items-center mb-4">
          <h2 class="card-title text-xl">Comprobantes de Pago</h2>
        </div>
        
        <!-- Filtros -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <!-- Buscador -->
          <div class="form-control">
            <label class="label">
              <span class="label-text">Buscar comprobante</span>
            </label>
            <input 
              type="text" 
              bind:value={searchTerm}
              on:input={handleSearch}
              placeholder="Buscar por nombre de archivo o concepto..."
              class="input input-bordered w-full"
            />
          </div>

          <!-- Filtro por año -->
          <div class="form-control">
            <label class="label">
              <span class="label-text">Año</span>
            </label>
            <select 
              bind:value={yearFilter}
              on:change={handleYearFilter}
              class="select select-bordered w-full"
            >
              <option value="">Todos los años</option>
              {#each Array.from({length: 10}, (_, i) => new Date().getFullYear() - i) as year}
                <option value={year}>{year}</option>
              {/each}
            </select>
          </div>

          <!-- Filtro por mes -->
          <div class="form-control">
            <label class="label">
              <span class="label-text">Mes</span>
            </label>
            <select 
              bind:value={monthFilter}
              on:change={handleMonthFilter}
              class="select select-bordered w-full"
            >
              <option value="">Todos los meses</option>
              <option value="1">Enero</option>
              <option value="2">Febrero</option>
              <option value="3">Marzo</option>
              <option value="4">Abril</option>
              <option value="5">Mayo</option>
              <option value="6">Junio</option>
              <option value="7">Julio</option>
              <option value="8">Agosto</option>
              <option value="9">Septiembre</option>
              <option value="10">Octubre</option>
              <option value="11">Noviembre</option>
              <option value="12">Diciembre</option>
            </select>
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
  </div>
</div>