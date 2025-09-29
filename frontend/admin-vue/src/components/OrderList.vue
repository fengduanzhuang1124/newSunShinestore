<template>
  <!-- 状态分类标签页 -->
  <div class="status-tabs">
      <div class="tab-container">
        <div 
          v-for="tab in statusTabs" 
          :key="tab.value"
          :class="['status-tab', { active: activeStatusTab === tab.value }]"
          @click="handleStatusTabChange(tab.value)"
        >
          {{ tab.label }}
          <span v-if="tab.count" class="tab-count">({{ tab.count }})</span>
        </div>
      </div>
    </div>

    <!-- 搜索和筛选区域 -->
    <div class="search-filter-section">
      <div class="search-row">
        <div class="search-input-container">
          <el-input
            v-model="searchKeyword"
            placeholder="请输入名称或其他关键字搜索..."
            clearable
            class="search-input"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
        </div>
        <el-button type="primary" @click="handleSearch">筛选</el-button>
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          format="MM.dd"
          value-format="MM.dd"
          class="date-picker"
        />
        <el-button type="info" @click="handleDownload">下载</el-button>
      </div>
    </div>

    <!-- 高级筛选区域 -->
    <div class="advanced-filter-section" v-show="showAdvancedFilter">
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
        <el-form-item>
          <el-button type="primary" @click="searchOrders">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </div>

    <!-- 订单统计 -->
    <div class="order-summary">
      <div class="summary-stats">
        <span class="total-count">共 {{ orderStats.total }} 条订单</span>
        <div class="status-counts">
          <span class="status-item pending">待发货: {{ orderStats.pending }}</span>
          <span class="status-item shipped">已发货: {{ orderStats.shipped }}</span>
          <span class="status-item completed">已完成: {{ orderStats.completed }}</span>
          <span class="status-item cancelled">已取消: {{ orderStats.cancelled }}</span>
        </div>
      </div>
    </div>

    <!-- 订单列表 -->
    <div class="orders-container">
      <el-table
        :data="filteredOrders"
        v-loading="loading"
        style="width: 100%"
        table-layout="fixed"
        border
        resizable
        @selection-change="handleSelectionChange"
        @sort-change="handleSortChange"
      >
        <el-table-column type="selection" width="50" :selectable="checkSelectable" />
        <el-table-column prop="productName" label="订单" width="250" sortable="custom" show-overflow-tooltip>
          <template #default="scope">
            <div class="order-info">
              <div class="product-name">{{ scope.row.productName }}</div>
              <div class="order-id">#{{ scope.row.orderNumber }}</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="orderTime" label="日期" width="150" sortable="custom" show-overflow-tooltip>
          <template #default="scope">
            {{ formatDate(scope.row.orderTime) }}
          </template>
        </el-table-column>
        <el-table-column prop="buyer" label="买家" width="120" sortable="custom" show-overflow-tooltip>
          <template #default="scope">
            {{ scope.row.buyer }}
          </template>
        </el-table-column>
        <el-table-column prop="paymentStatus" label="支付状态" width="130" sortable="custom" show-overflow-tooltip>
          <template #default="scope">
            <el-tag
              :type="getPaymentStatusType(scope.row.paymentStatus)"
              size="small"
            >
              {{ getPaymentStatusText(scope.row.paymentStatus) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="130" sortable="custom" show-overflow-tooltip>
          <template #default="scope">
            <el-tag
              :type="getStatusType(scope.row.status)"
              size="small"
            >
              {{ getStatusText(scope.row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="totalAmount" label="价格" width="120" sortable="custom" show-overflow-tooltip>
          <template #default="scope">
            <span class="price">¥{{ scope.row.totalAmount }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="250" fixed="right">
          <template #default="scope">
            <div class="action-buttons">
              <el-button
                v-if="scope.row.status === 'pending'"
                type="primary"
                size="small"
                @click="shipOrder(scope.row)"
              >
                去发货
              </el-button>
              <el-button
                v-if="scope.row.status === 'pending'"
                type="warning"
                size="small"
                @click="editProductWeight(scope.row)"
              >
                修改重量
              </el-button>
              <el-button
                v-if="scope.row.status === 'shipped'"
                type="info"
                size="small"
                @click="viewLogistics(scope.row)"
              >
                查看物流
              </el-button>
              <el-button
                v-if="scope.row.status === 'shipped'"
                type="warning"
                size="small"
                @click="modifyLogistics(scope.row)"
              >
                修改物流
              </el-button>
              <el-dropdown trigger="click">
                <el-button type="text" size="small">
                  更多<el-icon><ArrowDown /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item @click="refundOrder(scope.row)">订单退款</el-dropdown-item>
                    <el-dropdown-item @click="modifyOrder(scope.row)">修改订单信息</el-dropdown-item>
                    <el-dropdown-item @click="viewOrderDetails(scope.row)">订单详情</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 分页 -->
    <div class="pagination-container">
      <div class="pagination-left">
        <span class="results-info">显示结果: {{ pageSize }}</span>
      </div>
      <div class="pagination-right">
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
    </div>

    <!-- 订单详情模态框 -->
    <el-dialog
      v-model="orderDetailModalVisible"
      title="订单详情"
      width="70%"
      class="order-detail-dialog"
      @close="closeOrderDetailModal"
    >
      <div v-if="currentOrderDetail" class="order-detail-container">
        <!-- 顶部操作栏 -->
        <div class="od-topbar">
          <div class="od-title">
            <el-icon><ShoppingCart /></el-icon>
            <span>订单详情</span>
          </div>
          <div class="od-actions">
            <el-button type="primary" class="print-btn">
              <el-icon><Printer /></el-icon>
              打印订单
            </el-button>
          </div>
        </div>

        <!-- 主要内容区域 -->
        <div class="od-main-content">
          <!-- 左侧：订单状态和商品信息 -->
          <div class="od-left-column">
            <!-- 待发货状态 -->
            <div class="od-status-section">
              <div class="od-status-header">
                <div class="od-status-icon pending">
                  <el-icon><Box /></el-icon>
                </div>
                <div class="od-status-text">
                  <h3>待发货</h3>
                  <p>订单已确认，等待发货</p>
                </div>
              </div>
              
              <!-- 商品信息 -->
              <div class="od-product-info">
                <div class="od-product-image">
                  <img :src="currentOrderDetail.productImage || '/default-product.jpg'" alt="商品图片" />
                </div>
                <div class="od-product-details">
                  <h4>{{ currentOrderDetail.productName }}</h4>
                  <p class="od-product-id">ID: {{ currentOrderDetail.orderNumber }}</p>
                  <p class="od-product-price">¥{{ currentOrderDetail.unitPrice }}</p>
                  <p class="od-product-quantity">数量: {{ currentOrderDetail.quantity }}</p>
                </div>
              </div>
              
              <!-- 操作按钮 -->
              <div class="od-action-buttons">
                <el-button class="complete-btn" @click="markAsCompleted">
                  <el-icon><Check /></el-icon>
                  标记为已完成
                </el-button>
                <el-button type="primary" class="ship-btn" @click="goToShip">
                  <el-icon><Truck /></el-icon>
                  现在去发货
                </el-button>
              </div>
            </div>

            <!-- 支付状态 -->
            <div class="od-payment-section">
              <div class="od-payment-header">
                <div class="od-payment-icon paid">
                  <el-icon><Check /></el-icon>
                </div>
                <div class="od-payment-text">
                  <h3>已支付</h3>
                </div>
              </div>
              
              <!-- 支付详情 -->
              <div class="od-payment-details">
                <div class="od-payment-item">
                  <span class="od-payment-label">小计</span>
                  <span class="od-payment-value">{{ currentOrderDetail.quantity }} 项目，¥{{ currentOrderDetail.unitPrice }}</span>
                </div>
                <div class="od-payment-item">
                  <span class="od-payment-label">物流</span>
                  <span class="od-payment-value">中通快递 ({{ currentOrderDetail.weight }}kg)，¥{{ currentOrderDetail.shippingFee }}</span>
                </div>
                <div class="od-payment-item">
                  <span class="od-payment-label">优惠</span>
                  <span class="od-payment-value">满100-10，- ¥10.00</span>
                </div>
                <div class="od-payment-item total">
                  <span class="od-payment-label">总计</span>
                  <span class="od-payment-value">¥{{ currentOrderDetail.totalAmount }}</span>
                </div>
                <div class="od-payment-item buyer-paid">
                  <span class="od-payment-label">买家已支付</span>
                  <span class="od-payment-value">¥{{ currentOrderDetail.totalAmount }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 右侧：买家信息 -->
          <div class="od-right-column">
            <!-- 买家信息 -->
            <div class="od-buyer-section">
              <div class="od-buyer-header">
                <div class="od-buyer-avatar">
                  <img src="/default-avatar.jpg" alt="买家头像" />
                </div>
                <div class="od-buyer-info">
                  <h4>{{ currentOrderDetail.buyer }}</h4>
                  <p>在我店铺的订单 10</p>
                </div>
                <el-icon class="od-buyer-icon"><Message /></el-icon>
              </div>
            </div>

            <!-- 联系信息 -->
            <div class="od-contact-section">
              <div class="od-section-header">
                <h4>联系信息</h4>
                <el-button type="text" class="edit-btn">编辑</el-button>
              </div>
              <div class="od-contact-item">
                <el-icon><Message /></el-icon>
                <span>bututousucai@qq.com</span>
              </div>
              <div class="od-contact-item">
                <el-icon><Phone /></el-icon>
                <span>15800000000</span>
              </div>
            </div>

            <!-- 收货地址 -->
            <div class="od-address-section">
              <div class="od-section-header">
                <h4>收货地址</h4>
                <el-button type="text" class="edit-btn">编辑</el-button>
              </div>
              <div class="od-address-item">
                <el-icon><Location /></el-icon>
                <span>{{ currentOrderDetail.address }}</span>
              </div>
            </div>

            <!-- 账单地址 -->
            <div class="od-billing-section">
              <div class="od-section-header">
                <h4>账单地址</h4>
                <el-button type="text" class="edit-btn">编辑</el-button>
              </div>
              <div class="od-billing-item">
                <el-icon><Location /></el-icon>
                <span>与收货地址相同</span>
              </div>
            </div>

            <!-- 备注 -->
            <div class="od-notes-section">
              <div class="od-section-header">
                <h4>备注</h4>
                <el-button type="text" class="edit-btn">编辑</el-button>
              </div>
              <div class="od-notes-item">
                <span>买家暂无备注</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </el-dialog>

    <!-- 修改订单信息模态框 -->
    <el-dialog
      v-model="editOrderModalVisible"
      title="修改订单信息"
      width="600px"
      @close="closeEditOrderModal"
    >
      <el-form :model="editOrderForm" label-width="100px" v-if="currentOrderDetail">
        <el-form-item label="买家姓名">
          <el-input v-model="editOrderForm.buyer" />
        </el-form-item>
        <el-form-item label="收货地址">
          <el-input v-model="editOrderForm.address" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="联系电话">
          <el-input v-model="editOrderForm.phone" />
        </el-form-item>
        <el-form-item label="商品数量">
          <el-input-number v-model="editOrderForm.quantity" :min="1" :max="999" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="editOrderForm.remark" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="closeEditOrderModal">取消</el-button>
        <el-button type="primary" @click="saveOrderInfo">保存</el-button>
      </template>
    </el-dialog>

    <!-- 订单退款模态框 -->
    <el-dialog
      v-model="refundModalVisible"
      title="订单退款"
      width="500px"
      @close="closeRefundModal"
    >
      <el-form :model="refundForm" label-width="100px" v-if="currentOrderDetail">
        <el-form-item label="订单编号">
          <el-input v-model="currentOrderDetail.orderNumber" readonly />
        </el-form-item>
        <el-form-item label="退款金额">
          <el-input v-model="refundForm.amount" type="number" :max="currentOrderDetail.totalAmount">
            <template #append>元</template>
          </el-input>
        </el-form-item>
        <el-form-item label="退款原因" required>
          <el-select v-model="refundForm.reason" placeholder="请选择退款原因">
            <el-option label="商品质量问题" value="quality" />
            <el-option label="发错商品" value="wrong_item" />
            <el-option label="客户要求" value="customer_request" />
            <el-option label="物流问题" value="shipping" />
            <el-option label="其他" value="other" />
          </el-select>
        </el-form-item>
        <el-form-item label="退款说明">
          <el-input v-model="refundForm.description" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="closeRefundModal">取消</el-button>
        <el-button type="primary" @click="submitRefund">确认退款</el-button>
      </template>
    </el-dialog>

    <!-- 修改重量模态框 -->
    <el-dialog
      v-model="weightModalVisible"
      title="修改商品重量"
      width="500px"
      @close="closeWeightModal"
    >
      <el-form :model="weightForm" label-width="120px">
        <el-form-item label="商品名称">
          <el-input v-model="weightForm.productName" readonly />
        </el-form-item>
        <el-form-item label="当前重量">
          <el-input v-model="weightForm.currentWeight" readonly />
        </el-form-item>
        <el-form-item label="新重量 (kg)" required>
          <el-input-number
            v-model="weightForm.newWeight"
            :min="0"
            :max="999.99"
            :precision="2"
            :step="0.01"
            style="width: 200px"
          />
        </el-form-item>
        <el-form-item label="配送地区" required>
          <el-select v-model="weightForm.region" style="width: 200px">
            <el-option label="中国大陆" value="mainland" />
            <el-option label="新西兰本地 (免邮)" value="nz" />
            <el-option label="澳洲奶粉 (免邮)" value="au" />
            <el-option label="偏远地区 (+$10)" value="remote" />
            <el-option label="Taopu品牌 (+$20)" value="taopu" />
          </el-select>
        </el-form-item>
        <el-form-item label="商品数量" required>
          <el-input-number
            v-model="weightForm.quantity"
            :min="1"
            :max="999"
            style="width: 200px"
          />
        </el-form-item>
        <el-form-item label="总重量">
          <span class="weight-display">{{ totalWeight }}kg</span>
        </el-form-item>
        <el-form-item label="运费">
          <span class="shipping-fee-display">${{ calculatedShippingFee }}</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="closeWeightModal">取消</el-button>
        <el-button type="primary" @click="saveProductWeight">保存</el-button>
      </template>
    </el-dialog>
</template>

<script setup>
import { ref, reactive, computed, onMounted, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowDown, Search } from '@element-plus/icons-vue'
import axios from 'axios'

const loading = ref(false)
const orders = ref([])
const selectedOrders = ref([])
const currentPage = ref(1)
const pageSize = ref(50)
const totalOrders = ref(0)

// 状态分类标签页
const activeStatusTab = ref('all')
const statusTabs = ref([
  { label: '全部订单', value: 'all', count: 234 },
  { label: '待付款', value: 'unpaid', count: 12 },
  { label: '待发货', value: 'pending', count: 89 },
  { label: '已发货', value: 'shipped', count: 98 },
  { label: '退款中', value: 'refunding', count: 5 },
  { label: '已完成', value: 'completed', count: 45 }
])

// 搜索和筛选
const searchKeyword = ref('')
const dateRange = ref(['05.11', '05.24'])
const showAdvancedFilter = ref(false)

const filterForm = reactive({
  orderNumber: '',
  productNumber: '',
  productName: '',
  orderTime: '',
  orderStatus: ''
})

const orderStats = reactive({
  total: 234,
  pending: 89,
  shipped: 98,
  completed: 45,
  cancelled: 2
})

// 计算过滤后的订单
const filteredOrders = computed(() => {
  let filtered = orders.value

  // 按状态筛选
  if (activeStatusTab.value !== 'all') {
    filtered = filtered.filter(order => {
      switch (activeStatusTab.value) {
        case 'unpaid':
          return order.paymentStatus === 'unpaid'
        case 'pending':
          return order.status === 'pending'
        case 'shipped':
          return order.status === 'shipped'
        case 'refunding':
          return order.status === 'refunding'
        case 'completed':
          return order.status === 'completed'
        default:
          return true
      }
    })
  }

  // 按关键词搜索
  if (searchKeyword.value) {
    const keyword = searchKeyword.value.toLowerCase()
    filtered = filtered.filter(order => 
      order.productName.toLowerCase().includes(keyword) ||
      order.orderNumber.toLowerCase().includes(keyword) ||
      order.buyer.toLowerCase().includes(keyword)
    )
  }

  return filtered
})

// 订单详情模态框
const orderDetailModalVisible = ref(false)
const currentOrderDetail = ref(null)

// 修改订单信息模态框
const editOrderModalVisible = ref(false)
const editOrderForm = reactive({
  buyer: '',
  address: '',
  phone: '',
  quantity: 1,
  remark: ''
})

// 订单退款模态框
const refundModalVisible = ref(false)
const refundForm = reactive({
  amount: 0,
  reason: '',
  description: ''
})

// 修改重量模态框
const weightModalVisible = ref(false)
const currentOrder = ref(null)
const weightForm = reactive({
  productName: '',
  currentWeight: '',
  newWeight: 0,
  region: 'mainland',
  quantity: 1
})

// 计算总重量
const totalWeight = computed(() => {
  return (weightForm.newWeight * weightForm.quantity).toFixed(2)
})

// 计算运费
const calculatedShippingFee = computed(() => {
  return getShippingFeeByRegion(
    weightForm.region,
    weightForm.newWeight * weightForm.quantity,
    '',
    '',
    0
  ).toFixed(2)
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
    const response = await axios.get('/api/orders', {
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
    console.warn('Failed to load orders, using mock data:', error)
    // 使用模拟数据
    loadMockOrders()
  } finally {
    loading.value = false
  }
}

// 加载模拟订单数据
const loadMockOrders = () => {
  const mockOrders = []
  const products = [
    '黑色连衣裙', '棕色西装外套', '基础连帽衫—红色', '基础款T恤-棕色', 
    '花色衬衫', '蓝色连帽卫衣', '白色运动鞋', '黑色牛仔裤', 
    '红色毛衣', '灰色外套', '绿色T恤', '紫色连衣裙'
  ]
  const buyers = [
    '朱xiaoxiao2', '权丽鱿戏', '金金素材', '王小样', '虽败犹荣', 
    '杰夫沃特', '张三', '李四', '王五', '赵六', '钱七', '孙八'
  ]
  const statuses = ['pending', 'shipped', 'completed', 'cancelled']
  const paymentStatuses = ['paid', 'unpaid', 'refunding']
  
  // 生成234个订单
  for (let i = 1; i <= 234; i++) {
    const product = products[Math.floor(Math.random() * products.length)]
    const buyer = buyers[Math.floor(Math.random() * buyers.length)]
    const status = statuses[Math.floor(Math.random() * statuses.length)]
    const paymentStatus = paymentStatuses[Math.floor(Math.random() * paymentStatuses.length)]
    const price = Math.floor(Math.random() * 500) + 100
    
    mockOrders.push({
      id: i,
      orderNumber: `ID238${String(1000 - i).padStart(3, '0')}`,
      orderTime: `2022-11-${String(Math.floor(Math.random() * 30) + 1).padStart(2, '0')}`,
      buyer: buyer,
      productName: product,
      quantity: Math.floor(Math.random() * 3) + 1,
      unitPrice: price,
      weight: Math.random() * 2 + 0.1,
      shippingFee: 0,
      totalAmount: price * (Math.floor(Math.random() * 3) + 1),
      status: status,
      paymentStatus: paymentStatus,
      address: '收货地址...'
    })
  }
  
  // 根据当前页和每页大小分页
  const startIndex = (currentPage.value - 1) * pageSize.value
  const endIndex = startIndex + pageSize.value
  orders.value = mockOrders.slice(startIndex, endIndex)
  totalOrders.value = 234
}

// 状态标签页切换
const handleStatusTabChange = (status) => {
  activeStatusTab.value = status
  currentPage.value = 1
}

// 搜索功能
const handleSearch = () => {
  showAdvancedFilter.value = !showAdvancedFilter.value
  if (showAdvancedFilter.value) {
    searchOrders()
  }
}

// 下载功能
const handleDownload = () => {
  ElMessage.info('正在下载订单数据...')
}

// 排序处理
const handleSortChange = ({ prop, order }) => {
  console.log('排序:', prop, order)
  // 这里可以实现排序逻辑
}

// 格式化日期
const formatDate = (dateStr) => {
  const date = new Date(dateStr)
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
}

// 获取支付状态类型
const getPaymentStatusType = (status) => {
  const statusMap = {
    paid: 'success',
    unpaid: 'warning',
    refunding: 'info'
  }
  return statusMap[status] || 'info'
}

// 获取支付状态文本
const getPaymentStatusText = (status) => {
  const statusMap = {
    paid: '已支付',
    unpaid: '未支付',
    refunding: '退款中'
  }
  return statusMap[status] || status
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
  // 只有待发货和已发货的订单可以选择
  return row.status === 'pending' || row.status === 'shipped'
}

// 全选/取消全选
const toggleSelectAll = () => {
  // 这个功能由Element Plus表格自动处理
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
    paid: 'info',
    shipped: 'primary',
    finished: 'success',
    cancelled: 'danger'
  }
  return statusMap[status] || 'info'
}

// 获取状态文本
const getStatusText = (status) => {
  const statusMap = {
    pending: '待发货',
    paid: '已支付',
    shipped: '已发货',
    finished: '已完成',
    cancelled: '已取消'
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

// 修改商品重量
const editProductWeight = (order) => {
  currentOrder.value = order
  weightForm.productName = order.productName
  weightForm.currentWeight = order.weight + 'kg'
  weightForm.newWeight = order.weight
  weightForm.region = 'mainland'
  weightForm.quantity = order.quantity
  weightModalVisible.value = true
}

// 关闭重量修改模态框
const closeWeightModal = () => {
  weightModalVisible.value = false
  currentOrder.value = null
}

// 保存商品重量
const saveProductWeight = () => {
  if (!weightForm.newWeight || weightForm.newWeight <= 0) {
    ElMessage.error('请输入有效的重量！')
    return
  }
  
  if (!weightForm.quantity || weightForm.quantity <= 0) {
    ElMessage.error('请输入有效的数量！')
    return
  }
  
  const totalWeight = weightForm.newWeight * weightForm.quantity
  const shippingFee = getShippingFeeByRegion(
    weightForm.region,
    totalWeight,
    '',
    '',
    0
  )
  
  const productTotal = currentOrder.value.unitPrice * weightForm.quantity
  const finalTotal = productTotal + shippingFee
  
  // 更新订单显示
  currentOrder.value.weight = weightForm.newWeight
  currentOrder.value.shippingFee = shippingFee
  currentOrder.value.totalAmount = finalTotal
  currentOrder.value.quantity = weightForm.quantity
  
  ElMessage.success(`商品重量已更新！\n新重量: ${weightForm.newWeight}kg\n数量: ${weightForm.quantity}件\n总重量: ${totalWeight.toFixed(2)}kg\n运费: $${shippingFee.toFixed(2)}\n实付金额: $${finalTotal.toFixed(2)}`)
  
  closeWeightModal()
}

// 根据地区计算运费
const getShippingFeeByRegion = (region, totalWeight, productBrand = '', deliveryRegion = '', orderAmount = 0) => {
  let baseFee = 0
  
  // 中国大陆标准运费
  if (region === 'mainland') {
    const calculatedWeight = Math.max(1, Math.ceil(totalWeight))
    baseFee = calculatedWeight * 7.99
  }
  
  // 新西兰本地：订单金额超过200纽币免邮
  if (region === 'nz') {
    if (orderAmount >= 200) {
      baseFee = 0
    } else {
      const calculatedWeight = Math.max(1, Math.ceil(totalWeight))
      baseFee = calculatedWeight * 7.99
    }
  }
  
  // 澳洲奶粉免邮
  if (region === 'au') {
    baseFee = 0
  }
  
  // 偏远地区额外运费
  if (region === 'remote') {
    const remoteRegions = ['新疆', '西藏', '甘肃', '宁夏', '青海']
    if (remoteRegions.includes(deliveryRegion)) {
      baseFee = 10
    }
  }
  
  // Taopu品牌奶粉额外运费
  if (region === 'taopu' && productBrand.toLowerCase().includes('taopu')) {
    const taopuRegions = ['海南', '新疆', '甘肃', '青海', '宁夏', '内蒙古']
    if (taopuRegions.includes(deliveryRegion)) {
      baseFee = 20
    }
  }
  
  return baseFee
}

// 查看物流
const viewLogistics = (order) => {
  ElMessage.info(`查看订单 ${order.orderNumber} 的物流信息功能开发中...`)
}

// 修改物流
const modifyLogistics = (order) => {
  ElMessage.info(`修改订单 ${order.orderNumber} 的物流信息功能开发中...`)
}

// 查看订单详情
const viewOrderDetails = (order) => {
  currentOrderDetail.value = order
  orderDetailModalVisible.value = true
}

// 关闭订单详情模态框
const closeOrderDetailModal = () => {
  orderDetailModalVisible.value = false
  currentOrderDetail.value = null
}

// 标记为已完成
const markAsCompleted = () => {
  if (currentOrderDetail.value) {
    currentOrderDetail.value.status = 'completed'
    ElMessage.success('订单已标记为已完成！')
    // 这里可以添加更新订单状态的API调用
    // updateOrderStatus(currentOrderDetail.value.id, 'completed')
  }
}

// 去发货
const goToShip = () => {
  if (currentOrderDetail.value) {
    // 跳转到发货页面，传递订单ID
    ElMessage.info('正在跳转到发货页面...')
    // 这里可以添加路由跳转或打开发货模态框
    // router.push(`/orders/ship?orderId=${currentOrderDetail.value.id}`)
    
    // 或者打开发货模态框
    openShipModal()
  }
}

// 打开发货模态框
const openShipModal = () => {
  ElMessageBox.prompt('请输入物流单号', '发货信息', {
    confirmButtonText: '确认发货',
    cancelButtonText: '取消',
    inputPlaceholder: '请输入物流单号',
    inputValidator: (value) => {
      if (!value || value.trim() === '') {
        return '请输入物流单号'
      }
      return true
    }
  }).then(({ value }) => {
    // 更新订单状态为已发货
    if (currentOrderDetail.value) {
      currentOrderDetail.value.status = 'shipped'
      currentOrderDetail.value.trackingNumber = value.trim()
      currentOrderDetail.value.shipTime = new Date().toISOString()
      ElMessage.success('订单已发货！物流单号：' + value.trim())
      
      // 这里可以添加更新订单状态的API调用
      // updateOrderStatus(currentOrderDetail.value.id, 'shipped', { trackingNumber: value.trim() })
    }
  }).catch(() => {
    ElMessage.info('已取消发货')
  })
}

// 修改订单信息
const modifyOrder = (order) => {
  currentOrderDetail.value = order
  editOrderForm.buyer = order.buyer
  editOrderForm.address = order.address
  editOrderForm.phone = order.phone || ''
  editOrderForm.quantity = order.quantity
  editOrderForm.remark = ''
  editOrderModalVisible.value = true
}

// 关闭修改订单信息模态框
const closeEditOrderModal = () => {
  editOrderModalVisible.value = false
  currentOrderDetail.value = null
}

// 保存订单信息
const saveOrderInfo = () => {
  if (!editOrderForm.buyer || !editOrderForm.address) {
    ElMessage.error('请填写必填信息！')
    return
  }
  
  // 更新订单信息
  if (currentOrderDetail.value) {
    currentOrderDetail.value.buyer = editOrderForm.buyer
    currentOrderDetail.value.address = editOrderForm.address
    currentOrderDetail.value.quantity = editOrderForm.quantity
    
    // 重新计算总金额
    const newTotal = currentOrderDetail.value.unitPrice * editOrderForm.quantity
    currentOrderDetail.value.totalAmount = newTotal
  }
  
  ElMessage.success('订单信息已更新！')
  closeEditOrderModal()
}

// 订单退款
const refundOrder = (order) => {
  currentOrderDetail.value = order
  refundForm.amount = order.totalAmount
  refundForm.reason = ''
  refundForm.description = ''
  refundModalVisible.value = true
}

// 关闭退款模态框
const closeRefundModal = () => {
  refundModalVisible.value = false
  currentOrderDetail.value = null
}

// 提交退款
const submitRefund = () => {
  if (!refundForm.reason) {
    ElMessage.error('请选择退款原因！')
    return
  }
  
  if (!refundForm.amount || refundForm.amount <= 0) {
    ElMessage.error('请输入有效的退款金额！')
    return
  }
  
  if (refundForm.amount > currentOrderDetail.value.totalAmount) {
    ElMessage.error('退款金额不能超过订单金额！')
    return
  }
  
  // 模拟退款处理
  ElMessage.success(`订单 ${currentOrderDetail.value.orderNumber} 退款申请已提交！\n退款金额：¥${refundForm.amount}\n退款原因：${getRefundReasonText(refundForm.reason)}`)
  
  // 更新订单状态为退款中
  if (currentOrderDetail.value) {
    currentOrderDetail.value.status = 'refunding'
    currentOrderDetail.value.paymentStatus = 'refunding'
  }
  
  closeRefundModal()
}

// 获取退款原因文本
const getRefundReasonText = (reason) => {
  const reasonMap = {
    quality: '商品质量问题',
    wrong_item: '发错商品',
    customer_request: '客户要求',
    shipping: '物流问题',
    other: '其他'
  }
  return reasonMap[reason] || reason
}

onMounted(() => {
  loadOrders()
  initColumnResize()
})

// 初始化列宽调整功能
const initColumnResize = () => {
  nextTick(() => {
    const table = document.querySelector('.el-table')
    if (!table) return
    
    const headers = table.querySelectorAll('.el-table__header th')
    headers.forEach((header, index) => {
      if (index === 0) return // 跳过选择列
      
      header.style.position = 'relative'
      header.style.cursor = 'col-resize'
      
      // 添加拖拽事件
      header.addEventListener('mousedown', (e) => {
        if (e.target === header || e.target.closest('.el-table__header')) {
          e.preventDefault()
          startResize(e, header, index)
        }
      })
    })
  })
}

// 开始调整列宽
const startResize = (e, header, index) => {
  const startX = e.clientX
  const startWidth = header.offsetWidth
  const table = header.closest('.el-table')
  
  const handleMouseMove = (e) => {
    const deltaX = e.clientX - startX
    const newWidth = Math.max(50, startWidth + deltaX) // 最小宽度50px
    header.style.width = newWidth + 'px'
    
    // 更新表格布局
    if (table) {
      table.style.tableLayout = 'fixed'
    }
  }
  
  const handleMouseUp = () => {
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
    document.body.style.cursor = ''
  }
  
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
  document.body.style.cursor = 'col-resize'
}
</script>

<style scoped>
/* 移除根容器样式，直接使用父容器的布局 */

/* 状态分类标签页 - 无边距 */
.status-tabs {
  background: white;
  border-radius: 0;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  margin: 0;
  overflow: hidden;
  flex-shrink: 0;
}

.tab-container {
  display: flex;
  border-bottom: 1px solid #f0f0f0;
}

.status-tab {
  padding: 15px 20px;
  cursor: pointer;
  border-bottom: 3px solid transparent;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #666;
}

.status-tab:hover {
  background: #f5f5f5;
  color: #333;
}

.status-tab.active {
  color: #1890ff;
  border-bottom-color: #1890ff;
  background: #f0f8ff;
}

.tab-count {
  background: #e6f7ff;
  color: #1890ff;
  padding: 2px 6px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 500;
}

/* 搜索和筛选区域 - 无边距，限制宽度 */
.search-filter-section {
  background: white;
  padding: 15px;
  border-radius: 0;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  margin: 0;
  flex-shrink: 0;
  max-width: 1000px;
  width: 100%;
}

.search-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  flex-wrap: nowrap;
  min-width: 0;
  max-width: 900px;
}

/* 下载按钮样式优化 */
.search-row .el-button {
  padding: 8px 16px;
  font-size: 14px;
  white-space: nowrap;
}

.search-input-container {
  flex: 0 0 auto;
  min-width: 180px;
  max-width: 250px;
  width: 220px;
}

.search-input {
  width: 100%;
}

.date-picker {
  width: 140px;
  min-width: 120px;
}

/* 高级筛选区域 - 无边距 */
.advanced-filter-section {
  background: #fafafa;
  padding: 15px;
  border-radius: 0;
  margin: 0;
  border: 1px solid #f0f0f0;
  flex-shrink: 0;
}

.order-summary {
  background: white;
  padding: 10px 15px;
  border-radius: 0;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  margin: 0;
  flex-shrink: 0;
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

.status-item.shipped {
  background: #e6f7ff;
  color: #1890ff;
}

.status-item.completed {
  background: #f6ffed;
  color: #52c41a;
}

.status-item.cancelled {
  background: #fff2f0;
  color: #ff4d4f;
}

/* 订单列表容器 - 完全平铺 */
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

.pagination-left {
  display: flex;
  align-items: center;
}

.results-info {
  color: #666;
  font-size: 14px;
}

.pagination-right {
  display: flex;
  align-items: center;
}

.weight-display,
.shipping-fee-display {
  font-weight: 600;
  color: #1890ff;
}

/* 订单信息样式 */
.order-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.product-name {
  font-weight: 500;
  color: #333;
  line-height: 1.4;
}

.order-id {
  font-size: 12px;
  color: #999;
  font-family: monospace;
}

.price {
  font-weight: 600;
  color: #333;
}

/* 操作按钮样式 - 水平排列 */
.action-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
  justify-content: flex-start;
}

.action-buttons .el-button {
  margin: 0;
  flex-shrink: 0;
}

.action-buttons .el-dropdown {
  flex-shrink: 0;
}

/* 表格样式优化 - 完全平铺 */
:deep(.el-table) {
  border-radius: 0;
  overflow: hidden;
  width: 100%;
  max-width: 100%;
  table-layout: fixed;
  flex: 1;
  height: 100%;
}

/* 确保列宽调整功能正常工作 */
:deep(.el-table__header-wrapper) {
  overflow: visible;
}

:deep(.el-table__header) {
  overflow: visible;
}

:deep(.el-table th) {
  position: relative;
  user-select: none;
}

/* 列宽调整手柄 - 使用CSS实现 */
:deep(.el-table th::after) {
  content: '';
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  cursor: col-resize;
  z-index: 10;
  background: transparent;
  transition: all 0.2s ease;
  box-shadow: 0 0 0 0 rgba(0, 0, 0, 0);
}

:deep(.el-table th:hover::after) {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  opacity: 0.8;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
  width: 6px;
}

/* 调整手柄在悬浮时更明显 */
:deep(.el-table th:hover::before) {
  content: '';
  position: absolute;
  right: -3px;
  top: 0;
  bottom: 0;
  width: 12px;
  cursor: col-resize;
  z-index: 11;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  opacity: 0.1;
  border-radius: 2px;
}

:deep(.el-table__body-wrapper) {
  max-height: calc(100vh - 400px);
  overflow-y: auto;
}

:deep(.el-table th) {
  background: #fafafa;
  color: #333;
  font-weight: 600;
  position: relative;
}

/* 为每一列添加浅紫色阴影分隔线 */
:deep(.el-table th:not(:last-child)) {
  border-right: 2px solid rgba(102, 126, 234, 0.2);
  position: relative;
}

:deep(.el-table th:not(:last-child)::after) {
  content: '';
  position: absolute;
  right: -2px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.3) 0%, rgba(118, 75, 162, 0.3) 100%);
  z-index: 5;
  box-shadow: 0 0 4px rgba(102, 126, 234, 0.2);
}

:deep(.el-table td:not(:last-child)) {
  border-right: 2px solid rgba(102, 126, 234, 0.15);
  position: relative;
}

:deep(.el-table th:hover) {
  background: #f0f8ff;
  cursor: col-resize;
}

/* 可调整列的悬浮标识 */
:deep(.el-table th:hover::after) {
  content: "↔";
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  color: #1890ff;
  font-size: 14px;
  font-weight: bold;
  pointer-events: none;
  opacity: 1;
  transition: opacity 0.2s ease;
}

:deep(.el-table td) {
  padding: 12px 0;
}

:deep(.el-table .cell) {
  padding: 0 12px;
}

/* 状态标签样式 */
:deep(.el-tag) {
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

/* 隐藏下拉菜单滚动条 */
:deep(.el-dropdown-menu) {
  max-height: none !important;
  overflow: visible !important;
  scrollbar-width: none !important;
  -ms-overflow-style: none !important;
}

:deep(.el-dropdown-menu::-webkit-scrollbar) {
  display: none !important;
  width: 0 !important;
  height: 0 !important;
}

:deep(.el-dropdown-menu) {
  -webkit-overflow-scrolling: touch;
  overflow: hidden !important;
}

/* 订单详情样式 */
.order-detail {
  padding: 20px 0;
}

/* 模态框样式优化 */
:deep(.el-dialog) {
  border-radius: 8px;
}

:deep(.el-dialog__header) {
  background: #fafafa;
  border-bottom: 1px solid #f0f0f0;
  border-radius: 8px 8px 0 0;
}

:deep(.el-dialog__title) {
  font-weight: 600;
  color: #333;
}

:deep(.el-descriptions__label) {
  font-weight: 600;
  color: #666;
}

:deep(.el-descriptions__content) {
  color: #333;
}

/* 表单样式优化 */
:deep(.el-form-item__label) {
  font-weight: 500;
  color: #333;
}

:deep(.el-input__inner) {
  border-radius: 4px;
}

:deep(.el-textarea__inner) {
  border-radius: 4px;
}

:deep(.el-select) {
  width: 100%;
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

/* 响应式设计 - 真正适配屏幕 */
@media (max-width: 1200px) {
  .order-list-page {
    padding: 0;
  }
  
  .status-tabs,
  .search-filter-section,
  .advanced-filter-section,
  .order-summary,
  .orders-container,
  .pagination-container {
    margin: 0;
  }
  
  .status-tab {
    padding: 10px 15px;
    font-size: 13px;
  }
  
  .search-row {
    gap: 10px;
  }
  
        .search-input-container {
          width: 200px;
          max-width: 250px;
        }
        
        .date-picker {
          width: 150px;
          min-width: 130px;
        }
}

@media (max-width: 768px) {
  .order-list-page {
    padding: 0;
  }
  
  .status-tabs,
  .search-filter-section,
  .advanced-filter-section,
  .order-summary,
  .orders-container,
  .pagination-container {
    margin: 0;
  }
  
  .search-row {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }
  
  .search-input-container {
    width: 100%;
  }
  
  .date-picker {
    width: 100%;
  }
  
  .tab-container {
    flex-wrap: wrap;
  }
  
  .status-tab {
    flex: 1;
    min-width: 80px;
    justify-content: center;
    font-size: 12px;
    padding: 8px 12px;
  }
  
  .summary-stats {
    flex-direction: column;
    gap: 10px;
    align-items: flex-start;
  }
  
  .status-counts {
    flex-wrap: wrap;
    gap: 10px;
  }
}

/* 订单详情页面样式 - 与AddProduct页面风格一致 */
.order-detail-dialog {
  border-radius: 16px !important;
  overflow: hidden !important;
}

.order-detail-dialog :deep(.el-dialog) {
  border-radius: 16px !important;
  overflow: hidden !important;
}

.order-detail-dialog :deep(.el-dialog__body) {
  background: linear-gradient(180deg, rgba(167,139,250,0.18) 0%, rgba(99,102,241,0.14) 100%) !important;
  padding: 0 !important;
  border-radius: 16px !important;
}

.order-detail-dialog :deep(.el-dialog__header),
.order-detail-dialog :deep(.el-dialog__footer) {
  background: transparent !important;
  border: none !important;
}

.order-detail-dialog :deep(.el-overlay-dialog) {
  background: linear-gradient(180deg, rgba(167,139,250,0.18), rgba(99,102,241,0.15)) !important;
}

.order-detail-dialog :deep(.el-overlay) {
  background: rgba(20,16,40,0.35) !important;
  backdrop-filter: blur(2px) !important;
}

.order-detail-container {
  background: transparent;
  min-height: 500px;
}

/* 顶部操作栏 */
.od-topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: transparent;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
}

.od-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 18px;
  font-weight: 700;
  color: #667eea;
}

.od-title .el-icon {
  font-size: 20px;
}

.print-btn {
  border-radius: 12px;
  font-weight: 600;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
  transition: all 0.3s ease;
}

.print-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
}

/* 主要内容区域 */
.od-main-content {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  padding: 20px;
}

/* 左侧列 */
.od-left-column {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* 右侧列 */
.od-right-column {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* 状态区域 */
.od-status-section,
.od-payment-section {
  position: relative;
  background: rgba(255, 255, 255, 0.68);
  border: 1px solid rgba(255, 255, 255, 0.28);
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 12px 36px rgba(31, 41, 55, 0.12);
  backdrop-filter: saturate(180%) blur(10px);
  overflow: hidden;
}

.od-status-section::before,
.od-payment-section::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 16px;
  padding: 1px;
  background: linear-gradient(135deg, rgba(102,126,234,0.35), rgba(118,75,162,0.35), rgba(59,130,246,0.35));
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
          mask-composite: exclude;
  pointer-events: none;
}

.od-status-section::after,
.od-payment-section::after {
  content: "";
  position: absolute;
  left: -50%;
  top: -100%;
  width: 200%;
  height: 300%;
  background: linear-gradient(120deg, rgba(255,255,255,0) 44%, rgba(255,255,255,0.35) 50%, rgba(255,255,255,0) 56%);
  animation: od-scan 8s linear infinite;
  pointer-events: none;
}

@keyframes od-scan {
  0% { transform: translateY(0); }
  100% { transform: translateY(60%); }
}

/* 状态头部 */
.od-status-header,
.od-payment-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
}

.od-status-icon,
.od-payment-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: white;
}

.od-status-icon.pending {
  background: linear-gradient(135deg, #ff7043 0%, #ff5722 100%);
}

.od-payment-icon.paid {
  background: linear-gradient(135deg, #4caf50 0%, #2e7d32 100%);
}

.od-status-text h3,
.od-payment-text h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #333;
}

.od-status-text p {
  margin: 4px 0 0 0;
  color: #666;
  font-size: 14px;
}

/* 商品信息 */
.od-product-info {
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
  padding: 16px;
  background: rgba(102, 126, 234, 0.05);
  border-radius: 12px;
  border: 1px solid rgba(102, 126, 234, 0.1);
}

.od-product-image {
  width: 80px;
  height: 80px;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
}

.od-product-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.od-product-details h4 {
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.od-product-details p {
  margin: 4px 0;
  font-size: 14px;
  color: #666;
}

.od-product-price {
  color: #ff4757 !important;
  font-weight: 600;
}

/* 操作按钮 */
.od-action-buttons {
  display: flex;
  gap: 12px;
}

.complete-btn {
  border-radius: 8px;
  border: 2px solid #4caf50;
  color: #4caf50;
  background: transparent;
  font-weight: 600;
  transition: all 0.3s ease;
}

.complete-btn:hover {
  background: #4caf50;
  color: white;
  transform: translateY(-2px);
}

.ship-btn {
  border-radius: 8px;
  font-weight: 600;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
  transition: all 0.3s ease;
}

.ship-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
}

/* 支付详情 */
.od-payment-details {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.od-payment-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.od-payment-item:last-child {
  border-bottom: none;
}

.od-payment-item.total {
  font-weight: 700;
  font-size: 16px;
  color: #333;
  border-top: 2px solid #667eea;
  padding-top: 12px;
  margin-top: 8px;
}

.od-payment-item.buyer-paid {
  background: rgba(76, 175, 80, 0.1);
  padding: 12px;
  border-radius: 8px;
  margin-top: 8px;
  font-weight: 600;
  color: #2e7d32;
}

.od-payment-label {
  color: #666;
  font-size: 14px;
}

.od-payment-value {
  color: #333;
  font-weight: 500;
}

/* 右侧区域 */
.od-buyer-section,
.od-contact-section,
.od-address-section,
.od-billing-section,
.od-notes-section {
  position: relative;
  background: rgba(255, 255, 255, 0.68);
  border: 1px solid rgba(255, 255, 255, 0.28);
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 12px 36px rgba(31, 41, 55, 0.12);
  backdrop-filter: saturate(180%) blur(10px);
  overflow: hidden;
}

.od-buyer-section::before,
.od-contact-section::before,
.od-address-section::before,
.od-billing-section::before,
.od-notes-section::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 16px;
  padding: 1px;
  background: linear-gradient(135deg, rgba(102,126,234,0.35), rgba(118,75,162,0.35), rgba(59,130,246,0.35));
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
          mask-composite: exclude;
  pointer-events: none;
}

.od-buyer-section::after,
.od-contact-section::after,
.od-address-section::after,
.od-billing-section::after,
.od-notes-section::after {
  content: "";
  position: absolute;
  left: -50%;
  top: -100%;
  width: 200%;
  height: 300%;
  background: linear-gradient(120deg, rgba(255,255,255,0) 44%, rgba(255,255,255,0.35) 50%, rgba(255,255,255,0) 56%);
  animation: od-scan 8s linear infinite;
  pointer-events: none;
}

/* 买家信息 */
.od-buyer-header {
  display: flex;
  align-items: center;
  gap: 16px;
}

.od-buyer-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
}

.od-buyer-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.od-buyer-info h4 {
  margin: 0 0 4px 0;
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.od-buyer-info p {
  margin: 0;
  font-size: 14px;
  color: #666;
}

.od-buyer-icon {
  margin-left: auto;
  font-size: 20px;
  color: #667eea;
  cursor: pointer;
  transition: all 0.3s ease;
}

.od-buyer-icon:hover {
  color: #764ba2;
  transform: scale(1.1);
}

/* 区域标题 */
.od-section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.od-section-header h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.edit-btn {
  color: #667eea;
  font-weight: 500;
  transition: all 0.3s ease;
}

.edit-btn:hover {
  color: #764ba2;
}

/* 联系信息项 */
.od-contact-item,
.od-address-item,
.od-billing-item,
.od-notes-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  color: #666;
  font-size: 14px;
}

.od-contact-item .el-icon,
.od-address-item .el-icon {
  color: #667eea;
  font-size: 16px;
}

/* 订单详情响应式设计 */
@media (max-width: 1200px) {
  .od-main-content {
    grid-template-columns: 1fr;
    gap: 20px;
  }
}

@media (max-width: 768px) {
  .od-main-content {
    padding: 16px;
  }
  
  .od-action-buttons {
    flex-direction: column;
  }
  
  .od-product-info {
    flex-direction: column;
    text-align: center;
  }
}
</style>