<script lang="ts">
  import { enhance } from '$app/forms';

  export let form;

  let email = '';
  let isLoading = false;
</script>

<svelte:head>
  <title>Recuperar Contraseña - SIDEPP Digital</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-red-50/30 to-gray-100 px-4 py-12 sm:px-6 lg:px-8">
  <div class="w-full max-w-md animate-slide-in-up">

    <!-- Logo y branding -->
    <div class="text-center mb-8">
      <img src="/IsoLogoSIDEPP.jpg" alt="SIDEPP" class="h-16 w-auto mx-auto rounded-lg shadow-lg mb-4" />
      <h1 class="text-3xl font-bold text-gray-900 mb-2">SIDEPP Digital</h1>
      <p class="text-sm text-gray-600">Sistema de Gestión de Aportes Sindicales</p>
    </div>

    <!-- Card -->
    <div class="glass-card rounded-2xl p-8">

      {#if form?.success}
        <!-- Mensaje de éxito -->
        <div class="text-center">
          <div class="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-6">
            <svg class="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 class="text-2xl font-bold text-gray-900 mb-4">Revisa tu correo</h2>
          <p class="text-gray-600 mb-6">
            {form.message}
          </p>
          <a
            href="/login"
            class="inline-flex items-center gap-2 text-red-700 hover:text-red-800 font-medium"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Volver al inicio de sesión
          </a>
        </div>
      {:else}
        <!-- Formulario -->
        <div class="mb-6">
          <h2 class="text-2xl font-bold text-gray-900">Recuperar Contraseña</h2>
          <p class="mt-2 text-sm text-gray-600">
            Ingresa tu correo electrónico y te enviaremos instrucciones para restablecer tu contraseña.
          </p>
        </div>

        <form
          method="POST"
          use:enhance={() => {
            isLoading = true;
            return async ({ update }) => {
              await update();
              isLoading = false;
            };
          }}
          class="space-y-5"
        >
          <!-- Error -->
          {#if form?.error}
            <div class="bg-red-50 border-l-4 border-red-500 px-4 py-3 rounded-md flex items-start gap-3 animate-fade-in">
              <svg class="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
              </svg>
              <p class="text-sm font-medium text-red-800">{form.error}</p>
            </div>
          {/if}

          <!-- Email -->
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
                class="w-full pl-10 px-4 py-3 text-base text-gray-900 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="usuario@ejemplo.com"
                disabled={isLoading}
              />
            </div>
          </div>

          <!-- Submit -->
          <div class="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              class="w-full flex items-center justify-center gap-2 px-6 py-3 text-base font-semibold text-white bg-gradient-to-r from-red-700 to-red-600 rounded-lg shadow-lg hover:shadow-xl hover:from-red-800 hover:to-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {#if isLoading}
                <svg class="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Enviando...</span>
              {:else}
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span>Enviar instrucciones</span>
              {/if}
            </button>
          </div>
        </form>

        <!-- Volver -->
        <div class="mt-6 pt-6 border-t border-gray-200 text-center">
          <a
            href="/login"
            class="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-red-700 transition-colors"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Volver al inicio de sesión
          </a>
        </div>
      {/if}
    </div>

    <!-- Footer -->
    <div class="mt-8 text-center">
      <p class="text-xs text-gray-600">
        © {new Date().getFullYear()} SIDEPP Digital. Todos los derechos reservados.
      </p>
    </div>
  </div>
</div>
