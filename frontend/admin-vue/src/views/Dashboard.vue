<template>
  <!-- 统计卡片 -->
  <div class="stats-section">
    <div class="stats-grid">
      <el-card class="stat-card" v-for="stat in stats" :key="stat.title">
        <div class="stat-header">
          <div class="stat-title">{{ stat.title }}</div>
          <div class="stat-icon" :class="stat.iconClass">
            <el-icon :size="20">
              <component :is="stat.icon" />
            </el-icon>
          </div>
        </div>
        <div class="stat-value">{{ stat.value }}</div>
        <div class="stat-change">
          <span class="change-value" :class="stat.changeClass">{{ stat.changeValue }}</span>
          <span class="change-label">{{ stat.changeLabel }}</span>
        </div>
      </el-card>
    </div>
  </div>
  
  <!-- 数据表格区域 -->
  <div class="tables-section">
    <div class="dashboard-tables">
      <!-- 本周热卖商品 -->
      <div class="table-section main-table">
        <div class="table-header">
          <h3>本周热卖商品</h3>
        </div>
        <div class="table-container">
          <el-table :data="hotProducts" style="width: 100%" v-loading="loading">
            <el-table-column prop="productId" label="产品ID" width="100" />
            <el-table-column prop="name" label="产品名称" min-width="180" />
            <el-table-column prop="weeklySales" label="周销量" width="100" sortable />
            <el-table-column prop="weeklyGMV" label="周GMV" width="120" sortable>
              <template #default="scope">
                ¥{{ scope.row.weeklyGMV }}
              </template>
            </el-table-column>
            <el-table-column prop="category" label="分类" width="100" />
            <el-table-column prop="brand" label="品牌" width="100" />
            <el-table-column label="操作" width="100">
              <template #default="scope">
                <el-button type="primary" size="small" @click="viewProduct(scope.row)">查看</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>
      
      <!-- 侧边表格 -->
      <div class="side-tables">
        <!-- 本周热卖品牌 -->
        <div class="table-section">
          <div class="table-header">
            <h3>本周热卖品牌</h3>
          </div>
          <div class="table-container">
            <el-table :data="hotBrands" style="width: 100%" v-loading="loading">
              <el-table-column prop="brandId" label="品牌ID" width="80" />
              <el-table-column prop="name" label="品牌名称" min-width="120" />
              <el-table-column prop="weeklySales" label="周销量" width="80" sortable />
              <el-table-column prop="weeklyGMV" label="周GMV" width="100" />
            </el-table>
          </div>
        </div>
        
        <!-- 本周热卖分类 -->
        <div class="table-section">
          <div class="table-header">
            <h3>本周热卖分类</h3>
          </div>
          <div class="table-container">
            <el-table :data="hotCategories" style="width: 100%" v-loading="loading">
              <el-table-column prop="categoryId" label="分类ID" width="80" />
              <el-table-column prop="name" label="分类名称" min-width="120" />
              <el-table-column prop="weeklySales" label="周销量" width="80" sortable />
              <el-table-column prop="weeklyGMV" label="周GMV" width="100" />
            </el-table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { ElMessage } from 'element-plus'
import {
  ShoppingCart,
  Money
} from '@element-plus/icons-vue'

const loading = ref(false)
const stats = ref([
  { title: '今日GMV', value: '¥0.00', changeValue: '0.00%', changeLabel: '较昨日', icon: Money, iconClass: 'icon-money' },
  { title: '今日订单', value: '0', changeValue: '0.00%', changeLabel: '较昨日', icon: ShoppingCart, iconClass: 'icon-cart' },
  { title: '本周GMV', value: '¥0.00', changeValue: '0.00%', changeLabel: '较上周', icon: Money, iconClass: 'icon-money' },
  { title: '本周订单', value: '0', changeValue: '0.00%', changeLabel: '较上周', icon: ShoppingCart, iconClass: 'icon-cart' }
])

const hotProducts = ref([])
const hotBrands = ref([])
const hotCategories = ref([])

