<script setup lang="ts">
import { useManagementContext } from '../useManagementDashboard';

const {
  productView, today, productFrom, productTo, productQuery, productBrand, productCategory, productsBrands,
  productsLoading, productDetailPage, productDetailPageSize, canSection, openDataCenter, STOCK_STATUS_LABEL,
  clearProductFilters, setDateRange, openInventoryAlert, productDetailPageCount, pagedProductDetails, money, number,
  openNativePicker, loadProductsBrands
} = useManagementContext();
</script>

<template>
  <section class="products-page">
    <div class="period-shortcuts" role="group" aria-label="快捷日期"><span>快捷日期</span><button type="button" @click="setDateRange('products', 'today')">今天</button><button type="button" @click="setDateRange('products', 'week')">近7天</button><button type="button" @click="setDateRange('products', 'month')">本月</button><small>修改条件后点击更新分析</small></div>
    <form class="product-filter-panel" @submit.prevent="loadProductsBrands">
      <label>开始日期<input v-model="productFrom" type="date" @click="openNativePicker" /></label>
      <label>结束日期<input v-model="productTo" type="date" @click="openNativePicker" /></label>
      <label>商品搜索<input v-model="productQuery" placeholder="名称、SKU或条码" /></label>
      <label>品牌<input v-model="productBrand" placeholder="全部品牌" /></label>
      <label>品类<input v-model="productCategory" placeholder="全部品类" /></label>
      <button type="submit" :disabled="productsLoading">{{ productsLoading ? '查询中…' : '更新分析' }}</button><button class="secondary-action" type="button" @click="clearProductFilters">清除商品条件</button>
    </form>
    <details class="analysis-method"><summary>商品分析口径</summary><p>本页仅展示经营数据，不提供商品新增、售价或条码维护。销售金额按已关联正式商品的明细累计，可能与订单净销售额不同；库存是当前余额，不是所选日期的历史库存。</p><p>品牌及品类筛选读取正式商品字段。展示名称可能来自名称识别；商品主档分类不等同于健康需求或人群标签。</p><p v-if="productsBrands && !productsBrands.marginAvailable">{{ productsBrands.marginNotice }}</p><button v-if="canSection('system')" class="text-action" type="button" @click="openDataCenter()">查看正式资料完整度 →</button></details>
    <template v-if="productsBrands">
      <p v-if="productsBrands.mappingQuality?.activeItems && productsBrands.mappingQuality.coveragePercent < 100" class="management-alert pending"><strong>商品映射尚未完成</strong><span>当前销售明细映射率 {{ productsBrands.mappingQuality.coveragePercent }}%，未映射销售不会进入商品与品牌统计。</span><button v-if="canSection('system')" type="button" @click="openDataCenter('issues')">查看异常</button></p>
      <div class="product-kpis">
        <article><span>启用商品</span><strong>{{ productsBrands.summary.productCount }}</strong><small>所选条件下的正式商品</small></article>
        <article><span>有销售商品</span><strong>{{ productsBrands.summary.soldProductCount }}</strong><small>销售 {{ number(productsBrands.summary.unitsSold) }} 件</small></article>
        <article><span>商品销售额</span><strong>{{ money(productsBrands.summary.salesRevenue) }}</strong><small>{{ productsBrands.period.from }} 至 {{ productsBrands.period.to }}</small></article>
        <article><span>当前库存</span><strong>{{ number(productsBrands.summary.currentInventory) }} 件</strong><small>{{ productsBrands.summary.inStockProducts }} 种有正库存</small></article>
        <article><button class="kpi-filter" type="button" @click="openInventoryAlert('OUT_OF_STOCK')"><span>缺货商品</span><strong>{{ productsBrands.summary.outOfStockProducts }}</strong><small>近180天有销售的零库存商品</small></button></article>
        <article><button class="kpi-filter" type="button" @click="openInventoryAlert('LOW')"><span>低库存商品</span><strong>{{ productsBrands.summary.lowStockProducts }}</strong><small>{{ productsBrands.summary.minimumStockConfiguredProducts ? '按已配置最低库存判断' : '尚未配置最低库存阈值' }}</small></button></article>
      </div>
      <div class="view-switcher" role="group" aria-label="商品分析视图"><button type="button" :aria-pressed="productView === 'products'" @click="productView = 'products'">商品明细</button><button type="button" :aria-pressed="productView === 'brands'" @click="productView = 'brands'">品牌结构</button><button type="button" :aria-pressed="productView === 'categories'" @click="productView = 'categories'">品类结构</button></div>
      <div v-show="productView !== 'products'" class="product-analysis-grid">
        <section v-show="productView === 'brands'" class="system-card product-ranking"><div class="card-title"><div><h3>品牌销售与库存结构</h3><p>销售与当前库存关联</p></div></div><ol v-if="productsBrands.brands.length"><li v-for="(item,index) in productsBrands.brands.slice(0,10)" :key="item.name"><b>{{ index + 1 }}</b><span><strong>{{ item.name }}</strong><small>{{ item.productCount }} 种 · 销售 {{ number(item.unitsSold) }} 件 · 库存 {{ number(item.currentInventory) }} 件</small></span><em>{{ money(item.salesRevenue) }}</em></li></ol><p v-else class="system-empty">暂无品牌数据。</p></section>
        <section v-show="productView === 'categories'" class="system-card product-ranking"><div class="card-title"><div><h3>商品主档品类结构</h3><p>按商品销售额排序</p></div></div><ol v-if="productsBrands.categories.length"><li v-for="(item,index) in productsBrands.categories.slice(0,10)" :key="item.name"><b>{{ index + 1 }}</b><span><strong>{{ item.name }}</strong><small>{{ item.productCount }} 种 · 销售 {{ number(item.unitsSold) }} 件</small></span><em>{{ money(item.salesRevenue) }}</em></li></ol><p v-else class="system-empty">暂无品类数据。</p></section>
      </div>
      <section v-show="productView === 'products'" class="system-card product-table-card">
        <div class="card-title"><div><h3>商品销售与库存明细</h3><p>销售来自POS，库存来自正式库存系统；比例不等同于标准库存周转率</p></div><span>{{ productsBrands.products.length }} 种</span></div>
        <div class="product-table-wrap management-detail-scroll"><table><thead><tr><th>商品</th><th>品牌 / 品类</th><th>销售件数</th><th>销售额</th><th>当前库存</th><th title="期间销量除以当前库存，不等于库存周转率">期间销量 / 当前库存</th><th>当前库存状态</th></tr></thead><tbody><tr v-for="item in pagedProductDetails" :key="item.productId"><td><strong>{{ item.productName }}</strong><small>{{ item.sku }}{{ item.barcode ? ` · ${item.barcode}` : ' · 无条码' }}</small></td><td><strong>{{ item.brandName }}</strong><small>{{ item.categoryName }}</small></td><td>{{ number(item.unitsSold) }}</td><td>{{ money(item.salesRevenue) }}</td><td>{{ number(item.currentInventory) }}</td><td>{{ item.salesToStockRatio === null ? '—' : number(item.salesToStockRatio) }}</td><td><b :class="['stock-badge', item.stockStatus.toLowerCase()]">{{ STOCK_STATUS_LABEL[item.stockStatus] }}</b></td></tr></tbody></table><p v-if="!productsBrands.products.length" class="system-empty">当前筛选条件没有商品。</p></div>
        <div class="inventory-table-pagination"><span>共 {{ productsBrands.products.length }} 种商品</span><label>每页<select v-model.number="productDetailPageSize"><option :value="50">50</option><option :value="100">100</option></select></label><div><button type="button" :disabled="productDetailPage <= 1" @click="productDetailPage--">上一页</button><b>{{ productDetailPage }} / {{ productDetailPageCount }}</b><button type="button" :disabled="productDetailPage >= productDetailPageCount" @click="productDetailPage++">下一页</button></div></div>
      </section>
    </template>
  </section>
</template>

<style scoped>
/* Shares the ManagementDashboard style scope (see vite.config.ts); page-specific styles go here. */
</style>
