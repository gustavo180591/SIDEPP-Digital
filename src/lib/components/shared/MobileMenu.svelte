<script lang="ts">
  import { page } from '$app/stores';

  // Definir props usando Svelte 5 $props()
  let { user, isOpen = false }: {
    user: {
      id: string;
      email: string;
      name?: string | null;
      role: 'ADMIN' | 'FINANZAS' | 'LIQUIDADOR';
      institutionId?: string | null;
      institutionName?: string | null;
    } | null;
    isOpen?: boolean;
  } = $props();

  // Variable reactiva para rastrear el path actual (Svelte 5 runes)
  let currentPath = $derived($page.url.pathname);

  // Función para determinar si un enlace está activo
  function isActive(path: string) {
    if (path === '/dashboard') {
      // Para el dashboard principal, solo coincidencia exacta
      return currentPath === '/dashboard';
    }
    // Para sub-rutas, coincidir con la ruta y cualquier sub-ruta
    return currentPath === path || currentPath.startsWith(path + '/');
  }

  function closeMenu() {
    isOpen = false;
  }
</script>

<!-- Menú móvil -->
{#if isOpen}
  <div class="md:hidden">
    <div class="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-white border-b border-gray-200">
      <!-- Dashboard: Solo ADMIN y FINANZAS -->
      {#if user?.role === 'ADMIN' || user?.role === 'FINANZAS'}
        <a
          href="/dashboard"
          on:click={closeMenu}
          class="block px-3 py-2 rounded-md text-base font-medium transition-colors duration-200 {isActive('/dashboard') ? 'text-blue-600 bg-blue-50' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'}"
        >
          Dashboard
        </a>
      {/if}

      <!-- Usuarios: Solo ADMIN -->
      {#if user?.role === 'ADMIN'}
        <a
          href="/dashboard/usuarios"
          on:click={closeMenu}
          class="block px-3 py-2 rounded-md text-base font-medium transition-colors duration-200 {isActive('/dashboard/usuarios') ? 'text-blue-600 bg-blue-50' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'}"
        >
          Usuarios
        </a>
      {/if}

      <!-- Instituciones: ADMIN, FINANZAS y LIQUIDADOR -->
      {#if user?.role === 'ADMIN' || user?.role === 'FINANZAS' || user?.role === 'LIQUIDADOR'}
        <a
          href="/dashboard/instituciones"
          on:click={closeMenu}
          class="block px-3 py-2 rounded-md text-base font-medium transition-colors duration-200 {isActive('/dashboard/instituciones') ? 'text-blue-600 bg-blue-50' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'}"
        >
          {user?.role === 'LIQUIDADOR' ? 'Mis Instituciones' : 'Instituciones'}
        </a>
      {/if}

      <!-- Afiliados: ADMIN y FINANZAS -->
      {#if user?.role === 'ADMIN' || user?.role === 'FINANZAS'}
        <a
          href="/dashboard/afiliados"
          on:click={closeMenu}
          class="block px-3 py-2 rounded-md text-base font-medium transition-colors duration-200 {isActive('/dashboard/afiliados') ? 'text-blue-600 bg-blue-50' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'}"
        >
          Afiliados
        </a>
      {/if}

      <!-- Subir Aportes: ADMIN y LIQUIDADOR -->
      {#if user?.role === 'ADMIN' || user?.role === 'LIQUIDADOR'}
        <a
          href="/dashboard/upload"
          on:click={closeMenu}
          class="block px-3 py-2 rounded-md text-base font-medium transition-colors duration-200 {isActive('/dashboard/upload') ? 'text-blue-600 bg-blue-50' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'}"
        >
          Subir Aportes
        </a>
      {/if}

      <!-- Gestión de Archivos: Solo ADMIN -->
      {#if user?.role === 'ADMIN'}
        <a
          href="/dashboard/admin/archivos"
          on:click={closeMenu}
          class="block px-3 py-2 rounded-md text-base font-medium transition-colors duration-200 {isActive('/dashboard/admin/archivos') ? 'text-blue-600 bg-blue-50' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'}"
        >
          Gestión de Archivos
        </a>
      {/if}

      <!-- Información del usuario en móvil -->
      <div class="pt-4 pb-3 border-t border-gray-200">
        <div class="flex items-center px-3">
          <div class="flex-shrink-0">
            <div class="h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center">
              <span class="text-sm font-medium text-gray-700">
                {(user?.name || user?.email || 'U').charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
          <div class="ml-3">
            <div class="text-base font-medium text-gray-800">
              {user?.name || user?.email}
            </div>
            <div class="text-sm font-medium text-gray-500">
              {user?.role}
            </div>
            {#if user?.institutionName}
              <div class="text-sm font-medium text-blue-600">
                {user.institutionName}
              </div>
            {/if}
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}
