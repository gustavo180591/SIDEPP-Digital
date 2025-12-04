<script lang="ts">
  import FileUploadForm from '$lib/components/FileUploadForm.svelte';

  export let data: {
    institutions: Array<{ id: string; name: string | null }>;
    userRole: 'ADMIN' | 'FINANZAS' | 'LIQUIDADOR';
  };
</script>

<svelte:head>
  <title>Subir Archivos - SIDEPP Digital</title>
</svelte:head>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
  <div class="max-w-4xl mx-auto">
    <!-- Header -->
    <div class="bg-gradient-to-r from-white to-blue-50/50 rounded-xl p-6 mb-6 shadow-lg border border-blue-100">
      <div class="flex items-start gap-4">
        <div class="flex-shrink-0">
          <div class="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
            <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
            </svg>
          </div>
        </div>
        <div class="space-y-1">
          <h1 class="text-3xl font-bold text-gray-900">Analizador de PDF</h1>
          <p class="text-gray-700 font-medium">Sube archivos PDF para procesar y analizar comprobantes de pago</p>
        </div>
      </div>
    </div>

    <!-- Upload Form -->
    <FileUploadForm institutions={data.institutions} />
  </div>
</div>
