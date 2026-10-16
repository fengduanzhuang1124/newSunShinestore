export type PosExternalId = string;

export interface PosStoreReference {
  shopId: PosExternalId;
  storeId: PosExternalId;
}

export interface PosProductSnapshot {
  externalItemId: PosExternalId;
  code?: string;
  sku?: string;
  barcode?: string;
  name: string;
  raw: Readonly<Record<string, unknown>>;
}

export interface PosSaleLineSnapshot {
  externalLineId: PosExternalId;
  externalItemId: PosExternalId;
  quantity: number;
  raw: Readonly<Record<string, unknown>>;
}

export interface PosSaleSnapshot {
  externalTransactionId: PosExternalId;
  store: PosStoreReference;
  occurredAt: Date;
  lines: readonly PosSaleLineSnapshot[];
  raw: Readonly<Record<string, unknown>>;
}

export interface PosRefundLineSnapshot {
  externalRefundLineId: PosExternalId;
  originalSaleLineId?: PosExternalId;
  externalItemId: PosExternalId;
  quantity: number;
  raw: Readonly<Record<string, unknown>>;
}

export interface PosRefundSnapshot {
  externalRefundId: PosExternalId;
  originalTransactionId?: PosExternalId;
  store: PosStoreReference;
  occurredAt: Date;
  lines: readonly PosRefundLineSnapshot[];
  raw: Readonly<Record<string, unknown>>;
}

export interface PosPageRequest {
  cursor?: string;
  from?: Date;
  to?: Date;
  limit: number;
}

export interface PosPage<T> {
  items: readonly T[];
  nextCursor?: string;
}
