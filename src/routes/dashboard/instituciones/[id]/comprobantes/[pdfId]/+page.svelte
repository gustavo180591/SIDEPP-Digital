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
  <title>Detalles del Comprobante - {data.institution?.name || 'Institución'} - SIDEPP Digital</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-red-50 to-red-100">
  <div class="container mx-auto p-6">
    <!-- Header con navegación -->
    <div class="flex items-center gap-4 mb-6">
      {#if data.user?.role === 'ADMIN'}
      <a href="/dashboard/instituciones" class="btn btn-ghost btn-sm">
        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
        </svg>
        Volver a Instituciones
      </a>
      {/if}
      <a href="/dashboard/instituciones/{data.institution?.id}" class="btn btn-ghost btn-sm">
        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
        </svg>
        Ver Institución
      </a>
      <a href="/dashboard/instituciones/{data.institution?.id}/comprobantes" class="btn btn-ghost btn-sm">
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
      <!-- Información del Archivo -->
      <div class="bg-white rounded-xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-shadow duration-300">
        <div class="flex items-center gap-3 mb-6">
          <div class="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-red-600 to-red-700 rounded-lg">
            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
          </div>
          <h2 class="text-xl font-bold text-gray-900">Información del Archivo</h2>
        </div>

        <div class="space-y-4">
          <div class="flex items-start gap-3">
            <svg class="w-5 h-5 text-gray-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
            </svg>
            <div class="flex-1">
              <label class="text-sm font-medium text-gray-500">Archivo</label>
              <p class="text-gray-900 font-mono text-sm break-all">{data.pdfFile?.fileName || 'Sin nombre'}</p>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path>
            </svg>
            <div class="flex-1">
              <label class="text-sm font-medium text-gray-500">Tipo de Documento</label>
              <div class="mt-1">
                <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold {data.pdfFile?.type === 'COMPROBANTE' ? 'bg-red-100 text-red-900' : 'bg-red-100 text-red-800'}">
                  {data.pdfFile?.type || 'Sin tipo'}
                </span>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
            </svg>
            <div class="flex-1">
              <label class="text-sm font-medium text-gray-500">Fecha de Carga</label>
              <p class="text-gray-900">{data.pdfFile?.createdAt ? formatDate(data.pdfFile.createdAt) : 'No especificada'}</p>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
            </svg>
            <div class="flex-1">
              <label class="text-sm font-medium text-gray-500">Período</label>
              <p class="text-gray-900 font-semibold">
                {(data.payroll?.month || 0).toString().padStart(2, '0')}/{data.payroll?.year || 0}
              </p>
            </div>
          </div>

          <div class="flex items-start gap-3">
            <svg class="w-5 h-5 text-gray-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h7"></path>
            </svg>
            <div class="flex-1">
              <label class="text-sm font-medium text-gray-500">Concepto</label>
              <p class="text-gray-900">{data.pdfFile?.concept || data.payroll?.concept || 'Sin concepto'}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Resumen - Condicional por tipo -->
      {#if data.pdfFile?.type === 'COMPROBANTE'}
        <!-- Resumen del Comprobante -->
        <div class="bg-white rounded-xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-shadow duration-300">
          <div class="flex items-center gap-3 mb-6">
            <div class="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg">
              <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <h2 class="text-xl font-bold text-gray-900">Resumen Financiero</h2>
          </div>

          <div class="space-y-4">
            <div class="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
              <label class="text-sm font-medium text-green-700">Monto Total</label>
              <p class="text-3xl font-bold text-green-600 mt-1">
                {formatCurrency(data.pdfFile?.totalAmount || 0)}
              </p>
            </div>

            {#if data.pdfFile?.metadata}
              <div class="mt-4">
                <label class="text-sm font-medium text-gray-700 mb-2 block">Metadata del Documento</label>
                <div class="bg-gray-50 rounded-lg p-3 border border-gray-200 max-h-48 overflow-y-auto">
                  <pre class="text-xs text-gray-600 whitespace-pre-wrap">{JSON.stringify(data.pdfFile.metadata, null, 2)}</pre>
                </div>
              </div>
            {/if}
          </div>
        </div>
      {:else if ['SUELDO', 'FOPID', 'AGUINALDO'].includes(data.pdfFile?.type)}
        <!-- Resumen con detalles de afiliados -->
        <div class="bg-white rounded-xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-shadow duration-300">
          <div class="flex items-center gap-3 mb-6">
            <div class="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-red-600 to-red-700 rounded-lg">
              <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
              </svg>
            </div>
            <h2 class="text-xl font-bold text-gray-900">Resumen de Aportes</h2>
          </div>

          <div class="space-y-4">
            <div class="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-4 border border-purple-200">
              <label class="text-sm font-medium text-purple-700">Cantidad de Afiliados</label>
              <p class="text-3xl font-bold text-purple-600 mt-1">{data.pdfFile?.peopleCount || 0}</p>
            </div>

            <div class="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-4 border border-red-200">
              <label class="text-sm font-medium text-red-800">Total Remunerativo</label>
              <p class="text-2xl font-bold text-red-700 mt-1">
                {formatCurrency(data.contributionLines?.reduce((acc, line) => acc + (Number(line.totalRem) || 0), 0) || 0)}
              </p>
            </div>

            <div class="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
              <label class="text-sm font-medium text-green-700">Total del Concepto</label>
              <p class="text-2xl font-bold text-green-600 mt-1">
                {formatCurrency(data.contributionLines?.reduce((acc, line) => acc + (Number(line.conceptAmount) || 0), 0) || data.pdfFile?.totalAmount || 0)}
              </p>
            </div>
          </div>
        </div>
      {/if}
    </div>

    <!-- Información de Transferencia Bancaria -->
    {#if data.payroll?.transfer}
      <div class="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-6 hover:shadow-xl transition-shadow duration-300">
        <div class="flex items-center gap-3 mb-6">
          <div class="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg">
            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path>
            </svg>
          </div>
          <div class="flex-1">
            <h2 class="text-xl font-bold text-gray-900">Transferencia Bancaria</h2>
            <p class="text-sm text-gray-500">Información del pago realizado</p>
          </div>
          <div>
            <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
              <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
              </svg>
              Completada
            </span>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div class="flex items-start gap-3 bg-gray-50 rounded-lg p-4">
            <svg class="w-5 h-5 text-emerald-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
            </svg>
            <div class="flex-1 min-w-0">
              <label class="text-xs font-medium text-gray-500 uppercase tracking-wide">Fecha</label>
              <p class="text-sm text-gray-900 font-semibold mt-0.5">
                {data.payroll.transfer?.datetime ? formatDate(data.payroll.transfer.datetime) : 'No especificada'}
              </p>
            </div>
          </div>

          <div class="flex items-start gap-3 bg-gray-50 rounded-lg p-4">
            <svg class="w-5 h-5 text-emerald-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"></path>
            </svg>
            <div class="flex-1 min-w-0">
              <label class="text-xs font-medium text-gray-500 uppercase tracking-wide">Nº Operación</label>
              <p class="text-sm text-gray-900 font-mono font-semibold mt-0.5 truncate">{data.payroll.transfer?.operationNo || '-'}</p>
            </div>
          </div>

          <div class="flex items-start gap-3 bg-gray-50 rounded-lg p-4">
            <svg class="w-5 h-5 text-emerald-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
            <div class="flex-1 min-w-0">
              <label class="text-xs font-medium text-gray-500 uppercase tracking-wide">Referencia</label>
              <p class="text-sm text-gray-900 font-semibold mt-0.5 truncate">{data.payroll.transfer?.reference || '-'}</p>
            </div>
          </div>

          <div class="flex items-start gap-3 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200 md:col-span-2 lg:col-span-1">
            <svg class="w-5 h-5 text-green-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <div class="flex-1 min-w-0">
              <label class="text-xs font-medium text-green-700 uppercase tracking-wide">Importe</label>
              <p class="text-lg text-green-600 font-bold mt-0.5">
                {formatCurrency(data.payroll.transfer?.importe || 0)}
              </p>
            </div>
          </div>

          <div class="flex items-start gap-3 bg-gray-50 rounded-lg p-4 md:col-span-2">
            <svg class="w-5 h-5 text-emerald-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path>
            </svg>
            <div class="flex-1 min-w-0">
              <label class="text-xs font-medium text-gray-500 uppercase tracking-wide">CBU Destino</label>
              <p class="text-sm text-gray-900 font-mono font-semibold mt-0.5 break-all">{data.payroll.transfer?.cbuDestino || '-'}</p>
            </div>
          </div>

          <div class="flex items-start gap-3 bg-gray-50 rounded-lg p-4">
            <svg class="w-5 h-5 text-emerald-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
            </svg>
            <div class="flex-1 min-w-0">
              <label class="text-xs font-medium text-gray-500 uppercase tracking-wide">Titular</label>
              <p class="text-sm text-gray-900 font-semibold mt-0.5">{data.payroll.transfer?.titular || '-'}</p>
            </div>
          </div>
        </div>
      </div>
    {/if}

    <!-- Detalle por Afiliado - Solo para SUELDO, FOPID, AGUINALDO -->
    {#if data.pdfFile?.type === 'COMPROBANTE'}
      <!-- Información adicional para Comprobantes -->
      <div class="bg-white rounded-xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-shadow duration-300">
        <div class="flex items-center gap-4 mb-6">
          <div class="flex items-center justify-center w-14 h-14 bg-gradient-to-br from-red-600 to-red-700 rounded-xl">
            <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
          </div>
          <div class="flex-1">
            <h2 class="text-xl font-bold text-gray-900">Comprobante de Pago</h2>
            <p class="text-sm text-gray-600">Documento general sin detalles individuales</p>
          </div>
        </div>

        <div class="bg-gradient-to-r from-red-50 to-red-100 border-l-4 border-red-500 rounded-lg p-5">
          <div class="flex items-start gap-4">
            <div class="flex-shrink-0">
              <div class="flex items-center justify-center w-10 h-10 bg-red-500 rounded-lg">
                <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              </div>
            </div>
            <div class="flex-1">
              <h3 class="text-sm font-bold text-red-900 mb-2">Sobre este tipo de documento</h3>
              <p class="text-sm text-red-900 leading-relaxed">
                Los comprobantes de tipo <span class="font-semibold">COMPROBANTE</span> son documentos de respaldo que certifican el pago realizado.
                No contienen información detallada de aportes individuales. Para consultar los detalles por afiliado, revise los documentos de tipo
                <span class="font-semibold">SUELDO</span>, <span class="font-semibold">FOPID</span> o <span class="font-semibold">AGUINALDO</span> del mismo período.
              </p>
            </div>
          </div>
        </div>
      </div>
    {:else if ['SUELDO', 'FOPID', 'AGUINALDO'].includes(data.pdfFile?.type)}
      <div class="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-shadow duration-300">
        <div class="bg-gradient-to-r from-red-50 to-red-100 px-6 py-5 border-b border-gray-200">
          <div class="flex items-center gap-3">
            <div class="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-red-600 to-red-700 rounded-lg">
              <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
              </svg>
            </div>
            <div class="flex-1">
              <h2 class="text-xl font-bold text-gray-900">Contribuciones por Afiliado</h2>
              <p class="text-sm text-gray-600">Detalle de aportes individuales</p>
            </div>
            {#if data.contributionLines && data.contributionLines.length > 0}
              <div class="text-right">
                <span class="text-sm text-gray-500">Total de registros</span>
                <p class="text-2xl font-bold text-red-700">{data.contributionLines.length}</p>
              </div>
            {/if}
          </div>
        </div>

        {#if data.contributionLines && data.contributionLines.length > 0}
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-gray-50 border-b-2 border-gray-200">
                <tr>
                  <th class="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Afiliado</th>
                  <th class="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Concepto</th>
                  <th class="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Cantidad</th>
                  <th class="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">Remuneración Total</th>
                  <th class="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">Aporte del Concepto</th>
                  
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200">
                {#each data.contributionLines as line, index}
                  <tr class="hover:bg-gray-50 transition-colors duration-150 {index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}">
                    <td class="px-6 py-4 whitespace-nowrap">
                      {#if line.member}
                        <div class="flex items-center gap-3">
                          <div class="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-red-600 to-red-700 rounded-full text-white font-bold text-sm">
                            {line.member.fullName ? line.member.fullName.substring(0, 2).toUpperCase() : 'NA'}
                          </div>
                          <div>
                            <div class="text-sm font-semibold text-gray-900">{line.member.fullName || 'Sin nombre'}</div>
                            <div class="text-xs text-gray-500">DNI: {line.member.documentoIdentidad || '-'}</div>
                          </div>
                        </div>
                      {:else}
                        <span class="text-sm text-gray-500 italic">Sin afiliado asignado</span>
                      {/if}
                    </td>
                    <td class="px-6 py-4">
                      <div class="text-sm font-medium text-gray-900">{line.name || 'Sin nombre'}</div>
                    </td>
                    <td class="px-6 py-4 text-center">
                      <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">
                        {line.quantity || 0}
                      </span>
                    </td>
                    <td class="px-6 py-4 text-right">
                      <div class="text-sm font-bold text-red-700">
                        {formatCurrency(line.totalRem || 0)}
                      </div>
                    </td>
                    <td class="px-6 py-4 text-right">
                      <div class="text-sm font-bold text-green-600">
                        {formatCurrency(line.conceptAmount || 0)}
                      </div>
                    </td>
                    
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {:else}
          <div class="text-center py-16 px-6">
            <div class="flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mx-auto mb-4">
              <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
            </div>
            <h3 class="text-lg font-semibold text-gray-900 mb-2">No hay contribuciones registradas</h3>
            <p class="text-sm text-gray-500">Este archivo no tiene líneas de contribución asociadas.</p>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>