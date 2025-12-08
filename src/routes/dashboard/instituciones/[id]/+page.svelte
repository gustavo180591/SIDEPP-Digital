<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { PageHeader, SearchBox } from '$lib/components/shared';
  import { InstitutionModal } from '$lib/components/institutions';
  import { MemberTable, MemberModal } from '$lib/components/members';
  import type { Member } from '@prisma/client';

  export let data: any;

  // Verificar rol para control de acceso
  $: isAdmin = data.user?.role === 'ADMIN';
  $: isFinanzas = data.user?.role === 'FINANZAS';
  $: canEdit = isAdmin; // Solo ADMIN puede editar

  let showEditModal = false;
  let showDeleteModal = false;
  let showMemberModal = false;
  let showMemberEditModal = false;
  let showMemberDeleteModal = false;
  let selectedMember: Member | null = null;
  let searchTerm = data.search || '';
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
    }, 500);
  }

  // Función para abrir modal de edición de institución
  function openEditModal() {
    showEditModal = true;
  }
  
  // Función para abrir modal de eliminación de institución
  function openDeleteModal() {
    showDeleteModal = true;
  }

  // Función para abrir modal de nuevo miembro
  function openMemberModal() {
    showMemberModal = true;
  }

  // Función para abrir modal de edición de miembro
  function openMemberEditModal(member: Member) {
    selectedMember = member;
    showMemberEditModal = true;
  }

  // Función para abrir modal de eliminación de miembro
  function openMemberDeleteModal(member: Member) {
    selectedMember = member;
    showMemberDeleteModal = true;
  }

  // Función para ver detalle del miembro
  function viewMemberDetail(member: Member) {
    goto(`/dashboard/instituciones/${data.institution.id}/${member.id}`);
  }
  
  // Función para cerrar modales
  function closeModals() {
    showEditModal = false;
    showDeleteModal = false;
    showMemberModal = false;
    showMemberEditModal = false;
    showMemberDeleteModal = false;
    selectedMember = null;
  }

  // Función para eliminar institución
  async function deleteInstitution() {
    try {
      const formData = new FormData();
      formData.append('id', data.institution.id);
      
      const response = await fetch('?/delete', {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        goto('/instituciones');
      } else {
        console.error('Error al eliminar institución');
      }
    } catch (error) {
      console.error('Error al eliminar institución:', error);
    }
  }

  // Función para abrir modal de ver comprobantes
  function openViewComprobantesModal() {
    goto(`/dashboard/instituciones/${data.institution.id}/comprobantes`);
  }
</script>

<svelte:head>
  <title>{data.institution.name} - SIDEPP Digital</title>
</svelte:head>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <!-- Header con navegación -->
    <div class="flex items-center gap-4 mb-6">
      <a href="/dashboard/instituciones" class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:shadow-md transition-all">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
        </svg>
        Volver a Instituciones
      </a>
    </div>

    <!-- Header de la institución -->
    {#if canEdit}
      <PageHeader
        title={data.institution.name}
        description="Detalles de la institución y gestión de miembros"
        actionLabel="Editar Institución"
        onAction={openEditModal}
      />
    {:else}
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-gray-900">{data.institution.name}</h1>
        <p class="mt-2 text-gray-600">{isFinanzas ? 'Vista de auditoría - Solo lectura' : 'Detalles de la institución'}</p>
      </div>
    {/if}

    <!-- Acciones -->
    <div class="flex flex-wrap gap-3 mb-6">
      {#if canEdit}
        <button class="flex items-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg shadow-lg hover:shadow-xl transition-all hover:scale-105" on:click={openEditModal}>
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
          </svg>
          Editar Institución
        </button>
        <button class="flex items-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-gradient-to-r from-red-600 to-red-700 rounded-lg shadow-lg hover:shadow-xl transition-all hover:scale-105" on:click={openDeleteModal}>
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
          </svg>
          Eliminar Institución
        </button>
      {/if}
      <button class="flex items-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-gradient-to-r from-green-600 to-emerald-600 rounded-lg shadow-lg hover:shadow-xl transition-all hover:scale-105" on:click={openViewComprobantesModal}>
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
        </svg>
        Ver Comprobantes
      </button>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Información de la Institución -->
      <div class="bg-white shadow-xl rounded-xl border border-gray-100 p-6">
        <h2 class="text-xl font-bold text-gray-900 mb-4">Información General</h2>
          <div class="space-y-3">
            <div>
              <label class="text-sm font-medium text-gray-500">Nombre</label>
              <p class="text-gray-900">{data.institution.name}</p>
            </div>
            <div>
              <label class="text-sm font-medium text-gray-500">CUIT</label>
              <p class="text-gray-900 font-mono">{data.institution.cuit}</p>
            </div>
            <div>
              <label class="text-sm font-medium text-gray-500">Dirección</label>
              <p class="text-gray-900">{data.institution.address || 'No especificada'}</p>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="text-sm font-medium text-gray-500">Ciudad</label>
                <p class="text-gray-900">{data.institution.city || '-'}</p>
              </div>
              <div>
                <label class="text-sm font-medium text-gray-500">Provincia</label>
                <p class="text-gray-900">{data.institution.state || '-'}</p>
              </div>
            </div>
            <div>
              <label class="text-sm font-medium text-gray-500">País</label>
              <p class="text-gray-900">{data.institution.country || 'Argentina'}</p>
            </div>
          </div>
      </div>

      <!-- Información del Responsable -->
      <div class="bg-white shadow-xl rounded-xl border border-gray-100 p-6">
        <h2 class="text-xl font-bold text-gray-900 mb-4">Responsable</h2>
          <div class="space-y-3">
            <div>
              <label class="text-sm font-medium text-gray-500">Nombre</label>
              <p class="text-gray-900">{data.institution.responsibleName || 'No especificado'}</p>
            </div>
            <div>
              <label class="text-sm font-medium text-gray-500">Email</label>
              {#if data.institution.responsibleEmail}
                <a href="mailto:{data.institution.responsibleEmail}" class="text-blue-600 hover:text-blue-800">
                  {data.institution.responsibleEmail}
                </a>
              {:else}
                <p class="text-gray-500">No especificado</p>
              {/if}
            </div>
            <div>
              <label class="text-sm font-medium text-gray-500">Teléfono</label>
              <p class="text-gray-900">{data.institution.responsiblePhone || 'No especificado'}</p>
            </div>
          </div>
      </div>
    </div>

    <!-- Lista de Miembros -->
    <div class="bg-white shadow-xl rounded-xl border border-gray-100 p-6 mt-6">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-bold text-gray-900">Miembros de la Institución</h2>
        {#if canEdit}
          <button class="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg shadow-md hover:shadow-lg transition-all" on:click={openMemberModal}>
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
            </svg>
            Agregar Miembro
          </button>
        {/if}
      </div>
        
        <!-- Buscador de miembros -->
        <SearchBox 
          bind:searchTerm 
          onSearch={handleSearch}
          placeholder="Buscar miembros..."
          label="Buscar miembro"
        />
        
        <!-- Tabla de miembros -->
        <MemberTable
          members={data.members || []}
          pagination={data.pagination || {
            currentPage: 1,
            totalPages: 1,
            totalItems: data.members?.length || 0,
            itemsPerPage: 10
          }}
          {buildUrl}
          {goto}
          onView={viewMemberDetail}
          onEdit={openMemberEditModal}
          onDelete={openMemberDeleteModal}
          readOnly={!canEdit}
        />
    </div>
</div>

<!-- Modales de Institución -->
<InstitutionModal 
  showModal={showEditModal}
  modalType="edit"
  institution={data.institution}
  onClose={closeModals}
/>

<InstitutionModal 
  showModal={showDeleteModal}
  modalType="delete"
  institution={data.institution}
  onClose={closeModals}
  onDelete={deleteInstitution}
/>

<!-- Modales de Miembros -->
<MemberModal 
  showModal={showMemberModal}
  modalType="create"
  member={null}
  institutionId={data.institution.id}
  onClose={closeModals}
/>

<MemberModal 
  showModal={showMemberEditModal}
  modalType="edit"
  member={selectedMember}
  institutionId={data.institution.id}
  onClose={closeModals}
/>

<MemberModal 
  showModal={showMemberDeleteModal}
  modalType="delete"
  member={selectedMember}
  institutionId={data.institution.id}
  onClose={closeModals}
/>