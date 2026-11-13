<script setup lang="ts">
import type { AssistantFacts, AssistantPick } from './useSunshineAssistant';

// What the suggested reply is based on, for staff only: every expiry date with its quantity, prices and notes.
// Customers are only ever told "有货" and the oldest date.
defineProps<{ facts: AssistantFacts }>();
defineEmits<{ pick: [candidate: AssistantPick] }>();

const LINE = { NORMAL: '普通线', EXPRESS: '顺丰线' } as const;
const money = (cents: number | null) => (cents === null ? '未设置' : `${(cents / 100).toFixed(2).replace(/\.?0+$/, '')} 纽币`);
</script>

<template>
  <details class="sa-facts" open>
    <summary>客服参考<small>仅自己可见，不要发给客户</small></summary>
    <dl v-if="facts.store" class="sa-store">
      <div><dt>商品</dt><dd>{{ facts.store.name }}</dd></div>
      <div><dt>零售价</dt><dd>{{ money(facts.store.priceCents) }}</dd></div>
      <div><dt>库存合计</dt><dd>{{ facts.store.totalQuantity }}</dd></div>
      <div><dt>各日期库存</dt>
        <dd v-if="facts.store.batches.length"><span v-for="batch in facts.store.batches" :key="batch.expiryDate">{{ batch.label }}（{{ batch.expiryDate }}）× {{ batch.quantity }}</span></dd>
        <dd v-else>没有库存</dd>
      </div>
    </dl>
    <table v-if="facts.mail?.length" class="sa-mail">
      <thead><tr><th>线路</th><th>包装</th><th>价格</th><th>时效</th><th>发货</th></tr></thead>
      <tbody>
        <tr v-for="row in facts.mail" :key="row.productId" :class="{ off: row.outOfStock }">
          <td>{{ LINE[row.line] }}</td>
          <td>{{ row.packCount }}{{ row.packUnit }}</td>
          <td>{{ row.outOfStock ? '断货' : money(row.priceCents) }}<small v-if="row.promoDiscountCents">{{ row.promoText }}</small></td>
          <td>{{ row.transitText }}</td>
          <td>{{ row.shipFrom }}</td>
        </tr>
      </tbody>
    </table>
    <div v-if="facts.candidates.length" class="sa-candidates">
      <span>可能是：</span>
      <button v-for="candidate in facts.candidates" :key="candidate.productId" type="button" @click="$emit('pick', { productId: candidate.productId, name: candidate.name })">
        {{ candidate.name }}<small>{{ candidate.kind === 'mail' ? '邮寄' : '店内' }}</small>
      </button>
    </div>
    <p v-else-if="facts.kind === 'none' && !facts.answers.length" class="sa-muted">没有找到对应商品。可以补充品牌、段数，或在设置里添加客人的叫法。</p>
    <p v-if="facts.answers.length" class="sa-muted">用到的固定回复：{{ facts.answers.join('、') }}</p>
    <ul v-if="facts.notes.length" class="sa-notes"><li v-for="note in facts.notes" :key="note">{{ note }}</li></ul>
  </details>
</template>

<style scoped>
.sa-facts { padding: 8px 11px; color: var(--sa-muted); border: 1px solid var(--sa-line); border-radius: 12px; background: rgb(255 255 255 / 3%); font-size: 12px; line-height: 1.6; }
.sa-facts summary { display: flex; align-items: baseline; gap: 8px; color: var(--sa-ink); font-weight: 600; cursor: pointer; }
.sa-facts summary small { color: var(--sa-muted); font-weight: 400; }
.sa-store { display: grid; gap: 4px; margin: 8px 0 0; }
.sa-store div { display: grid; grid-template-columns: 72px minmax(0, 1fr); gap: 8px; }
.sa-store dt { color: var(--sa-muted); }
.sa-store dd { display: grid; margin: 0; color: var(--sa-ink); overflow-wrap: anywhere; }
.sa-mail { width: 100%; margin-top: 8px; border-collapse: collapse; }
.sa-mail th, .sa-mail td { padding: 4px 6px 4px 0; text-align: left; vertical-align: top; }
.sa-mail th { font-weight: 500; }
.sa-mail td { color: var(--sa-ink); }
.sa-mail td small { display: block; color: #ffb35c; }
.sa-mail tr.off td { color: var(--sa-muted); text-decoration: line-through; }
.sa-candidates { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 8px; }
.sa-panel .sa-candidates button { min-height: 0; padding: 4px 10px; color: var(--sa-ink); border: 1px solid var(--sa-line); border-radius: 999px; background: rgb(255 255 255 / 5%); box-shadow: none; font: inherit; cursor: pointer; }
.sa-candidates button small { margin-left: 4px; color: var(--sa-muted); }
.sa-muted { margin: 8px 0 0; }
.sa-notes { margin: 8px 0 0; padding-left: 18px; color: #ffb35c; }
</style>
