import 'dotenv/config';
import { PrismaClient } from '@generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter } as any);

  console.log('🌱 Starting database seed...');

  // Users
  const adminPassword = await bcrypt.hash('Admin123!', 12);
  const mechPassword = await bcrypt.hash('Mech123!', 12);
  const attPassword = await bcrypt.hash('Att123!', 12);

  await (prisma.user as any).upsert({
    where: { email: 'admin@oficina.com' },
    update: {},
    create: { name: 'Administrator', email: 'admin@oficina.com', password: adminPassword, role: 'ADMIN' },
  });

  await (prisma.user as any).upsert({
    where: { email: 'mechanic@oficina.com' },
    update: {},
    create: { name: 'João Mecânico', email: 'mechanic@oficina.com', password: mechPassword, role: 'MECHANIC' },
  });

  await (prisma.user as any).upsert({
    where: { email: 'attendant@oficina.com' },
    update: {},
    create: { name: 'Maria Atendente', email: 'attendant@oficina.com', password: attPassword, role: 'ATTENDANT' },
  });

  console.log('✅ Users created');

  // Customers
  const customer1 = await (prisma.customer as any).upsert({
    where: { document: '52998224725' },
    update: {},
    create: { name: 'Carlos Silva', document: '52998224725', type: 'INDIVIDUAL', email: 'carlos@email.com', phone: '11999990001' },
  });

  const customer2 = await (prisma.customer as any).upsert({
    where: { document: '11222333000181' },
    update: {},
    create: { name: 'Empresa Logística Ltda', document: '11222333000181', type: 'COMPANY', email: 'contato@empresa.com', phone: '11999990002' },
  });

  console.log('✅ Customers created');

  // Vehicles
  await (prisma.vehicle as any).upsert({
    where: { licensePlate: 'ABC1234' },
    update: {},
    create: { customerId: customer1.id, licensePlate: 'ABC1234', brand: 'Toyota', model: 'Corolla', year: 2020, color: 'Prata' },
  });

  await (prisma.vehicle as any).upsert({
    where: { licensePlate: 'DEF5G67' },
    update: {},
    create: { customerId: customer2.id, licensePlate: 'DEF5G67', brand: 'Volkswagen', model: 'Gol', year: 2018, color: 'Branco' },
  });

  await (prisma.vehicle as any).upsert({
    where: { licensePlate: 'XYZ9876' },
    update: {},
    create: { customerId: customer1.id, licensePlate: 'XYZ9876', brand: 'Honda', model: 'Civic', year: 2022, color: 'Preto' },
  });

  console.log('✅ Vehicles created');

  // Services (no unique name constraint, use createMany with skipDuplicates via id check)
  const existingServices = await (prisma.service as any).count();
  if (existingServices === 0) {
    await (prisma.service as any).createMany({
      data: [
        { name: 'Troca de Óleo', price: 120.00, estimatedDurationMinutes: 60, isActive: true },
        { name: 'Alinhamento e Balanceamento', price: 180.00, estimatedDurationMinutes: 90, isActive: true },
        { name: 'Revisão Completa', price: 450.00, estimatedDurationMinutes: 240, isActive: true },
        { name: 'Troca de Pastilhas de Freio', price: 200.00, estimatedDurationMinutes: 120, isActive: true },
        { name: 'Diagnóstico Eletrônico', price: 150.00, estimatedDurationMinutes: 60, isActive: true },
      ],
    });
  }

  console.log('✅ Services created');

  // Parts
  const parts = [
    { name: 'Filtro de Óleo', code: 'FO001', price: 35.00, stockQuantity: 50, minStockQuantity: 10 },
    { name: 'Óleo Motor 5W30 (litro)', code: 'OM001', price: 28.00, stockQuantity: 100, minStockQuantity: 20 },
    { name: 'Pastilha de Freio Dianteira', code: 'PF001', price: 85.00, stockQuantity: 30, minStockQuantity: 5 },
    { name: 'Filtro de Ar', code: 'FA001', price: 45.00, stockQuantity: 40, minStockQuantity: 8 },
    { name: 'Vela de Ignição', code: 'VI001', price: 25.00, stockQuantity: 60, minStockQuantity: 15 },
    { name: 'Correia Dentada', code: 'CD001', price: 120.00, stockQuantity: 20, minStockQuantity: 4 },
    { name: 'Amortecedor Dianteiro', code: 'AD001', price: 250.00, stockQuantity: 8, minStockQuantity: 3 },
    { name: 'Bateria 60Ah', code: 'BA001', price: 380.00, stockQuantity: 12, minStockQuantity: 3 },
    { name: 'Pneu 195/65R15', code: 'PN001', price: 320.00, stockQuantity: 3, minStockQuantity: 4 },
    { name: 'Fluido de Freio DOT4', code: 'FF001', price: 22.00, stockQuantity: 2, minStockQuantity: 5 },
  ];

  for (const p of parts) {
    await (prisma.part as any).upsert({
      where: { code: p.code },
      update: {},
      create: { ...p, isActive: true },
    });
  }

  console.log('✅ Parts created (2 low-stock items for testing)');

  console.log('\n🎉 Seed completed successfully!');
  console.log('\n📋 Credentials:');
  console.log('  Admin:     admin@oficina.com     / Admin123!');
  console.log('  Mechanic:  mechanic@oficina.com  / Mech123!');
  console.log('  Attendant: attendant@oficina.com / Att123!');

  await (prisma as any).$disconnect();
}

main().catch((e) => {
  console.error('❌ Seed failed:', e);
  process.exit(1);
});
