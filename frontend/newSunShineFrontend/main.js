import App from './App'
import { api } from './utils/request'
import router, { routes } from './utils/router'

// #ifndef VUE3
import Vue from 'vue'
import './uni.promisify.adaptor'
Vue.config.productionTip = false

// 注册全局工具
Vue.prototype.$api = api
Vue.prototype.$router = router
Vue.prototype.$routes = routes

App.mpType = 'app'
const app = new Vue({
  ...App
})
app.$mount()
// #endif

// #ifdef VUE3
import { createSSRApp } from 'vue'
export function createApp() {
  const app = createSSRApp(App)
  
  // 注册全局工具
  app.config.globalProperties.$api = api
  app.config.globalProperties.$router = router
  app.config.globalProperties.$routes = routes
  
  return {
    app
  }
}
// #endif