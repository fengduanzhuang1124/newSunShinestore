"use strict";
const common_vendor = require("../../../common/vendor.js");
const _sfc_main = {
  data() {
    return {
      users: []
    };
  },
  methods: {
    getUsers() {
      common_vendor.index.__f__("log", "at pages/index/user/index.vue:19", "按钮被点击了");
      common_vendor.index.request({
        url: "http://192.168.1.17:3000/api/users",
        method: "GET",
        success: (res) => {
          common_vendor.index.__f__("log", "at pages/index/user/index.vue:24", "获取用户成功:", res.data);
          this.users = res.data;
        },
        fail: (err) => {
          common_vendor.index.__f__("error", "at pages/index/user/index.vue:28", "请求失败", err);
        }
      });
      common_vendor.index.__f__("log", "at pages/index/user/index.vue:31", "按钮被点击了");
    }
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return {
    a: common_vendor.o((...args) => $options.getUsers && $options.getUsers(...args)),
    b: common_vendor.f($data.users, (user, index, i0) => {
      return {
        a: common_vendor.t(user.username),
        b: index
      };
    })
  };
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../../.sourcemap/mp-weixin/pages/index/user/index.js.map
