<script setup lang="ts">
import { computed } from 'vue';

// CR-010: category drop-down grouped by first-level category. A first-level option selects the whole group.
export type ProductTaxonomy = {
  categories: { code: string; level1: string; level2: string }[];
  functions: { group: string; label: string }[];
  audiences: string[];
};
const model = defineModel<string>({ required: true });
const props = defineProps<{ taxonomy: ProductTaxonomy | null; allLabel?: string; groupsSelectable?: boolean }>();
const groups = computed(() => {
  const map = new Map<string, string[]>();
  for (const category of props.taxonomy?.categories ?? []) map.set(category.level1, [...(map.get(category.level1) ?? []), category.level2]);
  return [...map.entries()];
});
</script>

<template>
  <select v-model="model">
    <option value="">{{ allLabel ?? '全部品类' }}</option>
    <optgroup v-for="[level1, level2s] in groups" :key="level1" :label="level1">
      <option v-if="groupsSelectable !== false" :value="level1">{{ level1 }}（全部）</option>
      <option v-for="level2 in level2s" :key="level2" :value="level2">{{ level2 }}</option>
    </optgroup>
  </select>
</template>
