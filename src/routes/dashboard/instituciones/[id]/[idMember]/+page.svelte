<script lang="ts">
  import { goto } from '$app/navigation';
  import type { Member, Institution } from '@prisma/client';

  type ContributionLineData = {
    id: string;
    memberId: string | null;
    name: string | null;
    quantity: number | null;
    conceptAmount: number | null;
    totalRem: number | null;
    status: string;
    pdfFileId: string | null;
    createdAt: Date;
    updatedAt: Date;
  };

  export let data: {
    institution: Institution;
    member: Member & {
      contributions: ContributionLineData[];
    };
  };

  // Funci�n para formatear fecha
  function formatDate(date: Date | string | null) {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('es-AR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  // Funci�n para formatear moneda
  function formatCurrency(amount: number | null | undefined) {
    if (!amount) return '$0.00';
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(Number(amount));
  }

  // Funci�n para obtener badge de estado
  function getStatusBadge(status: string | null) {
    switch (status) {
      case 'MATCHED':
        return 'badge-success';
      case 'PENDING':
        return 'badge-warning';
      case 'MISSING':
        return 'badge-error';
      default:
        return 'badge-ghost';
    }
  }

  function getStatusLabel(status: string | null) {
    switch (status) {
      case 'MATCHED':
        return 'Validado';
      case 'PENDING':
        return 'Pendiente';
      case 'MISSING':
        return 'Faltante';
      default:
        return status || '-';
    }
  }
</script>

<svelte:head>
  <title>{data.member.fullName} - SIDEPP Digital</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
  <div class="container mx-auto p-6">
    <!-- Header con navegaci�n -->
    <div class="flex items-center gap-4 mb-6">
      <a href="/dashboard/instituciones/{data.institution.id}" class="btn btn-ghost btn-sm">
        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
        </svg>
        Volver a {data.institution.name}
      </a>
    </div>

    <!-- Breadcrumb - Nombre de la instituci�n -->
    <div class="text-sm breadcrumbs mb-4">
      <ul>
        <li><a href="/dashboard/instituciones">Instituciones</a></li>
        <li><a href="/dashboard/instituciones/{data.institution.id}">{data.institution.name}</a></li>
        <li>{data.member.fullName}</li>
      </ul>
    </div>

    <!-- Header del miembro -->
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-800">{data.member.fullName || 'Miembro'}</h1>
      <p class="text-gray-600">Detalle del miembro y sus contribuciones</p>
    </div>

    <!-- Grid de informaci�n -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      <!-- Informaci�n Personal -->
      <div class="card bg-white shadow-sm">
        <div class="card-body">
          <h2 class="card-title text-xl mb-4">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
            </svg>
            Información Personal
          </h2>
          <div class="space-y-3">
            <div>
              <label class="text-sm font-medium text-gray-500">Nombre Completo</label>
              <p class="text-gray-900 font-medium">{data.member.fullName || '-'}</p>
            </div>
            <div>
              <label class="text-sm font-medium text-gray-500">Documento de Identidad</label>
              <p class="text-gray-900 font-mono">{data.member.documentoIdentidad || '-'}</p>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="text-sm font-medium text-gray-500">N° Orden</label>
                <p class="text-gray-900">
                  <span class="badge badge-outline">{data.member.numeroOrden || '-'}</span>
                </p>
              </div>
              <div>
                <label class="text-sm font-medium text-gray-500">N� Matr�cula</label>
                <p class="text-gray-900">
                  <span class="badge badge-outline">{data.member.numeroMatricula || '-'}</span>
                </p>
              </div>
            </div>
            <div>
              <label class="text-sm font-medium text-gray-500">Nacionalidad</label>
              <p class="text-gray-900">{data.member.nacionalidad || 'Argentina'}</p>
            </div>
            <div>
              <label class="text-sm font-medium text-gray-500">Estado</label>
              <p>
                <span class="badge {data.member.status === 'active' ? 'badge-success' : 'badge-warning'}">
                  {data.member.status === 'active' ? 'Activo' : 'Inactivo'}
                </span>
              </p>
            </div>
            <div>
              <label class="text-sm font-medium text-gray-500">Fecha de Ingreso</label>
              <p class="text-gray-900">{formatDate(data.member.membershipStartDate)}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Informaci�n de Contacto -->
      <div class="card bg-white shadow-sm">
        <div class="card-body">
          <h2 class="card-title text-xl mb-4">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
            </svg>
            Información de Contacto
          </h2>
          <div class="space-y-3">
            <div>
              <label class="text-sm font-medium text-gray-500">Email</label>
              {#if data.member.email}
                <a href="mailto:{data.member.email}" class="text-blue-600 hover:text-blue-800 transition-colors">
                  {data.member.email}
                </a>
              {:else}
                <p class="text-gray-400">No especificado</p>
              {/if}
            </div>
            <div>
              <label class="text-sm font-medium text-gray-500">Teléfono</label>
              <p class="text-gray-900">{data.member.phone || 'No especificado'}</p>
            </div>
            <div>
              <label class="text-sm font-medium text-gray-500">Dirección</label>
              <p class="text-gray-900">{data.member.address || 'No especificada'}</p>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="text-sm font-medium text-gray-500">Ciudad</label>
                <p class="text-gray-900">{data.member.city || '-'}</p>
              </div>
              <div>
                <label class="text-sm font-medium text-gray-500">Provincia</label>
                <p class="text-gray-900">{data.member.state || '-'}</p>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="text-sm font-medium text-gray-500">Código Postal</label>
                <p class="text-gray-900">{data.member.postalCode || '-'}</p>
              </div>
              <div>
                <label class="text-sm font-medium text-gray-500">País</label>
                <p class="text-gray-900">{data.member.country || 'Argentina'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Contribuciones -->
    <div class="card bg-white shadow-sm">
      <div class="card-body">
        <h2 class="card-title text-xl mb-4">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
          </svg>
          Contribuciones
          <span class="badge badge-primary ml-2">{data.member.contributions?.length || 0}</span>
        </h2>

        {#if data.member.contributions && data.member.contributions.length > 0}
          <div class="overflow-x-auto">
            <table class="table table-zebra w-full">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Cantidad</th>
                  <th>Monto Concepto</th>
                  <th>Total Remuneración</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {#each data.member.contributions as contribution}
                  <tr>
                    <td>
                      <div class="font-medium text-gray-900">
                        {contribution.name || '-'}
                      </div>
                    </td>
                    <td>
                      <span class="badge badge-ghost">{contribution.quantity || 0}</span>
                    </td>
                    <td>
                      <span class="font-medium text-gray-900">
                        {formatCurrency(contribution.conceptAmount)}
                      </span>
                    </td>
                    <td>
                      <span class="font-semibold text-green-600">
                        {formatCurrency(contribution.totalRem)}
                      </span>
                    </td>
                    <td>
                      <span class="badge {getStatusBadge(contribution.status)}">
                        {getStatusLabel(contribution.status)}
                      </span>
                    </td>
                    <td>
                      <span class="text-sm text-gray-600">
                        {formatDate(contribution.createdAt)}
                      </span>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>

          <!-- Resumen de contribuciones -->
          <div class="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p class="text-sm text-gray-600">Total de Contribuciones</p>
                <p class="text-2xl font-bold text-gray-900">{data.member.contributions.length}</p>
              </div>
              <div>
                <p class="text-sm text-gray-600">Monto Total Conceptos</p>
                <p class="text-2xl font-bold text-blue-600">
                  {formatCurrency(
                    data.member.contributions.reduce((sum, c) => sum + Number(c.conceptAmount || 0), 0)
                  )}
                </p>
              </div>
              <div>
                <p class="text-sm text-gray-600">Total Remuneraciones</p>
                <p class="text-2xl font-bold text-green-600">
                  {formatCurrency(
                    data.member.contributions.reduce((sum, c) => sum + Number(c.totalRem || 0), 0)
                  )}
                </p>
              </div>
            </div>
          </div>
        {:else}
          <!-- Estado vac�o -->
          <div class="text-center py-12">
            <svg class="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
            <h3 class="text-lg font-medium text-gray-900 mb-2">No hay contribuciones registradas</h3>
            <p class="text-gray-500">Este miembro aún no tiene contribuciones en el sistema.</p>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>
