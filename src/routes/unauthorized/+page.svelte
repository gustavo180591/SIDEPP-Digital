<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  
  // Redirigir a la página de inicio si el usuario no está autenticado
  $: if (!$page.data.user) {
    goto('/login');
  }
</script>

<div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
  <div class="max-w-md w-full space-y-8 text-center">
    <div>
      <h1 class="text-3xl font-extrabold text-gray-900">
        Acceso no autorizado
      </h1>
      <p class="mt-2 text-gray-600">
        No tienes los permisos necesarios para acceder a esta página.
      </p>
    </div>
    
    <div class="mt-8">
      <a 
        href="/" 
        class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
      >
        Volver al inicio
      </a>
    </div>
  </div>
</div>
