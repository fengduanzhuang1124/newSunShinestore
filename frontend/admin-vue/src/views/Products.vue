<template>
  <div class="products-page">
    <!-- 子页面切换 -->
    <el-tabs v-model="activeTab" @tab-change="handleTabChange" class="product-tabs">
      <el-tab-pane label="商品列表" name="product-list">
        <ProductList />
      </el-tab-pane>
      <el-tab-pane label="品牌&分类" name="brand-category">
        <BrandCategory />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ProductList from '../components/ProductList.vue'
import BrandCategory from '../components/BrandCategory.vue'

const route = useRoute()
const router = useRouter()
const activeTab = ref('product-list')

const handleTabChange = (tabName) => {
  activeTab.value = tabName
  // 根据标签页切换更新路由
  if (tabName === 'product-list') {
    router.push('/products')
  } else if (tabName === 'brand-category') {
    router.push('/products/brands')
  }
}

// 监听路由变化，更新活动标签页
watch(
  () => route.path,
  (newPath) => {
    if (newPath === '/products/brands') {
      activeTab.value = 'brand-category'
    } else if (newPath === '/products') {
      activeTab.value = 'product-list'
    }
  },
  { immediate: true }
)

onMounted(() => {
  // 根据当前路由设置活动标签页
  if (route.path === '/products/brands') {
    activeTab.value = 'brand-category'
  } else {
    activeTab.value = 'product-list'
  }
})
</script>

<style scoped>
.products-page {
  width: 100%;
  height: 100%;
  padding: 0;
  margin: 0;
  background-color: #f5f5f5;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  overflow: hidden;
}

.product-tabs {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: white;
  border-radius: 0;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  overflow: hidden;
}

:deep(.el-tabs__header) {
  margin: 0;
  background: #fafafa;
  border-bottom: 1px solid #f0f0f0;
  flex-shrink: 0;
}

:deep(.el-tabs__nav-wrap) {
  padding: 0 20px;
}

:deep(.el-tabs__content) {
  padding: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  width: 100%;
  box-sizing: border-box;
  overflow: hidden;
}

:deep(.el-tab-pane) {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  overflow: hidden;
}
</style>