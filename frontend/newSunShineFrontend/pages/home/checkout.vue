<template>
  <view class="page">
    <view class="form">
      <view class="field">
        <text class="label">收货人</text>
        <input class="input" v-model="receiver_name" placeholder="请输入收货人姓名" />
      </view>
      <view class="field">
        <text class="label">联系电话</text>
        <input class="input" v-model="phone" placeholder="请输入手机号" />
      </view>
      <view class="field">
        <text class="label">收货地址</text>
        <input class="input" v-model="address" placeholder="请输入详细地址" />
      </view>
    </view>

    <view class="section-title">商品清单</view>
    <view class="list">
      <view class="item" v-for="it in items" :key="it.product_id">
        <image class="thumb" :src="it.image || defaultImage" mode="aspectFill" />
        <view class="info">
          <view class="name">{{ it.name }}</view>
          <view class="meta">
            <text>x{{ it.quantity }}</text>
            <text class="price">¥ {{ formatPrice(it.price) }}</text>
          </view>
        </view>
      </view>
    </view>

    <view class="summary">
      <text>应付：¥ {{ formatPrice(totalAmount) }}</text>
      <button class="submit" @click="submitOrder">提交订单</button>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      items: [],
      address: '',
      phone: '',
      receiver_name: '',
      defaultImage: '/static/logo.png'
    };
  },
  computed: {
    totalAmount() {
      return this.items.reduce((sum, it) => sum + Number(it.price) * Number(it.quantity), 0);
    }
  },
  onShow() {
    const cached = uni.getStorageSync('checkout_items');
    this.items = Array.isArray(cached) ? cached : [];
    const profile = uni.getStorageSync('userInfo') || {};
    this.receiver_name = this.receiver_name || profile.nickname || '';
    this.phone = this.phone || profile.phone || '';
    this.address = this.address || profile.address || '';
  },
  methods: {
    async submitOrder() {
      if (!this.ensureLogin()) return;
      if (!this.receiver_name || !this.phone || !this.address) {
        uni.showToast({ title: '请完整填写收货信息', icon: 'none' });
        return;
      }
      if (!this.items.length) {
        uni.showToast({ title: '商品清单为空', icon: 'none' });
        return;
      }
      try {
        const payload = {
          items: this.items.map(it => ({ product_id: it.product_id, quantity: it.quantity })),
          address: this.address,
          phone: this.phone,
          receiver_name: this.receiver_name
        };
        const res = await this.$api.orders.createOrder(payload);
        const response = res[1] || res;
        if (response && response.statusCode >= 200 && response.statusCode < 300 && (response.data.code === 200 || response.data.code === 201)) {

          uni.removeStorageSync('checkout_items');
          uni.showToast({ title: '下单成功', icon: 'success' });
          setTimeout(() => this.$router.navigateTo('/pages/home/my-orders'), 600);
        } else {
          uni.showToast({ title: response.data.msg || '下单失败', icon: 'none' });
        }
      } catch (e) {
        uni.showToast({ title: '下单失败', icon: 'none' });
      }
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
.form { background: #fff; margin: 12rpx; border-radius: 12rpx; padding: 12rpx; }
.field { display: flex; align-items: center; padding: 16rpx 8rpx; }
.label { width: 160rpx; color: #333; font-size: 26rpx; }
.input { flex: 1; background: #f8f8f8; border-radius: 8rpx; padding: 12rpx; }
.section-title { margin: 24rpx; font-size: 30rpx; color: #111; }
.list { margin: 0 12rpx; }
.item { display: flex; align-items: center; background: #fff; border-radius: 12rpx; padding: 12rpx; margin-bottom: 12rpx; }
.thumb { width: 120rpx; height: 120rpx; background: #f0f0f0; border-radius: 8rpx; }
.info { flex: 1; margin-left: 12rpx; }
.name { font-size: 28rpx; color: #111; }
.meta { display: flex; justify-content: space-between; color: #666; margin-top: 4rpx; }
.price { color: #e33; }
.summary { position: fixed; left: 0; right: 0; bottom: 0; display: flex; align-items: center; justify-content: space-between; background: #fff; padding: 12rpx 16rpx; box-shadow: 0 -6rpx 12rpx rgba(0,0,0,0.04); }
.submit { background: #07c160; color: #fff; border-radius: 12rpx; }
</style>
