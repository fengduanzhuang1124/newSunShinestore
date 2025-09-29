<template>
  <view class="login-container">
    <view class="login-header">
      <text class="login-title">用户登录</text>
    </view>
    
    <view class="login-form">
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
      
      <button @click="wechatLogin" class="login-btn wechat-btn" :disabled="loading">
        <text class="wechat-icon">微信</text>
        {{ loading ? '登录中...' : '微信一键登录' }}
      </button>

      <view class="divider">
        <text class="divider-text">或</text>
      </view>

      <button @click="handleLogin" class="login-btn traditional-btn" :disabled="loading">
        {{ loading ? '登录中...' : '用户名密码登录' }}
      </button>
      
      <view class="register-link">
        <text @click="goToAdmin" class="link-text">管理员登录？</text>
        <text @click="goToRegister" class="link-text">创建管理员账号</text>
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
        password: ''
      },
      loading: false
    };
  },
  methods: {
    validateForm() {
      if (!this.formData.username.trim()) {
        uni.showToast({ title: '请输入用户名', icon: 'none' });
        return false;
      }
      
      if (!this.formData.password) {
        uni.showToast({ title: '请输入密码', icon: 'none' });
        return false;
      }
      
      return true;
    },
    
    // 微信一键登录
    async wechatLogin() {
      try {
        uni.showLoading({ title: '登录中...' });
        
        // 1. 获取微信授权码
        const loginRes = await uni.login({ provider: 'weixin' });
        const code = loginRes[1] ? loginRes[1].code : loginRes.code;
        if (!code) {
          throw new Error('获取微信授权码失败');
        }
        console.log('获取到微信授权码:', code);

        // 2. 获取用户信息（会弹出授权弹窗）
        let userInfo = {};
        try {
          console.log('开始获取用户信息...');
          
          // 先显示一个提示，让用户知道即将弹出授权窗口
          uni.showModal({
            title: '授权提示',
            content: '即将弹出微信授权窗口，请点击"确定"获取您的头像和昵称',
            showCancel: false,
            success: async (modalRes) => {
              if (modalRes.confirm) {
                try {
                  const profileRes = await uni.getUserProfile({ 
                    desc: '用于完善会员资料' 
                  });
                  console.log('用户信息获取成功:', profileRes);
                  
                  const profile = profileRes[1] || profileRes;
                  userInfo = {
                    nickname: profile.userInfo?.nickName,
                    avatarUrl: profile.userInfo?.avatarUrl,
                    gender: profile.userInfo?.gender,
                    country: profile.userInfo?.country,
                    province: profile.userInfo?.province,
                    city: profile.userInfo?.city
                  };
                  console.log('解析后的用户信息:', userInfo);
                  
                  // 继续登录流程
                  await this.completeWechatLogin(code, userInfo);
                } catch (profileError) {
                  console.error('获取用户信息失败:', profileError);
                  uni.showToast({ title: '获取用户信息失败', icon: 'none' });
                  // 继续登录流程，但不包含用户信息
                  await this.completeWechatLogin(code, {});
                }
              }
            }
          });
          
          return; // 等待用户确认后再继续
          
        } catch (profileError) {
          console.error('用户信息授权失败:', profileError);
          uni.showToast({ title: '用户信息授权失败', icon: 'none' });
          // 继续登录流程，但不包含用户信息
          await this.completeWechatLogin(code, {});
        }
      } catch (err) {
        console.error('微信登录失败:', err);
        uni.showToast({ title: '微信登录失败', icon: 'none' });
      } finally {
        uni.hideLoading();
      }
    },

    // 完成微信登录流程
    async completeWechatLogin(code, userInfo) {
      try {
        console.log('开始发送登录请求，code:', code, 'userInfo:', userInfo);
        
        // 3. 使用封装的API发送到后端进行微信登录
        const res = await this.$api.users.wechatLogin({ 
          code, 
          ...userInfo 
        }, { loadingText: '登录中...' });

        console.log('后端登录响应:', res);

        if (res.statusCode >= 200 && res.statusCode < 300) {
          const { token, user } = res.data;
          
          console.log('登录成功，用户信息:', user);
          
          // 保存登录信息
          uni.setStorageSync('token', token);
          uni.setStorageSync('userInfo', user);
          
          uni.showToast({ title: '登录成功', icon: 'success' });
          
          // 根据用户角色跳转
          setTimeout(() => {
            if (user.role === 'admin') {
              // 管理员用户提示使用网页版管理后台
              uni.showModal({
                title: '管理员登录',
                content: '管理员请使用网页版管理后台：http://localhost:3000/admin',
                showCancel: false,
                confirmText: '知道了'
              });
            } else {
              uni.switchTab({ url: '/pages/home/index' });
            }
          }, 1000);
        } else {
          const msg = res?.data?.error || '登录失败';
          console.error('登录失败:', msg);
          uni.showToast({ title: msg, icon: 'none' });
        }
      } catch (err) {
        console.error('完成登录流程失败:', err);
        uni.showToast({ title: '登录失败', icon: 'none' });
      }
    },

    async handleLogin() {
      if (!this.validateForm()) {
        return;
      }
      
      this.loading = true;
      
      try {
        // const res = await uni.request({
        //   url: 'http://192.168.1.17:3000/api/users/login',
        //   method: 'POST',
        //   header: {
        //     'Content-Type': 'application/json'
        //   },
        //   data: {
        //     username: this.formData.username,
        //     password: this.formData.password
        //   }
        // });
        const res = await this.$api.users.login({ username: this.formData.username, password: this.formData.password })
        
        console.log('登录响应:', res);
        
        // 检查响应结构
        const response = res[1] || res;
        console.log('处理后的响应:', response);
        
        if (response && response.statusCode === 200) {
          const { token, user } = response.data;
          
          console.log('登录成功，用户信息:', user);
          
          // 保存token和用户信息
          uni.setStorageSync('token', token);
          uni.setStorageSync('userInfo', user);
          
          console.log('已保存到本地存储，token:', token);
          console.log('已保存到本地存储，userInfo:', user);
          
          uni.showToast({ title: '登录成功', icon: 'success' });
          
          // 根据用户角色跳转到不同页面
          setTimeout(() => {
            if (user.role === 'admin') {
              // 管理员用户提示使用网页版管理后台
              uni.showModal({
                title: '管理员登录',
                content: '管理员请使用网页版管理后台：http://localhost:3000/admin',
                showCancel: false,
                confirmText: '知道了'
              });
            } else {
              uni.switchTab({
                url: '/pages/home/index'
              });
            }
          }, 1500);
        } else {
          const errorMsg = response && response.data && response.data.error ? response.data.error : '登录失败';
          uni.showToast({ 
            title: errorMsg, 
            icon: 'none' 
          });
        }
      } catch (error) {
        console.error('登录失败:', error);
        uni.showToast({ title: '网络错误，请重试', icon: 'none' });
      } finally {
        this.loading = false;
      }
    },
    
    goToRegister() {
      uni.navigateTo({
        url: '/pages/account/register'
      });
    },
    goToAdmin() {
      // 提示管理员使用网页版管理后台
      uni.showModal({
        title: '管理后台',
        content: '请使用网页版管理后台：http://localhost:3000/admin',
        showCancel: false,
        confirmText: '知道了'
      });
    }
  }
};
</script>

<style scoped>
.login-container {
  padding: 40rpx;
  min-height: 100vh;
  background-color: #f5f5f5;
}

.login-header {
  text-align: center;
  margin-bottom: 60rpx;
}

.login-title {
  font-size: 48rpx;
  font-weight: bold;
  color: #333;
}

.login-form {
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

.login-btn {
  width: 100%;
  height: 88rpx;
  color: white;
  border: none;
  border-radius: 10rpx;
  font-size: 32rpx;
  font-weight: bold;
  margin-top: 40rpx;
}

.wechat-btn {
  background: #07c160;
  display: flex;
  align-items: center;
  justify-content: center;
}

.wechat-icon {
  margin-right: 10rpx;
  font-weight: bold;
}

.traditional-btn {
  background: #3cc51f;
}

.divider {
  text-align: center;
  margin: 30rpx 0;
  position: relative;
}

.divider::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 1rpx;
  background: #e0e0e0;
}

.divider-text {
  background: white;
  padding: 0 20rpx;
  color: #999;
  font-size: 24rpx;
}

.login-btn[disabled] {
  background: #ccc;
}

.register-link {
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