"use strict";
const common_vendor = require("../../common/vendor.js");
const _sfc_main = {
  data() {
    return {
      items: [],
      address: "",
      phone: "",
      receiver_name: "",
      defaultImage: "/static/logo.png"
    };
  },
  computed: {
    totalAmount() {
      return this.items.reduce((sum, it) => sum + Number(it.price) * Number(it.quantity), 0);
    }
  },
  onShow() {
    const cached = common_vendor.index.getStorageSync("checkout_items");
    this.items = Array.isArray(cached) ? cached : [];
    const profile = common_vendor.index.getStorageSync("userInfo") || {};
    this.receiver_name = this.receiver_name || profile.nickname || "";
    this.phone = this.phone || profile.phone || "";
    this.address = this.address || profile.address || "";
  },
  methods: {
    async submitOrder() {
      if (!this.ensureLogin())
        return;
      if (!this.receiver_name || !this.phone || !this.address) {
        common_vendor.index.showToast({ title: "请完整填写收货信息", icon: "none" });
        return;
      }
      if (!this.items.length) {
        common_vendor.index.showToast({ title: "商品清单为空", icon: "none" });
        return;
      }
      try {
        const payload = {
          items: this.items.map((it) => ({ product_id: it.product_id, quantity: it.quantity })),
          address: this.address,
          phone: this.phone,
          receiver_name: this.receiver_name
        };
        const res = await this.$api.orders.createOrder(payload);
        const response = res[1] || res;
        if (response && response.statusCode >= 200 && response.statusCode < 300 && (response.data.code === 200 || response.data.code === 201)) {
          common_vendor.index.removeStorageSync("checkout_items");
          common_vendor.index.showToast({ title: "下单成功", icon: "success" });
          setTimeout(() => this.$router.navigateTo("/pages/home/my-orders"), 600);
        } else {
          common_vendor.index.showToast({ title: response.data.msg || "下单失败", icon: "none" });
        }
      } catch (e) {
        common_vendor.index.showToast({ title: "下单失败", icon: "none" });
      }
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
  return {
    a: $data.receiver_name,
    b: common_vendor.o(($event) => $data.receiver_name = $event.detail.value),
    c: $data.phone,
    d: common_vendor.o(($event) => $data.phone = $event.detail.value),
    e: $data.address,
    f: common_vendor.o(($event) => $data.address = $event.detail.value),
    g: common_vendor.f($data.items, (it, k0, i0) => {
      return {
        a: it.image || $data.defaultImage,
        b: common_vendor.t(it.name),
        c: common_vendor.t(it.quantity),
        d: common_vendor.t($options.formatPrice(it.price)),
        e: it.product_id
      };
    }),
    h: common_vendor.t($options.formatPrice($options.totalAmount)),
    i: common_vendor.o((...args) => $options.submitOrder && $options.submitOrder(...args))
  };
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-9864f2f3"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/home/checkout.js.map
