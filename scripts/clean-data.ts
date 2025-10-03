import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🗑️  Limpiando datos...\n');

  // Orden de eliminación respetando las relaciones de FK

  // 1. ContributionLines (depende de Member y PdfFile)
  const deletedContributions = await prisma.contributionLine.deleteMany({});
  console.log(`✓ ${deletedContributions.count} ContributionLines eliminadas`);

  // 2. BankTransfers (depende de PayrollPeriod)
  const deletedTransfers = await prisma.bankTransfer.deleteMany({});
  console.log(`✓ ${deletedTransfers.count} BankTransfers eliminadas`);

  // 3. PdfFiles (depende de PayrollPeriod)
  const deletedPdfs = await prisma.pdfFile.deleteMany({});
  console.log(`✓ ${deletedPdfs.count} PdfFiles eliminados`);

  // 4. PayrollPeriods (depende de Institution)
  const deletedPeriods = await prisma.payrollPeriod.deleteMany({});
  console.log(`✓ ${deletedPeriods.count} PayrollPeriods eliminados`);

  console.log('\n✅ Limpieza completada');
}

main()
  .catch((e) => {
    console.error('❌ Error durante la limpieza:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
