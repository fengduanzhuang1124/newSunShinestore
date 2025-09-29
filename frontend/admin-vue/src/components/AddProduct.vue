<template>
  <el-dialog
    v-model="visible"
    title=""
    width="90%"
    :before-close="handleClose"
    class="add-product-dialog"
    :show-close="true"
    :close-on-click-modal="false"
  >
  <div class="dialog-bg-layer"></div>
  <div class="dialog-content">
 <!-- 顶部操作栏 -->
 <div class="ap-topbar">
      <div class="ap-title">新增商品</div>
      <div class="ap-actions">
        <el-button @click="handleClose">取消</el-button>
        <el-button type="primary" @click="submitProduct">保存</el-button>
      </div>
    </div>
  </div>
   

    <div class="add-product-container">
      <el-form
        ref="productFormRef"
        :model="productForm"
        :rules="productRules"
        label-width="120px"
        class="product-form"
      >
        <div class="ap-grid">
          <div class="ap-left">
            <!-- 基本信息 -->
            <div class="form-section">
              <h3 class="section-title">📝 基本信息</h3>
              <div class="form-grid">
            <el-form-item label="商品名称" prop="name" class="form-item-full">
              <el-input 
                v-model="productForm.name" 
                placeholder="请输入商品名称"
                size="large"
                prefix-icon="ShoppingBag"
              />
            </el-form-item>
            
            <el-form-item label="商品编号" prop="code" class="form-item-half">
              <el-input 
                v-model="productForm.code" 
                placeholder="系统自动生成" 
                disabled
                size="large"
              />
            </el-form-item>
            
            <el-form-item label="品牌" prop="brandId" class="form-item-half">
              <el-select
                v-model="productForm.brandId"
                placeholder="请选择品牌"
                size="large"
                @change="handleBrandChange"
              >
                <el-option
                  v-for="brand in brands"
                  :key="brand.id"
                  :label="brand.name"
                  :value="brand.id"
                />
              </el-select>
            </el-form-item>
            
            <el-form-item label="分类" prop="categoryId" class="form-item-half">
              <el-select
                v-model="productForm.categoryId"
                placeholder="请选择分类"
                size="large"
              >
                <el-option
                  v-for="category in categories"
                  :key="category.id"
                  :label="category.name"
                  :value="category.id"
                />
              </el-select>
            </el-form-item>

            <el-form-item label="剂型" prop="state" class="form-item-half">
              <el-select
                v-model="productForm.state"
                placeholder="请选择剂型"
                size="large"
              >
                <el-option label="胶囊" value="capsule" />
                <el-option label="粉末" value="powder" />
                <el-option label="片剂" value="tablet" />
              </el-select>
            </el-form-item>

            <el-form-item label="价格" prop="price" class="form-item-half">
              <el-input-number
                v-model="productForm.price"
                :min="0"
                :precision="2"
                placeholder="请输入价格"
                size="large"
                controls-position="right"
              />
            </el-form-item>
            
            <el-form-item label="库存" prop="stock" class="form-item-half">
              <el-input-number
                v-model="productForm.stock"
                :min="0"
                placeholder="请输入库存数量"
                size="large"
                controls-position="right"
              />
            </el-form-item>

            <el-form-item label="重量(kg)" prop="weight" class="form-item-half">
              <el-input-number
                v-model="productForm.weight"
                :min="0"
                :precision="2"
                placeholder="请输入重量"
                size="large"
                controls-position="right"
              />
            </el-form-item>
            
            <el-form-item label="商品状态" prop="status" class="form-item-half">
              <el-radio-group v-model="productForm.status" size="large">
                <el-radio label="draft" class="status-radio">📝 草稿</el-radio>
                <el-radio label="active" class="status-radio">✨ 上架</el-radio>
              </el-radio-group>
            </el-form-item>
              </div>
            </div>

            <!-- 商品详情（描述） -->
            <div class="form-section">
              <h3 class="section-title">📄 商品详情</h3>
              <el-form-item label="商品描述" prop="description" class="form-item-full">
                <el-input
                  v-model="productForm.description"
                  type="textarea"
                  :rows="6"
                  placeholder="请输入商品描述"
                  size="large"
                  resize="vertical"
                />
              </el-form-item>
            </div>
          </div>

          <div class="ap-right">
            <!-- 商品图片 -->
            <div class="form-section">
              <h3 class="section-title">🖼️ 商品图片</h3>
              <div class="image-upload-section">
            <el-form-item label="主图" prop="mainImages" class="image-upload-item">
              <el-upload
                class="image-uploader"
                :auto-upload="false"
                :show-file-list="false"
                :before-upload="beforeImageUpload"
                :on-change="handleMainImageChange"
                multiple
              >
                <div class="upload-area main-upload">
                  <div class="upload-content">
                    <el-icon class="upload-icon"><Plus /></el-icon>
                    <div class="upload-text">📸 点击上传主图</div>
                    <div class="upload-hint">支持多张图片，建议尺寸800x800</div>
                  </div>
                </div>
              </el-upload>
              <div v-if="productForm.mainImages.length > 0" class="image-preview">
                <div
                  v-for="(image, index) in productForm.mainImages"
                  :key="index"
                  class="image-item"
                >
                  <img :src="image" :alt="`主图${index + 1}`" />
                  <el-button
                    type="danger"
                    size="small"
                    circle
                    @click="removeMainImage(index)"
                    class="remove-btn"
                  >
                    <el-icon><Close /></el-icon>
                  </el-button>
                </div>
              </div>
            </el-form-item>
            
            <el-form-item label="详情图" prop="detailImages" class="image-upload-item">
              <el-upload
                class="image-uploader"
                :auto-upload="false"
                :show-file-list="false"
                :before-upload="beforeImageUpload"
                :on-change="handleDetailImageChange"
                multiple
              >
                <div class="upload-area detail-upload">
                  <div class="upload-content">
                    <el-icon class="upload-icon"><Plus /></el-icon>
                    <div class="upload-text">🎨 点击上传详情图</div>
                    <div class="upload-hint">支持多张图片，建议尺寸1200x800</div>
                  </div>
                </div>
              </el-upload>
              <div v-if="productForm.detailImages.length > 0" class="image-preview">
                <div
                  v-for="(image, index) in productForm.detailImages"
                  :key="index"
                  class="image-item"
                >
                  <img :src="image" :alt="`详情图${index + 1}`" />
                  <el-button
                    type="danger"
                    size="small"
                    circle
                    @click="removeDetailImage(index)"
                    class="remove-btn"
                  >
                    <el-icon><Close /></el-icon>
                  </el-button>
                </div>
              </div>
            </el-form-item>
              </div>
            </div>

            <!-- 商品规格 -->
            <div class="form-section">
              <h3 class="section-title">⚙️ 商品规格</h3>
              <el-form-item label="规格信息" class="specs-form-item">
                <div class="specs-container">
              <div
                v-for="(spec, index) in productForm.specs"
                :key="index"
                class="spec-item"
              >
                <el-input
                  v-model="spec.name"
                  placeholder="规格名称"
                  size="large"
                  prefix-icon="Setting"
                  @keyup.enter="saveSpec(index)"
                />
                <el-input
                  v-model="spec.value"
                  placeholder="规格值"
                  size="large"
                  prefix-icon="Document"
                  @keyup.enter="saveSpec(index)"
                />
                <el-button
                  type="danger"
                  size="large"
                  @click="removeSpec(index)"
                  :disabled="productForm.specs.length === 1"
                  class="remove-spec-btn"
                >
                  🗑️ 删除
                </el-button>
              </div>
              <el-button type="primary" size="large" @click="addSpec" class="add-spec-btn">
                ➕ 添加规格
              </el-button>
                </div>
              </el-form-item>
            </div>
          </div>
        </div>
      </el-form>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClose" size="large" class="cancel-btn">❌ 取消</el-button>
        <el-button type="info" @click="saveDraft" :loading="saving" size="large" class="draft-btn">
          📝 保存草稿
        </el-button>
        <el-button type="primary" @click="submitProduct" :loading="submitting" size="large" class="submit-btn">
          ✨ 提交商品
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Close } from '@element-plus/icons-vue'
import axios from 'axios'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  model: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['update:modelValue', 'success'])

