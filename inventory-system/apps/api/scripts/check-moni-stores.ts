import '../src/config/environment.js';
import { MoniConfigService } from '../src/pos/config/moni-config.service.js';
import { MoniSignatureService } from '../src/pos/adapters/moni/moni-signature.service.js';
import { MoniHttpClient } from '../src/pos/adapters/moni/moni-http-client.js';
import { MoniStoreGateway } from '../src/pos/adapters/moni/moni-store.gateway.js';
import { MoniAuthService } from '../src/pos/adapters/moni/moni-auth.service.js';

const config = new MoniConfigService();
const signature = new MoniSignatureService(config);
const http = new MoniHttpClient(config, signature);
const auth = new MoniAuthService(config, http);
const stores = new MoniStoreGateway(config, http, auth);

try {
  const result = await stores.listStores();
  console.log(
    JSON.stringify(
      {
        ok: true,
        total: result.total,
        pageTotal: result.pageTotal,
        returned: result.stores.length,
        stores: result.stores,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(
    JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown Moni error',
    }),
  );
  process.exitCode = 1;
}
