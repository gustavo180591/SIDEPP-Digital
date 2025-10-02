<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import MobileMenu from './MobileMenu.svelte';
  
  export let user: {
    id: string;
    email: string;
    name?: string | null;
    role: 'ADMIN' | 'OPERATOR' | 'INTITUTION';
    institutionId?: string | null;
  } | null;
  
  let mobileMenuOpen = false;
  
  function handleLogout() {
    goto('/logout');
  }
  
  function toggleMobileMenu() {
    mobileMenuOpen = !mobileMenuOpen;
  }
  
  // Función para determinar si un enlace está activo
  function isActive(path: string) {
    return $page.url.pathname === path;
  }
</script>

<nav class="bg-white shadow-sm border-b border-gray-200">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex justify-between h-16">
      <!-- Logo y navegación principal -->
      <div class="flex items-center">
        <div class="flex-shrink-0">
          <a href="/dashboard" class="text-xl font-bold text-gray-900 hover:text-blue-600 transition-colors duration-200">
            SIDEPP Digital
          </a>
        </div>
        
        <!-- Navegación desktop -->
        <div class="hidden md:ml-6 md:flex md:space-x-8">
          <a 
            href="/dashboard" 
            class="px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 {isActive('/dashboard') ? 'text-blue-600 bg-blue-50' : 'text-gray-500 hover:text-blue-600 hover:bg-gray-50'}"
          >
            Dashboard
          </a>
          
          {#if user?.role === 'ADMIN'}
            <a 
              href="/dashboard/usuarios" 
              class="px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 {isActive('/dashboard/usuarios') ? 'text-blue-600 bg-blue-50' : 'text-gray-500 hover:text-blue-600 hover:bg-gray-50'}"
            >
              Usuarios
            </a>
            
            <a 
              href="/dashboard/instituciones" 
              class="px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 {isActive('/dashboard/instituciones') ? 'text-blue-600 bg-blue-50' : 'text-gray-500 hover:text-blue-600 hover:bg-gray-50'}"
            >
              Instituciones
            </a>
          {/if}
          
          {#if user?.role === 'INTITUTION'}
            <a 
              href="/dashboard/instituciones" 
              class="px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 {isActive('/dashboard/instituciones') ? 'text-blue-600 bg-blue-50' : 'text-gray-500 hover:text-blue-600 hover:bg-gray-50'}"
            >
              Mi Institución
            </a>
          {/if}
          
          <a 
            href="/dashboard/upload" 
            class="px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 {isActive('/dashboard/upload') ? 'text-blue-600 bg-blue-50' : 'text-gray-500 hover:text-blue-600 hover:bg-gray-50'}"
          >
            Subir Archivos
          </a>
        </div>
      </div>
      
      <!-- Información del usuario y logout -->
      <div class="flex items-center space-x-4">
        <!-- Información del usuario -->
        <div class="hidden sm:flex sm:items-center sm:space-x-3">
          <div class="text-sm text-gray-700">
            <span class="font-medium">{user?.name || user?.email}</span>
            <span class="text-gray-500 ml-2">({user?.role})</span>
          </div>
        </div>
        
        <!-- Botón de logout -->
        <button
          on:click={handleLogout}
          class="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          title="Cerrar sesión"
        >
          <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
          </svg>
          Cerrar Sesión
        </button>
        
        <!-- Menú móvil (hamburguesa) -->
        <div class="md:hidden">
          <button
            type="button"
            on:click={toggleMobileMenu}
            class="text-gray-500 hover:text-gray-600 focus:outline-none focus:text-gray-600"
            aria-label="Abrir menú"
          >
            <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
    
    <!-- Menú móvil expandible -->
    <MobileMenu {user} isOpen={mobileMenuOpen} />
  </div>
</nav>
