<template>
  <div class="coupons-container">
    <!-- 页面头部 -->
    <div class="page-header">
      <h1>优惠券管理中心</h1>
      <p>管理所有优惠券，包括单产品、节日和活动优惠券</p>
    </div>

    <!-- 操作栏 -->
    <div class="action-bar">
      <div class="search-section">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索优惠券名称或代码"
          class="search-input"
          @input="handleSearch"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        <el-select v-model="statusFilter" placeholder="状态筛选" @change="handleFilter">
          <el-option label="全部" value="" />
          <el-option label="有效" value="active" />
          <el-option label="已过期" value="expired" />
          <el-option label="已禁用" value="disabled" />
        </el-select>
        <el-select v-model="typeFilter" placeholder="类型筛选" @change="handleFilter">
          <el-option label="全部" value="" />
          <el-option label="单产品" value="product" />
          <el-option label="节日" value="holiday" />
          <el-option label="活动" value="campaign" />
        </el-select>
      </div>
      <div class="action-buttons">
        <el-button type="primary" @click="showCreateModal">
          <el-icon><Plus /></el-icon>
          创建优惠券
        </el-button>
        <el-button @click="handleBatchOperation" :disabled="selectedCoupons.length === 0">
          <el-icon><Operation /></el-icon>
          批量操作
        </el-button>
      </div>
    </div>

    <!-- 优惠券列表 -->
    <div class="coupons-list">
      <el-table
        :data="filteredCoupons"
        v-loading="loading"
        @selection-change="handleSelectionChange"
        stripe
        style="width: 100%"
      >
        <el-table-column type="selection" width="55" />
        <el-table-column prop="code" label="优惠券代码" width="150">
          <template #default="{ row }">
            <div class="coupon-code">
              <span class="code-text">{{ row.code }}</span>
              <el-button size="small" text @click="copyCode(row.code)">
                <el-icon><CopyDocument /></el-icon>
              </el-button>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="优惠券名称" min-width="200" />
        <el-table-column prop="type" label="类型" width="100">
          <template #default="{ row }">
            <el-tag :type="getTypeTagType(row.type)">
              {{ getTypeText(row.type) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="discount" label="优惠内容" width="150">
          <template #default="{ row }">
            <div class="discount-info">
              <span v-if="row.discountType === 'percentage'">
                {{ row.discountValue }}% 折扣
              </span>
              <span v-else>
                直降 ¥{{ row.discountValue }}
              </span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="usageLimit" label="使用限制" width="120">
          <template #default="{ row }">
            <div v-if="row.usageLimit > 0">
              {{ row.usedCount }}/{{ row.usageLimit }}
            </div>
            <div v-else>无限制</div>
          </template>
        </el-table-column>
        <el-table-column prop="validPeriod" label="有效期" width="200">
          <template #default="{ row }">
            <div class="valid-period">
              <div>{{ formatDate(row.startDate) }}</div>
              <div>{{ formatDate(row.endDate) }}</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusTagType(row.status)">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="viewCoupon(row)">查看</el-button>
            <el-button size="small" @click="editCoupon(row)">编辑</el-button>
            <el-button 
              size="small" 
              :type="row.status === 'active' ? 'warning' : 'success'"
              @click="toggleCoupon(row)"
            >
              {{ row.status === 'active' ? '禁用' : '启用' }}
            </el-button>
            <el-button size="small" type="danger" @click="deleteCoupon(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 分页 -->
    <div class="pagination">
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :page-sizes="[10, 20, 50, 100]"
        :total="totalCoupons"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
      />
    </div>

    <!-- 创建/编辑优惠券弹窗 -->
    <el-dialog
      v-model="showModal"
      :title="isEdit ? '编辑优惠券' : '创建优惠券'"
      width="800px"
      :close-on-click-modal="false"
    >
      <el-form
        ref="couponFormRef"
        :model="couponForm"
        :rules="couponRules"
        label-width="120px"
      >
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="优惠券名称" prop="name">
              <el-input v-model="couponForm.name" placeholder="请输入优惠券名称" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="优惠券代码" prop="code">
              <el-input v-model="couponForm.code" placeholder="自动生成或手动输入" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="优惠券类型" prop="type">
              <el-select v-model="couponForm.type" placeholder="选择类型" @change="handleTypeChange">
                <el-option label="单产品优惠券" value="product" />
                <el-option label="节日优惠券" value="holiday" />
                <el-option label="活动优惠券" value="campaign" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="折扣类型" prop="discountType">
              <el-radio-group v-model="couponForm.discountType">
                <el-radio label="percentage">百分比折扣</el-radio>
                <el-radio label="fixed">直降金额</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item 
              :label="couponForm.discountType === 'percentage' ? '折扣百分比' : '直降金额'"
              prop="discountValue"
            >
              <el-input-number
                v-model="couponForm.discountValue"
                :min="couponForm.discountType === 'percentage' ? 1 : 0.01"
                :max="couponForm.discountType === 'percentage' ? 100 : 9999"
                :precision="couponForm.discountType === 'percentage' ? 0 : 2"
                style="width: 100%"
              />
              <span v-if="couponForm.discountType === 'percentage'" class="unit">%</span>
              <span v-else class="unit">元</span>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="最低消费" prop="minAmount">
              <el-input-number
                v-model="couponForm.minAmount"
                :min="0"
                :precision="2"
                style="width: 100%"
              />
              <span class="unit">元</span>
            </el-form-item>
          </el-col>
        </el-row>

        <!-- 单产品优惠券特定字段 -->
        <div v-if="couponForm.type === 'product'">
          <el-form-item label="适用产品" prop="productIds">
            <el-select
              v-model="couponForm.productIds"
              multiple
              placeholder="选择适用产品"
              style="width: 100%"
            >
              <el-option
                v-for="product in products"
                :key="product.id"
                :label="product.name"
                :value="product.id"
              />
            </el-select>
          </el-form-item>
        </div>

        <!-- 节日优惠券特定字段 -->
        <div v-if="couponForm.type === 'holiday'">
          <el-row :gutter="20">
            <el-col :span="12">
              <el-form-item label="节日名称" prop="holidayName">
                <el-input v-model="couponForm.holidayName" placeholder="如：春节、情人节" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="节日年份" prop="holidayYear">
                <el-date-picker
                  v-model="couponForm.holidayYear"
                  type="year"
                  placeholder="选择年份"
                  style="width: 100%"
                />
              </el-form-item>
            </el-col>
          </el-row>
        </div>

        <!-- 活动优惠券特定字段 -->
        <div v-if="couponForm.type === 'campaign'">
          <el-form-item label="活动名称" prop="campaignName">
            <el-input v-model="couponForm.campaignName" placeholder="如：双十一、黑五" />
          </el-form-item>
        </div>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="使用次数限制" prop="usageLimit">
              <el-input-number
                v-model="couponForm.usageLimit"
                :min="0"
                style="width: 100%"
              />
              <span class="unit">次（0表示无限制）</span>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="用户领取限制" prop="userLimit">
              <el-input-number
                v-model="couponForm.userLimit"
                :min="1"
                style="width: 100%"
              />
              <span class="unit">次/用户</span>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="开始时间" prop="startDate">
              <el-date-picker
                v-model="couponForm.startDate"
                type="datetime"
                placeholder="选择开始时间"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="结束时间" prop="endDate">
              <el-date-picker
                v-model="couponForm.endDate"
                type="datetime"
                placeholder="选择结束时间"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="优惠券描述" prop="description">
          <el-input
            v-model="couponForm.description"
            type="textarea"
            :rows="3"
            placeholder="请输入优惠券描述"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="showModal = false">取消</el-button>
          <el-button type="primary" @click="saveCoupon" :loading="saving">
            {{ isEdit ? '更新' : '创建' }}
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 优惠券详情弹窗 -->
    <el-dialog
      v-model="showDetailModal"
      title="优惠券详情"
      width="600px"
    >
      <div v-if="selectedCoupon" class="coupon-detail">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="优惠券名称">{{ selectedCoupon.name }}</el-descriptions-item>
          <el-descriptions-item label="优惠券代码">{{ selectedCoupon.code }}</el-descriptions-item>
          <el-descriptions-item label="类型">{{ getTypeText(selectedCoupon.type) }}</el-descriptions-item>
          <el-descriptions-item label="状态">{{ getStatusText(selectedCoupon.status) }}</el-descriptions-item>
          <el-descriptions-item label="优惠内容">
            <span v-if="selectedCoupon.discountType === 'percentage'">
              {{ selectedCoupon.discountValue }}% 折扣
            </span>
            <span v-else>
              直降 ¥{{ selectedCoupon.discountValue }}
            </span>
          </el-descriptions-item>
          <el-descriptions-item label="最低消费">¥{{ selectedCoupon.minAmount }}</el-descriptions-item>
          <el-descriptions-item label="使用限制">
            {{ selectedCoupon.usageLimit > 0 ? `${selectedCoupon.usedCount}/${selectedCoupon.usageLimit}` : '无限制' }}
          </el-descriptions-item>
          <el-descriptions-item label="用户限制">{{ selectedCoupon.userLimit }}次/用户</el-descriptions-item>
          <el-descriptions-item label="有效期" :span="2">
            {{ formatDate(selectedCoupon.startDate) }} 至 {{ formatDate(selectedCoupon.endDate) }}
          </el-descriptions-item>
          <el-descriptions-item label="描述" :span="2">{{ selectedCoupon.description }}</el-descriptions-item>
        </el-descriptions>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Plus, Operation, CopyDocument } from '@element-plus/icons-vue'

// 响应式数据
const loading = ref(false)
const saving = ref(false)
const searchKeyword = ref('')
const statusFilter = ref('')
const typeFilter = ref('')
const currentPage = ref(1)
const pageSize = ref(20)
const totalCoupons = ref(0)
const selectedCoupons = ref([])
const showModal = ref(false)
const showDetailModal = ref(false)
const isEdit = ref(false)
const selectedCoupon = ref(null)

// 表单数据
const couponForm = reactive({
  id: null,
  name: '',
  code: '',
  type: 'product',
  discountType: 'percentage',
  discountValue: 10,
  minAmount: 0,
  productIds: [],
  holidayName: '',
  holidayYear: null,
  campaignName: '',
  usageLimit: 0,
  userLimit: 1,
  startDate: null,
  endDate: null,
  description: ''
})

// 表单验证规则
const couponRules = {
  name: [{ required: true, message: '请输入优惠券名称', trigger: 'blur' }],
  code: [{ required: true, message: '请输入优惠券代码', trigger: 'blur' }],
  type: [{ required: true, message: '请选择优惠券类型', trigger: 'change' }],
  discountType: [{ required: true, message: '请选择折扣类型', trigger: 'change' }],
  discountValue: [{ required: true, message: '请输入折扣值', trigger: 'blur' }],
  startDate: [{ required: true, message: '请选择开始时间', trigger: 'change' }],
  endDate: [{ required: true, message: '请选择结束时间', trigger: 'change' }]
}

// 模拟数据
const coupons = ref([
  {
    id: 1,
    name: '春节特惠券',
    code: 'SPRING2024',
    type: 'holiday',
    discountType: 'percentage',
    discountValue: 20,
    minAmount: 100,
    usageLimit: 1000,
    usedCount: 156,
    userLimit: 2,
    startDate: '2024-02-01T00:00:00',
    endDate: '2024-02-15T23:59:59',
    status: 'active',
    description: '春节特惠，全场8折',
    holidayName: '春节',
    holidayYear: '2024'
  },
  {
    id: 2,
    name: 'iPhone 15 新品优惠',
    code: 'IPHONE15',
    type: 'product',
    discountType: 'fixed',
    discountValue: 200,
    minAmount: 5000,
    usageLimit: 50,
    usedCount: 12,
    userLimit: 1,
    startDate: '2024-01-01T00:00:00',
    endDate: '2024-12-31T23:59:59',
    status: 'active',
    description: 'iPhone 15 新品直降200元',
    productIds: [1, 2, 3]
  },
  {
    id: 3,
    name: '双十一狂欢',
    code: 'DOUBLE11',
    type: 'campaign',
    discountType: 'percentage',
    discountValue: 30,
    minAmount: 200,
    usageLimit: 0,
    usedCount: 2341,
    userLimit: 3,
    startDate: '2024-11-01T00:00:00',
    endDate: '2024-11-11T23:59:59',
    status: 'active',
    description: '双十一狂欢，最高7折',
    campaignName: '双十一'
  }
])

const products = ref([
  { id: 1, name: 'iPhone 15 Pro' },
  { id: 2, name: 'iPhone 15' },
  { id: 3, name: 'MacBook Pro' },
  { id: 4, name: 'iPad Air' },
  { id: 5, name: 'AirPods Pro' }
])

// 计算属性
const filteredCoupons = computed(() => {
  let result = coupons.value

  if (searchKeyword.value) {
    result = result.filter(coupon => 
      coupon.name.toLowerCase().includes(searchKeyword.value.toLowerCase()) ||
      coupon.code.toLowerCase().includes(searchKeyword.value.toLowerCase())
    )
  }

  if (statusFilter.value) {
    result = result.filter(coupon => coupon.status === statusFilter.value)
  }

  if (typeFilter.value) {
    result = result.filter(coupon => coupon.type === typeFilter.value)
  }

  return result
})

// 方法
const handleSearch = () => {
  // 搜索逻辑已在计算属性中处理
}

const handleFilter = () => {
  // 筛选逻辑已在计算属性中处理
}

const handleSelectionChange = (selection) => {
  selectedCoupons.value = selection
}

const handleBatchOperation = () => {
  ElMessage.info('批量操作功能开发中...')
}

const showCreateModal = () => {
  isEdit.value = false
  resetForm()
  showModal.value = true
}

const editCoupon = (coupon) => {
  isEdit.value = true
  Object.assign(couponForm, coupon)
  showModal.value = true
}

const viewCoupon = (coupon) => {
  selectedCoupon.value = coupon
  showDetailModal.value = true
}

const toggleCoupon = async (coupon) => {
  const action = coupon.status === 'active' ? '禁用' : '启用'
  try {
    await ElMessageBox.confirm(`确定要${action}这个优惠券吗？`, '确认操作')
    coupon.status = coupon.status === 'active' ? 'disabled' : 'active'
    ElMessage.success(`优惠券已${action}`)
  } catch {
    // 用户取消
  }
}

const deleteCoupon = async (coupon) => {
  try {
    await ElMessageBox.confirm('确定要删除这个优惠券吗？删除后不可恢复！', '确认删除', {
      type: 'warning'
    })
    const index = coupons.value.findIndex(c => c.id === coupon.id)
    if (index > -1) {
      coupons.value.splice(index, 1)
      ElMessage.success('优惠券已删除')
    }
  } catch {
    // 用户取消
  }
}

const handleTypeChange = () => {
  // 根据类型重置相关字段
  if (couponForm.type === 'product') {
    couponForm.productIds = []
  } else if (couponForm.type === 'holiday') {
    couponForm.holidayName = ''
    couponForm.holidayYear = null
  } else if (couponForm.type === 'campaign') {
    couponForm.campaignName = ''
  }
}

const saveCoupon = async () => {
  try {
    saving.value = true
    
    if (isEdit.value) {
      // 更新优惠券
      const index = coupons.value.findIndex(c => c.id === couponForm.id)
      if (index > -1) {
        coupons.value[index] = { ...couponForm }
      }
      ElMessage.success('优惠券已更新')
    } else {
      // 创建新优惠券
      const newCoupon = {
        ...couponForm,
        id: Date.now(),
        usedCount: 0,
        status: 'active'
      }
      coupons.value.unshift(newCoupon)
      ElMessage.success('优惠券已创建')
    }
    
    showModal.value = false
  } catch (error) {
    ElMessage.error('操作失败，请重试')
  } finally {
    saving.value = false
  }
}

const resetForm = () => {
  Object.assign(couponForm, {
    id: null,
    name: '',
    code: '',
    type: 'product',
    discountType: 'percentage',
    discountValue: 10,
    minAmount: 0,
    productIds: [],
    holidayName: '',
    holidayYear: null,
    campaignName: '',
    usageLimit: 0,
    userLimit: 1,
    startDate: null,
    endDate: null,
    description: ''
  })
}

const copyCode = (code) => {
  navigator.clipboard.writeText(code).then(() => {
    ElMessage.success('优惠券代码已复制到剪贴板')
  })
}

const getTypeText = (type) => {
  const typeMap = {
    product: '单产品',
    holiday: '节日',
    campaign: '活动'
  }
  return typeMap[type] || type
}

const getTypeTagType = (type) => {
  const typeMap = {
    product: 'primary',
    holiday: 'success',
    campaign: 'warning'
  }
  return typeMap[type] || 'info'
}

const getStatusText = (status) => {
  const statusMap = {
    active: '有效',
    expired: '已过期',
    disabled: '已禁用'
  }
  return statusMap[status] || status
}

const getStatusTagType = (status) => {
  const statusMap = {
    active: 'success',
    expired: 'info',
    disabled: 'danger'
  }
  return statusMap[status] || 'info'
}

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleString('zh-CN')
}

