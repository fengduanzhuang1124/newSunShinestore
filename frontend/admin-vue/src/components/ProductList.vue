<template>
  <div class="product-list">
    <!-- 页面头部 -->
    <div class="page-header">
      <h1>全部商品</h1>
    </div>

    <!-- 筛选区域 -->
    <div class="filter-section">
      <div class="filter-row">
        <div class="filter-item">
          <label>商品名称</label>
          <el-input
            v-model="filterForm.productName"
            placeholder="请输入商品名称"
            clearable
            style="width: 200px"
          />
        </div>
        <div class="filter-item">
          <label>品牌</label>
          <el-select
            v-model="filterForm.brand"
            placeholder="请选择品牌"
            clearable
            style="width: 150px"
          >
            <el-option
              v-for="brand in brands"
              :key="brand.id"
              :label="brand.name"
              :value="brand.id"
            />
          </el-select>
        </div>
        <div class="filter-item">
          <label>分类</label>
          <el-select
            v-model="filterForm.category"
            placeholder="请选择分类"
            clearable
            style="width: 150px"
          >
            <el-option
              v-for="category in categories"
              :key="category.id"
              :label="category.name"
              :value="category.id"
            />
          </el-select>
        </div>

        <div class="filter-item">
          <label>剂型</label>
          <el-select
            v-model="filterForm.state"
            placeholder="请选择剂型"
            clearable
            style="width: 150px"
          >
            <el-option label="胶囊" value="capsule" />
            <el-option label="粉末" value="powder" />
            <el-option label="片剂" value="tablet" />
          </el-select>
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
            <el-option label="上架" value="active" />
            <el-option label="下架" value="inactive" />
            <el-option label="草稿" value="draft" />
          </el-select>
        </div>
        <div class="filter-item">
          <label>状态区域</label>
          <el-select
            v-model="filterForm.statusArea"
            placeholder="请选择区域"
            clearable
            style="width: 120px"
          >
            <el-option label="全部" value="" />
            <el-option label="上架区" value="active" />
            <el-option label="下架区" value="inactive" />
            <el-option label="草稿区" value="draft" />
          </el-select>
        </div>
        <div class="filter-actions">
          <el-button type="primary" @click="searchProducts">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </div>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="action-buttons">
      <el-button type="primary" @click="addProduct">
        <el-icon><Plus /></el-icon>
        新增商品
      </el-button>
      <el-button type="success" @click="batchEdit" :disabled="selectedProducts.length === 0">
        <el-icon><Edit /></el-icon>
        批量编辑 ({{ selectedProducts.length }})
      </el-button>
      <el-button type="success" plain @click="batchEnable" :disabled="selectedProducts.length === 0">
        批量上架 ({{ selectedProducts.length }})
      </el-button>
      <el-button type="warning" @click="batchDisable" :disabled="selectedProducts.length === 0">
        <el-icon><Lock /></el-icon>
        批量下架 ({{ selectedProducts.length }})
      </el-button>
      <el-button type="danger" @click="batchDelete" :disabled="selectedProducts.length === 0">
        <el-icon><Delete /></el-icon>
        批量删除 ({{ selectedProducts.length }})
      </el-button>
    </div>

    <!-- 状态区域快捷筛选 -->
    <div class="status-area-toolbar">
      <el-button :type="filterForm.statusArea === '' ? 'primary' : 'default'" size="small" @click="setStatusArea('')">
        全部
      </el-button>
      <el-button :type="filterForm.statusArea === 'active' ? 'primary' : 'default'" size="small" @click="setStatusArea('active')">
        上架 ({{ productStats.active }})
      </el-button>
      <el-button :type="filterForm.statusArea === 'inactive' ? 'primary' : 'default'" size="small" @click="setStatusArea('inactive')">
        下架 ({{ productStats.inactive }})
      </el-button>
      <el-button :type="filterForm.statusArea === 'draft' ? 'primary' : 'default'" size="small" @click="setStatusArea('draft')">
        草稿 ({{ productStats.draft }})
      </el-button>
    </div>

    <!-- 商品统计 -->
    <div class="product-summary">
      <span class="total-count">共 {{ totalProducts }} 条商品</span>
      <div class="status-counts">
        <span class="status-item active">上架: {{ productStats.active }}</span>
        <span class="status-item inactive">下架: {{ productStats.inactive }}</span>
        <span class="status-item draft">草稿: {{ productStats.draft }}</span>
      </div>
    </div>

    <!-- 商品列表 -->
    <div class="products-container">
      <el-table
        :data="products"
        v-loading="loading"
        style="width: 100%"
        table-layout="fixed"
        border
        resizable
        @selection-change="handleSelectionChange"
        @sort-change="handleSortChange"
      >
        <el-table-column type="selection" width="50" :selectable="checkSelectable" />
        <el-table-column prop="name" label="商品名称" width="250" sortable="custom" resizable show-overflow-tooltip>
          <template #default="scope">
            <div class="product-info">
              <div class="product-image">
                <img 
                  :src="scope.row.mainImages && scope.row.mainImages.length > 0 ? scope.row.mainImages[0] : 'https://via.placeholder.com/50x50'" 
                  :alt="scope.row.name" 
                />
              </div>
              <div class="product-details">
                <div class="product-name">{{ scope.row.name }}</div>
                <div class="product-id">ID: {{ scope.row.id }}</div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="brand" label="品牌" width="120" sortable="custom" resizable show-overflow-tooltip>
          <template #default="scope">
            {{ getBrandName(scope.row.brandId) }}
          </template>
        </el-table-column>
        <el-table-column prop="category" label="分类" width="120" sortable="custom" resizable show-overflow-tooltip>
          <template #default="scope">
            {{ getCategoryName(scope.row.categoryId) }}
          </template>
        </el-table-column>
        <el-table-column prop="state" label="剂型" width="100" sortable="custom" resizable show-overflow-tooltip>
          <template #default="scope">
            {{ getStateText(scope.row.state) }}
          </template>
        </el-table-column>
        <el-table-column prop="price" label="价格" width="100" sortable="custom" resizable show-overflow-tooltip>
          <template #default="scope">
            <span class="price">¥{{ scope.row.price }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="stock" label="库存" width="80" sortable="custom" resizable show-overflow-tooltip>
          <template #default="scope">
            {{ scope.row.stock }}
          </template>
        </el-table-column>
        <el-table-column prop="sales" label="销量" width="80" sortable="custom" resizable show-overflow-tooltip>
          <template #default="scope">
            {{ scope.row.sales }}
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100" sortable="custom" resizable show-overflow-tooltip>
          <template #default="scope">
            <el-tag
              :type="getStatusType(scope.row.status)"
              size="small"
            >
              {{ getStatusText(scope.row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createTime" label="创建时间" width="150" sortable="custom" resizable show-overflow-tooltip>
          <template #default="scope">
            {{ formatDate(scope.row.createTime) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="scope">
            <div class="action-buttons">
              <el-button
                v-if="scope.row.status === 'inactive' || scope.row.status === 'draft'"
                type="success"
                size="small"
                @click="enableProduct(scope.row)"
              >
                上架
              </el-button>
              <el-button
                v-if="scope.row.status === 'active'"
                type="warning"
                size="small"
                @click="disableProduct(scope.row)"
              >
                下架
              </el-button>
              <el-button
                type="primary"
                size="small"
                @click="editProduct(scope.row)"
              >
                编辑
              </el-button>
              <el-button
                size="small"
                @click="copyProduct(scope.row)"
              >
                复制
              </el-button>
              <el-button
                type="info"
                size="small"
                @click="viewProduct(scope.row)"
              >
                查看
              </el-button>
              <el-dropdown trigger="click">
                <el-button type="text" size="small">
                  更多<el-icon><ArrowDown /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item @click="copyProduct(scope.row)">复制商品</el-dropdown-item>
                    <el-dropdown-item @click="deleteProduct(scope.row)">删除商品</el-dropdown-item>
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
        :total="totalProducts"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
      />
    </div>

    <!-- 新增商品对话框 -->
    <AddProduct
      v-model="showAddProduct"
      :model="isEditing ? currentProduct : null"
      @success="handleProductSuccess"
    />

    <!-- 商品详情对话框 -->
    <ProductDetail
      v-model="showProductDetail"
      :product="currentProduct"
      @edit="editProduct"
    />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Edit, Lock, Delete, ArrowDown } from '@element-plus/icons-vue'
import axios from 'axios'
import AddProduct from './AddProduct.vue'
import ProductDetail from './ProductDetail.vue'

const loading = ref(false)
const route = useRoute()
const router = useRouter()
const products = ref([])
const selectedProducts = ref([])
const currentPage = ref(1)
const pageSize = ref(50)
const totalProducts = ref(0)
const showAddProduct = ref(false)
const showProductDetail = ref(false)
const currentProduct = ref(null)
const isEditing = ref(false)

const filterForm = reactive({
  productName: '',
  brand: '',
  category: '',
  status: '',
  statusArea: '',
  state: ''
})

const brands = ref([])
const categories = ref([])

const productStats = reactive({
  active: 156,
  inactive: 23,
  draft: 12
})

// 加载商品数据
const loadProducts = async () => {
  loading.value = true
  try {
    // 从localStorage加载商品数据
    const savedProducts = JSON.parse(localStorage.getItem('products') || '[]')
    const draftProducts = JSON.parse(localStorage.getItem('productDrafts') || '[]')
    
    // 合并所有商品
    const allProducts = [...savedProducts, ...draftProducts]
    
    // 根据筛选条件过滤
    let filteredProducts = allProducts
    
    if (filterForm.productName) {
      filteredProducts = filteredProducts.filter(product => 
        product.name.toLowerCase().includes(filterForm.productName.toLowerCase())
      )
    }
    
    if (filterForm.brand) {
      filteredProducts = filteredProducts.filter(product => 
        product.brandId === filterForm.brand
      )
    }
    
    if (filterForm.category) {
      filteredProducts = filteredProducts.filter(product => 
        product.categoryId === filterForm.category
      )
    }
    
    if (filterForm.status) {
      filteredProducts = filteredProducts.filter(product => 
        product.status === filterForm.status
      )
    }
    
    if (filterForm.statusArea) {
      filteredProducts = filteredProducts.filter(product => 
        product.status === filterForm.statusArea
      )
    }

    if (filterForm.state) {
      filteredProducts = filteredProducts.filter(product => 
        product.state === filterForm.state
      )
    }
    
    // 分页处理
    const startIndex = (currentPage.value - 1) * pageSize.value
    const endIndex = startIndex + pageSize.value
    
    products.value = filteredProducts.slice(startIndex, endIndex)
    totalProducts.value = filteredProducts.length
    
    // 更新统计信息
    updateProductStats(allProducts)
    
  } catch (error) {
    console.error('Failed to load products:', error)
    ElMessage.error('加载商品数据失败')
    products.value = []
    totalProducts.value = 0
  } finally {
    loading.value = false
  }
}

// 更新商品统计
const updateProductStats = (allProducts) => {
  productStats.active = allProducts.filter(p => p.status === 'active').length
  productStats.inactive = allProducts.filter(p => p.status === 'inactive').length
  productStats.draft = allProducts.filter(p => p.status === 'draft').length
}

// 快捷设置状态区域
const setStatusArea = (area) => {
  filterForm.statusArea = area
  currentPage.value = 1
  loadProducts()
}

// 批量上架
const batchEnable = async () => {
  if (selectedProducts.value.length === 0) return
  try {
    // 本地数据：把选中商品状态改为 active
    const productsList = JSON.parse(localStorage.getItem('products') || '[]')
    const draftsList = JSON.parse(localStorage.getItem('productDrafts') || '[]')
    const ids = new Set(selectedProducts.value.map(p => p.id))
    // 草稿转上架
    for (let i = draftsList.length - 1; i >= 0; i--) {
      if (ids.has(draftsList[i].id)) {
        const item = { ...draftsList[i], status: 'active', updateTime: new Date().toISOString() }
        productsList.unshift(item)
        draftsList.splice(i, 1)
      }
    }
    // 已在products中的，直接改状态
    for (let i = 0; i < productsList.length; i++) {
      if (ids.has(productsList[i].id)) {
        productsList[i].status = 'active'
        productsList[i].updateTime = new Date().toISOString()
      }
    }
    localStorage.setItem('products', JSON.stringify(productsList))
    localStorage.setItem('productDrafts', JSON.stringify(draftsList))
    ElMessage.success('批量上架成功')
    loadProducts()
  } catch (e) {
    ElMessage.error('批量上架失败')
  }
}

// 搜索商品
const searchProducts = () => {
  currentPage.value = 1
  loadProducts()
}

// 重置筛选
const resetFilters = () => {
  Object.assign(filterForm, {
    productName: '',
    brand: '',
    category: '',
    status: '',
    statusArea: ''
  })
  searchProducts()
}

// 新增商品
const addProduct = () => {
  showAddProduct.value = true
}

// 批量编辑
const batchEdit = () => {
  if (selectedProducts.value.length === 0) {
    ElMessage.warning('请选择要编辑的商品')
    return
  }
  ElMessage.info(`批量编辑 ${selectedProducts.value.length} 个商品`)
  // TODO: 实现批量编辑功能
}

// 批量下架
const batchDisable = async () => {
  if (selectedProducts.value.length === 0) {
    ElMessage.warning('请选择要下架的商品')
    return
  }
  
  try {
    await ElMessageBox.confirm(
      `确定要下架 ${selectedProducts.value.length} 个商品吗？`,
      '确认下架',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    // 本地：将已选中商品在 products 中置为 inactive（草稿忽略）
    const productsList = JSON.parse(localStorage.getItem('products') || '[]')
    const ids = new Set(selectedProducts.value.map(p => p.id))
    let changed = 0
    for (let i = 0; i < productsList.length; i++) {
      if (ids.has(productsList[i].id) && productsList[i].status !== 'inactive') {
        productsList[i].status = 'inactive'
        productsList[i].updateTime = new Date().toISOString()
        changed++
      }
    }
    localStorage.setItem('products', JSON.stringify(productsList))
    ElMessage.success(changed > 0 ? `已下架 ${changed} 个商品` : '无可下架的商品')
    loadProducts()
  } catch {
    // 用户取消
  }
}

// 批量删除
const batchDelete = async () => {
  if (selectedProducts.value.length === 0) {
    ElMessage.warning('请选择要删除的商品')
    return
  }
  
  try {
    await ElMessageBox.confirm(
      `确定要删除 ${selectedProducts.value.length} 个商品吗？此操作不可恢复！`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'error'
      }
    )
    
    // 本地：从 products 与 productDrafts 同时移除所选
    let productsList = JSON.parse(localStorage.getItem('products') || '[]')
    let draftsList = JSON.parse(localStorage.getItem('productDrafts') || '[]')
    const ids = new Set(selectedProducts.value.map(p => p.id))
    const beforeP = productsList.length
    const beforeD = draftsList.length
    productsList = productsList.filter(p => !ids.has(p.id))
    draftsList = draftsList.filter(p => !ids.has(p.id))
    const removed = (beforeP - productsList.length) + (beforeD - draftsList.length)
    localStorage.setItem('products', JSON.stringify(productsList))
    localStorage.setItem('productDrafts', JSON.stringify(draftsList))
    ElMessage.success(removed > 0 ? `已删除 ${removed} 个商品` : '未删除任何商品')
    // 清空当前选择
    selectedProducts.value = []
    loadProducts()
  } catch {
    // 用户取消
  }
}

// 上架商品
const enableProduct = async (product) => {
  try {
    // 本地数据存储：草稿转上架或将下架改为上架
    const productsList = JSON.parse(localStorage.getItem('products') || '[]')
    const draftsList = JSON.parse(localStorage.getItem('productDrafts') || '[]')

    // 若在草稿里，移到products并置为active
    const di = draftsList.findIndex(p => p.id === product.id)
    if (di !== -1) {
      const item = { ...draftsList[di], status: 'active', updateTime: new Date().toISOString() }
      productsList.unshift(item)
      draftsList.splice(di, 1)
    } else {
      // 若已在products里，直接改状态
      const pi = productsList.findIndex(p => p.id === product.id)
      if (pi !== -1) {
        productsList[pi].status = 'active'
        productsList[pi].updateTime = new Date().toISOString()
      }
    }

    localStorage.setItem('products', JSON.stringify(productsList))
    localStorage.setItem('productDrafts', JSON.stringify(draftsList))
    ElMessage.success('商品上架成功')
    loadProducts()
  } catch (error) {
    ElMessage.error('上架失败')
  }
}

// 下架商品
const disableProduct = async (product) => {
  try {
    const productsList = JSON.parse(localStorage.getItem('products') || '[]')
    const pi = productsList.findIndex(p => p.id === product.id)
    if (pi !== -1) {
      productsList[pi].status = 'inactive'
      productsList[pi].updateTime = new Date().toISOString()
      localStorage.setItem('products', JSON.stringify(productsList))
      ElMessage.success('商品下架成功')
      loadProducts()
    }
  } catch (error) {
    ElMessage.error('下架失败')
  }
}

// 编辑商品
const editProduct = (product) => {
  isEditing.value = true
  currentProduct.value = { ...product }
  showAddProduct.value = true
}

// 查看商品
const viewProduct = (product) => {
  currentProduct.value = product
  showProductDetail.value = true
}

// 复制商品
const copyProduct = (product) => {
  const newId = 'P' + Date.now()
  const cloned = {
    ...product,
    id: newId,
    code: newId,
    status: 'draft',
    createTime: new Date().toISOString(),
    updateTime: new Date().toISOString()
  }
  const drafts = JSON.parse(localStorage.getItem('productDrafts') || '[]')
  drafts.unshift(cloned)
  try {
    localStorage.setItem('productDrafts', JSON.stringify(drafts))
    ElMessage.success('已复制为草稿')
    loadProducts()
  } catch (e) {
    ElMessage.error('复制失败：存储空间不足')
  }
}

// 删除商品（同时从products和drafts里移除）
const deleteProduct = async (product) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除商品 "${product.name}" 吗？此操作不可恢复！`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'error'
      }
    )
    
    const productsList = JSON.parse(localStorage.getItem('products') || '[]')
    const draftsList = JSON.parse(localStorage.getItem('productDrafts') || '[]')
    const pi = productsList.findIndex(p => p.id === product.id)
    if (pi !== -1) productsList.splice(pi, 1)
    const di = draftsList.findIndex(p => p.id === product.id)
    if (di !== -1) draftsList.splice(di, 1)
    localStorage.setItem('products', JSON.stringify(productsList))
    localStorage.setItem('productDrafts', JSON.stringify(draftsList))
    ElMessage.success('商品删除成功')
    loadProducts()
  } catch {
    // 用户取消
  }
}

// 选择变化
const handleSelectionChange = (selection) => {
  selectedProducts.value = selection
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
    inactive: 'info',
    draft: 'warning'
  }
  return statusMap[status] || 'info'
}

// 获取品牌名称
const getBrandName = (brandId) => {
  const brand = brands.value.find(b => b.id === brandId)
  return brand ? brand.name : '未知品牌'
}

// 获取分类名称
const getCategoryName = (categoryId) => {
  const category = categories.value.find(c => c.id === categoryId)
  return category ? category.name : '未知分类'
}

// 获取状态文本
const getStatusText = (status) => {
  const statusMap = {
    active: '上架',
    inactive: '下架',
    draft: '草稿'
  }
  return statusMap[status] || '未知'
}

// 获取剂型文本
const getStateText = (state) => {
  const map = {
    capsule: '胶囊',
    powder: '粉末',
    tablet: '片剂',
    liquid: '液体'
  }
  return map[state] || ''
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
  loadProducts()
}

// 当前页变化
const handleCurrentChange = (val) => {
  currentPage.value = val
  loadProducts()
}

// 处理新增商品成功
const handleProductSuccess = () => {
  loadProducts()
}

onMounted(() => {
  // 加载品牌供筛选下拉
  try {
    const saved = JSON.parse(localStorage.getItem('brands') || '[]')
    brands.value = saved
  } catch { brands.value = [] }
  // 如果从品牌页带了brandId query，则应用筛选
  if (route.query.brandId) {
    filterForm.brand = route.query.brandId
  }
  // 加载分类供筛选下拉
  try {
    const savedCats = JSON.parse(localStorage.getItem('categories') || '[]')
    categories.value = savedCats
  } catch { categories.value = [] }
  loadProducts()
  // 监听storage同步
  window.addEventListener('storage', (e) => {
    if (e.key === 'brands') {
      try {
        const saved = JSON.parse(e.newValue || '[]')
        brands.value = saved
      } catch {}
    }
    if (e.key === 'categories') {
      try {
        const savedCats = JSON.parse(e.newValue || '[]')
        categories.value = savedCats
      } catch {}
    }
  })
})
</script>

<style scoped>
.product-list {
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

.status-area-toolbar {
  background: white;
  padding: 10px 15px 0 15px;
  border-radius: 0;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  margin: 0 0 10px 0;
  display: flex;
  gap: 8px;
}

.product-summary {
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

.status-item.draft {
  color: #e6a23c;
}

.products-container {
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

/* 商品信息样式 */
.product-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.product-image img {
  width: 40px;
  height: 40px;
  border-radius: 4px;
  object-fit: cover;
}

.product-details {
  flex: 1;
  min-width: 0;
}

.product-name {
  font-size: 14px;
  font-weight: 500;
  color: #333;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.product-id {
  font-size: 12px;
  color: #999;
}

.price {
  font-weight: 600;
  color: #e6a23c;
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
