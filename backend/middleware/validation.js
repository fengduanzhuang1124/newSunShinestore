const { body, param, query, validationResult } = require('express-validator');

// 验证结果处理中间件
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      code: 400,
      msg: '参数验证失败',
      errors: errors.array()
    });
  }
  next();
};

// 用户注册验证
const validateUserRegister = [
  body('username')
    .isLength({ min: 3, max: 20 })
    .withMessage('用户名长度必须在3-20个字符之间')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('用户名只能包含字母、数字和下划线'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('密码长度至少6个字符'),
  body('role')
    .optional()
    .isIn(['customer', 'admin'])
    .withMessage('角色只能是customer或admin'),
  handleValidationErrors
];

// 用户登录验证
const validateUserLogin = [
  body('username').notEmpty().withMessage('用户名不能为空'),
  body('password').notEmpty().withMessage('密码不能为空'),
  handleValidationErrors
];

// 商品创建验证
const validateProductCreate = [
  body('name')
    .isLength({ min: 1, max: 100 })
    .withMessage('商品名称长度必须在1-100个字符之间'),
  body('price')
    .isFloat({ min: 0 })
    .withMessage('价格必须是大于等于0的数字'),
  body('stock')
    .optional()
    .isInt({ min: 0 })
    .withMessage('库存必须是大于等于0的整数'),
  body('category')
    .optional()
    .isLength({ max: 50 })
    .withMessage('分类名称不能超过50个字符'),
  handleValidationErrors
];

// 商品更新验证
const validateProductUpdate = [
  param('id').isInt().withMessage('商品ID必须是整数'),
  body('name')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('商品名称长度必须在1-100个字符之间'),
  body('price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('价格必须是大于等于0的数字'),
  body('stock')
    .optional()
    .isInt({ min: 0 })
    .withMessage('库存必须是大于等于0的整数'),
  body('status')
    .optional()
    .isIn(['on', 'off'])
    .withMessage('状态只能是on或off'),
  handleValidationErrors
];

// 购物车操作验证
const validateCartAdd = [
  body('product_id').isInt().withMessage('商品ID必须是整数'),
  body('quantity')
    .optional()
    .isInt({ min: 1 })
    .withMessage('数量必须是大于0的整数'),
  handleValidationErrors
];

// 订单创建验证
const validateOrderCreate = [
  body('items')
    .isArray({ min: 1 })
    .withMessage('订单项不能为空'),
  body('items.*.product_id').isInt().withMessage('商品ID必须是整数'),
  body('items.*.quantity')
    .isInt({ min: 1 })
    .withMessage('数量必须是大于0的整数'),
  body('address').notEmpty().withMessage('收货地址不能为空'),
  body('phone').notEmpty().withMessage('联系电话不能为空'),
  body('receiver_name').notEmpty().withMessage('收货人姓名不能为空'),
  handleValidationErrors
];

// 分页查询验证
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('页码必须是大于0的整数'),
  query('pageSize')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('每页数量必须在1-100之间'),
  handleValidationErrors
];

module.exports = {
  validateUserRegister,
  validateUserLogin,
  validateProductCreate,
  validateProductUpdate,
  validateCartAdd,
  validateOrderCreate,
  validatePagination,
  handleValidationErrors
};
