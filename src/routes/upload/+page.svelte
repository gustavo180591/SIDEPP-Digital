<script lang="ts">
  let file: File | null = null;
  let institutionId = '';
  let periodId = '';
  let kind: 'LISTADO' | 'TRANSFER' | '' = '';

  let isLoading = false;
  let error: string | null = null;

  async function submit(e: Event) {
    e.preventDefault();
    if (!file) {
      error = 'Por favor seleccioná un archivo PDF';
      return;
    }

    isLoading = true;
    error = null;

    try {
      const fd = new FormData();
      fd.append('file', file);
      if (institutionId) fd.append('institutionId', institutionId);
      if (periodId) fd.append('periodId', periodId);
      if (kind) fd.append('kind', kind);

      const res = await fetch('/api/files', { 
        method: 'POST', 
        body: fd 
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data?.error || 'Error al subir el archivo');
      }
      
      // Reset form on success
      file = null;
      institutionId = '';
      periodId = '';
      kind = '';
      
      // Show success message
      alert(`¡Archivo subido exitosamente!\nNombre: ${data.fileName}\nTipo: ${data.kind}`);
      
    } catch (err) {
      error = err instanceof Error ? err.message : 'Error desconocido al subir el archivo';
      console.error('Error al subir el archivo:', err);
    } finally {
      isLoading = false;
    }
  }
</script>

<div class="mx-auto max-w-2xl p-6 space-y-4">
  <h1 class="text-2xl font-semibold">Subir PDF</h1>
  
  {#if error}
    <div class="p-4 mb-4 text-red-700 bg-red-100 rounded-lg">
      {error}
    </div>
  {/if}

  <form class="space-y-4" on:submit|preventDefault={submit}>
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">
        Archivo PDF <span class="text-red-500">*</span>
      </label>
      <input 
        type="file" 
        accept="application/pdf" 
        on:change={(e: Event) => {
          file = (e.target as HTMLInputElement).files?.[0] ?? null;
          error = null;
        }}
        class="block w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-blue-500 focus:border-blue-500" 
        disabled={isLoading}
      />
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">ID de Institución</label>
        <input 
          type="text"
          placeholder="(opcional)" 
          bind:value={institutionId}
          class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
          disabled={isLoading}
        />
      </div>
      
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">ID de Período</label>
        <input 
          type="text"
          placeholder="(opcional)" 
          bind:value={periodId}
          class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
          disabled={isLoading}
        />
      </div>
      
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Tipo de Archivo</label>
        <select 
          bind:value={kind} 
          class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
          disabled={isLoading}
        >
          <option value="">Auto-detectar</option>
          <option value="LISTADO">Listado</option>
          <option value="TRANSFER">Transferencia</option>
        </select>
      </div>
    </div>

    <button 
      type="submit" 
      class="w-full flex justify-center items-center gap-2 bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
      disabled={isLoading || !file}
    >
      {#if isLoading}
        <svg class="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Subiendo...
      {:else}
        Subir PDF
      {/if}
    </button>
  </form>
  
  <hr class="my-8"/>
  
  <div>
    <h2 class="text-lg font-medium mb-4">Últimos archivos subidos</h2>
    <div class="border rounded-lg p-4 bg-gray-50">
      <iframe src="/api/files" class="w-full h-64 border-0"></iframe>
    </div>
  </div>
</div>
