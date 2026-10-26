<script setup lang="ts">
import { computed, ref } from 'vue';
import ProductMergeSheet from '../components/ProductMergeSheet.vue';
import StockRecountSheet from '../components/StockRecountSheet.vue';
import { useManagementContext, type PurchaseSuggestion } from '../useManagementDashboard';

const {
  purchaseSuggestions, currentPurchaseOrder, purchaseLoading, purchaseView,
  thisWeekPurchaseSuggestions, followUpPurchaseSuggestions, money, number, dateTime, addToPurchaseOrder,
  ignorePurchaseSuggestion, restorePurchaseSuggestion, savePurchaseItem, removePurchaseItem, changePurchaseStatus,
  exportPurchaseOrderExcel, purchaseSourceLabel, purchaseStatusLabel, managementRequest, loadProcurement, showPurchaseMessage
} = useManagementContext();

// CR-006: fix stock or merge duplicate records right from a suggestion row, then refresh the suggestions.
const recountItem = ref<PurchaseSuggestion | null>(null);
const mergeItem = ref<PurchaseSuggestion | null>(null);
async function afterRecount(stock: { productName: string; systemQuantity: number }) {
  recountItem.value = null;
  showPurchaseMessage(`已更新库存：${stock.productName} 现有 ${stock.systemQuantity} 件`);
  await loadProcurement();
}
async function afterMerge() {
  const name = mergeItem.value?.productName ?? '';
  mergeItem.value = null;
  showPurchaseMessage(`已合并同款：${name}`);
  await loadProcurement();
}

type SuggestionFilter = 'ALL' | 'THIS_WEEK' | 'FOLLOW_UP' | 'IGNORED';
const suggestionFilter = ref<SuggestionFilter>('ALL');
const showRules = ref(false);
const suggestionTabs = computed(() => [
  { key: 'ALL' as const, label: '全部', count: purchaseSuggestions.value?.suggestions.length ?? 0 },
  { key: 'THIS_WEEK' as const, label: '本周优先', count: thisWeekPurchaseSuggestions.value.length },
  { key: 'FOLLOW_UP' as const, label: '后续跟进', count: followUpPurchaseSuggestions.value.length },
  { key: 'IGNORED' as const, label: '已忽略', count: purchaseSuggestions.value?.ignoredSuggestions.length ?? 0 },
]);
const suggestionRows = computed(() => {
  const data = purchaseSuggestions.value;
  if (!data) return [];
  if (suggestionFilter.value === 'IGNORED') return data.ignoredSuggestions;
  if (suggestionFilter.value === 'THIS_WEEK') return thisWeekPurchaseSuggestions.value;
  if (suggestionFilter.value === 'FOLLOW_UP') return followUpPurchaseSuggestions.value;
  return [...thisWeekPurchaseSuggestions.value, ...followUpPurchaseSuggestions.value];
});

// 高: out of stock or under a week left; 中: other this-week items; 低: follow-up.
function priorityOf(item: PurchaseSuggestion) {
  if (item.currentInventory <= 0 || (item.coverageWeeks !== null && item.coverageWeeks < 1)) return { label: '高', tone: 'high' };
  return item.priority === 'THIS_WEEK' ? { label: '中', tone: 'mid' } : { label: '低', tone: 'low' };
}

function coverageText(item: PurchaseSuggestion) {
  if (item.currentInventory <= 0) return '已断货';
  return item.coverageWeeks === null ? '—' : `${number(item.coverageWeeks)} 周`;
}

// Same-name records summed into this row, listed with barcode, stock and 28-day sales.
function mergedTitle(item: PurchaseSuggestion) {
  return (item.mergedProducts ?? []).map((member) => `${member.productName}（${member.barcode ?? '无条码'}）库存 ${member.currentInventory} · 28天 ${member.recent28DayQty}`).join('\n');
}

// CR-005: explain suggestions that would otherwise look surprising.
function suggestionNote(item: PurchaseSuggestion) {
  if (item.displayStock) return `慢销，保持陈列 ${number(item.targetInventory)} 件`;
  if (item.salesBasis === '90_DAYS') return '断货中，按近 90 天销量估算';
  if (item.recentReceivedQty) return `近 7 天已入库 ${number(item.recentReceivedQty)} 件，仍不足`;
  return '';
}
</script>

