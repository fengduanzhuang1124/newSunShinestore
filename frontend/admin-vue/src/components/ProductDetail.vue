<template>
  <el-dialog
    v-model="visible"
    title="商品详情"
    width="80%"
    :before-close="handleClose"
    class="product-detail-dialog"
  >
    <div v-if="product" class="product-detail-container">
      <!-- 基本信息 -->
      <div class="detail-section">
        <h3 class="section-title">基本信息</h3>
        <el-row :gutter="20">
          <el-col :span="8">
            <div class="detail-item">
              <label>商品名称：</label>
              <span>{{ product.name }}</span>
            </div>
          </el-col>
          <el-col :span="8">
            <div class="detail-item">
              <label>商品编号：</label>
              <span>{{ product.id }}</span>
            </div>
          </el-col>
          <el-col :span="8">
            <div class="detail-item">
              <label>品牌：</label>
              <span>{{ product.brand }}</span>
            </div>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="8">
            <div class="detail-item">
              <label>分类：</label>
              <span>{{ product.category }}</span>
            </div>
          </el-col>
          <el-col :span="8">
            <div class="detail-item">
              <label>价格：</label>
              <span class="price">¥{{ product.price }}</span>
            </div>
          </el-col>
          <el-col :span="8">
            <div class="detail-item">
              <label>库存：</label>
              <span>{{ product.stock }}</span>
            </div>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="8">
            <div class="detail-item">
              <label>重量：</label>
              <span>{{ product.weight }}kg</span>
            </div>
          </el-col>
          <el-col :span="8">
            <div class="detail-item">
              <label>销量：</label>
              <span>{{ product.sales }}</span>
            </div>
          </el-col>
          <el-col :span="8">
            <div class="detail-item">
              <label>状态：</label>
              <el-tag :type="getStatusType(product.status)">
                {{ getStatusText(product.status) }}
              </el-tag>
            </div>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="24">
            <div class="detail-item">
              <label>商品描述：</label>
              <p class="description">{{ product.description || '暂无描述' }}</p>
            </div>
          </el-col>
        </el-row>
      </div>

      <!-- 商品图片 -->
      <div class="detail-section">
        <h3 class="section-title">商品图片</h3>
        <el-row :gutter="20">
          <el-col :span="12">
            <div class="image-section">
              <h4>主图</h4>
              <div v-if="product.mainImages && product.mainImages.length > 0" class="image-gallery">
                <div
                  v-for="(image, index) in product.mainImages"
                  :key="index"
                  class="image-item"
                >
                  <img :src="image" :alt="`主图${index + 1}`" @click="previewImage(image)" />
                </div>
              </div>
              <div v-else class="no-images">暂无主图</div>
            </div>
          </el-col>
          <el-col :span="12">
            <div class="image-section">
              <h4>详情图</h4>
              <div v-if="product.detailImages && product.detailImages.length > 0" class="image-gallery">
                <div
                  v-for="(image, index) in product.detailImages"
                  :key="index"
                  class="image-item"
                >
                  <img :src="image" :alt="`详情图${index + 1}`" @click="previewImage(image)" />
                </div>
              </div>
              <div v-else class="no-images">暂无详情图</div>
            </div>
          </el-col>
        </el-row>
      </div>

      <!-- 商品规格 -->
      <div v-if="product.specs && product.specs.length > 0" class="detail-section">
        <h3 class="section-title">商品规格</h3>
        <el-table :data="product.specs" border>
          <el-table-column prop="name" label="规格名称" />
          <el-table-column prop="value" label="规格值" />
        </el-table>
      </div>

      <!-- 时间信息 -->
      <div class="detail-section">
        <h3 class="section-title">时间信息</h3>
        <el-row :gutter="20">
          <el-col :span="12">
            <div class="detail-item">
              <label>创建时间：</label>
              <span>{{ formatDate(product.createTime) }}</span>
            </div>
          </el-col>
          <el-col :span="12">
            <div class="detail-item">
              <label>更新时间：</label>
              <span>{{ formatDate(product.updateTime) }}</span>
            </div>
          </el-col>
        </el-row>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClose">关闭</el-button>
        <el-button type="primary" @click="editProduct">编辑商品</el-button>
      </div>
    </template>

    <!-- 图片预览 -->
    <el-image-viewer
      v-if="previewVisible"
      :url-list="[previewImageUrl]"
      @close="previewVisible = false"
    />
  </el-dialog>
</template>

<script setup>
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  product: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['update:modelValue', 'edit'])

const visible = ref(false)
const previewVisible = ref(false)
const previewImageUrl = ref('')

// 监听visible变化
watch(() => props.modelValue, (newVal) => {
  visible.value = newVal
})

watch(visible, (newVal) => {
  emit('update:modelValue', newVal)
})

// 获取状态类型
const getStatusType = (status) => {
  const statusMap = {
    active: 'success',
    inactive: 'info',
    draft: 'warning'
  }
  return statusMap[status] || 'info'
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

// 格式化日期
const formatDate = (date) => {
  if (!date) return ''
  return new Date(date).toLocaleString('zh-CN')
}

// 预览图片
const previewImage = (imageUrl) => {
  previewImageUrl.value = imageUrl
  previewVisible.value = true
}

// 编辑商品
const editProduct = () => {
  emit('edit', props.product)
  handleClose()
}

// 关闭对话框
const handleClose = () => {
  visible.value = false
}
</script>

<style scoped>
.product-detail-dialog {
  max-width: 1000px;
}

.product-detail-container {
  max-height: 70vh;
  overflow-y: auto;
}

.detail-section {
  margin-bottom: 30px;
  padding: 20px;
  background: #fafafa;
  border-radius: 8px;
}

.section-title {
  margin: 0 0 20px 0;
  font-size: 16px;
  font-weight: 600;
  color: #333;
  border-bottom: 2px solid #409eff;
  padding-bottom: 8px;
}

.detail-item {
  margin-bottom: 15px;
  display: flex;
  align-items: flex-start;
}

.detail-item label {
  font-weight: 600;
  color: #666;
  min-width: 100px;
  margin-right: 10px;
}

.detail-item span {
  color: #333;
  flex: 1;
}

.price {
  color: #e6a23c;
  font-weight: 600;
  font-size: 16px;
}

.description {
  color: #666;
  line-height: 1.6;
  margin: 0;
  white-space: pre-wrap;
}

.image-section {
  margin-bottom: 20px;
}

.image-section h4 {
  margin: 0 0 15px 0;
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.image-gallery {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.image-item {
  width: 100px;
  height: 100px;
  border-radius: 4px;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.3s;
}

.image-item:hover {
  transform: scale(1.05);
}

.image-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.no-images {
  color: #999;
  font-style: italic;
  text-align: center;
  padding: 20px;
  background: #f5f5f5;
  border-radius: 4px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .product-detail-dialog {
    width: 95% !important;
  }
  
  .detail-section {
    padding: 15px;
  }
  
  .detail-item {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .detail-item label {
    margin-bottom: 5px;
  }
  
  .image-gallery {
    justify-content: center;
  }
}
</style>
