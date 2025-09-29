"use strict";
const common_vendor = require("../../common/vendor.js");
const _sfc_main = {
  data() {
    return {
      userInfo: null
    };
  },
  onLoad() {
    this.loadUserInfo();
  },
  onShow() {
    this.loadUserInfo();
  },
  methods: {
    loadUserInfo() {
      const userInfo = common_vendor.index.getStorageSync("userInfo");
      common_vendor.index.__f__("log", "at pages/account/profile.vue:85", "加载用户信息:", userInfo);
      if (userInfo) {
        this.userInfo = userInfo;
      } else {
        this.userInfo = null;
      }
    },
    formatDate(dateString) {
      if (!dateString)
        return "未知";
      const date = new Date(dateString);
      return date.toLocaleDateString("zh-CN");
    },
    goToLogin() {
      common_vendor.index.navigateTo({
        url: "/pages/account/login"
      });
    },
    logout() {
      common_vendor.index.showModal({
        title: "确认退出",
        content: "确定要退出登录吗？",
        success: (res) => {
          if (res.confirm) {
            common_vendor.index.removeStorageSync("token");
            common_vendor.index.removeStorageSync("userInfo");
            this.userInfo = null;
            common_vendor.index.showToast({ title: "已退出登录", icon: "success" });
          }
        }
      });
    },
    async testBackend() {
      try {
        common_vendor.index.showLoading({ title: "测试连接中..." });
        const res = await this.$api.health();
        common_vendor.index.hideLoading();
        common_vendor.index.__f__("log", "at pages/account/profile.vue:131", "后端连接响应:", res);
        const response = res[1] || res;
        common_vendor.index.__f__("log", "at pages/account/profile.vue:135", "处理后的响应:", response);
        if (response && response.statusCode === 200) {
          common_vendor.index.showToast({
            title: "后端连接正常",
            icon: "success"
          });
          common_vendor.index.__f__("log", "at pages/account/profile.vue:142", "后端响应:", response.data);
        } else {
          common_vendor.index.showToast({
            title: "后端连接异常",
            icon: "none"
          });
        }
      } catch (error) {
        common_vendor.index.hideLoading();
        common_vendor.index.showToast({
          title: "连接失败，请检查后端服务",
          icon: "none"
        });
        common_vendor.index.__f__("error", "at pages/account/profile.vue:155", "连接错误:", error);
      }
    }
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: $data.userInfo
  }, $data.userInfo ? common_vendor.e({
    b: $data.userInfo.avatar_url
  }, $data.userInfo.avatar_url ? {
    c: $data.userInfo.avatar_url
  } : {}, {
    d: common_vendor.t($data.userInfo.nickname || $data.userInfo.username),
    e: common_vendor.t($data.userInfo.role === "admin" ? "管理员" : "普通用户"),
    f: common_vendor.t($data.userInfo.id),
    g: common_vendor.t($data.userInfo.username),
    h: $data.userInfo.nickname
  }, $data.userInfo.nickname ? {
    i: common_vendor.t($data.userInfo.nickname)
  } : {}, {
    j: common_vendor.t($options.formatDate($data.userInfo.created_at)),
    k: common_vendor.t($data.userInfo.gender === 1 ? "男" : "女"),
    l: common_vendor.t($data.userInfo.country),
    m: common_vendor.t($data.userInfo.province),
    n: common_vendor.t($data.userInfo.city)
  }) : {
    o: common_vendor.o((...args) => $options.goToLogin && $options.goToLogin(...args))
  }, {
    p: $data.userInfo
  }, $data.userInfo ? {
    q: common_vendor.o((...args) => $options.logout && $options.logout(...args)),
    r: common_vendor.o((...args) => $options.testBackend && $options.testBackend(...args))
  } : {});
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-062f0fcd"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/account/profile.js.map
