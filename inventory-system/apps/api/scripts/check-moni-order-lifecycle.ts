import '../src/config/environment.js';
import { MoniConfigService } from '../src/pos/config/moni-config.service.js';
import { MoniSignatureService } from '../src/pos/adapters/moni/moni-signature.service.js';
import { MoniHttpClient } from '../src/pos/adapters/moni/moni-http-client.js';
import { MoniAuthService } from '../src/pos/adapters/moni/moni-auth.service.js';
import { MoniOrderGateway } from '../src/pos/adapters/moni/moni-order.gateway.js';

const START_DATE = '2025-01-01';
const END_DATE = new Date().toISOString().slice(0, 10);
const DETAIL_SAMPLE_LIMIT = 10;
const STATUSES = ['cancelled', 'void'] as const;

const config = new MoniConfigService();
const signature = new MoniSignatureService(config);
const http = new MoniHttpClient(config, signature);
const auth = new MoniAuthService(config, http);
const orders = new MoniOrderGateway(config, auth, http);

interface ReportData {
  report?: {
    refund_amount?: unknown;
    refund_number?: unknown;
    cancel_number?: unknown;
    cancel_total?: unknown;
  };
}

interface OnlineRefundData {
  list?: unknown;
}

try {
  const login = await auth.ensureLoggedIn();
  const results = [];
  for (const requestedStatus of STATUSES) {
    const orderList = await orders.listAll(START_DATE, END_DATE, requestedStatus);
    const sample = [];
    for (const order of orderList.slice(0, DETAIL_SAMPLE_LIMIT)) {
      const detail = await orders.getDetail(order.orderNo);
      sample.push({
        orderNo: detail.orderNo,
        listStatus: order.status,
        detailStatus: detail.status,
        date: detail.date,
        orderAmount: detail.orderAmount,
        refundAmount: detail.refundAmount,
        lineCount: detail.items.length,
        quantityTotal: detail.items.reduce((sum, item) => sum + item.quantity, 0),
        minusLineCount: detail.items.filter(({ isMinus }) => isMinus).length,
      });
    }
    results.push({ requestedStatus, total: orderList.length, detailsChecked: sample.length, sample });
  }

  const allOrders = await orders.listAll(START_DATE, END_DATE);
  const refundCandidates = allOrders.filter(({ refundAmount }) =>
    refundAmount !== null && refundAmount > 0,
  );
  const refundCandidateDetails = [];
  for (const order of refundCandidates.slice(0, DETAIL_SAMPLE_LIMIT)) {
    const detail = await orders.getDetail(order.orderNo);
    refundCandidateDetails.push({
      orderNo: order.orderNo,
      listStatus: order.status,
      listRefundAmount: order.refundAmount,
      detailStatus: detail.status,
      detailRefundAmount: detail.refundAmount,
      lineCount: detail.items.length,
      quantityTotal: detail.items.reduce((sum, item) => sum + item.quantity, 0),
      minusLineCount: detail.items.filter(({ isMinus }) => isMinus).length,
    });
  }

  const commonParameters = {
    shop_id: login.shopId,
    store_id: config.requireStoreId(),
    login_token: login.loginToken,
    start_date: START_DATE,
    end_date: END_DATE,
  };
  const report = await http.postReadOnly<ReportData>(
    'Webstorereport/getStoreReportContent',
    commonParameters,
  );
  const onlineRefunds = await http.postReadOnly<OnlineRefundData>(
    'Webstoreorder/onlineRefundPayment',
    commonParameters,
  );

  console.log(JSON.stringify({
    ok: true,
    period: { start: START_DATE, end: END_DATE },
    note: 'Read-only verification; no inventory mutation was performed',
    results,
    refundCandidates: {
      total: refundCandidates.length,
      refundAmountTotal: refundCandidates.reduce(
        (sum, order) => sum + (order.refundAmount ?? 0),
        0,
      ),
      detailsChecked: refundCandidateDetails.length,
      sample: refundCandidateDetails,
    },
    report: report.report ? {
      refundAmount: report.report.refund_amount ?? null,
      refundNumber: report.report.refund_number ?? null,
      cancelNumber: report.report.cancel_number ?? null,
      cancelTotal: report.report.cancel_total ?? null,
    } : null,
    onlineRefundCount: Array.isArray(onlineRefunds.list) ? onlineRefunds.list.length : null,
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    error: error instanceof Error ? error.message : 'Unknown Moni error',
  }));
  process.exitCode = 1;
}
