const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateUser } = require('../middleware/auth');

// 用户注册
router.post('/register', userController.register);

// 用户登录
router.post('/login', userController.login);

// 微信一键登录
router.post('/wechat/login', userController.wechatLogin);

// 获取当前用户信息（需要登录）
router.get('/profile', authenticateUser, userController.getProfile);

// 获取所有用户（管理员功能，需要登录和管理员权限）
router.get('/users', authenticateUser, userController.getAllUsers);

module.exports = router;