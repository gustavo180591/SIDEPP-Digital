<script lang="ts">
  import { enhance } from '$app/forms';
  import { page } from '$app/stores';
  
  export let form;
  
  let email = '';
  let password = '';
  let isLoading = false;
  
  // Obtener URL de redirección si existe
  $: redirectTo = $page.url.searchParams.get('redirect') || '/dashboard';
</script>

<svelte:head>
  <title>Iniciar Sesión - SIDEPP Digital</title>
</svelte:head>

<div class="bg-white py-8 px-6 shadow-xl rounded-lg sm:px-10">
  <div class="mb-6">
    <h2 class="text-2xl font-bold text-gray-900 text-center">Iniciar Sesión</h2>
    <p class="mt-2 text-sm text-gray-600 text-center">
      Ingresa tus credenciales para acceder al sistema
    </p>
  </div>

  <form 
    method="POST" 
    action="?/login"
    use:enhance={() => {
      isLoading = true;
      return async ({ update }) => {
        await update();
        isLoading = false;
      };
    }}
    class="space-y-6"
  >
    {#if form?.error}
      <div class="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
        {form.error}
      </div>
    {/if}

    <div>
      <label for="email" class="block text-sm font-medium text-gray-700 mb-2">
        Email
      </label>
      <input
        id="email"
        name="email"
        type="email"
        bind:value={email}
        required
        class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        placeholder="tu@email.com"
        disabled={isLoading}
      />
    </div>

    <div>
      <label for="password" class="block text-sm font-medium text-gray-700 mb-2">
        Contraseña
      </label>
      <input
        id="password"
        name="password"
        type="password"
        bind:value={password}
        required
        class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        placeholder="Tu contraseña"
        disabled={isLoading}
      />
    </div>

    <input type="hidden" name="redirect" value={redirectTo} />

    <div>
      <button
        type="submit"
        disabled={isLoading}
        class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
      >
        {#if isLoading}
          <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Iniciando sesión...
        {:else}
          Iniciar Sesión
        {/if}
      </button>
    </div>
  </form>

  <div class="mt-6 text-center">
    <p class="text-xs text-gray-500">
      ¿Problemas para acceder? Contacta al administrador del sistema
    </p>
  </div>
</div>
