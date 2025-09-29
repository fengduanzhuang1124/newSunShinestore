import { createRouter, createWebHistory } from 'vue-router'
import Layout from '../components/Layout.vue'
import Login from '../views/Login.vue'
import Dashboard from '../views/Dashboard.vue'
import Products from '../views/Products.vue'
import Orders from '../views/Orders.vue'
import Shipping from '../views/Shipping.vue'
import Coupons from '../views/Coupons.vue'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: Login
  },
  {
    path: '/',
    component: Layout,
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'Dashboard',
        component: Dashboard
      },
      {
        path: '/products',
        name: 'Products',
        component: Products
      },
      {
        path: '/products/brands',
        name: 'ProductBrands',
        component: Products
      },
      {
        path: '/orders',
        name: 'Orders',
        component: Orders
      },
      {
        path: '/orders/ship',
        name: 'OrderShip',
        component: Orders
      },
      {
        path: '/shipping',
        name: 'Shipping',
        component: Shipping
      },
      {
        path: '/coupons',
        name: 'Coupons',
        component: Coupons
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})


let isFirstNavigation = true
router.beforeEach((to) => {
  const token = localStorage.getItem('authToken')

  if (to.meta.requiresAuth && !token) {
    return '/login'
  }
  if (to.path === '/login' && token) {
    return '/'
  }
  if (isFirstNavigation && to.path !== '/') {
    isFirstNavigation = false
    return '/'
  }
  isFirstNavigation = false
  return true
})

export default router