const handleSizeChange = (size) => {
  pageSize.value = size
}

const handleCurrentChange = (page) => {
  currentPage.value = page
}

onMounted(() => {
  // 初始化数据
  totalCoupons.value = coupons.value.length
})
</script>

<style scoped>
.coupons-container {
  padding: 20px;
  background: #f5f7fa;
  min-height: 100vh;
  position: relative;
  overflow: hidden;
}

/* 移除波动扫描效果，因为背景现在是浅白色 */

.page-header {
  margin-bottom: 20px;
  position: relative;
  z-index: 2;
}

.page-header h1 {
  color: #303133;
  margin: 0 0 8px 0;
  font-size: 28px;
  font-weight: 700;
}

.page-header p {
  color: #606266;
  margin: 0;
  font-size: 16px;
}

.action-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding: 20px;
  background: linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%);
  border-radius: 12px;
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.1),
    0 4px 16px rgba(0, 0, 0, 0.05),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
  position: relative;
  z-index: 2;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.search-section {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.search-input {
  width: 300px;
  min-width: 200px;
}

.action-buttons {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;
}

.coupons-list {
  background: linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%);
  border-radius: 12px;
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.1),
    0 4px 16px rgba(0, 0, 0, 0.05),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
  overflow: hidden;
  position: relative;
  z-index: 2;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.coupon-code {
  display: flex;
  align-items: center;
  gap: 8px;
}

