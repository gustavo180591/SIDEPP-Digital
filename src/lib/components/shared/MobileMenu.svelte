<script lang="ts">
  import { page } from '$app/stores';
  
  export let user: {
    id: string;
    email: string;
    name?: string | null;
    role: 'ADMIN' | 'OPERATOR' | 'INTITUTION';
    institutionId?: string | null;
  } | null;
  
  export let isOpen = false;
  
  // Función para determinar si un enlace está activo
  function isActive(path: string) {
    return $page.url.pathname === path;
  }
  
  function closeMenu() {
    isOpen = false;
  }
</script>

<!-- Menú móvil -->
{#if isOpen}
  <div class="md:hidden">
    <div class="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-white border-b border-gray-200">
      <a 
        href="/dashboard" 
        on:click={closeMenu}
        class="block px-3 py-2 rounded-md text-base font-medium transition-colors duration-200 {isActive('/dashboard') ? 'text-blue-600 bg-blue-50' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'}"
      >
        Dashboard
      </a>
      
      {#if user?.role === 'ADMIN'}
        <a 
          href="/dashboard/usuarios" 
          on:click={closeMenu}
          class="block px-3 py-2 rounded-md text-base font-medium transition-colors duration-200 {isActive('/dashboard/usuarios') ? 'text-blue-600 bg-blue-50' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'}"
        >
          Usuarios
        </a>
        
        <a
          href="/dashboard/instituciones"
          on:click={closeMenu}
          class="block px-3 py-2 rounded-md text-base font-medium transition-colors duration-200 {isActive('/dashboard/instituciones') ? 'text-blue-600 bg-blue-50' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'}"
        >
          Instituciones
        </a>

        <a
          href="/dashboard/afiliados"
          on:click={closeMenu}
          class="block px-3 py-2 rounded-md text-base font-medium transition-colors duration-200 {isActive('/dashboard/afiliados') ? 'text-blue-600 bg-blue-50' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'}"
        >
          Afiliados
        </a>
      {/if}
      
      {#if user?.role === 'INTITUTION'}
        <a 
          href="/dashboard/instituciones" 
          on:click={closeMenu}
          class="block px-3 py-2 rounded-md text-base font-medium transition-colors duration-200 {isActive('/dashboard/instituciones') ? 'text-blue-600 bg-blue-50' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'}"
        >
          Mi Institución
        </a>
      {/if}
      
      <a 
        href="/dashboard/upload" 
        on:click={closeMenu}
        class="block px-3 py-2 rounded-md text-base font-medium transition-colors duration-200 {isActive('/dashboard/upload') ? 'text-blue-600 bg-blue-50' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'}"
      >
        Subir Archivos
      </a>
      
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
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}
