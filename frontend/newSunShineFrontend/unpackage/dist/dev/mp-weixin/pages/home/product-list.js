"use strict";
const common_vendor = require("../../common/vendor.js");
const _sfc_main = {
  data() {
    return {
      keyword: "",
      categories: [],
      activeCategory: "",
      products: [],
      page: 1,
      pageSize: 10,
      totalPages: 1,
      loading: false,
      hasMore: false,
      error: "",
      defaultImage: "/static/logo.png",
      sortIndex: 0,
      sortOptions: ["最新", "价格升序", "价格降序"],
      initTimeout: null
    };
  },
  onLoad(query) {
    try {
      common_vendor.index.__f__("log", "at pages/home/product-list.vue:81", "商品列表页开始加载");
      if (query && query.search) {
        this.keyword = decodeURIComponent(query.search);
      }
      this.init();
    } catch (e) {
      common_vendor.index.__f__("error", "at pages/home/product-list.vue:87", "页面加载错误:", e);
      this.error = "页面加载失败";
    }
  },
  onUnload() {
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
        this.error = "";
        this.initTimeout = setTimeout(() => {
          this.loading = false;
          this.error = "加载超时，请重试";
        }, 15e3);
        await Promise.all([
          this.fetchCategories(),
          this.fetchProducts(true)
        ]);
        clearTimeout(this.initTimeout);
        common_vendor.index.__f__("log", "at pages/home/product-list.vue:121", "商品列表页初始化完成");
      } catch (e) {
        common_vendor.index.__f__("error", "at pages/home/product-list.vue:123", "初始化失败:", e);
        this.error = "加载失败，请重试";
      } finally {
        this.loading = false;
        if (this.initTimeout) {
          clearTimeout(this.initTimeout);
        }
      }
    },
    async fetchCategories() {
      var _a;
      try {
        const res = await this.$api.products.getCategories();
        const response = res[1] || res;
        if (response && response.statusCode === 200 && response.data && response.data.code === 200) {
          this.categories = response.data.data || [];
        } else {
          common_vendor.index.__f__("warn", "at pages/home/product-list.vue:139", "获取分类失败:", (_a = response == null ? void 0 : response.data) == null ? void 0 : _a.msg);
        }
      } catch (e) {
        common_vendor.index.__f__("error", "at pages/home/product-list.vue:142", "获取分类错误:", e);
      }
    },
    async fetchProducts(reset = false) {
      var _a;
      if (reset) {
        this.page = 1;
        this.products = [];
      }
      this.loading = true;
      this.error = "";
      try {
        const { keyword, activeCategory, page, pageSize, sortIndex } = this;
        let sortBy = "created_at";
        let sortOrder = "DESC";
        if (sortIndex === 1) {
          sortBy = "price";
          sortOrder = "ASC";
        }
        if (sortIndex === 2) {
          sortBy = "price";
          sortOrder = "DESC";
        }
        const params = {
          page,
          pageSize,
          search: keyword,
          category: activeCategory,
          sortBy,
          sortOrder
        };
        common_vendor.index.__f__("log", "at pages/home/product-list.vue:171", "请求商品列表参数:", params);
        const res = await this.$api.products.getProducts(params);
        const response = res[1] || res;
        if (response && response.statusCode === 200 && response.data && response.data.code === 200) {
          const { list, pagination } = response.data.data || {};
          this.products = this.products.concat(list || []);
          this.totalPages = pagination && pagination.totalPages || 1;
          this.hasMore = this.page < this.totalPages;
          common_vendor.index.__f__("log", "at pages/home/product-list.vue:180", "商品列表加载成功，共", this.products.length, "个商品");
        } else {
          throw new Error(((_a = response == null ? void 0 : response.data) == null ? void 0 : _a.msg) || "获取商品列表失败");
        }
      } catch (e) {
        common_vendor.index.__f__("error", "at pages/home/product-list.vue:185", "获取商品列表错误:", e);
        this.error = e.message || "获取商品列表失败";
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
      this.error = "";
      this.init();
    },
    goDetail(id) {
      try {
        this.$router.navigateTo(`/pages/home/product-detail?id=${id}`);
      } catch (e) {
        common_vendor.index.__f__("error", "at pages/home/product-list.vue:219", "跳转详情页失败:", e);
        common_vendor.index.showToast({ title: "跳转失败", icon: "none" });
      }
    },
    formatPrice(v) {
      const n = Number(v || 0);
      return n.toFixed(2);
    }
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: common_vendor.o((...args) => $options.onSearch && $options.onSearch(...args)),
    b: $data.keyword,
    c: common_vendor.o(($event) => $data.keyword = $event.detail.value),
    d: common_vendor.o((...args) => $options.onSearch && $options.onSearch(...args)),
    e: $data.categories.length
  }, $data.categories.length ? {
    f: common_vendor.f($data.categories, (cat, k0, i0) => {
      return {
        a: common_vendor.t(cat),
        b: common_vendor.n($data.activeCategory === cat ? "active" : ""),
        c: cat,
        d: common_vendor.o(($event) => $options.onSelectCategory(cat), cat)
      };
    }),
    g: common_vendor.n($data.activeCategory === "" ? "active" : ""),
    h: common_vendor.o(($event) => $options.onSelectCategory(""))
  } : {}, {
    i: common_vendor.t($data.sortOptions[$data.sortIndex]),
    j: $data.sortIndex,
    k: $data.sortOptions,
    l: common_vendor.o((...args) => $options.onSortChange && $options.onSortChange(...args)),
    m: !$data.loading && $data.products.length
  }, !$data.loading && $data.products.length ? {
    n: common_vendor.f($data.products, (item, k0, i0) => {
      return common_vendor.e({
        a: item.image || $data.defaultImage,
        b: common_vendor.t(item.name),
        c: common_vendor.t($options.formatPrice(item.price)),
        d: item.category
      }, item.category ? {
        e: common_vendor.t(item.category)
      } : {}, {
        f: item.id,
        g: common_vendor.o(($event) => $options.goDetail(item.id), item.id)
      });
    })
  } : {}, {
    o: $data.loading
  }, $data.loading ? {} : {}, {
    p: !$data.loading && !$data.products.length && !$data.error
  }, !$data.loading && !$data.products.length && !$data.error ? {
    q: common_vendor.o((...args) => $options.retryLoad && $options.retryLoad(...args))
  } : {}, {
    r: $data.error
  }, $data.error ? {
    s: common_vendor.t($data.error),
    t: common_vendor.o((...args) => $options.retryLoad && $options.retryLoad(...args))
  } : {}, {
    v: $data.hasMore && !$data.loading && !$data.error
  }, $data.hasMore && !$data.loading && !$data.error ? {
    w: common_vendor.o((...args) => $options.loadMore && $options.loadMore(...args))
  } : {});
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-90307e5d"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/home/product-list.js.map
