<script setup lang="ts">
// A product's home location (CR-008 F4), shown wherever staff handle the product (scan-in, stock query, expiry list)
// and changeable on the spot by any warehouse user, since shelves get rearranged.
import { ref } from 'vue';

export type ProductLocation = { locationId: string; code: string; name: string };

const props = defineProps<{
  productId: string;
  location: ProductLocation | null | undefined;
  locations?: ProductLocation[];
  request: (path: string, init?: RequestInit) => Promise<any>;
  editable?: boolean;
}>();
const emit = defineEmits<{ changed: [location: ProductLocation | null] }>();

const editing = ref(false);
const choice = ref('');
const options = ref<ProductLocation[]>([]);
const saving = ref(false);
const error = ref('');

async function startEdit() {
  error.value = '';
  choice.value = props.location?.locationId ?? '';
  options.value = props.locations ?? [];
  editing.value = true;
  if (options.value.length) return;
  try {
    const data = await props.request('/inventory/locations');
    options.value = (data.locations ?? []).map((item: ProductLocation) => ({ locationId: item.locationId, code: item.code, name: item.name }));
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '仓位读取失败';
  }
}

async function save() {
  if (saving.value) return;
  saving.value = true;
  error.value = '';
  try {
    const data = await props.request('/inventory/locations/products', {
      method: 'PUT', body: JSON.stringify({ productIds: [props.productId], locationId: choice.value || null }),
    });
    emit('changed', data.location ?? null);
    editing.value = false;
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '仓位保存失败';
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <span class="product-location" :class="{ unplaced: !location }">
    <template v-if="!editing">
      <span class="product-location-label" :title="location?.name">{{ location ? `${location.code} · ${location.name}` : '未放仓位' }}</span>
      <button v-if="editable" class="product-location-edit" type="button" :aria-label="location ? '修改仓位' : '设置仓位'" @click.stop="startEdit">{{ location ? '修改' : '设置' }}</button>
    </template>
    <span v-else class="product-location-editor" @click.stop>
      <select v-model="choice" aria-label="选择仓位">
        <option value="">不放仓位</option>
        <option v-for="option in options" :key="option.locationId" :value="option.locationId">{{ option.code }} · {{ option.name }}</option>
      </select>
      <button class="product-location-save" type="button" :disabled="saving" @click="save">{{ saving ? '保存中' : '保存' }}</button>
      <button class="product-location-cancel" type="button" @click="editing = false">取消</button>
    </span>
    <small v-if="error" class="product-location-error" role="alert">{{ error }}</small>
  </span>
</template>

<style scoped>
.product-location { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 6px; min-width: 0; font-size: 13px; }
.product-location-label { overflow: hidden; padding: 2px 8px; color: #0f6b78; border-radius: 999px; background: rgb(22 127 142 / 12%); font-weight: 600; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
.product-location.unplaced .product-location-label { color: #8a6100; background: rgb(196 122 18 / 14%); }
.product-location-edit, .product-location-save, .product-location-cancel { width: auto; min-width: 0; min-height: 28px; padding: 0 10px; color: inherit; border: 1px solid rgb(127 140 160 / 45%); border-radius: 8px; background: transparent; box-shadow: none; font-size: 12.5px; font-weight: 600; cursor: pointer; }
.product-location-save { color: #fff; border-color: transparent; background: #167f8e; }
.product-location-save:disabled { opacity: 0.6; cursor: default; }
.product-location-editor { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.product-location-editor select { width: auto; min-width: 150px; max-width: 100%; min-height: 32px; padding: 0 8px; border-radius: 8px; font-size: 13px; }
.product-location-error { width: 100%; color: #d64545; font-size: 12px; }
:root[data-theme="dark"] .product-location-label { color: #6fe0e6; background: rgb(60 196 204 / 16%); }
:root[data-theme="dark"] .product-location.unplaced .product-location-label { color: #f3b25b; background: rgb(243 178 91 / 14%); }
</style>
