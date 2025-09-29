<template>
  <div class="shipping-page">
    <!-- 页面头部 -->
    <div class="page-header">
    <h1>运费管理</h1>
      <div class="header-actions">
        <button class="btn btn-primary" @click="openAddRuleModal">
          <i class="icon-plus"></i>
          新增规则
        </button>
        <button class="btn btn-secondary" @click="batchEditRules">
          <i class="icon-edit"></i>
          批量编辑
        </button>
      </div>
    </div>

    <!-- 搜索和筛选 -->
    <div class="search-section">
      <div class="search-box">
        <input 
          type="text" 
          v-model="searchKeyword" 
          placeholder="搜索运费规则..." 
          class="search-input"
          @input="filterRules"
        >
        <button class="search-btn" @click="filterRules">
          <i class="icon-search"></i>
        </button>
      </div>
      <div class="filter-options">
        <select v-model="statusFilter" @change="filterRules" class="filter-select">
          <option value="">全部状态</option>
          <option value="active">启用</option>
          <option value="inactive">禁用</option>
        </select>
        <select v-model="regionFilter" @change="filterRules" class="filter-select">
          <option value="">全部地区</option>
          <option value="mainland">中国大陆</option>
          <option value="nz">新西兰本地</option>
          <option value="au">澳洲奶粉</option>
          <option value="remote">偏远地区</option>
          <option value="taopu">Taopu品牌</option>
        </select>
      </div>
    </div>
    <!-- 主内容区域 -->
    <div class="main-content">
      <!-- 左侧：运费规则管理 -->
      <div class="rules-management-section">
        <div class="section-header">
          <h2>运费规则设置</h2>
          <div class="section-info">
            <span class="rule-count">共{{ shippingRules.length }}条规则</span>
          </div>
        </div>
        
        <!-- 批量编辑工具栏 -->
        <div v-if="batchEditMode" class="batch-toolbar">
          <div class="batch-info">
            <span>已选择 {{ selectedRules.length }} 条规则</span>
          </div>
          <div class="batch-actions">
            <button class="btn btn-sm btn-success" @click="batchEnableRules">
              <i class="icon-check"></i>
              批量启用
            </button>
            <button class="btn btn-sm btn-warning" @click="batchDisableRules">
              <i class="icon-pause"></i>
              批量禁用
            </button>
            <button class="btn btn-sm btn-danger" @click="batchDeleteRules">
              <i class="icon-delete"></i>
              批量删除
            </button>
            <button class="btn btn-sm btn-secondary" @click="exitBatchEdit">
              <i class="icon-close"></i>
              退出批量编辑
            </button>
          </div>
        </div>
        
        <!-- 规则列表 -->
        <div v-if="shippingRules.length > 0" class="rules-list">
          <div 
            v-for="rule in shippingRules" 
            :key="rule.id" 
            class="rule-card"
          >
            <div class="rule-header">
              <div class="rule-title">
                <h3>{{ rule.name }}</h3>
                <span class="rule-region">{{ getRegionName(rule.region) }}</span>
              </div>
              <div class="rule-actions">
                <span :class="['status-badge', rule.status === 'active' ? 'active' : 'inactive']">
                  {{ rule.status === 'active' ? '启用' : '禁用' }}
                </span>
                <div v-if="batchEditMode" class="batch-checkbox">
                  <input 
                    type="checkbox" 
                    :value="rule.id" 
                    v-model="selectedRules"
                    class="rule-checkbox"
                  >
                </div>
                <div v-else class="action-buttons">
                  <button class="btn btn-sm btn-primary" @click="editRule(rule)">
                    <i class="icon-edit"></i>
                    编辑
                  </button>
                  <button class="btn btn-sm btn-warning" @click="toggleRuleStatus(rule)">
                    <i class="icon-toggle"></i>
                    {{ rule.status === 'active' ? '禁用' : '启用' }}
                  </button>
                  <button class="btn btn-sm btn-danger" @click="deleteRule(rule)">
                    <i class="icon-delete"></i>
                    删除
                  </button>
                </div>
              </div>
            </div>
            
            <div class="rule-details">
              <div class="detail-row">
                <span class="label">运费标准:</span>
                <span class="value">${{ rule.ratePerKg }}/公斤</span>
              </div>
              <div class="detail-row">
                <span class="label">最小重量:</span>
                <span class="value">{{ rule.minWeight }}kg</span>
              </div>
              <div class="detail-row">
                <span class="label">计费规则:</span>
                <span class="value">{{ getBillingRule(rule.region) }}</span>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 空状态 -->
        <div v-else class="empty-state">
          <div class="empty-icon">
            <div class="shipping-box-icon">
              <div class="box-body"></div>
              <div class="box-tape"></div>
              <div class="box-label"></div>
            </div>
          </div>
          <h3>暂无运费规则</h3>
          <p>点击"新增规则"按钮创建第一个运费规则</p>
          <button class="btn btn-primary btn-large" @click="openAddRuleModal">
            <i class="icon-plus"></i>
            新增规则
          </button>
        </div>
      </div>

      <!-- 右侧：地区运费设置和计算器 -->
      <div class="right-section">
        <!-- 右侧上方：地区运费设置（横排） -->
        <div class="region-section">
          <div class="section-header">
            <h2>地区运费设置</h2>
          </div>
          
          <div class="region-grid-horizontal">
            <div 
              v-for="(config, region) in regionShippingConfig" 
              :key="region" 
              class="region-card-horizontal"
            >
              <div class="region-header">
                <h3>{{ config.name }}</h3>
                <span class="system-badge">基础规则</span>
              </div>
              
              <div class="region-rules">
                <!-- 中国大陆：显示基础运费和额外规则 -->
                <div v-if="region === 'mainland'" class="mainland-rules">
                  <div class="rule-item">
                    <span class="rule-label">基础运费</span>
                    <span class="rule-value">${{ config.ratePerKg }}/公斤</span>
                  </div>
                  
                  <div class="extra-rules">
                    <div v-for="rule in config.extraRules" :key="rule.name" class="extra-rule">
                      <span class="rule-label">{{ rule.name }}</span>
                      <span class="rule-value">+${{ rule.extraFee }}</span>
                      <span class="rule-regions">({{ rule.regions.join('、') }})</span>
                    </div>
                  </div>
                </div>
                
                <!-- 新西兰本地：只显示一个规则 -->
                <div v-else-if="region === 'nz'" class="rule-item">
                  <span class="rule-label">运费规则</span>
                  <span class="rule-value">订单满$200免邮，否则$7.99/公斤</span>
                </div>
                
                <!-- 澳洲奶粉：只显示一个规则 -->
                <div v-else-if="region === 'au'" class="rule-item">
                  <span class="rule-label">运费规则</span>
                  <span class="rule-value">澳洲奶粉免邮</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 右侧下方：运费计算器 -->
        <div class="calculator-section">
          <div class="section-header">
            <h2>运费计算器</h2>
          </div>
        
        <div class="calculator-container" :class="{ 'has-result': calculationResult }">
          <!-- 左侧：计算表单 -->
          <div class="calculator-form">
            <div class="form-group">
              <label>配送地区</label>
              <select v-model="calcForm.region" class="form-select">
                <option value="mainland-normal">大陆普通地区</option>
                <option value="mainland-remote">大陆偏远地区（新疆、西藏、甘肃、宁夏、青海）</option>
                <option value="nz">新西兰本地</option>
              </select>
            </div>
            
            <div class="form-group">
              <label>商品重量 (kg)</label>
              <input 
                type="number" 
                v-model="calcForm.weight" 
                class="form-input" 
                placeholder="0.00" 
                step="0.01" 
                min="0"
              >
            </div>
            
            <div class="form-group">
              <label>商品数量</label>
              <input 
                type="number" 
                v-model="calcForm.quantity" 
                class="form-input" 
                placeholder="1" 
                min="1"
              >
            </div>
            
            <div class="form-group">
              <label>订单金额 ($)</label>
              <input 
                type="number" 
                v-model="calcForm.orderAmount" 
                class="form-input" 
                placeholder="0.00" 
                step="0.01" 
                min="0"
              >
            </div>
            
            <button class="btn btn-primary" @click="calculateShipping">
              <i class="icon-calculator"></i>
              计算运费
            </button>
          </div>
          
          <!-- 右侧：结果显示 -->
          <div class="calculator-result" v-if="calculationResult">
            <div class="result-header">
              <h4>运费计算结果</h4>
            </div>
            <div class="result-details">
              <div class="detail-row">
                <span class="label">配送地区:</span>
                <span class="value">{{ getRegionDisplayName(calculationResult.region) }}</span>
              </div>
              <div class="detail-row">
                <span class="label">单件重量:</span>
                <span class="value">{{ calculationResult.weight }}kg</span>
              </div>
              <div class="detail-row">
                <span class="label">商品数量:</span>
                <span class="value">{{ calculationResult.quantity }}件</span>
              </div>
              <div class="detail-row">
                <span class="label">总重量:</span>
                <span class="value">{{ parseFloat(calculationResult.totalWeight).toFixed(2) }}kg</span>
              </div>
              <div class="detail-row">
                <span class="label">订单金额:</span>
                <span class="value">${{ calculationResult.orderAmount }}</span>
              </div>
              <div class="detail-row total">
                <span class="label">运费总计:</span>
                <span class="value fee">${{ calculationResult.shippingFee }}</span>
              </div>
            </div>
            <div class="result-actions">
              <button class="btn btn-sm btn-secondary" @click="clearCalculator">
                <i class="icon-clear"></i>
                清除
              </button>
            </div>
          </div>
        </div>
    </div>
    </div>
    </div>

    <!-- 新增/编辑规则模态框 -->
    <div class="modal" v-if="showRuleModal" @click="closeRuleModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>{{ editingRule ? '编辑运费规则' : '新增运费规则' }}</h3>
          <button class="close-btn" @click="closeRuleModal">&times;</button>
        </div>
        
        <div class="modal-body">
          <form @submit.prevent="submitRule">
            <div class="form-group">
              <label for="rule-name">规则名称</label>
              <input 
                type="text" 
                id="rule-name" 
                v-model="ruleForm.name" 
                class="form-input" 
                placeholder="请输入规则名称" 
                required
              >
            </div>
            
            <div class="form-group">
              <label for="rule-region">适用地区</label>
              <select id="rule-region" v-model="ruleForm.region" class="form-select" required>
                <option value="">请选择地区</option>
                <option value="mainland">中国大陆</option>
                <option value="nz">新西兰本地</option>
                <option value="au">澳洲奶粉</option>
                <option value="remote">偏远地区</option>
                <option value="taopu">Taopu品牌</option>
              </select>
            </div>
            
            <div class="form-group">
              <label for="rule-type">计费方式</label>
              <select id="rule-type" v-model="ruleForm.type" class="form-select" required>
                <option value="">请选择计费方式</option>
                <option value="weight">按重量计费</option>
                <option value="quantity">按数量计费</option>
                <option value="fixed">固定运费</option>
              </select>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label for="rule-min-weight">最小重量 (kg)</label>
                <input 
                  type="number" 
                  id="rule-min-weight" 
                  v-model="ruleForm.minWeight" 
                  class="form-input" 
                  placeholder="0.00" 
                  step="0.01" 
                  min="0"
                >
              </div>
              <div class="form-group">
                <label for="rule-max-weight">最大重量 (kg)</label>
                <input 
                  type="number" 
                  id="rule-max-weight" 
                  v-model="ruleForm.maxWeight" 
                  class="form-input" 
                  placeholder="999.99" 
                  step="0.01" 
                  min="0"
                >
              </div>
            </div>
            
            <div class="form-group">
              <label for="rule-fee">运费 (元)</label>
              <input 
                type="number" 
                id="rule-fee" 
                v-model="ruleForm.fee" 
                class="form-input" 
                placeholder="0.00" 
                step="0.01" 
                min="0" 
                required
              >
            </div>
            
            <div class="form-group">
              <label for="rule-status">状态</label>
              <select id="rule-status" v-model="ruleForm.status" class="form-select">
                <option value="active">启用</option>
                <option value="inactive">禁用</option>
              </select>
            </div>
          </form>
        </div>
        
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="closeRuleModal">取消</button>
          <button class="btn btn-primary" @click="submitRule">确定</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'

