<script setup lang="ts">
import { computed } from 'vue';
import MarketArt from './MarketArt.vue';
import { MARKET_MODULES, type MarketModuleId } from './market-types';

// Modules of REQ-014 not built yet: what they will do and what they still need.
type PlannedModule = Exclude<MarketModuleId, 'insights' | 'trends'>;
const props = defineProps<{ id: PlannedModule }>();
const PLANS: Record<PlannedModule, { stage: string; points: string[]; needs: string }> = {
  report: {
    stage: '阶段 2',
    points: ['按周 / 月 / 季度生成：总结、亮点、问题、3–5 条建议', '每条建议注明依据的数字，商品可点开查看', '报告存档，可翻看历史；接口失败时显示上一份', '只使用汇总数字，不含顾客信息；不给价格或折扣'],
    needs: '需要 AI 接口账号（密钥写入运行电脑的配置文件）',
  },
  campaigns: {
    stage: '阶段 3',
    points: ['策划活动：常一起买的组合、热销带滞销', '清货活动：临期、滞销商品，按到期日排序', '趋势活动：对应行业趋势中的某一条', '系统只推荐商品、理由和活动形式；价格与优惠由决策者填写', '活动结束后自动对比活动前后的销量'],
    needs: '基于店铺经营发现，不需要额外账号',
  },
};
const module = computed(() => MARKET_MODULES.find((item) => item.id === props.id)!);
const plan = computed(() => PLANS[props.id]);
</script>

<template>
  <section class="mk-soon" :style="{ '--art-a': module.tint[0], '--art-b': module.tint[1] }">
    <div class="mk-soon-art"><MarketArt :id="id" /></div>
    <div class="mk-soon-body">
      <small>{{ module.english }} · {{ plan.stage }} · 即将上线</small>
      <h3>{{ module.title }}</h3>
      <ul><li v-for="point in plan.points" :key="point">{{ point }}</li></ul>
      <p>{{ plan.needs }}</p>
    </div>
  </section>
</template>

<style scoped>
.mk-soon { display: grid; grid-template-columns: 260px minmax(0, 1fr); align-items: center; gap: 24px; padding: 26px; border: 1px solid rgb(var(--art-a) / 35%); border-radius: 22px; background: linear-gradient(150deg, rgb(var(--art-a) / 12%), var(--mk-panel) 55%); }
.mk-soon-art { height: 190px; }
.mk-soon-body small { color: rgb(var(--art-a)); font-size: 11px; font-weight: 800; letter-spacing: .14em; }
.mk-soon-body h3 { margin: 6px 0 12px; color: var(--mk-ink); font-size: 22px; }
.mk-soon-body ul { display: grid; gap: 8px; margin: 0 0 14px; padding-left: 18px; color: var(--mk-ink); font-size: 13px; line-height: 1.6; }
.mk-soon-body p { margin: 0; padding: 10px 12px; color: var(--mk-muted); border: 1px dashed var(--mk-line); border-radius: 12px; font-size: 12px; }
@media (max-width: 720px) { .mk-soon { grid-template-columns: minmax(0, 1fr); padding: 18px; } .mk-soon-art { height: 120px; } }
</style>
