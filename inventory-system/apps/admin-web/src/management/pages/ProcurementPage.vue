<script setup lang="ts">
import { computed } from 'vue';
import { useManagementContext, type PurchaseSuggestion } from '../useManagementDashboard';

const {
  purchaseSuggestions, currentPurchaseOrder, purchaseLoading, purchaseView, showIgnoredSuggestions,
  thisWeekPurchaseSuggestions, followUpPurchaseSuggestions, money, number, dateTime, addToPurchaseOrder,
  ignorePurchaseSuggestion, restorePurchaseSuggestion, savePurchaseItem, removePurchaseItem, changePurchaseStatus,
  exportPurchaseOrderExcel, purchaseSourceLabel, purchaseStatusLabel
} = useManagementContext();

const suggestionGroups = computed(() => [
  { key: 'this-week', title: '本周优先', hint: '库存风险较高，建议先处理', items: thisWeekPurchaseSuggestions.value },
  { key: 'follow-up', title: '后续跟进', hint: '备货周期候选，可按预算分批处理', items: followUpPurchaseSuggestions.value },
].filter((group) => group.items.length));

function coverageText(item: PurchaseSuggestion) {
  if (item.currentInventory <= 0) return '已断货';
  return item.coverageWeeks === null ? '可卖 —' : `可卖 ${number(item.coverageWeeks)} 周`;
}

// CR-005: explain suggestions that would otherwise look surprising.
function suggestionNotes(item: PurchaseSuggestion) {
  const notes: string[] = [];
  if (item.salesBasis === '90_DAYS') notes.push('断货中，按近 90 天销量估算');
  if (item.recentReceivedQty) notes.push(`近 7 天已入库 ${number(item.recentReceivedQty)} 件，仍不足`);
  return notes;
}
</script>