// 响应式数据
const searchKeyword = ref('')
const statusFilter = ref('')
const regionFilter = ref('')
const showRuleModal = ref(false)
const editingRule = ref(null)
const calculationResult = ref(null)
const batchEditMode = ref(false)
const selectedRules = ref([])

// 运费规则数据
const shippingRules = ref([])

// 地区运费配置 - 系统预设配置，不可编辑
const regionShippingConfig = ref({
  mainland: {
    name: '中国大陆',
    ratePerKg: 7.99,
    minWeight: 1,
    isSystem: true,
    description: '基础运费：7.99元/公斤',
    extraRules: [
      {
        name: '偏远地区',
        extraFee: 20,
        regions: ['新疆', '西藏', '甘肃', '宁夏', '青海'],
        description: '偏远地区额外运费：+20元'
      },
      {
        name: 'Taopu品牌奶粉',
        extraFee: 20,
        regions: ['海南', '内蒙古'],
        description: 'Taopu品牌奶粉额外运费：+20元'
      }
    ]
  },
  nz: {
    name: '新西兰本地',
    ratePerKg: 0,
    minWeight: 0,
    isSystem: true,
    description: '订单金额超过200纽币免邮，否则按7.99纽币/公斤计算'
  },
  au: {
    name: '澳洲奶粉',
    ratePerKg: 0,
    minWeight: 0,
    isSystem: true,
    description: '澳洲奶粉免邮'
  }
})

