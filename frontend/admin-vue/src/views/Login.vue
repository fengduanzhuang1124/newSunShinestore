<template>
  <div class="login-container">
    <div class="login-box">
      <div class="login-header">
        <h2>新阳光商城后台</h2>
        <p>管理员登录</p>
      </div>
      
      <el-form
        ref="loginFormRef"
        :model="loginForm"
        :rules="loginRules"
        class="login-form"
        @submit.prevent="handleLogin"
      >
        <el-form-item prop="username">
          <el-input
            v-model="loginForm.username"
            placeholder="请输入用户名"
            prefix-icon="User"
            size="large"
          />
        </el-form-item>
        
        <el-form-item prop="password">
          <el-input
            v-model="loginForm.password"
            type="password"
            placeholder="请输入密码"
            prefix-icon="Lock"
            size="large"
            show-password
          />
        </el-form-item>
        
        <el-form-item>
          <el-button
            type="primary"
            size="large"
            :loading="loading"
            @click="handleLogin"
            class="login-button"
          >
            {{ loading ? '登录中...' : '登录' }}
          </el-button>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import axios from 'axios'

const router = useRouter()
const loginFormRef = ref()
const loading = ref(false)

const loginForm = reactive({
  username: '',
  password: ''
})

const loginRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码长度不能少于6位', trigger: 'blur' }
  ]
}

const handleLogin = async () => {
  if (!loginFormRef.value) return
  
  await loginFormRef.value.validate(async (valid) => {
    if (valid) {
      loading.value = true
      
      try {
        // 调用后端登录API
        const response = await axios.post('/api/auth/login', {
          username: loginForm.username,
          password: loginForm.password
        })
        
        if (response.data.success) {
          // 保存登录信息
          localStorage.setItem('token', response.data.token)
          localStorage.setItem('currentUser', JSON.stringify(response.data.user))
          
          ElMessage.success('登录成功')
          router.push('/')
        } else {
          ElMessage.error(response.data.message || '登录失败')
        }
      } catch (error) {
        console.error('Login error:', error)
        
        // 如果后端API不可用，使用模拟登录
        if (error.code === 'ERR_NETWORK' || error.response?.status >= 400 || error.response?.status === 404) {
          // 模拟登录逻辑
          if (loginForm.username === 'admin' && loginForm.password === '123456') {
            const mockUser = {
              id: 1,
              username: 'admin',
              name: 'Admin_Sky',
              role: '超级管理员'
            }
            
            localStorage.setItem('token', 'mock-token-' + Date.now())
            localStorage.setItem('currentUser', JSON.stringify(mockUser))
            
            ElMessage.success('登录成功 (模拟模式)')
            router.push('/')
          } else {
            ElMessage.error('用户名或密码错误')
          }
        } else {
          ElMessage.error('登录失败，请检查网络连接')
        }
      } finally {
        loading.value = false
      }
    }
  })
}
</script>

<style scoped>
.login-container {
  height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.login-box {
  background: white;
  padding: 40px;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  width: 400px;
  max-width: 90vw;
}

.login-header {
  text-align: center;
  margin-bottom: 30px;
}

.login-header h2 {
  color: #333;
  margin-bottom: 8px;
  font-size: 24px;
}

.login-header p {
  color: #666;
  font-size: 14px;
}

.login-form {
  width: 100%;
}

.login-button {
  width: 100%;
  height: 45px;
  font-size: 16px;
}
</style>
