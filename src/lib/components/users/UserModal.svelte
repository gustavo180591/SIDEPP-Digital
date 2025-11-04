<script lang="ts">
  import { Modal } from '$lib/components/shared';
  import type { UserListItem, UserRole } from '$lib/db/models';

  export let showModal: boolean;
  export let modalType: 'create' | 'edit' | 'delete';
  export let user: UserListItem | null = null;
  export let institutions: Array<{ id: string; name: string | null }> = [];
  export let onClose: () => void;

  let formData = {
    name: user?.name || '',
    email: user?.email || '',
    password: '',
    confirmPassword: '',
    institutionId: user?.institutionId || '',
    role: user?.role || 'INTITUTION' as UserRole,
    isActive: user?.isActive ?? true
  };

  // Reset form data when user changes or modal opens
  $: if (user && modalType === 'edit' && showModal) {
    formData = {
      name: user.name || '',
      email: user.email || '',
      password: '',
      confirmPassword: '',
      institutionId: user.institutionId || '',
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
        institutionId: '',
        role: 'INTITUTION',
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
      institutionId: '',
      role: 'INTITUTION',
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
      value: formData.name
    },
    {
      name: 'email',
      label: 'Email',
      type: 'email',
      placeholder: 'usuario@ejemplo.com',
      required: true,
      value: formData.email
    },
    {
      name: 'password',
      label: modalType === 'edit' ? 'Nueva Contraseña (opcional)' : 'Contraseña',
      type: 'password',
      placeholder: 'Contraseña',
      required: modalType === 'create',
      value: formData.password
    },
    ...(modalType === 'create' ? [{
      name: 'confirmPassword',
      label: 'Confirmar Contraseña',
      type: 'password',
      placeholder: 'Confirmar contraseña',
      required: true,
      value: formData.confirmPassword
    }] : []),
    {
      name: 'institutionId',
      label: 'Institución',
      type: 'select',
      placeholder: 'Seleccionar institución',
      value: formData.institutionId,
      options: [
        { value: '', label: 'Sin institución' },
        ...institutions.map(inst => ({
          value: inst.id,
          label: inst.name || 'Sin nombre'
        }))
      ]
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
        { value: 'OPERATOR', label: 'Operador' },
        { value: 'INTITUTION', label: 'Institución' }
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
  deleteMessage={user ? `¿Estás seguro de que deseas eliminar al usuario ${user.name || user.email}? Esta acción no se puede deshacer.` : ''}
  deleteItemName={user ? `${user.name || user.email} (${user.email})` : ''}
/>
