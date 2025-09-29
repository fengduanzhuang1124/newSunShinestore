<template>
  <div class="admin-layout">
    <!-- 侧边栏 -->
    <el-aside :width="sidebarWidth + 'px'" class="sidebar">
      <div class="sidebar-header">
        <h2>新阳光商城</h2>
      </div>
      
      <!-- 侧边栏宽度调整条 -->
      <div 
        class="sidebar-resizer" 
        @mousedown="startResize"
        :style="{ right: '0px' }"
      ></div>
      
      <el-menu
        :default-active="activeMenu"
        class="sidebar-menu"
        background-color="transparent"
        text-color="#fff"
        active-text-color="#fff"
      >
        <el-menu-item index="dashboard" @click="$router.push('/')">
          <el-icon><DataBoard /></el-icon>
          <span>数据总览</span>
        </el-menu-item>
        
        <el-sub-menu index="orders">
          <template #title>
            <el-icon><List /></el-icon>
            <span>订单管理</span>
          </template>
          <el-menu-item index="order-list" @click="$router.push('/orders')">
            订单列表
          </el-menu-item>
          <el-menu-item index="order-ship" @click="$router.push('/orders/ship')">
            打单发货
          </el-menu-item>
        </el-sub-menu>
        
        <el-sub-menu index="products">
          <template #title>
            <el-icon><Goods /></el-icon>
            <span>商品管理</span>
          </template>
          <el-menu-item index="product-list" @click="$router.push('/products')">
            商品列表
          </el-menu-item>
          <el-menu-item index="brand-category" @click="$router.push('/products/brands')">
            品牌&分类
          </el-menu-item>
        </el-sub-menu>
        
        <el-menu-item index="shipping" @click="$router.push('/shipping')">
          <el-icon><Truck /></el-icon>
          <span>运费管理</span>
        </el-menu-item>
        
        <el-menu-item index="coupons" @click="$router.push('/coupons')">
          <el-icon><Ticket /></el-icon>
          <span>优惠券中心</span>
        </el-menu-item>
        
        <el-sub-menu index="store">
          <template #title>
            <el-icon><Shop /></el-icon>
            <span>店铺管理</span>
          </template>
          <el-menu-item index="store-settings" @click="showFeatureAlert('店铺设置')">
            店铺设置
          </el-menu-item>
          <el-menu-item index="store-analytics" @click="showFeatureAlert('店铺分析')">
            店铺分析
          </el-menu-item>
        </el-sub-menu>
        
        <el-menu-item index="finance" @click="showFeatureAlert('财务管理')">
          <el-icon><Money /></el-icon>
          <span>财务管理</span>
        </el-menu-item>
        
        <el-menu-item index="users" @click="showFeatureAlert('用户管理')">
          <el-icon><User /></el-icon>
          <span>用户管理</span>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <!-- 主内容区 -->
    <div class="main-container">
      <div class="main-header">
        <div class="header-left">
          <el-button 
            type="text" 
            @click="toggleSidebar"
            class="sidebar-toggle"
          >
            <el-icon><Menu /></el-icon>
          </el-button>
          <el-input
            v-model="searchQuery"
            placeholder="Search"
            class="search-input"
            clearable
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
        </div>
        <div class="header-right">
          <el-dropdown @command="handleCommand">
            <span class="user-info">
              {{ currentUser?.name || 'Admin_Sky' }} 超级管理员
              <el-icon><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="profile">个人设置</el-dropdown-item>
                <el-dropdown-item command="logout" divided>退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>
      
      <div class="main-content">
        <router-view />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'

const route = useRoute()
const router = useRouter()
const sidebarWidth = ref(300)
const searchQuery = ref('')
const currentUser = ref(null)

// 计算当前激活的菜单
const activeMenu = computed(() => {
  const path = route.path
  if (path === '/') return 'dashboard'
  if (path.startsWith('/products')) return 'products'
  if (path.startsWith('/orders')) return 'orders'
  if (path.startsWith('/shipping')) return 'shipping'
  return 'dashboard'
})

// 侧边栏拖拽调整宽度
let isResizing = false
let startX = 0
let startWidth = 0

