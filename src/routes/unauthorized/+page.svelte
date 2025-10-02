<script lang="ts">
  import { goto } from '$app/navigation';
  
  function goBack() {
    history.back();
  }
  
  function goHome() {
    goto('/dashboard');
  }
</script>

<svelte:head>
  <title>Acceso No Autorizado - SIDEPP Digital</title>
</svelte:head>

<div class="bg-white py-8 px-6 shadow-xl rounded-lg sm:px-10 text-center">
  <div class="mb-6">
    <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
      <svg class="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
    </div>
    <h2 class="text-2xl font-bold text-gray-900">Acceso No Autorizado</h2>
    <p class="mt-2 text-sm text-gray-600">
      No tienes permisos para acceder a esta sección del sistema
    </p>
  </div>

  <div class="space-y-4">
    <button
      on:click={goBack}
      class="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
    >
      Volver Atrás
    </button>
    
    <button
      on:click={goHome}
      class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
    >
      Ir al Inicio
    </button>
  </div>

  <div class="mt-6 text-center">
    <p class="text-xs text-gray-500">
      Si crees que esto es un error, contacta al administrador del sistema
    </p>
  </div>
</div>
