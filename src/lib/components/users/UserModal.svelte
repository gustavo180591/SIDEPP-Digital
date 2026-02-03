<script lang="ts">
  import { Modal } from '$lib/components/shared';
  import type { UserListItem, UserRole } from '$lib/db/models';

  export let showModal: boolean;
  export let modalType: 'create' | 'edit' | 'delete';
  export let user: UserListItem | null = null;
  export let institutions: Array<{ id: string; name: string | null }> = [];
  export let onClose: () => void;

  // Helper para obtener IDs de instituciones del usuario
  function getUserInstitutionIds(u: UserListItem | null): string[] {
    if (!u?.userInstitutions) return [];
    return u.userInstitutions.map(ui => ui.institution.id);
  }

  let formData = {
    name: user?.name || '',
    email: user?.email || '',
    password: '',
    confirmPassword: '',
    institutionIds: getUserInstitutionIds(user),
    role: user?.role || 'LIQUIDADOR' as UserRole,
    isActive: user?.isActive ?? true
  };

  // Reset form data when user changes or modal opens
  $: if (user && modalType === 'edit' && showModal) {
    formData = {
      name: user.name || '',
      email: user.email || '',
      password: '',
      confirmPassword: '',
      institutionIds: getUserInstitutionIds(user),
      role: user.role,
      isActive: user.isActive
    };
  }

  // Reset form data when modal closes or changes to create
  $: if (!showModal || modalType === 'create') {
    if (modalType === 'create') {
      formData = {
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
        institutionIds: [],
        role: 'LIQUIDADOR',
        isActive: true
      };
    }
  }

  function handleClose() {
    formData = {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      institutionIds: [],
      role: 'LIQUIDADOR',
      isActive: true
    };
    onClose();
  }

  // Hacer los campos reactivos para que se actualicen cuando cambie formData
  $: fields = [
    {
      name: 'name',
      label: 'Nombre',
      type: 'text',
      placeholder: 'Nombre del usuario',
      required: true,
      minLength: 2,
      maxLength: 100,
      value: formData.name
    },
    {
      name: 'email',
      label: 'Email',
      type: 'email',
      placeholder: 'usuario@ejemplo.com',
      required: true,
      pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',
      value: formData.email
    },
    {
      name: 'password',
      label: modalType === 'edit' ? 'Nueva Contraseña (opcional)' : 'Contraseña',
      type: 'password',
      placeholder: modalType === 'create' ? 'Mín. 8 caracteres, mayúscula, minúscula, número' : 'Dejar vacío para mantener actual',
      required: modalType === 'create',
      minLength: modalType === 'create' ? 8 : undefined,
      value: formData.password
    },
    ...(modalType === 'create' ? [{
      name: 'confirmPassword',
      label: 'Confirmar Contraseña',
      type: 'password',
      placeholder: 'Confirmar contraseña',
      required: true,
      minLength: 8,
      value: formData.confirmPassword
    }] : []),
    {
      name: 'institutionIds',
      label: 'Instituciones',
      type: 'multiselect',
      placeholder: 'Seleccionar instituciones',
      value: formData.institutionIds,
      options: institutions.map(inst => ({
        value: inst.id,
        label: inst.name || 'Sin nombre'
      }))
    },
    {
      name: 'role',
      label: 'Rol',
      type: 'select',
      placeholder: 'Seleccionar rol',
      required: true,
      value: formData.role,
      options: [
        { value: 'ADMIN', label: 'Administrador' },
        { value: 'FINANZAS', label: 'Finanzas' },
        { value: 'LIQUIDADOR', label: 'Liquidador' }
      ]
    },
    {
      name: 'isActive',
      label: 'Estado',
      type: 'select',
      placeholder: 'Seleccionar estado',
      value: formData.isActive.toString(),
      options: [
        { value: 'true', label: 'Activo' },
        { value: 'false', label: 'Inactivo' }
      ]
    }
  ];

  const getTitle = () => {
    switch (modalType) {
      case 'create': return 'Nuevo Usuario';
      case 'edit': return 'Editar Usuario';
      case 'delete': return 'Eliminar Usuario';
      default: return 'Usuario';
    }
  };

  const getFormAction = () => {
    switch (modalType) {
      case 'create': return '?/create';
      case 'edit': return '?/update';
      case 'delete': return '?/delete';
      default: return '';
    }
  };

  const getSubmitLabel = () => {
    switch (modalType) {
      case 'create': return 'Crear Usuario';
      case 'edit': return 'Actualizar Usuario';
      case 'delete': return 'Eliminar';
      default: return 'Guardar';
    }
  };
</script>

<Modal
  {showModal}
  title={getTitle()}
  type={modalType}
  onClose={handleClose}
  formAction={getFormAction()}
  formData={{
    ...formData,
    ...(user?.id && { id: user.id })
  }}
  fields={modalType !== 'delete' ? fields : []}
  submitLabel={getSubmitLabel()}
  deleteMessage={user ? `¿Estás seguro de que deseas eliminar al usuario "${user.name || user.email}"?\n\nEl usuario será marcado como eliminado y no podrá acceder al sistema. Sus datos se conservarán en la base de datos por motivos de auditoría.\n\nNota: Si solo deseas impedir el acceso temporalmente, usa el botón "Desactivar" en su lugar.` : ''}
  deleteItemName={user ? `${user.name || user.email} (${user.email})` : ''}
/>
