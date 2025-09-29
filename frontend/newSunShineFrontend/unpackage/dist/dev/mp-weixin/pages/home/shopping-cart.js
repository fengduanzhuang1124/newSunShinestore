"use strict";
const common_vendor = require("../../common/vendor.js");
const _sfc_main = {
  data() {
    return {
      items: [],
      loading: true,
      defaultImage: "/static/logo.png"
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
      if (!this.ensureLogin())
        return;
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
      if (nextQty < 1)
        return;
      try {
        const res = await this.$api.cart.updateCartQuantity(item.id, { quantity: nextQty });
        const response = res[1] || res;
        if (response && response.statusCode === 200 && response.data.code === 200) {
          item.quantity = nextQty;
          this.$forceUpdate();
        } else {
          common_vendor.index.showToast({ title: response.data.msg || "更新失败", icon: "none" });
        }
      } catch (e) {
        common_vendor.index.showToast({ title: "更新失败", icon: "none" });
      }
    },
    async removeItem(cartId) {
      try {
        const res = await this.$api.cart.removeFromCart(cartId);
        const response = res[1] || res;
        if (response && response.statusCode === 200 && response.data.code === 200) {
          this.items = this.items.filter((it) => it.id !== cartId);
        } else {
          common_vendor.index.showToast({ title: response.data.msg || "删除失败", icon: "none" });
        }
      } catch (e) {
        common_vendor.index.showToast({ title: "删除失败", icon: "none" });
      }
    },
    async clearCart() {
      try {
        const res = await this.$api.cart.clearCart();
        const response = res[1] || res;
        if (response && response.statusCode === 200 && response.data.code === 200) {
          this.items = [];
        } else {
          common_vendor.index.showToast({ title: response.data.msg || "清空失败", icon: "none" });
        }
      } catch (e) {
        common_vendor.index.showToast({ title: "清空失败", icon: "none" });
      }
    },
    goCheckout() {
      if (!this.ensureLogin())
        return;
      const checkoutItems = this.items.map((it) => ({ product_id: it.product_id, quantity: it.quantity, price: it.price, name: it.name, image: it.image }));
      common_vendor.index.setStorageSync("checkout_items", checkoutItems);
      this.$router.navigateTo("/pages/home/checkout");
    },
    goToProducts() {
      this.$router.switchTab("/pages/home/product-list");
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
    b: !$data.items.length
  }, !$data.items.length ? {
    c: common_vendor.o((...args) => $options.goToProducts && $options.goToProducts(...args))
  } : {
    d: common_vendor.f($data.items, (item, k0, i0) => {
      return {
        a: item.image || $data.defaultImage,
        b: common_vendor.t(item.name),
        c: common_vendor.t($options.formatPrice(item.price)),
        d: common_vendor.o(($event) => $options.updateQty(item, item.quantity - 1), item.id),
        e: item.quantity <= 1,
        f: common_vendor.t(item.quantity),
        g: common_vendor.o(($event) => $options.updateQty(item, item.quantity + 1), item.id),
        h: common_vendor.o(($event) => $options.removeItem(item.id), item.id),
        i: item.id
      };
    }),
    e: common_vendor.t($data.items.length),
    f: common_vendor.t($options.formatPrice($options.totalAmount)),
    g: common_vendor.o((...args) => $options.clearCart && $options.clearCart(...args)),
    h: common_vendor.o((...args) => $options.goCheckout && $options.goCheckout(...args))
  }));
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-1f95ba4e"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/home/shopping-cart.js.map
