import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function removeDuplicateMembers() {
  console.log('🔍 Buscando miembros duplicados...\n');

  // Buscar todos los miembros agrupados por fullName + institucionId
  const allMembers = await prisma.member.findMany({
    orderBy: [
      { institucionId: 'asc' },
      { fullName: 'asc' },
      { createdAt: 'asc' } // El más antiguo primero
    ]
  });

  const grouped = new Map<string, typeof allMembers>();

  for (const member of allMembers) {
    const key = `${member.fullName}|${member.institucionId}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(member);
  }

  let totalDuplicates = 0;
  let totalDeleted = 0;

  for (const [key, members] of grouped.entries()) {
    if (members.length > 1) {
      const [fullName, institucionId] = key.split('|');
      console.log(`\n📋 Duplicados encontrados para: ${fullName} (${institucionId})`);
      console.log(`   Total registros: ${members.length}`);

      // Mantener el primero (más antiguo), eliminar el resto
      const [keep, ...toDelete] = members;

      console.log(`   ✅ Mantener: ${keep.id} (creado: ${keep.createdAt})`);

      for (const member of toDelete) {
        console.log(`   ❌ Eliminar: ${member.id} (creado: ${member.createdAt})`);

        try {
          // Primero, reasignar todas las ContributionLines al miembro que mantenemos
          const contributionCount = await prisma.contributionLine.count({
            where: { memberId: member.id }
          });

          if (contributionCount > 0) {
            console.log(`      → Reasignando ${contributionCount} contribution lines...`);
            await prisma.contributionLine.updateMany({
              where: { memberId: member.id },
              data: { memberId: keep.id }
            });
          }

          // Ahora eliminar el miembro duplicado
          await prisma.member.delete({
            where: { id: member.id }
          });

          totalDeleted++;
        } catch (err) {
          console.error(`      ⚠️ Error eliminando ${member.id}:`, err);
        }
      }

      totalDuplicates += members.length - 1;
    }
  }

  console.log('\n========================================');
  console.log('✅ RESUMEN');
  console.log('========================================');
  console.log(`Duplicados encontrados: ${totalDuplicates}`);
  console.log(`Registros eliminados: ${totalDeleted}`);
  console.log('========================================\n');
}

removeDuplicateMembers()
  .catch((err) => {
    console.error('❌ Error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
