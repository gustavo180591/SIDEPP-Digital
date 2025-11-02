<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { PageHeader, SearchBox } from '$lib/components/shared';
  import { InstitutionTable, InstitutionModal } from '$lib/components/institutions';
  import type { InstitutionListItem } from '$lib/db/models';

  export let data: any;

  let showCreateModal = false;
  let showEditModal = false;
  let showDeleteModal = false;
  let selectedInstitution: InstitutionListItem | null = null;
  let searchTerm = data.filters.search || '';
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
  <title>Gestión de Instituciones - SIDEPP Digital</title>
</svelte:head>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
  <!-- Header -->
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
</div>