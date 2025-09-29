const db = require('../db');

class OrderController {
  // 获取用户订单列表（需要登录）
  async getUserOrders(req, res) {
    try {
      const { page = 1, pageSize = 10, status = '' } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(pageSize);
      const limit = parseInt(pageSize);

      // 构建查询条件
      let whereConditions = ['o.user_id = ?'];
      let queryParams = [req.user.id];

      if (status) {
        whereConditions.push('o.status = ?');
        queryParams.push(status);
      }

      // 查询总数
      const countQuery = `
        SELECT COUNT(DISTINCT o.id) as total 
        FROM orders o 
        WHERE ${whereConditions.join(' AND ')}
      `;
      const [countResult] = await db.query(countQuery, queryParams);
      const total = countResult[0].total;

      // 查询订单列表
      const dataQuery = `
        SELECT 
          o.id, o.order_no, o.total_price, o.status, o.created_at, o.updated_at,
          JSON_ARRAYAGG(
            JSON_OBJECT(
              'product_id', oi.product_id,
              'product_name', p.name,
              'quantity', oi.quantity,
              'price', oi.price
            )
          ) as items
        FROM orders o
        LEFT JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE ${whereConditions.join(' AND ')}
        GROUP BY o.id
        ORDER BY o.created_at DESC
        LIMIT ? OFFSET ?
      `;
      
      const [rows] = await db.query(dataQuery, [...queryParams, limit, offset]);

      res.json({
        code: 200,
        msg: '获取订单列表成功',
        data: {
          list: rows,
          pagination: {
            page: parseInt(page),
            pageSize: parseInt(pageSize),
            total,
            totalPages: Math.ceil(total / parseInt(pageSize))
          }
        }
      });
    } catch (err) {
      res.status(500).json({ 
        code: 500,
        msg: '获取订单列表失败',
        error: err.message 
      });
    }
  }

