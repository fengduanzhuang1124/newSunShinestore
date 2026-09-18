import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { MoniSignatureService } from './adapters/moni/moni-signature.service.js';
import { MoniConfigService } from './config/moni-config.service.js';
import { MoniHttpClient } from './adapters/moni/moni-http-client.js';
import { MoniStoreGateway } from './adapters/moni/moni-store.gateway.js';
import { MoniAuthService } from './adapters/moni/moni-auth.service.js';
import { MoniBrandGateway } from './adapters/moni/moni-brand.gateway.js';
import { MoniCategoryGateway } from './adapters/moni/moni-category.gateway.js';
import { MoniProductGateway } from './adapters/moni/moni-product.gateway.js';
import { MoniPriceLevelGateway } from './adapters/moni/moni-price-level.gateway.js';
import { MoniOrderGateway } from './adapters/moni/moni-order.gateway.js';
import { PosObservationService } from './application/pos-observation.service.js';
import { PosInventorySimulationService } from './application/pos-inventory-simulation.service.js';
import { PosQueryService } from './application/pos-query.service.js';
import { PosMilkCatalogService } from './application/pos-milk-catalog.service.js';
import { PosProductCatalogService } from './application/pos-product-catalog.service.js';
import { PosController } from './pos.controller.js';

/**
 * POS integration composition root.
 *
 * A vendor gateway is intentionally not registered yet: the approved endpoint,
 * signing specification, and response fixtures must be supplied first. This
 * prevents accidental network calls or an invented signature implementation.
 */
@Module({
  imports: [AuthModule],
  controllers: [PosController],
  providers: [
    MoniConfigService,
    MoniSignatureService,
    MoniHttpClient,
    MoniAuthService,
    MoniBrandGateway,
    MoniCategoryGateway,
    MoniProductGateway,
    MoniPriceLevelGateway,
    MoniOrderGateway,
    PosObservationService,
    PosInventorySimulationService,
    PosQueryService,
    PosMilkCatalogService,
    PosProductCatalogService,
    MoniStoreGateway,
  ],
  exports: [
    MoniConfigService,
    MoniSignatureService,
    MoniAuthService,
    MoniBrandGateway,
    MoniCategoryGateway,
    MoniProductGateway,
    MoniOrderGateway,
    PosObservationService,
    PosInventorySimulationService,
    PosQueryService,
    PosMilkCatalogService,
    PosProductCatalogService,
    MoniStoreGateway,
  ],
})
export class PosModule {}
