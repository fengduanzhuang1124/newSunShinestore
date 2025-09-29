const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { authenticateUser, requireAdmin } = require('../middleware/auth');

// 公开接口：获取所有上架商品（支持分页、搜索、分类）
router.get('/', productController.getProducts);

// 公开接口：获取商品分类列表
router.get('/categories', productController.getCategories);

// 公开接口：获取单个商品详情
router.get('/:id', productController.getProduct);

// 管理员接口：创建商品
router.post('/', authenticateUser, requireAdmin, productController.createProduct);

// 管理员接口：更新商品
router.put('/:id', authenticateUser, requireAdmin, productController.updateProduct);

// 管理员接口：删除商品
router.delete('/:id', authenticateUser, requireAdmin, productController.deleteProduct);

module.exports = router; 