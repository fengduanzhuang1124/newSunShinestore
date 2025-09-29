"use strict";
const common_vendor = require("../common/vendor.js");
const DEFAULT_BASE_URL = "http://127.0.0.1:3000";
class Request {
  constructor() {
    const savedBaseURL = typeof common_vendor.index !== "undefined" ? common_vendor.index.getStorageSync("BASE_URL") : "";
    this.baseURL = savedBaseURL || DEFAULT_BASE_URL;
    this.loadingCount = 0;
  }
  // 切换并记忆 BaseURL
  setBaseURL(newBaseURL) {
    if (!newBaseURL || typeof newBaseURL !== "string")
      return;
    this.baseURL = newBaseURL;
    if (typeof common_vendor.index !== "undefined") {
      common_vendor.index.setStorageSync("BASE_URL", newBaseURL);
    }
  }
  getBaseURL() {
    return this.baseURL;
  }
  // 获取请求头
  getHeaders() {
    const token = common_vendor.index.getStorageSync("token");
    return {
      "Content-Type": "application/json",
      ...token ? { "Authorization": `Bearer ${token}` } : {}
    };
  }
  _show(loadingText) {
    if (this.loadingCount === 0) {
      common_vendor.index.showLoading({ title: loadingText || "加载中..." });
    }
    this.loadingCount++;
  }
  _hide() {
    if (this.loadingCount > 0)
      this.loadingCount--;
    if (this.loadingCount === 0) {
      common_vendor.index.hideLoading();
    }
  }
  // 统一请求方法
  async request(options) {
    const { url, method = "GET", data, showLoading = true, loadingText = "加载中..." } = options;
    if (showLoading)
      this._show(loadingText);
    try {
      const res = await common_vendor.index.request({
        url: `${this.baseURL}${url}`,
        method,
        data,
        header: this.getHeaders()
      });
      const response = res[1] || res;
      return response;
    } catch (error) {
      common_vendor.index.__f__("error", "at utils/request.js:65", "请求错误:", error);
      throw error;
    } finally {
      if (showLoading) {
        this._hide();
      }
    }
  }
  // GET 请求
  get(url, options = {}) {
    const { params, ...rest } = options;
    let finalUrl = url;
    if (params) {
      const queryString = Object.keys(params).filter((key) => params[key] !== void 0 && params[key] !== null && params[key] !== "").map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`).join("&");
      if (queryString) {
        finalUrl = `${url}${url.includes("?") ? "&" : "?"}${queryString}`;
      }
    }
    return this.request({ url: finalUrl, method: "GET", ...rest });
  }
  // POST 请求
  post(url, data, options = {}) {
    return this.request({ url, method: "POST", data, ...options });
  }
  // PUT 请求
  put(url, data, options = {}) {
    return this.request({ url, method: "PUT", data, ...options });
  }
  // DELETE 请求
  delete(url, options = {}) {
    return this.request({ url, method: "DELETE", ...options });
  }
}
const request = new Request();
const api = {
  // 用户相关
  users: {
    login: (data) => request.post("/api/users/login", data),
    register: (data) => request.post("/api/users/register", data),
    wechatLogin: (data, options = {}) => request.post("/api/users/wechat/login", data, options),
    getProfile: () => request.get("/api/users/profile"),
    getAllUsers: () => request.get("/api/users")
  },
  // 商品相关
  products: {
    getProducts: (params) => request.get("/api/products", { params }),
    getProduct: (id) => request.get(`/api/products/${id}`),
    getCategories: () => request.get("/api/products/categories"),
    createProduct: (data) => request.post("/api/products", data),
    updateProduct: (id, data) => request.put(`/api/products/${id}`, data),
    deleteProduct: (id) => request.delete(`/api/products/${id}`)
  },
  // 购物车相关
  cart: {
    getCart: () => request.get("/api/cart"),
    addToCart: (data) => request.post("/api/cart", data),
    updateCartQuantity: (id, data) => request.put(`/api/cart/${id}`, data),
    removeFromCart: (id) => request.delete(`/api/cart/${id}`),
    clearCart: () => request.delete("/api/cart")
  },
  // 订单相关
  orders: {
    getOrders: (params) => request.get("/api/orders", { params }),
    createOrder: (data) => request.post("/api/orders", data),
    getOrderDetail: (id) => request.get(`/api/orders/${id}`),
    updateOrderStatus: (id, data) => request.put(`/api/orders/${id}/status`, data)
  },
  // 管理员相关
  admin: {
    getUsers: () => request.get("/api/admin/users"),
    createUser: (data) => request.post("/api/admin/users", data),
    getAllProducts: () => request.get("/api/admin/products/all"),
    getAllOrders: () => request.get("/api/admin/orders"),
    getStats: () => request.get("/api/statistics/system")
  },
  // 品牌管理
  brands: {
    getBrands: (params) => request.get("/api/brands", { params }),
    getBrand: (id) => request.get(`/api/brands/${id}`),
    createBrand: (data) => request.post("/api/brands", data),
    updateBrand: (id, data) => request.put(`/api/brands/${id}`, data),
    deleteBrand: (id) => request.delete(`/api/brands/${id}`),
    getBrandStats: (params) => request.get("/api/brands/stats/ranking", { params })
  },
  // 统计数据
  statistics: {
    getSystemStats: () => request.get("/api/statistics/system"),
    getHotProducts: (params) => request.get("/api/statistics/hot-products", { params }),
    getHotCategories: (params) => request.get("/api/statistics/hot-categories", { params }),
    getSalesTrend: (params) => request.get("/api/statistics/sales-trend", { params })
  },
  // 健康检查
  health: () => request.get("/health"),
  // 基础地址辅助
  setBaseURL: (url) => request.setBaseURL(url),
  getBaseURL: () => request.getBaseURL()
};
exports.api = api;
//# sourceMappingURL=../../.sourcemap/mp-weixin/utils/request.js.map