const visible = ref(false)
const productFormRef = ref()
const saving = ref(false)
const submitting = ref(false)

const brands = ref([])
const categories = ref([])

const productForm = reactive({
  name: '',
  code: '',
  brandId: '',
  categoryId: '',
  state: '',
  price: 0,
  stock: 0,
  weight: 0,
  status: 'draft',
  description: '',
  mainImages: [],
  detailImages: [],
  specs: [{ name: '', value: '' }]
})

const productRules = {
  name: [
    { required: true, message: '请输入商品名称', trigger: 'blur' }
  ],
  brandId: [
    { required: true, message: '请选择品牌', trigger: 'change' }
  ],
  categoryId: [
    { required: true, message: '请选择分类', trigger: 'change' }
  ],
  // 剂型可选，不强制
  price: [
    { required: true, message: '请输入价格', trigger: 'blur' },
    { type: 'number', min: 0, message: '价格必须大于等于0', trigger: 'blur' }
  ],
  stock: [
    { required: true, message: '请输入库存数量', trigger: 'blur' },
    { type: 'number', min: 0, message: '库存必须大于等于0', trigger: 'blur' }
  ]
}

const uploadAction = '/api/upload' // 上传接口

// 监听visible变化
watch(() => props.modelValue, (newVal) => {
  visible.value = newVal
  if (newVal) {
    // 对话框打开时刷新品牌/分类，确保新创建的品牌可选
    loadBrandsAndCategories()
    // 若传入model则进入编辑模式，预填表单
    if (props.model) {
      Object.assign(productForm, {
        name: props.model.name || '',
        code: props.model.code || '',
        brandId: props.model.brandId || '',
        categoryId: props.model.categoryId || '',
        state: props.model.state || '',
        price: props.model.price || 0,
        stock: props.model.stock || 0,
        weight: props.model.weight || 0,
        status: props.model.status || 'draft',
        description: props.model.description || '',
        mainImages: Array.isArray(props.model.mainImages) ? [...props.model.mainImages] : [],
        detailImages: Array.isArray(props.model.detailImages) ? [...props.model.detailImages] : [],
        specs: Array.isArray(props.model.specs) && props.model.specs.length>0 ? props.model.specs.map(s=>({ ...s })) : [{ name:'', value:'' }]
      })
    }
  }
})

