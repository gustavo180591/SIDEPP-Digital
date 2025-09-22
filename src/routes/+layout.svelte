<script lang="ts">
    import '../app.css';
    import favicon from '$lib/assets/favicon.svg';
    import { page } from '$app/stores';
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { enhance } from '$app/forms';

    // Obtener props y datos del servidor
    let { children, data } = $props();
    
    // Asegurarse de que data.user esté disponible
    let user = $derived(data?.user || null);
    
    // Función para navegar a diferentes rutas
    const navigateTo = (path: string) => {
        goto(path);
    };

    // Verificar si la ruta actual es la página de inicio
    let isHome = $derived($page.url.pathname === '/');

    // Estado del menú móvil
    let mobileMenuOpen = $state(false);
    let showProfileDropdown = $state(false);
    
    // Función para manejar el menú móvil
    function toggleMobileMenu() {
        mobileMenuOpen = !mobileMenuOpen;
    }

    // Función para cerrar sesión
    async function handleLogout() {
        // Limpiar la cookie de sesión
        document.cookie = 'session_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
        // Redirigir a la página de inicio de sesión
        window.location.href = '/login';
    }

    // Cerrar menú desplegable al hacer clic fuera
    function handleClickOutside(event: MouseEvent) {
        const target = event.target as HTMLElement;
        if (!target.closest('.profile-dropdown') && !target.closest('.profile-button')) {
            showProfileDropdown = false;
        }
    }

    // Asegurarse de que las animaciones se activen al cambiar de ruta
    onMount(() => {
        const elements = document.querySelectorAll('.fade-in');
        elements.forEach((el, index) => {
            setTimeout(() => {
                el.classList.add('visible');
            }, 100 * index);
        });

        // Agregar manejador de clic fuera del menú desplegable
        document.addEventListener('click', handleClickOutside);

        return () => {
            document.removeEventListener('click', handleClickOutside);
        };
    });

    // Cerrar menú móvil al hacer clic fuera
    const handleClickOutsideMobile = (event: MouseEvent) => {
        const navLinks = document.querySelector('.nav-links');
        const menuButton = document.querySelector('.mobile-menu-button');
        
        if (navLinks && navLinks.classList.contains('active') && 
            menuButton && !navLinks.contains(event.target as Node) && 
            !menuButton.contains(event.target as Node)) {
            navLinks.classList.remove('active');
            mobileMenuOpen = false;
        }
    };

    onMount(() => {
        // Agregar manejador de clic fuera del menú móvil
        document.addEventListener('click', handleClickOutsideMobile);

        return () => {
            document.removeEventListener('click', handleClickOutsideMobile);
        };
    });
</script>

<svelte:head>
    <link rel="icon" href={favicon} />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
</svelte:head>

