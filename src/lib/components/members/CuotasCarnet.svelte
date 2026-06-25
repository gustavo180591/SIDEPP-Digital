<script lang="ts">
  const months = [
    'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
    'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
  ];

  type PaymentData = {
    monthIndex: number;
    amount: number;
  };

  let { cuotasPagadas = [], year = new Date().getFullYear() }: {
    cuotasPagadas?: PaymentData[];
    year?: number;
  } = $props();

  // Función para verificar si un mes está pagado
  function isMonthPaid(monthIndex: number): boolean {
    return cuotasPagadas.some(p => p.monthIndex === monthIndex);
  }

  // Función para obtener el monto pagado de un mes
  function getMonthAmount(monthIndex: number): number {
    const payment = cuotasPagadas.find(p => p.monthIndex === monthIndex);
    return payment?.amount || 0;
  }

  // Función para formatear moneda
  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }
</script>

<div class="cuotas-carnet">
  <div class="carnet-header">
    <div class="carnet-title">CUOTAS PAGADAS</div>
    <div class="carnet-year">AÑO {year}</div>
  </div>
  <div class="carnet-grid">
    {#each months as month, index}
      <div
        class="carnet-cell {isMonthPaid(index) ? 'paid' : 'unpaid'}"
        title="{month} - {isMonthPaid(index) ? 'Pagado' : 'No pagado'}"
      >
        <span class="month-label">{month}</span>
        {#if isMonthPaid(index)}
          <span class="amount-label">{formatCurrency(getMonthAmount(index))}</span>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .cuotas-carnet {
    border: 1px solid #d1d5db;
    border-radius: 4px;
    background: #f9fafb;
    padding: 4px;
    font-size: 10px;
    min-width: 200px;
  }

  .carnet-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 2px 4px;
    border-bottom: 1px solid #d1d5db;
    margin-bottom: 4px;
    background: #e5e7eb;
    border-radius: 2px;
  }

  .carnet-title {
    font-weight: 600;
    color: #374151;
    font-size: 9px;
    letter-spacing: 0.5px;
  }

  .carnet-year {
    font-weight: 600;
    color: #1f2937;
    font-size: 9px;
  }

  .carnet-grid {
    display: grid;
    grid-template-columns: repeat(12, 1fr);
    gap: 1px;
  }

  .carnet-cell {
    aspect-ratio: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    border: 1px solid #d1d5db;
    border-radius: 2px;
    background: white;
    transition: all 0.2s;
    gap: 1px;
  }

  .carnet-cell.paid {
    background: #dbeafe;
    border-color: #3b82f6;
  }

  .carnet-cell.paid .month-label {
    color: #1e40af;
    font-weight: 600;
  }

  .carnet-cell.paid .amount-label {
    color: #166534;
    font-weight: 600;
    font-size: 7px;
  }

  .carnet-cell.unpaid {
    background: #f3f4f6;
    border-color: #e5e7eb;
  }

  .carnet-cell.unpaid .month-label {
    color: #9ca3af;
  }

  .month-label {
    font-size: 8px;
    font-weight: 500;
    text-transform: uppercase;
  }

  .amount-label {
    font-size: 7px;
    font-weight: 600;
  }
</style>
