# Management decision-support organization

Date: 2026-10-06

## Scope

- Keep management as a real-data decision-support workspace. No product creation, price editing or barcode maintenance is added.
- Rename product analysis, classification/tags and data center navigation; group desktop navigation and retain four primary mobile destinations plus More.
- Compact overview into KPIs, actionable links, trends and top products. Move detailed data completeness checks to Data Center.
- Clarify sales comparison periods, chart values, data availability and brand contribution methods; fold secondary explanations.
- Separate read-only product, brand and category views. Distinguish period sales from current inventory.
- Reuse inventory table filters for shortage and slow-stock exploration instead of repeating lists. Separate server query scope from local result filtering.
- Separate product tagging from tag dictionary maintenance; disclose the existing 200-product result limit and count limitations.
- Hide meaningless single-store rankings while preserving multi-store comparisons.
- Organize Data Center into POS sync, data checks and exceptions. Preserve explicit manual sync and existing permission guards; distinguish unavailable status from zero.
- Reuse existing report navigation from overview via the existing App openReport handler.

## Protection of business behavior

No database schema, API contract, inventory calculations, product/order business rules, POS sync payloads or reconciliation rules changed. Existing endpoints and true data sources remain in use. Test fixtures exist only in unit tests. No automatic sync implementation or new component-library dependency is included.

Existing native/Vue controls are reused; shadcn composition conventions inform layout but official shadcn components were not installed. Scoped decision-workspace styles preserve the established dark theme and inventory master styling.

## Verification

- Frontend tests: 3 files, 31 tests passed.
- Frontend build: vue-tsc -b and Vite build passed.
- No frontend lint script is configured.
- Git diff whitespace check passed.
- Browser visual verification was not performed; desktop/mobile appearance still needs visual acceptance.

## Deferred business/data limitations

The existing tagging result cap/count semantics, brand inference versus official master fields, missing sales history and first-20 exception listing are disclosed, not changed. Missing dates are not fabricated as zero. Order-level and line-level amount differences are explained without changing calculations.