<template>
  <section class="procurement-page">
    <div class="procurement-tabs" role="tablist" aria-label="进货管理视图"><button type="button" :class="{ active: purchaseView === 'suggestions' }" @click="purchaseView = 'suggestions'">进货建议 <b>{{ purchaseSuggestions?.summary.products ?? 0 }}</b></button><button type="button" :class="{ active: purchaseView === 'order' }" @click="purchaseView = 'order'">本周进货单 <b>{{ currentPurchaseOrder?.order?.summary.productCount ?? 0 }}</b></button></div>

    <template v-if="purchaseView === 'suggestions'">
      <section class="system-card buy-panel" v-if="purchaseSuggestions">
        <header class="buy-panel-head">
          <div><h3>进货建议</h3><p>按近 28 天销量备 4–6 周货 · 库存读取 {{ dateTime(purchaseSuggestions.generatedAt) }}</p></div>
          <div class="buy-panel-links"><button class="buy-link" type="button" @click="showRules = !showRules">{{ showRules ? '收起规则' : '规则说明' }}</button><button class="buy-link" type="button" @click="purchaseView = 'order'">本周进货单 →</button></div>
        </header>
        <div v-if="showRules" class="buy-rules"><p>{{ purchaseSuggestions.calculation }}</p><p>加入进货单不会改变库存；到货后在扫码入库中填写批次和到期日期，库存才会增加。</p></div>
        <nav class="buy-tabs" aria-label="进货建议筛选">
          <button v-for="tab in suggestionTabs" :key="tab.key" type="button" :class="{ active: suggestionFilter === tab.key }" @click="suggestionFilter = tab.key">{{ tab.label }}（{{ tab.count }}）</button>
        </nav>
        <div class="buy-table-wrap">
          <table class="buy-table">
            <thead><tr><th>商品</th><th>当前库存</th><th>周销量</th><th>可卖</th><th>建议进货</th><th>优先级</th><th>操作</th></tr></thead>
            <tbody>
              <tr v-for="item in suggestionRows" :key="item.productId">
                <td class="buy-product"><strong>{{ item.productName }}</strong><small>{{ item.brandName }}<template v-if="suggestionNote(item)"> · <em>{{ suggestionNote(item) }}</em></template><template v-if="item.ignoredReason"> · 忽略原因：{{ item.ignoredReason }}</template></small><small v-if="item.mergedProducts?.length" class="buy-merged" :title="mergedTitle(item)">已合并 {{ item.mergedProducts.length }} 个同名档案（库存 {{ item.mergedProducts.map((member) => member.currentInventory).join(' + ') }}）</small></td>
                <td class="buy-num" data-k="库存" :class="{ out: item.currentInventory <= 0 }">{{ number(item.currentInventory) }}</td>
                <td class="buy-num" data-k="周销">{{ number(item.weeklyVelocity) }}</td>
                <td class="buy-num" data-k="可卖">{{ coverageText(item) }}</td>
                <td class="buy-num buy-qty" data-k="建议">{{ number(item.suggestedQuantity) }}</td>
                <td class="buy-level"><span :class="['buy-pill', priorityOf(item).tone]">{{ priorityOf(item).label }}</span></td>
                <td class="buy-actions">
                  <template v-if="suggestionFilter === 'IGNORED'"><button class="buy-btn" type="button" :disabled="purchaseLoading" @click="restorePurchaseSuggestion(item)">恢复</button></template>
                  <template v-else><button class="buy-btn" type="button" :disabled="purchaseLoading || item.alreadyIncluded" @click="addToPurchaseOrder(item.productId, item.source, item.suggestedQuantity)">{{ item.alreadyIncluded ? '已加入' : '加入进货单' }}</button><button class="buy-link" type="button" :disabled="purchaseLoading" @click="ignorePurchaseSuggestion(item)">忽略</button></template>
                  <span class="buy-more"><button class="buy-link" type="button" @click="recountItem = item">调库存</button><button class="buy-link" type="button" @click="mergeItem = item">合并同款</button></span>
                </td>
              </tr>
            </tbody>
          </table>
          <p v-if="!suggestionRows.length" class="system-empty">{{ suggestionFilter === 'IGNORED' ? '当前没有已忽略的建议。' : '当前没有需要补货的商品。' }}</p>
        </div>
      </section>
      <StockRecountSheet v-if="recountItem" :product-id="recountItem.productId" :request="managementRequest" @close="recountItem = null" @saved="afterRecount" />
      <ProductMergeSheet v-if="mergeItem" :product-id="mergeItem.productId" :product-name="mergeItem.productName" :current-inventory="mergeItem.currentInventory" :request="managementRequest" @close="mergeItem = null" @merged="afterMerge" />
    </template>

    <template v-else>
      <section v-if="currentPurchaseOrder?.order" class="procurement-summary"><article><span>进货单状态</span><strong>{{ purchaseStatusLabel(currentPurchaseOrder.order.status) }}</strong><small>{{ currentPurchaseOrder.order.orderNo }}</small></article><article><span>商品与件数</span><strong>{{ currentPurchaseOrder.order.summary.productCount }} 种 · {{ number(currentPurchaseOrder.order.summary.orderedUnits) }} 件</strong><small>系统建议 {{ number(currentPurchaseOrder.order.summary.suggestedUnits) }} 件</small></article><article><span>预计金额</span><strong>{{ money(currentPurchaseOrder.order.summary.totalCostCents / 100) }}</strong><small>仅统计已填写进价</small></article></section>
      <section v-if="currentPurchaseOrder?.order" class="system-card purchase-order-card"><div class="card-title"><div><h3>本周进货单</h3><p>周起始 {{ currentPurchaseOrder.order.weekStart }} · {{ currentPurchaseOrder.order.orderNo }}</p><small v-if="currentPurchaseOrder.generatedAt" class="inventory-source-time">实时库存读取：{{ dateTime(currentPurchaseOrder.generatedAt) }} · 最近库存变更：{{ dateTime(currentPurchaseOrder.inventoryLatestUpdatedAt ?? null) }}</small></div><div class="purchase-order-actions"><button class="secondary" type="button" :disabled="!currentPurchaseOrder.order.items.length" @click="exportPurchaseOrderExcel">导出 Excel</button><button v-if="currentPurchaseOrder.order.status === 'DRAFT'" type="button" :disabled="purchaseLoading || !currentPurchaseOrder.order.items.length" @click="changePurchaseStatus('CONFIRMED')">确认进货单</button><button v-if="currentPurchaseOrder.order.status === 'CONFIRMED'" class="secondary" type="button" :disabled="purchaseLoading" @click="changePurchaseStatus('DRAFT')">退回草稿</button><button v-if="currentPurchaseOrder.order.status === 'CANCELLED'" class="secondary" type="button" :disabled="purchaseLoading" @click="changePurchaseStatus('DRAFT')">恢复为草稿</button><button v-if="currentPurchaseOrder.order.status === 'CONFIRMED'" type="button" :disabled="purchaseLoading" @click="changePurchaseStatus('ORDERED')">标记已订货</button><button v-if="['DRAFT','CONFIRMED','ORDERED'].includes(currentPurchaseOrder.order.status)" class="danger" type="button" :disabled="purchaseLoading" @click="changePurchaseStatus('CANCELLED')">取消进货单</button></div></div>
        <div class="purchase-order-table-wrap"><table class="purchase-order-table"><thead><tr><th>商品</th><th>数量与供应商</th><th>进价与整箱</th><th>备注与操作</th></tr></thead><tbody><tr v-for="item in currentPurchaseOrder.order.items" :key="item.id"><td data-k="商品"><strong>{{ item.productName }}</strong><small>{{ item.barcode || item.sku }} · {{ purchaseSourceLabel(item.source) }}</small><em>实时库存 {{ item.currentInventory }} · 近7天 {{ item.recentSevenDayQty }} · 建议 {{ item.suggestedQuantity }}</em></td><td data-k="数量与供应商"><label>进货数量<input v-model.number="item.orderedQuantity" type="number" min="1" inputmode="numeric" :disabled="currentPurchaseOrder.order.status !== 'DRAFT'" /></label><label>供应商<input v-model="item.supplierName" type="text" maxlength="120" placeholder="可稍后填写" :disabled="currentPurchaseOrder.order.status !== 'DRAFT'" /></label></td><td data-k="进价与整箱"><label>单件进价（分）<input v-model.number="item.unitCostCents" type="number" min="0" inputmode="numeric" placeholder="可选" :disabled="currentPurchaseOrder.order.status !== 'DRAFT'" /></label><label>整箱规格<input v-model.number="item.caseSize" type="number" min="1" inputmode="numeric" placeholder="可选" :disabled="currentPurchaseOrder.order.status !== 'DRAFT'" /></label></td><td data-k="备注与操作"><label>备注<input v-model="item.notes" type="text" maxlength="255" placeholder="采购或到货说明" :disabled="currentPurchaseOrder.order.status !== 'DRAFT'" /></label><div v-if="currentPurchaseOrder.order.status === 'DRAFT'" class="purchase-row-actions"><button type="button" :disabled="purchaseLoading" @click="savePurchaseItem(item)">保存</button><button class="danger" type="button" :disabled="purchaseLoading" @click="removePurchaseItem(item)">移除</button></div></td></tr></tbody></table></div>
      </section>
      <section v-else class="system-card procurement-empty"><h3>本周还没有进货单</h3><p>先从进货建议、缺货列表或热销商品中加入商品。</p><button type="button" @click="purchaseView = 'suggestions'">查看进货建议</button></section>
    </template>
  </section>