watch(visible, (newVal) => {
  emit('update:modelValue', newVal)
  if (newVal) {
    loadBrandsAndCategories()
  }
})

// 加载品牌和分类数据（优先使用localStorage）
const loadBrandsAndCategories = async () => {
  try {
    // 从localStorage取品牌
    const savedBrands = JSON.parse(localStorage.getItem('brands') || '[]')
    if (savedBrands.length > 0) {
      brands.value = savedBrands
    } else {
      // 兜底：没有本地品牌时给出示例
      brands.value = [
        { id: 'BR001', name: '示例品牌A' },
        { id: 'BR002', name: '示例品牌B' }
      ]
    }

    // 分类：只保留大类（不包含剂型），并清洗旧数据
    let savedCategories = []
    try { savedCategories = JSON.parse(localStorage.getItem('categories') || '[]') } catch { savedCategories = [] }
    const allowedNames = ['保健品', '洗护用品', '护肤品']
    if (!Array.isArray(savedCategories) || savedCategories.length === 0) {
      savedCategories = [
        { id: 'CAT001', name: '保健品' },
        { id: 'CAT006', name: '洗护用品' },
        { id: 'CAT007', name: '护肤品' }
      ]
    } else {
      savedCategories = savedCategories.filter(c => allowedNames.includes(c.name))
      if (savedCategories.length === 0) {
        savedCategories = [
          { id: 'CAT001', name: '保健品' },
          { id: 'CAT006', name: '洗护用品' },
          { id: 'CAT007', name: '护肤品' }
        ]
      }
    }
    localStorage.setItem('categories', JSON.stringify(savedCategories))
    categories.value = savedCategories
  } catch (error) {
    console.error('Failed to load brands and categories:', error)
  }
}

// 品牌变化处理
const handleBrandChange = (brandId) => {
  const brand = brands.value.find(b => b.id === brandId)
  if (brand) {
    console.log('Selected brand:', brand.name)
  }
}

