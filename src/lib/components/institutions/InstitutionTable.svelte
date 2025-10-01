<script lang="ts">
  import { DataTable } from '$lib/components/shared';
  import type { InstitutionListItem } from '$lib/db/models';
  
  export let institutions: InstitutionListItem[];
  export let pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
  };
  export let buildUrl: (filters: Record<string, string>) => string;
  export let goto: (url: string) => void;
  export let onEdit: (institution: InstitutionListItem) => void;
  export let onDelete: (institution: InstitutionListItem) => void;
  export let loading: boolean = false;

  const columns = [
    {
      key: 'name',
      label: 'Institución',
      render: (institution: InstitutionListItem) => `
        <a 
          href="/instituciones/${institution.id}" 
          class="font-medium text-blue-600 hover:text-blue-800 transition-colors duration-200"
        >
          ${institution.name}
        </a>
      `
    },
    {
      key: 'cuit',
      label: 'CUIT',
      render: (institution: InstitutionListItem) => `
        <span class="text-sm text-gray-600 font-mono">${institution.cuit}</span>
      `
    },
    {
      key: 'city',
      label: 'Ciudad',
      render: (institution: InstitutionListItem) => `
        <span class="text-sm text-gray-600">${institution.city || '-'}</span>
      `
    },
    {
      key: 'responsibleName',
      label: 'Responsable',
      render: (institution: InstitutionListItem) => `
        <span class="text-sm text-gray-600">${institution.responsibleName || '-'}</span>
      `
    },
    {
      key: 'responsibleEmail',
      label: 'Email',
      render: (institution: InstitutionListItem) => {
        if (institution.responsibleEmail) {
          return `
            <a href="mailto:${institution.responsibleEmail}" class="text-sm text-blue-600 hover:text-blue-800 transition-colors duration-200">
              ${institution.responsibleEmail}
            </a>
          `;
        }
        return '<span class="text-sm text-gray-400">-</span>';
      }
    },
    {
      key: 'createdAt',
      label: 'Creado',
      render: (institution: InstitutionListItem) => `
        <span class="text-sm text-gray-600">
          ${new Date(institution.createdAt).toLocaleDateString('es-AR')}
        </span>
      `
    }
  ];

  const actions = [
    {
      label: 'Ver',
      icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
      color: 'btn-info',
      href: (institution: InstitutionListItem) => `/instituciones/${institution.id}`
    },
    {
      label: 'Miembros',
      icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
      color: 'btn-info',
      href: (institution: InstitutionListItem) => `/instituciones/${institution.id}`
    },
    {
      label: 'Editar',
      icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
      color: 'btn-info',
      onClick: onEdit
    },
    {
      label: 'Eliminar',
      icon: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
      color: 'btn-error',
      onClick: onDelete
    }
  ];

  const emptyState = {
    icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
    title: 'No hay instituciones',
    description: 'Comienza creando tu primera institución',
    action: {
      label: 'Crear Institución',
      onClick: () => {
        // Se manejará desde el componente padre
      }
    }
  };
</script>

<DataTable 
  data={institutions}
  {columns}
  {actions}
  {emptyState}
  {pagination}
  {buildUrl}
  {goto}
  {loading}
/>