<template>
  <view class="profile-container">
    <view class="profile-header">
      <text class="profile-title">个人中心</text>
    </view>
    
    <view class="user-info" v-if="userInfo">
      <view class="avatar-section">
        <image 
          v-if="userInfo.avatar_url" 
          :src="userInfo.avatar_url" 
          class="avatar-image"
          mode="aspectFill"
        />
        <text v-else class="avatar">👤</text>
        <text class="username">{{ userInfo.nickname || userInfo.username }}</text>
        <text class="role">{{ userInfo.role === 'admin' ? '管理员' : '普通用户' }}</text>
      </view>
      
      <view class="info-list">
        <view class="info-item">
          <text class="info-label">用户ID：</text>
          <text class="info-value">{{ userInfo.id }}</text>
        </view>
        <view class="info-item">
          <text class="info-label">用户名：</text>
          <text class="info-value">{{ userInfo.username }}</text>
        </view>
        <view class="info-item" v-if="userInfo.nickname">
          <text class="info-label">微信昵称：</text>
          <text class="info-value">{{ userInfo.nickname }}</text>
        </view>
        <view class="info-item">
          <text class="info-label">注册时间：</text>
          <text class="info-value">{{ formatDate(userInfo.created_at) }}</text>
        </view>
        <view class="info-item">
          <text class="info-label">性别：</text>
          <text class="info-value">{{ userInfo.gender === 1 ? '男' : '女' }}</text>
        </view>
        <view class="info-item">
          <text class="info-label">国家：</text>
          <text class="info-value">{{ userInfo.country }}</text>
        </view>
        <view class="info-item">
          <text class="info-label">省份：</text>
          <text class="info-value">{{ userInfo.province }}</text>
        </view>
        <view class="info-item">
          <text class="info-label">城市：</text>
          <text class="info-value">{{ userInfo.city }}</text>
        </view>
      </view>
    </view>
    
    <view class="login-prompt" v-else>
      <text class="prompt-text">请先登录</text>
      <button @click="goToLogin" class="login-btn">立即登录</button>
    </view>
    
    <view class="action-buttons" v-if="userInfo">
      <button @click="logout" class="logout-btn">退出登录</button>
      <button @click="testBackend" class="test-btn">测试后端连接</button>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      userInfo: null
    };
  },
  onLoad() {
    this.loadUserInfo();
  },
  onShow() {
    // 每次页面显示时都重新加载用户信息
    this.loadUserInfo();
  },
  methods: {
    loadUserInfo() {
      const userInfo = uni.getStorageSync('userInfo');
      console.log('加载用户信息:', userInfo);
      if (userInfo) {
        this.userInfo = userInfo;
      } else {
        this.userInfo = null;
      }
    },
    
    formatDate(dateString) {
      if (!dateString) return '未知';
      const date = new Date(dateString);
      return date.toLocaleDateString('zh-CN');
    },
    
    goToLogin() {
      uni.navigateTo({
        url: '/pages/account/login'
      });
    },
    
    logout() {
      uni.showModal({
        title: '确认退出',
        content: '确定要退出登录吗？',
        success: (res) => {
          if (res.confirm) {
            uni.removeStorageSync('token');
            uni.removeStorageSync('userInfo');
            this.userInfo = null;
            uni.showToast({ title: '已退出登录', icon: 'success' });
          }
        }
      });
    },
    
    async testBackend() {
      try {
        uni.showLoading({ title: '测试连接中...' });
        
        // const res = await uni.request({
        //   url: 'http://192.168.1.17:3000/health',
        //   method: 'GET'
        // });
        const res = await this.$api.health()
        uni.hideLoading();
        
        console.log('后端连接响应:', res);
        
        // 检查响应结构
        const response = res[1] || res;
        console.log('处理后的响应:', response);
        
        if (response && response.statusCode === 200) {
          uni.showToast({ 
            title: '后端连接正常', 
            icon: 'success' 
          });
          console.log('后端响应:', response.data);
        } else {
          uni.showToast({ 
            title: '后端连接异常', 
            icon: 'none' 
          });
        }
      } catch (error) {
        uni.hideLoading();
        uni.showToast({ 
          title: '连接失败，请检查后端服务', 
          icon: 'none' 
        });
        console.error('连接错误:', error);
      }
    }
  }
};
</script>

<style scoped>
.profile-container {
  padding: 40rpx;
  min-height: 100vh;
  background-color: #f5f5f5;
}

.profile-header {
  text-align: center;
  margin-bottom: 60rpx;
}

.profile-title {
  font-size: 48rpx;
  font-weight: bold;
  color: #333;
}

.user-info {
  background: white;
  border-radius: 20rpx;
  padding: 40rpx;
  margin-bottom: 40rpx;
  box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.1);
}

.avatar-section {
  text-align: center;
  margin-bottom: 40rpx;
}

.avatar {
  font-size: 120rpx;
  display: block;
  margin-bottom: 20rpx;
}

.avatar-image {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  margin-bottom: 20rpx;
}

.username {
  font-size: 36rpx;
  font-weight: bold;
  color: #333;
  display: block;
  margin-bottom: 10rpx;
}

.role {
  font-size: 24rpx;
  color: #666;
  background: #f0f0f0;
  padding: 10rpx 20rpx;
  border-radius: 20rpx;
}

.info-list {
  border-top: 2rpx solid #f0f0f0;
  padding-top: 30rpx;
}

.info-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.info-label {
  font-size: 28rpx;
  color: #666;
}

.info-value {
  font-size: 28rpx;
  color: #333;
  font-weight: 500;
}

.login-prompt {
  background: white;
  border-radius: 20rpx;
  padding: 60rpx 40rpx;
  text-align: center;
  margin-bottom: 40rpx;
}

.prompt-text {
  font-size: 32rpx;
  color: #666;
  display: block;
  margin-bottom: 40rpx;
}

.login-btn {
  background: #3cc51f;
  color: white;
  border: none;
  border-radius: 10rpx;
  padding: 20rpx 40rpx;
  font-size: 28rpx;
}

.action-buttons {
  display: flex;
  gap: 20rpx;
}

.logout-btn, .test-btn {
  flex: 1;
  height: 80rpx;
  border: none;
  border-radius: 10rpx;
  font-size: 28rpx;
  font-weight: bold;
}

.logout-btn {
  background: #e74c3c;
  color: white;
}

.test-btn {
  background: #3498db;
  color: white;
}
</style>
