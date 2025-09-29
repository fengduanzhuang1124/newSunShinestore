CREATE DATABASE IF NOT EXISTS newstore;
USE newstore;

-- 用户表
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50) NOT NULL,
  password VARCHAR(100) NOT NULL,
  role ENUM('customer','admin') DEFAULT 'customer',
  wechat_openid VARCHAR(64) UNIQUE NULL,
  nickname VARCHAR(100) NULL,
  avatar_url VARCHAR(255) NULL,
  gender TINYINT NULL,
  country VARCHAR(50) NULL,
  province VARCHAR(50) NULL,
  city VARCHAR(50) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 品牌表
CREATE TABLE brands (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL UNIQUE,
  logo VARCHAR(255),
  description TEXT,
  status ENUM('on','off') DEFAULT 'on',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 商品表
CREATE TABLE products (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  stock INT DEFAULT 0,
  weight DECIMAL(10,2) DEFAULT 0,
  description TEXT,
  image VARCHAR(255),
  category VARCHAR(50),
  brand_id INT,
  status ENUM('on','off') DEFAULT 'on',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (brand_id) REFERENCES brands(id)
);

-- 购物车表
CREATE TABLE cart (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (product_id) REFERENCES products(id),
  UNIQUE KEY unique_user_product (user_id, product_id)
);

-- 订单表
CREATE TABLE orders (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  order_no VARCHAR(50) UNIQUE NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  shipping_fee DECIMAL(10,2) DEFAULT 0,
  final_price DECIMAL(10,2) NOT NULL,
  shipping_region VARCHAR(50),
  product_weight DECIMAL(10,2) DEFAULT 0,
  status ENUM('pending','paid','shipped','finished','cancelled') DEFAULT 'pending',
  address TEXT,
  phone VARCHAR(20),
  receiver_name VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 订单明细表
CREATE TABLE order_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity INT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- 运费规则表
CREATE TABLE shipping_rules (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  region VARCHAR(50) NOT NULL,
  type ENUM('weight','quantity','fixed') NOT NULL,
  min_weight DECIMAL(10,2) DEFAULT 0,
  max_weight DECIMAL(10,2) DEFAULT 999,
  fee DECIMAL(10,2) NOT NULL,
  status ENUM('active','inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 地区运费配置表
CREATE TABLE region_shipping_config (
  region VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  rate_per_kg DECIMAL(10,2) DEFAULT 0,
  min_weight DECIMAL(10,2) DEFAULT 0,
  extra_fee DECIMAL(10,2) DEFAULT 0,
  regions JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 插入默认运费规则
INSERT INTO shipping_rules (id, name, region, type, min_weight, max_weight, fee, status) VALUES
('R001', '中国大陆标准运费', 'mainland', 'weight', 0, 1, 8.00, 'active'),
('R002', '中国大陆重货运费', 'mainland', 'weight', 1, 3, 12.00, 'active'),
('R003', '港澳台标准运费', 'hmt', 'weight', 0, 1, 15.00, 'active');

-- 插入默认地区运费配置
INSERT INTO region_shipping_config (region, name, rate_per_kg, min_weight, extra_fee, regions) VALUES
('mainland', '中国大陆', 7.99, 1, 0, NULL),
('nz', '新西兰本地', 0, 0, 0, NULL),
('au', '澳洲奶粉', 0, 0, 0, NULL),
('remote', '偏远地区', 0, 0, 20, '["新疆", "西藏", "甘肃", "宁夏", "青海"]'),
('taopu', 'Taopu品牌奶粉', 0, 0, 20, '["海南", "新疆", "甘肃", "青海", "宁夏", "内蒙古"]');

-- 优惠券表
CREATE TABLE IF NOT EXISTS coupons (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL COMMENT '优惠券名称',
  code VARCHAR(50) NOT NULL UNIQUE COMMENT '优惠券代码',
  type ENUM('product', 'holiday', 'campaign') NOT NULL COMMENT '优惠券类型',
  discount_type ENUM('percentage', 'fixed') NOT NULL COMMENT '折扣类型',
  discount_value DECIMAL(10,2) NOT NULL COMMENT '折扣值',
  min_amount DECIMAL(10,2) DEFAULT 0 COMMENT '最低消费金额',
  product_ids JSON COMMENT '适用产品ID列表',
  holiday_name VARCHAR(100) COMMENT '节日名称',
  holiday_year YEAR COMMENT '节日年份',
  campaign_name VARCHAR(100) COMMENT '活动名称',
  usage_limit INT DEFAULT 0 COMMENT '使用次数限制，0表示无限制',
  used_count INT DEFAULT 0 COMMENT '已使用次数',
  user_limit INT DEFAULT 1 COMMENT '每用户领取限制',
  start_date DATETIME NOT NULL COMMENT '开始时间',
  end_date DATETIME NOT NULL COMMENT '结束时间',
  description TEXT COMMENT '优惠券描述',
  status ENUM('active', 'expired', 'disabled') DEFAULT 'active' COMMENT '状态',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='优惠券表';

-- 优惠券使用记录表
CREATE TABLE IF NOT EXISTS coupon_usage (
  id INT AUTO_INCREMENT PRIMARY KEY,
  coupon_id INT NOT NULL COMMENT '优惠券ID',
  user_id INT NOT NULL COMMENT '用户ID',
  order_id INT COMMENT '订单ID',
  discount_amount DECIMAL(10,2) NOT NULL COMMENT '优惠金额',
  used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '使用时间',
  FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='优惠券使用记录表';

-- 插入示例优惠券数据
INSERT INTO coupons (name, code, type, discount_type, discount_value, min_amount, usage_limit, user_limit, start_date, end_date, description, status) VALUES
('春节特惠券', 'SPRING2024', 'holiday', 'percentage', 20.00, 100.00, 1000, 2, '2024-02-01 00:00:00', '2024-02-15 23:59:59', '春节特惠，全场8折', 'active'),
('iPhone 15 新品优惠', 'IPHONE15', 'product', 'fixed', 200.00, 5000.00, 50, 1, '2024-01-01 00:00:00', '2024-12-31 23:59:59', 'iPhone 15 新品直降200元', 'active'),
('双十一狂欢', 'DOUBLE11', 'campaign', 'percentage', 30.00, 200.00, 0, 3, '2024-11-01 00:00:00', '2024-11-11 23:59:59', '双十一狂欢，最高7折', 'active');