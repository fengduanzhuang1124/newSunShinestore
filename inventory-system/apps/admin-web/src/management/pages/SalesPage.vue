<script setup lang="ts">
import FilterSheet from '../components/FilterSheet.vue';
import { useManagementContext } from '../useManagementDashboard';

const {
  today, salesFrom, salesTo, salesDimension, salesBrand, salesCategory, salesAnalysis, salesLoading, canSection,
  openDataCenter, clearSalesFilters, setDateRange, salesTimeBuckets, singleDaySales, salesTrendSeries, maxSalesTrend,
  salesTrendPoints, linePath, areaPath, money, number, percent, comparisonClass, openNativePicker, loadSalesAnalysis
} = useManagementContext();
</script>

<template>
  <section class="sales-analysis-page">
    <FilterSheet title="销售筛选" :summary="`${salesFrom === salesTo ? salesFrom : `${salesFrom} 至 ${salesTo}`}${salesBrand || salesCategory ? ' · 已筛选品牌或品类' : ''}`">
    <div class="period-shortcuts" role="group" aria-label="快捷日期"><span>默认显示今天</span><button type="button" @click="setDateRange('sales', 'today')">今天</button><button type="button" @click="setDateRange('sales', 'week')">近7天</button><button type="button" @click="setDateRange('sales', 'month')">本月</button><button type="button" @click="setDateRange('sales', 'year')">本年</button><small>快捷日期会同时选择合适的统计维度；自定义日期后可手动调整</small></div>
    <form class="sales-filter-panel" @submit.prevent="loadSalesAnalysis">
      <label>开始日期<input v-model="salesFrom" type="date" @click="openNativePicker" /></label>
      <label>结束日期<input v-model="salesTo" type="date" @click="openNativePicker" /></label>
      <label>统计维度<select v-model="salesDimension"><option value="DAY">按日</option><option value="WEEK">按周</option><option value="MONTH">按月</option></select></label>
      <label>品牌<input v-model="salesBrand" placeholder="全部品牌" /></label>
      <label>品类<input v-model="salesCategory" placeholder="全部品类" /></label>
      <button type="submit" :disabled="salesLoading">{{ salesLoading ? '查询中…' : '更新分析' }}</button><button class="secondary-action" type="button" @click="clearSalesFilters">清除品牌 / 品类</button>
    </form>
    </FilterSheet>
    <details v-if="salesAnalysis" class="analysis-method"><summary>销售统计口径与筛选说明</summary><p class="scope-note">品牌按正式品牌名称精确匹配，品类按商品主档匹配；名称识别的品牌尚不能代替正式字段。商品分类与健康需求标签分开统计。</p><p v-if="salesAnalysis?.channelNotice" class="management-alert pending sync-required-alert"><strong>渠道说明</strong><span>{{ salesAnalysis.channelNotice }}“更新分析”只读取已同步数据。</span><button v-if="!salesAnalysis.dataAvailable" type="button" :disabled="!canSection('system')" @click="openDataCenter('sync')">前往 POS 同步</button></p>
    <p v-if="salesAnalysis?.refundNotice" class="management-alert pending"><strong>退款口径</strong><span>{{ salesAnalysis.refundNotice }}</span></p></details><p v-if="salesAnalysis && !salesAnalysis.dataAvailable" class="inline-notice">所选期间没有已同步订单，不代表门店没有销售。<button v-if="canSection('system')" type="button" class="text-action" @click="openDataCenter('sync')">检查 POS 同步 →</button></p>

    <template v-if="salesAnalysis">
      <p class="scope-note">当前：{{ salesAnalysis.period.from }} 至 {{ salesAnalysis.period.to }} · 对比：{{ salesAnalysis.period.previousFrom }} 至 {{ salesAnalysis.period.previousTo }}（前一等长时段，非同比）</p>
      <div class="sales-kpis">
        <article><span>净销售额</span><strong>{{ money(salesAnalysis.metrics.netRevenue) }}</strong><small :class="comparisonClass(salesAnalysis.comparison.netRevenuePercent)">较上期 {{ percent(salesAnalysis.comparison.netRevenuePercent) }}</small></article>
        <article><span>订单数</span><strong>{{ salesAnalysis.metrics.orderCount }}</strong><small :class="comparisonClass(salesAnalysis.comparison.orderCountPercent)">较上期 {{ percent(salesAnalysis.comparison.orderCountPercent) }}</small></article>
        <article><span>销售件数</span><strong>{{ number(salesAnalysis.metrics.unitsSold) }}</strong><small :class="comparisonClass(salesAnalysis.comparison.unitsSoldPercent)">较上期 {{ percent(salesAnalysis.comparison.unitsSoldPercent) }}</small></article>
        <article><span>平均客单价</span><strong>{{ money(salesAnalysis.metrics.averageOrderValue) }}</strong><small :class="comparisonClass(salesAnalysis.comparison.averageOrderValuePercent)">较上期 {{ percent(salesAnalysis.comparison.averageOrderValuePercent) }}</small></article>
        <article><span>退款金额</span><strong>{{ money(salesAnalysis.metrics.refunds) }}</strong><small>销售总额 {{ money(salesAnalysis.metrics.grossRevenue) }}</small></article>
      </div>

      <div class="sales-dashboard-grid">
        <section class="system-card sales-trend-card"><div class="card-title"><div><h3>{{ singleDaySales ? '当日销售走势' : '销售趋势' }}</h3><p>{{ singleDaySales ? '每 3 小时汇总净销售额' : `${salesAnalysis.period.from} 至 ${salesAnalysis.period.to}` }}</p></div></div><p v-if="salesTrendSeries.length === 1" class="scope-note">当前只有 1 个有记录的统计时段，尚不足以形成趋势。</p><div v-if="salesTrendSeries.length && salesAnalysis.dataAvailable" class="trend-line-chart sales-line-chart"><svg viewBox="-150 0 1160 230" role="img" aria-label="查询期间销售走势"><defs><linearGradient id="sales-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#6d7cff" stop-opacity=".4"/><stop offset="100%" stop-color="#6d7cff" stop-opacity="0"/></linearGradient></defs><g class="chart-grid"><line v-for="y in [40,82,124,166,210]" :key="y" x1="0" :y1="y" x2="1000" :y2="y" /></g><g class="chart-values"><text v-for="y in [40,124,210]" :key="y" x="-12" :y="y + 5" text-anchor="end">{{ money(maxSalesTrend * (210 - y) / 170) }}</text></g><path :d="areaPath(salesTrendPoints)" fill="url(#sales-area)"/><polyline :points="linePath(salesTrendPoints)"/><circle v-for="(point,index) in salesTrendPoints" :key="index" :cx="point.x" :cy="point.y" r="4"><title>{{ salesTrendSeries[index].label }} · {{ money(point.value) }}</title></circle></svg><div class="trend-axis"><span v-for="item in salesTrendSeries.filter((_,index,rows) => index === 0 || index === rows.length - 1 || index % Math.max(1, Math.ceil(rows.length / 5)) === 0)" :key="item.label">{{ item.label.length > 5 ? item.label.slice(5) : item.label }}</span></div></div><p v-else class="system-empty">所选日期暂无 POS 销售数据。</p><details v-if="salesAnalysis.dataAvailable" class="trend-data"><summary>查看趋势数值</summary><p class="scope-note">按返回的统计时段展示，未返回的日期不自动补零。</p><dl><div v-for="(item,index) in salesTrendSeries" :key="index"><dt>{{ item.label }}</dt><dd>{{ money(item.revenue) }}</dd></div></dl></details></section>
        <div class="sales-side-column">
          <details class="system-card source-quality"><summary>本次查询的数据范围</summary><div class="card-title"><div><h3>数据可用情况</h3><p>帮助判断分析结果是否完整</p></div></div><dl><div><dt>已读取订单</dt><dd>{{ salesAnalysis.sourceQuality.orders }}</dd></div><div><dt>商品销售行</dt><dd>{{ salesAnalysis.sourceQuality.activeItems }}</dd></div><div><dt>已关联商品</dt><dd>{{ salesAnalysis.sourceQuality.mappedItems }}</dd></div><div><dt>待人工确认</dt><dd>{{ salesAnalysis.sourceQuality.reviewRequiredItems }}</dd></div></dl><button v-if="canSection('system')" type="button" class="text-action" @click="openDataCenter('issues')">查看关联异常 →</button></details>
          <section v-if="!singleDaySales" class="system-card hourly-card"><div class="card-title"><div><h3>销售时段概览</h3><p>每 3 小时汇总</p></div></div><div class="time-bucket-grid"><article v-for="item in salesTimeBuckets" :key="item.label"><span>{{ item.label }}</span><strong>{{ money(item.revenue) }}</strong><small>{{ item.orders }} 单</small></article></div></section>
        </div>
        <section class="system-card sales-ranking"><div class="card-title"><div><h3>热销商品</h3><p>{{ salesAnalysis.period.from }} 至 {{ salesAnalysis.period.to }} · 按销售金额排序</p></div></div><ol v-if="salesAnalysis.topProducts.length"><li v-for="(item,index) in salesAnalysis.topProducts.slice(0,10)" :key="item.productName"><b>{{ index + 1 }}</b><span><strong>{{ item.productName }}</strong><small>{{ item.brandName }} · {{ number(item.quantity) }} 件</small></span><em>{{ money(item.revenue) }}</em></li></ol><p v-else class="system-empty">暂无商品排行。</p></section>
        <section class="system-card sales-ranking"><div class="card-title"><div><h3>品牌销售贡献</h3><p>按商品销售金额排序，未分摊订单级退款；品牌优先取正式资料，缺失时由名称识别</p></div></div><ol v-if="salesAnalysis.topBrands.length"><li v-for="(item,index) in salesAnalysis.topBrands.slice(0,10)" :key="item.brandName"><b>{{ index + 1 }}</b><span><strong>{{ item.brandName }}</strong><small>{{ number(item.quantity) }} 件</small></span><em>{{ money(item.revenue) }}</em></li></ol><p v-else class="system-empty">同步销售数据后显示品牌排行。</p></section>
      </div>
    </template>
  </section>
</template>

<style scoped>
/* Shares the ManagementDashboard style scope (see vite.config.ts); page-specific styles go here. */
</style>
