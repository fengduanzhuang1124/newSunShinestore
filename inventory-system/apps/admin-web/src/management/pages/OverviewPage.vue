<script setup lang="ts">
import { useManagementContext } from '../useManagementDashboard';

const {
  overview, foundation, today, overviewTrendPeriods, overviewHotPeriods, overviewTrendPeriod, overviewHotPeriod,
  overviewTrendAnalysis, overviewHotAnalysis, overviewWidgetsLoading, overviewWidgetError, currentPurchaseOrder,
  purchaseLoading, canSection, openDataCenter, openSalesFromOverview, overviewTrendSeries, maxDailyRevenue,
  overviewTrendPoints, linePath, areaPath, money, number, percent, comparisonClass, dateTime, selectOverviewTrend,
  selectOverviewHot, addToPurchaseOrder, isProductInCurrentOrder, openProcurement, emit
} = useManagementContext();
</script>

<template>
  <p v-if="overview && !overview.salesAvailable" class="management-alert pending sync-required-alert"><strong>POS 销售数据尚未同步</strong><span>当前销售卡片显示为 0，“刷新数据”只查询本地数据库，不会从 POS 拉取订单，也不会使用演示数据。</span><button type="button" :disabled="!canSection('system')" @click="openDataCenter('sync')">前往 POS 同步</button></p>
  <div class="data-freshness" aria-label="数据更新时间"><span>库存更新：{{ dateTime(foundation?.quality.inventory.latestUpdatedAt ?? null) }}</span><span>POS 最近成功同步：{{ dateTime(overview?.lastPosSyncAt ?? null) }}</span><button v-if="canSection('system')" class="text-action" type="button" @click="openDataCenter()">查看数据检查</button></div>

  <template v-if="overview">
    <div class="overview-metric-strip" aria-label="经营核心指标">
      <article><i class="metric-symbol sales">$</i><span>今日净销售额<strong :class="{ 'metric-long': money(overview.sales.current.netRevenue).length > 11 }">{{ money(overview.sales.current.netRevenue) }}</strong><small :class="comparisonClass(overview.sales.comparison.netRevenuePercent)">较昨日 {{ percent(overview.sales.comparison.netRevenuePercent) }}</small></span></article>
      <article><i class="metric-symbol orders">#</i><span>今日订单<strong>{{ overview.sales.current.orderCount }} 单</strong><small :class="comparisonClass(overview.sales.comparison.orderCountPercent)">较昨日 {{ percent(overview.sales.comparison.orderCountPercent) }}</small></span></article>
      <article><i class="metric-symbol units">∑</i><span>今日销售件数<strong>{{ number(overview.sales.current.unitsSold) }} 件</strong><small :class="comparisonClass(overview.sales.comparison.unitsSoldPercent)">较昨日 {{ percent(overview.sales.comparison.unitsSoldPercent) }}</small></span></article>
      <article><i class="metric-symbol average">Ø</i><span>今日平均客单价<strong :class="{ 'metric-long': money(overview.sales.current.averageOrderValue).length > 11 }">{{ money(overview.sales.current.averageOrderValue) }}</strong><small :class="comparisonClass(overview.sales.comparison.averageOrderValuePercent)">较昨日 {{ percent(overview.sales.comparison.averageOrderValuePercent) }}</small></span></article>
      <article><i class="metric-symbol stock">▦</i><span>当前库存<strong>{{ number(overview.inventory.totalQuantity) }} 件</strong><small>{{ overview.inventory.productCount }} 种商品</small></span></article>
      <article><i class="metric-symbol expiry">!</i><span>到期关注<strong>{{ number(overview.inventory.expiryAttentionQuantity) }} 件</strong><small>{{ overview.inventory.batchCount }} 个库存批次</small></span></article>
    </div>

    <p v-if="overviewWidgetError" class="inline-notice">{{ overviewWidgetError }}，仍显示最近一次成功结果。</p>
    <div class="overview-command-grid">
      <section class="management-card overview-sales-card">
        <header class="overview-card-header"><div><small>NET SALES</small><h3>销售趋势</h3><p>{{ overviewTrendAnalysis?.period.from ?? overview.period.date }} 至 {{ overviewTrendAnalysis?.period.to ?? today }}</p></div><div class="overview-header-actions"><div class="period-tabs" role="group" aria-label="销售趋势周期"><button v-for="item in overviewTrendPeriods" :key="item.key" type="button" :aria-pressed="overviewTrendPeriod === item.key" :disabled="overviewWidgetsLoading" @click="selectOverviewTrend(item.key)">{{ item.label }}</button></div><button v-if="canSection('sales')" class="text-action" type="button" @click="openSalesFromOverview">销售详情 →</button></div></header>
        <div class="trend-primary"><strong>{{ money(overviewTrendAnalysis?.metrics.netRevenue ?? overview.sales.current.netRevenue) }}</strong><span>{{ overviewTrendAnalysis?.metrics.orderCount ?? overview.sales.current.orderCount }} 单 · {{ number(overviewTrendAnalysis?.metrics.unitsSold ?? overview.sales.current.unitsSold) }} 件</span></div>
        <p v-if="overviewTrendSeries.length === 1" class="scope-note">当前只有 1 个有记录的日期，尚不足以形成完整趋势。</p><div v-if="overviewTrendSeries.length" :key="overviewTrendPeriod" class="trend-line-chart overview-line-chart">
          <svg viewBox="-150 0 1160 230" role="img" aria-label="销售趋势折线图"><defs><linearGradient id="overview-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#24d6e5" stop-opacity=".4"/><stop offset="100%" stop-color="#24d6e5" stop-opacity="0"/></linearGradient></defs><g class="chart-grid"><line v-for="y in [40,82,124,166,210]" :key="y" x1="0" :y1="y" x2="1000" :y2="y" /></g><g class="chart-values"><text v-for="y in [40,124,210]" :key="y" x="-12" :y="y + 5" text-anchor="end">{{ money(maxDailyRevenue * (210 - y) / 170) }}</text></g><path :d="areaPath(overviewTrendPoints)" fill="url(#overview-area)"/><polyline :points="linePath(overviewTrendPoints)"/><circle v-for="(point,index) in overviewTrendPoints" :key="index" :cx="point.x" :cy="point.y" r="4"><title>{{ overviewTrendSeries[index].period }} · {{ money(point.value) }}</title></circle></svg>
          <div class="trend-axis"><span v-for="item in overviewTrendSeries.filter((_,index,rows) => index === 0 || index === rows.length - 1 || index % Math.max(1, Math.ceil(rows.length / 5)) === 0)" :key="item.period">{{ item.period.length > 7 ? item.period.slice(5) : item.period }}</span></div>
        </div><p v-else class="management-empty">所选周期暂无已同步销售记录。</p>
      </section>

      <section class="management-card expiry-earnings-card">
        <header class="overview-card-header"><div><small>EXPIRY WATCH</small><h3>库存临期预警</h3><p>按批次风险分层</p></div><button class="text-action" type="button" @click="emit('open-report', 'expiry')">查看明细 →</button></header>
        <button class="expiry-earning-row expired" type="button" @click="emit('open-report', 'expiry')"><span>已过期<small>立即隔离处理</small></span><strong>{{ overview.inventory.expiry.expired }}</strong><i><b></b><b></b><b></b></i></button>
        <button class="expiry-earning-row urgent" type="button" @click="emit('open-report', 'expiry')"><span>紧急临期<small>优先检查与销售</small></span><strong>{{ overview.inventory.expiry.urgent }}</strong><i><b></b><b></b><b></b></i></button>
        <button class="expiry-earning-row warning" type="button" @click="emit('open-report', 'expiry')"><span>临期预警<small>进入近期处理清单</small></span><strong>{{ overview.inventory.expiry.warning }}</strong><i><b></b><b></b><b></b></i></button>
        <button class="expiry-earning-row early" type="button" @click="emit('open-report', 'expiry')"><span>提前关注<small>持续观察周转</small></span><strong>{{ overview.inventory.expiry.early }}</strong><i><b></b><b></b><b></b></i></button>
      </section>
    </div>

    <section class="overview-action-rail action-list" aria-label="经营关注与待办"><h3 class="visually-hidden">经营关注与待办</h3>
      <button type="button" @click="emit('open-report', 'receipts')"><i>↧</i><span>待提交入库单<small>查看未完成的入库作业</small></span><strong>{{ overview.inventory.activity.openReceiptCount }} 单</strong></button>
      <button type="button" @click="emit('open-report', 'expiry')"><i>⌛</i><span>到期关注<small>处理临期与过期批次</small></span><strong>{{ number(overview.inventory.expiryAttentionQuantity) }} 件</strong></button>
      <button type="button" @click="emit('open-report', 'movements')"><i>⇄</i><span>今日库存作业<small>含盘点修正 {{ overview.inventory.activity.stocktakeAdjustmentsToday }} 笔</small></span><strong>{{ overview.inventory.activity.movementCountToday }} 笔流水</strong></button>
      <button type="button" @click="openProcurement('order')"><i>↧</i><span>本周进货单<small>查看建议、确认数量与订货状态</small></span><strong>{{ currentPurchaseOrder?.order?.summary.productCount ?? 0 }} 种</strong></button>
    </section>

    <section class="management-card hot-products-card">
      <header class="overview-card-header"><div><small>TOP PRODUCTS</small><h3>热销产品 20</h3><p>按销售金额排序，快速识别主力商品</p></div><div class="period-tabs" role="group" aria-label="热销商品周期"><button v-for="item in overviewHotPeriods" :key="item.key" type="button" :aria-pressed="overviewHotPeriod === item.key" :disabled="overviewWidgetsLoading" @click="selectOverviewHot(item.key)">{{ item.label }}</button></div></header>
      <div v-if="(overviewHotAnalysis?.topProducts ?? overview.sales.current.topProducts).length" :key="overviewHotPeriod" class="hot-products-grid"><article v-for="(item,index) in (overviewHotAnalysis?.topProducts ?? overview.sales.current.topProducts).slice(0,20)" :key="`${item.productName}-${index}`"><b class="rank-badge" :class="{ podium:index<3 }">{{ String(index+1).padStart(2,'0') }}</b><span><strong>{{ item.productName }}</strong><small>{{ item.brandName || '未设置品牌' }}</small></span><em>{{ number(item.quantity) }} 件</em><strong>{{ money(item.revenue) }}</strong><button class="table-action" type="button" :disabled="purchaseLoading || !item.productId || isProductInCurrentOrder(item.productId)" @click="addToPurchaseOrder(item.productId,'HOT_SALES')">{{ isProductInCurrentOrder(item.productId) ? '已加入' : '加入' }}</button></article></div><p v-else class="management-empty">所选周期暂无商品销售排行。</p>
    </section>
  </template>
</template>

<style scoped>
/* Shares the ManagementDashboard style scope (see vite.config.ts); page-specific styles go here. */
</style>
