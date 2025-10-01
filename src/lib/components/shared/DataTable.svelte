<script lang="ts">
  export let data: any[];
  export let columns: Array<{
    key: string;
    label: string;
    sortable?: boolean;
    render?: (item: any) => any;
  }>;
  export let actions: Array<{
    label: string;
    icon: string;
    color: string;
    onClick?: (item: any) => void;
    href?: (item: any) => string;
  }> = [];
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

<div class="card bg-white shadow-lg border-0">
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
              <tr class="hover:bg-gray-50 transition-colors duration-200 {index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">
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
                            class="btn btn-sm btn-outline {action.color}"
                          >
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={action.icon}></path>
                            </svg>
                            {action.label}
                          </a>
                        {:else}
                          <button 
                            class="btn btn-sm btn-outline {action.color}"
                            on:click={() => action.onClick(item)}
                          >
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={action.icon}></path>
                            </svg>
                            {action.label}
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
  <div class="flex justify-center items-center gap-3 p-4 bg-gray-50">
    <button 
      class="btn btn-sm btn-outline {pagination.currentPage === 1 ? 'btn-disabled' : ''}"
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
    
    <div class="flex gap-1">
      {#each Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
        const pageNum = Math.max(1, Math.min(pagination.totalPages - 4, pagination.currentPage - 2)) + i;
        return pageNum;
      }) as pageNum}
        <button 
          class="btn btn-sm {pageNum === pagination.currentPage ? 'btn-primary' : 'btn-outline'}"
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
      class="btn btn-sm btn-outline {pagination.currentPage === pagination.totalPages ? 'btn-disabled' : ''}"
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