// 图片上传前验证
const beforeImageUpload = (file) => {
  const isImage = file.type.startsWith('image/')
  const isLt5M = file.size / 1024 / 1024 < 5

  if (!isImage) {
    ElMessage.error('只能上传图片文件!')
    return false
  }
  if (!isLt5M) {
    ElMessage.error('图片大小不能超过 5MB!')
    return false
  }
  return true
}

// 使用canvas压缩图片，控制最大宽度与目标大小
const compressImage = (file, { maxWidth = 1200, quality = 0.7, targetKB = 160 } = {}) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        let { width, height } = img
        if (width > maxWidth) {
          height = Math.round((maxWidth / width) * height)
          width = maxWidth
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        // 逐步压缩以接近目标大小
        let q = quality
        let dataUrl = canvas.toDataURL('image/jpeg', q)
        const toKB = (b64) => Math.round((b64.length * (3 / 4)) / 1024)
        while (toKB(dataUrl) > targetKB && q > 0.4) {
          q -= 0.05
          dataUrl = canvas.toDataURL('image/jpeg', q)
        }
        resolve(dataUrl)
      }
      img.onerror = reject
      img.src = e.target.result
    }
    reader.onerror = reject
    reader.readAsDataURL(file.raw || file)
  })
}

// 主图文件变化处理
const handleMainImageChange = (file, fileList) => {
  if (file.status === 'ready') {
    compressImage(file.raw, { maxWidth: 900, quality: 0.75, targetKB: 140 })
      .then((dataUrl) => {
        productForm.mainImages.push(dataUrl)
        ElMessage.success('主图上传成功')
      })
      .catch(() => ElMessage.error('主图处理失败'))
  }
}

// 详情图文件变化处理
const handleDetailImageChange = (file, fileList) => {
  if (file.status === 'ready') {
    compressImage(file.raw, { maxWidth: 1200, quality: 0.7, targetKB: 160 })
      .then((dataUrl) => {
        productForm.detailImages.push(dataUrl)
        ElMessage.success('详情图上传成功')
      })
      .catch(() => ElMessage.error('详情图处理失败'))
  }
}

// 移除主图
const removeMainImage = (index) => {
  productForm.mainImages.splice(index, 1)
}

// 移除详情图
const removeDetailImage = (index) => {
  productForm.detailImages.splice(index, 1)
}

// 添加规格
const addSpec = () => {
  productForm.specs.push({ name: '', value: '' })
}

// 保存规格
const saveSpec = (index) => {
  const spec = productForm.specs[index]
  if (spec.name.trim() && spec.value.trim()) {
    ElMessage.success(`规格 "${spec.name}: ${spec.value}" 已保存`)
  } else {
    ElMessage.warning('请填写完整的规格信息')
  }
}

// 移除规格
const removeSpec = (index) => {
  if (productForm.specs.length > 1) {
    productForm.specs.splice(index, 1)
    ElMessage.success('规格已删除')
  }
}

// 尝试写入localStorage，超限时执行回退策略
const trySetLocalStorage = (key, value) => {
  try {
    localStorage.setItem(key, value)
    return true
  } catch (err) {
    // QuotaExceededError 处理：
    // 1) 清理最早的草稿（FIFO） 2) 若仍失败，去掉本次草稿的图片后再试
    if (err && String(err.name).includes('Quota')) {
      try {
        const drafts = JSON.parse(localStorage.getItem('productDrafts') || '[]')
        if (drafts.length > 0) {
          drafts.pop() // 移除最旧/最后一条
          localStorage.setItem('productDrafts', JSON.stringify(drafts))
          localStorage.setItem(key, value)
          return true
        }
      } catch {}
    }
    throw err
  }
}

