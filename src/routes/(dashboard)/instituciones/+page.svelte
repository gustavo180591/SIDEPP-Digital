<script lang="ts">
  import { enhance } from '$app/forms';
  import { page } from '$app/stores';
  // Los tipos se generan automáticamente por SvelteKit
  import type { InstitutionListItem } from '$lib/db/models';

  export let data: any;

  let showCreateModal = false;
  let showEditModal = false;
  let showDeleteModal = false;
  let selectedInstitution: InstitutionListItem | null = null;
  let searchTerm = data.filters.search || '';
  let cityFilter = data.filters.city || '';
  let stateFilter = data.filters.state || '';
  let countryFilter = data.filters.country || '';

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

  // Función para aplicar filtros
  function applyFilters() {
    const url = buildUrl({
      search: searchTerm,
      city: cityFilter,
      state: stateFilter,
      country: countryFilter,
      page: '1'
    });
    window.location.href = url;
  }

  // Función para limpiar filtros
  function clearFilters() {
    searchTerm = '';
    cityFilter = '';
    stateFilter = '';
    countryFilter = '';
    const url = buildUrl({});
    window.location.href = url;
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

<div class="container mx-auto p-6">
  <!-- Header -->
  <div class="flex justify-between items-center mb-6">
    <div>
      <h1 class="text-3xl font-bold text-base-content">Instituciones</h1>
      <p class="text-base-content/70 mt-2">Gestiona las instituciones del sistema</p>
    </div>
    <button 
      class="btn btn-primary"
      on:click={() => showCreateModal = true}
    >
      <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
      </svg>
      Nueva Institución
    </button>
  </div>

  <!-- Filtros -->
  <div class="card bg-base-100 shadow-sm mb-6">
    <div class="card-body">
      <h3 class="card-title text-lg mb-4">Filtros de búsqueda</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="form-control">
          <label class="label" for="search-input">
            <span class="label-text">Buscar</span>
          </label>
          <input 
            id="search-input"
            type="text" 
            class="input input-bordered" 
            placeholder="Nombre, CUIT, responsable..."
            bind:value={searchTerm}
          />
        </div>
        <div class="form-control">
          <label class="label" for="city-input">
            <span class="label-text">Ciudad</span>
          </label>
          <input 
            id="city-input"
            type="text" 
            class="input input-bordered" 
            placeholder="Ciudad"
            bind:value={cityFilter}
          />
        </div>
        <div class="form-control">
          <label class="label" for="state-input">
            <span class="label-text">Provincia</span>
          </label>
          <input 
            id="state-input"
            type="text" 
            class="input input-bordered" 
            placeholder="Provincia"
            bind:value={stateFilter}
          />
        </div>
        <div class="form-control">
          <label class="label" for="country-input">
            <span class="label-text">País</span>
          </label>
          <input 
            id="country-input"
            type="text" 
            class="input input-bordered" 
            placeholder="País"
            bind:value={countryFilter}
          />
        </div>
      </div>
      <div class="flex gap-2 mt-4">
        <button class="btn btn-primary" on:click={applyFilters}>
          <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
          </svg>
          Buscar
        </button>
        <button class="btn btn-outline" on:click={clearFilters}>
          <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
          Limpiar
        </button>
      </div>
    </div>
  </div>

  <!-- Tabla de instituciones -->
  <div class="card bg-base-100 shadow-sm">
    <div class="card-body p-0">
      {#if data.institutions.length === 0}
        <div class="text-center py-12">
          <svg class="w-16 h-16 mx-auto text-base-content/30 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
          </svg>
          <h3 class="text-lg font-semibold text-base-content/70 mb-2">No hay instituciones</h3>
          <p class="text-base-content/50 mb-4">Comienza creando tu primera institución</p>
          <button class="btn btn-primary" on:click={() => showCreateModal = true}>
            Crear Institución
          </button>
        </div>
      {:else}
        <div class="overflow-x-auto">
          <table class="table table-zebra">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>CUIT</th>
                <th>Ciudad</th>
                <th>Provincia</th>
                <th>Responsable</th>
                <th>Email</th>
                <th>Creado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {#each data.institutions as institution}
                <tr>
                  <td>
                    <a 
                      href="/instituciones/{institution.id}" 
                      class="font-semibold text-primary hover:text-primary-focus link link-hover"
                    >
                      {institution.name}
                    </a>
                  </td>
                  <td>
                    {#if institution.cuit}
                      <span class="badge badge-outline">{institution.cuit}</span>
                    {:else}
                      <span class="text-base-content/50">-</span>
                    {/if}
                  </td>
                  <td>{institution.city || '-'}</td>
                  <td>{institution.state || '-'}</td>
                  <td>{institution.responsibleName || '-'}</td>
                  <td>
                    {#if institution.responsibleEmail}
                      <a href="mailto:{institution.responsibleEmail}" class="link link-primary">
                        {institution.responsibleEmail}
                      </a>
                    {:else}
                      <span class="text-base-content/50">-</span>
                    {/if}
                  </td>
                  <td>
                    <div class="text-sm text-base-content/70">
                      {new Date(institution.createdAt).toLocaleDateString('es-AR')}
                    </div>
                  </td>
                  <td>
                    <div class="flex gap-2">
                      <button 
                        class="btn btn-sm btn-outline btn-info"
                        on:click={() => openEditModal(institution)}
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                        </svg>
                        Editar
                      </button>
                      <button 
                        class="btn btn-sm btn-outline btn-error"
                        on:click={() => openDeleteModal(institution)}
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                        </svg>
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

        <!-- Paginación -->
        {#if data.pagination.totalPages > 1}
          <div class="flex justify-center items-center gap-2 p-4">
            <button 
              class="btn btn-sm btn-outline"
              disabled={!data.pagination.hasPrev}
              on:click={() => {
                const url = new URL($page.url);
                url.searchParams.set('page', (data.pagination.page - 1).toString());
                window.location.href = url.toString();
              }}
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
              </svg>
              Anterior
            </button>
            
            <span class="text-sm text-base-content/70">
              Página {data.pagination.page} de {data.pagination.totalPages}
            </span>
            
            <button 
              class="btn btn-sm btn-outline"
              disabled={!data.pagination.hasNext}
              on:click={() => {
                const url = new URL($page.url);
                url.searchParams.set('page', (data.pagination.page + 1).toString());
                window.location.href = url.toString();
              }}
            >
              Siguiente
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
              </svg>
            </button>
          </div>
        {/if}
      {/if}
    </div>
  </div>
</div>

<!-- Modal para crear institución -->
{#if showCreateModal}
  <div class="modal modal-open">
    <div class="modal-box w-11/12 max-w-2xl">
      <h3 class="font-bold text-lg mb-4">Nueva Institución</h3>
      
      <form method="POST" action="?/create" use:enhance>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="form-control md:col-span-2">
            <label class="label" for="create-name">
              <span class="label-text">Nombre de la Institución *</span>
            </label>
            <input 
              id="create-name"
              type="text" 
              name="name"
              class="input input-bordered" 
              placeholder="Nombre de la institución"
              required
            />
          </div>
          
          <div class="form-control">
            <label class="label">
              <span class="label-text">CUIT</span>
            </label>
            <input 
              type="text" 
              name="cuit"
              class="input input-bordered" 
              placeholder="20-12345678-9"
            />
          </div>
          
          <div class="form-control">
            <label class="label">
              <span class="label-text">País</span>
            </label>
            <input 
              type="text" 
              name="country"
              class="input input-bordered" 
              placeholder="Argentina"
              value="Argentina"
            />
          </div>
          
          <div class="form-control">
            <label class="label">
              <span class="label-text">Dirección</span>
            </label>
            <input 
              type="text" 
              name="address"
              class="input input-bordered" 
              placeholder="Dirección"
            />
          </div>
          
          <div class="form-control">
            <label class="label">
              <span class="label-text">Ciudad</span>
            </label>
            <input 
              type="text" 
              name="city"
              class="input input-bordered" 
              placeholder="Ciudad"
            />
          </div>
          
          <div class="form-control">
            <label class="label">
              <span class="label-text">Provincia</span>
            </label>
            <input 
              type="text" 
              name="state"
              class="input input-bordered" 
              placeholder="Provincia"
            />
          </div>
          
          <div class="form-control">
            <label class="label">
              <span class="label-text">Nombre del Responsable</span>
            </label>
            <input 
              type="text" 
              name="responsibleName"
              class="input input-bordered" 
              placeholder="Nombre del responsable"
            />
          </div>
          
          <div class="form-control">
            <label class="label">
              <span class="label-text">Email del Responsable</span>
            </label>
            <input 
              type="email" 
              name="responsibleEmail"
              class="input input-bordered" 
              placeholder="email@ejemplo.com"
            />
          </div>
          
          <div class="form-control">
            <label class="label">
              <span class="label-text">Teléfono del Responsable</span>
            </label>
            <input 
              type="tel" 
              name="responsablePhone"
              class="input input-bordered" 
              placeholder="+54 11 1234-5678"
            />
          </div>
        </div>
        
        <div class="modal-action">
          <button type="button" class="btn btn-outline" on:click={closeModals}>
            Cancelar
          </button>
          <button type="submit" class="btn btn-primary">
            Crear Institución
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- Modal para editar institución -->
{#if showEditModal && selectedInstitution}
  <div class="modal modal-open">
    <div class="modal-box w-11/12 max-w-2xl">
      <h3 class="font-bold text-lg mb-4">Editar Institución</h3>
      
      <form method="POST" action="?/update" use:enhance>
        <input type="hidden" name="id" value={selectedInstitution.id} />
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="form-control md:col-span-2">
            <label class="label">
              <span class="label-text">Nombre de la Institución *</span>
            </label>
            <input 
              type="text" 
              name="name"
              class="input input-bordered" 
              placeholder="Nombre de la institución"
              value={selectedInstitution.name}
              required
            />
          </div>
          
          <div class="form-control">
            <label class="label">
              <span class="label-text">CUIT</span>
            </label>
            <input 
              type="text" 
              name="cuit"
              class="input input-bordered" 
              placeholder="20-12345678-9"
              value={selectedInstitution.cuit || ''}
            />
          </div>
          
          <div class="form-control">
            <label class="label">
              <span class="label-text">País</span>
            </label>
            <input 
              type="text" 
              name="country"
              class="input input-bordered" 
              placeholder="Argentina"
              value="Argentina"
            />
          </div>
          
          <div class="form-control">
            <label class="label">
              <span class="label-text">Dirección</span>
            </label>
            <input 
              type="text" 
              name="address"
              class="input input-bordered" 
              placeholder="Dirección"
            />
          </div>
          
          <div class="form-control">
            <label class="label">
              <span class="label-text">Ciudad</span>
            </label>
            <input 
              type="text" 
              name="city"
              class="input input-bordered" 
              placeholder="Ciudad"
              value={selectedInstitution.city || ''}
            />
          </div>
          
          <div class="form-control">
            <label class="label">
              <span class="label-text">Provincia</span>
            </label>
            <input 
              type="text" 
              name="state"
              class="input input-bordered" 
              placeholder="Provincia"
              value={selectedInstitution.state || ''}
            />
          </div>
          
          <div class="form-control">
            <label class="label">
              <span class="label-text">Nombre del Responsable</span>
            </label>
            <input 
              type="text" 
              name="responsibleName"
              class="input input-bordered" 
              placeholder="Nombre del responsable"
              value={selectedInstitution.responsibleName || ''}
            />
          </div>
          
          <div class="form-control">
            <label class="label">
              <span class="label-text">Email del Responsable</span>
            </label>
            <input 
              type="email" 
              name="responsibleEmail"
              class="input input-bordered" 
              placeholder="email@ejemplo.com"
              value={selectedInstitution.responsibleEmail || ''}
            />
          </div>
          
          <div class="form-control">
            <label class="label">
              <span class="label-text">Teléfono del Responsable</span>
            </label>
            <input 
              type="tel" 
              name="responsablePhone"
              class="input input-bordered" 
              placeholder="+54 11 1234-5678"
            />
          </div>
        </div>
        
        <div class="modal-action">
          <button type="button" class="btn btn-outline" on:click={closeModals}>
            Cancelar
          </button>
          <button type="submit" class="btn btn-primary">
            Actualizar Institución
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- Modal para eliminar institución -->
{#if showDeleteModal && selectedInstitution}
  <div class="modal modal-open">
    <div class="modal-box">
      <h3 class="font-bold text-lg text-error mb-4">Confirmar Eliminación</h3>
      <p class="mb-4">
        ¿Estás seguro de que deseas eliminar la institución 
        <strong>"{selectedInstitution.name}"</strong>?
      </p>
      <p class="text-sm text-base-content/70 mb-6">
        Esta acción no se puede deshacer.
      </p>
      
      <form method="POST" action="?/delete" use:enhance>
        <input type="hidden" name="id" value={selectedInstitution.id} />
        
        <div class="modal-action">
          <button type="button" class="btn btn-outline" on:click={closeModals}>
            Cancelar
          </button>
          <button type="submit" class="btn btn-error">
            Eliminar Institución
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