<template>
  <section class="procurement-page">
    <div class="procurement-tabs" role="tablist" aria-label="进货管理视图"><button type="button" :class="{ active: purchaseView === 'suggestions' }" @click="purchaseView = 'suggestions'">进货建议 <b>{{ purchaseSuggestions?.summary.products ?? 0 }}</b></button><button type="button" :class="{ active: purchaseView === 'order' }" @click="purchaseView = 'order'">本周进货单 <b>{{ currentPurchaseOrder?.order?.summary.productCount ?? 0 }}</b></button></div>
    <p class="management-alert pending"><strong>库存安全</strong><span>加入或确认进货单不会改变库存。商品到货后仍需进入扫码入库，填写批次和到期日期，库存才会正式增加。</span></p>

    <template v-if="purchaseView === 'suggestions'">
      <section class="procurement-summary" v-if="purchaseSuggestions"><article><span>全部备货候选</span><strong>{{ purchaseSuggestions.summary.products }} 种</strong><small>4–6 周覆盖，不是一周必须买完</small></article><article><span>本周优先</span><strong>{{ purchaseSuggestions.summary.thisWeekProducts }} 种</strong><small>缺货、不足1周或低于阈值</small></article><article><span>后续跟进</span><strong>{{ purchaseSuggestions.summary.followUpProducts }} 种</strong><small>可分批加入进货单</small></article><article><span>已忽略</span><strong>{{ purchaseSuggestions.summary.ignored }} 种</strong><small>可随时恢复</small></article></section>
      <section class="system-card procurement-table-card" v-if="purchaseSuggestions">
        <div class="card-title"><div><h3>库存覆盖进货建议</h3><p>{{ purchaseSuggestions.calculation }}</p><small class="inventory-source-time">本页库存读取：{{ dateTime(purchaseSuggestions.generatedAt) }} · 最近库存变更：{{ dateTime(purchaseSuggestions.inventoryLatestUpdatedAt) }}</small></div><div class="purchase-suggestion-actions"><button class="text-action" type="button" @click="showIgnoredSuggestions = !showIgnoredSuggestions">{{ showIgnoredSuggestions ? '查看当前建议' : `查看已忽略 (${purchaseSuggestions.summary.ignored})` }}</button><button class="text-action" type="button" @click="purchaseView = 'order'">查看本周进货单 →</button></div></div>
        <div class="purchase-suggestion-scroll">
          <template v-if="!showIgnoredSuggestions">
            <section v-for="group in suggestionGroups" :key="group.key" class="suggestion-priority-group" :class="{ 'follow-up': group.key === 'follow-up' }"><header><span><b>{{ group.title }}</b><small>{{ group.hint }}</small></span><em>{{ group.items.length }} 种</em></header>
              <div class="buy-card-grid"><article v-for="item in group.items" :key="item.productId" class="buy-card">
                <div class="buy-card-main"><strong>{{ item.productName }}</strong><small>{{ item.brandName }}</small><p>库存 <b :class="{ out: item.currentInventory <= 0 }">{{ number(item.currentInventory) }}</b> · 周销 {{ number(item.weeklyVelocity) }} · {{ coverageText(item) }}</p><p v-for="note in suggestionNotes(item)" :key="note" class="buy-card-note">{{ note }}</p></div>
                <div class="buy-card-side"><span>建议</span><strong>{{ number(item.suggestedQuantity) }}</strong><button class="buy-card-add" type="button" :disabled="purchaseLoading || item.alreadyIncluded" @click="addToPurchaseOrder(item.productId, item.source, item.suggestedQuantity)">{{ item.alreadyIncluded ? '已加入' : '加入' }}</button><button class="buy-card-ignore" type="button" :disabled="purchaseLoading" @click="ignorePurchaseSuggestion(item)">忽略</button></div>
              </article></div>
            </section>
          </template>
          <div v-else class="buy-card-grid"><article v-for="item in purchaseSuggestions.ignoredSuggestions" :key="item.productId" class="buy-card">
            <div class="buy-card-main"><strong>{{ item.productName }}</strong><small>{{ item.brandName }}</small><p>库存 <b :class="{ out: item.currentInventory <= 0 }">{{ number(item.currentInventory) }}</b> · 周销 {{ number(item.weeklyVelocity) }}</p><p v-if="item.ignoredReason" class="buy-card-note">忽略原因：{{ item.ignoredReason }}</p></div>
            <div class="buy-card-side"><span>建议</span><strong>{{ number(item.suggestedQuantity) }}</strong><button class="buy-card-add" type="button" :disabled="purchaseLoading" @click="restorePurchaseSuggestion(item)">恢复</button></div>
          </article></div>
          <p v-if="!(showIgnoredSuggestions ? purchaseSuggestions.ignoredSuggestions : purchaseSuggestions.suggestions).length" class="system-empty">{{ showIgnoredSuggestions ? '当前没有已忽略的建议。' : '当前没有需要补货的商品。' }}</p>
        </div>
      </section>
    </template>

    <template v-else>
      <section v-if="currentPurchaseOrder?.order" class="procurement-summary"><article><span>进货单状态</span><strong>{{ purchaseStatusLabel(currentPurchaseOrder.order.status) }}</strong><small>{{ currentPurchaseOrder.order.orderNo }}</small></article><article><span>商品与件数</span><strong>{{ currentPurchaseOrder.order.summary.productCount }} 种 · {{ number(currentPurchaseOrder.order.summary.orderedUnits) }} 件</strong><small>系统建议 {{ number(currentPurchaseOrder.order.summary.suggestedUnits) }} 件</small></article><article><span>预计金额</span><strong>{{ money(currentPurchaseOrder.order.summary.totalCostCents / 100) }}</strong><small>仅统计已填写进价</small></article></section>
      <section v-if="currentPurchaseOrder?.order" class="system-card purchase-order-card"><div class="card-title"><div><h3>本周进货单</h3><p>周起始 {{ currentPurchaseOrder.order.weekStart }} · {{ currentPurchaseOrder.order.orderNo }}</p><small v-if="currentPurchaseOrder.generatedAt" class="inventory-source-time">实时库存读取：{{ dateTime(currentPurchaseOrder.generatedAt) }} · 最近库存变更：{{ dateTime(currentPurchaseOrder.inventoryLatestUpdatedAt ?? null) }}</small></div><div class="purchase-order-actions"><button class="secondary" type="button" :disabled="!currentPurchaseOrder.order.items.length" @click="exportPurchaseOrderExcel">导出 Excel</button><button v-if="currentPurchaseOrder.order.status === 'DRAFT'" type="button" :disabled="purchaseLoading || !currentPurchaseOrder.order.items.length" @click="changePurchaseStatus('CONFIRMED')">确认进货单</button><button v-if="currentPurchaseOrder.order.status === 'CONFIRMED'" class="secondary" type="button" :disabled="purchaseLoading" @click="changePurchaseStatus('DRAFT')">退回草稿</button><button v-if="currentPurchaseOrder.order.status === 'CANCELLED'" class="secondary" type="button" :disabled="purchaseLoading" @click="changePurchaseStatus('DRAFT')">恢复为草稿</button><button v-if="currentPurchaseOrder.order.status === 'CONFIRMED'" type="button" :disabled="purchaseLoading" @click="changePurchaseStatus('ORDERED')">标记已订货</button><button v-if="['DRAFT','CONFIRMED','ORDERED'].includes(currentPurchaseOrder.order.status)" class="danger" type="button" :disabled="purchaseLoading" @click="changePurchaseStatus('CANCELLED')">取消进货单</button></div></div>
        <div class="purchase-order-table-wrap"><table class="purchase-order-table"><thead><tr><th>商品</th><th>数量与供应商</th><th>进价与整箱</th><th>备注与操作</th></tr></thead><tbody><tr v-for="item in currentPurchaseOrder.order.items" :key="item.id"><td data-label="商品"><strong>{{ item.productName }}</strong><small>{{ item.barcode || item.sku }} · {{ purchaseSourceLabel(item.source) }}</small><em>实时库存 {{ item.currentInventory }} · 近7天 {{ item.recentSevenDayQty }} · 建议 {{ item.suggestedQuantity }}</em></td><td data-label="数量与供应商"><label>进货数量<input v-model.number="item.orderedQuantity" type="number" min="1" inputmode="numeric" :disabled="currentPurchaseOrder.order.status !== 'DRAFT'" /></label><label>供应商<input v-model="item.supplierName" type="text" maxlength="120" placeholder="可稍后填写" :disabled="currentPurchaseOrder.order.status !== 'DRAFT'" /></label></td><td data-label="进价与整箱"><label>单件进价（分）<input v-model.number="item.unitCostCents" type="number" min="0" inputmode="numeric" placeholder="可选" :disabled="currentPurchaseOrder.order.status !== 'DRAFT'" /></label><label>整箱规格<input v-model.number="item.caseSize" type="number" min="1" inputmode="numeric" placeholder="可选" :disabled="currentPurchaseOrder.order.status !== 'DRAFT'" /></label></td><td data-label="备注与操作"><label>备注<input v-model="item.notes" type="text" maxlength="255" placeholder="采购或到货说明" :disabled="currentPurchaseOrder.order.status !== 'DRAFT'" /></label><div v-if="currentPurchaseOrder.order.status === 'DRAFT'" class="purchase-row-actions"><button type="button" :disabled="purchaseLoading" @click="savePurchaseItem(item)">保存</button><button class="danger" type="button" :disabled="purchaseLoading" @click="removePurchaseItem(item)">移除</button></div></td></tr></tbody></table></div>
      </section>
      <section v-else class="system-card procurement-empty"><h3>本周还没有进货单</h3><p>先从进货建议、缺货列表或热销商品中加入商品。</p><button type="button" @click="purchaseView = 'suggestions'">查看进货建议</button></section>
    </template>
  </section>
