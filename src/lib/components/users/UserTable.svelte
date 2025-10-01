<script lang="ts">
  import { DataTable } from '$lib/components/shared';
  import type { UserListItem } from '$lib/db/models';
  
  export let users: UserListItem[];
  export let pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
  };
  export let buildUrl: (filters: Record<string, string>) => string;
  export let goto: (url: string) => void;
  export let onEdit: (user: UserListItem) => void;
  export let onDelete: (user: UserListItem) => void;
  export let loading: boolean = false;

  const columns = [
    {
      key: 'user',
      label: 'Usuario',
      render: (user: UserListItem) => `
        <div class="font-medium text-gray-900">
          ${user.name || 'Sin nombre'}
        </div>
        <div class="text-xs text-gray-500">
          ${user.email}
        </div>
      `
    },
    {
      key: 'institution',
      label: 'Institución',
      render: (user: UserListItem) => {
        if (user.institution) {
          return `
            <div class="text-sm text-gray-900">
              ${user.institution.name}
            </div>
          `;
        }
        return '<span class="text-sm text-gray-400">-</span>';
      }
    },
    {
      key: 'role',
      label: 'Rol',
      render: (user: UserListItem) => {
        const roleLabels = {
          'ADMIN': 'Administrador',
          'OPERATOR': 'Operador',
          'INTITUTION': 'Institución'
        };
        const roleColors = {
          'ADMIN': 'badge-error',
          'OPERATOR': 'badge-warning',
          'INTITUTION': 'badge-info'
        };
        return `
          <span class="badge ${roleColors[user.role]} text-xs">
            ${roleLabels[user.role]}
          </span>
        `;
      }
    },
    {
      key: 'status',
      label: 'Estado',
      render: (user: UserListItem) => `
        <span class="badge ${user.isActive ? 'badge-success' : 'badge-warning'}">
          ${user.isActive ? 'Activo' : 'Inactivo'}
        </span>
      `
    },
    {
      key: 'lastLogin',
      label: 'Último Acceso',
      render: (user: UserListItem) => `
        <div class="text-sm text-gray-600">
          ${user.lastLogin ? new Date(user.lastLogin).toLocaleDateString('es-AR') : 'Nunca'}
        </div>
      `
    },
    {
      key: 'createdAt',
      label: 'Fecha de Creación',
      render: (user: UserListItem) => `
        <div class="text-sm text-gray-600">
          ${new Date(user.createdAt).toLocaleDateString('es-AR')}
        </div>
      `
    }
  ];

  const actions = [
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
    icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z',
    title: 'No hay usuarios',
    description: 'Comienza agregando usuarios al sistema',
    action: {
      label: 'Agregar Usuario',
      onClick: () => {
        // Se manejará desde el componente padre
      }
    }
  };
</script>

<DataTable 
  data={users}
  {columns}
  {actions}
  {emptyState}
  {pagination}
  {buildUrl}
  {goto}
  {loading}
/>