.code-text {
  font-family: 'Courier New', monospace;
  font-weight: 600;
  color: #667eea;
  background: linear-gradient(135deg, #667eea, #764ba2);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.discount-info {
  font-weight: 600;
  color: #28a745;
  background: linear-gradient(135deg, #28a745, #20c997);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.valid-period {
  font-size: 12px;
  color: #6c757d;
}

.pagination {
  margin-top: 20px;
  display: flex;
  justify-content: center;
  position: relative;
  z-index: 2;
}

.coupon-detail {
  padding: 20px 0;
}

.unit {
  margin-left: 8px;
  color: #909399;
  font-size: 12px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

/* 按钮样式优化 */
.el-button {
  border-radius: 8px;
  font-weight: 600;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.el-button::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
  transition: left 0.5s ease;
}

.el-button:hover::before {
  left: 100%;
}

.el-button--primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
}

.el-button--primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
}

.el-button--success {
  background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
  border: none;
  box-shadow: 0 4px 15px rgba(40, 167, 69, 0.4);
}

.el-button--success:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(40, 167, 69, 0.6);
}

.el-button--warning {
  background: linear-gradient(135deg, #ffc107 0%, #fd7e14 100%);
  border: none;
  box-shadow: 0 4px 15px rgba(255, 193, 7, 0.4);
}

.el-button--warning:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(255, 193, 7, 0.6);
}

