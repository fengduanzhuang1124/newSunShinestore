"use strict";
const common_vendor = require("../../common/vendor.js");
const _sfc_main = {
  data() {
    return {
      searchKeyword: "",
      banners: [
        { id: 1, image: "/static/logo.png", link: "/pages/home/product-list" },
        { id: 2, image: "/static/logo.png", link: "/pages/home/product-list" }
      ],
      categories: [],
      activeCategory: "",
      products: [],
      loading: false,
      defaultImage: "/static/logo.png",
      userAvatar: "/static/logo.png"
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
        const profile = common_vendor.index.getStorageSync("userInfo");
        if (profile && profile.avatar_url)
          this.userAvatar = profile.avatar_url;
      } catch (e) {
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
          common_vendor.index.__f__("warn", "at pages/home/index.vue:113", "获取分类失败:", ((_a = response == null ? void 0 : response.data) == null ? void 0 : _a.msg) || "未知错误");
        }
      } catch (e) {
        common_vendor.index.__f__("error", "at pages/home/index.vue:116", "获取分类错误:", e);
      }
    },
    async fetchProducts() {
      var _a;
      this.loading = true;
      try {
        const params = { page: 1, pageSize: 6, sortBy: "created_at", sortOrder: "DESC" };
        if (this.activeCategory)
          params.category = this.activeCategory;
        common_vendor.index.__f__("log", "at pages/home/index.vue:126", "首页请求推荐商品参数:", params);
        const res = await this.$api.products.getProducts(params);
        const response = res[1] || res;
        common_vendor.index.__f__("log", "at pages/home/index.vue:130", "首页商品接口响应:", response);
        if (response && response.statusCode === 200 && response.data && response.data.code === 200) {
          this.products = response.data.data.list || [];
          common_vendor.index.__f__("log", "at pages/home/index.vue:134", "首页推荐商品加载成功，共", this.products.length, "个商品");
        } else {
          common_vendor.index.__f__("warn", "at pages/home/index.vue:136", "首页获取商品失败:", ((_a = response == null ? void 0 : response.data) == null ? void 0 : _a.msg) || "未知错误");
          this.products = [];
        }
      } catch (e) {
        common_vendor.index.__f__("error", "at pages/home/index.vue:140", "首页获取商品错误:", e);
        this.products = [];
      } finally {
        this.loading = false;
      }
    },
    onSearch() {
      const keyword = (this.searchKeyword || "").trim();
      this.$router.navigateTo(`/pages/home/product-list?search=${encodeURIComponent(keyword)}`);
    },
    onBannerClick(item) {
      if (item && item.link)
        this.$router.navigateTo(item.link);
    },
    onSelectCategory(cat) {
      this.activeCategory = cat;
      this.fetchProducts();
    },
    goToProducts() {
      this.$router.switchTab("/pages/home/product-list");
    },
    goToCart() {
      this.$router.switchTab("/pages/home/shopping-cart");
    },
    goToOrders() {
      this.$router.navigateTo("/pages/home/my-orders");
    },
    goToProfile() {
      this.$router.switchTab("/pages/account/profile");
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
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: common_vendor.o((...args) => $options.onSearch && $options.onSearch(...args)),
    b: $data.searchKeyword,
    c: common_vendor.o(($event) => $data.searchKeyword = $event.detail.value),
    d: common_vendor.o((...args) => $options.onSearch && $options.onSearch(...args)),
    e: $data.userAvatar,
    f: common_vendor.o((...args) => $options.goToProfile && $options.goToProfile(...args)),
    g: common_vendor.f($data.banners, (item, k0, i0) => {
      return {
        a: item.image,
        b: item.id,
        c: common_vendor.o(($event) => $options.onBannerClick(item), item.id)
      };
    }),
    h: common_vendor.o((...args) => $options.goToProducts && $options.goToProducts(...args)),
    i: common_vendor.o((...args) => $options.goToCart && $options.goToCart(...args)),
    j: common_vendor.o((...args) => $options.goToOrders && $options.goToOrders(...args)),
    k: common_vendor.o((...args) => $options.goToProfile && $options.goToProfile(...args)),
    l: $data.categories.length
  }, $data.categories.length ? {
    m: common_vendor.f($data.categories, (cat, k0, i0) => {
      return {
        a: common_vendor.t(cat),
        b: common_vendor.n($data.activeCategory === cat ? "active" : ""),
        c: cat,
        d: common_vendor.o(($event) => $options.onSelectCategory(cat), cat)
      };
    }),
    n: common_vendor.n($data.activeCategory === "" ? "active" : ""),
    o: common_vendor.o(($event) => $options.onSelectCategory(""))
  } : {}, {
    p: common_vendor.o((...args) => $options.goToProducts && $options.goToProducts(...args)),
    q: common_vendor.f($data.products, (item, k0, i0) => {
      return common_vendor.e({
        a: item.image || $data.defaultImage,
        b: common_vendor.t(item.name),
        c: common_vendor.t($options.formatPrice(item.price)),
        d: item.category
      }, item.category ? {
        e: common_vendor.t(item.category)
      } : {}, {
        f: item.id,
        g: common_vendor.o(($event) => $options.goProductDetail(item.id), item.id)
      });
    }),
    r: !$data.loading && !$data.products.length
  }, !$data.loading && !$data.products.length ? {} : {}, {
    s: $data.loading
  }, $data.loading ? {} : {});
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-4978fed5"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/home/index.js.map
