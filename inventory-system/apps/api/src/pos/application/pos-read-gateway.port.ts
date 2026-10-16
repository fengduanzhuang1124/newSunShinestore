import type {
  PosPage,
  PosPageRequest,
  PosProductSnapshot,
  PosRefundSnapshot,
  PosSaleSnapshot,
} from '../domain/pos.types.js';

/**
 * Read-only boundary for a POS provider.
 *
 * No mutation method belongs in this interface. POS writes must remain in a
 * separately reviewed port and must not be added until read-only reconciliation
 * has passed its acceptance criteria.
 */
export interface PosReadGateway {
  listProducts(request: PosPageRequest): Promise<PosPage<PosProductSnapshot>>;
  listSales(request: PosPageRequest): Promise<PosPage<PosSaleSnapshot>>;
  listRefunds(request: PosPageRequest): Promise<PosPage<PosRefundSnapshot>>;
}

export const POS_READ_GATEWAY = Symbol('POS_READ_GATEWAY');