  // 创建订单（需要登录）
  async createOrder(req, res) {
    const { items, address, phone, receiver_name, shipping_region = 'mainland', delivery_region = '', product_brand = '' } = req.body;
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ 
        code: 400,
        msg: '商品列表是必需的' 
      });
    }

    if (!address || !phone || !receiver_name) {
      return res.status(400).json({ 
        code: 400,
        msg: '收货地址、电话、收货人姓名是必需的' 
      });
    }

    try {
      // 开始事务
      await db.query('START TRANSACTION');

      // 生成订单号
      const orderNo = 'ORD' + Date.now() + Math.random().toString(36).substr(2, 5).toUpperCase();

      // 计算总价并检查库存
      let totalPrice = 0;
      let totalWeight = 0;
      const orderItems = [];

      for (const item of items) {
        const [product] = await db.query(
          'SELECT id, name, price, stock, weight FROM products WHERE id = ? AND status = "on"', 
          [item.product_id]
        );
        
        if (product.length === 0) {
          throw new Error(`商品ID ${item.product_id} 不存在或已下架`);
        }
        
        if (product[0].stock < item.quantity) {
          throw new Error(`商品 ${product[0].name} 库存不足，当前库存: ${product[0].stock}`);
        }
        
        const itemPrice = product[0].price * item.quantity;
        const itemWeight = (product[0].weight || 0) * item.quantity;
        
        totalPrice += itemPrice;
        totalWeight += itemWeight;
        
        orderItems.push({
          product_id: item.product_id,
          quantity: item.quantity,
          price: product[0].price,
          product_name: product[0].name,
          weight: product[0].weight || 0
        });
      }

      // 计算运费
      const shippingFee = this.calculateShippingFee(shipping_region, totalWeight, totalPrice, delivery_region, product_brand);
      const finalPrice = totalPrice + shippingFee;

      // 创建订单
      const [orderResult] = await db.query(
        'INSERT INTO orders (user_id, order_no, total_price, shipping_fee, final_price, shipping_region, product_weight, status, address, phone, receiver_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [req.user.id, orderNo, totalPrice, shippingFee, finalPrice, shipping_region, totalWeight, 'pending', address, phone, receiver_name]
      );
      
      const orderId = orderResult.insertId;

      // 创建订单项并更新库存
      for (const item of orderItems) {
        await db.query(
          'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
          [orderId, item.product_id, item.quantity, item.price]
        );
        
        await db.query(
          'UPDATE products SET stock = stock - ? WHERE id = ?',
          [item.quantity, item.product_id]
        );
      }

      // 提交事务
      await db.query('COMMIT');
      
      res.status(201).json({ 
        code: 201,
        msg: '订单创建成功',
        data: {
          orderId: orderId,
          orderNo: orderNo,
          totalPrice: totalPrice,
          shippingFee: shippingFee,
          finalPrice: finalPrice,
          shippingRegion: shipping_region,
          productWeight: totalWeight,
          items: orderItems
        }
      });
    } catch (err) {
      // 回滚事务
      await db.query('ROLLBACK');
      res.status(500).json({ 
        code: 500,
        msg: '订单创建失败',
        error: err.message 
      });
    }
  }

  // 获取单个订单详情（需要登录且只能查看自己的订单）
  async getOrderDetail(req, res) {
    try {
      // 查询订单基本信息
      const [orderRows] = await db.query(`
        SELECT o.*, u.username as customer_name
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        WHERE o.id = ? AND o.user_id = ?
      `, [req.params.id, req.user.id]);
      
      if (orderRows.length === 0) {
        return res.status(404).json({ 
          code: 404,
          msg: '订单不存在或无权限访问',
          data: null
        });
      }

      // 查询订单项
      const [itemRows] = await db.query(`
        SELECT oi.*, p.name as product_name, p.image as product_image
        FROM order_items oi
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ?
      `, [req.params.id]);

      const orderDetail = {
        ...orderRows[0],
        items: itemRows
      };
      
      res.json({
        code: 200,
        msg: '获取订单详情成功',
        data: orderDetail
      });
    } catch (err) {
      res.status(500).json({ 
        code: 500,
        msg: '获取订单详情失败',
        error: err.message 
      });
    }
  }

  // 更新订单状态（管理员功能）
  async updateOrderStatus(req, res) {
    const { status } = req.body;
    const validStatuses = ['pending', 'paid', 'shipped', 'finished', 'cancelled'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        code: 400,
        msg: '无效的订单状态' 
      });
    }

    try {
      const [result] = await db.query(
        'UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [status, req.params.id]
      );
      
      if (result.affectedRows === 0) {
        return res.status(404).json({ 
          code: 404,
          msg: '订单不存在',
          data: null
        });
      }
      
      res.json({ 
        code: 200,
        msg: '订单状态更新成功',
        data: { orderId: req.params.id, status: status }
      });
    } catch (err) {
      res.status(500).json({ 
        code: 500,
        msg: '订单状态更新失败',
        error: err.message 
      });
    }
  }

  // 获取所有订单（管理员功能）
  async getAllOrders(req, res) {
    try {
      const { page = 1, pageSize = 10, status = '', search = '' } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(pageSize);
      const limit = parseInt(pageSize);

      // 构建查询条件
      let whereConditions = ['1=1'];
      let queryParams = [];

      if (status) {
        whereConditions.push('o.status = ?');
        queryParams.push(status);
      }

      if (search) {
        whereConditions.push('(o.order_no LIKE ? OR u.username LIKE ?)');
        queryParams.push(`%${search}%`, `%${search}%`);
      }

      // 查询总数
      const countQuery = `
        SELECT COUNT(*) as total 
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        WHERE ${whereConditions.join(' AND ')}
      `;
      const [countResult] = await db.query(countQuery, queryParams);
      const total = countResult[0].total;

      // 查询订单列表
      const dataQuery = `
        SELECT 
          o.*, u.username as customer_name
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY o.created_at DESC
        LIMIT ? OFFSET ?
      `;
      
      const [rows] = await db.query(dataQuery, [...queryParams, limit, offset]);

      res.json({
        code: 200,
        msg: '获取所有订单成功',
        data: {
          list: rows,
          pagination: {
            page: parseInt(page),
            pageSize: parseInt(pageSize),
            total,
            totalPages: Math.ceil(total / parseInt(pageSize))
          }
        }
      });
    } catch (err) {
      res.status(500).json({ 
        code: 500,
        msg: '获取所有订单失败',
        error: err.message 
      });
    }
  }

  // 计算运费方法
  calculateShippingFee(region, totalWeight, orderAmount = 0, deliveryRegion = '', productBrand = '') {
    let baseFee = 0;
    let extraFee = 0;
    
    // 中国大陆标准运费：7.99元/公斤
    if (region === 'mainland') {
      const calculatedWeight = Math.max(1, Math.ceil(totalWeight));
      baseFee = calculatedWeight * 7.99;
      
      // 偏远地区额外运费：+10元
      const remoteRegions = ['新疆', '西藏', '甘肃', '宁夏', '青海'];
      if (remoteRegions.includes(deliveryRegion)) {
        extraFee += 10;
      }
      
      // Taopu品牌奶粉额外运费：+20元
      const taopuRegions = ['海南', '内蒙古'];
      if (productBrand.toLowerCase().includes('taopu') && taopuRegions.includes(deliveryRegion)) {
        extraFee += 20;
      }
    }
    
    // 新西兰本地：订单金额超过200纽币免邮，否则按7.99纽币/公斤计算
    if (region === 'nz') {
      if (orderAmount >= 200) {
        baseFee = 0;
      } else {
        const calculatedWeight = Math.max(1, Math.ceil(totalWeight));
        baseFee = calculatedWeight * 7.99;
      }
    }
    
    // 澳洲奶粉免邮
    if (region === 'au') {
      baseFee = 0;
    }
    
    return baseFee + extraFee;
  }

  // 订单预览接口（包含运费计算）
  async previewOrder(req, res) {
    try {
      const { items, shipping_region = 'mainland', delivery_region = '', product_brand = '' } = req.body;
      
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          code: 400,
          msg: '商品列表是必需的'
        });
      }

      let totalPrice = 0;
      let totalWeight = 0;
      const orderItems = [];

      // 计算商品总价和总重量
      for (const item of items) {
        const [product] = await db.query(
          'SELECT id, name, price, weight FROM products WHERE id = ? AND status = "on"', 
          [item.product_id]
        );
        
        if (product.length === 0) {
          return res.status(400).json({
            code: 400,
            msg: `商品ID ${item.product_id} 不存在或已下架`
          });
        }
        
        const itemPrice = product[0].price * item.quantity;
        const itemWeight = (product[0].weight || 0) * item.quantity;
        
        totalPrice += itemPrice;
        totalWeight += itemWeight;
        
        orderItems.push({
          product_id: item.product_id,
          product_name: product[0].name,
          quantity: item.quantity,
          price: product[0].price,
          weight: product[0].weight || 0,
          item_price: itemPrice,
          item_weight: itemWeight
        });
      }

      // 计算运费
      const shippingFee = this.calculateShippingFee(shipping_region, totalWeight, totalPrice, delivery_region, product_brand);
      const finalPrice = totalPrice + shippingFee;

      res.json({
        code: 200,
        msg: '订单预览成功',
        data: {
          orderPreview: {
            items: orderItems,
            productTotal: totalPrice,        // 商品总价
            productWeight: totalWeight,      // 商品总重量
            shippingRegion: shipping_region, // 配送地区
            shippingFee: shippingFee,       // 运费
            finalTotal: finalPrice          // 最终总价
          },
          summary: {
            '商品金额': `¥${totalPrice.toFixed(2)}`,
            '商品重量': `${totalWeight.toFixed(2)}kg`,
            '配送地区': this.getRegionName(shipping_region),
            '运费': `¥${shippingFee.toFixed(2)}`,
            '总金额': `¥${finalPrice.toFixed(2)}`
          }
        }
      });
    } catch (err) {
      res.status(500).json({
        code: 500,
        msg: '订单预览失败',
        error: err.message
      });
    }
  }

  // 获取地区名称
  getRegionName(region) {
    const regionMap = {
      'mainland': '中国大陆',
      'nz': '新西兰本地',
      'au': '澳洲奶粉',
      'remote': '偏远地区',
      'taopu': 'Taopu品牌奶粉'
    };
    return regionMap[region] || region;
  }
}

module.exports = new OrderController();
