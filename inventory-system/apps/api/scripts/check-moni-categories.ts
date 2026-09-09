import '../src/config/environment.js';
import { MoniConfigService } from '../src/pos/config/moni-config.service.js';
import { MoniSignatureService } from '../src/pos/adapters/moni/moni-signature.service.js';
import { MoniHttpClient } from '../src/pos/adapters/moni/moni-http-client.js';
import { MoniAuthService } from '../src/pos/adapters/moni/moni-auth.service.js';
import { MoniCategoryGateway } from '../src/pos/adapters/moni/moni-category.gateway.js';

const config = new MoniConfigService();
const signature = new MoniSignatureService(config);
const http = new MoniHttpClient(config, signature);
const auth = new MoniAuthService(config, http);
const categories = new MoniCategoryGateway(auth, http);

try {
  const result = await categories.listAll();
  console.log(
    JSON.stringify(
      {
        ok: true,
        returned: result.length,
        categories: result,
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
