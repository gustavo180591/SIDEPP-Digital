<script lang="ts">
  import { goto } from '$app/navigation';
  import { PageHeader } from '$lib/components/shared';
  import type { PdfFileWithPeriod } from '$lib/db/services/pdfService';
  import type { ContributionLine } from '@prisma/client';
  
  export let data: any;

  // Función para obtener el estado de la transferencia
  function getTransferStatus(transfer: any) {
    if (!transfer) return { text: 'Pendiente', class: 'badge-warning' };
    return { text: 'Completada', class: 'badge-success' };
  }

  // Función para formatear fecha
  function formatDate(date: Date | string) {
    return new Date(date).toLocaleDateString('es-AR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  // Función para formatear moneda
  function formatCurrency(amount: number | string) {
    return Number(amount).toLocaleString('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2
    });
  }
</script>

<svelte:head>
  <title>Detalles del Comprobante - {data.institution.name} - SIDEPP Digital</title>
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
      <a href="/instituciones/{data.institution.id}/comprobantes" class="btn btn-ghost btn-sm">
        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
        </svg>
        Ver Comprobantes
      </a>
    </div>

    <!-- Header del comprobante -->
    <PageHeader 
      title="Detalles del Comprobante"
      description="Información detallada del comprobante de pago"
    />

    <!-- Información del Comprobante -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      <!-- Información del PDF -->
      <div class="card bg-white shadow-sm">
        <div class="card-body">
          <h2 class="card-title text-xl mb-4">Información del Archivo</h2>
          <div class="space-y-3">
            <div>
              <label class="text-sm font-medium text-gray-500">Nombre del Archivo</label>
              <p class="text-gray-900 font-mono">{data.pdfFile.fileName}</p>
            </div>
            <div>
              <label class="text-sm font-medium text-gray-500">Fecha de Subida</label>
              <p class="text-gray-900">{formatDate(data.pdfFile.createdAt)}</p>
            </div>
            <div>
              <label class="text-sm font-medium text-gray-500">Período</label>
              <p class="text-gray-900">
                {data.pdfFile.period.month.toString().padStart(2, '0')}/{data.pdfFile.period.year}
              </p>
            </div>
            <div>
              <label class="text-sm font-medium text-gray-500">Concepto</label>
              <p class="text-gray-900">{data.pdfFile.period.concept || 'Sin concepto'}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Información del Período de Nómina -->
      <div class="card bg-white shadow-sm">
        <div class="card-body">
          <h2 class="card-title text-xl mb-4">Período de Nómina</h2>
          <div class="space-y-3">
            <div>
              <label class="text-sm font-medium text-gray-500">Cantidad de Personas</label>
              <p class="text-gray-900 text-2xl font-bold">{data.pdfFile.period.peopleCount || 0}</p>
            </div>
            <div>
              <label class="text-sm font-medium text-gray-500">Monto Total</label>
              <p class="text-gray-900 text-2xl font-bold text-green-600">
                {formatCurrency(data.pdfFile.period.totalAmount || 0)}
              </p>
            </div>
            <div>
              <label class="text-sm font-medium text-gray-500">Estado de Transferencia</label>
              <div class="mt-1">
                {@const status = getTransferStatus(data.pdfFile.period.transfer)}
                <span class="badge {status.class}">{status.text}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Información de Transferencia Bancaria -->
    {#if data.pdfFile.period.transfer}
      <div class="card bg-white shadow-sm mb-6">
        <div class="card-body">
          <h2 class="card-title text-xl mb-4">Transferencia Bancaria</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="text-sm font-medium text-gray-500">Fecha de Transferencia</label>
              <p class="text-gray-900">
                {data.pdfFile.period.transfer.datetime ? formatDate(data.pdfFile.period.transfer.datetime) : 'No especificada'}
              </p>
            </div>
            <div>
              <label class="text-sm font-medium text-gray-500">Número de Operación</label>
              <p class="text-gray-900 font-mono">{data.pdfFile.period.transfer.operationNo || 'No especificado'}</p>
            </div>
            <div>
              <label class="text-sm font-medium text-gray-500">Referencia</label>
              <p class="text-gray-900">{data.pdfFile.period.transfer.reference || 'No especificada'}</p>
            </div>
            <div>
              <label class="text-sm font-medium text-gray-500">Importe</label>
              <p class="text-gray-900 text-xl font-bold text-green-600">
                {formatCurrency(data.pdfFile.period.transfer.importe)}
              </p>
            </div>
            <div>
              <label class="text-sm font-medium text-gray-500">CBU Destino</label>
              <p class="text-gray-900 font-mono">{data.pdfFile.period.transfer.cbuDestino || 'No especificado'}</p>
            </div>
            <div>
              <label class="text-sm font-medium text-gray-500">Titular</label>
              <p class="text-gray-900">{data.pdfFile.period.transfer.titular || 'No especificado'}</p>
            </div>
          </div>
        </div>
      </div>
    {/if}

    <!-- Líneas de Contribución -->
    <div class="card bg-white shadow-sm">
      <div class="card-body">
        <h2 class="card-title text-xl mb-4">Líneas de Contribución</h2>
        
        {#if data.contributionLines && data.contributionLines.length > 0}
          <div class="overflow-x-auto">
            <table class="table table-zebra w-full">
              <thead>
                <tr>
                  <th>Miembro</th>
                  <th>Concepto</th>
                  <th>Cantidad</th>
                  <th>Monto por Concepto</th>
                  <th>Total REM</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {#each data.contributionLines as line}
                  <tr>
                    <td>
                      {#if line.member}
                        <div>
                          <div class="font-medium">{line.member.firstName} {line.member.lastName}</div>
                          <div class="text-sm text-gray-500">DNI: {line.member.documentoIdentidad}</div>
                        </div>
                      {:else}
                        <span class="text-gray-500">Sin miembro asignado</span>
                      {/if}
                    </td>
                    <td>
                      <div class="font-medium">{line.name || 'Sin nombre'}</div>
                    </td>
                    <td>
                      <span class="badge badge-outline">{line.quantity || 0}</span>
                    </td>
                    <td>
                      <div class="text-right">
                        {formatCurrency(line.conceptAmount || 0)}
                      </div>
                    </td>
                    <td>
                      <div class="text-right font-medium">
                        {formatCurrency(line.totalRem || 0)}
                      </div>
                    </td>
                    <td>
                      <span class="badge {line.status === 'PENDING' ? 'badge-warning' : line.status === 'MATCHED' ? 'badge-success' : 'badge-error'}">
                        {line.status === 'PENDING' ? 'Pendiente' : line.status === 'MATCHED' ? 'Coincide' : 'Faltante'}
                      </span>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {:else}
          <div class="text-center py-8">
            <svg class="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
            <h3 class="text-lg font-medium text-gray-900 mb-2">No hay líneas de contribución</h3>
            <p class="text-gray-500">Este comprobante no tiene líneas de contribución asociadas.</p>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>