// 计算器表单
const calcForm = reactive({
  region: 'mainland-normal',
  weight: 0,
  quantity: 1,
  orderAmount: 0
})

// 规则表单
const ruleForm = reactive({
  name: '',
  region: '',
  type: '',
  minWeight: 0,
  maxWeight: 999,
  fee: 0,
  status: 'active'
})

// 计算属性
const filteredRules = computed(() => {
  let rules = shippingRules.value

  // 关键词搜索
  if (searchKeyword.value) {
    const keyword = searchKeyword.value.toLowerCase()
    rules = rules.filter(rule => 
      rule.name.toLowerCase().includes(keyword) ||
      rule.id.toLowerCase().includes(keyword) ||
      getRegionName(rule.region).toLowerCase().includes(keyword)
    )
  }

  // 状态筛选
  if (statusFilter.value) {
    rules = rules.filter(rule => rule.status === statusFilter.value)
  }

  // 地区筛选
  if (regionFilter.value) {
    rules = rules.filter(rule => rule.region === regionFilter.value)
  }

  return rules
})

// 方法
const getRegionName = (region) => {
  const regionMap = {
    'mainland': '中国大陆',
    'nz': '新西兰本地',
    'au': '澳洲奶粉',
    'remote': '偏远地区',
    'taopu': 'Taopu品牌奶粉',
    'hmt': '港澳台'
  }
  return regionMap[region] || region
}

const getTypeName = (type) => {
  const typeMap = {
    'weight': '按重量计费',
    'quantity': '按数量计费',
    'fixed': '固定运费'
  }
  return typeMap[type] || type
}

const getBillingRule = (region) => {
  const config = regionShippingConfig.value[region]
  if (!config) return ''
  
  if (region === 'mainland') {
    return '最低1公斤，不足1公斤按1公斤计算'
  } else if (region === 'nz') {
    return '订单金额≥$200免邮，否则按$7.99/公斤'
  } else if (region === 'au') {
    return '免邮'
  } else if (region === 'remote') {
    return '偏远地区额外运费+$20'
  } else if (region === 'taopu') {
    return 'Taopu品牌额外运费+$20'
  }
  return ''
}

const filterRules = () => {
  // 计算属性会自动更新
}

const openAddRuleModal = () => {
  editingRule.value = null
  resetRuleForm()
  showRuleModal.value = true
}

const editRule = (rule) => {
  editingRule.value = rule
  Object.assign(ruleForm, rule)
  showRuleModal.value = true
}

const closeRuleModal = () => {
  showRuleModal.value = false
  editingRule.value = null
  resetRuleForm()
}

const resetRuleForm = () => {
  Object.assign(ruleForm, {
    name: '',
    region: '',
    type: '',
    minWeight: 0,
    maxWeight: 999,
    fee: 0,
    status: 'active'
  })
}

const batchEditRules = () => {
  if (shippingRules.value.length === 0) {
    alert('没有可编辑的规则')
    return
  }
  
  batchEditMode.value = !batchEditMode.value
  if (!batchEditMode.value) {
    selectedRules.value = []
  }
}

const editRegionShipping = (region) => {
  alert(`编辑${regionShippingConfig.value[region].name}运费功能开发中...`)
}

// 批量操作方法
const batchEnableRules = async () => {
  if (selectedRules.value.length === 0) return
  
  const promises = selectedRules.value.map(ruleId => 
    toggleShippingRuleStatusAPI(ruleId)
  )
  
  try {
    await Promise.all(promises)
    selectedRules.value = []
    alert('批量启用成功！')
  } catch (error) {
    alert('批量启用失败！')
  }
}

const batchDisableRules = async () => {
  if (selectedRules.value.length === 0) return
  
  const promises = selectedRules.value.map(ruleId => 
    toggleShippingRuleStatusAPI(ruleId)
  )
  
  try {
    await Promise.all(promises)
    selectedRules.value = []
    alert('批量禁用成功！')
  } catch (error) {
    alert('批量禁用失败！')
  }
}

const batchDeleteRules = async () => {
  if (selectedRules.value.length === 0) return
  
  if (!confirm(`确定要删除选中的 ${selectedRules.value.length} 条规则吗？删除后无法恢复！`)) return
  
  const promises = selectedRules.value.map(ruleId => 
    deleteShippingRuleAPI(ruleId)
  )
  
  try {
    await Promise.all(promises)
    selectedRules.value = []
    alert('批量删除成功！')
  } catch (error) {
    alert('批量删除失败！')
  }
}

const calculateShippingFee = (region, totalWeight, productBrand = '', deliveryRegion = '', orderAmount = 0) => {
  let baseFee = 0
  let extraFee = 0
  
  // 中国大陆标准运费：7.99元/公斤
  if (region === 'mainland') {
    const calculatedWeight = Math.max(1, totalWeight)
    baseFee = calculatedWeight * 7.99
    
    // 偏远地区额外运费：+20元
    const remoteRegions = ['新疆', '西藏', '甘肃', '宁夏', '青海']
    if (remoteRegions.includes(deliveryRegion)) {
      extraFee += 20
    }
    
    // Taopu品牌奶粉额外运费：+20元
    const taopuRegions = ['海南', '内蒙古']
    if (productBrand.toLowerCase().includes('taopu') && taopuRegions.includes(deliveryRegion)) {
      extraFee += 20
    }
  }
  
  // 新西兰本地：订单金额超过200纽币免邮，否则按7.99纽币/公斤计算
  if (region === 'nz') {
    if (orderAmount >= 200) {
      baseFee = 0
    } else {
      const calculatedWeight = Math.max(1, totalWeight)
      baseFee = calculatedWeight * 7.99
    }
  }
  
  // 澳洲奶粉免邮
  if (region === 'au') {
    baseFee = 0
  }
  
  return baseFee + extraFee
}