// 保存草稿
const saveDraft = async () => {
  try {
    await productFormRef.value.validate()
    saving.value = true
    
    const isEdit = !!(props.model && props.model.id)
    const now = new Date().toISOString()
    const productId = isEdit ? props.model.id : 'P' + Date.now()
    const productData = {
      ...productForm,
      id: productId,
      code: isEdit ? (props.model.code || productId) : productId,
      status: 'draft',
      createTime: isEdit ? (props.model.createTime || now) : now,
      updateTime: now
    }
    
    // 保存到localStorage
    const existingProducts = JSON.parse(localStorage.getItem('productDrafts') || '[]')
    if (isEdit) {
      const idx = existingProducts.findIndex(p => p.id === productId)
      if (idx !== -1) existingProducts[idx] = productData
      else existingProducts.unshift(productData)
      // 若原商品在products中，移除之（转为草稿）
      const prodList = JSON.parse(localStorage.getItem('products') || '[]')
      const pi = prodList.findIndex(p => p.id === productId)
      if (pi !== -1) {
        prodList.splice(pi, 1)
        localStorage.setItem('products', JSON.stringify(prodList))
      }
    } else {
      existingProducts.unshift(productData)
    }
    try {
      trySetLocalStorage('productDrafts', JSON.stringify(existingProducts))
    } catch (err) {
      // 二次回退：去掉图片再存
      const lightData = { ...productData, mainImages: [], detailImages: [] }
      const idx = existingProducts.findIndex(p => p.id === productId)
      if (idx !== -1) existingProducts[idx] = lightData
      else existingProducts.unshift(lightData)
      trySetLocalStorage('productDrafts', JSON.stringify(existingProducts))
      ElMessage.warning('空间不足：已去除图片后保存草稿')
    }
    
    ElMessage.success('草稿保存成功')
    handleClose()
    emit('success')
  } catch (error) {
    console.error('Save draft failed:', error)
    ElMessage.error('保存草稿失败')
  } finally {
    saving.value = false
  }
}

// 提交商品
const submitProduct = async () => {
  try {
    await productFormRef.value.validate()
    submitting.value = true
    
    const isEdit = !!(props.model && props.model.id)
    const now = new Date().toISOString()
    const productId = isEdit ? props.model.id : 'P' + Date.now()
    const productData = {
      ...productForm,
      id: productId,
      code: isEdit ? (props.model.code || productId) : productId,
      status: 'active',
      createTime: isEdit ? (props.model.createTime || now) : now,
      updateTime: now
    }
    
    // 保存到localStorage
    const existingProducts = JSON.parse(localStorage.getItem('products') || '[]')
    if (isEdit) {
      const idx = existingProducts.findIndex(p => p.id === productId)
      if (idx !== -1) existingProducts[idx] = productData
      else existingProducts.unshift(productData)
      // 从草稿移除同id
      const drafts = JSON.parse(localStorage.getItem('productDrafts') || '[]')
      const di = drafts.findIndex(p => p.id === productId)
      if (di !== -1) {
        drafts.splice(di, 1)
        localStorage.setItem('productDrafts', JSON.stringify(drafts))
      }
    } else {
      existingProducts.unshift(productData)
    }
    localStorage.setItem('products', JSON.stringify(existingProducts))
    
    ElMessage.success('商品提交成功')
    handleClose()
    emit('success')
  } catch (error) {
    console.error('Submit product failed:', error)
    ElMessage.error('提交商品失败')
  } finally {
    submitting.value = false
  }
}

// 关闭对话框
const handleClose = () => {
  visible.value = false
  // 重置表单
  Object.assign(productForm, {
    name: '',
    code: '',
    brandId: '',
    categoryId: '',
    state: '',
    price: 0,
    stock: 0,
    weight: 0,
    status: 'draft',
    description: '',
    mainImages: [],
    detailImages: [],
    specs: [{ name: '', value: '' }]
  })
}

onMounted(() => {
  loadBrandsAndCategories()
  // 当其它页面（品牌&分类）更新localStorage时，这里也能同步
  window.addEventListener('storage', (e) => {
    if (e.key === 'brands') {
      try {
        const saved = JSON.parse(e.newValue || '[]')
        if (Array.isArray(saved)) brands.value = saved
      } catch {}
    }
  })
})
</script>

<style scoped>
.add-product-dialog {
  max-width: 1200px;
  border-radius: 16px;
  overflow: hidden;
}

:deep(.el-dialog__header) {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 20px 24px;
  border-radius: 16px 16px 0 0;
}

:deep(.el-dialog__title) {
  color: white;
  font-size: 20px;
  font-weight: 700;
}

:deep(.el-dialog__headerbtn) {
  top: 20px;
  right: 24px;
}

