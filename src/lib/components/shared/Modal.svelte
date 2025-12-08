<script lang="ts">
  import { enhance } from '$app/forms';
  import SearchableSelect from './SearchableSelect.svelte';

  export let showModal: boolean;
  export let title: string;
  export let type: 'create' | 'edit' | 'delete' = 'create';
  export let onClose: () => void;
  export let submitLabel: string = 'Guardar';
  export let cancelLabel: string = 'Cancelar';
  export let formAction: string = '';
  export let formData: Record<string, any> = {};
  export let fields: Array<{
    name: string;
    label: string;
    type: string;
    placeholder?: string;
    required?: boolean;
    value?: any;
    span?: number; // Para grid cols
    options?: Array<{ value: string; label: string }>; // Para campos select
    readonly?: boolean; // Para campos de solo lectura
  }> = [];
  export let deleteMessage: string = '';
  export let deleteItemName: string = '';
  export let onDelete: (() => void) | null = null;

  // Estados de feedback
  let loading = false;
  let error: string | null = null;

  // Reset error cuando se abre el modal
  $: if (showModal) {
    error = null;
  }
</script>

{#if showModal}
  <div class="fixed inset-0 z-50 overflow-y-auto animate-fade-in">
    <!-- Backdrop with blur -->
    <div class="fixed inset-0 bg-gray-900/50 backdrop-blur-sm" on:click={onClose}></div>

    <!-- Modal container -->
    <div class="flex min-h-screen items-center justify-center p-4">
      <div class="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full animate-slide-in-up border border-gray-200">
        <div class="p-6">
          <h3 class="font-bold text-2xl mb-6 text-gray-900">{title}</h3>
      
          {#if type === 'delete'}
            <!-- Mensaje de error para delete -->
            {#if error}
              <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <div class="flex items-center gap-2">
                  <svg class="w-5 h-5 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <p class="text-sm text-red-700">{error}</p>
                </div>
              </div>
            {/if}

            <div class="bg-red-50 border border-red-200 rounded-xl p-6 mb-6">
              <div class="flex items-start gap-3">
                <div class="flex-shrink-0">
                  <div class="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                    <svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3l-6.928-12.5a2 2 0 00-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                    </svg>
                  </div>
                </div>
                <div>
                  <p class="text-gray-800 font-medium mb-2 whitespace-pre-line">
                    {deleteMessage || `¿Estás seguro de que deseas eliminar ${deleteItemName}?`}
                  </p>
                </div>
              </div>
            </div>
            <div class="flex justify-end gap-3">
              <button
                class="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                on:click={onClose}
                disabled={loading}
              >
                {cancelLabel}
              </button>
              {#if onDelete}
                <button
                  class="px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-red-600 to-red-700 rounded-lg hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-red-500 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  on:click={onDelete}
                  disabled={loading}
                >
                  {#if loading}
                    <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Procesando...
                  {:else}
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                    </svg>
                    Eliminar
                  {/if}
                </button>
              {:else}
                <button
                  class="px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-red-600 to-red-700 rounded-lg hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-red-500 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  form="delete-form"
                  disabled={loading}
                >
                  {#if loading}
                    <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Procesando...
                  {:else}
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                    </svg>
                    Eliminar
                  {/if}
                </button>
              {/if}
            </div>
        <form
          id="delete-form"
          method="POST"
          action={formAction}
          use:enhance={() => {
            loading = true;
            error = null;
            return async ({ result, update }) => {
              loading = false;
              if (result.type === 'success' || (result.type === 'failure' && result.data?.success)) {
                onClose();
              } else if (result.type === 'failure') {
                error = result.data?.error || 'Error al procesar la solicitud';
              } else if (result.type === 'error') {
                error = result.error?.message || 'Error inesperado';
              }
              await update();
            };
          }}
        >
          {#each Object.entries(formData) as [key, value]}
            <input type="hidden" name={key} value={value} />
          {/each}
        </form>
      {:else}
        <!-- Mensaje de error -->
        {#if error}
          <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <div class="flex items-center gap-2">
              <svg class="w-5 h-5 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <p class="text-sm text-red-700">{error}</p>
            </div>
          </div>
        {/if}

        <form
          method="POST"
          action={formAction}
          use:enhance={() => {
            loading = true;
            error = null;
            return async ({ result, update }) => {
              loading = false;
              if (result.type === 'success' || (result.type === 'failure' && result.data?.success)) {
                onClose();
              } else if (result.type === 'failure') {
                error = result.data?.error || 'Error al procesar la solicitud';
              } else if (result.type === 'error') {
                error = result.error?.message || 'Error inesperado';
              }
              await update();
            };
          }}
        >
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            {#each fields as field}
              <div class="form-control {field.span === 2 ? 'md:col-span-2' : ''}">
                <label class="label" for={field.name}>
                  <span class="label-text">{field.label} {field.required ? '*' : ''}</span>
                </label>
                {#if field.type === 'select'}
                  <SearchableSelect
                    options={field.options || []}
                    value={field.value || ''}
                    placeholder={field.placeholder || 'Buscar...'}
                    required={field.required}
                    disabled={field.readonly}
                    name={field.name}
                  />
                {:else if field.type === 'multiselect'}
                  <div class="space-y-2 max-h-40 overflow-y-auto border border-gray-300 rounded-lg p-2 bg-white">
                    {#each field.options || [] as option}
                      <label class="flex items-center gap-2 p-1 hover:bg-gray-50 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          name={field.name}
                          value={option.value}
                          checked={Array.isArray(field.value) && field.value.includes(option.value)}
                          class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span class="text-sm text-gray-700">{option.label}</span>
                      </label>
                    {/each}
                    {#if !field.options || field.options.length === 0}
                      <p class="text-sm text-gray-400 p-1">No hay opciones disponibles</p>
                    {/if}
                  </div>
                {:else}
                  <input
                    id={field.name}
                    type={field.type}
                    name={field.name}
                    class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors {field.readonly ? 'border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed' : 'border-gray-300 bg-white text-gray-900 placeholder-gray-500 focus:ring-blue-500 focus:border-blue-500'}"
                    placeholder={field.placeholder || field.label}
                    bind:value={field.value}
                    required={field.required}
                    readonly={field.readonly}
                  />
                {/if}
              </div>
            {/each}
          </div>
          
          <div class="flex justify-end gap-3 mt-6">
            <button
              class="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              type="button"
              on:click={onClose}
              disabled={loading}
            >
              {cancelLabel}
            </button>
            <button
              class="px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              type="submit"
              disabled={loading}
            >
              {#if loading}
                <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Procesando...
              {:else if type === 'create'}
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                </svg>
                {submitLabel}
              {:else}
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                </svg>
                {submitLabel}
              {/if}
            </button>
          </div>

          <!-- Solo enviar hidden inputs para campos que NO tienen un field visible (ej: id) -->
          {#each Object.entries(formData).filter(([key]) => !fields.some(f => f.name === key)) as [key, value]}
            <input type="hidden" name={key} value={value} />
          {/each}
        </form>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}
