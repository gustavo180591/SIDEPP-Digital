<script lang="ts">
  import { enhance } from '$app/forms';

  export let data;
  export let form;

  let password = '';
  let confirmPassword = '';
  let isLoading = false;
  let showPassword = false;
  let showConfirmPassword = false;

  // Validaciones en tiempo real
  $: passwordErrors = {
    length: password.length > 0 && password.length < 8,
    uppercase: password.length > 0 && !/[A-Z]/.test(password),
    lowercase: password.length > 0 && !/[a-z]/.test(password),
    number: password.length > 0 && !/[0-9]/.test(password)
  };

  $: passwordValid = password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password);

  $: passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
</script>

<svelte:head>
  <title>Restablecer Contraseña - SIDEPP Digital</title>
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

      {#if !data.valid}
        <!-- Token inválido -->
        <div class="text-center">
          <div class="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-6">
            <svg class="h-8 w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 class="text-2xl font-bold text-gray-900 mb-4">Enlace inválido</h2>
          <p class="text-gray-600 mb-6">
            {data.error}
          </p>
          <a
            href="/forgot-password"
            class="inline-flex items-center gap-2 px-6 py-3 text-base font-semibold text-white bg-gradient-to-r from-red-700 to-red-600 rounded-lg shadow-lg hover:shadow-xl hover:from-red-800 hover:to-red-700 transition-all"
          >
            Solicitar nuevo enlace
          </a>
        </div>
      {:else}
        <!-- Formulario -->
        <div class="mb-6">
          <h2 class="text-2xl font-bold text-gray-900">Nueva Contraseña</h2>
          <p class="mt-2 text-sm text-gray-600">
            Crea una nueva contraseña para <strong>{data.email}</strong>
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

          <!-- Nueva contraseña -->
          <div>
            <label for="password" class="block text-sm font-semibold text-gray-700 mb-2">
              Nueva Contraseña
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
                type={showPassword ? 'text' : 'password'}
                bind:value={password}
                required
                autocomplete="new-password"
                class="w-full pl-10 pr-12 py-3 text-base text-gray-900 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all disabled:opacity-50"
                placeholder="Mínimo 8 caracteres"
                disabled={isLoading}
              />
              <button
                type="button"
                on:click={() => showPassword = !showPassword}
                class="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                {#if showPassword}
                  <svg class="h-5 w-5 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                {:else}
                  <svg class="h-5 w-5 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                {/if}
              </button>
            </div>

            <!-- Requisitos de contraseña -->
            {#if password.length > 0}
              <div class="mt-2 space-y-1">
                <div class="flex items-center gap-2 text-xs {password.length >= 8 ? 'text-green-600' : 'text-gray-500'}">
                  <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    {#if password.length >= 8}
                      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                    {:else}
                      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
                    {/if}
                  </svg>
                  Mínimo 8 caracteres
                </div>
                <div class="flex items-center gap-2 text-xs {/[A-Z]/.test(password) ? 'text-green-600' : 'text-gray-500'}">
                  <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    {#if /[A-Z]/.test(password)}
                      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                    {:else}
                      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
                    {/if}
                  </svg>
                  Una letra mayúscula
                </div>
                <div class="flex items-center gap-2 text-xs {/[a-z]/.test(password) ? 'text-green-600' : 'text-gray-500'}">
                  <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    {#if /[a-z]/.test(password)}
                      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                    {:else}
                      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
                    {/if}
                  </svg>
                  Una letra minúscula
                </div>
                <div class="flex items-center gap-2 text-xs {/[0-9]/.test(password) ? 'text-green-600' : 'text-gray-500'}">
                  <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    {#if /[0-9]/.test(password)}
                      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                    {:else}
                      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
                    {/if}
                  </svg>
                  Un número
                </div>
              </div>
            {/if}
          </div>

          <!-- Confirmar contraseña -->
          <div>
            <label for="confirmPassword" class="block text-sm font-semibold text-gray-700 mb-2">
              Confirmar Contraseña
            </label>
            <div class="relative">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                bind:value={confirmPassword}
                required
                autocomplete="new-password"
                class="w-full pl-10 pr-12 py-3 text-base text-gray-900 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all disabled:opacity-50 {confirmPassword.length > 0 && !passwordsMatch ? 'border-red-500' : ''}"
                placeholder="Repite la contraseña"
                disabled={isLoading}
              />
              <button
                type="button"
                on:click={() => showConfirmPassword = !showConfirmPassword}
                class="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                {#if showConfirmPassword}
                  <svg class="h-5 w-5 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                {:else}
                  <svg class="h-5 w-5 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                {/if}
              </button>
            </div>
            {#if confirmPassword.length > 0 && !passwordsMatch}
              <p class="mt-1 text-xs text-red-600">Las contraseñas no coinciden</p>
            {/if}
          </div>

          <!-- Submit -->
          <div class="pt-2">
            <button
              type="submit"
              disabled={isLoading || !passwordValid || !passwordsMatch}
              class="w-full flex items-center justify-center gap-2 px-6 py-3 text-base font-semibold text-white bg-gradient-to-r from-red-700 to-red-600 rounded-lg shadow-lg hover:shadow-xl hover:from-red-800 hover:to-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {#if isLoading}
                <svg class="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Guardando...</span>
              {:else}
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span>Cambiar Contraseña</span>
              {/if}
            </button>
          </div>
        </form>
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
