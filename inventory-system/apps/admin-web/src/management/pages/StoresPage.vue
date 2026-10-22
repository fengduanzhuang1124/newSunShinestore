<script setup lang="ts">
import { useManagementContext } from '../useManagementDashboard';

const {
  today, storeFrom, storeTo, storeComparison, storeLoading, setDateRange, money, number, openNativePicker,
  loadStoreComparison
} = useManagementContext();
</script>

<template>
  <section class="store-comparison-page">
    <div class="period-shortcuts" role="group" aria-label="快捷日期"><span>快捷日期</span><button type="button" @click="setDateRange('stores', 'today')">今天</button><button type="button" @click="setDateRange('stores', 'week')">近7天</button><button type="button" @click="setDateRange('stores', 'month')">本月</button><small>修改条件后点击更新分析</small></div>
    <form class="store-comparison-filters" @submit.prevent="loadStoreComparison"><label>开始日期<input v-model="storeFrom" type="date" @click="openNativePicker" /></label><label>结束日期<input v-model="storeTo" type="date" @click="openNativePicker" /></label><button type="submit" :disabled="storeLoading">{{ storeLoading ? '查询中…' : '更新分析' }}</button></form>
    <p v-if="storeComparison?.comparisonNotice" class="management-alert pending"><strong>单店模式</strong><span>{{ storeComparison.comparisonNotice }}</span></p>
    <template v-if="storeComparison">
      <div class="store-kpis"><article><span>启用门店</span><strong>{{ storeComparison.storeCount }}</strong><small>{{ storeComparison.comparisonAvailable ? '已启用多店比较' : '当前为单店经营基线' }}</small></article><article><span>销售额</span><strong>{{ money(storeComparison.stores.reduce((sum,item) => sum + item.sales.netRevenue, 0)) }}</strong><small>{{ storeComparison.period.from }} 至 {{ storeComparison.period.to }}</small></article><article><span>订单</span><strong>{{ storeComparison.stores.reduce((sum,item) => sum + item.sales.orderCount, 0) }}</strong><small>全部正式门店</small></article><article><span>库存</span><strong>{{ number(storeComparison.stores.reduce((sum,item) => sum + item.inventory.totalQuantity, 0)) }} 件</strong><small>正式库存余额</small></article></div>
      <div v-if="!storeComparison.comparisonAvailable" class="store-card-grid"><article v-for="item in storeComparison.stores" :key="item.store.id" class="system-card store-result-card" :class="{ selected: item.selected }"><div class="card-title"><div><h3>{{ item.store.name }}</h3><p>{{ item.store.code }}</p></div><span v-if="item.selected">当前门店</span></div><dl><div><dt>净销售额</dt><dd>{{ money(item.sales.netRevenue) }}</dd></div><div><dt>订单数</dt><dd>{{ item.sales.orderCount }}</dd></div><div><dt>平均客单价</dt><dd>{{ money(item.sales.averageOrderValue) }}</dd></div><div><dt>销售件数</dt><dd>{{ number(item.sales.unitsSold) }}</dd></div><div><dt>库存</dt><dd>{{ number(item.inventory.totalQuantity) }}</dd></div><div><dt>缺货 / 低库存</dt><dd>{{ item.inventory.outOfStockProducts }} / {{ item.inventory.lowStockProducts }}</dd></div></dl></article></div>
      <section v-if="storeComparison.comparisonAvailable" class="system-card store-comparison-table"><div class="card-title"><div><h3>门店经营比较</h3><p>销售按所选期间统计；库存为当前余额，库存高低不代表经营优劣</p></div></div><div class="product-table-wrap management-detail-scroll"><table><thead><tr><th>门店</th><th>净销售额</th><th>订单</th><th>客单价</th><th>销售件数</th><th>当前库存</th><th>缺货 / 低库存</th></tr></thead><tbody><tr v-for="item in storeComparison.stores" :key="item.store.id"><td><strong>{{ item.store.name }}</strong><small>{{ item.store.code }}{{ item.selected ? ' · 当前门店' : '' }}</small></td><td>{{ money(item.sales.netRevenue) }}</td><td>{{ item.sales.orderCount }}</td><td>{{ money(item.sales.averageOrderValue) }}</td><td>{{ number(item.sales.unitsSold) }}</td><td>{{ number(item.inventory.totalQuantity) }}</td><td>{{ item.inventory.outOfStockProducts }} / {{ item.inventory.lowStockProducts }}</td></tr></tbody></table></div></section>
      <details v-if="storeComparison.comparisonAvailable" class="system-card store-ranking-card"><summary>查看分项排行</summary><div class="card-title"><div><h3>门店经营排行</h3><p>多门店时自动形成正式排行；单店时作为后续比较基线</p></div></div><div class="store-rankings"><div><h4>按净销售额</h4><ol><li v-for="(item,index) in storeComparison.ranking.byRevenue" :key="item.storeId"><b>{{ index + 1 }}</b><span>{{ item.storeName }}</span><em>{{ money(item.value) }}</em></li></ol></div><div><h4>按订单数</h4><ol><li v-for="(item,index) in storeComparison.ranking.byOrders" :key="item.storeId"><b>{{ index + 1 }}</b><span>{{ item.storeName }}</span><em>{{ number(item.value) }}</em></li></ol></div><div><h4>库存分布（按数量）</h4><ol><li v-for="(item,index) in storeComparison.ranking.byInventory" :key="item.storeId"><b>{{ index + 1 }}</b><span>{{ item.storeName }}</span><em>{{ number(item.value) }} 件</em></li></ol></div></div></details>
    </template>
  </section>
</template>

<style scoped>
/* Shares the ManagementDashboard style scope (see vite.config.ts); page-specific styles go here. */
</style>
