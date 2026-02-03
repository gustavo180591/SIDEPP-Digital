<script context="module" lang="ts">
  export type PersonaRow = {
    nombre: string;
    totRemunerativo: number;
    cantidadLegajos: number;
    montoConcepto: number;
  };

  export type TableData = {
    personas?: number;
    totalRemunerativo?: number;
    cantidadLegajos?: number;
    montoConcepto?: number;
  };
</script>

<script lang="ts">
  export let title: string = 'TOTALES POR CONCEPTO - PERSONAS';
  export let concept: string = 'Apte. Sindical SIDEPP (1%)';
  export let personas: PersonaRow[] = [];
  export let tableData: TableData | undefined = undefined;

  const currency = (n: number) => new Intl.NumberFormat('es-AR', { 
    style: 'currency', 
    currency: 'ARS', 
    minimumFractionDigits: 2 
  }).format(n || 0);

  const formatNumber = (n: number) => new Intl.NumberFormat('es-AR', { 
    minimumFractionDigits: 2 
  }).format(n || 0);

  // Calcular totales si no se proporcionan
  $: totalPersonas = tableData?.personas || personas.length;
  $: totalRemunerativo = tableData?.totalRemunerativo || personas.reduce((sum, p) => sum + p.totRemunerativo, 0);
  $: totalLegajos = tableData?.cantidadLegajos || personas.reduce((sum, p) => sum + p.cantidadLegajos, 0);
  $: totalMontoConcepto = tableData?.montoConcepto || personas.reduce((sum, p) => sum + p.montoConcepto, 0);
</script>

<div class="mt-4">
  <!-- Título principal -->
  <div class="text-center mb-4">
    <h3 class="text-lg font-bold text-gray-900">{title}</h3>
    <div class="w-full h-px bg-gray-300 my-2"></div>
    <p class="text-sm text-gray-700 text-left">Concepto: {concept}</p>
  </div>

  <!-- Tabla principal -->
  <div class="overflow-x-auto rounded-lg border border-gray-300">
    <table class="min-w-full divide-y divide-gray-200">
      <thead class="bg-gray-50">
        <tr>
          <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 border-r border-gray-200">
            Personas
          </th>
          <th class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
            Monto del Concepto
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-200 bg-white">
        {#if personas.length > 0}
          {#each personas as persona}
            <tr class="hover:bg-gray-50">
              <td class="px-4 py-3 text-sm border-r border-gray-200">
                <div class="flex items-center gap-2">
                  <span class="font-medium text-gray-900">{persona.nombre}</span>
                  <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-900">
                    {persona.cantidadLegajos} {persona.cantidadLegajos === 1 ? 'legajo' : 'legajos'}
                  </span>
                </div>
              </td>
              <td class="px-4 py-3 text-right text-sm font-mono text-gray-700">
                {formatNumber(persona.montoConcepto)}
              </td>
            </tr>
          {/each}
        {:else}
          <tr>
            <td colspan="2" class="px-4 py-6 text-center text-sm text-gray-500">
              No se detectaron personas en el PDF
            </td>
          </tr>
        {/if}
      </tbody>
    </table>
  </div>

  <!-- Sección de totales -->
  <div class="mt-4 flex justify-between items-start">
    <div class="text-sm text-gray-700">
      <div class="font-medium">Totales:</div>
      <div class="mt-1">Cantidad de Personas: {totalPersonas}</div>
    </div>
    <div class="text-sm font-mono text-gray-700">
      {formatNumber(totalMontoConcepto)}
    </div>
  </div>

  <!-- Información adicional si está disponible -->
  {#if tableData}
    <div class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
      <div class="rounded-lg border border-gray-200 bg-white p-3">
        <div class="text-xs text-gray-500">Total Legajos</div>
        <div class="text-sm font-medium">{totalLegajos}</div>
      </div>
      <div class="rounded-lg border border-gray-200 bg-white p-3">
        <div class="text-xs text-gray-500">Total Concepto</div>
        <div class="text-sm font-medium">{currency(totalMontoConcepto)}</div>
      </div>
    </div>
  {/if}
</div>