.el-button--danger {
  background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
  border: none;
  box-shadow: 0 4px 15px rgba(220, 53, 69, 0.4);
}

.el-button--danger:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(220, 53, 69, 0.6);
}

/* 表格样式优化 */
.el-table {
  border-radius: 12px;
  overflow: hidden;
}

.el-table th {
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  color: #495057;
  font-weight: 600;
  border: none;
}

.el-table td {
  border-bottom: 1px solid #f0f0f0;
}

.el-table tr:hover {
  background: linear-gradient(135deg, #f8f9ff 0%, #e3f2fd 100%);
}

/* 标签样式优化 */
.el-tag {
  border-radius: 20px;
  font-weight: 600;
  border: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.el-tag--primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.el-tag--success {
  background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
  color: white;
}

.el-tag--warning {
  background: linear-gradient(135deg, #ffc107 0%, #fd7e14 100%);
  color: white;
}

.el-tag--danger {
  background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
  color: white;
}

/* 输入框样式优化 */
.el-input__wrapper {
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 1px solid #e9ecef;
  transition: all 0.3s ease;
}

.el-input__wrapper:hover {
  border-color: #667eea;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
}

.el-input__wrapper.is-focus {
  border-color: #667eea;
  box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.2);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .action-bar {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
  }
  
  .search-section {
    flex-direction: column;
    gap: 12px;
  }
  
  .search-input {
    width: 100%;
  }
  
  .action-buttons {
    justify-content: center;
    flex-wrap: wrap;
  }
  
  .coupons-container {
    padding: 16px;
  }
  
  .page-header h1 {
    font-size: 24px;
  }
}

@media (max-width: 480px) {
  .action-buttons {
    flex-direction: column;
    width: 100%;
  }
  
  .action-buttons .el-button {
    width: 100%;
  }
}
</style>
