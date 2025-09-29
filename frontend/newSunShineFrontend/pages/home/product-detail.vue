<template>
  <view class="page">
    <view v-if="loading" class="loading">加载中...</view>
    <view v-else>
      <!-- 图集/主图 -->
      <image class="cover" :src="detail.image || defaultImage" mode="aspectFill" />

      <!-- 基本信息 -->
      <view class="info">
        <view class="name">{{ detail.name }}</view>
        <view class="meta">
          <text class="price">¥ {{ formatPrice(detail.price) }}</text>
          <text class="stock">库存：{{ detail.stock }}</text>
        </view>
        <view class="tags">
          <text v-if="detail.category" class="tag">{{ detail.category }}</text>
          <text v-if="detail.status === 'off'" class="tag off">已下架</text>
        </view>
      </view>

      <!-- 数量选择 -->
      <view class="quantity">
        <text class="q-label">数量</text>
        <view class="stepper">
          <button class="q-btn" @click="dec">-</button>
          <input class="q-input" type="number" v-model.number="quantity" />
          <button class="q-btn" @click="inc">+</button>
        </view>
      </view>

      <!-- 详情描述 -->
      <view class="desc">
        <view class="desc-title">商品详情</view>
        <text class="desc-text">{{ detail.description || '暂无详情' }}</text>
      </view>

      <!-- 底部操作栏 -->
      <view class="bottom-bar">
        <button class="cart-btn" @click="goCart">购物车</button>
        <button class="add-btn" :disabled="!canBuy" @click="handleAddToCart">加入购物车</button>
        <button class="buy-btn" :disabled="!canBuy" @click="handleBuyNow">立即购买</button>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      productId: null,
      detail: {},
      loading: true,
      quantity: 1,
      defaultImage: '/static/logo.png'
    };
  },
  computed: {
    canBuy() {
      return this.detail && this.detail.status !== 'off' && Number(this.detail.stock) > 0;
    }
  },
  onLoad(options) {
    this.productId = options.id;
    this.fetchDetail();
  },
  methods: {
    async fetchDetail() {
      this.loading = true;
      try {
        const res = await this.$api.products.getProduct(this.productId);
        const response = res[1] || res;
        if (response && response.statusCode === 200 && response.data && response.data.code === 200) {
          this.detail = response.data.data || {};
        }
      } catch (e) {
      } finally {
        this.loading = false;
      }
    },
    inc() {
      const max = Number(this.detail.stock || 1);
      if (this.quantity < max) this.quantity += 1;
    },
    dec() {
      if (this.quantity > 1) this.quantity -= 1;
    },
    async handleAddToCart() {
      if (!this.ensureLogin()) return;
      try {
        const payload = { product_id: Number(this.productId), quantity: Number(this.quantity) };
        const res = await this.$api.cart.addToCart(payload);
        const response = res[1] || res;
        if (response && response.statusCode >= 200 && response.statusCode < 300 && (response.data.code === 200 || response.data.code === 201)) {

          uni.showToast({ title: '已加入购物车', icon: 'success' });
        } else {
          uni.showToast({ title: response.data.msg || '加入失败', icon: 'none' });
        }
      } catch (e) {
        uni.showToast({ title: '加入失败', icon: 'none' });
      }
    },
    handleBuyNow() {
      if (!this.ensureLogin()) return;
      const item = { product_id: Number(this.productId), quantity: Number(this.quantity), price: Number(this.detail.price), name: this.detail.name, image: this.detail.image };
      uni.setStorageSync('checkout_items', [item]);
      this.$router.navigateTo('/pages/home/checkout');
    },
    goCart() {
      this.$router.switchTab('/pages/home/shopping-cart');
    },
    ensureLogin() {
      const token = uni.getStorageSync('token');
      if (!token) {
        uni.showToast({ title: '请先登录', icon: 'none' });
        setTimeout(() => this.$router.switchTab('/pages/account/profile'), 500);
        return false;
      }
      return true;
    },
    formatPrice(v) {
      const n = Number(v || 0);
      return n.toFixed(2);
    }
  }
};
</script>

<style scoped>
.page { background: #f5f5f5; min-height: 100vh; padding-bottom: 120rpx; }
.loading { text-align: center; color: #666; padding: 48rpx 0; }
.cover { width: 100%; height: 480rpx; background: #f0f0f0; }
.info { background: #fff; margin: 12rpx; border-radius: 12rpx; padding: 16rpx; }
.name { font-size: 32rpx; color: #111; font-weight: 600; }
.meta { display: flex; justify-content: space-between; margin-top: 8rpx; }
.price { color: #e33; font-weight: 700; }
.stock { color: #666; }
.tags { margin-top: 8rpx; }
.tag { display: inline-block; background: #f6f6f6; color: #666; border-radius: 999rpx; padding: 6rpx 16rpx; font-size: 22rpx; margin-right: 8rpx; }
.tag.off { background: #ffecec; color: #e33; }
.quantity { background: #fff; margin: 12rpx; border-radius: 12rpx; padding: 16rpx; display: flex; align-items: center; justify-content: space-between; }
.q-label { color: #333; }
.stepper { display: flex; align-items: center; }
.q-btn { width: 64rpx; height: 64rpx; text-align: center; line-height: 64rpx; background: #f6f6f6; border-radius: 8rpx; }
.q-input { width: 120rpx; margin: 0 8rpx; background: #fff; border: 1px solid #eee; border-radius: 8rpx; text-align: center; }
.desc { background: #fff; margin: 12rpx; border-radius: 12rpx; padding: 16rpx; }
.desc-title { font-size: 28rpx; color: #111; margin-bottom: 8rpx; }
.desc-text { font-size: 26rpx; color: #666; line-height: 44rpx; }
.bottom-bar { position: fixed; left: 0; right: 0; bottom: 0; display: flex; background: #fff; padding: 12rpx; box-shadow: 0 -6rpx 12rpx rgba(0,0,0,0.04); }
.cart-btn { flex: 1; margin-right: 8rpx; background: #f2f2f2; color: #333; border-radius: 12rpx; }
.add-btn { flex: 1; margin: 0 8rpx; background: #07c160; color: #fff; border-radius: 12rpx; }
.buy-btn { flex: 1; margin-left: 8rpx; background: #ff6a00; color: #fff; border-radius: 12rpx; }
</style>
