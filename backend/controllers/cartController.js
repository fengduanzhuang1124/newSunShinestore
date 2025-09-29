const db = require('../db');

class CartController {
  // 添加商品到购物车
  async addToCart(req, res) {
    const { product_id, quantity = 1 } = req.body;
    
    if (!product_id) {
      return res.status(400).json({ 
        code: 400,
        msg: '商品ID是必需的' 
      });
    }

    if (quantity <= 0) {
      return res.status(400).json({ 
        code: 400,
        msg: '商品数量必须大于0' 
      });
    }

    try {
      // 检查商品是否存在且上架
      const [product] = await db.query(
        'SELECT id, name, price, stock, status FROM products WHERE id = ?',
        [product_id]
      );

      if (product.length === 0) {
        return res.status(404).json({ 
          code: 404,
          msg: '商品不存在',
          data: null
        });
      }

      if (product[0].status !== 'on') {
        return res.status(400).json({ 
          code: 400,
          msg: '商品已下架',
          data: null
        });
      }

      if (product[0].stock < quantity) {
        return res.status(400).json({ 
          code: 400,
          msg: `商品库存不足，当前库存: ${product[0].stock}`,
          data: null
        });
      }

      // 检查购物车中是否已存在该商品
      const [existingCart] = await db.query(
        'SELECT id, quantity FROM cart WHERE user_id = ? AND product_id = ?',
        [req.user.id, product_id]
      );

      if (existingCart.length > 0) {
        // 更新数量
        const newQuantity = existingCart[0].quantity + quantity;
        if (newQuantity > product[0].stock) {
          return res.status(400).json({ 
            code: 400,
            msg: `商品库存不足，当前库存: ${product[0].stock}`,
            data: null
          });
        }

        await db.query(
          'UPDATE cart SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [newQuantity, existingCart[0].id]
        );

        res.json({
          code: 200,
          msg: '购物车更新成功',
          data: {
            cartId: existingCart[0].id,
            quantity: newQuantity
          }
        });
      } else {
        // 新增购物车项
        const [result] = await db.query(
          'INSERT INTO cart (user_id, product_id, quantity) VALUES (?, ?, ?)',
          [req.user.id, product_id, quantity]
        );

        res.status(201).json({
          code: 201,
          msg: '商品已添加到购物车',
          data: {
            cartId: result.insertId,
            quantity: quantity
          }
        });
      }
    } catch (err) {
      res.status(500).json({ 
        code: 500,
        msg: '添加到购物车失败',
        error: err.message 
      });
    }
  }

  // 获取购物车列表
  async getCart(req, res) {
    try {
      const [rows] = await db.query(`
        SELECT 
          c.id, c.quantity, c.created_at, c.updated_at,
          p.id as product_id, p.name, p.price, p.stock, p.image, p.status
        FROM cart c
        LEFT JOIN products p ON c.product_id = p.id
        WHERE c.user_id = ? AND p.status = 'on'
        ORDER BY c.created_at DESC
      `, [req.user.id]);

      // 计算总价
      let totalPrice = 0;
      const cartItems = rows.map(item => {
        const itemTotal = item.price * item.quantity;
        totalPrice += itemTotal;
        return {
          ...item,
          itemTotal: itemTotal
        };
      });

      res.json({
        code: 200,
        msg: '获取购物车成功',
        data: {
          items: cartItems,
          totalPrice: totalPrice,
          totalItems: cartItems.length
        }
      });
    } catch (err) {
      res.status(500).json({ 
        code: 500,
        msg: '获取购物车失败',
        error: err.message 
      });
    }
  }

  // 更新购物车商品数量
  async updateCartQuantity(req, res) {
    const { quantity } = req.body;
    const cartId = req.params.id;

    if (!quantity || quantity <= 0) {
      return res.status(400).json({ 
        code: 400,
        msg: '商品数量必须大于0' 
      });
    }

    try {
      // 检查购物车项是否存在且属于当前用户
      const [cartItem] = await db.query(`
        SELECT c.*, p.stock, p.status
        FROM cart c
        LEFT JOIN products p ON c.product_id = p.id
        WHERE c.id = ? AND c.user_id = ?
      `, [cartId, req.user.id]);

      if (cartItem.length === 0) {
        return res.status(404).json({ 
          code: 404,
          msg: '购物车项不存在',
          data: null
        });
      }

      if (cartItem[0].status !== 'on') {
        return res.status(400).json({ 
          code: 400,
          msg: '商品已下架',
          data: null
        });
      }

      if (quantity > cartItem[0].stock) {
        return res.status(400).json({ 
          code: 400,
          msg: `商品库存不足，当前库存: ${cartItem[0].stock}`,
          data: null
        });
      }

      // 更新数量
      await db.query(
        'UPDATE cart SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [quantity, cartId]
      );

      res.json({
        code: 200,
        msg: '购物车数量更新成功',
        data: {
          cartId: cartId,
          quantity: quantity
        }
      });
    } catch (err) {
      res.status(500).json({ 
        code: 500,
        msg: '更新购物车失败',
        error: err.message 
      });
    }
  }

  // 删除购物车商品
  async removeFromCart(req, res) {
    const cartId = req.params.id;

    try {
      const [result] = await db.query(
        'DELETE FROM cart WHERE id = ? AND user_id = ?',
        [cartId, req.user.id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ 
          code: 404,
          msg: '购物车项不存在',
          data: null
        });
      }

      res.json({
        code: 200,
        msg: '商品已从购物车移除',
        data: {
          cartId: cartId
        }
      });
    } catch (err) {
      res.status(500).json({ 
        code: 500,
        msg: '删除购物车商品失败',
        error: err.message 
      });
    }
  }

  // 清空购物车
  async clearCart(req, res) {
    try {
      await db.query(
        'DELETE FROM cart WHERE user_id = ?',
        [req.user.id]
      );

      res.json({
        code: 200,
        msg: '购物车已清空',
        data: null
      });
    } catch (err) {
      res.status(500).json({ 
        code: 500,
        msg: '清空购物车失败',
        error: err.message 
      });
    }
  }
}

module.exports = new CartController();
