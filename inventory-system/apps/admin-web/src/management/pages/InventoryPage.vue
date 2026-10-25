<script setup lang="ts">
import FilterSheet from '../components/FilterSheet.vue';
import { useManagementContext } from '../useManagementDashboard';

const {
  error, inventoryLookbackDays, inventoryQuery, inventoryOperations, inventoryLoading, inventoryTableQuery,
  inventoryBrandFilter, inventoryCategoryFilter, inventoryStatusFilter, inventorySort, inventoryPage,
  inventoryPageSize, inventoryActionProductId, purchaseLoading, purchaseActionProductId, inventoryStatusLabel,
  clearInventoryFilters, inventoryBrands, inventoryCategories, inventoryStatusCounts, filteredInventoryProducts,
  inventoryPageCount, pagedInventoryProducts, number, loadInventoryOperations, configureMinimumStock,
  setInventoryVisibility, addToPurchaseOrder, isProductInCurrentOrder
} = useManagementContext();
</script>

<template>
  <section class="inventory-operations-page">
    <FilterSheet title="分析范围" :summary="`近 ${inventoryLookbackDays} 天销量${inventoryQuery ? ` · ${inventoryQuery}` : ' · 全部商品'}`">
    <form class="inventory-operation-filters" @submit.prevent="loadInventoryOperations">
      <label>销量观察期<select v-model.number="inventoryLookbackDays"><option :value="30">最近30天</option><option :value="60">最近60天</option><option :value="90">最近90天</option><option :value="180">最近180天</option><option :value="365">最近365天</option></select></label>
      <label>查询商品范围<input v-model="inventoryQuery" placeholder="名称、品牌、SKU或条码" /></label>
      <button type="submit" :disabled="inventoryLoading">{{ inventoryLoading ? '分析中…' : '更新分析' }}</button><button class="secondary-action" type="button" @click="inventoryQuery = ''">清除查询范围</button>
    </form>
    </FilterSheet>
    <p v-if="inventoryLoading" class="inventory-load-status" role="status">正在更新库存分析，请稍候…</p>
    <p v-else-if="!inventoryOperations && !error" class="system-empty">选择观察期并查询，查看当前门店的库存经营情况。</p>
    <p v-if="inventoryOperations && !inventoryOperations.salesCoverage.reliable" class="management-alert pending"><strong>销售历史不足</strong><span>{{ inventoryOperations.coverageNotice }} 缺货与低库存仍可使用，但积压和滞销需要等待更多销售历史。</span></p>
    <template v-if="inventoryOperations">
      <p v-if="inventoryOperations.summary.expiredUnits" class="management-alert pending" role="status"><strong>已过期库存</strong><span>{{ inventoryOperations.summary.expiredBatches }} 个批次共 {{ number(inventoryOperations.summary.expiredUnits) }} 件已过期，请在库存系统「临期提醒 · 已过期」中处理。</span></p>
      <div class="inventory-operation-kpis">
        <article><span>当前库存</span><strong>{{ number(inventoryOperations.summary.totalInventory) }} 件</strong><small>{{ inventoryOperations.summary.stockedProducts }} 种有库存商品</small></article>
        <article><button class="kpi-filter" type="button" @click="inventoryStatusFilter = 'OUT_OF_STOCK'; inventoryPage = 1" aria-label="筛选缺货商品"><span>缺货商品</span><strong>{{ inventoryOperations.summary.outOfStockProducts }}</strong><small>零库存且近180天有销售</small></button></article>
        <article><button class="kpi-filter" type="button" @click="inventoryStatusFilter = 'LOW'; inventoryPage = 1" aria-label="筛选低库存商品"><span>低库存商品</span><strong>{{ inventoryOperations.summary.lowStockProducts }}</strong><small>核心品牌与绵羊油默认20件</small></button></article>
        <article><button class="kpi-filter" type="button" @click="inventoryStatusFilter = 'SLOW'; inventoryPage = 1" aria-label="筛选滞销关注"><span>滞销关注</span><strong>{{ inventoryOperations.summary.slowMovingProducts }}</strong><small>有库存且销量不足</small></button></article>
        <article><span>观察商品</span><strong>{{ inventoryOperations.summary.productCount }}</strong><small>已观察 {{ inventoryOperations.salesCoverage.observedDays }} 天POS销售跨度</small></article>
      </div>
      <section class="system-card product-table-card inventory-detail-card" :aria-busy="inventoryLoading">
        <div class="card-title"><div><h3>销售与库存关联明细</h3><p>{{ inventoryOperations.period.from }} 至 {{ inventoryOperations.period.to }} · 库存为当前余额</p></div><div class="minimum-stock-tools"><span>{{ filteredInventoryProducts.length }} / {{ inventoryOperations.products.length }} 种</span><button class="table-action" type="button" @click="configureMinimumStock()">统一设置最低库存</button></div></div>
        <div class="inventory-status-tabs" aria-label="库存状态快捷筛选">
          <button type="button" :class="{ active: inventoryStatusFilter === 'ALL' }" @click="inventoryStatusFilter = 'ALL'">全部 <b>{{ inventoryStatusCounts.ALL }}</b></button>
          <button type="button" :class="{ active: inventoryStatusFilter === 'SLOW' }" @click="inventoryStatusFilter = 'SLOW'">滞销 <b>{{ inventoryStatusCounts.SLOW }}</b></button>
          <button type="button" :class="{ active: inventoryStatusFilter === 'OUT_OF_STOCK' }" @click="inventoryStatusFilter = 'OUT_OF_STOCK'">缺货 <b>{{ inventoryStatusCounts.OUT_OF_STOCK }}</b></button>
          <button type="button" :class="{ active: inventoryStatusFilter === 'LOW' }" @click="inventoryStatusFilter = 'LOW'">低库存 <b>{{ inventoryStatusCounts.LOW }}</b></button>
          <button type="button" :class="{ active: inventoryStatusFilter === 'OVERSTOCK' }" @click="inventoryStatusFilter = 'OVERSTOCK'">积压 <b>{{ inventoryStatusCounts.OVERSTOCK }}</b></button>
          <button type="button" :class="{ active: inventoryStatusFilter === 'NO_MINIMUM' }" @click="inventoryStatusFilter = 'NO_MINIMUM'">未设最低库存 <b>{{ inventoryStatusCounts.NO_MINIMUM }}</b></button>
        </div>
        <FilterSheet title="列表筛选" :summary="`${inventoryBrandFilter || '全部品牌'} · ${inventoryCategoryFilter || '全部分类'} · 共 ${filteredInventoryProducts.length} 种`">
        <div class="inventory-detail-filters">
          <label>筛选当前结果<input v-model="inventoryTableQuery" type="search" placeholder="在已查询商品内筛选" /></label>
          <label>品牌<select v-model="inventoryBrandFilter"><option value="">全部品牌</option><option v-for="brand in inventoryBrands" :key="brand" :value="brand">{{ brand }}</option></select></label>
          <label>商品分类<select v-model="inventoryCategoryFilter"><option value="">全部分类</option><option v-for="category in inventoryCategories" :key="category" :value="category">{{ category }}</option></select></label>
          <label>排序<select v-model="inventorySort"><option value="INVENTORY_DESC">库存从高到低</option><option value="SALES_DESC">销量从高到低</option><option value="COVERAGE_DESC">覆盖天数从高到低</option><option value="LAST_SALE_ASC">最久未销售优先</option><option value="NAME_ASC">商品名称排序</option></select></label>
        </div>
        <button class="text-action clear-table-filter" type="button" @click="clearInventoryFilters">清除筛选</button>
        </FilterSheet>
        <div class="product-table-wrap inventory-scroll-table"><table><thead><tr><th>商品</th><th>库存</th><th>最低库存</th><th>观察期销量</th><th>日均销量</th><th>最后销售</th><th>状态与操作</th></tr></thead><tbody><tr v-for="item in pagedInventoryProducts" :key="item.productId"><td data-label="商品"><strong>{{ item.productName }}</strong><small>{{ item.brandName }} · {{ item.categoryName }}<template v-if="item.posMapped === false"> · <b class="pos-unmapped-tag">POS未映射</b></template></small></td><td data-label="库存">{{ number(item.currentInventory) }}</td><td data-label="最低库存"><button class="minimum-stock-value" type="button" @click="configureMinimumStock(item)">{{ item.minimumStock ?? '—' }} <small>{{ item.minimumStockSource === 'MANUAL' ? '单独' : item.minimumStockSource === 'DEFAULT' ? '默认' : '不提醒' }}</small></button></td><td data-label="观察期销量">{{ number(item.soldUnits) }}</td><td data-label="日均销量">{{ number(item.dailyVelocity) }}</td><td data-label="最后销售">{{ item.daysSinceLastSale === null ? '无记录' : `${item.daysSinceLastSale} 天前` }}</td><td data-label="状态与操作"><div class="inventory-row-actions"><b :class="['stock-badge', item.stockStatus.toLowerCase()]">{{ inventoryStatusLabel(item) }}</b><button type="button" :disabled="inventoryActionProductId === item.productId" @click="setInventoryVisibility(item, 'IGNORE')">忽略</button><button type="button" :disabled="inventoryActionProductId === item.productId" @click="setInventoryVisibility(item, 'NEXT_WEEK')">下周显示</button><button class="table-action muted" type="button" @click="configureMinimumStock(item)">设阈值</button><button v-if="item.stockStatus !== 'IN_STOCK' && (item.stockStatus !== 'OUT_OF_STOCK' || item.shortageVisible)" :class="['table-action', { 'is-added': isProductInCurrentOrder(item.productId) }]" type="button" :disabled="purchaseLoading || isProductInCurrentOrder(item.productId)" @click="addToPurchaseOrder(item.productId, item.stockStatus === 'OUT_OF_STOCK' ? 'OUT_OF_STOCK' : 'LOW_STOCK')">{{ purchaseActionProductId === item.productId ? '加入中…' : isProductInCurrentOrder(item.productId) ? '已在进货单' : '加入进货单' }}</button></div></td></tr></tbody></table><p v-if="!pagedInventoryProducts.length" class="system-empty">当前筛选条件没有需要处理的商品。</p></div>
        <div class="inventory-table-pagination">
          <span>显示 {{ filteredInventoryProducts.length ? (inventoryPage - 1) * inventoryPageSize + 1 : 0 }}–{{ Math.min(inventoryPage * inventoryPageSize, filteredInventoryProducts.length) }} / 共 {{ filteredInventoryProducts.length }} 种商品</span>
          <label>每页<select v-model.number="inventoryPageSize"><option :value="18">18</option><option :value="54">54</option></select></label>
          <div><button type="button" :disabled="inventoryPage <= 1" @click="inventoryPage--">上一页</button><b>{{ inventoryPage }} / {{ inventoryPageCount }}</b><button type="button" :disabled="inventoryPage >= inventoryPageCount" @click="inventoryPage++">下一页</button></div>
          <button v-if="inventoryPageSize < filteredInventoryProducts.length" class="load-more" type="button" @click="inventoryPageSize += 50">加载更多（{{ inventoryPageSize }} / {{ filteredInventoryProducts.length }}）</button>
        </div>
      </section>
    </template>
  </section>
</template>

<style scoped>
/* Shares the ManagementDashboard style scope (see vite.config.ts); page-specific styles go here. */
</style>
