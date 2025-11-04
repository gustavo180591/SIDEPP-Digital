<script lang="ts">
  import { DataTable } from '$lib/components/shared';
  import type { Member } from '@prisma/client';
  
  export let members: Member[];
  export let pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
  };
  export let buildUrl: (filters: Record<string, string>) => string;
  export let goto: (url: string) => void;
  export let onEdit: (member: Member) => void;
  export let onDelete: (member: Member) => void;
  export let onView: ((member: Member) => void) | undefined = undefined;
  export let loading: boolean = false;

  const columns = [
    {
      key: 'name',
      label: 'Nombre',
      render: (member: Member) => `
        <div class="font-medium text-gray-900">
          ${member.fullName || '-'}
        </div>
        <div class="text-xs text-gray-500">
          DNI: ${member.documentoIdentidad || '-'}
        </div>
      `
    },
    {
      key: 'email',
      label: 'Email',
      render: (member: Member) => {
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
      render: (member: Member) => `
        <span class="badge badge-outline text-xs">${member.numeroOrden}</span>
      `
    },
    {
      key: 'membershipStartDate',
      label: 'Fecha de Ingreso',
      render: (member: Member) => `
        <div class="text-sm text-gray-600">
          ${member.membershipStartDate ? new Date(member.membershipStartDate).toLocaleDateString('es-AR') : '-'}
        </div>
      `
    },
    {
      key: 'status',
      label: 'Estado',
      render: (member: Member) => `
        <span class="badge ${member.status === 'active' ? 'badge-success' : 'badge-warning'}">
          ${member.status === 'active' ? 'Activo' : 'Inactivo'}
        </span>
      `
    }
  ];

  $: actions = [
    ...(onView ? [{
      label: 'Ver Detalle',
      icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
      color: 'btn-primary',
      onClick: onView
    }] : []),
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
    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
    title: 'No hay miembros',
    description: 'Comienza agregando miembros a esta institución',
    action: {
      label: 'Agregar Miembro',
      onClick: () => {
        // Se manejará desde el componente padre
      }
    }
  };
</script>

<DataTable 
  data={members}
  {columns}
  {actions}
  {emptyState}
  {pagination}
  {buildUrl}
  {goto}
  {loading}
/>
