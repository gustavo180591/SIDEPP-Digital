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
  }> = [];
  export let deleteMessage: string = '';
  export let deleteItemName: string = '';
  export let onDelete: (() => void) | null = null;
</script>

{#if showModal}
  <div class="modal modal-open">
    <div class="modal-box max-w-2xl">
      <h3 class="font-bold text-lg mb-4">{title}</h3>
      
      {#if type === 'delete'}
        <div class="py-4">
          <p class="text-gray-600 mb-4">
            {deleteMessage || `¿Estás seguro de que deseas eliminar ${deleteItemName}?`}
          </p>
          <p class="text-sm text-red-600">
            Esta acción no se puede deshacer.
          </p>
        </div>
        <div class="modal-action">
          {#if onDelete}
            <button class="btn btn-error" on:click={onDelete}>
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
              </svg>
              Eliminar
            </button>
          {:else}
            <button class="btn btn-error" form="delete-form">
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
              </svg>
              Eliminar
            </button>
          {/if}
          <button class="btn btn-ghost" on:click={onClose}>{cancelLabel}</button>
        </div>
        <form id="delete-form" method="POST" action={formAction} use:enhance>
          {#each Object.entries(formData) as [key, value]}
            <input type="hidden" name={key} value={value} />
          {/each}
        </form>
      {:else}
        <form method="POST" action={formAction} use:enhance>
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
                    class="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    required={field.required}
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
                    class="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    placeholder={field.placeholder || field.label}
                    value={field.value || ''}
                    required={field.required}
                  />
                {/if}
              </div>
            {/each}
          </div>
          
          <div class="modal-action">
            <button class="btn btn-primary" type="submit">
              {#if type === 'create'}
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                </svg>
                {submitLabel}
              {:else}
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                </svg>
                {submitLabel}
              {/if}
            </button>
            <button class="btn btn-ghost" type="button" on:click={onClose}>{cancelLabel}</button>
          </div>
          
          {#each Object.entries(formData) as [key, value]}
            <input type="hidden" name={key} value={value} />
          {/each}
        </form>
      {/if}
    </div>
  </div>
{/if}
