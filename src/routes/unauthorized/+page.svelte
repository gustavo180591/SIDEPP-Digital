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

<div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 px-4 py-12">
  <div class="w-full max-w-md">
    <div class="bg-white py-10 px-8 shadow-2xl rounded-2xl text-center border border-red-100 animate-slide-in-up">
      <div class="mb-8">
        <div class="mx-auto flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-red-500 to-orange-600 mb-6 shadow-lg">
          <svg class="h-11 w-11 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3l-6.928-12a2 2 0 00-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 class="text-3xl font-bold text-gray-900 mb-3">Acceso No Autorizado</h2>
        <p class="text-base text-gray-700 font-medium">
          No tienes permisos para acceder a esta sección del sistema
        </p>
      </div>

      <div class="space-y-3">
        <button
          on:click={goBack}
          class="w-full flex justify-center items-center gap-2 py-3 px-5 border border-gray-300 rounded-lg shadow-sm text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-all duration-200"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
          </svg>
          Volver Atrás
        </button>

        <button
          on:click={goHome}
          class="w-full flex justify-center items-center gap-2 py-3 px-5 border border-transparent rounded-lg shadow-lg text-sm font-semibold text-white bg-gradient-to-r from-red-700 to-red-600 hover:shadow-xl hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all duration-200"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path>
          </svg>
          Ir al Dashboard
        </button>
      </div>

      <div class="mt-8 pt-6 border-t border-gray-200">
        <div class="flex items-center justify-center gap-2 mb-2">
          <svg class="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/>
          </svg>
          <p class="text-sm font-medium text-gray-600">
            ¿Necesitas ayuda?
          </p>
        </div>
        <p class="text-xs text-gray-500">
          Si crees que esto es un error, contacta al administrador del sistema
        </p>
      </div>
    </div>
  </div>
</div>
