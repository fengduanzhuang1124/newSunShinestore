"use strict";
const common_vendor = require("../../common/vendor.js");
const _sfc_main = {
  data() {
    return {
      formData: {
        username: "",
        password: ""
      },
      loading: false
    };
  },
  methods: {
    validateForm() {
      if (!this.formData.username.trim()) {
        common_vendor.index.showToast({ title: "请输入用户名", icon: "none" });
        return false;
      }
      if (!this.formData.password) {
        common_vendor.index.showToast({ title: "请输入密码", icon: "none" });
        return false;
      }
      return true;
    },
    // 微信一键登录
    async wechatLogin() {
      try {
        common_vendor.index.showLoading({ title: "登录中..." });
        const loginRes = await common_vendor.index.login({ provider: "weixin" });
        const code = loginRes[1] ? loginRes[1].code : loginRes.code;
        if (!code) {
          throw new Error("获取微信授权码失败");
        }
        common_vendor.index.__f__("log", "at pages/account/login.vue:86", "获取到微信授权码:", code);
        let userInfo = {};
        try {
          common_vendor.index.__f__("log", "at pages/account/login.vue:91", "开始获取用户信息...");
          common_vendor.index.showModal({
            title: "授权提示",
            content: '即将弹出微信授权窗口，请点击"确定"获取您的头像和昵称',
            showCancel: false,
            success: async (modalRes) => {
              var _a, _b, _c, _d, _e, _f;
              if (modalRes.confirm) {
                try {
                  const profileRes = await common_vendor.index.getUserProfile({
                    desc: "用于完善会员资料"
                  });
                  common_vendor.index.__f__("log", "at pages/account/login.vue:104", "用户信息获取成功:", profileRes);
                  const profile = profileRes[1] || profileRes;
                  userInfo = {
                    nickname: (_a = profile.userInfo) == null ? void 0 : _a.nickName,
                    avatarUrl: (_b = profile.userInfo) == null ? void 0 : _b.avatarUrl,
                    gender: (_c = profile.userInfo) == null ? void 0 : _c.gender,
                    country: (_d = profile.userInfo) == null ? void 0 : _d.country,
                    province: (_e = profile.userInfo) == null ? void 0 : _e.province,
                    city: (_f = profile.userInfo) == null ? void 0 : _f.city
                  };
                  common_vendor.index.__f__("log", "at pages/account/login.vue:115", "解析后的用户信息:", userInfo);
                  await this.completeWechatLogin(code, userInfo);
                } catch (profileError) {
                  common_vendor.index.__f__("error", "at pages/account/login.vue:120", "获取用户信息失败:", profileError);
                  common_vendor.index.showToast({ title: "获取用户信息失败", icon: "none" });
                  await this.completeWechatLogin(code, {});
                }
              }
            }
          });
          return;
        } catch (profileError) {
          common_vendor.index.__f__("error", "at pages/account/login.vue:132", "用户信息授权失败:", profileError);
          common_vendor.index.showToast({ title: "用户信息授权失败", icon: "none" });
          await this.completeWechatLogin(code, {});
        }
      } catch (err) {
        common_vendor.index.__f__("error", "at pages/account/login.vue:138", "微信登录失败:", err);
        common_vendor.index.showToast({ title: "微信登录失败", icon: "none" });
      } finally {
        common_vendor.index.hideLoading();
      }
    },
    // 完成微信登录流程
    async completeWechatLogin(code, userInfo) {
      var _a;
      try {
        common_vendor.index.__f__("log", "at pages/account/login.vue:148", "开始发送登录请求，code:", code, "userInfo:", userInfo);
        const res = await this.$api.users.wechatLogin({
          code,
          ...userInfo
        }, { loadingText: "登录中..." });
        common_vendor.index.__f__("log", "at pages/account/login.vue:156", "后端登录响应:", res);
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const { token, user } = res.data;
          common_vendor.index.__f__("log", "at pages/account/login.vue:161", "登录成功，用户信息:", user);
          common_vendor.index.setStorageSync("token", token);
          common_vendor.index.setStorageSync("userInfo", user);
          common_vendor.index.showToast({ title: "登录成功", icon: "success" });
          setTimeout(() => {
            if (user.role === "admin") {
              common_vendor.index.showModal({
                title: "管理员登录",
                content: "管理员请使用网页版管理后台：http://localhost:3000/admin",
                showCancel: false,
                confirmText: "知道了"
              });
            } else {
              common_vendor.index.switchTab({ url: "/pages/home/index" });
            }
          }, 1e3);
        } else {
          const msg = ((_a = res == null ? void 0 : res.data) == null ? void 0 : _a.error) || "登录失败";
          common_vendor.index.__f__("error", "at pages/account/login.vue:185", "登录失败:", msg);
          common_vendor.index.showToast({ title: msg, icon: "none" });
        }
      } catch (err) {
        common_vendor.index.__f__("error", "at pages/account/login.vue:189", "完成登录流程失败:", err);
        common_vendor.index.showToast({ title: "登录失败", icon: "none" });
      }
    },
    async handleLogin() {
      if (!this.validateForm()) {
        return;
      }
      this.loading = true;
      try {
        const res = await this.$api.users.login({ username: this.formData.username, password: this.formData.password });
        common_vendor.index.__f__("log", "at pages/account/login.vue:215", "登录响应:", res);
        const response = res[1] || res;
        common_vendor.index.__f__("log", "at pages/account/login.vue:219", "处理后的响应:", response);
        if (response && response.statusCode === 200) {
          const { token, user } = response.data;
          common_vendor.index.__f__("log", "at pages/account/login.vue:224", "登录成功，用户信息:", user);
          common_vendor.index.setStorageSync("token", token);
          common_vendor.index.setStorageSync("userInfo", user);
          common_vendor.index.__f__("log", "at pages/account/login.vue:230", "已保存到本地存储，token:", token);
          common_vendor.index.__f__("log", "at pages/account/login.vue:231", "已保存到本地存储，userInfo:", user);
          common_vendor.index.showToast({ title: "登录成功", icon: "success" });
          setTimeout(() => {
            if (user.role === "admin") {
              common_vendor.index.showModal({
                title: "管理员登录",
                content: "管理员请使用网页版管理后台：http://localhost:3000/admin",
                showCancel: false,
                confirmText: "知道了"
              });
            } else {
              common_vendor.index.switchTab({
                url: "/pages/home/index"
              });
            }
          }, 1500);
        } else {
          const errorMsg = response && response.data && response.data.error ? response.data.error : "登录失败";
          common_vendor.index.showToast({
            title: errorMsg,
            icon: "none"
          });
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages/account/login.vue:259", "登录失败:", error);
        common_vendor.index.showToast({ title: "网络错误，请重试", icon: "none" });
      } finally {
        this.loading = false;
      }
    },
    goToRegister() {
      common_vendor.index.navigateTo({
        url: "/pages/account/register"
      });
    },
    goToAdmin() {
      common_vendor.index.showModal({
        title: "管理后台",
        content: "请使用网页版管理后台：http://localhost:3000/admin",
        showCancel: false,
        confirmText: "知道了"
      });
    }
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return {
    a: $data.formData.username,
    b: common_vendor.o(($event) => $data.formData.username = $event.detail.value),
    c: $data.formData.password,
    d: common_vendor.o(($event) => $data.formData.password = $event.detail.value),
    e: common_vendor.t($data.loading ? "登录中..." : "微信一键登录"),
    f: common_vendor.o((...args) => $options.wechatLogin && $options.wechatLogin(...args)),
    g: $data.loading,
    h: common_vendor.t($data.loading ? "登录中..." : "用户名密码登录"),
    i: common_vendor.o((...args) => $options.handleLogin && $options.handleLogin(...args)),
    j: $data.loading,
    k: common_vendor.o((...args) => $options.goToAdmin && $options.goToAdmin(...args)),
    l: common_vendor.o((...args) => $options.goToRegister && $options.goToRegister(...args))
  };
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-1095b067"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/account/login.js.map
