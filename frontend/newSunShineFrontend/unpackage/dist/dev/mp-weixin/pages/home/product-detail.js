"use strict";
const common_vendor = require("../../common/vendor.js");
const _sfc_main = {
  data() {
    return {
      productId: null,
      detail: {},
      loading: true,
      quantity: 1,
      defaultImage: "/static/logo.png"
    };
  },
  computed: {
    canBuy() {
      return this.detail && this.detail.status !== "off" && Number(this.detail.stock) > 0;
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
      if (this.quantity < max)
        this.quantity += 1;
    },
    dec() {
      if (this.quantity > 1)
        this.quantity -= 1;
    },
    async handleAddToCart() {
      if (!this.ensureLogin())
        return;
      try {
        const payload = { product_id: Number(this.productId), quantity: Number(this.quantity) };
        const res = await this.$api.cart.addToCart(payload);
        const response = res[1] || res;
        if (response && response.statusCode >= 200 && response.statusCode < 300 && (response.data.code === 200 || response.data.code === 201)) {
          common_vendor.index.showToast({ title: "已加入购物车", icon: "success" });
        } else {
          common_vendor.index.showToast({ title: response.data.msg || "加入失败", icon: "none" });
        }
      } catch (e) {
        common_vendor.index.showToast({ title: "加入失败", icon: "none" });
      }
    },
    handleBuyNow() {
      if (!this.ensureLogin())
        return;
      const item = { product_id: Number(this.productId), quantity: Number(this.quantity), price: Number(this.detail.price), name: this.detail.name, image: this.detail.image };
      common_vendor.index.setStorageSync("checkout_items", [item]);
      this.$router.navigateTo("/pages/home/checkout");
    },
    goCart() {
      this.$router.switchTab("/pages/home/shopping-cart");
    },
    ensureLogin() {
      const token = common_vendor.index.getStorageSync("token");
      if (!token) {
        common_vendor.index.showToast({ title: "请先登录", icon: "none" });
        setTimeout(() => this.$router.switchTab("/pages/account/profile"), 500);
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
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: $data.loading
  }, $data.loading ? {} : common_vendor.e({
    b: $data.detail.image || $data.defaultImage,
    c: common_vendor.t($data.detail.name),
    d: common_vendor.t($options.formatPrice($data.detail.price)),
    e: common_vendor.t($data.detail.stock),
    f: $data.detail.category
  }, $data.detail.category ? {
    g: common_vendor.t($data.detail.category)
  } : {}, {
    h: $data.detail.status === "off"
  }, $data.detail.status === "off" ? {} : {}, {
    i: common_vendor.o((...args) => $options.dec && $options.dec(...args)),
    j: $data.quantity,
    k: common_vendor.o(common_vendor.m(($event) => $data.quantity = $event.detail.value, {
      number: true
    })),
    l: common_vendor.o((...args) => $options.inc && $options.inc(...args)),
    m: common_vendor.t($data.detail.description || "暂无详情"),
    n: common_vendor.o((...args) => $options.goCart && $options.goCart(...args)),
    o: !$options.canBuy,
    p: common_vendor.o((...args) => $options.handleAddToCart && $options.handleAddToCart(...args)),
    q: !$options.canBuy,
    r: common_vendor.o((...args) => $options.handleBuyNow && $options.handleBuyNow(...args))
  }));
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-2e6dc883"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/home/product-detail.js.map
