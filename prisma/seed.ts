// prisma/seed.ts
import { PrismaClient, PdfKind, ContributionStatus, Prisma } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding SIDEPP...');

  // 1) Admin
  const adminEmail = 'admin@sidepp.com';
  const adminPassword = '123456';
  const hashed = await hash(adminPassword, 10);

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { 
      name: 'Administrador',
      hash: hashed 
    } as Prisma.UserUpdateInput,
    create: { 
      email: adminEmail, 
      name: 'Administrador', 
      hash: hashed 
    } as Prisma.UserCreateInput
  });

  // 2) Instituciones
  const institution1 = await prisma.institution.upsert({
    where: { cuit: '30-50000902-7' },
    update: {
      name: 'Ministerio de Educación de la Nación',
      address: 'Pizzurno 935',
      city: 'CABA',
      state: 'Buenos Aires',
      responsibleName: 'Juan Pérez',
      responsibleEmail: 'jperez@me.gov.ar'
    },
    create: {
      name: 'Ministerio de Educación de la Nación',
      cuit: '30-50000902-7',
      address: 'Pizzurno 935',
      city: 'CABA',
      state: 'Buenos Aires',
      responsibleName: 'Juan Pérez',
      responsibleEmail: 'jperez@me.gov.ar'
    }
  });

  const institution2 = await prisma.institution.upsert({
    where: { cuit: '30-50000903-5' },
    update: {
      name: 'Universidad de Buenos Aires',
      address: 'Viamonte 430',
      city: 'CABA',
      state: 'Buenos Aires',
      responsibleName: 'María García',
      responsibleEmail: 'mgarcia@uba.edu.ar'
    },
    create: {
      name: 'Universidad de Buenos Aires',
      cuit: '30-50000903-5',
      address: 'Viamonte 430',
      city: 'CABA',
      state: 'Buenos Aires',
      responsibleName: 'María García',
      responsibleEmail: 'mgarcia@uba.edu.ar'
    }
  });

  // 3) Miembros
  const [member1, member2, member3] = await Promise.all([
    prisma.member.upsert({
      where: { numeroMatricula: 'MAT-001' },
      update: {},
      create: {
        numeroOrden: 'ORD-001',
        numeroMatricula: 'MAT-001',
        firstName: 'Ana',
        lastName: 'López',
        documentoIdentidad: '30111222',
        email: 'analopez@example.com',
        phone: '11-1234-5678',
        address: 'Av. Corrientes 1234',
        city: 'CABA',
        postalCode: 'C1043',
        country: 'Argentina',
        membershipStartDate: new Date('2020-01-15'),
        institucionId: institution1.id
      }
    }),
    prisma.member.upsert({
      where: { numeroMatricula: 'MAT-002' },
      update: {},
      create: {
        numeroOrden: 'ORD-002',
        numeroMatricula: 'MAT-002',
        firstName: 'Carlos',
        lastName: 'Rodríguez',
        documentoIdentidad: '30222333',
        email: 'crodriguez@example.com',
        phone: '11-2345-6789',
        address: 'Av. Santa Fe 2345',
        city: 'CABA',
        postalCode: 'C1123',
        country: 'Argentina',
        membershipStartDate: new Date('2019-05-20'),
        institucionId: institution1.id
      }
    }),
    prisma.member.upsert({
      where: { numeroMatricula: 'MAT-010' },
      update: {},
      create: {
        numeroOrden: 'ORD-003',
        numeroMatricula: 'MAT-010',
        firstName: 'Laura',
        lastName: 'Martínez',
        documentoIdentidad: '27333444',
        email: 'lmartinez@example.com',
        phone: '11-3456-7890',
        address: 'Av. Córdoba 3456',
        city: 'CABA',
        postalCode: 'C1052',
        country: 'Argentina',
        membershipStartDate: new Date('2021-03-10'),
        institucionId: institution2.id
      }
    })
  ]);

  // 4) Períodos
  const year = new Date().getFullYear();
  const period1 = await prisma.payrollPeriod.upsert({
    where: {
      uq_period_institution_month_year_concept: {
        institutionId: institution1.id, month: 1, year, concept: 'Aporte Sindical SIDEPP (1%)'
      }
    },
    update: { label: `Enero ${year}` , peopleCount: 2, totalAmount: new Prisma.Decimal(9500) },
    create: {
      institutionId: institution1.id,
      label: `Enero ${year}` ,
      month: 1,
      year,
      concept: 'Aporte Sindical SIDEPP (1%)',
      peopleCount: 2,
      totalAmount: new Prisma.Decimal(9500)
    }
  });

  const period2 = await prisma.payrollPeriod.upsert({
    where: {
      uq_period_institution_month_year_concept: {
        institutionId: institution2.id, month: 1, year, concept: 'Aporte Sindical SIDEPP (1%)'
      }
    },
    update: { label: `Enero ${year}` , peopleCount: 1, totalAmount: new Prisma.Decimal(2500) },
    create: {
      institutionId: institution2.id,
      label: `Enero ${year}` ,
      month: 1,
      year,
      concept: 'Aporte Sindical SIDEPP (1%)',
      peopleCount: 1,
      totalAmount: new Prisma.Decimal(2500)
    }
  });

  // 5) Líneas de aporte
  await prisma.contributionLine.createMany({
    data: [
      { periodId: period1.id, memberId: member1.id, rawName: 'LOPEZ, ANA', quantity: 1, legajos: 1, conceptAmount: new Prisma.Decimal(5000), totalRem: new Prisma.Decimal(250000), status: ContributionStatus.MATCHED },
      { periodId: period1.id, memberId: member2.id, rawName: 'RODRIGUEZ, CARLOS', quantity: 1, legajos: 1, conceptAmount: new Prisma.Decimal(4500), totalRem: new Prisma.Decimal(225000), status: ContributionStatus.MATCHED },
      { periodId: period2.id, memberId: member3.id, rawName: 'MARTINEZ, LAURA', quantity: 1, legajos: 1, conceptAmount: new Prisma.Decimal(2500), totalRem: new Prisma.Decimal(125000), status: ContributionStatus.MATCHED }
    ],
    skipDuplicates: true
  });

  // 6) Transferencia bancaria
  // Primero creamos la transferencia bancaria
  const transfer1 = await prisma.bankTransfer.create({
    data: {
      institutionId: institution1.id,
      datetime: new Date(year, 0, 5, 14, 30, 0),
      reference: 'TRF-001',
      operationNo: 'OP-123456',
      cbuDestino: '0110599520000001234567',
      cuentaOrigen: '191-123456/7',
      importe: new Prisma.Decimal(9500),
      cuitOrdenante: '30500009027',
      titular: 'MINISTERIO DE EDUCACION DE LA NACION',
      pdfFiles: {
        create: {
          fileName: `transferencia-TRF-001.pdf`,
          kind: PdfKind.TRANSFER,
          storagePath: `/uploads/transferencias/transferencia-TRF-001.pdf`,
          parsed: true,
          uploadedBy: adminUser.id
        }
      }
    },
    include: {
      pdfFiles: true
    }
  });

  // 7) PDFs de referencia
  await prisma.pdfFile.createMany({
    data: [
      {
        fileName: `listado-enero-${year}.pdf` ,
        kind: PdfKind.LISTADO,
        storagePath: `/uploads/listados/listado-enero-${year}.pdf` ,
        parsed: true,
        uploadedBy: adminUser.id,
        institutionId: institution1.id,
        periodId: period1.id
      },
      {
        fileName: `transferencia-${transfer1.reference}.pdf` ,
        kind: PdfKind.TRANSFER,
        storagePath: `/uploads/transferencias/transferencia-${transfer1.reference}.pdf` ,
        parsed: true,
        uploadedBy: adminUser.id,
        institutionId: institution1.id,
        transferId: transfer1.id
      }
    ],
    skipDuplicates: true
  });

  console.log('✅ Seed OK. Admin:', adminEmail, adminPassword);
}

main()
  .catch((e) => { 
    console.error('❌ Error during seeding:', e); 
    process.exit(1); 
  })
  .finally(async () => { 
    await prisma.$disconnect(); 
  });
