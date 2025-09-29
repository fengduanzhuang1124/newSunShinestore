<template>
  <view class="register-container">
    <view class="register-header">
      <text class="register-title">用户注册</text>
    </view>
    
    <view class="register-form">
      <view class="form-group">
        <text class="form-label">用户名</text>
        <input 
          type="text" 
          v-model="formData.username" 
          placeholder="请输入用户名" 
          class="form-input"
        />
      </view>
      
      <view class="form-group">
        <text class="form-label">密码</text>
        <input 
          type="password" 
          v-model="formData.password" 
          placeholder="请输入密码" 
          class="form-input"
        />
      </view>
      
      <view class="form-group">
        <text class="form-label">确认密码</text>
        <input 
          type="password" 
          v-model="formData.confirmPassword" 
          placeholder="请再次输入密码" 
          class="form-input"
        />
      </view>
      
      <button @click="handleRegister" class="register-btn" :disabled="loading">
        {{ loading ? '注册中...' : '注册' }}
      </button>
      
      <view class="login-link">
        <text>已有账户？</text>
        <text @click="goToLogin" class="link-text">立即登录</text>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      formData: {
        username: '',
        password: '',
        confirmPassword: '',
        role: 'customer'  // 固定为普通用户
      },
      loading: false
    };
  },
  onLoad() {
    console.log('注册页面加载');
  },
  methods: {
    validateForm() {
      if (!this.formData.username.trim()) {
        uni.showToast({ title: '请输入用户名', icon: 'none' });
        return false;
      }
      
      if (this.formData.username.length < 3) {
        uni.showToast({ title: '用户名至少3个字符', icon: 'none' });
        return false;
      }
      
      if (!this.formData.password) {
        uni.showToast({ title: '请输入密码', icon: 'none' });
        return false;
      }
      
      if (this.formData.password.length < 6) {
        uni.showToast({ title: '密码至少6个字符', icon: 'none' });
        return false;
      }
      
      if (this.formData.password !== this.formData.confirmPassword) {
        uni.showToast({ title: '两次密码不一致', icon: 'none' });
        return false;
      }
      
      return true;
    },
    
    async handleRegister() {
      console.log('开始注册');
      if (!this.validateForm()) {
        return;
      }
      
      this.loading = true;
      
      try {
        console.log('发送注册请求:', this.formData);
        const res = await uni.request({
          url: 'http://192.168.1.17:3000/api/users/register',
          method: 'POST',
          header: {
            'Content-Type': 'application/json'
          },
          data: {
            username: this.formData.username,
            password: this.formData.password,
            role: this.formData.role
          }
        });
        
        console.log('注册响应:', res);
        
        // 检查响应结构
        const response = res[1] || res;
        console.log('处理后的响应:', response);
        
        if (response && response.statusCode === 201) {
          uni.showToast({ title: '注册成功', icon: 'success' });
          
          // 注册成功后跳转到登录页面
          setTimeout(() => {
            uni.navigateTo({
              url: '/pages/account/login'
            });
          }, 1500);
        } else {
          const errorMsg = response && response.data && response.data.error ? response.data.error : '注册失败';
          uni.showToast({ 
            title: errorMsg, 
            icon: 'none' 
          });
        }
      } catch (error) {
        console.error('注册失败:', error);
        uni.showToast({ title: '网络错误，请重试', icon: 'none' });
      } finally {
        this.loading = false;
      }
    },
    
    goToLogin() {
      uni.navigateTo({
        url: '/pages/account/login'
      });
    }
  }
};
</script>

<style scoped>
.register-container {
  padding: 40rpx;
  min-height: 100vh;
  background-color: #f5f5f5;
}

.register-header {
  text-align: center;
  margin-bottom: 60rpx;
}

.register-title {
  font-size: 48rpx;
  font-weight: bold;
  color: #333;
}

.register-form {
  background: white;
  border-radius: 20rpx;
  padding: 40rpx;
  box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.1);
}

.form-group {
  margin-bottom: 40rpx;
}

.form-label {
  display: block;
  font-size: 28rpx;
  color: #333;
  margin-bottom: 20rpx;
  font-weight: 500;
}

.form-input {
  width: 100%;
  height: 80rpx;
  border: 2rpx solid #e0e0e0;
  border-radius: 10rpx;
  padding: 0 20rpx;
  font-size: 28rpx;
  background-color: #fafafa;
}

.form-input:focus {
  border-color: #3cc51f;
  background-color: white;
}

.form-picker {
  width: 100%;
  height: 80rpx;
  border: 2rpx solid #e0e0e0;
  border-radius: 10rpx;
  padding: 0 20rpx;
  display: flex;
  align-items: center;
  background-color: #fafafa;
}

.picker-text {
  font-size: 28rpx;
  color: #333;
}

.register-btn {
  width: 100%;
  height: 88rpx;
  background: #3cc51f;
  color: white;
  border: none;
  border-radius: 10rpx;
  font-size: 32rpx;
  font-weight: bold;
  margin-top: 40rpx;
}

.register-btn[disabled] {
  background: #ccc;
}

.login-link {
  text-align: center;
  margin-top: 40rpx;
  font-size: 28rpx;
  color: #666;
}

.link-text {
  color: #3cc51f;
  margin-left: 10rpx;
}
</style> 