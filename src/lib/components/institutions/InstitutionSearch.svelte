<script lang="ts">
  let { 
    institutions = $bindable(),
    value = $bindable()
  }: {
    institutions: Array<{ id: string; name: string | null; cuit: string | null }>;
    value: string;
  } = $props();

  let searchTerm = $state('');
  let isOpen = $state(false);
  let inputRef = $state<HTMLInputElement | null>(null);

  // Normalizar texto para búsqueda insensible a mayúsculas y acentos
  function normalizeText(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  // Filtrar instituciones (solo si hay 3+ caracteres)
  let filteredInstitutions = $derived.by(() => {
    if (searchTerm.length < 3) {
      return institutions;
    }

    const normalizedSearch = normalizeText(searchTerm);

    return institutions.filter((inst) => {
      const name = inst.name || inst.cuit || '';
      const normalizedName = normalizeText(name);
      return normalizedName.includes(normalizedSearch);
    });
  });

  // Obtener nombre de la institución seleccionada
  let selectedName = $derived.by(() => {
    if (!value) return 'Todas las instituciones';
    const inst = institutions.find((i) => i.id === value);
    return inst?.name || inst?.cuit || 'Todas las instituciones';
  });

  function selectInstitution(id: string) {
    value = id;
    searchTerm = '';
    isOpen = false;
  }

  function handleFocus() {
    isOpen = true;
    if (inputRef) {
      inputRef.value = '';
      searchTerm = '';
    }
  }

  function handleInput(e: Event) {
    const target = e.target as HTMLInputElement;
    searchTerm = target.value;
  }

  function handleClickOutside(e: MouseEvent) {
    if (inputRef && !inputRef.contains(e.target as Node)) {
      isOpen = false;
      if (inputRef) {
        inputRef.value = selectedName;
      }
    }
  }
</script>

<svelte:window onclick={handleClickOutside} />

<div class="relative">
  <input
    bind:this={inputRef}
    type="text"
    value={isOpen ? searchTerm : selectedName}
    onfocus={handleFocus}
    oninput={handleInput}
    placeholder="Todas las instituciones"
    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
  />

  {#if isOpen}
    <div class="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
      <button
        onclick={() => selectInstitution('')}
        class="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 focus:bg-gray-100 focus:outline-none border-b border-gray-100"
        type="button"
      >
        <span class="font-medium text-gray-700">Todas las instituciones</span>
      </button>

      {#each filteredInstitutions as institution}
        <button
          onclick={() => selectInstitution(institution.id)}
          class="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
          type="button"
        >
          <div class="font-medium text-gray-900">{institution.name || institution.cuit}</div>
        </button>
      {/each}
    </div>
  {/if}
</div>
