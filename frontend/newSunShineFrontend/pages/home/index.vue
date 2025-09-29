<template>
  <view class="page">
    <!-- 顶部：搜索栏与头像/入口 -->
    <view class="top-bar">
      <view class="search-box">
        <input class="search-input" type="text" v-model="searchKeyword" placeholder="搜索商品/分类" confirm-type="search" @confirm="onSearch" />
        <button class="search-btn" @click="onSearch">搜索</button>
      </view>
      <view class="user-entry" @click="goToProfile">
        <image class="avatar" :src="userAvatar" mode="aspectFill"></image>
      </view>
    </view>

    <!-- 轮播图 -->
    <swiper class="banner" :indicator-dots="true" :circular="true" :autoplay="true" :interval="4000" :duration="500">
      <swiper-item v-for="item in banners" :key="item.id" @click="onBannerClick(item)">
        <image class="banner-img" :src="item.image" mode="aspectFill" />
      </swiper-item>
    </swiper>

    <!-- 功能入口网格 -->
    <view class="feature-grid">
      <view class="feature-item" @click="goToProducts">
        <text class="icon">🛍️</text>
        <text class="label">商品浏览</text>
      </view>
      <view class="feature-item" @click="goToCart">
        <text class="icon">🛒</text>
        <text class="label">购物车</text>
      </view>
      <view class="feature-item" @click="goToOrders">
        <text class="icon">📦</text>
        <text class="label">我的订单</text>
      </view>
      <view class="feature-item" @click="goToProfile">
        <text class="icon">👤</text>
        <text class="label">个人中心</text>
      </view>
    </view>

    <!-- 分类快捷（横滑） -->
    <scroll-view class="category-scroll" scroll-x v-if="categories.length">
      <view :class="['cat-chip', activeCategory===cat ? 'active' : '']" v-for="cat in categories" :key="cat" @click="onSelectCategory(cat)">{{ cat }}</view>
      <view :class="['cat-chip', activeCategory==='' ? 'active' : '']" @click="onSelectCategory('')">全部</view>
    </scroll-view>

    <!-- 推荐商品 -->
    <view class="section-title">
      <text>热门推荐</text>
      <text class="more" @click="goToProducts">更多 ></text>
    </view>

    <view class="product-list">
      <view class="product-card" v-for="item in products" :key="item.id" @click="goProductDetail(item.id)">
        <image class="cover" :src="item.image || defaultImage" mode="aspectFill" />
        <view class="p-name">{{ item.name }}</view>
        <view class="p-bottom">
          <text class="p-price">¥ {{ formatPrice(item.price) }}</text>
          <text class="p-tag" v-if="item.category">{{ item.category }}</text>
        </view>
      </view>
    </view>

    <view class="empty" v-if="!loading && !products.length">
      <text>暂无推荐商品</text>
    </view>

    <view class="loading" v-if="loading">加载中...</view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      searchKeyword: '',
      banners: [
        { id: 1, image: '/static/logo.png', link: '/pages/home/product-list' },
        { id: 2, image: '/static/logo.png', link: '/pages/home/product-list' }
      ],
      categories: [],
      activeCategory: '',
      products: [],
      loading: false,
      defaultImage: '/static/logo.png',
      userAvatar: '/static/logo.png'
    };
  },
  onShow() {
    this.init();
  },
  methods: {
    async init() {
      this.loadUserAvatar();
      await Promise.all([
        this.fetchCategories(),
        this.fetchProducts()
      ]);
    },
    loadUserAvatar() {
      try {
        const profile = uni.getStorageSync('userInfo');
        if (profile && profile.avatar_url) this.userAvatar = profile.avatar_url;
      } catch (e) {}
    },
    async fetchCategories() {
      try {
        const res = await this.$api.products.getCategories();
        const response = res[1] || res; // 兼容uni.request返回格式
        if (response && response.statusCode === 200 && response.data && response.data.code === 200) {
          this.categories = response.data.data || [];
        } else {
          console.warn('获取分类失败:', response?.data?.msg || '未知错误');
        }
      } catch (e) {
        console.error('获取分类错误:', e);
        // 分类失败不影响主流程
      }
    },
    async fetchProducts() {
      this.loading = true;
      try {
        const params = { page: 1, pageSize: 6, sortBy: 'created_at', sortOrder: 'DESC' };
        if (this.activeCategory) params.category = this.activeCategory;
        
        console.log('首页请求推荐商品参数:', params);
        const res = await this.$api.products.getProducts(params);
        const response = res[1] || res;
        
        console.log('首页商品接口响应:', response);
        
        if (response && response.statusCode === 200 && response.data && response.data.code === 200) {
          this.products = response.data.data.list || [];
          console.log('首页推荐商品加载成功，共', this.products.length, '个商品');
        } else {
          console.warn('首页获取商品失败:', response?.data?.msg || '未知错误');
          this.products = [];
        }
      } catch (e) {
        console.error('首页获取商品错误:', e);
        this.products = [];
      } finally {
        this.loading = false;
      }
    },
    onSearch() {
      const keyword = (this.searchKeyword || '').trim();
      this.$router.navigateTo(`/pages/home/product-list?search=${encodeURIComponent(keyword)}`);
    },
    onBannerClick(item) {
      if (item && item.link) this.$router.navigateTo(item.link);
    },
    onSelectCategory(cat) {
      this.activeCategory = cat;
      this.fetchProducts();
    },
    goToProducts() {
      this.$router.switchTab('/pages/home/product-list');
    },
    goToCart() {
      this.$router.switchTab('/pages/home/shopping-cart');
    },
    goToOrders() {
      this.$router.navigateTo('/pages/home/my-orders');
    },
    goToProfile() {
      this.$router.switchTab('/pages/account/profile');
    },
    goProductDetail(id) {
      this.$router.navigateTo(`/pages/home/product-detail?id=${id}`);
    },
    formatPrice(v) {
      const n = Number(v || 0);
      return n.toFixed(2);
    }
  }
};
</script>