// 新的简化计算函数
const calculateShippingFeeNew = (region, totalWeight, orderAmount = 0) => {
  let baseFee = 0
  let extraFee = 0
  
  // 大陆普通地区：7.99元/公斤
  if (region === 'mainland-normal') {
    const calculatedWeight = Math.max(1, totalWeight)
    baseFee = calculatedWeight * 7.99
  }
  
  // 大陆偏远地区：7.99元/公斤 + 20元
  if (region === 'mainland-remote') {
    const calculatedWeight = Math.max(1, totalWeight)
    baseFee = calculatedWeight * 7.99
    extraFee = 20
  }
  
  // 新西兰本地：订单金额超过200纽币免邮，否则按7.99纽币/公斤计算
  if (region === 'nz') {
    if (orderAmount >= 200) {
      baseFee = 0
    } else {
      const calculatedWeight = Math.max(1, totalWeight)
      baseFee = calculatedWeight * 7.99
    }
  }
  
  return baseFee + extraFee
}

// API调用方法
const loadShippingRules = async () => {
  try {
    const response = await fetch('/api/shipping/rules', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    })
    const data = await response.json()
    if (data.success) {
      shippingRules.value = data.data
    } else {
      console.error('加载运费规则失败:', data.message)
    }
  } catch (error) {
    console.error('加载运费规则失败:', error)
  }
}

const loadRegionConfig = async () => {
  try {
    const response = await fetch('/api/shipping/regions', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    })
    const data = await response.json()
    if (data.success) {
      regionShippingConfig.value = data.data
    } else {
      console.error('加载地区配置失败:', data.message)
    }
  } catch (error) {
    console.error('加载地区配置失败:', error)
  }
}

const saveShippingRule = async (ruleData) => {
  try {
    const url = editingRule.value ? `/api/shipping/rules/${editingRule.value.id}` : '/api/shipping/rules'
    const method = editingRule.value ? 'PUT' : 'POST'
    
    console.log('保存运费规则:', { url, method, ruleData })
    
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(ruleData)
    })
    
    console.log('响应状态:', response.status)
    const data = await response.json()
    console.log('响应数据:', data)
    
    if (data.success) {
      await loadShippingRules()
      return true
    } else {
      alert(data.message || '保存失败')
      return false
    }
  } catch (error) {
    console.error('保存运费规则失败:', error)
    alert(`保存失败: ${error.message}`)
    return false
  }
}

