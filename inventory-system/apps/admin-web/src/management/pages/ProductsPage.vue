<script setup lang="ts">
import CategorySelect from '../components/CategorySelect.vue';
import FilterSheet from '../components/FilterSheet.vue';
import { useManagementContext } from '../useManagementDashboard';

const {
  productView, today, productFrom, productTo, productQuery, productBrand, productCategory, productFunction, productAudience, productTaxonomy, productsBrands,
  productsLoading, productDetailPage, productDetailPageSize, canSection, openDataCenter, STOCK_STATUS_LABEL,
  clearProductFilters, setDateRange, openInventoryAlert, productDetailPageCount, pagedProductDetails, money, number,
  openNativePicker, loadProductsBrands
} = useManagementContext();

function applyDateRange(preset: 'today' | 'week' | 'month') { setDateRange('products', preset); void loadProductsBrands(); }
</script>

<template>
  <section class="products-page">
    <FilterSheet title="商品筛选" :summary="`${productFrom === productTo ? productFrom : `${productFrom} 至 ${productTo}`}${productQuery || productBrand || productCategory || productFunction || productAudience ? ' · 已设商品条件' : ''}`">
    <div class="period-shortcuts" role="group" aria-label="快捷日期"><span>快捷日期</span><button type="button" @click="applyDateRange('today')">今天</button><button type="button" @click="applyDateRange('week')">近7天</button><button type="button" @click="applyDateRange('month')">本月</button><small>日期和下拉选项改动后自动更新；商品搜索、品牌输入后按回车或点“查询”</small></div>
    <form class="product-filter-panel" @submit.prevent="loadProductsBrands">
      <label>开始日期<input v-model="productFrom" type="date" @click="openNativePicker" @change="loadProductsBrands" /></label>
      <label>结束日期<input v-model="productTo" type="date" @click="openNativePicker" @change="loadProductsBrands" /></label>
      <label>商品搜索<input v-model="productQuery" placeholder="名称、SKU或条码" /></label>
      <label>品牌<input v-model="productBrand" placeholder="全部品牌" /></label>
      <label>品类<CategorySelect v-model="productCategory" :taxonomy="productTaxonomy" @change="loadProductsBrands" /></label>
      <label>功效<select v-model="productFunction" @change="loadProductsBrands"><option value="">全部功效</option><optgroup v-for="group in [...new Set((productTaxonomy?.functions ?? []).map((item) => item.group))]" :key="group" :label="group"><option v-for="item in (productTaxonomy?.functions ?? []).filter((entry) => entry.group === group)" :key="item.label" :value="item.label">{{ item.label }}</option></optgroup></select></label>
      <label>人群<select v-model="productAudience" @change="loadProductsBrands"><option value="">全部人群</option><option v-for="item in productTaxonomy?.audiences ?? []" :key="item" :value="item">{{ item }}</option></select></label>
      <button type="submit" :disabled="productsLoading">{{ productsLoading ? '查询中…' : '查询' }}</button><button class="secondary-action" type="button" title="清除商品搜索、品牌、品类、功效和人群" @click="clearProductFilters(); loadProductsBrands()">清除</button>
    </form>
    </FilterSheet>
    <template v-if="productsBrands">
      <div class="product-summary-strip" aria-label="所选条件汇总">
        <span><b>{{ productsBrands.summary.productCount }}</b> 种商品</span>
        <span><b>{{ productsBrands.summary.soldProductCount }}</b> 种有销售 · {{ number(productsBrands.summary.unitsSold) }} 件</span>
        <span>销售额 <b>{{ money(productsBrands.summary.salesRevenue) }}</b></span>
        <span>当前库存 <b>{{ number(productsBrands.summary.currentInventory) }}</b> 件</span>
        <button class="summary-chip out" type="button" title="到库存经营处理" @click="openInventoryAlert('OUT_OF_STOCK')">缺货 <b>{{ productsBrands.summary.outOfStockProducts }}</b> →</button>
        <button class="summary-chip low" type="button" title="到库存经营处理" @click="openInventoryAlert('LOW')">低库存 <b>{{ productsBrands.summary.lowStockProducts }}</b> →</button>
        <small v-if="productsBrands.mappingQuality?.activeItems && productsBrands.mappingQuality.coveragePercent < 99" class="summary-warning">销售明细映射率 {{ productsBrands.mappingQuality.coveragePercent }}%，未映射的销售不计入<button v-if="canSection('system')" type="button" class="text-action" @click="openDataCenter('issues')">查看异常 →</button></small>
      </div>
      <div class="view-switcher" role="group" aria-label="商品分析视图"><button type="button" :aria-pressed="productView === 'products'" @click="productView = 'products'">商品明细</button><button type="button" :aria-pressed="productView === 'brands'" @click="productView = 'brands'">品牌结构</button><button type="button" :aria-pressed="productView === 'categories'" @click="productView = 'categories'">品类结构</button></div>
      <div v-show="productView !== 'products'" class="product-analysis-grid">
        <section v-show="productView === 'brands'" class="system-card product-ranking"><div class="card-title"><div><h3>品牌销售与库存结构</h3><p>销售与当前库存关联</p></div></div><ol v-if="productsBrands.brands.length"><li v-for="(item,index) in productsBrands.brands.slice(0,10)" :key="item.name"><b>{{ index + 1 }}</b><span><strong>{{ item.name }}</strong><small>{{ item.productCount }} 种 · 销售 {{ number(item.unitsSold) }} 件 · 库存 {{ number(item.currentInventory) }} 件</small></span><em>{{ money(item.salesRevenue) }}</em></li></ol><p v-else class="system-empty">暂无品牌数据。</p></section>
        <section v-show="productView === 'categories'" class="system-card product-ranking"><div class="card-title"><div><h3>商品主档品类结构</h3><p>按商品销售额排序</p></div></div><ol v-if="productsBrands.categories.length"><li v-for="(item,index) in productsBrands.categories.slice(0,10)" :key="item.name"><b>{{ index + 1 }}</b><span><strong>{{ item.name }}</strong><small>{{ item.productCount }} 种 · 销售 {{ number(item.unitsSold) }} 件</small></span><em>{{ money(item.salesRevenue) }}</em></li></ol><p v-else class="system-empty">暂无品类数据。</p></section>
      </div>
      <section v-show="productView === 'products'" class="system-card product-table-card">
        <div class="card-title"><div><h3>商品销售与库存明细</h3><p>销售为所选日期内的 POS 销售，库存为当前余额；品类、功效按名称识别，可在“分类与标签 → 品类指定”修改</p></div><span>{{ productsBrands.products.length }} 种</span></div>
        <div class="product-table-wrap management-detail-scroll"><table><thead><tr><th>商品</th><th>品牌 / 品类</th><th>销售件数</th><th>销售额</th><th>当前库存</th><th title="期间销量除以当前库存，不等于库存周转率">期间销量 / 当前库存</th><th>当前库存状态</th></tr></thead><tbody><tr v-for="item in pagedProductDetails" :key="item.productId"><td data-label="商品"><strong>{{ item.productName }}</strong><small>{{ item.sku }}{{ item.barcode ? ` · ${item.barcode}` : ' · 无条码' }}</small></td><td data-label="品牌 / 品类"><strong>{{ item.brandName }}</strong><small>{{ item.categoryName }}{{ item.functions?.length ? ` · ${item.functions.slice(0, 2).join('、')}` : '' }}</small></td><td data-label="销售件数">{{ number(item.unitsSold) }}</td><td data-label="销售额">{{ money(item.salesRevenue) }}</td><td data-label="当前库存">{{ number(item.currentInventory) }}</td><td data-label="期间销量 / 当前库存">{{ item.salesToStockRatio === null ? '—' : number(item.salesToStockRatio) }}</td><td data-label="当前库存状态"><b :class="['stock-badge', item.stockStatus.toLowerCase()]">{{ STOCK_STATUS_LABEL[item.stockStatus] }}</b></td></tr></tbody></table><p v-if="!productsBrands.products.length" class="system-empty">当前筛选条件没有商品。</p></div>
        <div class="inventory-table-pagination"><span>共 {{ productsBrands.products.length }} 种商品</span><label>每页<select v-model.number="productDetailPageSize"><option :value="50">50</option><option :value="100">100</option></select></label><div><button type="button" :disabled="productDetailPage <= 1" @click="productDetailPage--">上一页</button><b>{{ productDetailPage }} / {{ productDetailPageCount }}</b><button type="button" :disabled="productDetailPage >= productDetailPageCount" @click="productDetailPage++">下一页</button></div><button v-if="productDetailPageSize < productsBrands.products.length" class="load-more" type="button" @click="productDetailPageSize += 50">加载更多（{{ productDetailPageSize }} / {{ productsBrands.products.length }}）</button></div>
      </section>
    </template>
  </section>
