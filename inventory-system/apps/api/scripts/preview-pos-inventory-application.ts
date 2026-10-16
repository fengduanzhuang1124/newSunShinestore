import '../src/config/environment.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { PosInventoryApplicationService } from '../src/pos/application/pos-inventory-application.service.js';

const value = (name: string) => process.argv
  .find((argument) => argument.startsWith(`--${name}=`))
  ?.slice(name.length + 3);

const storeValue = value('store');
const fromValue = value('from') ?? process.env.POS_INVENTORY_BASELINE_AT;
const toValue = value('to');
if (!storeValue || !/^\d+$/.test(storeValue)) throw new Error('--store must be a positive integer');
if (!fromValue || Number.isNaN(new Date(fromValue).getTime())) throw new Error('--from must be an ISO timestamp');
if (!toValue || Number.isNaN(new Date(toValue).getTime())) throw new Error('--to must be an ISO timestamp');

const prisma = new PrismaService();
await prisma.onModuleInit();
try {
  const organization = await prisma.client.store.findUniqueOrThrow({
    where: { id: BigInt(storeValue) },
    select: { organizationId: true },
  });
  const service = new PosInventoryApplicationService(prisma);
  const result = await service.previewRange(
    organization.organizationId,
    BigInt(storeValue),
    new Date(fromValue),
    new Date(toValue),
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  await prisma.onModuleDestroy();
}