</template>

<style scoped>
/* Shares the ManagementDashboard style scope (see vite.config.ts); page-specific styles go here. */
:root .management-workspace .buy-panel{--buy-ink:#e8eef8;--buy-muted:#93a1b5;--buy-line:#243349;--buy-head:#131f31;--buy-row:#0f1a2a;--buy-accent:#3cc4cc;--buy-accent-ink:#06262a;
  --buy-high:#ff8a8a;--buy-high-bg:rgb(255 107 107 / 14%);--buy-mid:#f3b25b;--buy-mid-bg:rgb(243 178 91 / 14%);--buy-low:#5fd3a0;--buy-low-bg:rgb(95 211 160 / 14%);
  display:grid;gap:14px;padding:18px 20px}
:root:not([data-theme="dark"]) .management-workspace .buy-panel{--buy-ink:#24314d;--buy-muted:#7a869a;--buy-line:#e7ecf3;--buy-head:#f5f7fa;--buy-row:#fff;--buy-accent:#2a9aa5;--buy-accent-ink:#fff;
  --buy-high:#d64545;--buy-high-bg:#fdecec;--buy-mid:#c47a12;--buy-mid-bg:#fff4e2;--buy-low:#1f9d6b;--buy-low-bg:#e6f6ef}
:root .management-workspace .buy-panel-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
:root .management-workspace .buy-panel-head h3{margin:0;padding-left:10px;border-left:3px solid var(--buy-accent);color:var(--buy-ink);font-size:17px;line-height:1.2}
:root .management-workspace .buy-panel-head p{margin:6px 0 0;color:var(--buy-muted);font-size:13px}
:root .management-workspace .buy-panel-links{display:flex;gap:14px;white-space:nowrap}
:root .management-workspace .buy-link{min-height:auto;padding:4px 2px;border:0;background:none;box-shadow:none;color:var(--buy-muted);font-size:13px;font-weight:500;cursor:pointer}
:root .management-workspace .buy-link:hover:not(:disabled){color:var(--buy-accent)}
:root .management-workspace .buy-rules{display:grid;gap:4px;padding:10px 12px;border-radius:10px;background:var(--buy-head)}
:root .management-workspace .buy-rules p{margin:0;color:var(--buy-muted);font-size:12.5px;line-height:1.6}
:root .management-workspace .buy-tabs{display:flex;flex-wrap:wrap;gap:8px}
:root .management-workspace .buy-tabs button{min-height:34px;padding:0 16px;border:0;border-radius:8px;background:var(--buy-head);box-shadow:none;color:var(--buy-muted);font-size:13.5px;font-weight:600;cursor:pointer}
:root .management-workspace .buy-tabs button.active{background:var(--buy-accent);color:var(--buy-accent-ink)}
:root .management-workspace .buy-table-wrap{max-height:min(640px,66dvh);overflow:auto;border:1px solid var(--buy-line);border-radius:10px}
:root .management-workspace .buy-table{width:100%;border-collapse:collapse;font-size:13.5px}
:root .management-workspace .buy-table th{border:0;position:sticky;top:0;z-index:1;padding:11px 12px;background:var(--buy-head);color:var(--buy-muted);font-size:12.5px;font-weight:600;text-align:left;white-space:nowrap}
:root .management-workspace .buy-table td{padding:11px 12px;border-top:1px solid var(--buy-line);background:var(--buy-row);color:var(--buy-ink);vertical-align:middle}
:root .management-workspace .buy-table tbody tr:hover td{background:var(--buy-head)}
:root .management-workspace .buy-product{min-width:220px}
:root .management-workspace .buy-product strong{display:block;color:var(--buy-ink);font-size:13.5px;font-weight:600;line-height:1.4}
:root .management-workspace .buy-product small{display:block;margin-top:2px;color:var(--buy-muted);font-size:12px}
:root .management-workspace .buy-product em{color:var(--buy-mid);font-style:normal}
:root .management-workspace .buy-product .buy-merged{color:var(--buy-accent)}
:root .management-workspace .buy-num{font-variant-numeric:tabular-nums;white-space:nowrap}
:root .management-workspace .buy-num.out{color:var(--buy-high);font-weight:600}
:root .management-workspace .buy-qty{color:var(--buy-accent);font-size:15px;font-weight:700}
:root .management-workspace .buy-pill{display:inline-block;min-width:34px;padding:3px 10px;border-radius:6px;font-size:12px;font-weight:600;text-align:center}
:root .management-workspace .buy-pill.high{background:var(--buy-high-bg);color:var(--buy-high)}
:root .management-workspace .buy-pill.mid{background:var(--buy-mid-bg);color:var(--buy-mid)}
:root .management-workspace .buy-pill.low{background:var(--buy-low-bg);color:var(--buy-low)}
:root .management-workspace .buy-actions{white-space:nowrap}
:root .management-workspace .buy-more{display:flex;gap:10px;margin-top:4px}
:root .management-workspace .buy-more .buy-link{font-size:12px}
:root .management-workspace .buy-btn{min-height:30px;margin-right:6px;padding:0 12px;border:1px solid var(--buy-accent);border-radius:7px;background:transparent;box-shadow:none;color:var(--buy-accent);font-size:12.5px;font-weight:600;cursor:pointer}
:root .management-workspace .buy-btn:hover:not(:disabled){background:var(--buy-accent);color:var(--buy-accent-ink)}
:root .management-workspace .buy-btn:disabled{border-color:var(--buy-line);color:var(--buy-muted);cursor:default}
@media(max-width:720px){
  :root .management-workspace .buy-panel{padding:14px}
  :root .management-workspace .buy-panel-head{flex-direction:column}
  :root .management-workspace .buy-table-wrap{max-height:none;overflow:visible;border:0}
  :root .management-workspace .buy-table thead{display:none}
  :root .management-workspace .buy-table,:root .management-workspace .buy-table tbody{display:block}
  :root .management-workspace .buy-table tr{margin:0;border:0;border-radius:0;background:none;display:grid;grid-template-columns:repeat(4,auto) 1fr;align-items:center;gap:4px 10px;padding:12px 2px;border-top:1px solid var(--buy-line)}
  :root .management-workspace .buy-table td{padding:0;border:0;background:none;font-size:13px;line-height:18px}
  :root .management-workspace .buy-table td::before{display:none}
  :root .management-workspace .buy-table td:last-child{padding-top:0;border-top:0}
  :root .management-workspace .buy-table tbody tr:hover td{background:none}
  :root .management-workspace .buy-product{grid-column:1/-2;grid-row:1;min-width:0}
  :root .management-workspace .buy-level{grid-column:-2/-1;grid-row:1;justify-self:end}
  :root .management-workspace .buy-num{font-size:12.5px;color:var(--buy-muted)}
  :root .management-workspace .buy-table td.buy-num::before{display:inline;margin:0;content:attr(data-k) ' ';color:var(--buy-muted);font-size:12.5px}
  :root .management-workspace .buy-qty{color:var(--buy-accent);font-size:13px}
  :root .management-workspace .buy-actions{grid-column:1/-1;display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:4px}
  :root .management-workspace .buy-more{margin-top:0}
  :root .management-workspace .buy-btn{min-height:40px;flex:1;margin:0}
  :root .management-workspace .buy-link{min-height:40px;padding:0 12px}
}
</style>
