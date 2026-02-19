<script lang="ts">
  import { Modal } from '$lib/components/shared';
  import type { InstitutionListItem } from '$lib/db/models';
  import { tick } from 'svelte';
  
  export let showModal: boolean;
  export let modalType: 'create' | 'edit' | 'delete';
  export let institution: InstitutionListItem | null = null;
  export let onClose: () => void;
  export let onDelete: (() => void) | null = null;

  let formData: Record<string, string> = {
    name: institution?.name || '',
    cuit: institution?.cuit || '',
    address: institution?.address || '',
    city: institution?.city || '',
    state: institution?.state || '',
    country: institution?.country || 'Argentina',
    responsibleName: institution?.responsibleName || '',
    responsibleEmail: institution?.responsibleEmail || '',
    responsablePhone: institution?.responsablePhone || '',
    fopidEnabled: (institution as any)?.fopidEnabled !== false ? 'true' : 'false'
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
      responsablePhone: institution.responsablePhone || '',
      fopidEnabled: (institution as any)?.fopidEnabled !== false ? 'true' : 'false'
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
        responsablePhone: '',
        fopidEnabled: 'true'
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
      responsablePhone: '',
      fopidEnabled: 'true'
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
        minLength: 2,
        maxLength: 200,
        span: 2,
        value: formData.name
      },
      {
        name: 'cuit',
        label: 'CUIT',
        type: 'text',
        placeholder: '20-12345678-9',
        pattern: '^\\d{2}-?\\d{8}-?\\d$',
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
        maxLength: 300,
        span: 2,
        value: formData.address
      },
      {
        name: 'city',
        label: 'Ciudad',
        type: 'text',
        placeholder: 'Ciudad',
        maxLength: 100,
        value: formData.city
      },
      {
        name: 'state',
        label: 'Provincia',
        type: 'text',
        placeholder: 'Provincia',
        maxLength: 100,
        value: formData.state
      },
      {
        name: 'responsibleName',
        label: 'Nombre del Responsable',
        type: 'text',
        placeholder: 'Nombre del responsable',
        maxLength: 100,
        value: formData.responsibleName
      },
      {
        name: 'responsibleEmail',
        label: 'Email del Responsable',
        type: 'email',
        placeholder: 'email@ejemplo.com',
        pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',
        value: formData.responsibleEmail
      },
      {
        name: 'responsablePhone',
        label: 'Teléfono del Responsable',
        type: 'tel',
        placeholder: '+54 11 1234-5678',
        pattern: '^[\\d\\s\\-+()]{7,20}$',
        value: formData.responsablePhone
      },
      {
        name: 'fopidEnabled',
        label: 'Requiere FOPID',
        type: 'select',
        options: [
          { value: 'true', label: 'Sí - Requiere archivo FOPID' },
          { value: 'false', label: 'No - No requiere FOPID' }
        ],
        value: formData.fopidEnabled,
        span: 2
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