:deep(.el-dialog__close) {
  color: white;
  font-size: 20px;
}

:deep(.el-dialog__body) {
  padding: 0;
  /* 整个对话框背景色：柔和淡紫渐变 */
  background: linear-gradient(180deg, rgba(167,139,250,0.18) 0%, rgba(99,102,241,0.14) 100%);
}

/* 清除默认白色边缘：header/footer/对话框容器 */
:deep(.el-dialog) {
  background: transparent; /* 移除外层白底 */
  border-radius: 16px;
}
:deep(.el-dialog__header),
:deep(.el-dialog__footer) {
  /* 头部、底部与主体保持一致：透明，让主体背景贯穿 */
  background: transparent;
  border: none;
}
:deep(.el-dialog__header) { padding: 0 16px; }
:deep(.el-dialog__footer) { border-top: none; padding: 12px 16px; }

/* 统一遮罩与容器：避免四角透出白色 */
:deep(.el-overlay) { background: rgba(32, 24, 66, 0.35); backdrop-filter: blur(2px); }
:deep(.el-overlay-dialog) {
  background: linear-gradient(180deg, rgba(167,139,250,0.18), rgba(99,102,241,0.15));
}

.add-product-container {
  max-height: 75vh;
  overflow-y: auto;
  padding: 24px;
  position: relative;
  /* 页面级统一浅紫背景（与主体一致） */
  background: linear-gradient(180deg, rgba(167,139,250,0.18) 0%, rgba(99,102,241,0.14) 100%);
}

/* 全局激光扫描：纵向 + 斜向（左上→右下） */
.add-product-container::before,
.add-product-container::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
}

/* 纵向扫描，从上到下 */
.add-product-container::before {
  background: linear-gradient(
    to bottom,
    rgba(255,255,255,0) 40%,
    rgba(255,255,255,0.25) 50%,
    rgba(255,255,255,0) 60%
  );
  transform: translateY(-100%);
  animation: ap-scan-vertical 8s linear infinite;
}

/* 斜向扫描，左上到右下并缓慢旋转 */
.add-product-container::after {
  background: linear-gradient(
    45deg,
    rgba(255,255,255,0) 45%,
    rgba(255,255,255,0.22) 50%,
    rgba(255,255,255,0) 55%
  );
  transform-origin: center;
  animation: ap-scan-diag 10s linear infinite;
  opacity: 0.7;
}

@keyframes ap-scan-vertical {
  0% { transform: translateY(-100%); }
  100% { transform: translateY(100%); }
}

@keyframes ap-scan-diag {
  0% { transform: translate(-50%, -50%) rotate(0deg); }
  50% { transform: translate(50%, 50%) rotate(180deg); }
  100% { transform: translate(-50%, -50%) rotate(360deg); }
}

/* 顶部操作栏 */
.ap-topbar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  /* 与整体保持一致：透明，由主体背景提供颜色 */
  background: transparent;
  color: inherit;
  border-bottom: none;
}
.ap-title {
  font-weight: 700;
  font-size: 16px;
}
.ap-actions {
  display: flex;
  gap: 8px;
}

/* 双栏布局容器（预留后续迁移） */
.ap-grid {
  display: grid;
  /* 4:6 比例 */
  grid-template-columns: 4fr 6fr;
  gap: 24px;
  margin-bottom: 16px;
  align-items: start;
}
.ap-left, .ap-right { min-width: 0; }
.ap-card { margin-bottom: 16px; }
.ap-card-hd { font-weight: 600; }

/* 细化表单标签大小与颜色，降低存在感 */
:deep(.el-form-item__label) {
  font-size: 12px;
  color: #6b7280; /* slate-500 */
}

/* 卡片透明玻璃态 + 阴影层次 */
.form-section,
.ap-card {
  background: rgba(255, 255, 255, 0.65);
  backdrop-filter: saturate(180%) blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 16px;
  box-shadow: 0 12px 36px rgba(31, 41, 55, 0.12), inset 0 0 0 1px rgba(255,255,255,0.25);
  position: relative;
  overflow: hidden;
}

