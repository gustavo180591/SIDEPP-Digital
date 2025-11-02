<script lang="ts">
    import { DashboardNavbar } from '$lib/components/shared';

    export let data;
</script>

<!-- Componente navbar del dashboard -->
<DashboardNavbar user={data.user} />

<main class="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-indigo-50/40">
    <div class="py-6">
        <slot />
    </div>
</main>