const deleteShippingRuleAPI = async (ruleId) => {
  try {
    const response = await fetch(`/api/shipping/rules/${ruleId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    })
    
    const data = await response.json()
    if (data.success) {
      await loadShippingRules()
      return true
    } else {
      alert(data.message || '删除失败')
      return false
    }
  } catch (error) {
    console.error('删除运费规则失败:', error)
    alert('删除失败')
    return false
  }
}

const toggleShippingRuleStatusAPI = async (ruleId) => {
  try {
    const response = await fetch(`/api/shipping/rules/${ruleId}/toggle`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    })
    
    const data = await response.json()
    if (data.success) {
      await loadShippingRules()
      return true
    } else {
      alert(data.message || '操作失败')
      return false
    }
  } catch (error) {
    console.error('切换状态失败:', error)
    alert('操作失败')
    return false
  }
}


// 更新现有方法
const submitRule = async () => {
  if (!ruleForm.name || !ruleForm.region || !ruleForm.type || ruleForm.fee === null) {
    alert('请填写所有必填字段！')
    return
  }

  const success = await saveShippingRule(ruleForm)
  if (success) {
    closeRuleModal()
    alert(editingRule.value ? '运费规则更新成功！' : '运费规则添加成功！')
  }
}

const toggleRuleStatus = async (rule) => {
  const success = await toggleShippingRuleStatusAPI(rule.id)
  if (success) {
    alert(`规则已${rule.status === 'active' ? '启用' : '禁用'}！`)
  }
}

const deleteRule = async (rule) => {
  if (!confirm('确定要删除这个运费规则吗？删除后无法恢复！')) return
  
  const success = await deleteShippingRuleAPI(rule.id)
  if (success) {
    alert('运费规则已删除！')
  }
}

const calculateShipping = () => {
  if (calcForm.weight <= 0) {
    alert('请输入有效的重量')
    return
  }

  if (calcForm.quantity <= 0) {
    alert('请输入有效的数量')
    return
  }

  console.log('计算运费参数:', {
    region: calcForm.region,
    weight: calcForm.weight,
    quantity: calcForm.quantity,
    orderAmount: calcForm.orderAmount
  })

  // 直接在前端计算运费
  const totalWeight = calcForm.weight * calcForm.quantity
  const shippingFee = calculateShippingFeeNew(
    calcForm.region, 
    totalWeight, 
    calcForm.orderAmount
  )

  console.log('计算结果:', {
    region: calcForm.region,
    weight: calcForm.weight,
    quantity: calcForm.quantity,
    totalWeight,
    orderAmount: calcForm.orderAmount,
    shippingFee
  })

  calculationResult.value = {
    region: calcForm.region,
    weight: calcForm.weight.toString(),
    quantity: calcForm.quantity,
    totalWeight: totalWeight.toString(),
    orderAmount: calcForm.orderAmount.toString(),
    shippingFee: shippingFee.toString()
  }
}

const clearCalculator = () => {
  calcForm.region = 'mainland-normal'
  calcForm.weight = 0
  calcForm.quantity = 1
  calcForm.orderAmount = 0
  calculationResult.value = null
}

const getRegionDisplayName = (region) => {
  const regionMap = {
    'mainland-normal': '大陆普通地区',
    'mainland-remote': '大陆偏远地区',
    'nz': '新西兰本地'
  }
  return regionMap[region] || region
}

// 生命周期
onMounted(async () => {
  await loadShippingRules()
  await loadRegionConfig()
})
</script>

<style scoped>
.shipping-page {
  padding: 24px;
  background: #f5f7fa;
  min-height: 100vh;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding: 16px 20px;
  background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  border: 1px solid #e9ecef;
  position: relative;
  overflow: hidden;
}

.page-header::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, #007bff, #28a745, #20c997);
}

.page-header h1 {
  margin: 0;
  color: #333;
  font-size: 24px;
  font-weight: 600;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.search-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding: 12px 16px;
  background: white;
  border-radius: 6px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}

.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
}

.search-input {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  width: 300px;
}

.search-btn {
  padding: 8px 12px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.filter-options {
  display: flex;
  gap: 12px;
}

.filter-select {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.rules-section, .region-section, .calculator-section {
  margin-bottom: 20px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  background: linear-gradient(135deg, #bfc9ef 0%, #f2def2 100%);
}

.region-section {
  flex-shrink: 0;
  background: linear-gradient(135deg, #bfc9ef 0%, #f5d8f5 100%);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #eee;
}

.section-header h2 {
  margin: 0;
  color: #333;
  font-size: 18px;
  font-weight: 600;
}

.section-info {
  color: #666;
  font-size: 14px;
}

.rules-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.rule-card {
  background: linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%);
  border: 1px solid #e9ecef;
  border-radius: 12px;
  padding: 16px;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
  box-shadow: 
    0 2px 4px -1px rgba(0, 0, 0, 0.1),
    0 1px 2px -1px rgba(0, 0, 0, 0.06),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
}

.rule-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, #007bff, #28a745);
  transform: scaleX(0);
  transition: transform 0.3s ease;
}

.rule-card:hover::before {
  transform: scaleX(1);
}

.rule-card:hover {
  transform: translateY(-2px);
  box-shadow: 
    0 4px 8px -1px rgba(0, 0, 0, 0.15),
    0 2px 4px -1px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
  border-color: #007bff;
}

.rule-card.rule-disabled {
  opacity: 0.6;
}

/* 规则头部 */
.rule-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #f0f0f0;
}

.rule-title h3 {
  margin: 0 0 4px 0;
  font-size: 16px;
  font-weight: 600;
  color: #2c3e50;
}

.rule-region {
  font-size: 12px;
  color: #6c757d;
  background: #f8f9fa;
  padding: 2px 8px;
  border-radius: 12px;
}

.rule-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-badge {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.status-badge.active {
  background: linear-gradient(135deg, #28a745, #20c997);
  color: white;
}

.status-badge.inactive {
  background: linear-gradient(135deg, #6c757d, #495057);
  color: white;
}

.action-buttons {
  display: flex;
  gap: 6px;
}

.batch-checkbox {
  display: flex;
  align-items: center;
}

.rule-checkbox {
  width: 16px;
  height: 16px;
}

/* 规则详情 */
.rule-details {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  padding: 4px 0;
}

.detail-row .label {
  color: #6c757d;
  font-weight: 500;
}

.detail-row .value {
  color: #2c3e50;
  font-weight: 600;
}

.rule-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}

.rule-info h3 {
  margin: 0 0 4px 0;
  color: #333;
  font-size: 16px;
  font-weight: 600;
}

.rule-id {
  color: #666;
  font-size: 12px;
}

.status-badge {
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  position: relative;
  overflow: hidden;
}

.status-badge::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
  transition: left 0.5s ease;
}

.status-badge:hover::before {
  left: 100%;
}

.status-active {
  background: linear-gradient(135deg, #28a745, #20c997);
  color: white;
  box-shadow: 0 2px 8px rgba(40,167,69,0.3);
}

.status-inactive {
  background: linear-gradient(135deg, #dc3545, #fd7e14);
  color: white;
  box-shadow: 0 2px 8px rgba(220,53,69,0.3);
}

.rule-details {
  margin-bottom: 16px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 14px;
}

.detail-row .label {
  color: #666;
}

.detail-row .value {
  color: #333;
  font-weight: 500;
}

.detail-row .value.fee {
  color: #007bff;
  font-weight: 600;
}

.rule-actions {
  display: flex;
  gap: 8px;
}

/* 主内容区域 */
.main-content {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  padding: 16px;
  max-width: 100%;
  margin: 0;
  max-height: calc(100vh - 200px);
  overflow: hidden;
 
}

/* 左侧：运费规则管理 */
.rules-management-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  max-height: calc(100vh - 250px);
  overflow-y: auto;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  padding: 20px;
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.1),
    0 4px 16px rgba(0, 0, 0, 0.05),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  color: white;
}

.rules-management-section .section-header h2 {
  color: #ffffff;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

/* 右侧：地区运费设置和计算器 */
.right-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
  height: 100%;
  max-height: calc(100vh - 250px);
}

/* 地区运费设置模块背景 */
.region-section {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  padding: 20px;
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.1),
    0 4px 16px rgba(0, 0, 0, 0.05),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.region-section .section-header h2 {
  color: #ffffff;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

/* 运费计算器模块背景 */
.calculator-section {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  padding: 20px;
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.1),
    0 4px 16px rgba(0, 0, 0, 0.05),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.calculator-section .section-header h2 {
  color: #ffffff;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.region-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 24px;
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
  background: linear-gradient(135deg, #bfc9ef 0%, #f5d8f5 100%);
}

/* 竖排地区列表 */
.region-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: linear-gradient(135deg, #bfc9ef 0%, #f5d8f5 100%);
}

/* 横排地区网格 */
.region-grid-horizontal {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  flex-shrink: 0;
  max-height: 180px;
  overflow-y: auto;
}

/* 横排地区卡片 */
.region-card-horizontal {
  background: linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%);
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 10px;
  transition: all 0.3s ease;
  box-shadow:
    0 1px 3px -1px rgba(0, 0, 0, 0.1),
    0 1px 2px -1px rgba(0, 0, 0, 0.06),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
  position: relative;
  overflow: hidden;
  min-height: 80px;
  display: flex;
  flex-direction: column;
}

.region-card-horizontal::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, #ced7e0, #c7e0cd, #e7d7a9, #e1c3c6);
  border-radius: 8px 8px 0 0;
}

.region-card-horizontal:hover {
  transform: translateY(-1px);
  box-shadow: 
    0 2px 6px -1px rgba(0, 0, 0, 0.15),
    0 1px 3px -1px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
}

/* 竖排地区卡片 */
.region-card-vertical {
  background: linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%);
  border: 1px solid #e9ecef;
  border-radius: 12px;
  padding: 16px;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 
    0 2px 4px -1px rgba(0, 0, 0, 0.1),
    0 1px 2px -1px rgba(0, 0, 0, 0.06),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
  position: relative;
  overflow: hidden;
  min-height: 100px;
  display: flex;
  flex-direction: column;
 
}

.region-card-vertical::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, #007bff, #28a745, #ffc107, #dc3545);
  border-radius: 16px 16px 0 0;
}

.region-card-vertical:hover {
  transform: translateY(-4px) scale(1.01);
  box-shadow: 
    0 12px 20px -5px rgba(0, 0, 0, 0.1),
    0 6px 8px -5px rgba(0, 0, 0, 0.04),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
  border-color: #007bff;
}

.region-card {
  background: linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%);
  border: 1px solid #e9ecef;
  border-radius: 16px;
  padding: 24px;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -1px rgba(0, 0, 0, 0.06),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
  position: relative;
  overflow: hidden;
  min-height: 180px;
  display: flex;
  flex-direction: column;
}

.region-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, #007bff, #28a745, #ffc107, #dc3545);
  border-radius: 16px 16px 0 0;
}

.region-card:hover {
  transform: translateY(-8px) scale(1.02);
  box-shadow: 
    0 20px 25px -5px rgba(0, 0, 0, 0.1),
    0 10px 10px -5px rgba(0, 0, 0, 0.04),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
  border-color: #007bff;
}

.extra-rules {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 2px solid #e9ecef;
  background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
  border-radius: 8px;
  padding: 16px;
  box-shadow: inset 0 2px 4px rgba(0,0,0,0.06);
}

.extra-rule {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  padding: 12px 16px;
  background: linear-gradient(145deg, #ffffff 0%, #f1f3f4 100%);
  border-radius: 10px;
  font-size: 14px;
  box-shadow: 
    0 2px 4px rgba(0,0,0,0.1),
    inset 0 1px 0 rgba(255,255,255,0.8);
  border: 1px solid #e9ecef;
  transition: all 0.3s ease;
  position: relative;
}

.extra-rule::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background: linear-gradient(180deg, #ff6b6b, #ff8e8e);
  border-radius: 10px 0 0 10px;
}

.extra-rule:hover {
  transform: translateX(4px);
  box-shadow: 
    0 4px 8px rgba(0,0,0,0.15),
    inset 0 1px 0 rgba(255,255,255,0.9);
}

.extra-rule:last-child {
  margin-bottom: 0;
}

.extra-rule .rule-label {
  font-weight: 600;
  color: #2c3e50;
  font-size: 15px;
}

.extra-rule .rule-value {
  color: #e74c3c;
  font-weight: 700;
  font-size: 16px;
  text-shadow: 0 1px 2px rgba(0,0,0,0.1);
}

.extra-rule .rule-regions {
  color: #7f8c8d;
  font-size: 12px;
  background: #ecf0f1;
  padding: 2px 8px;
  border-radius: 12px;
  font-weight: 500;
}

/* 中国大陆模块特殊样式 */
.mainland-rules {
  display: flex;
  flex-direction: column;
  gap: 6px;
    
}

.mainland-rules .rule-item {
  margin-bottom: 0;
}

.mainland-rules .extra-rules {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid #e9ecef;
  background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
  border-radius: 4px;
  padding: 8px;
  box-shadow: inset 0 1px 2px rgba(0,0,0,0.05);
}

.mainland-rules .extra-rule {
  margin-bottom: 4px;
  padding: 6px 8px;
  background: linear-gradient(145deg, #ffffff 0%, #f1f3f4 100%);
  border-radius: 4px;
  font-size: 12px;
}

.mainland-rules .extra-rule:last-child {
  margin-bottom: 0;
}

.region-card-horizontal .extra-rules {
  margin-top: 4px;
  padding-top: 4px;
  padding: 6px;
}

.region-card-horizontal .extra-rule {
  margin-bottom: 2px;
  padding: 3px 5px;
  font-size: 11px;
}

.region-card-horizontal .extra-rule .rule-label {
  font-size: 11px;
}

.region-card-horizontal .extra-rule .rule-value {
  font-size: 12px;
}

.region-card-horizontal .extra-rule .rule-regions {
  font-size: 10px;
}

.region-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid #f0f0f0;
  position: relative;
}

.region-card-horizontal .region-header {
  margin-bottom: 4px;
  padding-bottom: 2px;
}

.region-header::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 0;
  width: 40px;
  height: 2px;
  background: linear-gradient(90deg, #007bff, #28a745);
  border-radius: 1px;
}

.region-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: #2c3e50;
  text-shadow: 0 1px 2px rgba(0,0,0,0.1);
  letter-spacing: 0.5px;
}

.region-rules {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  justify-content: center;
}

.region-card-horizontal .region-rules {
  gap: 4px;
}

.region-card-horizontal .rule-item {
  padding: 4px 6px;
  font-size: 13px;
}

.region-card-horizontal .rule-label {
  font-size: 12px;
}

.region-card-horizontal .rule-value {
  font-size: 13px;
}

.rule-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  padding: 8px 12px;
  background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
  border-radius: 6px;
  border: 1px solid #e9ecef;
  box-shadow: 0 1px 2px rgba(0,0,0,0.08);
  transition: all 0.3s ease;
}

.rule-item:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(0,0,0,0.15);
}

.rule-label {
  color: #495057;
  font-weight: 600;
  font-size: 15px;
}

.rule-value {
  font-weight: 700;
  color: #2c3e50;
  font-size: 16px;
  text-shadow: 0 1px 2px rgba(0,0,0,0.1);
  background: linear-gradient(135deg, #007bff, #0056b3);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.rule-value.free {
  background: linear-gradient(135deg, #28a745, #20c997);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.calculator-container {
  display: flex;
  flex-direction: row;
  gap: 16px;
  padding: 0;
  height: 100%;
  max-height: 100%;
  width: 100%;
  overflow: hidden;
  transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
}

.calculator-container:not(.has-result) {
  justify-content: center;
  align-items: center;
}

.calculator-container.has-result {
  justify-content: space-between;
  align-items: stretch;
  gap: 16px;
}

.calculator-section {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 260px;
  background: linear-gradient(135deg, #bfc9ef 0%, #f5d8f5 100%);
}

.calculator-form {
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: linear-gradient(145deg, #f3e9f5 0%, #dacfe5 100%);
  border: 2px solid #eed8ef;
  border-radius: 12px;
  padding: 12px;
  box-shadow: 
    0 8px 20px rgba(102, 126, 234, 0.3),
    0 4px 8px rgba(0, 0, 0, 0.1),
    inset 0 1px 2px rgba(202, 169, 169, 0.2),
    inset 0 -1px 2px rgba(0, 0, 0, 0.1);
  position: relative;
  overflow: hidden;
  width: 100%;
  height: 100%;
  max-height: 100%;
  flex: 1;
  transform: perspective(800px) rotateX(1deg);
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  justify-content: center;
}

.calculator-form::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(74, 144, 226, 0.1) 0%, rgba(0, 123, 255, 0.05) 100%);
  border-radius: 14px;
  pointer-events: none;
}

.calculator-form:hover {
  transform: perspective(800px) rotateX(0deg) translateY(-2px);
  box-shadow: 
    0 12px 24px rgba(102, 126, 234, 0.4),
    0 6px 12px rgba(0, 0, 0, 0.2),
    inset 0 1px 2px rgba(243, 223, 223, 0.3),
    inset 0 -1px 2px rgba(0, 0, 0, 0.2);
}

.calculator-container:not(.has-result) .calculator-form {
  flex: 1;
  transform: perspective(800px) rotateX(1deg) scale(1);
  width: 100%;
  height: 100%;
  max-height: 100%;
  overflow: hidden;
}

.calculator-container.has-result .calculator-form {
  flex: 1;
  transform: perspective(800px) rotateX(0deg) scale(1);
  width: 100%;
  height: 100%;
  max-height: 100%;
  overflow: hidden;
}

.calculator-result {
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: linear-gradient(145deg, #f3e9f5 0%, #dacfe5 100%);
  border: 2px solid #eed8ef;
  border-radius: 12px;
  padding: 12px;
  box-shadow: 
    0 8px 20px rgba(102, 126, 234, 0.3),
    0 4px 8px rgba(0, 0, 0, 0.1),
    inset 0 1px 2px rgba(202, 169, 169, 0.2),
    inset 0 -1px 2px rgba(0, 0, 0, 0.1);
  width: 100%;
  height: 100%;
  max-height: 100%;
  flex: 1;
  transform: perspective(800px) rotateX(1deg);
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
  animation: slideInFromRight 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  justify-content: center;
}

.calculator-result::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(194, 191, 219, 0.1) 0%, rgba(247, 223, 249, 0.05) 100%);
  border-radius: 14px;
  pointer-events: none;
}

.calculator-result:hover {
  transform: perspective(800px) rotateX(0deg) translateY(-2px);
  box-shadow: 
    0 12px 24px rgba(102, 126, 234, 0.4),
    0 6px 12px rgba(0, 0, 0, 0.2),
    inset 0 1px 2px rgba(207, 185, 185, 0.3),
    inset 0 -1px 2px rgba(0, 0, 0, 0.2);
}

@keyframes slideInFromRight {
  0% {
    opacity: 0;
    transform: perspective(800px) rotateX(1deg) translateX(50px);
  }
  100% {
    opacity: 1;
    transform: perspective(800px) rotateX(1deg) translateX(0);
  }
}

.calculator-form::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, #007bff, #28a745);
  border-radius: 16px 16px 0 0;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}

.form-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
  flex: 0 0 auto;
}

.form-actions .btn {
  flex: 1;
  padding: 8px 16px;
  font-size: 12px;
  font-weight: 600;
}

.result-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
  flex: 0 0 auto;
}

.result-actions .btn {
  padding: 8px 16px;
  font-size: 12px;
  flex: 1;
}

.form-group label {
  color: #51514e;
  font-weight: 600;
  font-size: 12px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.form-input, .form-select {
  padding: 6px 10px;
  background: linear-gradient(145deg, #dcddf3 0%, #f8f9fa 100%);
  border: 2px solid #d1c4e9;
  border-radius: 6px;
  color: #333;
  font-size: 11px;
  font-weight: 500;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 
    inset 0 1px 2px rgba(0, 0, 0, 0.1),
    inset 0 -1px 2px rgba(243, 230, 230, 0.8);
}

.form-input:focus, .form-select:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 
    0 0 0 3px rgba(102, 126, 234, 0.3),
    inset 0 1px 2px rgba(0, 0, 0, 0.1),
    inset 0 -1px 2px rgba(255, 255, 255, 0.8);
  transform: translateY(-1px);
}

.form-input::placeholder {
  color: #8a9ba8;
  text-shadow: none;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.calculator-result {
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border: 1px solid #dee2e6;
  border-radius: 12px;
  padding: 24px;
  position: relative;
  overflow: hidden;
}

.calculator-result::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, #28a745, #20c997);
}

.result-header h4 {
  margin: 0 0 16px 0;
  color: #ffffff;
  font-size: 16px;
  font-weight: 600;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.result-details {
  background: linear-gradient(145deg, #f3e9f5 0%, #dacfe5 100%);
  border-radius: 8px;
  padding: 8px;
  border: 1px solid #eed8ef;
  margin-top: 6px;
}

.result-details .detail-row {
  margin-bottom: 8px;
  padding: 6px 0;
  border-bottom: 1px solid rgba(139, 92, 246, 0.2);
  flex: 0 0 auto;
}

.result-details .detail-row .label {
  color: #5a4a6a;
  font-weight: 500;
  margin-right: 8px;
  text-shadow: 0 1px 2px rgba(255, 255, 255, 0.3);
}

.result-details .detail-row .value {
  color: #4a3a5a;
  font-weight: 600;
  text-shadow: 0 1px 2px rgba(255, 255, 255, 0.3);
}

.result-details .detail-row.total {
  border-top: 2px solid #d1c4e9;
  padding-top: 12px;
  margin-top: 12px;
  background: linear-gradient(135deg, rgba(209, 196, 233, 0.2) 0%, rgba(156, 136, 255, 0.1) 100%);
  border-radius: 8px;
  padding: 12px;
  font-weight: 600;
}

.result-details .detail-row.total .label {
  color: #4a3a5a;
  font-size: 16px;
  font-weight: 700;
  text-shadow: 0 1px 2px rgba(255, 255, 255, 0.3);
}

.result-details .detail-row.total .value.fee {
  color: #202d27;
  font-size: 18px;
  font-weight: 700;
  text-shadow: 0 1px 3px rgba(0, 255, 136, 0.3);
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #666;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-state h3 {
  margin: 0 0 8px 0;
  color: #333;
}

.empty-state p {
  margin: 0 0 20px 0;
}

.modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #eee;
}

.modal-header h3 {
  margin: 0;
  color: #333;
  font-size: 18px;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
}

.modal-body {
  padding: 20px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px;
  border-top: 1px solid #eee;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.3s ease;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  position: relative;
  overflow: hidden;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
  transition: left 0.5s ease;
}

.btn:hover::before {
  left: 100%;
}

.btn-primary {
  background: linear-gradient(135deg, #9c88ff 0%, #b19cd9 100%);
  color: #ffffff;
  box-shadow: 
    0 6px 12px rgba(156, 136, 255, 0.3),
    0 3px 6px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  border: 2px solid #d1c4e9;
}

.btn-primary:hover {
  background: linear-gradient(135deg, #b19cd9 0%, #9c88ff 100%);
  transform: translateY(-2px);
  box-shadow: 
    0 8px 16px rgba(156, 136, 255, 0.4),
    0 4px 8px rgba(0, 0, 0, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
}

.btn-secondary {
  background: linear-gradient(135deg, #6c757d, #545b62);
  color: white;
  box-shadow: 0 4px 12px rgba(108,117,125,0.3);
}

.btn-secondary:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(108,117,125,0.4);
}

.btn-danger {
  background: linear-gradient(135deg, #dc3545, #c82333);
  color: white;
  box-shadow: 0 4px 12px rgba(220,53,69,0.3);
}

.btn-danger:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(220,53,69,0.4);
}

.btn-sm {
  padding: 3px 6px;
  font-size: 11px;
}

.icon-plus::before { content: '+'; }
.icon-edit::before { content: '✏️'; }
.icon-toggle::before { content: '🔄'; }
.icon-delete::before { content: '🗑️'; }
.icon-search::before { content: '🔍'; }
.icon-calculator::before { content: '🧮'; }
.icon-shipping::before { content: '📦'; }
.icon-check::before { content: '✓'; }
.icon-close::before { content: '✕'; }
.icon-clear::before { content: '🗑️'; }

/* 系统配置徽章 */
.system-badge {
  padding: 6px 12px;
  background: linear-gradient(135deg, #6c757d, #495057);
  color: white;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  box-shadow: 
    0 2px 4px rgba(0,0,0,0.2),
    inset 0 1px 0 rgba(255,255,255,0.3);
  border: 1px solid rgba(255,255,255,0.2);
  text-shadow: 0 1px 2px rgba(0,0,0,0.3);
}

/* 批量编辑工具栏 */
.batch-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: linear-gradient(135deg, #e3f2fd, #f3e5f5);
  border-bottom: 1px solid #e0e0e0;
  margin-bottom: 0;
}

.batch-actions {
  display: flex;
  gap: 12px;
}

.selected-count {
  color: #007bff;
  font-weight: 600;
  margin-left: 8px;
}

/* 规则选择状态 */
.rule-selected {
  border-color: #007bff !important;
  background: linear-gradient(135deg, #f8f9ff, #e3f2fd) !important;
  box-shadow: 0 0 0 2px rgba(0,123,255,0.2) !important;
}

.rule-checkbox {
  margin-right: 12px;
  display: flex;
  align-items: center;
}

.rule-checkbox-input {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.rule-info {
  display: flex;
  align-items: center;
  flex: 1;
}

.rule-title {
  flex: 1;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .shipping-page {
    padding: 16px;
  }
  
  .page-header {
    flex-direction: column;
    gap: 16px;
    align-items: flex-start;
  }
  
  .search-section {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
  }
  
  .search-box {
    width: 100%;
  }
  
  .search-input {
    width: 100%;
  }
  
  .filter-options {
    flex-direction: column;
    gap: 8px;
  }
  
  .rules-grid {
    grid-template-columns: 1fr;
  }
  
  .region-grid {
    grid-template-columns: 1fr;
  }
  
  .calculator-container {
    grid-template-columns: 1fr;
  }
  
  .form-row {
    grid-template-columns: 1fr;
  }
  
  .rule-actions {
    flex-wrap: wrap;
  }
  
  .modal-content {
    width: 95%;
    margin: 20px;
  }
}

/* 加载状态 */
.loading {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 40px;
  color: #666;
}

.loading::before {
  content: '';
  width: 20px;
  height: 20px;
  border: 2px solid #f3f3f3;
  border-top: 2px solid #007bff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-right: 10px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* 成功/错误提示 */
.alert {
  padding: 12px 16px;
  border-radius: 4px;
  margin-bottom: 16px;
  font-size: 14px;
}

.alert-success {
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.alert-error {
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

/* 动画效果 */
.rule-card {
  transition: all 0.3s ease;
}

.rule-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 16px rgba(0,0,0,0.15);
}

.btn {
  transition: all 0.3s ease;
}

.btn:hover {
  transform: translateY(-1px);
}

.btn:active {
  transform: translateY(0);
}

/* 状态指示器 */
.status-indicator {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 8px;
}

.status-indicator.active {
  background: #28a745;
}

.status-indicator.inactive {
  background: #dc3545;
}

/* 运费计算器增强 */
.calculator-result {
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 表单验证样式 */
.form-input.error,
.form-select.error {
  border-color: #dc3545;
  box-shadow: 0 0 0 2px rgba(220,53,69,0.25);
}

.error-message {
  color: #dc3545;
  font-size: 12px;
  margin-top: 4px;
}

/* 空状态优化 */
.empty-state {
  animation: fadeIn 0.5s ease-in;
  text-align: center;
  padding: 40px 20px;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border-radius: 12px;
  margin: 20px;
  position: relative;
  overflow: hidden;
}

.empty-state::before {
  content: '';
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: radial-gradient(circle, rgba(0,123,255,0.1) 0%, transparent 70%);
  animation: float 6s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0px) rotate(0deg); }
  50% { transform: translateY(-20px) rotate(180deg); }
}

.empty-icon {
  position: relative;
  z-index: 2;
  margin-bottom: 16px;
}

/* 自定义快递盒图标 */
.shipping-box-icon {
  width: 60px;
  height: 60px;
  position: relative;
  margin: 0 auto;
  animation: boxFloat 3s ease-in-out infinite;
}

.box-body {
  width: 45px;
  height: 30px;
  background: linear-gradient(135deg, #ff6b6b, #ff8e8e);
  border-radius: 3px;
  position: absolute;
  top: 15px;
  left: 7px;
  box-shadow: 0 3px 6px rgba(0,0,0,0.2);
}

.box-tape {
  width: 30px;
  height: 6px;
  background: #fff;
  position: absolute;
  top: 22px;
  left: 15px;
  border-radius: 2px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.1);
}

.box-label {
  width: 15px;
  height: 8px;
  background: #007bff;
  position: absolute;
  top: 23px;
  left: 22px;
  border-radius: 2px;
}

@keyframes boxFloat {
  0%, 100% { transform: translateY(0px) rotate(0deg); }
  25% { transform: translateY(-5px) rotate(1deg); }
  50% { transform: translateY(-10px) rotate(0deg); }
  75% { transform: translateY(-5px) rotate(-1deg); }
}

.empty-state h3 {
  margin: 0 0 8px 0;
  color: #333;
  font-size: 18px;
  font-weight: 600;
  position: relative;
  z-index: 2;
}

.empty-state p {
  margin: 0 0 20px 0;
  color: #666;
  font-size: 14px;
  position: relative;
  z-index: 2;
}

.btn-large {
  padding: 12px 24px;
  font-size: 16px;
  font-weight: 600;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,123,255,0.3);
  transition: all 0.3s ease;
  position: relative;
  z-index: 2;
}

.btn-large:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0,123,255,0.4);
}

.btn-large:active {
  transform: translateY(0);
  box-shadow: 0 2px 8px rgba(0,123,255,0.3);
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .main-content {
    grid-template-columns: 1fr;
    gap: 16px;
  }
  
  .right-section {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }
  
  .region-grid-horizontal {
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  }
  
  .region-card-horizontal {
    min-height: 70px;
  }
}

@media (max-width: 768px) {
  .main-content {
    padding: 12px;
  }
  
  .right-section {
    grid-template-columns: 1fr;
  }
  
  .region-grid-horizontal {
    grid-template-columns: 1fr;
  }
  
  .calculator-form {
    padding: 16px;
  }
  
  .region-card-horizontal {
    padding: 10px;
    min-height: 40px;
  }
  
  .rule-card {
    padding: 12px;
  }
}
</style>