</template>

<style scoped>
/* Shares the ManagementDashboard style scope (see vite.config.ts); page-specific styles go here. */
.buy-card-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.buy-card{display:flex;gap:12px;align-items:stretch;padding:12px 14px;border:1px solid #2a3a52;border-radius:12px;background:#0f1a2a}
.buy-card-main{flex:1;min-width:0;display:grid;align-content:start;gap:3px}
.buy-card-main strong{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:14px;line-height:1.35;color:#eef3fb}
.buy-card-main small{font-size:12px;color:#8d9bb0}
.buy-card-main p{margin:4px 0 0;font-size:13px;color:#b9c5d6}
.buy-card-main p b{color:#eef3fb}.buy-card-main p b.out{color:#ff8a8a}
.buy-card-main .buy-card-note{margin:2px 0 0;font-size:12px;color:#f3c26b}
.buy-card-side{flex:0 0 76px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding-left:12px;border-left:1px solid #2a3a52}
.buy-card-side>span{font-size:11px;color:#8d9bb0}
.buy-card-side>strong{font-size:26px;line-height:1;font-weight:700;color:#66e0e7}
.buy-card-add{width:100%;min-height:30px;margin-top:4px;padding:0 8px;border:0;border-radius:8px;background:#2f9fa8;color:#fff;font-size:13px;font-weight:600;cursor:pointer}
.buy-card-add:disabled{background:#2a3a52;color:#8d9bb0;cursor:default}
.buy-card-ignore{padding:2px 6px;border:0;background:none;color:#8d9bb0;font-size:12px;cursor:pointer}
.buy-card-ignore:hover:not(:disabled){color:#eef3fb;text-decoration:underline}
:root:not([data-theme="dark"]) .management-workspace .buy-card{border-color:#dde5ef;background:#fff}
:root:not([data-theme="dark"]) .management-workspace .buy-card-side{border-left-color:#e6ecf3}
:root:not([data-theme="dark"]) .management-workspace .buy-card-main strong,:root:not([data-theme="dark"]) .management-workspace .buy-card-main p b{color:#24314d}
:root:not([data-theme="dark"]) .management-workspace .buy-card-main p{color:#4a5874}
:root:not([data-theme="dark"]) .management-workspace .buy-card-main p b.out{color:#d64545}
:root:not([data-theme="dark"]) .management-workspace .buy-card-main .buy-card-note{color:#b26a00}
:root:not([data-theme="dark"]) .management-workspace .buy-card-side>strong{color:#167f8e}
:root:not([data-theme="dark"]) .management-workspace .buy-card-add{background:#167f8e;color:#fff}
:root:not([data-theme="dark"]) .management-workspace .buy-card-add:disabled{background:#e6ecf3;color:#8a96a8}
:root:not([data-theme="dark"]) .management-workspace .buy-card-ignore{color:#718096}
@media(max-width:1200px){.buy-card-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:720px){
  .buy-card-grid{grid-template-columns:1fr}
  .buy-card{flex-direction:column;gap:10px}
  .buy-card-side{flex:none;flex-direction:row;justify-content:flex-start;gap:8px;padding:10px 0 0;border-left:0;border-top:1px solid #2a3a52}
  .buy-card-side>strong{font-size:22px;margin-right:auto}
  .buy-card-add{width:auto;min-width:88px;margin-top:0;order:3}
  .buy-card-ignore{order:2}
  :root:not([data-theme="dark"]) .management-workspace .buy-card-side{border-top-color:#e6ecf3}
}
</style>