<!-- Navbar -->
<nav class="navbar">
    <div class="nav-content">
        <a href="/" class="logo">SIDEPP <span>Digital</span></a>
        <div class="nav-links" class:active={mobileMenuOpen}>
            <a href="/" class="nav-link {isHome ? 'active' : ''}">Inicio</a>
            {#if isHome}
                <a href="#caracteristicas" class="nav-link">Características</a>
                <a href="#acerca" class="nav-link">Acerca de</a>
            {/if}
            <a href="/upload" class="nav-link {!isHome ? 'active' : ''}">Subir Archivos</a>
            {#if user}
                <div class="relative profile-dropdown">
                    <button 
                        class="profile-button flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                        onclick={(e) => {
                            e.stopPropagation();
                            showProfileDropdown = !showProfileDropdown;
                        }}
                        aria-expanded={showProfileDropdown}
                        aria-haspopup="true"
                    >
                        <div class="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-800 font-semibold">
                            {user.name ? user.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                        </div>
                        <span class="hidden md:inline">{user.name || user.email.split('@')[0]}</span>
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                        </svg>
                    </button>
                    
                    {#if showProfileDropdown}
                        <div class="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50">
                            <div class="px-4 py-2 text-sm text-gray-700 border-b border-gray-100">
                                <p class="font-medium">{user.name || 'Usuario'}</p>
                                <p class="text-xs text-gray-500 truncate">{user.email}</p>
                            </div>
                            <a href="/profile" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                Mi perfil
                            </a>
                            <a href="/settings" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                Configuración
                            </a>
                            {#if user.role === 'ADMIN'}
                                <a href="/admin" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 border-t border-gray-100">
                                    Panel de administración
                                </a>
                            {/if}
                            <button 
                                onclick={handleLogout}
                                class="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 border-t border-gray-100"
                            >
                                Cerrar sesión
                            </button>
                        </div>
                    {/if}
                </div>
            {:else}
                <div class="auth-buttons">
                    <a href="/login" class="btn btn-outline">Iniciar Sesión</a>
                    <a href="/register" class="btn btn-primary">Registrarse</a>
                </div>
            {/if}
        </div>
        <button class="mobile-menu-button" onclick={toggleMobileMenu} aria-label="Menú de navegación">
            <div class="hamburger">
                <span></span>
                <span></span>
                <span></span>
            </div>
        </button>
    </div>
</nav>

<!-- Contenido principal -->
<main class="main-content">
    {@render children?.()}
</main>

<!-- Estilos de la barra de navegación -->
<style>
    /* Variables de colores */
    :root {
        --primary: #2563eb;
        --primary-dark: #1d4ed8;
        --navbar-height: 4rem; /* Altura del navbar */
        --secondary: #4f46e5;
        --dark: #1e293b;
        --light: #f8fafc;
        --gray: #64748b;
        --light-gray: #e2e8f0;
    }

    /* Estilos base */
    * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
    }

    :global(body) {
        color: var(--dark);
        line-height: 1.6;
        background-color: #ffffff;
        overflow-x: hidden;
        margin: 0;
        padding: 0;
    }

    /* Estilos de la barra de navegación */
    .navbar {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background-color: white;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        z-index: 1000;
        padding: 1rem 0;
    }

    .nav-content {
        max-width: 1400px;
        margin: 0 auto;
        padding: 0 2rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
        position: relative;
    }

    .logo {
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--dark);
        text-decoration: none;
    }

    .logo span {
        color: var(--primary);
    }

    .nav-links {
        display: flex;
        gap: 1.5rem;
        align-items: center;
        transition: all 0.3s ease;
    }

    .nav-link {
        color: var(--dark);
        text-decoration: none;
        font-weight: 500;
        transition: color 0.3s ease;
        padding: 0.5rem 0;
        position: relative;
    }

    .nav-link:hover, .nav-link.active {
        color: var(--primary);
    }

    .nav-link.active:after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 0;
        width: 100%;
        height: 2px;
        background-color: var(--primary);
    }

    .auth-buttons {
        display: flex;
        gap: 1rem;
        margin-left: 1rem;
    }

    /* Botones */
    .btn {
        display: inline-block;
        padding: 0.5rem 1.25rem;
        border-radius: 0.375rem;
        font-weight: 500;
        text-align: center;
        text-decoration: none;
        cursor: pointer;
        transition: all 0.3s ease;
        white-space: nowrap;
    }

    .btn-primary {
        background-color: var(--primary);
        color: white;
        border: 2px solid var(--primary);
    }

    .btn-primary:hover {
        background-color: var(--primary-dark);
        border-color: var(--primary-dark);
        transform: translateY(-2px);
    }

    .btn-outline {
        background-color: transparent;
        color: var(--primary);
        border: 2px solid var(--primary);
    }

    .btn-outline:hover {
        background-color: rgba(37, 99, 235, 0.1);
        transform: translateY(-2px);
    }

    /* Menú móvil */
    .mobile-menu-button {
        display: none;
        background: none;
        border: none;
        cursor: pointer;
        padding: 0.5rem;
    }

    .hamburger {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .hamburger span {
        display: block;
        width: 24px;
        height: 2px;
        background-color: var(--dark);
        transition: all 0.3s ease;
    }

    /* Contenido principal */
    main {
        min-height: calc(100vh - var(--navbar-height));
        padding-top: var(--navbar-height); /* Altura del navbar */
    }

    /* Responsive */
    @media (max-width: 1024px) {
        .nav-links {
            position: fixed;
            top: 5rem;
            left: 0;
            right: 0;
            background: white;
            flex-direction: column;
            padding: 1rem 2rem 2rem;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            transform: translateY(-100%);
            opacity: 0;
            pointer-events: none;
            z-index: 999;
            gap: 1rem;
            align-items: flex-start;
        }

        .nav-links.active {
            transform: translateY(0);
            opacity: 1;
            pointer-events: all;
        }

        .auth-buttons {
            margin: 1rem 0 0;
            width: 100%;
            flex-direction: column;
            gap: 0.75rem;
        }

        .auth-buttons .btn {
            width: 100%;
            text-align: center;
        }

        .mobile-menu-button {
            display: block;
        }
    }

    @media (max-width: 480px) {
        .nav-content {
            padding: 0 1rem;
        }
    }
</style>

