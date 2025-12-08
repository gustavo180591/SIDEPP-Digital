<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { PageHeader, SearchBox } from '$lib/components/shared';
  import { InstitutionTable, InstitutionModal } from '$lib/components/institutions';
  import type { InstitutionListItem } from '$lib/db/models';

  export let data: any;

  // Verificar roles para control de acceso
  $: isLiquidador = data.user?.role === 'LIQUIDADOR';
  $: isFinanzas = data.user?.role === 'FINANZAS';
  $: isAdmin = data.user?.role === 'ADMIN';

  let showCreateModal = false;
  let showEditModal = false;
  let showDeleteModal = false;
  let selectedInstitution: InstitutionListItem | null = null;
  let searchTerm = data.filters?.search || '';
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
        page: '1'
      });
      goto(url);
    }, 500); // Espera 500ms antes de buscar
  }

  // Función para abrir modal de edición
  function openEditModal(institution: InstitutionListItem) {
    selectedInstitution = institution;
    showEditModal = true;
  }

  // Función para abrir modal de eliminación
  function openDeleteModal(institution: InstitutionListItem) {
    selectedInstitution = institution;
    showDeleteModal = true;
  }

  // Función para cerrar modales
  function closeModals() {
    showCreateModal = false;
    showEditModal = false;
    showDeleteModal = false;
    selectedInstitution = null;
  }
</script>

<svelte:head>
  <title>{isLiquidador ? 'Mis Instituciones' : 'Gestión de Instituciones'} - SIDEPP Digital</title>
</svelte:head>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
  {#if isLiquidador}
    <!-- Vista solo lectura para LIQUIDADOR -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900">Mis Instituciones</h1>
      <p class="mt-2 text-gray-600">Instituciones asignadas a tu cuenta</p>
    </div>

    <!-- Lista simple de instituciones para LIQUIDADOR -->
    {#if data.institutions && data.institutions.length > 0}
      <div class="bg-white shadow overflow-hidden sm:rounded-lg">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Institución</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CUIT</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ciudad</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            {#each data.institutions as institution}
              <tr>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span class="font-medium text-gray-900">{institution.name}</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span class="text-sm text-gray-600 font-mono">{institution.cuit || '-'}</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span class="text-sm text-gray-600">{institution.city || '-'}</span>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {:else}
      <div class="text-center py-12 bg-white rounded-lg shadow">
        <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
        <h3 class="mt-2 text-sm font-medium text-gray-900">No tienes instituciones asignadas</h3>
        <p class="mt-1 text-sm text-gray-500">Contacta al administrador para que te asigne una institución.</p>
      </div>
    {/if}
  {:else if isFinanzas}
    <!-- Vista solo lectura para FINANZAS -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900">Instituciones</h1>
      <p class="mt-2 text-gray-600">Vista de auditoría - Solo lectura</p>
    </div>

    <!-- Buscador -->
    <SearchBox
      bind:searchTerm
      onSearch={handleSearch}
      placeholder="Buscar por nombre o CUIT..."
      label="Buscar institución"
    />

    <!-- Tabla de instituciones sin acciones de edición -->
    <InstitutionTable
      institutions={data.institutions}
      pagination={data.pagination}
      {buildUrl}
      {goto}
      onEdit={() => {}}
      onDelete={() => {}}
      readOnly={true}
    />
  {:else}
    <!-- Vista completa para ADMIN -->
    <PageHeader
      title="Instituciones"
      description="Gestiona las instituciones del sistema"
      actionLabel="Nueva Institución"
      onAction={() => showCreateModal = true}
    />

    <!-- Buscador -->
    <SearchBox
      bind:searchTerm
      onSearch={handleSearch}
      placeholder="Buscar por nombre o CUIT..."
      label="Buscar institución"
    />

    <!-- Tabla de instituciones -->
    <InstitutionTable
      institutions={data.institutions}
      pagination={data.pagination}
      {buildUrl}
      {goto}
      onEdit={openEditModal}
      onDelete={openDeleteModal}
    />

    <!-- Modales -->
    <InstitutionModal
      showModal={showCreateModal}
      modalType="create"
      institution={null}
      onClose={closeModals}
    />

    <InstitutionModal
      showModal={showEditModal}
      modalType="edit"
      institution={selectedInstitution}
      onClose={closeModals}
    />

    <InstitutionModal
      showModal={showDeleteModal}
      modalType="delete"
      institution={selectedInstitution}
      onClose={closeModals}
    />
  {/if}
</div>