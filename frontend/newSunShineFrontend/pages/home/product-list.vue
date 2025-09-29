<template>
  <view class="page">
    <!-- 顶部搜索与分类 -->
    <view class="top-bar">
      <view class="search-box">
        <input class="search-input" type="text" v-model="keyword" placeholder="搜索商品" confirm-type="search" @confirm="onSearch" />
        <button class="search-btn" @click="onSearch">搜索</button>
      </view>
    </view>

    <scroll-view class="category-scroll" scroll-x v-if="categories.length">
      <view :class="['cat-chip', activeCategory===cat ? 'active' : '']" v-for="cat in categories" :key="cat" @click="onSelectCategory(cat)">{{ cat }}</view>
      <view :class="['cat-chip', activeCategory==='' ? 'active' : '']" @click="onSelectCategory('')">全部</view>
    </scroll-view>

    <!-- 排序行 -->
    <view class="sort-row">
      <picker :value="sortIndex" :range="sortOptions" @change="onSortChange">
        <view class="sort-picker">排序：{{ sortOptions[sortIndex] }}</view>
      </picker>
    </view>

    <!-- 列表 -->
    <view class="product-list" v-if="!loading && products.length">
      <view class="product-card" v-for="item in products" :key="item.id" @click="goDetail(item.id)">
        <image class="cover" :src="item.image || defaultImage" mode="aspectFill" />
        <view class="p-name">{{ item.name }}</view>
        <view class="p-bottom">
          <text class="p-price">¥ {{ formatPrice(item.price) }}</text>
          <text class="p-tag" v-if="item.category">{{ item.category }}</text>
        </view>
      </view>
    </view>

    <!-- 加载状态 -->
    <view class="loading" v-if="loading">
      <text>加载中...</text>
    </view>

    <!-- 空状态 -->
    <view class="empty" v-if="!loading && !products.length && !error">
      <text>暂无商品</text>
      <button class="retry-btn" @click="retryLoad">重新加载</button>
    </view>

    <!-- 错误状态 -->
    <view class="error" v-if="error">
      <text>{{ error }}</text>
      <button class="retry-btn" @click="retryLoad">重试</button>
    </view>

    <!-- 底部加载更多 -->
    <view class="load-more" v-if="hasMore && !loading && !error">
      <button class="more-btn" @click="loadMore">加载更多</button>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      keyword: '',
      categories: [],
      activeCategory: '',
      products: [],
      page: 1,
      pageSize: 10,
      totalPages: 1,
      loading: false,
      hasMore: false,
      error: '',
      defaultImage: '/static/logo.png',
      sortIndex: 0,
      sortOptions: ['最新', '价格升序', '价格降序'],
      initTimeout: null
    };
  },
  onLoad(query) {
    try {
      console.log('商品列表页开始加载');
      if (query && query.search) {
        this.keyword = decodeURIComponent(query.search);
      }
      this.init();
    } catch (e) {
      console.error('页面加载错误:', e);
      this.error = '页面加载失败';
    }
  },
  onUnload() {
    // 清理定时器
    if (this.initTimeout) {
      clearTimeout(this.initTimeout);
    }
  },
  onReachBottom() {
    if (this.hasMore && !this.loading && !this.error) {
      this.loadMore();
    }
  },
  methods: {
    async init() {
      try {
        this.loading = true;
        this.error = '';
        
        // 设置超时控制
        this.initTimeout = setTimeout(() => {
          this.loading = false;
          this.error = '加载超时，请重试';
        }, 15000); // 15秒超时

        // 并行加载分类和商品
        await Promise.all([
          this.fetchCategories(),
          this.fetchProducts(true)
        ]);

        clearTimeout(this.initTimeout);
        console.log('商品列表页初始化完成');
      } catch (e) {
        console.error('初始化失败:', e);
        this.error = '加载失败，请重试';
      } finally {
        this.loading = false;
        if (this.initTimeout) {
          clearTimeout(this.initTimeout);
        }
      }
    },
    async fetchCategories() {
      try {
        const res = await this.$api.products.getCategories();
        const response = res[1] || res;
        if (response && response.statusCode === 200 && response.data && response.data.code === 200) {
          this.categories = response.data.data || [];
        } else {
          console.warn('获取分类失败:', response?.data?.msg);
        }
      } catch (e) {
        console.error('获取分类错误:', e);
        // 分类失败不影响主流程
      }
    },
    async fetchProducts(reset = false) {
      if (reset) {
        this.page = 1;
        this.products = [];
      }
      
      this.loading = true;
      this.error = '';
      
      try {
        const { keyword, activeCategory, page, pageSize, sortIndex } = this;
        let sortBy = 'created_at';
        let sortOrder = 'DESC';
        if (sortIndex === 1) { sortBy = 'price'; sortOrder = 'ASC'; }
        if (sortIndex === 2) { sortBy = 'price'; sortOrder = 'DESC'; }

        const params = {
          page,
          pageSize,
          search: keyword,
          category: activeCategory,
          sortBy,
          sortOrder
        };

        console.log('请求商品列表参数:', params);
        const res = await this.$api.products.getProducts(params);
        const response = res[1] || res;
        
        if (response && response.statusCode === 200 && response.data && response.data.code === 200) {
          const { list, pagination } = response.data.data || {};
          this.products = this.products.concat(list || []);
          this.totalPages = (pagination && pagination.totalPages) || 1;
          this.hasMore = this.page < this.totalPages;
          console.log('商品列表加载成功，共', this.products.length, '个商品');
        } else {
          throw new Error(response?.data?.msg || '获取商品列表失败');
        }
      } catch (e) {
        console.error('获取商品列表错误:', e);
        this.error = e.message || '获取商品列表失败';
        if (reset) {
          this.products = [];
        }
      } finally {
        this.loading = false;
      }
    },
    onSearch() {
      this.fetchProducts(true);
    },
    onSelectCategory(cat) {
      this.activeCategory = cat;
      this.fetchProducts(true);
    },
    onSortChange(e) {
      this.sortIndex = Number(e.detail.value || 0);
      this.fetchProducts(true);
    },
    loadMore() {
      if (this.hasMore && !this.loading && !this.error) {
        this.page += 1;
        this.fetchProducts(false);
      }
    },
    retryLoad() {
      this.error = '';
      this.init();
    },
    goDetail(id) {
      try {
        this.$router.navigateTo(`/pages/home/product-detail?id=${id}`);
      } catch (e) {
        console.error('跳转详情页失败:', e);
        uni.showToast({ title: '跳转失败', icon: 'none' });
      }
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
.top-bar { display: flex; align-items: center; padding: 24rpx 24rpx 0 24rpx; }
.search-box { flex: 1; display: flex; background: #ffffff; border-radius: 999rpx; padding: 8rpx 8rpx 8rpx 24rpx; }
.search-input { flex: 1; font-size: 28rpx; }
.search-btn { margin-left: 8rpx; background: #07c160; color: #fff; border-radius: 999rpx; font-size: 26rpx; padding: 0 24rpx; }
.category-scroll { white-space: nowrap; margin: 8rpx 24rpx; }
.cat-chip { display: inline-block; padding: 10rpx 20rpx; margin-right: 12rpx; background: #ffffff; border-radius: 999rpx; font-size: 24rpx; color: #333; }
.cat-chip.active { background: #07c160; color: #fff; }
.sort-row { margin: 8rpx 24rpx; }
.sort-picker { background: #fff; border-radius: 12rpx; padding: 20rpx; color: #333; font-size: 26rpx; }
.product-list { margin: 12rpx 24rpx 24rpx 24rpx; display: grid; grid-template-columns: repeat(2, 1fr); grid-gap: 16rpx; }
.product-card { background: #fff; border-radius: 12rpx; overflow: hidden; padding-bottom: 12rpx; }
.cover { width: 100%; height: 300rpx; background: #f0f0f0; }
.p-name { font-size: 26rpx; color: #111; padding: 12rpx 12rpx 4rpx 12rpx; line-height: 36rpx; height: 72rpx; overflow: hidden; }
.p-bottom { display: flex; align-items: center; justify-content: space-between; padding: 0 12rpx; }
.p-price { color: #e33; font-weight: bold; }
.p-tag { font-size: 22rpx; color: #999; }
.loading, .empty, .error, .load-more { text-align: center; color: #666; padding: 24rpx 0; }
.error { color: #e33; }
.retry-btn { background: #07c160; color: #fff; border-radius: 999rpx; font-size: 26rpx; padding: 8rpx 24rpx; margin-top: 12rpx; }
.more-btn { background: #07c160; color: #fff; border-radius: 999rpx; font-size: 26rpx; padding: 0 36rpx; }
</style>
