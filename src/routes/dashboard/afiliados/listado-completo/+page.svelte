<script lang="ts">
  import { goto } from '$app/navigation';
  import { MemberModal, CuotasCarnet } from '$lib/components/members';
  import type { Member, Institution } from '@prisma/client';

  type MemberWithInstitution = Member & {
    institucion: Institution | null;
  };

  let { data }: { data: {
    members: MemberWithInstitution[];
    canEdit: boolean;
    institutions: Array<{ id: string; name: string }>;
    contributionsByMember: Record<string, Array<{ monthIndex: number; amount: number }>>;
    user: { role: string };
  }} = $props();

  // Estado para modales
  let showEditModal = $state(false);
  let showDeleteModal = $state(false);
  let selectedMember: MemberWithInstitution | null = $state(null);

  // Función para navegar al detalle del miembro
  function viewMemberDetail(member: MemberWithInstitution) {
    if (member.institucionId) {
      goto(`/dashboard/instituciones/${member.institucionId}/${member.id}`);
    }
  }

  // Funciones para modales
  function openEditModal(member: MemberWithInstitution) {
    selectedMember = member;
    showEditModal = true;
  }

  function openDeleteModal(member: MemberWithInstitution) {
    selectedMember = member;
    showDeleteModal = true;
  }

  function closeModals() {
    showEditModal = false;
    showDeleteModal = false;
    selectedMember = null;
  }

  // Función para obtener cuotas pagadas del miembro
  function getCuotasPagadas(member: MemberWithInstitution): Array<{ monthIndex: number; amount: number }> {
    return data.contributionsByMember[member.id] || [];
  }
</script>

<svelte:head>
  <title>Listado Completo - SIDEPP Digital</title>
</svelte:head>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
  <div class="mb-8 flex justify-between items-start">
    <div>
      <h1 class="text-3xl font-bold text-gray-900">Listado Completo</h1>
      <p class="mt-2 text-gray-600">Vista completa de todos los afiliados ({data.members.length})</p>
    </div>
    <a
      href="/api/members/listado-completo/export"
      target="_blank"
      class="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-red-700 to-red-600 rounded-lg shadow-md hover:shadow-lg transition-all"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      Exportar PDF
    </a>
  </div>

  <div class="bg-white shadow-xl rounded-xl border border-gray-100">
    <div class="p-6">
      <div class="overflow-x-auto max-h-[70vh] overflow-y-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50 sticky top-0 z-10 shadow-sm">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Nro. Orden
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Nro. Matricula
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Nombre y Apellido
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Institución
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                DNI
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Nacionalidad
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Estado
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Fecha de Ingreso
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Cuotas Pagadas
              </th>
              {#if data.canEdit}
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Acciones
                </th>
              {/if}
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            {#each data.members as member}
              <tr class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap cursor-pointer" onclick={() => viewMemberDetail(member)}>
                  <div class="text-sm text-gray-700">{member.numeroOrden || '-'}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap cursor-pointer" onclick={() => viewMemberDetail(member)}>
                  <div class="text-sm text-gray-700">{member.numeroMatricula || '-'}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap cursor-pointer" onclick={() => viewMemberDetail(member)}>
                  <div class="text-sm font-medium text-gray-900">{member.fullName || '-'}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap cursor-pointer" onclick={() => viewMemberDetail(member)}>
                  {#if member.institucion}
                    <div class="text-sm text-red-700 hover:text-red-900">{member.institucion.name || '-'}</div>
                  {:else}
                    <div class="text-sm text-gray-400">Sin institución</div>
                  {/if}
                </td>
                <td class="px-6 py-4 whitespace-nowrap cursor-pointer" onclick={() => viewMemberDetail(member)}>
                  <div class="text-sm text-gray-700">{member.documentoIdentidad || '-'}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap cursor-pointer" onclick={() => viewMemberDetail(member)}>
                  <div class="text-sm text-gray-700">{member.nacionalidad || '-'}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap cursor-pointer" onclick={() => viewMemberDetail(member)}>
                  <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full {member.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}">
                    {member.status === 'active' ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap cursor-pointer" onclick={() => viewMemberDetail(member)}>
                  <div class="text-sm text-gray-700">
                    {member.createdAt ? new Date(member.createdAt).toLocaleDateString('es-AR') : '-'}
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <CuotasCarnet
                    cuotasPagadas={getCuotasPagadas(member)}
                    year={new Date().getFullYear()}
                  />
                </td>
                {#if data.canEdit}
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex gap-2">
                      <button
                        type="button"
                        onclick={() => viewMemberDetail(member)}
                        class="text-blue-600 hover:text-blue-900"
                        aria-label="Ver detalle"
                        title="Ver detalle"
                      >
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onclick={() => openEditModal(member)}
                        class="text-green-600 hover:text-green-900"
                        aria-label="Editar"
                        title="Editar"
                      >
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onclick={() => openDeleteModal(member)}
                        class="text-red-600 hover:text-red-900"
                        aria-label="Eliminar"
                        title="Eliminar"
                      >
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                {/if}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  </div>
</div>

<!-- Modales -->
{#if data.canEdit}
  <!-- Modal Editar -->
  <MemberModal
    showModal={showEditModal}
    modalType="edit"
    member={selectedMember}
    institutionId={selectedMember?.institucionId || ''}
    showInstitutionSelector={false}
    institutions={data.institutions}
    onClose={closeModals}
  />

  <!-- Modal Eliminar -->
  <MemberModal
    showModal={showDeleteModal}
    modalType="delete"
    member={selectedMember}
    institutionId={selectedMember?.institucionId || ''}
    onClose={closeModals}
  />
{/if}