<style scoped>
.page {
  background: #f5f5f5;
  min-height: 100vh;
  padding-bottom: 32rpx;
}

.top-bar {
  display: flex;
  align-items: center;
  padding: 24rpx 24rpx 0 24rpx;
}

.search-box {
  flex: 1;
  display: flex;
  background: #ffffff;
  border-radius: 999rpx;
  padding: 8rpx 8rpx 8rpx 24rpx;
}
.search-input {
  flex: 1;
  font-size: 28rpx;
}
.search-btn {
  margin-left: 8rpx;
  background: #07c160;
  color: #fff;
  border-radius: 999rpx;
  font-size: 26rpx;
  padding: 0 24rpx;
}
.user-entry {
  margin-left: 16rpx;
}
.avatar {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
}

.banner {
  height: 300rpx;
  margin: 24rpx;
  border-radius: 16rpx;
  overflow: hidden;
}
.banner-img {
  width: 100%;
  height: 100%;
}

.feature-grid {
  margin: 0 24rpx 8rpx 24rpx;
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx 12rpx;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-gap: 12rpx;
}
.feature-item {
  background: #f8f8f8;
  border-radius: 12rpx;
  padding: 24rpx 0;
  text-align: center;
}
.icon {
  font-size: 40rpx;
  display: block;
}
.label {
  margin-top: 8rpx;
  font-size: 24rpx;
}

.category-scroll {
  white-space: nowrap;
  margin: 8rpx 24rpx;
}
.cat-chip {
  display: inline-block;
  padding: 10rpx 20rpx;
  margin-right: 12rpx;
  background: #ffffff;
  border-radius: 999rpx;
  font-size: 24rpx;
  color: #333;
}
.cat-chip.active {
  background: #07c160;
  color: #fff;
}

.section-title {
  margin: 24rpx 24rpx 12rpx 24rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 30rpx;
}
.section-title .more {
  color: #666;
  font-size: 26rpx;
}

.product-list {
  margin: 0 24rpx;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-gap: 16rpx;
}
.product-card {
  background: #fff;
  border-radius: 12rpx;
  overflow: hidden;
  padding-bottom: 12rpx;
}
.cover {
  width: 100%;
  height: 300rpx;
  background: #f0f0f0;
}
.p-name {
  font-size: 26rpx;
  color: #111;
  padding: 12rpx 12rpx 4rpx 12rpx;
  line-height: 36rpx;
  height: 72rpx;
  overflow: hidden;
}
.p-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12rpx;
}
.p-price {
  color: #e33;
  font-weight: bold;
}
.p-tag {
  font-size: 22rpx;
  color: #999;
}

.empty {
  text-align: center;
  color: #999;
  padding: 48rpx 0;
}
.loading {
  text-align: center;
  color: #666;
  padding: 24rpx 0 48rpx 0;
}
</style> 