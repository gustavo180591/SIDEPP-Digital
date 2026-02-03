<script lang="ts">
  export let title: string;
  export let description: string;
  export let actionLabel: string;
  export let onAction: () => void;
  export let showAction: boolean = true;
</script>

<div class="bg-gradient-to-r from-white to-red-50/50 rounded-xl p-6 mb-6 shadow-lg border border-red-100">
  <div class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
    <div class="flex items-start gap-4">
      <div class="flex-shrink-0">
        <div class="w-12 h-12 bg-gradient-to-br from-red-700 to-red-600 rounded-xl flex items-center justify-center shadow-md">
          <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
          </svg>
        </div>
      </div>
      <div class="space-y-1">
        <h1 class="text-3xl font-bold text-gray-900">{title}</h1>
        <p class="text-gray-700 font-medium">{description}</p>
      </div>
    </div>
    {#if showAction}
      <button
        class="px-5 py-3 text-sm font-semibold text-white bg-gradient-to-r from-red-700 to-red-600 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 flex items-center gap-2"
        on:click={onAction}
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
        </svg>
        {actionLabel}
      </button>
    {/if}
  </div>
</div>
