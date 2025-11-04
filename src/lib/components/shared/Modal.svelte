<script lang="ts">
  import { enhance } from '$app/forms';
  
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
                  <p class="text-gray-800 font-medium mb-2">
                    {deleteMessage || `¿Estás seguro de que deseas eliminar ${deleteItemName}?`}
                  </p>
                  <p class="text-sm text-red-700 font-medium">
                    Esta acción no se puede deshacer.
                  </p>
                </div>
              </div>
            </div>
            <div class="flex justify-end gap-3">
              <button class="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-all" on:click={onClose}>
                {cancelLabel}
              </button>
              {#if onDelete}
                <button class="px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-red-600 to-red-700 rounded-lg hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-red-500 transition-all flex items-center gap-2" on:click={onDelete}>
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                  </svg>
                  Eliminar
                </button>
              {:else}
                <button class="px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-red-600 to-red-700 rounded-lg hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-red-500 transition-all flex items-center gap-2" form="delete-form">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                  </svg>
                  Eliminar
                </button>
              {/if}
            </div>
        <form
          id="delete-form"
          method="POST"
          action={formAction}
          use:enhance={() => {
            return async ({ result, update }) => {
              if (result.type === 'success' || (result.type === 'failure' && result.data?.success)) {
                onClose();
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
        <form
          method="POST"
          action={formAction}
          use:enhance={() => {
            return async ({ result, update }) => {
              if (result.type === 'success' || (result.type === 'failure' && result.data?.success)) {
                onClose();
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
                  <select
                    id={field.name}
                    name={field.name}
                    class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors {field.readonly ? 'border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed' : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500'}"
                    required={field.required}
                    disabled={field.readonly}
                  >
                    <option value="">{field.placeholder || 'Seleccionar...'}</option>
                    {#each field.options || [] as option}
                      <option value={option.value} selected={field.value === option.value}>
                        {option.label}
                      </option>
                    {/each}
                  </select>
                {:else}
                  <input
                    id={field.name}
                    type={field.type}
                    name={field.name}
                    class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors {field.readonly ? 'border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed' : 'border-gray-300 bg-white text-gray-900 placeholder-gray-500 focus:ring-blue-500 focus:border-blue-500'}"
                    placeholder={field.placeholder || field.label}
                    value={field.value || ''}
                    required={field.required}
                    readonly={field.readonly}
                  />
                {/if}
              </div>
            {/each}
          </div>
          
          <div class="flex justify-end gap-3 mt-6">
            <button class="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-all" type="button" on:click={onClose}>
              {cancelLabel}
            </button>
            <button class="px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all flex items-center gap-2" type="submit">
              {#if type === 'create'}
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
          
          {#each Object.entries(formData) as [key, value]}
            <input type="hidden" name={key} value={value} />
          {/each}
        </form>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}