const loadDashboardData = async () => {
  loading.value = true
  
  // 检查是否已登录
  const token = localStorage.getItem('token')
  if (!token) {
    console.log('未登录，使用模拟数据')
    // 未登录时只显示模拟数据
    hotProducts.value = [
      { productId: 'P001', name: '示例商品1', weeklySales: 100, weeklyGMV: 1000, category: '分类1', brand: '品牌1' },
      { productId: 'P002', name: '示例商品2', weeklySales: 80, weeklyGMV: 800, category: '分类2', brand: '品牌2' },
      { productId: 'P003', name: '示例商品3', weeklySales: 60, weeklyGMV: 600, category: '分类1', brand: '品牌1' },
      { productId: 'P004', name: '示例商品4', weeklySales: 40, weeklyGMV: 400, category: '分类3', brand: '品牌3' },
      { productId: 'P005', name: '示例商品5', weeklySales: 20, weeklyGMV: 200, category: '分类2', brand: '品牌2' }
    ]
    hotBrands.value = [
      { brandId: 'B001', name: '品牌1', weeklySales: 150, weeklyGMV: 1500 },
      { brandId: 'B002', name: '品牌2', weeklySales: 120, weeklyGMV: 1200 },
      { brandId: 'B003', name: '品牌3', weeklySales: 100, weeklyGMV: 1000 }
    ]
    hotCategories.value = [
      { categoryId: 'C001', name: '分类1', weeklySales: 200, weeklyGMV: 2000 },
      { categoryId: 'C002', name: '分类2', weeklySales: 180, weeklyGMV: 1800 },
      { categoryId: 'C003', name: '分类3', weeklySales: 160, weeklyGMV: 1600 }
    ]
    loading.value = false
    return
  }

  try {
    // 已登录时尝试获取真实数据
    const [productsRes, brandsRes, categoriesRes] = await Promise.all([
      axios.get('/api/dashboard/hot-products', {
        headers: { 'Authorization': `Bearer ${token}` }
      }),
      axios.get('/api/dashboard/hot-brands', {
        headers: { 'Authorization': `Bearer ${token}` }
      }),
      axios.get('/api/dashboard/hot-categories', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
    ])

    hotProducts.value = productsRes.data.products || []
    hotBrands.value = brandsRes.data.brands || []
    hotCategories.value = categoriesRes.data.categories || []
  } catch (error) {
    console.log('API请求失败，使用模拟数据:', error.message)
    // API失败时使用模拟数据
    hotProducts.value = [
      { productId: 'P001', name: '示例商品1', weeklySales: 100, weeklyGMV: 1000, category: '分类1', brand: '品牌1' },
      { productId: 'P002', name: '示例商品2', weeklySales: 80, weeklyGMV: 800, category: '分类2', brand: '品牌2' },
      { productId: 'P003', name: '示例商品3', weeklySales: 60, weeklyGMV: 600, category: '分类1', brand: '品牌1' },
      { productId: 'P004', name: '示例商品4', weeklySales: 40, weeklyGMV: 400, category: '分类3', brand: '品牌3' },
      { productId: 'P005', name: '示例商品5', weeklySales: 20, weeklyGMV: 200, category: '分类2', brand: '品牌2' }
    ]
    hotBrands.value = [
      { brandId: 'B001', name: '品牌1', weeklySales: 150, weeklyGMV: 1500 },
      { brandId: 'B002', name: '品牌2', weeklySales: 120, weeklyGMV: 1200 },
      { brandId: 'B003', name: '品牌3', weeklySales: 100, weeklyGMV: 1000 }
    ]
    hotCategories.value = [
      { categoryId: 'C001', name: '分类1', weeklySales: 200, weeklyGMV: 2000 },
      { categoryId: 'C002', name: '分类2', weeklySales: 180, weeklyGMV: 1800 },
      { categoryId: 'C003', name: '分类3', weeklySales: 160, weeklyGMV: 1600 }
    ]
  } finally {
    loading.value = false
  }
}

const viewProduct = (product) => {
  ElMessage.info(`查看商品: ${product.name}`)
}

onMounted(() => {
  loadDashboardData()
})
</script>

<style scoped>
/* 统计卡片区域 - 完全平铺，无边距 */
.stats-section {
  background: white;
  border-radius: 0;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  margin: 0;
  padding: 20px;
  width: 100%;
  box-sizing: border-box;
  flex-shrink: 0;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  width: 100%;
  box-sizing: border-box;
}

.stat-card {
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  background: white;
}

.stat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.stat-title {
  font-size: 14px;
  color: #666;
  font-weight: 500;
}

.stat-icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.icon-money { background-color: #409eff; }
.icon-cart { background-color: #67c23a; }

.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: #333;
  margin-bottom: 5px;
}

.stat-change {
  font-size: 12px;
  color: #999;
}

.change-value {
  font-weight: 600;
  margin-right: 5px;
}

.change-value.positive { color: #67c23a; }
.change-value.negative { color: #f56c6c; }

/* 数据表格区域 - 完全平铺，无边距 */
.tables-section {
  background: white;
  border-radius: 0;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  margin: 0;
  padding: 20px;
  width: 100%;
  box-sizing: border-box;
  flex-shrink: 0;
}

.dashboard-tables {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 20px;
  width: 100%;
  box-sizing: border-box;
}

.table-section {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  overflow: hidden;
  width: 100%;
  box-sizing: border-box;
}

.main-table {
  min-height: 400px;
}

.table-header {
  padding: 15px 20px;
  border-bottom: 1px solid #f0f0f0;
  background: #fafafa;
}

.table-header h3 {
  margin: 0;
  font-size: 16px;
  color: #333;
  font-weight: 600;
}

.table-container {
  padding: 20px;
}

.side-tables {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* 表格样式优化 */
:deep(.el-table) {
  border-radius: 0;
  overflow: hidden;
  width: 100%;
}

:deep(.el-table th) {
  background: #fafafa;
  color: #333;
  font-weight: 600;
}

:deep(.el-table td) {
  padding: 12px 0;
}

:deep(.el-table .cell) {
  padding: 0 12px;
}

/* 按钮样式优化 */
:deep(.el-button) {
  border-radius: 4px;
  font-weight: 500;
}

:deep(.el-button--primary) {
  background: #1890ff;
  border-color: #1890ff;
}

:deep(.el-button--primary:hover) {
  background: #40a9ff;
  border-color: #40a9ff;
}

/* 响应式设计 - 完全平铺 */
@media (max-width: 1200px) {
  .dashboard-tables {
    grid-template-columns: 1fr;
  }
  
  .side-tables {
    flex-direction: row;
  }
  
  .stats-grid {
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  }
}

@media (max-width: 768px) {
  .side-tables {
    flex-direction: column;
  }
  
  .stats-grid {
    grid-template-columns: 1fr;
  }
  
  .table-container {
    padding: 15px;
  }
  
  .table-header {
    padding: 10px 15px;
  }
}
</style>