import '../src/config/environment.js';
import { MoniConfigService } from '../src/pos/config/moni-config.service.js';
import { MoniSignatureService } from '../src/pos/adapters/moni/moni-signature.service.js';
import { MoniHttpClient } from '../src/pos/adapters/moni/moni-http-client.js';
import { MoniAuthService } from '../src/pos/adapters/moni/moni-auth.service.js';
import { MoniProductGateway } from '../src/pos/adapters/moni/moni-product.gateway.js';

const config = new MoniConfigService();
const signature = new MoniSignatureService(config);
const http = new MoniHttpClient(config, signature);
const auth = new MoniAuthService(config, http);
const gateway = new MoniProductGateway(config, auth, http);

try {
  const products = await gateway.listAll();
  const negative = products.filter(({ stock }) => stock !== null && stock < 0);
  const zero = products.filter(({ stock }) => stock === 0);
  const positive = products.filter(({ stock }) => stock !== null && stock > 0);
  const unknown = products.filter(({ stock }) => stock === null);
  const withoutBarcode = products.filter(({ barcode }) => !barcode);
  const withoutSku = products.filter(({ sku }) => !sku);
  const withoutName = products.filter(({ name }) => !name);

  console.log(JSON.stringify({
    ok: true,
    total: products.length,
    stock: {
      negative: negative.length,
      zero: zero.length,
      positive: positive.length,
      unknown: unknown.length,
      minimum: products.length - unknown.length
        ? Math.min(...products.flatMap(({ stock }) => stock === null ? [] : [stock]))
        : null,
      maximum: products.length - unknown.length
        ? Math.max(...products.flatMap(({ stock }) => stock === null ? [] : [stock]))
        : null,
    },
    withoutBarcode: withoutBarcode.length,
    withoutSku: withoutSku.length,
    withoutName: withoutName.length,
    negativeStockSample: negative.slice(0, 10).map(({ sku, name, stock }) => ({
      sku,
      name,
      stock,
    })),
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    error: error instanceof Error ? error.message : 'Unknown Moni error',
  }));
  process.exitCode = 1;
}
