import { Injectable } from '@nestjs/common';
import { MoniConfigService } from '../../config/moni-config.service.js';
import { MoniAuthService } from './moni-auth.service.js';
import { MoniApiError, MoniHttpClient } from './moni-http-client.js';

const MAX_ORDER_PAGES = 1_000;

interface MoniOrderRecord {
  order_no?: unknown;
  date?: unknown;
  status?: unknown;
  refund_amount?: unknown;
}

interface MoniOrderListData {
  total?: unknown;
  page_total?: unknown;
  list?: unknown;
}

interface MoniOrderItemRecord {
  food_id?: unknown;
  food_name?: unknown;
  count?: unknown;
  food_price?: unknown;
  is_minus?: unknown;
}

interface MoniOrderDetailData {
  order_no?: unknown;
  status?: unknown;
  date?: unknown;
  items?: unknown;
  refund_money?: unknown;
  order_amount?: unknown;
}

export interface MoniOrderSummary {
  orderNo: string;
  date: string | null;
  status: string | null;
  refundAmount: number | null;
}

export interface MoniOrderItem {
  externalProductId: string;
  name: string | null;
  quantity: number;
  price: number | null;
  isMinus: boolean;
}

export interface MoniOrderDetail extends MoniOrderSummary {
  items: readonly MoniOrderItem[];
  refundAmount: number | null;
  orderAmount: number | null;
}

export interface MoniOrderPage {
  orders: readonly MoniOrderSummary[];
  total: number;
  pageTotal: number;
  pageNum: number;
}

function optionalString(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function requiredCount(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) throw new MoniApiError('Moni order item count is invalid');
  return parsed;
}

function optionalNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function nonNegativeInteger(value: unknown, field: string): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new MoniApiError(`Moni ${field} must be a non-negative integer`);
  }
  return parsed;
}

@Injectable()
export class MoniOrderGateway {
  constructor(
    private readonly config: MoniConfigService,
    private readonly auth: MoniAuthService,
    private readonly http: MoniHttpClient,
  ) {}

  async listPage(
    startDate: string,
    endDate: string,
    pageNum = 1,
    orderStatus?: string,
  ): Promise<MoniOrderPage> {
    if (!Number.isSafeInteger(pageNum) || pageNum < 1) {
      throw new RangeError('Moni order page number must be a positive integer');
    }
    const login = await this.auth.ensureLoggedIn();
    const data = await this.http.postReadOnly<MoniOrderListData>(
      'Webstoreorder/getStoreOrders',
      {
        shop_id: login.shopId,
        store_id: this.config.requireStoreId(),
        login_token: login.loginToken,
        start_date: startDate,
        end_date: endDate,
        ...(orderStatus ? { order_status: orderStatus } : {}),
        page_num: pageNum,
        page_size: 100,
      },
    );
    if (!Array.isArray(data.list)) throw new MoniApiError('Moni order list must be an array');

    const orders = data.list.map((raw) => {
      if (!raw || typeof raw !== 'object') throw new MoniApiError('Moni order record is invalid');
      const record = raw as MoniOrderRecord;
      const orderNo = optionalString(record.order_no);
      if (!orderNo) throw new MoniApiError('Moni order number is missing');
      return {
        orderNo,
        date: optionalString(record.date),
        status: optionalString(record.status),
        refundAmount: optionalNumber(record.refund_amount),
      };
    });

    return {
      orders,
      total: nonNegativeInteger(data.total, 'order total'),
      pageTotal: nonNegativeInteger(data.page_total, 'order page total'),
      pageNum,
    };
  }

  async listAll(
    startDate: string,
    endDate: string,
    orderStatus?: string,
  ): Promise<readonly MoniOrderSummary[]> {
    const firstPage = await this.listPage(startDate, endDate, 1, orderStatus);
    if (firstPage.pageTotal > MAX_ORDER_PAGES) {
      throw new MoniApiError('Moni order pagination exceeds the safety limit');
    }

    const byOrderNo = new Map(
      firstPage.orders.map((order) => [order.orderNo, order]),
    );
    for (let pageNum = 2; pageNum <= firstPage.pageTotal; pageNum += 1) {
      const page = await this.listPage(startDate, endDate, pageNum, orderStatus);
      for (const order of page.orders) byOrderNo.set(order.orderNo, order);
    }
    return [...byOrderNo.values()];
  }

  async listPaidPage(startDate: string, endDate: string): Promise<readonly MoniOrderSummary[]> {
    return (await this.listPage(startDate, endDate, 1, 'paid')).orders;
  }

  async getDetail(orderNo: string): Promise<MoniOrderDetail> {
    const login = await this.auth.ensureLoggedIn();
    const data = await this.http.postReadOnly<MoniOrderDetailData>(
      'Webstoreorder/getOrderDetail',
      {
        shop_id: login.shopId,
        store_id: this.config.requireStoreId(),
        login_token: login.loginToken,
        order_no: orderNo,
      },
    );
    if (!Array.isArray(data.items)) throw new MoniApiError('Moni order items must be an array');

    const items = data.items.map((raw) => {
      if (!raw || typeof raw !== 'object') throw new MoniApiError('Moni order item is invalid');
      const record = raw as MoniOrderItemRecord;
      const externalProductId = optionalString(record.food_id);
      if (!externalProductId) throw new MoniApiError('Moni order product ID is missing');
      return {
        externalProductId,
        name: optionalString(record.food_name),
        quantity: requiredCount(record.count),
        price: optionalNumber(record.food_price),
        isMinus: String(record.is_minus) === '1',
      };
    });

    return {
      orderNo: optionalString(data.order_no) ?? orderNo,
      date: optionalString(data.date),
      status: optionalString(data.status),
      refundAmount: optionalNumber(data.refund_money),
      items,
      orderAmount: optionalNumber(data.order_amount),
    };
  }
}
