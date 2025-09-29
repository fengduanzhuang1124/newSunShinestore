<template>
  <div class="brand-category">
    <!-- 页面头部 -->
    <div class="page-header">
      <h1>品牌分类</h1>
    </div>

    <!-- 筛选区域 -->
    <div class="filter-section">
      <div class="filter-row">
        <div class="filter-item">
          <label>品牌名称</label>
          <el-input
            v-model="filterForm.brandName"
            placeholder="请输入品牌名称"
            clearable
            style="width: 200px"
          />
        </div>
        <div class="filter-item">
          <label>品牌ID</label>
          <el-input
            v-model="filterForm.brandId"
            placeholder="请输入品牌ID"
            clearable
            style="width: 150px"
          />
        </div>
        <div class="filter-item">
          <label>状态</label>
          <el-select
            v-model="filterForm.status"
            placeholder="请选择状态"
            clearable
            style="width: 120px"
          >
            <el-option label="全部" value="" />
            <el-option label="启用" value="active" />
            <el-option label="禁用" value="inactive" />
          </el-select>
        </div>
        <div class="filter-actions">
          <el-button type="primary" @click="searchBrands">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </div>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="action-buttons">
      <el-button type="primary" @click="addBrand">
        <el-icon><Plus /></el-icon>
        新增品牌
      </el-button>
      <el-button type="success" @click="batchEdit" :disabled="selectedBrands.length === 0">
        <el-icon><Edit /></el-icon>
        批量编辑 ({{ selectedBrands.length }})
      </el-button>
      <el-button type="warning" @click="batchDisable" :disabled="selectedBrands.length === 0">
        <el-icon><Lock /></el-icon>
        批量禁用 ({{ selectedBrands.length }})
      </el-button>
    </div>

    <!-- 品牌统计 -->
    <div class="brand-summary">
      <span class="total-count">共 {{ totalBrands }} 条品牌</span>
      <div class="status-counts">
        <span class="status-item active">启用: {{ brandStats.active }}</span>
        <span class="status-item inactive">禁用: {{ brandStats.inactive }}</span>
      </div>
    </div>

    <!-- 品牌列表 -->
    <div class="brands-container">
      <el-table
        :data="brands"
        v-loading="loading"
        style="width: 100%"
        table-layout="fixed"
        border
        resizable
        @selection-change="handleSelectionChange"
        @sort-change="handleSortChange"
      >
        <el-table-column type="selection" width="50" :selectable="checkSelectable" />
        <el-table-column prop="logo" label="品牌Logo" width="100" resizable>
          <template #default="scope">
            <div class="brand-logo">
              <img :src="scope.row.logo" :alt="scope.row.name" />
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="品牌名称" width="200" sortable="custom" resizable show-overflow-tooltip>
          <template #default="scope">
            <div class="brand-info">
              <div class="brand-name">{{ scope.row.name }}</div>
              <div class="brand-id">ID: {{ scope.row.id }}</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="品牌描述" width="300" sortable="custom" resizable show-overflow-tooltip>
          <template #default="scope">
            <div class="brand-description">{{ scope.row.description }}</div>
          </template>
        </el-table-column>
        <el-table-column prop="productCount" label="商品数" width="100" sortable="custom" resizable show-overflow-tooltip>
          <template #default="scope">
            <span class="product-count">{{ scope.row.productCount }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="sales" label="销量" width="100" sortable="custom" resizable show-overflow-tooltip>
          <template #default="scope">
            <span class="sales-count">{{ scope.row.sales }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="rating" label="评分" width="100" sortable="custom" resizable show-overflow-tooltip>
          <template #default="scope">
            <div class="rating">
              <el-rate
                v-model="scope.row.rating"
                disabled
                show-score
                text-color="#ff9900"
                score-template="{value}"
              />
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100" sortable="custom" resizable show-overflow-tooltip>
          <template #default="scope">
            <el-tag :type="getStatusType(scope.row.status)" size="small">
              {{ getStatusText(scope.row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createTime" label="创建时间" width="150" sortable="custom" resizable show-overflow-tooltip>
          <template #default="scope">
            {{ formatDate(scope.row.createTime) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="scope">
            <div class="action-buttons">
              <el-button
                type="primary"
                size="small"
                @click="editBrand(scope.row)"
              >
                编辑
              </el-button>
              <el-button
                type="info"
                size="small"
                @click="viewBrand(scope.row)"
              >
                查看
              </el-button>
              <el-button type="danger" size="small" @click="deleteBrand(scope.row)">删除</el-button>
              <el-dropdown trigger="click">
                <el-button type="text" size="small">
                  更多<el-icon><ArrowDown /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item @click="viewProducts(scope.row)">查看该品牌商品</el-dropdown-item>
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
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :page-sizes="[20, 50, 100, 200]"
        :total="totalBrands"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
      />
    </div>

    <!-- 新增品牌对话框 -->
    <el-dialog
      v-model="addBrandModalVisible"
      title="新增品牌"
      width="600px"
      :before-close="handleClose"
    >
      <el-form
        ref="addBrandFormRef"
        :model="addBrandForm"
        :rules="addBrandRules"
        label-width="100px"
      >
        <el-form-item label="品牌名称" prop="name">
          <el-input v-model="addBrandForm.name" placeholder="请输入品牌名称" />
        </el-form-item>
        <el-form-item label="品牌描述" prop="description">
          <el-input
            v-model="addBrandForm.description"
            type="textarea"
            :rows="3"
            placeholder="请输入品牌描述"
          />
        </el-form-item>
        <el-form-item label="品牌Logo" prop="logo">
          <el-upload
            class="logo-uploader"
            :show-file-list="false"
            :before-upload="beforeLogoUpload"
            :http-request="handleLogoUpload"
          >
            <img v-if="addBrandForm.logo" :src="addBrandForm.logo" class="logo-preview" />
            <el-icon v-else class="logo-uploader-icon"><Plus /></el-icon>
          </el-upload>
        </el-form-item>
        <el-form-item label="品牌状态" prop="status">
          <el-radio-group v-model="addBrandForm.status">
            <el-radio label="active">启用</el-radio>
            <el-radio label="inactive">禁用</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addBrandModalVisible = false">取消</el-button>
        <el-button type="primary" @click="submitAddBrand">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Edit, Lock, ArrowDown } from '@element-plus/icons-vue'
import axios from 'axios'

const loading = ref(false)
const brands = ref([])
const selectedBrands = ref([])
const currentPage = ref(1)
const pageSize = ref(50)
const totalBrands = ref(0)

const filterForm = reactive({
  brandName: '',
  brandId: '',
  status: ''
})

const brandStats = reactive({
  active: 156,
  inactive: 23
})

// 新增品牌对话框
const addBrandModalVisible = ref(false)
const addBrandFormRef = ref()
const addBrandForm = reactive({
  name: '',
  description: '',
  logo: '',
  status: 'active'
})

const addBrandRules = {
  name: [
    { required: true, message: '请输入品牌名称', trigger: 'blur' }
  ],
  description: [
    { required: true, message: '请输入品牌描述', trigger: 'blur' }
  ]
}

// 从localStorage加载并按筛选与分页返回
const loadBrands = async () => {
  loading.value = true
  try {
    const all = JSON.parse(localStorage.getItem('brands') || '[]')

    // 过滤
    let filtered = all
    if (filterForm.brandName) {
      const kw = filterForm.brandName.toLowerCase()
      filtered = filtered.filter(b => (b.name || '').toLowerCase().includes(kw))
    }
    if (filterForm.brandId) {
      filtered = filtered.filter(b => String(b.id).includes(String(filterForm.brandId)))
    }
    if (filterForm.status) {
      filtered = filtered.filter(b => b.status === filterForm.status)
    }

    // 统计
    brandStats.active = all.filter(b => b.status === 'active').length
    brandStats.inactive = all.filter(b => b.status === 'inactive').length

    // 分页
    totalBrands.value = filtered.length
    const start = (currentPage.value - 1) * pageSize.value
    const end = start + pageSize.value
    brands.value = filtered.slice(start, end)
  } finally {
    loading.value = false
  }
}

// 搜索品牌
const searchBrands = () => {
  currentPage.value = 1
  loadBrands()
}

// 重置筛选
const resetFilters = () => {
  Object.assign(filterForm, {
    brandName: '',
    brandId: '',
    status: ''
  })
  searchBrands()
}

// 新增品牌
const addBrand = () => {
  addBrandModalVisible.value = true
  // 重置表单
  Object.assign(addBrandForm, {
    name: '',
    description: '',
    logo: '',
    status: 'active'
  })
}

// 提交新增/编辑品牌（保存到localStorage）
const submitAddBrand = async () => {
  try {
    await addBrandFormRef.value.validate()

    const all = JSON.parse(localStorage.getItem('brands') || '[]')
    if (addBrandForm.id) {
      const idx = all.findIndex(b => b.id === addBrandForm.id)
      if (idx !== -1) {
        all[idx] = { ...all[idx], ...addBrandForm }
      }
    } else {
      const id = 'BR' + Date.now()
      const brand = {
        id,
        name: addBrandForm.name,
        description: addBrandForm.description,
        logo: addBrandForm.logo || 'https://via.placeholder.com/60x60',
        status: addBrandForm.status,
        productCount: 0,
        sales: 0,
        rating: 4.5,
        createTime: new Date().toISOString()
      }
      all.unshift(brand)
    }
    localStorage.setItem('brands', JSON.stringify(all))

    ElMessage.success(addBrandForm.id ? '品牌已保存' : '品牌创建成功')
    addBrandModalVisible.value = false
    currentPage.value = 1
    loadBrands()
  } catch (error) {
    console.error('Validation failed:', error)
  }
}

// Logo上传前验证
const beforeLogoUpload = (file) => {
  const isImage = file.type.startsWith('image/')
  const isLt2M = file.size / 1024 / 1024 < 2

  if (!isImage) {
    ElMessage.error('只能上传图片文件!')
    return false
  }
  if (!isLt2M) {
    ElMessage.error('图片大小不能超过 2MB!')
    return false
  }
  return true
}

// 处理Logo上传
const handleLogoUpload = (options) => {
  const file = options.file
  const reader = new FileReader()
  reader.onload = (e) => {
    addBrandForm.logo = e.target.result
  }
  reader.readAsDataURL(file)
}

// 关闭对话框
const handleClose = (done) => {
  ElMessageBox.confirm('确认关闭？')
    .then(() => {
      done()
    })
    .catch(() => {})
}

// 批量编辑
const batchEdit = () => {
  if (selectedBrands.value.length === 0) {
    ElMessage.warning('请选择要编辑的品牌')
    return
  }
  ElMessage.info(`批量编辑 ${selectedBrands.value.length} 个品牌`)
  // TODO: 实现批量编辑功能
}

// 批量禁用
const batchDisable = async () => {
  if (selectedBrands.value.length === 0) {
    ElMessage.warning('请选择要禁用的品牌')
    return
  }
  
  try {
    await ElMessageBox.confirm(
      `确定要禁用 ${selectedBrands.value.length} 个品牌吗？`,
      '确认禁用',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    // TODO: 调用API禁用品牌
    ElMessage.success('品牌禁用成功')
    loadBrands()
  } catch {
    // 用户取消
  }
}

// 启用品牌（更新localStorage）
const enableBrand = async (brand) => {
  try {
    const all = JSON.parse(localStorage.getItem('brands') || '[]')
    const target = all.find(b => b.id === brand.id)
    if (target) target.status = 'active'
    localStorage.setItem('brands', JSON.stringify(all))
    ElMessage.success('品牌启用成功')
    loadBrands()
  } catch (error) {
    ElMessage.error('启用失败')
  }
}

// 禁用品牌（更新localStorage）
const disableBrand = async (brand) => {
  try {
    const all = JSON.parse(localStorage.getItem('brands') || '[]')
    const target = all.find(b => b.id === brand.id)
    if (target) target.status = 'inactive'
    localStorage.setItem('brands', JSON.stringify(all))
    ElMessage.success('品牌禁用成功')
    loadBrands()
  } catch (error) {
    ElMessage.error('禁用失败')
  }
}

// 编辑品牌
const editBrand = (brand) => {
  addBrandModalVisible.value = true
  Object.assign(addBrandForm, {
    id: brand.id,
    name: brand.name,
    description: brand.description,
    logo: brand.logo,
    status: brand.status
  })
}

// 查看品牌
const viewBrand = (brand) => {
  ElMessageBox.alert(`品牌名称：${brand.name}<br/>描述：${brand.description || '无'}<br/>状态：${getStatusText(brand.status)}`,
    '品牌详情', { dangerouslyUseHTMLString: true })
}

// 查看该品牌商品：跳转到商品列表并自动筛选品牌
const router = useRouter()
const viewProducts = (brand) => {
  // 通过路由 query 传递品牌ID，避免依赖 localStorage
  router.push({ path: '/products', query: { brandId: String(brand.id) } })
}

// 删除品牌（更新localStorage）
const deleteBrand = async (brand) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除品牌 "${brand.name}" 吗？此操作不可恢复！`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'error'
      }
    )
    
    const all = JSON.parse(localStorage.getItem('brands') || '[]')
    const next = all.filter(b => b.id !== brand.id)
    localStorage.setItem('brands', JSON.stringify(next))
    ElMessage.success('品牌删除成功')
    loadBrands()
  } catch {
    // 用户取消
  }
}

// 选择变化
const handleSelectionChange = (selection) => {
  selectedBrands.value = selection
}

// 排序变化
const handleSortChange = ({ column, prop, order }) => {
  console.log('Sort changed:', { column, prop, order })
  // TODO: 实现排序功能
}

// 检查是否可选择
const checkSelectable = (row) => {
  return row.status !== 'deleted'
}

// 获取状态类型
const getStatusType = (status) => {
  const statusMap = {
    active: 'success',
    inactive: 'info'
  }
  return statusMap[status] || 'info'
}

// 获取状态文本
const getStatusText = (status) => {
  const statusMap = {
    active: '启用',
    inactive: '禁用'
  }
  return statusMap[status] || '未知'
}

// 格式化日期
const formatDate = (date) => {
  if (!date) return ''
  return new Date(date).toLocaleString('zh-CN')
}

// 分页大小变化
const handleSizeChange = (val) => {
  pageSize.value = val
  currentPage.value = 1
  loadBrands()
}

// 当前页变化
const handleCurrentChange = (val) => {
  currentPage.value = val
  loadBrands()
}

onMounted(() => {
  loadBrands()
})
</script>

<style scoped>
.brand-category {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  overflow: hidden;
}

.page-header {
  background: white;
  padding: 20px;
  border-bottom: 1px solid #f0f0f0;
  flex-shrink: 0;
}

.page-header h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  color: #333;
}

.filter-section {
  background: white;
  padding: 15px;
  border-radius: 0;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  margin: 0;
  flex-shrink: 0;
}

.filter-row {
  display: flex;
  align-items: center;
  gap: 15px;
  flex-wrap: wrap;
}

.filter-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-item label {
  font-size: 14px;
  color: #666;
  white-space: nowrap;
}

.filter-actions {
  display: flex;
  gap: 10px;
}

.action-buttons {
  background: white;
  padding: 15px;
  border-radius: 0;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  margin: 0;
  flex-shrink: 0;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.brand-summary {
  background: white;
  padding: 15px;
  border-radius: 0;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  margin: 0;
  flex-shrink: 0;
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
  color: #666;
}

.status-item.active {
  color: #67c23a;
}

.status-item.inactive {
  color: #909399;
}

.brands-container {
  background: white;
  border-radius: 0;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  margin: 0;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.pagination-container {
  background: white;
  padding: 15px;
  border-radius: 0;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  margin: 0;
  flex-shrink: 0;
  display: flex;
  justify-content: center;
}

/* 品牌信息样式 */
.brand-logo img {
  width: 40px;
  height: 40px;
  border-radius: 4px;
  object-fit: cover;
}

.brand-info {
  flex: 1;
  min-width: 0;
}

.brand-name {
  font-size: 14px;
  font-weight: 500;
  color: #333;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.brand-id {
  font-size: 12px;
  color: #999;
}

.brand-description {
  font-size: 14px;
  color: #666;
  line-height: 1.4;
}

.product-count, .sales-count {
  font-weight: 600;
  color: #333;
}

.rating {
  display: flex;
  align-items: center;
}

/* 操作按钮样式 */
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

/* Logo上传样式 */
.logo-uploader {
  border: 1px dashed #d9d9d9;
  border-radius: 6px;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: border-color 0.3s;
}

.logo-uploader:hover {
  border-color: #409eff;
}

.logo-uploader-icon {
  font-size: 28px;
  color: #8c939d;
  width: 100px;
  height: 100px;
  line-height: 100px;
  text-align: center;
}

.logo-preview {
  width: 100px;
  height: 100px;
  object-fit: cover;
  display: block;
}

/* 表格样式 */
:deep(.el-table) {
  border-radius: 0;
  overflow: hidden;
  width: 100%;
  max-width: 100%;
  table-layout: fixed;
  flex: 1;
  height: 100%;
}

:deep(.el-table__body-wrapper) {
  max-height: calc(100vh - 400px);
  overflow-y: auto;
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .filter-row {
    flex-direction: column;
    align-items: stretch;
  }
  
  .filter-item {
    justify-content: space-between;
  }
  
  .action-buttons {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