/* 科技感扫描线动画（微弱） */
.form-section::after,
.ap-card::after {
  content: "";
  position: absolute;
  left: -50%;
  top: -100%;
  width: 200%;
  height: 300%;
  background: linear-gradient(120deg, rgba(255,255,255,0) 44%, rgba(255,255,255,0.35) 50%, rgba(255,255,255,0) 56%);
  animation: ap-scan 8s linear infinite;
  pointer-events: none;
}

@keyframes ap-scan {
  0% { transform: translateY(0); }
  100% { transform: translateY(60%); }
}

/* 顶部栏透明度与阴影 */
.ap-topbar {
  background: transparent;
  color: inherit;
  border-bottom: none;
  box-shadow: none;
}
/* 让对话框容器成为定位上下文并裁切四角 */
:deep(.el-dialog) {
  position: relative;
  background: linear-gradient(120deg, rgba(255,255,255,0) 44%, rgba(255,255,255,0.35) 50%, rgba(255,255,255,0) 56%);
  animation: ap-scan 8s linear infinite;
  border-radius: 16px;
  overflow: hidden;              /* 裁掉四角白边 */
}

/* 背景层在最底 */
.dialog-bg-layer {
  position: absolute;
  inset: 0;
  z-index: 0;
  background: linear-gradient(180deg, rgba(167, 139, 250, 0.76), rgba(99,102,241,0.15));
}

/* 内容层盖在上面 */
.dialog-content {
  position: relative;
  z-index: 1;
}

/* 遮罩也统一风格（可选） */
:deep(.el-overlay) {
  background: rgba(20,16,40,0.35);
  backdrop-filter: blur(2px);
}


/* 右侧图片区域：更大的占位与预览 */
.ap-right .image-upload-section .upload-area { height: 260px; }
.ap-right .image-preview .image-item {
  width: 120px;
  height: 120px;
}
.ap-right .image-preview { gap: 12px; }

/* 卡片边缘光晕（科技感） */
.form-section::before,
.ap-card::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 16px;
  padding: 1px; /* 边框厚度 */
  background: linear-gradient(135deg, rgba(99,102,241,0.35), rgba(168,85,247,0.35), rgba(59,130,246,0.35));
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
          mask-composite: exclude;
  mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  pointer-events: none;
}

/* 输入与控件统一圆角与高度 */
:deep(.el-input__inner),
:deep(.el-textarea__inner),
:deep(.el-input-number .el-input__inner),
:deep(.el-select .el-input__inner) {
  border-radius: 10px;
  width: 100%;
}
  /* 1) 覆盖整个对话框容器，让四角不再透出白色 */
  :deep(.el-overlay-dialog) {
    background: linear-gradient(180deg, rgba(167,139,250,0.18), rgba(99,102,241,0.15));
  }

  /* 2) 遮罩层也统一淡紫，避免白色穿透 */
  :deep(.el-overlay) {
    background: rgba(20, 16, 40, 0.35); /* 比原始 mask 更紫一些，可按需调整 */
    backdrop-filter: blur(2px);
  }
/* 左侧“基本信息”表单更稳定的两列布局，避免挤压换行 */
.ap-left .form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(280px, 1fr));
  gap: 16px 20px;
}
.ap-left .form-item-full { grid-column: 1 / -1; }
.ap-left .form-item-half { grid-column: span 1; }
/* 兼容 Element 的内部布局，避免 label/控件挤压 */
:deep(.el-form-item) { min-width: 0; }
:deep(.el-form-item__content) { min-width: 0; width: 100%; }

.form-section {
  margin-bottom: 24px;
  padding: 24px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(102, 126, 234, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  transition: all 0.3s ease;
}

.form-section:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 40px rgba(102, 126, 234, 0.15);
}

.section-title {
  margin: 0 0 24px 0;
  font-size: 18px;
  font-weight: 700;
  color: #667eea;
  border-bottom: 3px solid #667eea;
  padding-bottom: 12px;
  position: relative;
}

