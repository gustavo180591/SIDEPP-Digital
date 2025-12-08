<script lang="ts">
  type Option = { value: string; label: string };

  export let options: Option[] = [];
  export let value: string = '';
  export let placeholder: string = 'Seleccionar...';
  export let disabled: boolean = false;
  export let required: boolean = false;
  export let name: string = '';

  let searchQuery = '';
  let isOpen = false;
  let highlightedIndex = -1;
  let inputElement: HTMLInputElement;
  let containerElement: HTMLDivElement;

  // Encuentra el label de la opción seleccionada
  $: selectedOption = options.find((opt) => opt.value === value);
  $: displayValue = isOpen ? searchQuery : (selectedOption?.label ?? '');

  // Filtra opciones basado en la búsqueda
  $: filteredOptions = searchQuery
    ? options.filter((opt) =>
        opt.label.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : options;

  function handleInputFocus() {
    if (disabled) return;
    isOpen = true;
    searchQuery = '';
    highlightedIndex = -1;
  }

  function handleInputBlur(event: FocusEvent) {
    // Verificar si el foco se movió dentro del contenedor
    const relatedTarget = event.relatedTarget as HTMLElement;
    if (containerElement?.contains(relatedTarget)) {
      return;
    }
    closeDropdown();
  }

  function closeDropdown() {
    isOpen = false;
    searchQuery = '';
    highlightedIndex = -1;
  }

  function selectOption(option: Option) {
    value = option.value;
    closeDropdown();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!isOpen) {
      if (event.key === 'Enter' || event.key === 'ArrowDown') {
        event.preventDefault();
        isOpen = true;
      }
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        highlightedIndex = Math.min(highlightedIndex + 1, filteredOptions.length - 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        highlightedIndex = Math.max(highlightedIndex - 1, 0);
        break;
      case 'Enter':
        event.preventDefault();
        if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
          selectOption(filteredOptions[highlightedIndex]);
        } else if (filteredOptions.length === 1) {
          selectOption(filteredOptions[0]);
        }
        break;
      case 'Escape':
        event.preventDefault();
        closeDropdown();
        break;
      case 'Tab':
        closeDropdown();
        break;
    }
  }

  function handleOptionClick(option: Option) {
    selectOption(option);
    inputElement?.focus();
  }

  function handleOptionMouseEnter(index: number) {
    highlightedIndex = index;
  }

  // Click fuera para cerrar
  function handleClickOutside(event: MouseEvent) {
    if (containerElement && !containerElement.contains(event.target as Node)) {
      closeDropdown();
    }
  }
</script>

<svelte:window on:click={handleClickOutside} />

<div class="relative" bind:this={containerElement}>
  <input
    type="text"
    bind:this={inputElement}
    value={displayValue}
    on:input={(e) => (searchQuery = e.currentTarget.value)}
    on:focus={handleInputFocus}
    on:blur={handleInputBlur}
    on:keydown={handleKeydown}
    {placeholder}
    {disabled}
    autocomplete="off"
    class="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 pr-10 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:cursor-not-allowed disabled:bg-gray-100"
  />

  <!-- Icono de flecha -->
  <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
    <svg
      class="h-4 w-4 text-gray-400 transition-transform {isOpen ? 'rotate-180' : ''}"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
    </svg>
  </div>

  <!-- Dropdown de opciones -->
  {#if isOpen && !disabled}
    <ul
      class="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg"
      role="listbox"
    >
      {#if filteredOptions.length === 0}
        <li class="px-3 py-2 text-sm text-gray-500">No se encontraron resultados</li>
      {:else}
        {#each filteredOptions as option, index}
          <li
            role="option"
            aria-selected={option.value === value}
            tabindex="-1"
            class="cursor-pointer px-3 py-2 text-sm transition-colors
              {option.value === value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-900'}
              {highlightedIndex === index ? 'bg-blue-100' : 'hover:bg-gray-100'}"
            on:click={() => handleOptionClick(option)}
            on:mouseenter={() => handleOptionMouseEnter(index)}
            on:keydown={(e) => e.key === 'Enter' && handleOptionClick(option)}
          >
            {option.label}
          </li>
        {/each}
      {/if}
    </ul>
  {/if}

  <!-- Hidden input para el valor real del form -->
  <input type="hidden" {name} value={value} {required} />
</div>
