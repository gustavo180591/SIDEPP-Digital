import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Verificando datos en la base de datos...\n');

  // 1. Verificar PDFs
  const pdfFiles = await prisma.pdfFile.findMany({
    include: {
      period: true
    },
    orderBy: { createdAt: 'desc' }
  });

  console.log(`📄 PdfFiles encontrados: ${pdfFiles.length}`);
  pdfFiles.forEach(pdf => {
    console.log(`   - ${pdf.fileName}`);
    console.log(`     Tipo: ${pdf.type || 'N/A'}`);
    console.log(`     Período ID: ${pdf.periodId || 'N/A'}`);
    console.log(`     Hash: ${pdf.bufferHash?.substring(0, 10)}...`);
  });
  console.log('');

  // 2. Verificar PayrollPeriods
  const periods = await prisma.payrollPeriod.findMany({
    include: {
      institution: true,
      pdfFile: true
    },
    orderBy: { createdAt: 'desc' }
  });

  console.log(`📅 PayrollPeriods encontrados: ${periods.length}`);
  periods.forEach(period => {
    console.log(`   - Institución: ${period.institution?.name || 'N/A'}`);
    console.log(`     Período: ${period.month}/${period.year}`);
    console.log(`     Concepto: ${period.concept}`);
    console.log(`     Personas: ${period.peopleCount}`);
    console.log(`     Total: $${period.totalAmount}`);
    console.log(`     PDF asociado: ${period.pdfFile?.fileName || 'N/A'}`);
  });
  console.log('');

  // 3. Verificar ContributionLines
  const contributions = await prisma.contributionLine.findMany({
    include: {
      member: true
    },
    orderBy: { createdAt: 'desc' }
  });

  console.log(`💰 ContributionLines encontradas: ${contributions.length}`);
  if (contributions.length > 0) {
    console.log('   Primeras 5:');
    contributions.slice(0, 5).forEach(c => {
      console.log(`   - ${c.name}: $${c.conceptAmount} (${c.status})`);
    });
  }
  console.log('');

  // 4. Verificar Members creados/actualizados
  const members = await prisma.member.findMany({
    where: {
      institucionId: { not: null }
    },
    orderBy: { updatedAt: 'desc' },
    take: 10
  });

  console.log(`👥 Members encontrados: ${members.length}`);
  if (members.length > 0) {
    console.log('   Primeros 10:');
    members.forEach(m => {
      console.log(`   - ${m.fullName || 'Sin nombre'} (${m.documentoIdentidad})`);
    });
  }

  console.log('\n✅ Verificación completada');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