const startResize = (e) => {
  isResizing = true
  startX = e.clientX
  startWidth = sidebarWidth.value
  
  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)
  e.preventDefault()
}

const handleResize = (e) => {
  if (!isResizing) return
  
  const newWidth = startWidth + (e.clientX - startX)
  const minWidth = 200
  const maxWidth = 500
  
  if (newWidth >= minWidth && newWidth <= maxWidth) {
    sidebarWidth.value = newWidth
  }
}

const stopResize = () => {
  isResizing = false
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
  
  // 保存宽度到本地存储
  localStorage.setItem('sidebarWidth', sidebarWidth.value)
}

const toggleSidebar = () => {
  if (sidebarWidth.value <= 200) {
    // 如果侧边栏很窄，展开到默认宽度
    sidebarWidth.value = 300
  } else {
    // 如果侧边栏较宽，收缩到最小宽度
    sidebarWidth.value = 200
  }
  
  // 保存宽度到本地存储
  localStorage.setItem('sidebarWidth', sidebarWidth.value)
}

const showFeatureAlert = (featureName) => {
  ElMessage.info(`${featureName}功能正在开发中，敬请期待！`)
}

const handleCommand = async (command) => {
  if (command === 'logout') {
    try {
      await ElMessageBox.confirm('确定要退出登录吗？', '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      })
      
      // 清除登录信息
      localStorage.removeItem('token')
      localStorage.removeItem('currentUser')
      currentUser.value = null
      
      ElMessage.success('已退出登录')
      router.push('/login')
    } catch {
      // 用户取消退出
    }
  } else if (command === 'profile') {
    ElMessage.info('个人设置功能开发中')
  }
}

// 从本地存储恢复宽度和用户信息
onMounted(() => {
  // 恢复侧边栏宽度
  const savedWidth = localStorage.getItem('sidebarWidth')
  if (savedWidth) {
    const width = parseInt(savedWidth, 10)
    if (width >= 200 && width <= 500) {
      sidebarWidth.value = width
    }
  }
  
  // 加载用户信息
  const userStr = localStorage.getItem('currentUser')
  if (userStr) {
    try {
      currentUser.value = JSON.parse(userStr)
    } catch (error) {
      console.error('Failed to parse user info:', error)
      localStorage.removeItem('currentUser')
    }
  }
})
</script>

<style scoped>
.admin-layout {
  display: flex;
  height: 100vh;
  width: 100%;
}

.sidebar {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  position: relative;
  transition: width 0.3s ease;
  min-width: 200px;
  max-width: 500px;
}

.sidebar-header {
  padding: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.sidebar-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.sidebar-resizer {
  position: absolute;
  top: 0;
  right: 0;
  width: 6px;
  height: 100%;
  background-color: rgba(255, 255, 255, 0.2);
  cursor: col-resize;
  transition: all 0.3s ease;
  z-index: 10;
}

.sidebar-resizer:hover {
  background-color: rgba(255, 255, 255, 0.6);
  width: 8px;
}

.sidebar-resizer:active {
  background-color: rgba(255, 255, 255, 0.8);
}

.sidebar-menu {
  border: none;
  height: calc(100vh - 80px);
  overflow-y: auto;
}

.sidebar-menu .el-menu-item,
.sidebar-menu .el-sub-menu__title {
  color: white !important;
}

.sidebar-menu .el-menu-item:hover,
.sidebar-menu .el-sub-menu__title:hover {
  background-color: rgba(255, 255, 255, 0.1) !important;
}

.sidebar-menu .el-menu-item.is-active {
  background-color: rgba(255, 255, 255, 0.2) !important;
  border-right: 3px solid #fff;
}

.main-container {
  flex: 1;
  background-color: #f5f5f5;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: none;
}

.main-header {
  background: white;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 20px;
}

.sidebar-toggle {
  font-size: 18px;
}

.search-input {
  width: 300px;
}

.header-right {
  display: flex;
  align-items: center;
}

.user-info {
  color: #666;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  border-radius: 4px;
  transition: background-color 0.3s ease;
}

.user-info:hover {
  background-color: #f5f5f5;
}

.main-content {
  padding: 0;
  background-color: transparent;
  flex: 1;
  overflow-x: hidden;
  width: 100%;
  max-width: none;
}
</style>
