import '../src/config/environment.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { MoniConfigService } from '../src/pos/config/moni-config.service.js';
import { MoniSignatureService } from '../src/pos/adapters/moni/moni-signature.service.js';
import { MoniHttpClient } from '../src/pos/adapters/moni/moni-http-client.js';
import { MoniAuthService } from '../src/pos/adapters/moni/moni-auth.service.js';
import { MoniProductGateway } from '../src/pos/adapters/moni/moni-product.gateway.js';
import { PosProductCatalogService } from '../src/pos/application/pos-product-catalog.service.js';

const username = process.argv[2] ?? 'wf66';
const prisma = new PrismaService();
await prisma.onModuleInit();
const config = new MoniConfigService();
const signature = new MoniSignatureService(config);
const http = new MoniHttpClient(config, signature);
const auth = new MoniAuthService(config, http);
const products = new MoniProductGateway(config, auth, http);
const catalog = new PosProductCatalogService(prisma, products);

try {
  const account = await prisma.client.user.findFirstOrThrow({
    where: { username },
    select: {
      id: true,
      organizationId: true,
      storeRoles: {
        where: { role: { code: 'ADMIN' } },
        select: { storeId: true },
        take: 1,
      },
    },
  });
  const storeId = account.storeRoles[0]?.storeId;
  if (!storeId) throw new Error(`${username} has no ADMIN store role`);

  const result = await catalog.importCandidates(
    account.organizationId,
    account.id,
    storeId.toString(),
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  await prisma.onModuleDestroy();
}
