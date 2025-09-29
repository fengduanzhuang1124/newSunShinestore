"use strict";
const common_vendor = require("../../common/vendor.js");
const _sfc_main = {
  data() {
    return {
      formData: {
        username: "",
        password: "",
        confirmPassword: "",
        role: "customer"
        // 固定为普通用户
      },
      loading: false
    };
  },
  onLoad() {
    common_vendor.index.__f__("log", "at pages/account/register.vue:64", "注册页面加载");
  },
  methods: {
    validateForm() {
      if (!this.formData.username.trim()) {
        common_vendor.index.showToast({ title: "请输入用户名", icon: "none" });
        return false;
      }
      if (this.formData.username.length < 3) {
        common_vendor.index.showToast({ title: "用户名至少3个字符", icon: "none" });
        return false;
      }
      if (!this.formData.password) {
        common_vendor.index.showToast({ title: "请输入密码", icon: "none" });
        return false;
      }
      if (this.formData.password.length < 6) {
        common_vendor.index.showToast({ title: "密码至少6个字符", icon: "none" });
        return false;
      }
      if (this.formData.password !== this.formData.confirmPassword) {
        common_vendor.index.showToast({ title: "两次密码不一致", icon: "none" });
        return false;
      }
      return true;
    },
    async handleRegister() {
      common_vendor.index.__f__("log", "at pages/account/register.vue:97", "开始注册");
      if (!this.validateForm()) {
        return;
      }
      this.loading = true;
      try {
        common_vendor.index.__f__("log", "at pages/account/register.vue:105", "发送注册请求:", this.formData);
        const res = await common_vendor.index.request({
          url: "http://192.168.1.17:3000/api/users/register",
          method: "POST",
          header: {
            "Content-Type": "application/json"
          },
          data: {
            username: this.formData.username,
            password: this.formData.password,
            role: this.formData.role
          }
        });
        common_vendor.index.__f__("log", "at pages/account/register.vue:119", "注册响应:", res);
        const response = res[1] || res;
        common_vendor.index.__f__("log", "at pages/account/register.vue:123", "处理后的响应:", response);
        if (response && response.statusCode === 201) {
          common_vendor.index.showToast({ title: "注册成功", icon: "success" });
          setTimeout(() => {
            common_vendor.index.navigateTo({
              url: "/pages/account/login"
            });
          }, 1500);
        } else {
          const errorMsg = response && response.data && response.data.error ? response.data.error : "注册失败";
          common_vendor.index.showToast({
            title: errorMsg,
            icon: "none"
          });
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages/account/register.vue:142", "注册失败:", error);
        common_vendor.index.showToast({ title: "网络错误，请重试", icon: "none" });
      } finally {
        this.loading = false;
      }
    },
    goToLogin() {
      common_vendor.index.navigateTo({
        url: "/pages/account/login"
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
    e: $data.formData.confirmPassword,
    f: common_vendor.o(($event) => $data.formData.confirmPassword = $event.detail.value),
    g: common_vendor.t($data.loading ? "注册中..." : "注册"),
    h: common_vendor.o((...args) => $options.handleRegister && $options.handleRegister(...args)),
    i: $data.loading,
    j: common_vendor.o((...args) => $options.goToLogin && $options.goToLogin(...args))
  };
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-bf3e7252"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/account/register.js.map
