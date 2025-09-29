"use strict";
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
const common_vendor = require("../common/vendor.js");
class Router {
  // 跳转到 tabBar 页面
  switchTab(url) {
    return common_vendor.index.switchTab({ url });
  }
  // 跳转到非 tabBar 页面
  navigateTo(url) {
    return common_vendor.index.navigateTo({ url });
  }
  // 重定向到页面
  redirectTo(url) {
    return common_vendor.index.redirectTo({ url });
  }
  // 返回上一页
  navigateBack(delta = 1) {
    return common_vendor.index.navigateBack({ delta });
  }
  // 重新加载当前页面
  reLaunch(url) {
    return common_vendor.index.reLaunch({ url });
  }
  // 根据用户角色跳转
  goByRole(userRole) {
    if (userRole === "admin") {
      common_vendor.index.showModal({
        title: "管理员登录",
        content: "管理员请使用网页版管理后台：http://localhost:3000/admin",
        showCancel: false,
        confirmText: "知道了"
      });
      return Promise.resolve();
    } else {
      return this.switchTab("/pages/home/index");
    }
  }
}
// 页面路由常量
__publicField(Router, "routes", {
  // 首页相关
  home: "/pages/home/index",
  productList: "/pages/home/product-list",
  productDetail: "/pages/home/product-detail",
  shoppingCart: "/pages/home/shopping-cart",
  myOrders: "/pages/home/my-orders",
  // 账户相关
  login: "/pages/account/login",
  register: "/pages/account/register",
  profile: "/pages/account/profile"
  // 管理相关 - 已移至独立网页版管理后台
  // 访问地址：http://localhost:3000/admin
});
const router = new Router();
const routes = Router.routes;
exports.router = router;
exports.routes = routes;
//# sourceMappingURL=../../.sourcemap/mp-weixin/utils/router.js.map
