<script lang="ts">
    import { onMount } from 'svelte';
    import { fade } from 'svelte/transition';
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';

    // Obtener datos del usuario del store de página
    export let data;
    $: user = data?.user || null;

    const navigateTo = (path: string) => {
        goto(path);
    };

    onMount(() => {
        // Animación de entrada
        const elements = document.querySelectorAll('.fade-in');
        elements.forEach((el, index) => {
            setTimeout(() => {
                el.classList.add('visible');
            }, 100 * index);
        });
    });
</script>

<svelte:head>
    <title>SIDEPP Digital - Plataforma de Gestión</title>
    <meta name="description" content="Sistema Integral de Gestión Digital para SIDEPP" />
</svelte:head>

<!-- El navbar ahora está en +layout.svelte -->

<!-- Hero Section -->
<header id="inicio" class="hero">
    <div class="hero-content">
        {#if user}
            <div class="welcome-section fade-in">
                <div class="welcome-card">
                    <div class="user-avatar">
                        {user.name ? user.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                    </div>
                    <h1>¡Bienvenido{user.name ? ', ' + user.name : ''}!</h1>
                    <p class="subtitle">Estamos encantados de verte de nuevo en SIDEPP Digital</p>
                    <div class="user-info">
                        <p><strong>Correo:</strong> {user.email}</p>
                        {#if user.role}
                            <p><strong>Rol:</strong> 
                                {user.role === 'ADMIN' ? 'Administrador' : 
                                 user.role === 'OPERATOR' ? 'Operador' : 'Usuario'}
                            </p>
                        {/if}
                    </div>
                    <div class="cta-buttons">
                        <a href="/upload" class="btn btn-primary btn-large">Subir Archivos</a>
                        {#if user.role === 'ADMIN'}
                            <a href="/admin" class="btn btn-outline btn-large">Panel de Administración</a>
                        {/if}
                    </div>
                </div>
            </div>
        {:else}
            <div class="hero-text fade-in">
                <h1>Transforma tu gestión con SIDEPP Digital</h1>
                <p class="subtitle">La plataforma integral para la gestión de procesos digitales</p>
                <div class="cta-buttons">
                    <a href="/register" class="btn btn-primary btn-large">Comenzar Ahora</a>
                    <a href="#caracteristicas" class="btn btn-outline btn-large">Conoce Más</a>
                </div>
            </div>
        {/if}
        <div class="hero-image fade-in">
            <img src="/placeholder-hero.svg" alt="Dashboard SIDEPP Digital" />
        </div>
    </div>
</header>

<!-- Características -->
<section id="caracteristicas" class="features">
    <h2 class="section-title">Características Principales</h2>
    <div class="features-grid">
        <div class="feature-card fade-in">
            <div class="feature-icon">🚀</div>
            <h3>Gestión Eficiente</h3>
            <p>Automatiza tus procesos y ahorra tiempo en tareas repetitivas.</p>
        </div>
        <div class="feature-card fade-in">
            <div class="feature-icon">📊</div>
            <h3>Reportes en Tiempo Real</h3>
            <p>Accede a datos actualizados y toma decisiones informadas.</p>
        </div>
        <div class="feature-card fade-in">
            <div class="feature-icon">🔒</div>
            <h3>Seguridad Garantizada</h3>
            <p>Tus datos están protegidos con los más altos estándares de seguridad.</p>
        </div>
    </div>
</section>

<!-- Acerca de -->
<section id="acerca" class="about">
    <div class="about-content">
        <div class="about-text fade-in">
            <h2>Acerca de SIDEPP Digital</h2>
            <p>SIDEPP Digital es una plataforma diseñada para optimizar y digitalizar los procesos de gestión, ofreciendo una solución integral para las necesidades de tu organización.</p>
            <p>Nuestro objetivo es facilitar la transición hacia la transformación digital de manera sencilla y efectiva.</p>
        </div>
    </div>
</section>

<!-- Footer -->
<footer class="footer">
    <div class="footer-content">
        <div class="footer-section">
            <h3>SIDEPP Digital</h3>
            <p>Plataforma de gestión integral</p>
        </div>
        <div class="footer-section">
            <h4>Enlaces Rápidos</h4>
            <a href="#inicio">Inicio</a>
            <a href="#caracteristicas">Características</a>
            <a href="#acerca">Acerca de</a>
        </div>
        <div class="footer-section">
            <h4>Contacto</h4>
            <p>Email: info@sideppdigital.com</p>
            <p>Teléfono: +123 456 7890</p>
        </div>
    </div>
    <div class="footer-bottom">
        <p>&copy; 2023 SIDEPP Digital. Todos los derechos reservados.</p>
    </div>
</footer>

<style>
    /* Variables de colores */
    :root {
        --primary: #2563eb;
        --primary-dark: #1d4ed8;
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

    body {
        color: var(--dark);
        line-height: 1.6;
        background-color: #ffffff;
        overflow-x: hidden;
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
        max-width: 1200px;
        margin: 0 auto;
        padding: 0 2rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .logo {
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--dark);
    }

    .logo span {
        color: var(--primary);
    }

    .nav-links {
        display: flex;
        gap: 1.5rem;
        align-items: center;
    }

    .nav-link {
        color: var(--dark);
        text-decoration: none;
        font-weight: 500;
        transition: color 0.3s ease;
    }

    .nav-link:hover {
        color: var(--primary);
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

    .btn-large {
        padding: 0.75rem 1.75rem;
        font-size: 1.1rem;
    }

    /* Hero Section */
    .hero {
        padding: 6rem 2rem 4rem;
        background: linear-gradient(135deg, #f0f4ff 0%, #e6f0ff 100%);
        text-align: center;
        min-height: 60vh;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    
    .welcome-section {
        max-width: 800px;
        margin: 0 auto;
        background: white;
    }

    .hero-text h1 {
        font-size: 3.5rem;
        line-height: 1.2;
        margin-bottom: 1.5rem;
        color: var(--dark);
    }

    .subtitle {
        font-size: 1.25rem;
        color: var(--gray);
        margin-bottom: 2.5rem;
        max-width: 90%;
    }

    .cta-buttons {
        display: flex;
        gap: 1rem;
        margin-top: 2rem;
    }

    .hero-image img {
        width: 100%;
        height: auto;
        border-radius: 1rem;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    }

    /* Sección de características */
    .features {
        padding: 6rem 2rem;
        background-color: white;
    }

    .section-title {
        text-align: center;
        font-size: 2.5rem;
        margin-bottom: 3rem;
        color: var(--dark);
    }

    .features-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 2rem;
        max-width: 1200px;
        margin: 0 auto;
    }

    .feature-card {
        background: white;
        padding: 2rem;
        border-radius: 0.5rem;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        transition: transform 0.3s ease, box-shadow 0.3s ease;
    }

    .feature-card:hover {
        transform: translateY(-5px);
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
    }

    .feature-icon {
        font-size: 2.5rem;
        margin-bottom: 1.5rem;
    }

    .feature-card h3 {
        font-size: 1.5rem;
        margin-bottom: 1rem;
        color: var(--dark);
    }

    .feature-card p {
        color: var(--gray);
    }

    /* Sección Acerca de */
    .about {
        padding: 6rem 2rem;
        background-color: #f8fafc;
    }

    .about-content {
        max-width: 1200px;
        margin: 0 auto;
        text-align: center;
    }

    .about h2 {
        font-size: 2.5rem;
        margin-bottom: 2rem;
        color: var(--dark);
    }

    .about p {
        max-width: 800px;
        margin: 0 auto 1.5rem;
        color: var(--gray);
    }

    /* Footer */
    .footer {
        background-color: var(--dark);
        color: white;
        padding: 4rem 2rem 2rem;
    }

    .footer-content {
        max-width: 1200px;
        margin: 0 auto;
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 2rem;
        margin-bottom: 3rem;
    }

    .footer-section h3, .footer-section h4 {
        color: white;
        margin-bottom: 1.5rem;
        font-size: 1.25rem;
    }

    .footer-section p, .footer-section a {
        color: #cbd5e1;
        display: block;
        margin-bottom: 0.75rem;
        text-decoration: none;
        transition: color 0.3s ease;
    }

    .footer-section a:hover {
        color: white;
    }

    .footer-bottom {
        text-align: center;
        padding-top: 2rem;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        color: #94a3b8;
        font-size: 0.9rem;
    }

    /* Animaciones */
    .fade-in {
        opacity: 0;
        transform: translateY(20px);
        transition: opacity 0.6s ease-out, transform 0.6s ease-out;
    }

    .fade-in.visible {
        opacity: 1;
        transform: translateY(0);
    }

    /* Responsive */
    @media (max-width: 1024px) {
        .hero-content {
            grid-template-columns: 1fr;
            text-align: center;
            gap: 3rem;
        }

        .hero-text h1 {
            font-size: 2.8rem;
        }

        .subtitle {
            margin: 0 auto 2rem;
        }

        .cta-buttons {
            justify-content: center;
        }

        .hero-image {
            order: -1;
            max-width: 80%;
            margin: 0 auto;
        }
    }

    @media (max-width: 768px) {
        .nav-links {
            display: none;
        }

        .hero {
            padding-top: 6rem;
        }

        .hero-text h1 {
            font-size: 2.2rem;
        }

        .subtitle {
            font-size: 1.1rem;
        }

        .cta-buttons {
            flex-direction: column;
            gap: 1rem;
        }

        .btn {
            width: 100%;
        }
    }
</style>
