// prisma/seed.ts
import { PrismaClient, ContributionStatus, Prisma } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding SIDEPP...');
  
  // Orden de creación: User -> Institution -> Member -> PayrollPeriod -> PdfFile -> BankTransfer -> ContributionLine

  // 1) Admin
  const adminEmail = 'admin@sidepp.com';
  const adminPassword = '123456';
  const hashed = await hash(adminPassword, 10);

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { 
      name: 'Administrador',
      password: hashed,
      isActive: true,
      role: 'ADMIN'
    },
    create: { 
      email: adminEmail, 
      name: 'Administrador', 
      password: hashed,
      isActive: true,
      role: 'ADMIN'
    }
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

  // 4) Períodos primero (sin PDFs ni transferencias)
  const year = new Date().getFullYear();
  const period1 = await prisma.payrollPeriod.upsert({
    where: {
      uq_period_institution_month_year_concept: {
        institutionId: institution1.id, month: 1, year, concept: 'Aporte Sindical SIDEPP (1%)'
      }
    },
    update: { 
      peopleCount: 2, 
      totalAmount: new Prisma.Decimal(9500)
    },
    create: {
      institutionId: institution1.id,
      month: 1,
      year,
      concept: 'Aporte Sindical SIDEPP (1%)',
      peopleCount: 2,
      totalAmount: new Prisma.Decimal(9500),
      pdfFileId: 'temp1', // Temporal
      transferId: 'temp1' // Temporal
    }
  });

  const period2 = await prisma.payrollPeriod.upsert({
    where: {
      uq_period_institution_month_year_concept: {
        institutionId: institution2.id, month: 1, year, concept: 'Aporte Sindical SIDEPP (1%)'
      }
    },
    update: { 
      peopleCount: 1, 
      totalAmount: new Prisma.Decimal(2500)
    },
    create: {
      institutionId: institution2.id,
      month: 1,
      year,
      concept: 'Aporte Sindical SIDEPP (1%)',
      peopleCount: 1,
      totalAmount: new Prisma.Decimal(2500),
      pdfFileId: 'temp2', // Temporal
      transferId: 'temp2' // Temporal
    }
  });

  // 5) PDFs con IDs correctos de períodos
  const pdfFile1 = await prisma.pdfFile.create({
    data: {
      fileName: `listado-enero-${year}.pdf`,
      periodId: period1.id
    }
  });

  const pdfFile2 = await prisma.pdfFile.create({
    data: {
      fileName: `listado-enero-${year}-inst2.pdf`,
      periodId: period2.id
    }
  });

  // 6) Transferencias bancarias
  const transfer1 = await prisma.bankTransfer.create({
    data: {
      datetime: new Date(year, 0, 5, 14, 30, 0),
      reference: 'TRF-001',
      operationNo: 'OP-123456',
      cbuDestino: '0110599520000001234567',
      cuentaOrigen: '191-123456/7',
      importe: new Prisma.Decimal(9500),
      cuitOrdenante: '30500009027',
      cuitBenef: '30-50000902-7',
      titular: 'MINISTERIO DE EDUCACION DE LA NACION',
      periodId: period1.id
    }
  });

  const transfer2 = await prisma.bankTransfer.create({
    data: {
      datetime: new Date(year, 0, 5, 15, 0, 0),
      reference: 'TRF-002',
      operationNo: 'OP-123457',
      cbuDestino: '0110599520000001234568',
      cuentaOrigen: '191-123457/8',
      importe: new Prisma.Decimal(2500),
      cuitOrdenante: '30500009035',
      cuitBenef: '30-50000903-5',
      titular: 'UNIVERSIDAD DE BUENOS AIRES',
      periodId: period2.id
    }
  });

  // 7) Actualizar períodos con los IDs correctos de PDFs y transferencias
  await prisma.payrollPeriod.update({
    where: { id: period1.id },
    data: {
      pdfFileId: pdfFile1.id,
      transferId: transfer1.id
    }
  });

  await prisma.payrollPeriod.update({
    where: { id: period2.id },
    data: {
      pdfFileId: pdfFile2.id,
      transferId: transfer2.id
    }
  });

  // 8) Líneas de aporte
  await prisma.contributionLine.createMany({
    data: [
      { memberId: member1.id, name: 'LOPEZ, ANA', quantity: 1, conceptAmount: new Prisma.Decimal(5000), totalRem: new Prisma.Decimal(250000), status: ContributionStatus.MATCHED },
      { memberId: member2.id, name: 'RODRIGUEZ, CARLOS', quantity: 1, conceptAmount: new Prisma.Decimal(4500), totalRem: new Prisma.Decimal(225000), status: ContributionStatus.MATCHED },
      { memberId: member3.id, name: 'MARTINEZ, LAURA', quantity: 1, conceptAmount: new Prisma.Decimal(2500), totalRem: new Prisma.Decimal(125000), status: ContributionStatus.MATCHED }
    ],
    skipDuplicates: true
  });

  console.log('✅ Seed OK. Admin:', adminEmail, adminPassword);
}

main()
  .catch((e) => { 
    console.error('❌ Error during seeding:', e); 
    throw e;
  })
  .finally(async () => { 
    await prisma.$disconnect(); 
  });
