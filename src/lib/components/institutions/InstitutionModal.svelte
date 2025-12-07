<script lang="ts">
  import { Modal } from '$lib/components/shared';
  import type { InstitutionListItem } from '$lib/db/models';
  import { tick } from 'svelte';
  
  export let showModal: boolean;
  export let modalType: 'create' | 'edit' | 'delete';
  export let institution: InstitutionListItem | null = null;
  export let onClose: () => void;
  export let onDelete: (() => void) | null = null;

  let formData = {
    name: institution?.name || '',
    cuit: institution?.cuit || '',
    address: institution?.address || '',
    city: institution?.city || '',
    state: institution?.state || '',
    country: institution?.country || 'Argentina',
    responsibleName: institution?.responsibleName || '',
    responsibleEmail: institution?.responsibleEmail || '',
    responsablePhone: institution?.responsablePhone || ''
  };

  // Reset form data when institution changes or modal opens
  $: if (institution && modalType === 'edit' && showModal) {
    formData = {
      name: institution.name || '',
      cuit: institution.cuit || '',
      address: institution.address || '',
      city: institution.city || '',
      state: institution.state || '',
      country: institution.country || 'Argentina',
      responsibleName: institution.responsibleName || '',
      responsibleEmail: institution.responsibleEmail || '',
      responsablePhone: institution.responsablePhone || ''
    };
  }

  // Reset form data when modal closes or changes to create
  $: if (!showModal || modalType === 'create') {
    if (modalType === 'create') {
      formData = {
        name: '',
        cuit: '',
        address: '',
        city: '',
        state: '',
        country: 'Argentina',
        responsibleName: '',
        responsibleEmail: '',
        responsablePhone: ''
      };
    }
  }

  function handleClose() {
    formData = {
      name: '',
      cuit: '',
      address: '',
      city: '',
      state: '',
      country: 'Argentina',
      responsibleName: '',
      responsibleEmail: '',
      responsablePhone: ''
    };
    onClose();
  }

  // Función para generar los campos - se llama solo cuando cambia la institución o el modal se abre
  function getFields() {
    return [
      {
        name: 'name',
        label: 'Nombre de la Institución',
        type: 'text',
        placeholder: 'Nombre de la institución',
        required: true,
        span: 2,
        value: formData.name
      },
      {
        name: 'cuit',
        label: 'CUIT',
        type: 'text',
        placeholder: '20-12345678-9',
        required: true,
        value: formData.cuit
      },
      {
        name: 'country',
        label: 'País',
        type: 'text',
        placeholder: 'Argentina',
        value: formData.country
      },
      {
        name: 'address',
        label: 'Dirección',
        type: 'text',
        placeholder: 'Dirección completa',
        span: 2,
        value: formData.address
      },
      {
        name: 'city',
        label: 'Ciudad',
        type: 'text',
        placeholder: 'Ciudad',
        value: formData.city
      },
      {
        name: 'state',
        label: 'Provincia',
        type: 'text',
        placeholder: 'Provincia',
        value: formData.state
      },
      {
        name: 'responsibleName',
        label: 'Nombre del Responsable',
        type: 'text',
        placeholder: 'Nombre del responsable',
        value: formData.responsibleName
      },
      {
        name: 'responsibleEmail',
        label: 'Email del Responsable',
        type: 'email',
        placeholder: 'email@ejemplo.com',
        value: formData.responsibleEmail
      },
      {
        name: 'responsablePhone',
        label: 'Teléfono del Responsable',
        type: 'tel',
        placeholder: '+54 11 1234-5678',
        value: formData.responsablePhone
      }
    ];
  }

  // Solo regenerar fields cuando el modal se abra (ya sea para crear o editar)
  // El formData ya se actualiza en los bloques reactivos anteriores
  let fields = getFields();

  // Regenerar fields después de que formData se actualice cuando el modal se abre
  $: if (showModal) {
    // tick() espera a que Svelte procese todas las actualizaciones pendientes
    tick().then(() => {
      fields = getFields();
    });
  }

  const getTitle = () => {
    switch (modalType) {
      case 'create': return 'Nueva Institución';
      case 'edit': return 'Editar Institución';
      case 'delete': return 'Eliminar Institución';
      default: return 'Institución';
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
      case 'create': return 'Crear Institución';
      case 'edit': return 'Actualizar Institución';
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
    ...(institution?.id && { id: institution.id })
  }}
  fields={modalType !== 'delete' ? fields : []}
  submitLabel={getSubmitLabel()}
  deleteMessage={institution ? `¿Estás seguro de que deseas eliminar la institución "${institution.name}"?` : ''}
  deleteItemName={institution?.name || ''}
  {onDelete}
/>