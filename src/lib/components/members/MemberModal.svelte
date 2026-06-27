<script lang="ts">
  import { Modal } from '$lib/components/shared';
  import type { Member } from '@prisma/client';

  export let showModal: boolean;
  export let modalType: 'create' | 'edit' | 'delete';
  export let member: Member | null = null;
  export let onClose: () => void;
  export let institutionId: string;
  // Nuevas props para selector de institución
  export let showInstitutionSelector: boolean = false;
  export let institutions: Array<{ id: string; name: string }> = [];
  // Prop para permitir campos opcionales en edición
  export let allowOptionalFields: boolean = false;

  let formData = {
    fullName: member?.fullName || '',
    email: member?.email || '',
    phone: member?.phone || '',
    numeroOrden: member?.numeroOrden || '',
    numeroMatricula: member?.numeroMatricula || '',
    documentoIdentidad: member?.documentoIdentidad || '',
    nacionalidad: member?.nacionalidad || '',
    membershipStartDate: member?.membershipStartDate ? new Date(member.membershipStartDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    status: member?.status || 'active',
    selectedInstitutionId: institutionId || ''
  };

  // Reset form data when member changes or modal opens
  $: if (member && modalType === 'edit' && showModal) {
    formData = {
      fullName: member.fullName || '',
      email: member.email || '',
      phone: member.phone || '',
      numeroOrden: member.numeroOrden || '',
      numeroMatricula: member.numeroMatricula || '',
      documentoIdentidad: member.documentoIdentidad || '',
      nacionalidad: member.nacionalidad || '',
      membershipStartDate: member.membershipStartDate ? new Date(member.membershipStartDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      status: member.status || 'active',
      selectedInstitutionId: member.institucionId || institutionId || ''
    };
  }

  // Reset form data when modal closes or changes to create
  $: if (!showModal || modalType === 'create') {
    if (modalType === 'create') {
      formData = {
        fullName: '',
        email: '',
        phone: '',
        numeroOrden: '',
        numeroMatricula: '',
        documentoIdentidad: '',
        nacionalidad: '',
        membershipStartDate: new Date().toISOString().split('T')[0],
        status: 'active',
        selectedInstitutionId: institutionId || ''
      };
    }
  }

  function handleClose() {
    formData = {
      fullName: '',
      email: '',
      phone: '',
      numeroOrden: '',
      numeroMatricula: '',
      documentoIdentidad: '',
      nacionalidad: '',
      membershipStartDate: new Date().toISOString().split('T')[0],
      status: 'active',
      selectedInstitutionId: institutionId || ''
    };
    onClose();
  }

  // Determinar el institutionId a usar (el seleccionado o el fijo)
  $: effectiveInstitutionId = showInstitutionSelector
    ? formData.selectedInstitutionId
    : institutionId;

  // Hacer los campos reactivos para que se actualicen cuando cambie formData
  $: fields = [
    // Campo de institución (si showInstitutionSelector es true)
    ...(showInstitutionSelector ? [{
      name: 'institutionId',
      label: 'Institución',
      type: 'select',
      placeholder: 'Seleccionar institución',
      required: !allowOptionalFields,
      value: formData.selectedInstitutionId,
      options: institutions.map(inst => ({ value: inst.id, label: inst.name }))
    }] : []),
    {
      name: 'fullName',
      label: 'Nombre y Apellido',
      type: 'text',
      placeholder: 'Nombre completo del miembro',
      required: !allowOptionalFields,
      minLength: 2,
      maxLength: 200,
      value: formData.fullName
    },
    {
      name: 'numeroOrden',
      label: 'Nro. Orden',
      type: 'text',
      placeholder: 'Solo números',
      required: !allowOptionalFields,
      pattern: '^\\d*$',
      maxLength: 20,
      value: formData.numeroOrden
    },
    {
      name: 'numeroMatricula',
      label: 'Nro. Matricula',
      type: 'text',
      placeholder: 'Solo números',
      required: !allowOptionalFields,
      pattern: '^\\d*$',
      maxLength: 20,
      value: formData.numeroMatricula
    },
    {
      name: 'documentoIdentidad',
      label: 'DNI',
      type: 'text',
      placeholder: 'Número de documento',
      required: !allowOptionalFields,
      maxLength: 20,
      value: formData.documentoIdentidad
    },
    {
      name: 'nacionalidad',
      label: 'Nacionalidad',
      type: 'text',
      placeholder: 'Nacionalidad',
      required: !allowOptionalFields,
      maxLength: 100,
      value: formData.nacionalidad
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
    },
    {
      name: 'membershipStartDate',
      label: 'Fecha de Ingreso',
      type: 'date',
      placeholder: 'Fecha de ingreso',
      required: !allowOptionalFields,
      max: new Date().toISOString().split('T')[0],
      value: formData.membershipStartDate
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
    institutionId: effectiveInstitutionId,
    ...(member?.id && { id: member.id })
  }}
  fields={modalType !== 'delete' ? fields : []}
  submitLabel={getSubmitLabel()}
  deleteMessage={member ? `¿Estás seguro de que deseas eliminar a ${member.fullName}? Esta acción no se puede deshacer.` : ''}
  deleteItemName={member ? `${member.fullName} (N° Orden: ${member.numeroOrden})` : ''}
/>
