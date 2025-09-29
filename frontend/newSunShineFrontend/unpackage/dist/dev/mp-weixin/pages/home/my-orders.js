"use strict";
const common_vendor = require("../../common/vendor.js");
const _sfc_main = {
  data() {
    return {
      status: "",
      orders: [],
      page: 1,
      pageSize: 10,
      totalPages: 1,
      loading: false,
      hasMore: false
    };
  },
  onShow() {
    if (!this.ensureLogin())
      return;
    this.fetchOrders(true);
  },
  methods: {
    async fetchOrders(reset = false) {
      var _a;
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
          common_vendor.index.showToast({ title: ((_a = r == null ? void 0 : r.data) == null ? void 0 : _a.msg) || "加载失败", icon: "none" });
        }
      } catch (e) {
        common_vendor.index.showToast({ title: "网络错误", icon: "none" });
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
        pending: "待支付",
        paid: "已支付",
        shipped: "已发货",
        finished: "已完成",
        cancelled: "已取消"
      };
      return m[s] || "未知";
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
    },
    // 可选：本地格式化时间
    fmtTime(ts) {
      if (!ts)
        return "";
      const d = new Date(ts);
      return d.toLocaleString("zh-CN");
    }
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: common_vendor.n($data.status === "" ? "active" : ""),
    b: common_vendor.o(($event) => $options.switchStatus("")),
    c: common_vendor.n($data.status === "pending" ? "active" : ""),
    d: common_vendor.o(($event) => $options.switchStatus("pending")),
    e: common_vendor.n($data.status === "paid" ? "active" : ""),
    f: common_vendor.o(($event) => $options.switchStatus("paid")),
    g: common_vendor.n($data.status === "shipped" ? "active" : ""),
    h: common_vendor.o(($event) => $options.switchStatus("shipped")),
    i: common_vendor.n($data.status === "finished" ? "active" : ""),
    j: common_vendor.o(($event) => $options.switchStatus("finished")),
    k: common_vendor.n($data.status === "cancelled" ? "active" : ""),
    l: common_vendor.o(($event) => $options.switchStatus("cancelled")),
    m: common_vendor.f($data.orders, (order, k0, i0) => {
      return {
        a: common_vendor.t(order.order_no),
        b: common_vendor.t($options.mapStatus(order.status)),
        c: common_vendor.t(order.created_at),
        d: common_vendor.t($options.formatPrice(order.total_price)),
        e: order.id,
        f: common_vendor.o(($event) => $options.goDetail(order.id), order.id)
      };
    }),
    n: $data.loading
  }, $data.loading ? {} : {}, {
    o: !$data.loading && !$data.orders.length
  }, !$data.loading && !$data.orders.length ? {} : {}, {
    p: $data.hasMore && !$data.loading
  }, $data.hasMore && !$data.loading ? {
    q: common_vendor.o((...args) => $options.loadMore && $options.loadMore(...args))
  } : {});
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-48dc6690"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/home/my-orders.js.map
