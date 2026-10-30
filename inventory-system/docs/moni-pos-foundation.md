# Moni POS Integration Foundation

## Current status

The first POS integration increment provides:

- Validated environment configuration;
- HTTPS-only API base URL handling;
- Redacted configuration serialization;
- Moni fixed-parameter signature generation;
- Read-only gateway contracts;
- Pagination and synchronization-window validation;
- Unit tests using synthetic credentials only.

No POS network request or mutation endpoint is implemented in this increment.

## Runtime configuration

Configure the following variables in the local `.env` or the deployment secret manager:

```env
MONI_API_BASE_URL=https://api.yugu.co.nz
MONI_REQUEST_DEVICE=
MONI_API_KEY=
MONI_TIMEOUT_MS=10000
```

Never commit real values. The config service rejects missing credentials, non-HTTPS URLs, URL-embedded credentials, and timeouts outside 1–60 seconds.

## Signature behavior

The signer follows the approved vendor reference:

1. Build the fixed `lang_id`, `request_device`, and 10-digit `timestamp` parameters;
2. Sort names in ascending ASCII order;
3. Concatenate as `name=value&`, retaining the final `&`;
4. Calculate `MD5(apiKey + timestamp)`;
5. Append the intermediate digest to the canonical parameter string;
6. Calculate the final MD5 and send it as `signYugu`.

The canonical string, API key, request device, intermediate digest, and signature must not be logged.

## Verification

Run:

```bash
corepack pnpm --filter @sunshine/inventory-api test -- --runTestsByPath \
  src/pos/config/moni-config.service.spec.ts \
  src/pos/adapters/moni/moni-signature.service.spec.ts \
  src/pos/application/pos-page-request.spec.ts
corepack pnpm --filter @sunshine/inventory-api typecheck
corepack pnpm --filter @sunshine/inventory-api build
```

## Next increment

Implement an HTTP client with an explicit allowlist of read-only endpoints. Begin with a non-mutating connectivity probe, then brands, categories, stores, products, payment methods, transaction records, and transaction details. Store only synthetic or fully anonymized fixtures in Git.
