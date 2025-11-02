<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { PageHeader, SearchBox, DataTable } from '$lib/components/shared';
  import type { Member, Institution } from '@prisma/client';

  type MemberWithInstitution = Member & {
    institucion: Institution | null;
  };

  export let data: {
    members: MemberWithInstitution[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      itemsPerPage: number;
    };
    search: string;
    institutionId?: string;
  };

  let searchTerm = data.search || '';
  let searchTimeout: NodeJS.Timeout;

  // Funci�n para construir URL con filtros
  function buildUrl(filters: Record<string, string>) {
    const url = new URL($page.url);
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        url.searchParams.set(key, value);
      } else {
        url.searchParams.delete(key);
      }
    });
    return url.toString();
  }

  // Funci�n para b�squeda autom�tica con debounce
  function handleSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      const url = buildUrl({
        search: searchTerm,
        page: '1'
      });
      goto(url);
    }, 500);
  }

  // Funci�n para navegar al detalle del miembro
  function viewMemberDetail(member: MemberWithInstitution) {
    if (member.institucionId) {
      goto(`/dashboard/instituciones/${member.institucionId}/${member.id}`);
    }
  }

  // Columnas de la tabla
  const columns = [
    {
      key: 'name',
      label: 'Nombre',
      render: (member: MemberWithInstitution) => `
        <div class="font-medium text-gray-900">
          ${member.fullName || '-'}
        </div>
        <div class="text-xs text-gray-500">
          DNI: ${member.documentoIdentidad || '-'}
        </div>
      `
    },
    {
      key: 'institucion',
      label: 'Institución',
      render: (member: MemberWithInstitution) => {
        if (member.institucion) {
          return `
            <a href="/dashboard/instituciones/${member.institucionId}"
               class="text-blue-600 hover:text-blue-800 font-medium transition-colors duration-200">
              ${member.institucion.name || '-'}
            </a>
            <div class="text-xs text-gray-500">
              CUIT: ${member.institucion.cuit || '-'}
            </div>
          `;
        }
        return '<span class="text-sm text-gray-400">Sin institución</span>';
      }
    },
    {
      key: 'email',
      label: 'Email',
      render: (member: MemberWithInstitution) => {
        if (member.email) {
          return `
            <a href="mailto:${member.email}" class="text-sm text-blue-600 hover:text-blue-800 transition-colors duration-200">
              ${member.email}
            </a>
          `;
        }
        return '<span class="text-sm text-gray-400">-</span>';
      }
    },
    {
      key: 'numeroOrden',
      label: 'N° Orden',
      render: (member: MemberWithInstitution) => `
        <span class="badge badge-outline text-xs">${member.numeroOrden || '-'}</span>
      `
    },
    {
      key: 'numeroMatricula',
      label: 'N° Matrícula',
      render: (member: MemberWithInstitution) => `
        <span class="badge badge-outline text-xs">${member.numeroMatricula || '-'}</span>
      `
    },
    {
      key: 'membershipStartDate',
      label: 'Fecha de Ingreso',
      render: (member: MemberWithInstitution) => `
        <div class="text-sm text-gray-600">
          ${member.membershipStartDate ? new Date(member.membershipStartDate).toLocaleDateString('es-AR') : '-'}
        </div>
      `
    },
    {
      key: 'status',
      label: 'Estado',
      render: (member: MemberWithInstitution) => `
        <span class="badge ${member.status === 'active' ? 'badge-success' : 'badge-warning'}">
          ${member.status === 'active' ? 'Activo' : 'Inactivo'}
        </span>
      `
    }
  ];

  // Acciones de la tabla
  const actions = [
    {
      label: 'Ver Detalle',
      icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
      color: 'btn-primary',
      onClick: viewMemberDetail
    }
  ];

  // Estado vac�o
  const emptyState = {
    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
    title: 'No hay afiliados',
    description: 'No se encontraron afiliados registrados en el sistema',
    action: {
      label: 'Ir a Instituciones',
      onClick: () => goto('/dashboard/instituciones')
    }
  };
</script>

<svelte:head>
  <title>Afiliados - SIDEPP Digital</title>
</svelte:head>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <!-- Header -->
    <PageHeader
      title="Afiliados"
      description="Listado completo de todos los afiliados registrados en el sistema"
      actionLabel="Ir a Instituciones"
      onAction={() => goto('/dashboard/instituciones')}
    />

    <!-- Estad�sticas -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
      <div class="card bg-white shadow-sm p-4 rounded-2xl">
        <div class="card-body">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-600">Total de Afiliados</p>
              <p class="text-3xl font-bold text-gray-900">{data.pagination.totalItems}</p>
            </div>
            <div class="p-3 bg-blue-100 rounded-full">
              <svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div class="card bg-white shadow-sm p-4 rounded-2xl">
        <div class="card-body">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-600">Afiliados Activos</p>
              <p class="text-3xl font-bold text-green-600">
                {data.members.filter(m => m.status === 'active').length}
              </p>
            </div>
            <div class="p-3 bg-green-100 rounded-full">
              <svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div class="card bg-white shadow-sm p-4 rounded-2xl">
        <div class="card-body">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-600">Página Actual</p>
              <p class="text-3xl font-bold text-indigo-600">
                {data.pagination.currentPage} / {data.pagination.totalPages}
              </p>
            </div>
            <div class="p-3 bg-indigo-100 rounded-full">
              <svg class="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Tabla de afiliados -->
    <div class="bg-white shadow-xl rounded-xl border border-gray-100">
      <div class="p-6">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-bold text-gray-900">Listado de Afiliados</h2>
        </div>

        <!-- Buscador -->
        <SearchBox
          bind:searchTerm
          onSearch={handleSearch}
          placeholder="Buscar por nombre, DNI, email, N° orden o matrícula..."
          label="Buscar afiliado"
        />

        <!-- Tabla -->
        <DataTable
          data={data.members}
          {columns}
          {actions}
          {emptyState}
          pagination={data.pagination}
          {buildUrl}
          {goto}
          loading={false}
        />
      </div>
    </div>
</div>
