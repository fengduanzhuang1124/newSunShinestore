import '../src/config/environment.js';
import { MoniConfigService } from '../src/pos/config/moni-config.service.js';
import { MoniSignatureService } from '../src/pos/adapters/moni/moni-signature.service.js';
import { MoniHttpClient } from '../src/pos/adapters/moni/moni-http-client.js';
import { MoniAuthService } from '../src/pos/adapters/moni/moni-auth.service.js';
import { MoniBrandGateway } from '../src/pos/adapters/moni/moni-brand.gateway.js';

const config = new MoniConfigService();
const signature = new MoniSignatureService(config);
const http = new MoniHttpClient(config, signature);
const auth = new MoniAuthService(config, http);
const brands = new MoniBrandGateway(auth, http);

try {
  const firstPage = await brands.listPage();
  const result =
    firstPage.pageTotal <= 1 ? firstPage.brands : await brands.listAll();
  console.log(
    JSON.stringify(
      {
        ok: true,
        total: firstPage.total,
        pageTotal: firstPage.pageTotal,
        returned: result.length,
        brands: result,
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
