import { ServiceOrderRepository } from '@infrastructure/database/prisma/repositories/service-order.repository';
import { ServiceOrderEntity } from '@domain/entities/service-order/service-order.entity';
import { PrismaService } from '@infrastructure/database/prisma/prisma.service';
import { randomUUID } from 'crypto';

/**
 * Exercita a persistência de ordens de serviço contra um Postgres de verdade.
 *
 * Existe por causa da migração que trocou os campos Json `services` e `parts`
 * por tabelas de junção: escrita e leitura de relação aninhada, ordem dos
 * itens, integridade referencial e cascade são coisas que só o banco decide —
 * teste com repositório mockado não prova nada disso.
 */
describe('ServiceOrderRepository (integração)', () => {
  let prisma: PrismaService;
  let repository: ServiceOrderRepository;

  const CUSTOMER_ID = randomUUID();
  const VEHICLE_ID = randomUUID();
  const SERVICE_A = randomUUID();
  const SERVICE_B = randomUUID();
  const PART_ID = randomUUID();

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.onModuleInit();
    repository = new ServiceOrderRepository(prisma);

    await prisma.customer.create({
      data: {
        id: CUSTOMER_ID,
        name: 'Jane Doe',
        document: `doc-${CUSTOMER_ID.slice(0, 8)}`,
        type: 'INDIVIDUAL',
        email: 'jane@example.com',
        phone: '11999999999',
      },
    });
    await prisma.vehicle.create({
      data: {
        id: VEHICLE_ID,
        customerId: CUSTOMER_ID,
        licensePlate: `AB${CUSTOMER_ID.slice(0, 5).toUpperCase()}`,
        brand: 'VW',
        model: 'Gol',
        year: 2020,
      },
    });
    await prisma.service.createMany({
      data: [
        {
          id: SERVICE_A,
          name: 'Troca de óleo',
          price: 150.0,
          estimatedDurationMinutes: 60,
        },
        {
          id: SERVICE_B,
          name: 'Alinhamento',
          price: 80.5,
          estimatedDurationMinutes: 30,
        },
      ],
    });
    await prisma.part.create({
      data: {
        id: PART_ID,
        name: 'Filtro de óleo',
        code: `FLT-${PART_ID.slice(0, 6)}`,
        price: 45.9,
        stockQuantity: 10,
      },
    });
  });

  afterAll(async () => {
    await prisma.serviceOrder.deleteMany({
      where: { customerId: CUSTOMER_ID },
    });
    await prisma.vehicle.deleteMany({ where: { customerId: CUSTOMER_ID } });
    await prisma.customer.deleteMany({ where: { id: CUSTOMER_ID } });
    await prisma.service.deleteMany({
      where: { id: { in: [SERVICE_A, SERVICE_B] } },
    });
    await prisma.part.deleteMany({ where: { id: PART_ID } });
    await prisma.onModuleDestroy();
  });

  const makeOrder = (): ServiceOrderEntity =>
    ServiceOrderEntity.create(
      {
        orderNumber: `OS-${randomUUID().slice(0, 8)}`,
        customerId: CUSTOMER_ID,
        vehicleId: VEHICLE_ID,
        problemDescription: 'Barulho no motor',
      },
      randomUUID(),
    );

  it('persiste e relê uma ordem com serviços e peças', async () => {
    const order = makeOrder();
    order.addService({
      serviceId: SERVICE_A,
      serviceName: 'Troca de óleo',
      price: 150.0,
      quantity: 1,
      notes: 'urgente',
    });
    order.addPart({
      partId: PART_ID,
      partName: 'Filtro de óleo',
      partCode: 'FLT-001',
      unitPrice: 45.9,
      quantity: 3,
      totalPrice: 137.7,
    });

    const created = await repository.create(order);
    expect(created.services).toHaveLength(1);
    expect(created.parts).toHaveLength(1);

    const reloaded = await repository.findById(created.id);
    expect(reloaded).not.toBeNull();
    expect(reloaded!.services[0]).toMatchObject({
      serviceId: SERVICE_A,
      serviceName: 'Troca de óleo',
      price: 150.0,
      quantity: 1,
      notes: 'urgente',
    });
    // totalPrice não é coluna: é recalculado a partir de unitPrice e quantity.
    expect(reloaded!.parts[0].totalPrice).toBe(137.7);
    expect(reloaded!.totalAmount).toBe(287.7);
  });

  it('preserva a ordem em que os itens foram adicionados', async () => {
    const order = makeOrder();
    order.addService({
      serviceId: SERVICE_B,
      serviceName: 'Alinhamento',
      price: 80.5,
      quantity: 2,
    });
    order.addService({
      serviceId: SERVICE_A,
      serviceName: 'Troca de óleo',
      price: 150.0,
      quantity: 1,
    });

    const created = await repository.create(order);
    const reloaded = await repository.findById(created.id);

    // Sem a coluna `position` a ordem de leitura seria indefinida e a
    // resposta da API mudaria entre requisições.
    expect(reloaded!.services.map((s) => s.serviceId)).toEqual([
      SERVICE_B,
      SERVICE_A,
    ]);
  });

  it('substitui os itens no update sem deixar órfão', async () => {
    const order = makeOrder();
    order.addService({
      serviceId: SERVICE_A,
      serviceName: 'Troca de óleo',
      price: 150.0,
      quantity: 1,
    });
    const created = await repository.create(order);

    created.addService({
      serviceId: SERVICE_B,
      serviceName: 'Alinhamento',
      price: 80.5,
      quantity: 2,
    });
    await repository.update(created);

    const reloaded = await repository.findById(created.id);
    expect(reloaded!.services).toHaveLength(2);
    expect(reloaded!.totalAmount).toBe(311.0);

    // O update apaga e recria os filhos; se sobrasse lixo, a contagem direta
    // na tabela seria maior que a da entidade.
    const rows = await prisma.serviceOrder.findUnique({
      where: { id: created.id },
      include: { services: true },
    });
    expect(rows!.services).toHaveLength(2);
  });

  it('recusa item que aponta para serviço inexistente', async () => {
    const order = makeOrder();
    order.addService({
      serviceId: randomUUID(),
      serviceName: 'Serviço fantasma',
      price: 10,
      quantity: 1,
    });

    // É exatamente a integridade que o campo Json não dava: antes, um
    // serviceId inválido era gravado sem reclamação nenhuma.
    await expect(repository.create(order)).rejects.toThrow();
  });

  it('apaga os itens junto com a ordem', async () => {
    const order = makeOrder();
    order.addService({
      serviceId: SERVICE_A,
      serviceName: 'Troca de óleo',
      price: 150.0,
      quantity: 1,
    });
    const created = await repository.create(order);

    await prisma.serviceOrder.delete({ where: { id: created.id } });

    const orphans = await prisma.serviceOrderService.count({
      where: { serviceOrderId: created.id },
    });
    expect(orphans).toBe(0);
  });

  it('impede apagar serviço do catálogo referenciado por uma ordem', async () => {
    const order = makeOrder();
    order.addService({
      serviceId: SERVICE_B,
      serviceName: 'Alinhamento',
      price: 80.5,
      quantity: 1,
    });
    await repository.create(order);

    // ON DELETE RESTRICT: o histórico de ordens não pode ficar apontando
    // para um serviço que sumiu do catálogo.
    await expect(
      prisma.service.delete({ where: { id: SERVICE_B } }),
    ).rejects.toThrow();
  });
});
