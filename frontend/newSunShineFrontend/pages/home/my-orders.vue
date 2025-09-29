<template>
  <view class="page">
    <view class="tabs">
      <view :class="['tab', status==='' ? 'active' : '']" @click="switchStatus('')">全部</view>
      <view :class="['tab', status==='pending' ? 'active' : '']" @click="switchStatus('pending')">待支付</view>
      <view :class="['tab', status==='paid' ? 'active' : '']" @click="switchStatus('paid')">已支付</view>
      <view :class="['tab', status==='shipped' ? 'active' : '']" @click="switchStatus('shipped')">已发货</view>
      <view :class="['tab', status==='finished' ? 'active' : '']" @click="switchStatus('finished')">已完成</view>
      <view :class="['tab', status==='cancelled' ? 'active' : '']" @click="switchStatus('cancelled')">已取消</view>

    </view>

    <view class="order-list">
      <view class="order-card" v-for="order in orders" :key="order.id" @click="goDetail(order.id)">
        <view class="row">
          <text class="order-no">订单号：{{ order.order_no }}</text>
          <text class="badge">{{ mapStatus(order.status) }}</text>
        </view>
        <view class="row small">{{ order.created_at }}</view>
        <view class="row total">总额：¥ {{ formatPrice(order.total_price) }}</view>
      </view>
    </view>

    <view class="loading" v-if="loading">加载中...</view>
    <view class="empty" v-if="!loading && !orders.length">暂无订单</view>

    <view class="load-more" v-if="hasMore && !loading">
      <button class="more-btn" @click="loadMore">加载更多</button>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      status: '',
      orders: [],
      page: 1,
      pageSize: 10,
      totalPages: 1,
      loading: false,
      hasMore: false
    };
  },
  onShow() {
    if (!this.ensureLogin()) return;
    this.fetchOrders(true);
  },
  methods: {
    async fetchOrders(reset = false) {
      if (reset) {
        this.page = 1;
        this.orders = [];
      }
      this.loading = true;
      try {
        const res = await this.$api.orders.getOrders({
          status: this.status,
          page: this.page,
          pageSize: this.pageSize
        });
        const r = res[1] || res;
        if (r && r.statusCode >= 200 && r.statusCode < 300 && r.data && r.data.code === 200) {
          const { list = [], pagination = {} } = r.data.data || {};
          this.orders = this.orders.concat(list);
          this.totalPages = Number(pagination.totalPages || 1);
          this.hasMore = this.page < this.totalPages;
        } else {
          uni.showToast({ title: r?.data?.msg || '加载失败', icon: 'none' });
        }
      } catch (e) {
        uni.showToast({ title: '网络错误', icon: 'none' });
      } finally {
        this.loading = false;
      }
    },
    switchStatus(s) {
      this.status = s;
      this.fetchOrders(true);
    },
    loadMore() {
      if (this.hasMore && !this.loading) {
        this.page += 1;
        this.fetchOrders(false);
      }
    },
    goDetail(id) {
      this.$router.navigateTo(`/pages/home/order-detail?id=${id}`);
    },
    mapStatus(s) {
      const m = {
        pending: '待支付',
        paid: '已支付',
        shipped: '已发货',
        finished: '已完成',
        cancelled: '已取消'
      };
      return m[s] || '未知';
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
    },
    // 可选：本地格式化时间
    fmtTime(ts) {
      if (!ts) return '';
      const d = new Date(ts);
      return d.toLocaleString('zh-CN');
    }
  }
};
</script>


<style scoped>
.page { background: #f5f5f5; min-height: 100vh; }
.tabs { display: flex; background: #fff; margin: 12rpx; border-radius: 12rpx; overflow: hidden; }
.tab { flex: 1; text-align: center; padding: 20rpx 0; color: #333; }
.tab.active { color: #07c160; font-weight: 700; border-bottom: 4rpx solid #07c160; }
.order-list { margin: 12rpx; }
.order-card { background: #fff; border-radius: 12rpx; padding: 16rpx; margin-bottom: 12rpx; }
.row { display: flex; justify-content: space-between; align-items: center; }
.row.small { color: #999; font-size: 24rpx; margin-top: 4rpx; }
.order-no { color: #111; font-size: 28rpx; }
.badge { color: #07c160; font-size: 24rpx; }
.total { color: #e33; font-weight: 700; margin-top: 4rpx; }
.loading, .empty, .load-more { text-align: center; color: #666; padding: 24rpx 0; }
.more-btn { background: #07c160; color: #fff; border-radius: 999rpx; font-size: 26rpx; padding: 0 36rpx; }
</style>
