<script lang="ts">
  import { Modal } from '$lib/components/shared';
  import type { Member } from '@prisma/client';
  
  export let showModal: boolean;
  export let modalType: 'create' | 'edit' | 'delete';
  export let member: Member | null = null;
  export let onClose: () => void;
  export let institutionId: string;

  let formData = {
    fullName: member?.fullName || '',
    email: member?.email || '',
    numeroOrden: member?.numeroOrden || '',
    numeroMatricula: member?.numeroMatricula || '',
    documentoIdentidad: member?.documentoIdentidad || '',
    membershipStartDate: member?.membershipStartDate ? new Date(member.membershipStartDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    status: member?.status || 'active'
  };

  // Reset form data when member changes or modal opens
  $: if (member && modalType === 'edit' && showModal) {
    formData = {
      fullName: member.fullName || '',
      email: member.email || '',
      numeroOrden: member.numeroOrden || '',
      numeroMatricula: member.numeroMatricula || '',
      documentoIdentidad: member.documentoIdentidad || '',
      membershipStartDate: member.membershipStartDate ? new Date(member.membershipStartDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      status: member.status || 'active'
    };
  }

  // Reset form data when modal closes or changes to create
  $: if (!showModal || modalType === 'create') {
    if (modalType === 'create') {
      formData = {
        fullName: '',
        email: '',
        numeroOrden: '',
        numeroMatricula: '',
        documentoIdentidad: '',
        membershipStartDate: new Date().toISOString().split('T')[0],
        status: 'active'
      };
    }
  }

  function handleClose() {
    formData = {
      fullName: '',
      email: '',
      numeroOrden: '',
      numeroMatricula: '',
      documentoIdentidad: '',
      membershipStartDate: new Date().toISOString().split('T')[0],
      status: 'active'
    };
    onClose();
  }

  // Hacer los campos reactivos para que se actualicen cuando cambie formData
  $: fields = [
    {
      name: 'fullName',
      label: 'Nombre Completo',
      type: 'text',
      placeholder: 'Nombre completo del miembro',
      required: true,
      value: formData.fullName
    },
    {
      name: 'email',
      label: 'Email',
      type: 'email',
      placeholder: 'email@ejemplo.com',
      value: formData.email
    },
    {
      name: 'documentoIdentidad',
      label: 'Documento de Identidad',
      type: 'text',
      placeholder: 'Número de documento',
      required: true,
      value: formData.documentoIdentidad
    },
    {
      name: 'numeroOrden',
      label: 'Número de Orden',
      type: 'text',
      placeholder: 'Número de orden',
      required: true,
      value: formData.numeroOrden
    },
    {
      name: 'numeroMatricula',
      label: 'Número de Matrícula',
      type: 'text',
      placeholder: 'Número de matrícula',
      required: true,
      value: formData.numeroMatricula
    },
    {
      name: 'membershipStartDate',
      label: 'Fecha de Ingreso',
      type: 'date',
      placeholder: 'Fecha de ingreso',
      required: true,
      value: formData.membershipStartDate
    },
    {
      name: 'status',
      label: 'Estado',
      type: 'select',
      placeholder: 'Seleccionar estado',
      value: formData.status,
      options: [
        { value: 'active', label: 'Activo' },
        { value: 'inactive', label: 'Inactivo' }
      ]
    }
  ];

  const getTitle = () => {
    switch (modalType) {
      case 'create': return 'Nuevo Miembro';
      case 'edit': return 'Editar Miembro';
      case 'delete': return 'Eliminar Miembro';
      default: return 'Miembro';
    }
  };

  const getFormAction = () => {
    switch (modalType) {
      case 'create': return '?/createMember';
      case 'edit': return '?/updateMember';
      case 'delete': return '?/deleteMember';
      default: return '';
    }
  };

  const getSubmitLabel = () => {
    switch (modalType) {
      case 'create': return 'Crear Miembro';
      case 'edit': return 'Actualizar Miembro';
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
    institutionId,
    ...(member?.id && { id: member.id })
  }}
  fields={modalType !== 'delete' ? fields : []}
  submitLabel={getSubmitLabel()}
  deleteMessage={member ? `¿Estás seguro de que deseas eliminar a ${member.fullName}? Esta acción no se puede deshacer.` : ''}
  deleteItemName={member ? `${member.fullName} (N° Orden: ${member.numeroOrden})` : ''}
/>
