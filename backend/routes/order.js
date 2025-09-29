const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { authenticateUser, requireAdmin } = require('../middleware/auth');

// ==================== 用户订单接口 ====================
// 获取用户订单列表
router.get('/', authenticateUser, orderController.getUserOrders);

// 订单预览（计算运费和总价）
router.post('/preview', authenticateUser, orderController.previewOrder);

// 创建订单（包含运费计算）
router.post('/', authenticateUser, orderController.createOrder);

// 获取单个订单详情
router.get('/:id', authenticateUser, orderController.getOrderDetail);

// ==================== 管理员接口 ====================
// 获取所有订单
router.get('/admin/all', authenticateUser, requireAdmin, orderController.getAllOrders);

// 更新订单状态
router.put('/:id/status', authenticateUser, requireAdmin, orderController.updateOrderStatus);

module.exports = router; 