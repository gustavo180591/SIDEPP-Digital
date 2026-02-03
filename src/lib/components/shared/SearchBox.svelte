<script lang="ts">
  export let searchTerm: string;
  export let placeholder: string = "Buscar...";
  export let onSearch: () => void;
  export let label: string = "Buscar";
</script>

<div class="card bg-white shadow-xl rounded-xl border border-gray-100 mb-6">
  <div class="card-body p-6">
    <div class="form-control">
      <label class="label" for="search-input">
        <span class="label-text font-semibold text-gray-700 flex items-center gap-2">
          <svg class="w-5 h-5 text-red-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
          </svg>
          {label}
        </span>
      </label>
      <div class="relative">
        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
          </svg>
        </div>
        <input
          id="search-input"
          type="text"
          class="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all shadow-sm"
          placeholder={placeholder}
          bind:value={searchTerm}
          on:input={onSearch}
        />
      </div>
    </div>
  </div>
</div>
