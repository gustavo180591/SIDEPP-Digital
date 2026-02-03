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

  // Función para formatear fecha
  function formatDate(date: Date | string | null) {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('es-AR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  // Función para formatear moneda
  function formatCurrency(amount: number | null | undefined) {
    if (!amount) return '$0.00';
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(Number(amount));
  }

  // Función para obtener badge de estado
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

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
  <!-- Header con navegación -->
  <div class="flex items-center gap-4 mb-6">
    <a href="/dashboard/instituciones/{data.institution.id}" class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:shadow-md transition-all">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
      </svg>
      Volver a {data.institution.name}
    </a>
  </div>

  <!-- Breadcrumb -->
  <nav class="mb-6" aria-label="Breadcrumb">
    <ol class="flex items-center space-x-2 text-sm text-gray-600">
      <li>
        <a href="/dashboard/instituciones" class="hover:text-blue-600 transition-colors">Instituciones</a>
      </li>
      <li>
        <svg class="w-4 h-4 mx-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
        </svg>
      </li>
      <li>
        <a href="/dashboard/instituciones/{data.institution.id}" class="hover:text-blue-600 transition-colors">{data.institution.name}</a>
      </li>
      <li>
        <svg class="w-4 h-4 mx-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
        </svg>
      </li>
      <li class="text-gray-900 font-medium">{data.member.fullName}</li>
    </ol>
  </nav>

  <!-- Header del miembro -->
  <div class="bg-gradient-to-r from-white to-blue-50/50 rounded-xl p-6 mb-6 shadow-lg border border-blue-100">
    <div class="flex items-start gap-4">
      <div class="flex-shrink-0">
        <div class="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
          <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
          </svg>
        </div>
      </div>
      <div class="space-y-1">
        <h1 class="text-3xl font-bold text-gray-900">{data.member.fullName || 'Miembro'}</h1>
        <p class="text-gray-700 font-medium">Detalle del miembro y sus contribuciones</p>
      </div>
    </div>
  </div>

  <!-- Grid de información -->
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
    <!-- Información Personal -->
    <div class="bg-white shadow-xl rounded-xl border border-gray-100 p-6">
      <div class="flex items-center gap-3 mb-6">
        <div class="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
          <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
          </svg>
        </div>
        <h2 class="text-xl font-bold text-gray-900">Información Personal</h2>
      </div>
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
            <label class="text-sm font-medium text-gray-500">N° Matricula</label>
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

    <!-- Información de Contacto -->
    <div class="bg-white shadow-xl rounded-xl border border-gray-100 p-6">
      <div class="flex items-center gap-3 mb-6">
        <div class="w-10 h-10 bg-gradient-to-br from-green-600 to-emerald-600 rounded-xl flex items-center justify-center shadow-md">
          <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
          </svg>
        </div>
        <h2 class="text-xl font-bold text-gray-900">Información de Contacto</h2>
      </div>
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

  <!-- Contribuciones -->
  <div class="bg-white shadow-xl rounded-xl border border-gray-100 p-6">
    <div class="flex items-center gap-3 mb-6">
      <div class="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center shadow-md">
        <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
        </svg>
      </div>
      <h2 class="text-xl font-bold text-gray-900">Contribuciones</h2>
      <span class="badge badge-primary ml-2">{data.member.contributions?.length || 0}</span>
    </div>

    {#if data.member.contributions && data.member.contributions.length > 0}
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
              <th class="text-white font-medium text-xs uppercase tracking-wider px-4 py-3 text-left">Nombre</th>
              <th class="text-white font-medium text-xs uppercase tracking-wider px-4 py-3 text-left">Cantidad</th>
              <th class="text-white font-medium text-xs uppercase tracking-wider px-4 py-3 text-left">Monto Concepto</th>
              <th class="text-white font-medium text-xs uppercase tracking-wider px-4 py-3 text-left">Total Remuneración</th>
              <th class="text-white font-medium text-xs uppercase tracking-wider px-4 py-3 text-left">Estado</th>
              <th class="text-white font-medium text-xs uppercase tracking-wider px-4 py-3 text-left">Fecha</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            {#each data.member.contributions as contribution, index}
              <tr class="hover:bg-blue-50 transition-all duration-200 {index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}">
                <td class="px-4 py-3">
                  <div class="font-medium text-gray-900">
                    {contribution.name || '-'}
                  </div>
                </td>
                <td class="px-4 py-3">
                  <span class="badge badge-ghost">{contribution.quantity || 0}</span>
                </td>
                <td class="px-4 py-3">
                  <span class="font-medium text-gray-900">
                    {formatCurrency(contribution.conceptAmount)}
                  </span>
                </td>
                <td class="px-4 py-3">
                  <span class="font-semibold text-green-600">
                    {formatCurrency(contribution.totalRem)}
                  </span>
                </td>
                <td class="px-4 py-3">
                  <span class="badge {getStatusBadge(contribution.status)}">
                    {getStatusLabel(contribution.status)}
                  </span>
                </td>
                <td class="px-4 py-3">
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
      <div class="mt-6 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <p class="text-sm font-semibold text-gray-600 mb-1">Total de Contribuciones</p>
            <p class="text-3xl font-bold text-gray-900">{data.member.contributions.length}</p>
          </div>
          <div>
            <p class="text-sm font-semibold text-gray-600 mb-1">Monto Total Conceptos</p>
            <p class="text-3xl font-bold text-blue-600">
              {formatCurrency(
                data.member.contributions.reduce((sum, c) => sum + Number(c.conceptAmount || 0), 0)
              )}
            </p>
          </div>
          <div>
            <p class="text-sm font-semibold text-gray-600 mb-1">Total Remuneraciones</p>
            <p class="text-3xl font-bold text-green-600">
              {formatCurrency(
                data.member.contributions.reduce((sum, c) => sum + Number(c.totalRem || 0), 0)
              )}
            </p>
          </div>
        </div>
      </div>
    {:else}
      <!-- Estado vacío -->
      <div class="text-center py-12">
        <div class="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center">
          <svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
          </svg>
        </div>
        <h3 class="text-lg font-semibold text-gray-800 mb-2">No hay contribuciones registradas</h3>
        <p class="text-gray-600">Este miembro aún no tiene contribuciones en el sistema.</p>
      </div>
    {/if}
  </div>
</div>
