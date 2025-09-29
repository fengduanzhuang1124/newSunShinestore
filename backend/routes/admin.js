const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const productController = require('../controllers/productController');
const orderController = require('../controllers/orderController');
const { authenticateUser, requireAdmin } = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const db = require('../db'); // Added missing import for db

// 所有管理员路由都需要先验证身份和权限
router.use(authenticateUser);
router.use(requireAdmin);

// 用户管理
router.get('/users', userController.getAllUsers);
router.post('/users', async (req, res) => {
  const { username, password, role = 'customer' } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码是必需的' });
  }
  
  if (!['customer', 'admin'].includes(role)) {
    return res.status(400).json({ error: '无效的用户角色' });
  }
  
  try {
    const [existingUsers] = await db.query('SELECT id FROM users WHERE username = ?', [username]);
    if (existingUsers.length > 0) {
      return res.status(400).json({ error: '用户名已存在' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
      [username, hashedPassword, role]
    );
    
    res.status(201).json({ 
      message: '用户创建成功', 
      userId: result.insertId,
      role: role
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 删除用户
router.delete('/users/:id', async (req, res) => {
  const userId = req.params.id;
  
  try {
    // 检查用户是否存在
    const [users] = await db.query('SELECT id FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    // 删除用户
    await db.query('DELETE FROM users WHERE id = ?', [userId]);
    
    res.json({ message: '用户删除成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 商品管理
router.get('/products/all', productController.getAllProducts);

// 删除商品
router.delete('/products/:id', async (req, res) => {
  const productId = req.params.id;
  
  try {
    // 检查商品是否存在
    const [products] = await db.query('SELECT id FROM products WHERE id = ?', [productId]);
    if (products.length === 0) {
      return res.status(404).json({ error: '商品不存在' });
    }
    
    // 删除商品
    await db.query('DELETE FROM products WHERE id = ?', [productId]);
    
    res.json({ message: '商品删除成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 订单管理
router.get('/orders', orderController.getAllOrders);
router.put('/orders/:id/status', orderController.updateOrderStatus);

// 统计数据
router.get('/stats', async (req, res) => {
  try {
    const [userStats] = await db.query('SELECT COUNT(*) as total_users FROM users');
    const [productStats] = await db.query('SELECT COUNT(*) as total_products FROM products');
    const [orderStats] = await db.query('SELECT COUNT(*) as total_orders FROM orders');
    const [salesStats] = await db.query('SELECT SUM(total_price) as total_sales FROM orders WHERE status = "finished"');
    
    res.json({
      users: userStats[0].total_users,
      products: productStats[0].total_products,
      orders: orderStats[0].total_orders,
      sales: salesStats[0].total_sales || 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router; 