</template>

<style scoped>
/* Shares the ManagementDashboard style scope (see vite.config.ts); page-specific styles go here. */
/* CR-010: drop-downs line up with the text inputs of the filter panel (light theme colours come from the shared rule). */
.product-filter-panel select{width:100%;min-width:0;min-height:42px;padding:0 11px;border:1px solid #28364c;border-radius:11px;background:#0a1220;color:var(--dash-text);font:inherit}
/* Filters on one line on desktop, compact controls; a slim summary strip replaces the KPI cards. */
@media (min-width: 721px) {
  .decision-workspace .products-page .product-filter-panel { grid-template-columns: repeat(2, minmax(124px, .85fr)) minmax(0, 1.3fr) minmax(0, .9fr) minmax(0, 1.25fr) minmax(0, 1fr) minmax(0, .9fr) auto auto; gap: 8px; padding: 10px 12px; }
  .decision-workspace .products-page .product-filter-panel label { gap: 4px; font-size: 11px; }
  .decision-workspace .products-page .product-filter-panel label { min-width: 0; }
  .decision-workspace .products-page .product-filter-panel :is(input, select) { box-sizing: border-box; width: 100%; min-width: 0; min-height: 34px; padding: 0 9px; border-radius: 9px; font-size: 12px; }
  .decision-workspace .products-page .product-filter-panel > button { align-self: end; min-height: 34px; padding: 0 14px; border-radius: 9px; font-size: 12px; }
  .decision-workspace .products-page .product-filter-panel > .secondary-action { grid-column: auto; justify-self: stretch; }
  .decision-workspace .products-page .period-shortcuts button { min-height: 30px; padding: 4px 10px; }
}
@media (min-width: 721px) and (max-width: 1279px) {
  .decision-workspace .products-page .product-filter-panel { grid-template-columns: repeat(5, minmax(0, 1fr)); }
}
/* Same wrap when the page itself is narrow, e.g. beside the open 阳光小助手 column. */
@container page (max-width: 980px) {
  .decision-workspace .products-page .product-filter-panel { grid-template-columns: repeat(5, minmax(0, 1fr)); }
}
.product-summary-strip { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 18px; padding: 10px 14px; border: 1px solid var(--dash-line); border-radius: 12px; color: #8c9ab0; font-size: 12px; }
.product-summary-strip b { color: var(--dash-text); font-size: 15px; font-variant-numeric: tabular-nums; }
.product-summary-strip .summary-chip { padding: 3px 10px; border: 1px solid #314058; border-radius: 999px; color: inherit; background: transparent; font: inherit; cursor: pointer; }
.product-summary-strip .summary-chip.out b { color: #ff8a8a; }
.product-summary-strip .summary-chip.low b { color: #ffb45c; }
.product-summary-strip .summary-warning { flex-basis: 100%; color: #ffb45c; }
.product-summary-strip .summary-warning .text-action { margin-left: 8px; }
:root:not([data-theme="dark"]) .product-summary-strip { color: #69728d; border-color: #dfddec; background: rgb(255 255 255 / 70%); }
:root:not([data-theme="dark"]) .product-summary-strip b { color: #24314d; }
:root:not([data-theme="dark"]) .product-summary-strip .summary-chip { border-color: #d6dcea; }
@media (max-width: 720px) { .product-summary-strip { gap: 6px 12px; } .product-summary-strip .summary-chip { min-height: 36px; } }
</style>