.section-title::after {
  content: '';
  position: absolute;
  bottom: -3px;
  left: 0;
  width: 60px;
  height: 3px;
  background: linear-gradient(90deg, #667eea, #764ba2);
  border-radius: 2px;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
}

.form-item-full {
  grid-column: 1 / -1;
}

.form-item-half {
  grid-column: span 1;
}

@media (min-width: 768px) {
  .form-grid {
    grid-template-columns: 1fr 1fr;
  }
}

.product-form {
  padding: 0;
}

/* 状态单选按钮样式 */
.status-radio {
  margin-right: 20px;
  font-weight: 600;
}

.status-radio :deep(.el-radio__label) {
  font-size: 16px;
  color: #667eea;
}

/* 图片上传区域 */
.image-upload-section {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
}

@media (min-width: 768px) {
  .image-upload-section {
    grid-template-columns: 1fr 1fr;
  }
}

.image-upload-item {
  margin-bottom: 0;
}

.image-uploader {
  width: 100%;
}

.upload-area {
  width: 100%;
  height: 140px;
  border: 3px dashed #667eea;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s ease;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%);
  position: relative;
  overflow: hidden;
}

.upload-area::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
  transition: left 0.5s;
}

.upload-area:hover::before {
  left: 100%;
}

.upload-area:hover {
  border-color: #764ba2;
  transform: scale(1.02);
  box-shadow: 0 8px 25px rgba(102, 126, 234, 0.2);
}

.upload-content {
  text-align: center;
  z-index: 1;
}

.upload-icon {
  font-size: 32px;
  color: #667eea;
  margin-bottom: 12px;
  transition: all 0.3s ease;
}

.upload-area:hover .upload-icon {
  color: #764ba2;
  transform: scale(1.1);
}

.upload-text {
  font-size: 16px;
  color: #667eea;
  margin-bottom: 8px;
  font-weight: 600;
}

.upload-hint {
  font-size: 12px;
  color: #999;
  line-height: 1.4;
}

.image-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 16px;
}

.image-item {
  position: relative;
  width: 80px;
  height: 80px;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
}

.image-item:hover {
  transform: scale(1.05);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
}

.image-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.remove-btn {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 24px;
  height: 24px;
  padding: 0;
  border-radius: 50%;
  background: #ff4757;
  border: 2px solid white;
  box-shadow: 0 2px 8px rgba(255, 71, 87, 0.3);
}

/* 规格设置样式 */
.specs-form-item {
  margin-bottom: 0;
}

.specs-container {
  width: 100%;
}

.spec-item {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
  padding: 16px;
  background: rgba(102, 126, 234, 0.05);
  border-radius: 12px;
  border: 1px solid rgba(102, 126, 234, 0.1);
  transition: all 0.3s ease;
}

.spec-item:hover {
  background: rgba(102, 126, 234, 0.08);
  transform: translateX(4px);
}

.spec-item .el-input {
  flex: 1;
}

.remove-spec-btn {
  flex-shrink: 0;
  border-radius: 8px;
  font-weight: 600;
}

.add-spec-btn {
  border-radius: 12px;
  font-weight: 600;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
  transition: all 0.3s ease;
}

.add-spec-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
}

/* 对话框底部按钮 */
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 16px;
  padding: 20px 24px;
  /* 保持透明，让主体背景贯穿 */
  background: transparent;
  border-radius: 0 0 16px 16px;
}

.cancel-btn {
  border-radius: 12px;
  font-weight: 600;
  border: 2px solid #e0e0e0;
  color: #666;
  transition: all 0.3s ease;
}

.cancel-btn:hover {
  border-color: #ff4757;
  color: #ff4757;
  transform: translateY(-2px);
}

.draft-btn {
  border-radius: 12px;
  font-weight: 600;
  background: linear-gradient(135deg, #ffa726 0%, #ff7043 100%);
  border: none;
  box-shadow: 0 4px 15px rgba(255, 167, 38, 0.3);
  transition: all 0.3s ease;
}

.draft-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(255, 167, 38, 0.4);
}

.submit-btn {
  border-radius: 12px;
  font-weight: 600;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
  transition: all 0.3s ease;
}

.submit-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .add-product-dialog {
    width: 95% !important;
    margin: 0 auto;
  }
  
  .form-section {
    padding: 16px;
  }
  
  .spec-item {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  
  .dialog-footer {
    flex-direction: column;
    gap: 12px;
  }
  
  .dialog-footer .el-button {
    width: 100%;
  }
  
  .image-upload-section {
    grid-template-columns: 1fr;
  }
}
</style>
