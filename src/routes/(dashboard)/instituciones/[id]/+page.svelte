<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  
  export let data: any;
  
  let showEditModal = false;
  let showDeleteModal = false;
  
  // Función para abrir modal de edición
  function openEditModal() {
    showEditModal = true;
  }
  
  // Función para abrir modal de eliminación
  function openDeleteModal() {
    showDeleteModal = true;
  }
  
  // Función para cerrar modales
  function closeModals() {
    showEditModal = false;
    showDeleteModal = false;
  }
  
  // Función para eliminar institución
  async function deleteInstitution() {
    try {
      const response = await fetch(`/api/institutions/${data.institution.id}`, {
        method: 'DELETE'
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
</script>

<svelte:head>
  <title>{data.institution.name} - SIDEPP Digital</title>
</svelte:head>

<div class="container mx-auto p-6">
  <!-- Header con navegación -->
  <div class="flex items-center gap-4 mb-6">
    <a href="/instituciones" class="btn btn-ghost btn-sm">
      <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
      </svg>
      Volver a Instituciones
    </a>
    <div class="divider divider-horizontal"></div>
    <div>
      <h1 class="text-3xl font-bold text-base-content">{data.institution.name}</h1>
      <p class="text-base-content/70 mt-1">Detalle de la institución</p>
    </div>
  </div>

  <!-- Acciones -->
  <div class="flex gap-2 mb-6">
    <button class="btn btn-primary" on:click={openEditModal}>
      <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
      </svg>
      Editar Institución
    </button>
    <button class="btn btn-error" on:click={openDeleteModal}>
      <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
      </svg>
      Eliminar Institución
    </button>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <!-- Información de la Institución -->
    <div class="card bg-base-100 shadow-sm">
      <div class="card-body">
        <h2 class="card-title text-xl mb-4">Información General</h2>
        
        <div class="space-y-4">
          <div class="flex justify-between items-center">
            <span class="font-semibold text-base-content/70">Nombre:</span>
            <span class="text-base-content">{data.institution.name}</span>
          </div>
          
          {#if data.institution.cuit}
            <div class="flex justify-between items-center">
              <span class="font-semibold text-base-content/70">CUIT:</span>
              <span class="badge badge-outline">{data.institution.cuit}</span>
            </div>
          {/if}
          
          {#if data.institution.address}
            <div class="flex justify-between items-start">
              <span class="font-semibold text-base-content/70">Dirección:</span>
              <span class="text-base-content text-right">{data.institution.address}</span>
            </div>
          {/if}
          
          <div class="flex justify-between items-center">
            <span class="font-semibold text-base-content/70">Ciudad:</span>
            <span class="text-base-content">{data.institution.city || '-'}</span>
          </div>
          
          <div class="flex justify-between items-center">
            <span class="font-semibold text-base-content/70">Provincia:</span>
            <span class="text-base-content">{data.institution.state || '-'}</span>
          </div>
          
          <div class="flex justify-between items-center">
            <span class="font-semibold text-base-content/70">País:</span>
            <span class="text-base-content">{data.institution.country || '-'}</span>
          </div>
          
          <div class="flex justify-between items-center">
            <span class="font-semibold text-base-content/70">Fecha de Creación:</span>
            <span class="text-base-content">{new Date(data.institution.createdAt).toLocaleDateString('es-AR')}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Información del Responsable -->
    <div class="card bg-base-100 shadow-sm">
      <div class="card-body">
        <h2 class="card-title text-xl mb-4">Responsable</h2>
        
        <div class="space-y-4">
          <div class="flex justify-between items-center">
            <span class="font-semibold text-base-content/70">Nombre:</span>
            <span class="text-base-content">{data.institution.responsibleName || '-'}</span>
          </div>
          
          {#if data.institution.responsibleEmail}
            <div class="flex justify-between items-center">
              <span class="font-semibold text-base-content/70">Email:</span>
              <a href="mailto:{data.institution.responsibleEmail}" class="link link-primary">
                {data.institution.responsibleEmail}
              </a>
            </div>
          {/if}
          
          {#if data.institution.responsiblePhone}
            <div class="flex justify-between items-center">
              <span class="font-semibold text-base-content/70">Teléfono:</span>
              <a href="tel:{data.institution.responsiblePhone}" class="link link-primary">
                {data.institution.responsiblePhone}
              </a>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>

  <!-- Lista de Miembros -->
  <div class="card bg-base-100 shadow-sm mt-6">
    <div class="card-body">
      <div class="flex justify-between items-center mb-4">
        <h2 class="card-title text-xl">Miembros de la Institución</h2>
        <button class="btn btn-primary btn-sm">
          <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
          </svg>
          Agregar Miembro
        </button>
      </div>
      
      {#if data.members && data.members.length > 0}
        <div class="overflow-x-auto">
          <table class="table table-zebra">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>N° Orden</th>
                <th>N° Matrícula</th>
                <th>Estado</th>
                <th>Fecha de Ingreso</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {#each data.members as member}
                <tr>
                  <td>
                    <div class="font-semibold">{member.firstName} {member.lastName}</div>
                  </td>
                  <td>
                    {#if member.email}
                      <a href="mailto:{member.email}" class="link link-primary">
                        {member.email}
                      </a>
                    {:else}
                      <span class="text-base-content/50">-</span>
                    {/if}
                  </td>
                  <td>
                    <span class="badge badge-outline">{member.numeroOrden}</span>
                  </td>
                  <td>
                    <span class="badge badge-outline">{member.numeroMatricula}</span>
                  </td>
                  <td>
                    <span class="badge {member.status === 'active' ? 'badge-success' : 'badge-warning'}">
                      {member.status === 'active' ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td>
                    <div class="text-sm text-base-content/70">
                      {new Date(member.createdAt).toLocaleDateString('es-AR')}
                    </div>
                  </td>
                  <td>
                    <div class="flex gap-2">
                      <button class="btn btn-sm btn-outline btn-info">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                        </svg>
                        Editar
                      </button>
                      <button class="btn btn-sm btn-outline btn-error">
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
      {:else}
        <div class="text-center py-12">
          <svg class="w-16 h-16 mx-auto text-base-content/30 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"></path>
          </svg>
          <h3 class="text-lg font-semibold text-base-content/70 mb-2">No hay miembros</h3>
          <p class="text-base-content/50 mb-4">Esta institución no tiene miembros registrados</p>
          <button class="btn btn-primary">
            Agregar Primer Miembro
          </button>
        </div>
      {/if}
    </div>
  </div>
</div>

<!-- Modal para editar institución -->
{#if showEditModal}
  <div class="modal modal-open">
    <div class="modal-box w-11/12 max-w-2xl">
      <h3 class="font-bold text-lg mb-4">Editar Institución</h3>
      
      <form method="POST" action="?/update">
        <input type="hidden" name="id" value={data.institution.id} />
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="form-control md:col-span-2">
            <label class="label" for="edit-name">
              <span class="label-text">Nombre de la Institución *</span>
            </label>
            <input 
              id="edit-name"
              type="text" 
              name="name"
              class="input input-bordered" 
              placeholder="Nombre de la institución"
              value={data.institution.name}
              required
            />
          </div>
          
          <div class="form-control">
            <label class="label" for="edit-cuit">
              <span class="label-text">CUIT</span>
            </label>
            <input 
              id="edit-cuit"
              type="text" 
              name="cuit"
              class="input input-bordered" 
              placeholder="20-12345678-9"
              value={data.institution.cuit || ''}
            />
          </div>
          
          <div class="form-control">
            <label class="label" for="edit-country">
              <span class="label-text">País</span>
            </label>
            <input 
              id="edit-country"
              type="text" 
              name="country"
              class="input input-bordered" 
              placeholder="Argentina"
              value={data.institution.country || 'Argentina'}
            />
          </div>
          
          <div class="form-control">
            <label class="label" for="edit-address">
              <span class="label-text">Dirección</span>
            </label>
            <input 
              id="edit-address"
              type="text" 
              name="address"
              class="input input-bordered" 
              placeholder="Dirección"
              value={data.institution.address || ''}
            />
          </div>
          
          <div class="form-control">
            <label class="label" for="edit-city">
              <span class="label-text">Ciudad</span>
            </label>
            <input 
              id="edit-city"
              type="text" 
              name="city"
              class="input input-bordered" 
              placeholder="Ciudad"
              value={data.institution.city || ''}
            />
          </div>
          
          <div class="form-control">
            <label class="label" for="edit-state">
              <span class="label-text">Provincia</span>
            </label>
            <input 
              id="edit-state"
              type="text" 
              name="state"
              class="input input-bordered" 
              placeholder="Provincia"
              value={data.institution.state || ''}
            />
          </div>
          
          <div class="form-control">
            <label class="label" for="edit-responsible-name">
              <span class="label-text">Nombre del Responsable</span>
            </label>
            <input 
              id="edit-responsible-name"
              type="text" 
              name="responsibleName"
              class="input input-bordered" 
              placeholder="Nombre del responsable"
              value={data.institution.responsibleName || ''}
            />
          </div>
          
          <div class="form-control">
            <label class="label" for="edit-responsible-email">
              <span class="label-text">Email del Responsable</span>
            </label>
            <input 
              id="edit-responsible-email"
              type="email" 
              name="responsibleEmail"
              class="input input-bordered" 
              placeholder="email@ejemplo.com"
              value={data.institution.responsibleEmail || ''}
            />
          </div>
          
          <div class="form-control">
            <label class="label" for="edit-responsible-phone">
              <span class="label-text">Teléfono del Responsable</span>
            </label>
            <input 
              id="edit-responsible-phone"
              type="tel" 
              name="responsiblePhone"
              class="input input-bordered" 
              placeholder="+54 11 1234-5678"
              value={data.institution.responsiblePhone || ''}
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
{#if showDeleteModal}
  <div class="modal modal-open">
    <div class="modal-box">
      <h3 class="font-bold text-lg text-error mb-4">Confirmar Eliminación</h3>
      <p class="mb-4">
        ¿Estás seguro de que deseas eliminar la institución 
        <strong>"{data.institution.name}"</strong>?
      </p>
      <p class="text-sm text-base-content/70 mb-6">
        Esta acción no se puede deshacer.
      </p>
      
      <div class="modal-action">
        <button type="button" class="btn btn-outline" on:click={closeModals}>
          Cancelar
        </button>
        <button type="button" class="btn btn-error" on:click={deleteInstitution}>
          Eliminar Institución
        </button>
      </div>
    </div>
  </div>
{/if}
