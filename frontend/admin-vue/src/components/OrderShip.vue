<template>
  <div class="order-ship">
    <!-- 筛选区域 -->
    <div class="filter-section">
      <el-form :model="filterForm" inline>
        <el-form-item label="订单编号">
          <el-input
            v-model="filterForm.orderNumber"
            placeholder="请输入订单编号"
            clearable
            style="width: 200px"
          />
        </el-form-item>
        <el-form-item label="商品编号">
          <el-input
            v-model="filterForm.productNumber"
            placeholder="请输入商品编号"
            clearable
            style="width: 200px"
          />
        </el-form-item>
        <el-form-item label="商品名称">
          <el-input
            v-model="filterForm.productName"
            placeholder="请输入商品名称"
            clearable
            style="width: 200px"
          />
        </el-form-item>
        <el-form-item label="下单时间">
          <el-select
            v-model="filterForm.orderTime"
            placeholder="近7天"
            style="width: 150px"
          >
            <el-option label="今天" value="today" />
            <el-option label="近7天" value="week" />
            <el-option label="近30天" value="month" />
          </el-select>
        </el-form-item>
        <el-form-item label="订单状态">
          <el-select
            v-model="filterForm.orderStatus"
            placeholder="全部"
            style="width: 150px"
          >
            <el-option label="待发货" value="pending" />
            <el-option label="已发货" value="shipped" />
            <el-option label="已完成" value="finished" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="searchOrders">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </div>

    <!-- 批量操作 -->
    <div class="batch-actions">
      <el-button type="primary" @click="batchPrint" :disabled="selectedOrders.length === 0">
        批量打印 ({{ selectedOrders.length }})
      </el-button>
      <el-button type="success" @click="batchShip" :disabled="selectedOrders.length === 0">
        批量发货 ({{ selectedOrders.length }})
      </el-button>
      <el-button type="info" @click="batchExpress" :disabled="selectedOrders.length === 0">
        批量设置快递 ({{ selectedOrders.length }})
      </el-button>
      <el-button type="warning" @click="batchUrgent" :disabled="selectedOrders.length === 0">
        标记紧急 ({{ selectedOrders.length }})
      </el-button>
    </div>

    <!-- 订单统计 -->
    <div class="order-summary">
      <div class="summary-stats">
        <span class="total-count">共 {{ orderStats.total }} 条待发货订单</span>
        <div class="status-counts">
          <span class="status-item pending">待发货: {{ orderStats.pending }}</span>
          <span class="status-item urgent">紧急: {{ orderStats.urgent }}</span>
          <span class="status-item normal">普通: {{ orderStats.normal }}</span>
        </div>
      </div>
    </div>

    <!-- 订单列表 -->
    <div class="orders-container">
      <el-table
        :data="orders"
        v-loading="loading"
        style="width: 100%"
        table-layout="auto"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="55" :selectable="checkSelectable" />
        <el-table-column prop="orderNumber" label="订单编号" min-width="150" />
        <el-table-column prop="orderTime" label="下单时间" min-width="150" />
        <el-table-column prop="buyer" label="买家" min-width="100" />
        <el-table-column prop="productName" label="商品名称" min-width="200" show-overflow-tooltip />
        <el-table-column prop="quantity" label="数量" min-width="80" />
        <el-table-column prop="unitPrice" label="单价" min-width="100">
          <template #default="scope">
            ${{ scope.row.unitPrice }}
          </template>
        </el-table-column>
        <el-table-column prop="totalAmount" label="实付金额" min-width="120">
          <template #default="scope">
            ${{ scope.row.totalAmount }}
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" min-width="100">
          <template #default="scope">
            <el-tag
              :type="getStatusType(scope.row.status)"
              size="small"
            >
              {{ getStatusText(scope.row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="scope">
            <el-button
              v-if="scope.row.status === 'pending'"
              type="primary"
              size="small"
              @click="shipOrder(scope.row)"
            >
              去发货
            </el-button>
            <el-button
              type="info"
              size="small"
              @click="printOrder(scope.row)"
            >
              打印
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 分页 -->
    <div class="pagination-container">
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :page-sizes="[20, 50, 100, 200]"
        :total="totalOrders"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
      />
    </div>

    <!-- 批量设置快递对话框 -->
    <el-dialog
      v-model="expressModalVisible"
      title="批量设置快递"
      width="400px"
    >
      <el-form :model="expressForm" label-width="100px">
        <el-form-item label="快递公司" required>
          <el-input
            v-model="expressForm.company"
            placeholder="请输入快递公司名称"
          />
        </el-form-item>
        <el-form-item label="快递单号">
          <el-input
            v-model="expressForm.trackingNumber"
            placeholder="请输入快递单号（可选）"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="expressModalVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmBatchExpress">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import axios from 'axios'

const loading = ref(false)
const orders = ref([])
const selectedOrders = ref([])
const currentPage = ref(1)
const pageSize = ref(50)
const totalOrders = ref(0)

const filterForm = reactive({
  orderNumber: '',
  productNumber: '',
  productName: '',
  orderTime: '',
  orderStatus: ''
})

const orderStats = reactive({
  total: 156,
  pending: 89,
  urgent: 12,
  normal: 44
})

// 批量设置快递
const expressModalVisible = ref(false)
const expressForm = reactive({
  company: '顺丰速运',
  trackingNumber: ''
})

// 加载订单数据
const loadOrders = async () => {
  loading.value = true
  
  // 检查是否已登录
  const token = localStorage.getItem('token')
  if (!token) {
    console.log('未登录，使用模拟数据')
    loadMockOrders()
    loading.value = false
    return
  }
  
  try {
    // 尝试调用后端API
    const response = await axios.get('/api/orders/ship', {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      params: {
        page: currentPage.value,
        pageSize: pageSize.value,
        ...filterForm
      }
    })
    if (response.data.success) {
      orders.value = response.data.orders || []
      totalOrders.value = response.data.total || 0
    }
  } catch (error) {
    console.warn('Failed to load ship orders, using mock data:', error)
    // 使用模拟数据
    loadMockOrders()
  } finally {
    loading.value = false
  }
}

// 加载模拟订单数据
const loadMockOrders = () => {
  orders.value = [
    {
      id: 1,
      orderNumber: '6347223062',
      orderTime: '2005-07-31 14:01:23',
      buyer: '张三 (ididid)',
      productName: '名称名称名称名称名称名称名称名称名称名称名称名称名称名称',
      quantity: 1,
      unitPrice: 39.54,
      totalAmount: 39.54,
      status: 'pending',
      address: '河南省郑州市金水区人民路...'
    },
    {
      id: 2,
      orderNumber: '6347223064',
      orderTime: '2005-07-31 16:45:12',
      buyer: '王五 (ididid)',
      productName: '名称名称名称名称名称名称名称名称名称名称名称名称名称名称',
      quantity: 3,
      unitPrice: 25.99,
      totalAmount: 77.97,
      status: 'pending',
      address: '上海市浦东新区陆家嘴...'
    }
  ]
  totalOrders.value = 2
}

// 搜索订单
const searchOrders = () => {
  currentPage.value = 1
  loadOrders()
}

// 重置筛选条件
const resetFilters = () => {
  Object.keys(filterForm).forEach(key => {
    filterForm[key] = ''
  })
  searchOrders()
}

// 处理选择变化
const handleSelectionChange = (selection) => {
  selectedOrders.value = selection
}

// 检查行是否可选择
const checkSelectable = (row) => {
  // 只有待发货的订单可以选择
  return row.status === 'pending'
}

// 分页处理
const handleSizeChange = (size) => {
  pageSize.value = size
  loadOrders()
}

const handleCurrentChange = (page) => {
  currentPage.value = page
  loadOrders()
}

// 获取状态类型
const getStatusType = (status) => {
  const statusMap = {
    pending: 'warning',
    shipped: 'primary',
    finished: 'success'
  }
  return statusMap[status] || 'info'
}

// 获取状态文本
const getStatusText = (status) => {
  const statusMap = {
    pending: '待发货',
    shipped: '已发货',
    finished: '已完成'
  }
  return statusMap[status] || status
}

// 发货订单
const shipOrder = async (order) => {
  try {
    await ElMessageBox.confirm(`确定要发货订单 ${order.orderNumber} 吗？`, '确认发货', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    
    // 调用发货API
    try {
      await axios.post(`/api/orders/${order.id}/ship`)
      ElMessage.success('订单已发货！')
      loadOrders()
    } catch (error) {
      // 模拟发货成功
      ElMessage.success('订单已发货！(模拟模式)')
      order.status = 'shipped'
    }
  } catch {
    // 用户取消
  }
}

// 打印订单
const printOrder = (order) => {
  ElMessage.info(`正在打印订单 ${order.orderNumber} 的快递单...`)
}

// 批量发货
const batchShip = async () => {
  if (selectedOrders.value.length === 0) {
    ElMessage.warning('请先选择要发货的订单！')
    return
  }
  
  try {
    await ElMessageBox.confirm(`确定要批量发货 ${selectedOrders.value.length} 个订单吗？`, '确认批量发货', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    
    // 调用批量发货API
    try {
      const orderIds = selectedOrders.value.map(order => order.id)
      await axios.post('/api/orders/batch-ship', { orderIds })
      ElMessage.success(`已批量发货 ${selectedOrders.value.length} 个订单！`)
      loadOrders()
    } catch (error) {
      // 模拟批量发货成功
      ElMessage.success(`已批量发货 ${selectedOrders.value.length} 个订单！(模拟模式)`)
      selectedOrders.value.forEach(order => {
        order.status = 'shipped'
      })
    }
  } catch {
    // 用户取消
  }
}

// 批量打印
const batchPrint = () => {
  if (selectedOrders.value.length === 0) {
    ElMessage.warning('请先选择要打印的订单！')
    return
  }
  
  ElMessage.info(`正在批量打印 ${selectedOrders.value.length} 个订单的快递单...`)
}

// 批量设置快递
const batchExpress = () => {
  if (selectedOrders.value.length === 0) {
    ElMessage.warning('请先选择要设置快递的订单！')
    return
  }
  
  expressModalVisible.value = true
}

// 确认批量设置快递
const confirmBatchExpress = () => {
  if (!expressForm.company) {
    ElMessage.error('请输入快递公司名称！')
    return
  }
  
  ElMessage.success(`正在为 ${selectedOrders.value.length} 个订单设置快递公司：${expressForm.company}`)
  expressModalVisible.value = false
  
  // 重置表单
  expressForm.company = '顺丰速运'
  expressForm.trackingNumber = ''
}

// 标记紧急
const batchUrgent = async () => {
  if (selectedOrders.value.length === 0) {
    ElMessage.warning('请先选择要标记紧急的订单！')
    return
  }
  
  try {
    await ElMessageBox.confirm(`确定要将 ${selectedOrders.value.length} 个订单标记为紧急吗？`, '确认标记紧急', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    
    // 调用标记紧急API
    try {
      const orderIds = selectedOrders.value.map(order => order.id)
      await axios.post('/api/orders/batch-urgent', { orderIds })
      ElMessage.success(`已将 ${selectedOrders.value.length} 个订单标记为紧急！`)
      loadOrders()
    } catch (error) {
      // 模拟标记紧急成功
      ElMessage.success(`已将 ${selectedOrders.value.length} 个订单标记为紧急！(模拟模式)`)
    }
  } catch {
    // 用户取消
  }
}

onMounted(() => {
  loadOrders()
})
</script>

<style scoped>
/* 打单发货页面样式 */
.order-ship {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  overflow: hidden;
}

.filter-section {
  background: white;
  padding: 15px;
  border-radius: 0;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  margin: 0;
  flex-shrink: 0;
}

.batch-actions {
  background: white;
  padding: 15px;
  border-radius: 0;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  margin: 0;
  flex-shrink: 0;
  display: flex;
  gap: 10px;
  align-items: center;
}

.order-summary {
  background: white;
  padding: 15px 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  margin-bottom: 20px;
}

.summary-stats {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.total-count {
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.status-counts {
  display: flex;
  gap: 20px;
}

.status-item {
  font-size: 14px;
  padding: 4px 8px;
  border-radius: 4px;
}

.status-item.pending {
  background: #fff7e6;
  color: #d46b08;
}

.status-item.urgent {
  background: #fff2f0;
  color: #ff4d4f;
}

.status-item.normal {
  background: #f6ffed;
  color: #52c41a;
}

.orders-container {
  background: white;
  border-radius: 0;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  overflow: hidden;
  margin: 0;
  flex: 1;
  min-height: 0;
  width: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.pagination-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 15px;
  background: white;
  border-radius: 0;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  margin: 0;
  flex-shrink: 0;
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .orders-container {
    overflow-x: auto;
  }
  
  :deep(.el-table) {
    min-width: 1000px;
  }
}

@media (max-width: 768px) {
  .batch-actions {
    flex-direction: column;
    gap: 10px;
  }
  
  .batch-actions .el-button {
    width: 100%;
  }
  
  .orders-container {
    overflow-x: auto;
  }
  
  :deep(.el-table) {
    min-width: 800px;
  }
}
</style>
