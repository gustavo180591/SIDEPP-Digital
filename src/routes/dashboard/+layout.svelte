<script lang="ts">
    import { DashboardNavbar } from '$lib/components/shared';
    
    export let data;
</script>

<!-- Componente navbar del dashboard -->
<DashboardNavbar user={data.user} />

<main class="min-h-screen bg-gray-50">
    <slot />
</main>
