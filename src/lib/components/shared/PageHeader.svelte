<script lang="ts">
  export let title: string;
  export let description: string;
  export let actionLabel: string;
  export let onAction: () => void;
  export let showAction: boolean = true;
</script>

<div class="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
  <div class="space-y-1">
    <h1 class="text-2xl font-bold text-gray-800">{title}</h1>
    <p class="text-gray-600">{description}</p>
  </div>
  {#if showAction}
    <button 
      class="btn btn-primary shadow-md hover:shadow-lg transition-all duration-300"
      on:click={onAction}
    >
      <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
      </svg>
      {actionLabel}
    </button>
  {/if}
</div>
