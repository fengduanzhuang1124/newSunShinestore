// backend/index.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const userRoutes = require('./routes/user');
const productRoutes = require('./routes/product');
const orderRoutes = require('./routes/order');
const cartRoutes = require('./routes/cart');
const adminRoutes = require('./routes/admin');
const brandRoutes = require('./routes/brand');
const statisticsRoutes = require('./routes/statistics');
const shippingRoutes = require('./routes/shipping');
const dashboardRoutes = require('./routes/dashboard');
const couponRoutes = require('./routes/coupons');

const app = express();
app.use(cors());
app.use(express.json());

// 静态文件服务 - 为管理后台提供静态文件
app.use('/admin', express.static(path.join(__dirname, '../frontend/admin')));

// 路由
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/cart', cartRoutes); // 购物车路由
app.use('/api/admin', adminRoutes); // 管理员专用路由
app.use('/api/brands', brandRoutes); // 品牌管理路由
app.use('/api/statistics', statisticsRoutes); // 统计路由
app.use('/api/shipping', shippingRoutes); // 运费管理路由
app.use('/api/dashboard', dashboardRoutes); // 仪表板路由
app.use('/api/coupons', couponRoutes); // 优惠券管理路由

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: '服务器运行正常' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`服务器运行在 http://0.0.0.0:${PORT}`);
});
