<script setup lang="ts">
import { useManagementContext } from '../useManagementDashboard';

const {
  systemView, posLoadError, overview, foundation, loading, posCheck, posStatus, posReviewLines, posUnlistedStock,
  posReapplyLoading, posReapplyResult, posIssues, barcodeAudit, posLoading, posRunning, posMessage, syncDate,
  reconcile, today, posInventoryFrom, posInventoryTo, posInventoryPreview, posInventoryApplyResult,
  posInventoryPreviewLoading, posInventoryApplyState, managementAccess, canSection, posSyncState, posReadinessLabel,
  realtimeSyncLabel, money, number, dateTime, readinessLabel, domainLabel, openNativePicker, loadOverview,
  runManualSync, posInventoryIssueLabel, previewPosInventory, openPosInventoryConfirmation, reapplyReviewLines,
  exportUnlistedStockExcel
} = useManagementContext();
</script>

<template>
  <section class="pos-management">
    <div class="view-switcher" role="group" aria-label="数据中心视图"><button type="button" :aria-pressed="systemView === 'sync'" @click="systemView = 'sync'">POS 同步</button><button type="button" :aria-pressed="systemView === 'quality'" @click="systemView = 'quality'">数据检查</button><button v-if="managementAccess?.capabilities.posIssues" type="button" :aria-pressed="systemView === 'issues'" @click="systemView = 'issues'">异常记录</button></div>
    <p class="scope-note">“刷新状态”只查询现有数据；只有“开始同步”会读取 POS 订单。</p>
    <p v-if="posMessage" class="management-alert inventory-source"><strong>同步完成</strong><span>{{ posMessage }}</span></p>
    <p class="management-alert pending"><strong>分步处理</strong><span>“开始同步”只读取 POS 订单，不修改库存。需要先生成下方扣库预览，再由管理员明确确认，才会写入正式库存流水。</span></p>



    <section v-if="managementAccess?.capabilities.posSync" v-show="systemView === 'sync'" class="system-card manual-sync-card primary-sync-card">
      <div class="card-title"><div><h3>同步 POS 销售订单</h3><p>选择营业日期，由当前服务器主动读取 POS 接口</p></div><span>不扣减正式库存</span></div>
      <div class="sync-control-row"><div class="primary-sync-controls"><label>营业日期<input v-model="syncDate" type="date" :disabled="posRunning || posStatus?.running" @click="openNativePicker" /></label><button type="button" :disabled="posRunning || posStatus?.running || !syncDate" @click="runManualSync">{{ posRunning ? '正在同步…' : '开始同步' }}</button></div><label class="reconcile-option"><input v-model="reconcile" type="checkbox" :disabled="posRunning || posStatus?.running" /><span><strong>重新核对当天订单</strong><small>仅在退款、取消或状态变化时勾选</small></span></label></div>
    </section>

    <div v-show="systemView === 'sync'" class="pos-status-grid">
      <article><span>同步状态</span><strong :class="posSyncState.tone">{{ posSyncState.label }}</strong><small>最近成功或失败结果见下方记录</small></article>
      <article><span>POS订单</span><strong>{{ posLoading || posLoadError ? '—' : (posCheck?.orders.total ?? '—') }}</strong><small>最近订单：{{ dateTime(posCheck?.orders.lastOrderedAt ?? null) }}</small></article>
      <article><span>商品映射率</span><strong>{{ posLoading || posLoadError || !posCheck ? '—' : `${posCheck.items.mappingCoveragePercent}%` }}</strong><small>{{ posCheck?.items.mapped ?? '—' }} / {{ posCheck?.items.mappable ?? posCheck?.items.total ?? '—' }} 条商品销售明细已关联</small></article>
      <article><span>实时同步</span><strong :class="posStatus?.realtime?.lastError ? 'status-warning' : ''">{{ realtimeSyncLabel }}</strong><small v-if="posLoading || posLoadError || !posStatus?.realtime">状态未知</small><small v-else-if="posStatus.realtime.lastError">{{ posStatus.realtime.lastError }}</small><small v-else-if="posStatus?.realtime?.enabled">上次 {{ dateTime(posStatus.realtime.lastSuccessAt) }}<template v-if="posStatus.realtime.lastApplied"> · 扣减 {{ number(posStatus.realtime.lastApplied.unitsApplied) }} 件</template></small><small v-else>需手动同步与扣库</small></article>
      <article><span>待处理异常</span><strong class="status-warning">{{ posLoading || posLoadError ? '—' : (posCheck?.issues.total ?? '—') }}</strong><small>商品、退款和人工复核事项</small></article>
    </div>

    <section v-if="managementAccess?.capabilities.posSync" v-show="systemView === 'sync'" class="system-card pos-inventory-application-card">
      <div class="card-title"><div><h3>按实际销量扣减正式库存</h3><p>仅处理已付款、无退款、已关联商品的正常销售；按临期优先分配库存批次</p></div><span>预览不会改库存</span></div>
      <form class="pos-inventory-range" @submit.prevent="previewPosInventory"><label>开始日期<input v-model="posInventoryFrom" type="date" :max="posInventoryTo" :disabled="posInventoryPreviewLoading || posInventoryApplyState !== 'idle'" @click="openNativePicker" /></label><label>结束日期<input v-model="posInventoryTo" type="date" :min="posInventoryFrom" :max="today" :disabled="posInventoryPreviewLoading || posInventoryApplyState !== 'idle'" @click="openNativePicker" /></label><button type="submit" :disabled="posInventoryPreviewLoading || posInventoryApplyState !== 'idle' || !posInventoryFrom || !posInventoryTo">{{ posInventoryPreviewLoading ? '生成中…' : '生成扣库预览' }}</button></form>
      <p class="scope-note">系统会自动避开正式库存基准之前的历史销量，单次最多处理 31 天；重复执行不会重复扣减已处理订单。</p>
      <p v-if="posInventoryApplyResult" class="management-alert inventory-source" role="status"><strong>正式扣库完成</strong><span>已处理 {{ posInventoryApplyResult.summary.appliedOrders }} 张订单，共扣减 {{ number(posInventoryApplyResult.summary.unitsApplied) }} 件；{{ posInventoryApplyResult.summary.reviewLines }} 行明细进入复核（缺口 {{ number(posInventoryApplyResult.summary.shortfallUnits) }} 件）。</span></p>
      <template v-if="posInventoryPreview">
        <div class="pos-inventory-preview-summary" aria-label="正式扣库预览结果"><article><span>扫描订单</span><strong>{{ posInventoryPreview.summary.ordersScanned }}</strong><small>所选日期内正常候选</small></article><article class="ready"><span>可安全扣库</span><strong>{{ posInventoryPreview.summary.eligibleOrders }} 张</strong><small>{{ number(posInventoryPreview.summary.unitsPlanned) }} 件商品</small></article><article class="blocked"><span>明细待复核</span><strong>{{ posInventoryPreview.summary.reviewLines }} 行</strong><small>缺口 {{ number(posInventoryPreview.summary.shortfallUnits) }} 件，其余照常扣减</small></article><article><span>待人工复核</span><strong>{{ posInventoryPreview.summary.reviewRequiredOrders }} 张</strong><small>不会进入本次扣库</small></article></div>
        <div class="pos-inventory-commit"><span><strong v-if="posInventoryPreview.summary.eligibleOrders">预览已就绪</strong><strong v-else>暂无可扣订单</strong><small>{{ posInventoryPreview.summary.eligibleOrders ? `确认后将写入 ${posInventoryPreview.summary.eligibleOrders} 张订单的销售出库流水。` : '当前没有待扣订单。' }}</small></span><button type="button" :disabled="!posInventoryPreview.summary.eligibleOrders || posInventoryApplyState !== 'idle'" @click="openPosInventoryConfirmation">确认正式扣库</button></div>
        <details v-if="posInventoryPreview.issues.length" class="pos-inventory-issues"><summary>查看待复核明细（{{ posInventoryPreview.issues.length }}）</summary><div class="management-detail-scroll"><article v-for="issue in posInventoryPreview.issues" :key="`${issue.orderId}-${issue.itemId ?? ''}`"><span><strong>订单 {{ issue.orderNo }}</strong><small v-if="issue.productId">商品 ID {{ issue.productId }}</small></span><em>{{ posInventoryIssueLabel(issue) }}</em></article></div></details>
      </template>
      <p v-else class="pos-inventory-empty">选择日期并生成预览后，系统会列出可以扣减的订单、件数和被拦截原因。这里不会自动写入库存。</p>
    </section>
    <section v-if="managementAccess?.capabilities.posSync" class="system-card pos-unlisted-card">
      <div class="card-title"><div><h3>POS 未建档商品</h3><p>这些商品有库存，但 POS 里还没有，卖出后不会扣库存。请在 POS 用相同条码建档，系统每小时自动关联。</p></div><button v-if="posUnlistedStock?.products.length" class="table-action" type="button" @click="exportUnlistedStockExcel">导出 Excel</button></div>
      <p v-if="posUnlistedStock === null" class="system-empty">{{ posLoading ? '正在读取…' : posLoadError ? '读取失败' : '尚未读取' }}</p>
      <p v-else-if="!posUnlistedStock.products.length" class="system-empty">所有有库存的商品都已在 POS 建档。</p>
      <template v-else><p class="scope-note">{{ posUnlistedStock.products.length }} 种商品，共 {{ number(posUnlistedStock.totalUnits) }} 件库存。</p>
      <div class="product-table-wrap management-detail-scroll"><table><thead><tr><th>商品</th><th>条码</th><th>库存</th></tr></thead><tbody><tr v-for="item in posUnlistedStock.products" :key="item.productId"><td data-label="商品"><strong>{{ item.productName }}</strong><small v-if="item.englishName">{{ item.englishName }}</small></td><td data-label="条码">{{ item.barcodes.join(' / ') || '无条码' }}</td><td data-label="库存">{{ number(item.stock) }}</td></tr></tbody></table></div></template>
    </section>
    <section v-if="managementAccess?.capabilities.posSync" class="system-card pos-review-card">
      <div class="card-title"><div><h3>复核明细</h3><p>已扣库订单中没扣足的销售行。商品映射补齐后系统会自动补扣；库存不足的行需确认货已到再重扣，不会扣成负数。</p></div><button v-if="posReviewLines?.some((line) => line.canReapply)" class="table-action" type="button" :disabled="posReapplyLoading" @click="reapplyReviewLines(posReviewLines!.filter((line) => line.canReapply).map((line) => line.itemId))">重扣全部可扣明细（{{ posReviewLines!.filter((line) => line.canReapply).length }}）</button></div>
      <p v-if="posReapplyResult" class="management-alert inventory-source" role="status"><strong>重新扣减完成</strong><span>补扣 {{ number(posReapplyResult.unitsApplied) }} 件：{{ posReapplyResult.completed }} 行已扣足，{{ posReapplyResult.stillShort }} 行仍有缺口，{{ posReapplyResult.skipped.length }} 行跳过。</span></p>
      <p v-if="posReviewLines === null" class="system-empty">{{ posLoading ? '正在读取…' : posLoadError ? '复核明细读取失败' : '尚未读取' }}</p>
      <p v-else-if="!posReviewLines.length" class="system-empty">没有待复核的销售明细。</p>
      <div v-else class="product-table-wrap management-detail-scroll"><table><thead><tr><th>订单</th><th>商品</th><th>原因</th><th>需扣 / 已扣</th><th>现有库存</th><th>操作</th></tr></thead><tbody><tr v-for="line in posReviewLines" :key="line.itemId"><td data-label="订单"><strong>{{ line.orderNo }}</strong><small>{{ dateTime(line.orderedAt) }}</small></td><td data-label="商品"><strong>{{ line.productName || line.sourceName || '未知商品' }}</strong><small v-if="line.productName && line.sourceName">{{ line.sourceName }}</small></td><td data-label="原因">{{ posInventoryIssueLabel({ orderId: '', orderNo: line.orderNo, reason: line.reason, required: line.required, available: line.applied }) }}</td><td data-label="需扣 / 已扣">{{ number(line.required) }} / {{ number(line.applied) }}</td><td data-label="现有库存">{{ line.productId ? number(line.availableStock) : '—' }}</td><td data-label="操作"><button v-if="line.canReapply" class="table-action" type="button" :disabled="posReapplyLoading" @click="reapplyReviewLines([line.itemId])">重扣</button><span v-else class="muted-task">{{ line.productId ? '无库存' : '未映射' }}</span></td></tr></tbody></table></div>
    </section>

    <section v-if="systemView === 'quality'" class="system-card foundation-check">
      <div class="card-title"><div><h3>正式资料与数据可用情况</h3><p>从经营总览集中到此处；统计基于正式资料，不将名称识别当成已维护资料</p></div><button v-if="canSection('overview')" type="button" class="secondary-action" :disabled="loading" @click="loadOverview">{{ loading ? '检查中…' : '更新资料检查' }}</button></div>
      <template v-if="foundation && canSection('overview')">
        <p class="scope-note">检查快照：{{ dateTime(foundation.generatedAt) }} · 当前库存更新：{{ dateTime(foundation.quality.inventory.latestUpdatedAt) }}</p>
        <div class="quality-metrics">
          <article><span>有正库存 / 启用商品</span><strong>{{ foundation.quality.inventory.productCount }} / {{ foundation.quality.catalog.productCount }} 种</strong></article>
          <article><span>正式品牌字段完整率</span><strong>{{ foundation.quality.catalog.brandCoveragePercent }}%</strong></article>
          <article><span>商品主档品类完整率</span><strong>{{ foundation.quality.catalog.categoryCoveragePercent }}%</strong></article>
          <article><span>售价完整率</span><strong>{{ foundation.quality.catalog.sellingPriceCoveragePercent }}%</strong></article>
          <article><span>条码覆盖（可选）</span><strong>{{ foundation.quality.catalog.barcodeCoveragePercent }}%</strong></article>
          <article><span>最低库存配置覆盖</span><strong>{{ foundation.quality.catalog.minimumStockCoveragePercent }}%</strong></article>
          <article><span>POS 商品关联率</span><strong>{{ foundation.quality.sales.mappingCoveragePercent }}%</strong><small>{{ foundation.quality.sales.mappedOrderItemCount }} / {{ foundation.quality.sales.orderItemCount }} 条销售明细</small></article>
        </div>
        <div class="readiness-list"><div v-for="domain in foundation.domains.filter(item => ['OVERVIEW', 'INVENTORY_OPERATIONS', 'SALES'].includes(item.code))" :key="domain.code"><span>{{ domainLabel(domain.code) }}</span><b :class="domain.status.toLowerCase()">{{ readinessLabel(domain.status) }}</b><small>{{ domain.gaps.join('；') || '当前基础指标可以使用' }}</small></div></div>
        <p class="scope-note">条码不是库存商品的必填条件；无条码商品正常计入库存。品牌榜可以使用名称识别结果，但这里的完整率和品牌筛选依据正式字段。健康需求、人群等标签不自动写入商品主档品类。</p>
      </template>
      <p v-else class="system-empty">{{ canSection('overview') ? '尚未取得资料检查快照，请点击更新资料检查。' : '当前账号没有全店资料检查权限。' }}</p>
    </section>

    <div v-show="systemView === 'quality'" class="pos-system-grid">
      <section v-if="managementAccess?.capabilities.posIssues" class="system-card health-check-card">
        <div class="card-title"><div><h3>数据检查</h3><p>检查时间：{{ dateTime(posCheck?.checkedAt ?? null) }}</p></div><span>{{ posReadinessLabel }}</span></div>
        <ul><li v-for="check in posCheck?.checks ?? []" :key="check.code"><b :class="check.passed ? 'pass' : 'fail'">{{ check.passed ? '✓' : '!' }}</b><span>{{ check.message }}</span></li></ul>
      </section>
    </div>

    <section v-if="managementAccess?.capabilities.posIssues" v-show="systemView === 'issues'" class="system-card issue-card"><p class="scope-note">当前显示接口返回的前 20 条异常；不是全部异常列表。此处仅查看，关联和退款处理仍需按既有流程完成。</p>
      <div class="card-title"><div><h3>异常记录</h3><p>未映射商品、需复核商品与待处理退款</p></div><span>{{ posIssues?.summary.itemIssues ?? 0 }} 项商品 · {{ posIssues?.summary.pendingRefunds ?? 0 }} 笔退款</span></div>
      <section v-if="barcodeAudit" class="barcode-audit-panel">
        <header><span><b>条码映射审计</b><small>只列出需人工定义的条码，系统不会自动合并商品</small></span><em>{{ dateTime(barcodeAudit.generatedAt) }}</em></header>
        <div class="barcode-audit-summary"><article><span>POS重复条码</span><strong>{{ barcodeAudit.summary.duplicateBarcodes }}</strong></article><article><span>名称冲突</span><strong>{{ barcodeAudit.summary.duplicateNameConflicts }}</strong></article><article><span>本地映射不一致</span><strong>{{ barcodeAudit.summary.localBarcodeMismatches }}</strong></article><article><span>未映射条码</span><strong>{{ barcodeAudit.summary.unmappedBarcodes }}</strong></article></div>
        <div class="barcode-audit-scroll">
          <article v-for="row in barcodeAudit.duplicateBarcodes" :key="`duplicate-${row.barcode}`" class="barcode-audit-row"><span><b>{{ row.barcode }}</b><small>{{ row.externalProductCount }} 个 POS 商品{{ row.nameConflict ? ' · 名称冲突' : '' }}</small></span><div><p v-for="mapping in row.mappings" :key="mapping.externalProductId"><strong>{{ mapping.sourceName || '未命名 POS 商品' }}</strong><small>{{ mapping.externalProductId }} → {{ mapping.productName }}{{ mapping.productId ? ` (${mapping.productId})` : '' }}</small></p></div></article>
          <article v-for="row in barcodeAudit.localBarcodeMismatches" :key="`mismatch-${row.externalProductId}`" class="barcode-audit-row warning"><span><b>{{ row.barcode }}</b><small>映射与本地主条码不一致</small></span><div><p><strong>{{ row.sourceName || '未命名 POS 商品' }}</strong><small>{{ row.externalProductId }} → {{ row.productName }} · 本地条码 {{ row.productBarcodes.join('、') || '无' }}</small></p></div></article>
          <article v-for="row in barcodeAudit.unmappedBarcodes" :key="`unmapped-${row.barcode}`" class="barcode-audit-row unresolved"><span><b>{{ row.barcode }}</b><small>{{ row.occurrences }} 次 · {{ number(row.units) }} 件 · 待定义</small></span><div><p v-for="product in row.products" :key="product.externalProductId"><strong>{{ product.sourceName || '未命名 POS 商品' }}</strong><small>{{ product.externalProductId }}</small></p></div></article>
          <p v-if="!barcodeAudit.duplicateBarcodes.length && !barcodeAudit.localBarcodeMismatches.length && !barcodeAudit.unmappedBarcodes.length" class="system-empty">当前没有发现条码映射异常。</p>
        </div>
      </section>
      <div class="issue-table-wrap management-detail-scroll">
        <table v-if="posIssues?.itemIssues.items.length"><thead><tr><th>订单</th><th>时间</th><th>POS商品</th><th>数量</th><th>类型</th><th>原因</th></tr></thead><tbody><tr v-for="item in posIssues.itemIssues.items" :key="item.id"><td data-label="订单">{{ item.orderNo }}</td><td data-label="时间">{{ dateTime(item.orderedAt) }}</td><td data-label="POS商品"><strong>{{ item.productName || '未命名商品' }}</strong><small>{{ item.externalProductId }}{{ item.barcode ? ` · ${item.barcode}` : '' }}</small></td><td data-label="数量">{{ item.quantity }}</td><td data-label="类型">{{ item.disposition === 'UNMAPPED' ? '未映射' : '需复核' }}</td><td data-label="原因">{{ item.reason || '—' }}</td></tr></tbody></table>
        <p v-else class="system-empty">{{ posLoading ? '正在加载异常记录…' : posLoadError || !posIssues ? '尚未取得异常记录，不能判断是否存在异常。' : '当前没有未映射或需复核的销售商品。' }}</p>
      </div>
      <div v-if="posIssues?.pendingRefunds.items.length" class="refund-list management-detail-scroll"><article v-for="refund in posIssues.pendingRefunds.items" :key="refund.id"><strong>订单 {{ refund.orderNo }}</strong><span>退款 {{ money(Number(refund.amount)) }}</span><small>{{ refund.reason }}</small></article></div>
    </section>

    <section v-if="managementAccess?.capabilities.posSync" v-show="systemView === 'sync'" class="system-card history-card">
      <div class="card-title"><div><h3>最近同步历史</h3><p>保留最近20次运行结果</p></div><span title="同步游标对应的来源订单时间，不代表该期间数据已全部同步">最近来源时间：{{ dateTime(posStatus?.cursor?.lastSourceTimestamp ?? null) }}</span></div>
      <div class="sync-history management-detail-scroll" v-if="posStatus?.history.length"><article v-for="run in posStatus.history" :key="run.id"><b :class="run.status.toLowerCase()">{{ run.status === 'SUCCEEDED' ? '成功' : run.status === 'FAILED' ? '失败' : '运行中' }}</b><span><strong>{{ run.requestedFrom || '未指定日期' }}</strong><small>{{ dateTime(run.startedAt) }} · 订单 {{ run.ordersObserved }} · 明细 {{ run.itemsObserved }} · 异常 {{ run.exceptionsCount }}</small></span><em>{{ run.errorMessage || `新增 ${run.ordersInserted}，更新 ${run.ordersUpdated}，跳过 ${run.ordersSkipped}` }}</em></article></div>
      <p v-else class="system-empty">{{ posLoading ? '正在加载同步记录…' : posLoadError || !posStatus ? '同步记录未获取，请重试。' : '尚无POS同步运行记录。' }}</p>
    </section>
    <details v-if="managementAccess" class="system-card access-summary-card"><summary>当前账号权限（仅展示）</summary><div class="card-title"><div><h3>当前账号经营权限</h3><p>{{ managementAccess.administrator ? '管理员自动拥有全部经营权限' : `角色：${managementAccess.roleCodes.join('、')}` }}</p></div><span>{{ managementAccess.grantedPermissionCodes.length }} 项</span></div><div class="access-capabilities"><b :class="{ granted: managementAccess.capabilities.overviewView }">经营总览</b><b :class="{ granted: managementAccess.capabilities.salesView }">销售与商品</b><b :class="{ granted: managementAccess.capabilities.inventoryView }">库存经营</b><b :class="{ granted: managementAccess.capabilities.posSync }">POS同步</b><b :class="{ granted: managementAccess.capabilities.posIssues }">异常记录</b><b :class="{ granted: managementAccess.capabilities.permissionsManage }">权限管理</b></div></details>
  </section>
</template>

<style scoped>
/* Shares the ManagementDashboard style scope (see vite.config.ts); page-specific styles go here. */
</style>
