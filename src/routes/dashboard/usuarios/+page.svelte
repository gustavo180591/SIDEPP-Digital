<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { PageHeader, SearchBox } from '$lib/components/shared';
  import { UserTable, UserModal } from '$lib/components/users';
  import type { UserListItem } from '$lib/db/models';

  export let data: any;

  let showCreateModal = false;
  let showEditModal = false;
  let showDeleteModal = false;
  let selectedUser: UserListItem | null = null;
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
  function openEditModal(user: UserListItem) {
    selectedUser = user;
    showEditModal = true;
  }

  // Función para abrir modal de eliminación
  function openDeleteModal(user: UserListItem) {
    selectedUser = user;
    showDeleteModal = true;
  }

  // Función para cerrar modales
  function closeModals() {
    showCreateModal = false;
    showEditModal = false;
    showDeleteModal = false;
    selectedUser = null;
  }
</script>

<svelte:head>
  <title>Gestión de Usuarios - SIDEPP Digital</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
  <div class="container mx-auto p-6">
    <!-- Header -->
    <PageHeader 
      title="Usuarios"
      description="Gestiona los usuarios del sistema"
      actionLabel="Nuevo Usuario"
      onAction={() => showCreateModal = true}
    />

    <!-- Buscador -->
    <SearchBox 
      bind:searchTerm 
      onSearch={handleSearch}
      placeholder="Buscar por nombre o email..."
      label="Buscar usuario"
    />

    <!-- Tabla de usuarios -->
    <UserTable 
      users={data.users} 
      pagination={data.pagination}
      {buildUrl}
      {goto}
      onEdit={openEditModal} 
      onDelete={openDeleteModal} 
    />

    <!-- Modales -->
    <UserModal 
      showModal={showCreateModal}
      modalType="create"
      user={null}
      onClose={closeModals}
    />
    
    <UserModal 
      showModal={showEditModal}
      modalType="edit"
      user={selectedUser}
      onClose={closeModals}
    />
    
    <UserModal 
      showModal={showDeleteModal}
      modalType="delete"
      user={selectedUser}
      onClose={closeModals}
    />
  </div>
</div>
