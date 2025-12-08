<script lang="ts">
  export let data;
</script>

<svelte:head>
  <title>Dashboard - SIDEPP Digital</title>
</svelte:head>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900">Dashboard</h1>
      <p class="mt-2 text-gray-600">
        Bienvenido, {data.user?.name || data.user?.email}
      </p>
    </div>

    <!-- Acciones rápidas -->
    <div class="bg-white shadow-xl rounded-xl border border-gray-100">
      <div class="px-6 py-6 sm:p-8">
        <div class="flex items-center gap-3 mb-6">
          <div class="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
            </svg>
          </div>
          <h3 class="text-xl font-bold text-gray-900">Acciones Rápidas</h3>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <!-- Usuarios: Solo ADMIN -->
          {#if data.user?.role === 'ADMIN'}
            <a href="/dashboard/usuarios" class="relative group bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-xl border-2 border-blue-200 hover:border-blue-400 hover:shadow-lg transition-all duration-300 hover:scale-105">
              <div>
                <span class="rounded-xl inline-flex p-3 bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md">
                  <svg class="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"></path>
                  </svg>
                </span>
              </div>
              <div class="mt-4">
                <h3 class="text-lg font-bold text-gray-900 group-hover:text-blue-700 transition-colors">
                  <span class="absolute inset-0" aria-hidden="true"></span>
                  Gestionar Usuarios
                </h3>
                <p class="mt-2 text-sm text-gray-700">
                  Crear, editar y administrar usuarios del sistema
                </p>
              </div>
            </a>
          {/if}

          <!-- Instituciones: ADMIN y FINANZAS -->
          {#if data.user?.role === 'ADMIN' || data.user?.role === 'FINANZAS'}
            <a href="/dashboard/instituciones" class="relative group bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-xl border-2 border-green-200 hover:border-green-400 hover:shadow-lg transition-all duration-300 hover:scale-105">
              <div>
                <span class="rounded-xl inline-flex p-3 bg-gradient-to-br from-green-500 to-green-600 text-white shadow-md">
                  <svg class="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
                  </svg>
                </span>
              </div>
              <div class="mt-4">
                <h3 class="text-lg font-bold text-gray-900 group-hover:text-green-700 transition-colors">
                  <span class="absolute inset-0" aria-hidden="true"></span>
                  Gestionar Instituciones
                </h3>
                <p class="mt-2 text-sm text-gray-700">
                  Administrar instituciones y sus datos
                </p>
              </div>
            </a>

            <a href="/dashboard/afiliados" class="relative group bg-gradient-to-br from-purple-50 to-violet-50 p-6 rounded-xl border-2 border-purple-200 hover:border-purple-400 hover:shadow-lg transition-all duration-300 hover:scale-105">
              <div>
                <span class="rounded-xl inline-flex p-3 bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-md">
                  <svg class="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                  </svg>
                </span>
              </div>
              <div class="mt-4">
                <h3 class="text-lg font-bold text-gray-900 group-hover:text-purple-700 transition-colors">
                  <span class="absolute inset-0" aria-hidden="true"></span>
                  Afiliados
                </h3>
                <p class="mt-2 text-sm text-gray-700">
                  Ver listado de todos los afiliados
                </p>
              </div>
            </a>
          {/if}

          <!-- Mis Instituciones: Solo LIQUIDADOR -->
          {#if data.user?.role === 'LIQUIDADOR'}
            <a href="/dashboard/instituciones" class="relative group bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-xl border-2 border-green-200 hover:border-green-400 hover:shadow-lg transition-all duration-300 hover:scale-105">
              <div>
                <span class="rounded-xl inline-flex p-3 bg-gradient-to-br from-green-500 to-green-600 text-white shadow-md">
                  <svg class="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
                  </svg>
                </span>
              </div>
              <div class="mt-4">
                <h3 class="text-lg font-bold text-gray-900 group-hover:text-green-700 transition-colors">
                  <span class="absolute inset-0" aria-hidden="true"></span>
                  Mis Instituciones
                </h3>
                <p class="mt-2 text-sm text-gray-700">
                  Ver las instituciones asignadas
                </p>
              </div>
            </a>
          {/if}

          <!-- Subir Archivos: ADMIN y LIQUIDADOR -->
          {#if data.user?.role === 'ADMIN' || data.user?.role === 'LIQUIDADOR'}
            <a href="/dashboard/upload" class="relative group bg-gradient-to-br from-yellow-50 to-orange-50 p-6 rounded-xl border-2 border-yellow-200 hover:border-yellow-400 hover:shadow-lg transition-all duration-300 hover:scale-105">
              <div>
                <span class="rounded-xl inline-flex p-3 bg-gradient-to-br from-yellow-500 to-yellow-600 text-white shadow-md">
                  <svg class="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                  </svg>
                </span>
              </div>
              <div class="mt-4">
                <h3 class="text-lg font-bold text-gray-900 group-hover:text-yellow-700 transition-colors">
                  <span class="absolute inset-0" aria-hidden="true"></span>
                  Subir Archivos
                </h3>
                <p class="mt-2 text-sm text-gray-700">
                  Procesar documentos y archivos del sistema
                </p>
              </div>
            </a>
          {/if}
        </div>
      </div>
    </div>
</div>
