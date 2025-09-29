<template>
  <view class="page">
    <view v-if="loading" class="loading">加载中...</view>
    <view v-else>
      <view v-if="!items.length" class="empty">
        <text>购物车为空</text>
        <button class="shop-btn" @click="goToProducts">去逛逛</button>
      </view>

      <view v-else class="list">
        <view class="cart-item" v-for="item in items" :key="item.id">
          <image class="thumb" :src="item.image || defaultImage" mode="aspectFill" />
          <view class="info">
            <view class="name">{{ item.name }}</view>
            <view class="meta">
              <text class="price">¥ {{ formatPrice(item.price) }}</text>
              <view class="stepper">
                <button class="q-btn" @click="updateQty(item, item.quantity - 1)" :disabled="item.quantity<=1">-</button>
                <text class="q-num">{{ item.quantity }}</text>
                <button class="q-btn" @click="updateQty(item, item.quantity + 1)">+</button>
              </view>
            </view>
          </view>
          <button class="del-btn" @click="removeItem(item.id)">删除</button>
        </view>

        <view class="summary">
          <text>共 {{ items.length }} 件</text>
          <text class="sum">合计：¥ {{ formatPrice(totalAmount) }}</text>
        </view>

        <view class="actions">
          <button class="clear-btn" @click="clearCart">清空</button>
          <button class="checkout-btn" @click="goCheckout">去结算</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      items: [],
      loading: true,
      defaultImage: '/static/logo.png'
    };
  },
  computed: {
    totalAmount() {
      return this.items.reduce((sum, it) => sum + Number(it.price) * Number(it.quantity), 0);
    }
  },
  onShow() {
    this.fetchCart();
  },
  methods: {
    async fetchCart() {
      if (!this.ensureLogin()) return;
      this.loading = true;
      try {
        const res = await this.$api.cart.getCart();
        const response = res[1] || res;
        if (response && response.statusCode === 200 && response.data && response.data.code === 200) {
         
          const cart = response.data.data || { items: [], totalPrice: 0, totalItems: 0 };
         this.items = cart.items;
        } else {
          this.items = [];
        }
      } catch (e) {
        this.items = [];
      } finally {
        this.loading = false;
      }
    },
    async updateQty(item, nextQty) {
      if (nextQty < 1) return;
      try {
        const res = await this.$api.cart.updateCartQuantity(item.id, { quantity: nextQty });
        const response = res[1] || res;
        if (response && response.statusCode === 200 && (response.data.code === 200)) {
          item.quantity = nextQty;
          this.$forceUpdate();
        } else {
          uni.showToast({ title: response.data.msg || '更新失败', icon: 'none' });
        }
      } catch (e) {
        uni.showToast({ title: '更新失败', icon: 'none' });
      }
    },
    async removeItem(cartId) {
      try {
        const res = await this.$api.cart.removeFromCart(cartId);
        const response = res[1] || res;
        if (response && response.statusCode === 200 && response.data.code === 200) {
          this.items = this.items.filter(it => it.id !== cartId);
        } else {
          uni.showToast({ title: response.data.msg || '删除失败', icon: 'none' });
        }
      } catch (e) {
        uni.showToast({ title: '删除失败', icon: 'none' });
      }
    },
    async clearCart() {
      try {
        const res = await this.$api.cart.clearCart();
        const response = res[1] || res;
        if (response && response.statusCode === 200 && response.data.code === 200) {
          this.items = [];
        } else {
          uni.showToast({ title: response.data.msg || '清空失败', icon: 'none' });
        }
      } catch (e) {
        uni.showToast({ title: '清空失败', icon: 'none' });
      }
    },
    goCheckout() {
      if (!this.ensureLogin()) return;
      // 购物车直接结算：将服务器返回的行转换为下单项
      const checkoutItems = this.items.map(it => ({ product_id: it.product_id, quantity: it.quantity, price: it.price, name: it.name, image: it.image }));
      uni.setStorageSync('checkout_items', checkoutItems);
      this.$router.navigateTo('/pages/home/checkout');
    },
    goToProducts() {
      this.$router.switchTab('/pages/home/product-list');
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
.page { background: #f5f5f5; min-height: 100vh; }
.loading, .empty { text-align: center; color: #666; padding: 48rpx 0; }
.shop-btn { background: #07c160; color: #fff; margin-top: 16rpx; border-radius: 12rpx; }
.list { padding: 12rpx; }
.cart-item { display: flex; align-items: center; background: #fff; border-radius: 12rpx; padding: 12rpx; margin: 12rpx; }
.thumb { width: 140rpx; height: 140rpx; background: #f0f0f0; border-radius: 8rpx; }
.info { flex: 1; margin-left: 12rpx; }
.name { font-size: 28rpx; color: #111; line-height: 40rpx; }
.meta { display: flex; align-items: center; justify-content: space-between; margin-top: 8rpx; }
.price { color: #e33; font-weight: 700; }
.stepper { display: flex; align-items: center; }
.q-btn { width: 56rpx; height: 56rpx; text-align: center; line-height: 56rpx; background: #f6f6f6; border-radius: 8rpx; }
.q-num { width: 72rpx; text-align: center; }
.del-btn { margin-left: 8rpx; background: #ff4d4f; color: #fff; border-radius: 8rpx; }
.summary { display: flex; justify-content: space-between; padding: 0 24rpx; margin-top: 8rpx; color: #333; }
.sum { color: #e33; font-weight: 700; }
.actions { display: flex; padding: 12rpx; }
.clear-btn { flex: 1; margin-right: 8rpx; background: #f2f2f2; color: #333; border-radius: 12rpx; }
.checkout-btn { flex: 1; margin-left: 8rpx; background: #07c160; color: #fff; border-radius: 12rpx; }
</style>
