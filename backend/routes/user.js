const express = require('express');
const router = express.Router();

// 简单返回一个用户列表
router.get('/users', (req, res) => {
  res.json([
    { id: 1, username: '张三' },
    { id: 2, username: '李四' }
  ]);
});

module.exports = router;