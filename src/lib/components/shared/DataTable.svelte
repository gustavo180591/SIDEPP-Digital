<script lang="ts">
  export let data: any[];
  export let columns: Array<{
    key: string;
    label: string;
    sortable?: boolean;
    render?: (item: any) => any;
  }>;
  export let actions: Array<{
    label?: string;
    labelFn?: (item: any) => string;
    icon: string;
    color?: string;
    colorFn?: (item: any) => string;
    onClick?: (item: any) => void;
    href?: (item: any) => string;
  }> = [];

  // Helper para obtener label (estático o dinámico)
  function getActionLabel(action: typeof actions[0], item: any): string {
    return action.labelFn ? action.labelFn(item) : (action.label || '');
  }

  // Helper para obtener color (estático o dinámico)
  function getActionColor(action: typeof actions[0], item: any): string {
    return action.colorFn ? action.colorFn(item) : (action.color || '');
  }
  export let emptyState: {
    icon: string;
    title: string;
    description: string;
    action?: {
      label: string;
      onClick: () => void;
    };
  };
  export let pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
  } | null = null;
  export let buildUrl: (filters: Record<string, string>) => string;
  export let goto: (url: string) => void;
  export let loading: boolean = false;
</script>

<div class="card bg-white shadow-xl rounded-xl border border-gray-100">
  <div class="card-body p-0">
    {#if loading}
      <div class="flex justify-center items-center py-12">
        <div class="loading loading-spinner loading-lg text-primary"></div>
      </div>
    {:else if data.length === 0}
      <div class="text-center py-12">
        <div class="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center">
          <svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={emptyState.icon}></path>
          </svg>
        </div>
        <h3 class="text-lg font-semibold text-gray-800 mb-2">{emptyState.title}</h3>
        <p class="text-gray-600 mb-4">{emptyState.description}</p>
        {#if emptyState.action}
          <button class="btn btn-primary shadow-md hover:shadow-lg transition-all duration-300" on:click={emptyState.action.onClick}>
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
            </svg>
            {emptyState.action.label}
          </button>
        {/if}
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="table w-full">
          <thead class="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
            <tr>
              {#each columns as column}
                <th class="text-white font-medium text-xs uppercase tracking-wider px-4 py-3">
                  {column.label}
                </th>
              {/each}
              {#if actions.length > 0}
                <th class="text-white font-medium text-xs uppercase tracking-wider px-4 py-3">Acciones</th>
              {/if}
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            {#each data as item, index}
              <tr class="hover:bg-blue-50 transition-all duration-200 {index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}">
                {#each columns as column}
                  <td class="px-4 py-3">
                    {#if column.render}
                      {@html column.render(item)}
                    {:else}
                      <span class="text-sm text-gray-600">{item[column.key] || '-'}</span>
                    {/if}
                  </td>
                {/each}
                {#if actions.length > 0}
                  <td class="px-4 py-3">
                    <div class="flex gap-2">
                      {#each actions as action}
                        {#if action.href}
                          <a
                            href={action.href(item)}
                            class="btn btn-sm btn-outline {getActionColor(action, item)}"
                          >
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={action.icon}></path>
                            </svg>
                            {getActionLabel(action, item)}
                          </a>
                        {:else if action.onClick}
                          <button
                            class="btn btn-sm btn-outline {getActionColor(action, item)}"
                            on:click={() => action.onClick && action.onClick(item)}
                          >
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={action.icon}></path>
                            </svg>
                            {getActionLabel(action, item)}
                          </button>
                        {/if}
                      {/each}
                    </div>
                  </td>
                {/if}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</div>

<!-- Paginación -->
{#if pagination && pagination.totalPages > 1}
  <div class="flex justify-center items-center gap-3 p-5 bg-gradient-to-r from-gray-50 to-blue-50/30 rounded-b-xl border-t border-gray-200">
    <button
      class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
      disabled={pagination.currentPage === 1}
      on:click={() => {
        const url = buildUrl({ page: String(pagination.currentPage - 1) });
        goto(url);
      }}
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
      </svg>
      Anterior
    </button>

    <div class="flex gap-2">
      {#each Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
        const pageNum = Math.max(1, Math.min(pagination.totalPages - 4, pagination.currentPage - 2)) + i;
        return pageNum;
      }) as pageNum}
        <button
          class="w-10 h-10 text-sm font-medium rounded-lg transition-all {pageNum === pagination.currentPage ? 'text-white bg-gradient-to-r from-blue-600 to-indigo-600 shadow-md' : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'}"
          on:click={() => {
            const url = buildUrl({ page: String(pageNum) });
            goto(url);
          }}
        >
          {pageNum}
        </button>
      {/each}
    </div>

    <button
      class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
      disabled={pagination.currentPage === pagination.totalPages}
      on:click={() => {
        const url = buildUrl({ page: String(pagination.currentPage + 1) });
        goto(url);
      }}
    >
      Siguiente
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
      </svg>
    </button>
  </div>
{/if}
