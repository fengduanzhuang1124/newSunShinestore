"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const common_vendor = require("./common/vendor.js");
const utils_request = require("./utils/request.js");
const utils_router = require("./utils/router.js");
if (!Math) {
  "./pages/home/index.js";
  "./pages/account/register.js";
  "./pages/account/login.js";
  "./pages/account/profile.js";
  "./pages/home/product-list.js";
  "./pages/home/product-detail.js";
  "./pages/home/shopping-cart.js";
  "./pages/home/my-orders.js";
  "./pages/home/checkout.js";
}
const pages = [
  "pages/home/index",
  "pages/account/register",
  "pages/account/login",
  "pages/account/profile",
  "pages/home/product-list",
  "pages/home/product-detail",
  "pages/home/shopping-cart",
  "pages/home/my-orders"
];
const window = {
  backgroundTextStyle: "light",
  navigationBarBackgroundColor: "#F8F8F8",
  navigationBarTitleText: "新阳光商城",
  navigationBarTextStyle: "black"
};
const style = "v2";
const sitemapLocation = "sitemap.json";
const App = {
  pages,
  window,
  style,
  sitemapLocation
};
function createApp() {
  const app = common_vendor.createSSRApp(App);
  app.config.globalProperties.$api = utils_request.api;
  app.config.globalProperties.$router = utils_router.router;
  app.config.globalProperties.$routes = utils_router.routes;
  return {
    app
  };
}
createApp().app.mount("#app");
exports.createApp = createApp;
//# sourceMappingURL=../.sourcemap/mp-weixin/app.js.map
