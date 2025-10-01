<script lang="ts">
  export let searchTerm: string;
  export let placeholder: string = "Buscar...";
  export let onSearch: () => void;
  export let label: string = "Buscar";
</script>

<div class="card bg-white shadow-lg border-0 mb-6">
  <div class="card-body p-6">
    <div class="form-control">
      <label class="label" for="search-input">
        <span class="label-text font-medium text-gray-700">{label}</span>
      </label>
      <input 
        id="search-input"
        type="text" 
        class="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" 
        placeholder={placeholder}
        bind:value={searchTerm}
        on:input={onSearch}
      />
    </div>
  </div>
</div>
