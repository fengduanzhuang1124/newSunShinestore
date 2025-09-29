// 统一路由工具类
class Router {
  // 跳转到 tabBar 页面
  switchTab(url) {
    return uni.switchTab({ url });
  }

  // 跳转到非 tabBar 页面
  navigateTo(url) {
    return uni.navigateTo({ url });
  }

  // 重定向到页面
  redirectTo(url) {
    return uni.redirectTo({ url });
  }

  // 返回上一页
  navigateBack(delta = 1) {
    return uni.navigateBack({ delta });
  }

  // 重新加载当前页面
  reLaunch(url) {
    return uni.reLaunch({ url });
  }

  // 根据用户角色跳转
  goByRole(userRole) {
    if (userRole === 'admin') {
      // 管理员用户提示使用网页版管理后台
      uni.showModal({
        title: '管理员登录',
        content: '管理员请使用网页版管理后台：http://localhost:3000/admin',
        showCancel: false,
        confirmText: '知道了'
      });
      return Promise.resolve();
    } else {
      return this.switchTab('/pages/home/index');
    }
  }

  // 页面路由常量
  static routes = {
    // 首页相关
    home: '/pages/home/index',
    productList: '/pages/home/product-list',
    productDetail: '/pages/home/product-detail',
    shoppingCart: '/pages/home/shopping-cart',
    myOrders: '/pages/home/my-orders',
    
    // 账户相关
    login: '/pages/account/login',
    register: '/pages/account/register',
    profile: '/pages/account/profile',
    
    // 管理相关 - 已移至独立网页版管理后台
    // 访问地址：http://localhost:3000/admin
  };
}

// 创建实例
const router = new Router();

// 导出实例和路由常量
export default router;
export const routes = Router.routes;
