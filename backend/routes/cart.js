const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const { authenticateUser } = require('../middleware/auth');

// 所有购物车操作都需要用户登录
router.use(authenticateUser);

// 添加商品到购物车
router.post('/', cartController.addToCart);

// 获取购物车列表
router.get('/', cartController.getCart);

// 更新购物车商品数量
router.put('/:id', cartController.updateCartQuantity);

// 删除购物车商品
router.delete('/:id', cartController.removeFromCart);

// 清空购物车
router.delete('/', cartController.clearCart);

module.exports = router;

