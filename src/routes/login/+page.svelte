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

<!-- Contenedor principal con gradiente -->
<div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 px-4 py-12 sm:px-6 lg:px-8">

  <!-- Card de login con glassmorphism -->
  <div class="w-full max-w-md animate-slide-in-up">

    <!-- Logo y branding -->
    <div class="text-center mb-8">
      <div class="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl shadow-lg mb-4">
        <svg class="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      </div>
      <h1 class="text-3xl font-bold text-gray-900 mb-2">SIDEPP Digital</h1>
      <p class="text-sm text-gray-600">Sistema de Gestión de Aportes Sindicales</p>
    </div>

    <!-- Formulario con glassmorphism -->
    <div class="glass-card rounded-2xl p-8">

      <div class="mb-6">
        <h2 class="text-2xl font-bold text-gray-900">Iniciar Sesión</h2>
        <p class="mt-2 text-sm text-gray-600">
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
        class="space-y-5"
      >
        <!-- Alert de error -->
        {#if form?.error}
          <div class="bg-red-50 border-l-4 border-red-500 px-4 py-3 rounded-md flex items-start gap-3 animate-fade-in">
            <svg class="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
            </svg>
            <div class="flex-1">
              <p class="text-sm font-medium text-red-800">{form.error}</p>
            </div>
          </div>
        {/if}

        <!-- Campo de Email -->
        <div>
          <label for="email" class="block text-sm font-semibold text-gray-700 mb-2">
            Correo Electrónico
          </label>
          <div class="relative">
            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
              </svg>
            </div>
            <input
              id="email"
              name="email"
              type="email"
              bind:value={email}
              required
              autocomplete="email"
              class="w-full pl-10 px-4 py-3 text-base text-gray-900 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="usuario@ejemplo.com"
              disabled={isLoading}
            />
          </div>
        </div>

        <!-- Campo de Contraseña -->
        <div>
          <label for="password" class="block text-sm font-semibold text-gray-700 mb-2">
            Contraseña
          </label>
          <div class="relative">
            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <input
              id="password"
              name="password"
              type="password"
              bind:value={password}
              required
              autocomplete="current-password"
              class="w-full pl-10 px-4 py-3 text-base text-gray-900 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="••••••••"
              disabled={isLoading}
            />
          </div>
        </div>

        <input type="hidden" name="redirect" value={redirectTo} />

        <!-- Botón de submit -->
        <div class="pt-2">
          <button
            type="submit"
            disabled={isLoading}
            class="w-full flex items-center justify-center gap-2 px-6 py-3 text-base font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg shadow-lg hover:shadow-xl hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg"
          >
            {#if isLoading}
              <svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Iniciando sesión...</span>
            {:else}
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
              <span>Iniciar Sesión</span>
            {/if}
          </button>
        </div>
      </form>

      <!-- Ayuda -->
      <div class="mt-6 pt-6 border-t border-gray-200">
        <div class="flex items-center justify-center gap-2 text-sm text-gray-600">
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/>
          </svg>
          <span>¿Problemas para acceder?</span>
        </div>
        <p class="mt-2 text-center text-xs text-gray-500">
          Contacta al administrador del sistema
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div class="mt-8 text-center">
      <p class="text-xs text-gray-600">
        © {new Date().getFullYear()} SIDEPP Digital. Todos los derechos reservados.
      </p>
      <p class="mt-1 text-xs text-gray-500">
        Sistema de Gestión de Aportes Sindicales
      </p>
    </div>
  </div>
</div>
