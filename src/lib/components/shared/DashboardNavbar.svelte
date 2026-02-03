<script lang="ts">
  import { page } from '$app/stores';
  import MobileMenu from './MobileMenu.svelte';

  // Definir props usando Svelte 5 $props()
  let { user }: {
    user: {
      id: string;
      email: string;
      name?: string | null;
      role: 'ADMIN' | 'FINANZAS' | 'LIQUIDADOR';
      institutionId?: string | null;
      institutionName?: string | null;
    } | null
  } = $props();

  let mobileMenuOpen = $state(false);

  function toggleMobileMenu() {
    mobileMenuOpen = !mobileMenuOpen;
  }

  // Variable reactiva para rastrear el path actual (Svelte 5 runes)
  let currentPath = $derived($page.url.pathname);

  // Función para determinar si un enlace está activo
  function isActive(path: string) {
    if (path === '/dashboard') {
      return currentPath === '/dashboard';
    }
    return currentPath === path || currentPath.startsWith(path + '/');
  }

  // Obtener iniciales del usuario para el avatar
  function getInitials(name?: string | null, email?: string): string {
    if (name) {
      const parts = name.split(' ');
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      }
      return name.substring(0, 2).toUpperCase();
    }
    return email ? email.substring(0, 2).toUpperCase() : 'U';
  }
</script>

<!-- Navbar dark estilo SIDEPP -->
<nav class="bg-gray-900 shadow-md border-b border-gray-800 sticky top-0 z-50">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex items-center justify-between h-16">
      <!-- Logo -->
      <div class="flex-shrink-0 flex items-center gap-3">
        <img src="/IsoLogoSIDEPP.jpg" alt="SIDEPP" class="h-9 w-auto rounded" />
        <a href="/dashboard" class="flex flex-col">
          <span class="text-lg font-bold text-white hover:text-red-400 transition-colors duration-200">
            SIDEPP Digital
          </span>
          <span class="text-xs text-gray-400 hidden xl:block">Gestion de Aportes</span>
        </a>
      </div>

      <!-- Navegación desktop -->
      <div class="hidden lg:flex lg:items-center lg:gap-1">
        {#if user?.role === 'ADMIN' || user?.role === 'FINANZAS'}
          <a
            href="/dashboard"
            class="px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-200 flex items-center gap-1.5 {isActive('/dashboard') ? 'text-white bg-red-700 shadow-md' : 'text-gray-300 hover:text-white hover:bg-gray-800'}"
          >
            <svg class="w-4 h-4 hidden xl:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Dashboard
          </a>
        {/if}

        {#if user?.role === 'ADMIN'}
          <a
            href="/dashboard/usuarios"
            class="px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-200 flex items-center gap-1.5 {isActive('/dashboard/usuarios') ? 'text-white bg-red-700 shadow-md' : 'text-gray-300 hover:text-white hover:bg-gray-800'}"
          >
            <svg class="w-4 h-4 hidden xl:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            Usuarios
          </a>
        {/if}

        {#if user?.role === 'ADMIN' || user?.role === 'FINANZAS' || user?.role === 'LIQUIDADOR'}
          <a
            href="/dashboard/instituciones"
            class="px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-200 flex items-center gap-1.5 {isActive('/dashboard/instituciones') ? 'text-white bg-red-700 shadow-md' : 'text-gray-300 hover:text-white hover:bg-gray-800'}"
          >
            <svg class="w-4 h-4 hidden xl:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            {user?.role === 'LIQUIDADOR' ? 'Mis Inst.' : 'Instituciones'}
          </a>
        {/if}

        {#if user?.role === 'ADMIN' || user?.role === 'FINANZAS'}
          <a
            href="/dashboard/afiliados"
            class="px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-200 flex items-center gap-1.5 {isActive('/dashboard/afiliados') ? 'text-white bg-red-700 shadow-md' : 'text-gray-300 hover:text-white hover:bg-gray-800'}"
          >
            <svg class="w-4 h-4 hidden xl:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Afiliados
          </a>

          <a
            href="/dashboard/reportes"
            class="px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-200 flex items-center gap-1.5 {isActive('/dashboard/reportes') ? 'text-white bg-red-700 shadow-md' : 'text-gray-300 hover:text-white hover:bg-gray-800'}"
          >
            <svg class="w-4 h-4 hidden xl:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Reportes
          </a>
        {/if}

        {#if user?.role === 'ADMIN' || user?.role === 'LIQUIDADOR'}
          <a
            href="/dashboard/upload"
            class="px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-200 flex items-center gap-1.5 {isActive('/dashboard/upload') ? 'text-white bg-red-700 shadow-md' : 'text-gray-300 hover:text-white hover:bg-gray-800'}"
          >
            <svg class="w-4 h-4 hidden xl:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v0a2 2 0 002 2h12a2 2 0 002-2v0M12 12v9m0-9l-3.75-3.75M12 12l3.75-3.75M16 5h2a2 2 0 012 2v0a2 2 0 01-2 2h-2M8 5H6a2 2 0 00-2 2v0a2 2 0 002 2h2" />
            </svg>
            Subir Aportes
          </a>
        {/if}

        {#if user?.role === 'ADMIN'}
          <a
            href="/dashboard/admin/archivos"
            class="px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-200 flex items-center gap-1.5 {isActive('/dashboard/admin/archivos') ? 'text-white bg-red-700 shadow-md' : 'text-gray-300 hover:text-white hover:bg-gray-800'}"
          >
            <svg class="w-4 h-4 hidden xl:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Archivos
          </a>
        {/if}
      </div>

      <!-- Información del usuario y logout -->
      <div class="flex items-center gap-2">
        <div class="hidden lg:flex lg:items-center lg:gap-2">
          <div class="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-gray-800/50 border border-gray-700">
            <div class="flex items-center justify-center w-7 h-7 bg-gradient-to-br from-red-600 to-red-700 rounded-full text-white text-xs font-bold shadow-sm">
              {getInitials(user?.name, user?.email)}
            </div>
            <div class="hidden xl:flex xl:flex-col">
              <span class="text-xs font-semibold text-white leading-tight">{user?.name || user?.email}</span>
              <span class="text-xs text-gray-400 capitalize leading-tight">{user?.role?.toLowerCase()}</span>
            </div>
          </div>
        </div>

        <a
          href="/logout"
          class="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-gray-900 shadow-sm hover:shadow"
          title="Cerrar sesion"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
          </svg>
          <span class="hidden xl:inline">Salir</span>
        </a>

        <!-- Hamburger para mobile y tablet -->
        <div class="lg:hidden">
          <button
            type="button"
            on:click={toggleMobileMenu}
            class="p-2 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors"
            aria-label="Abrir menu"
          >
            <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <MobileMenu {user} isOpen={mobileMenuOpen} />
  </div>
</nav>
