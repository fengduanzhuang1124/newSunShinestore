const db = require('../db');

// 获取所有运费规则
const getShippingRules = async (req, res) => {
  try {
    const query = `
      SELECT 
        id,
        name,
        region,
        type,
        min_weight as minWeight,
        max_weight as maxWeight,
        fee,
        status,
        created_at as createTime
      FROM shipping_rules 
      ORDER BY created_at DESC
    `;
    
    const rules = await db.query(query);
    
    res.json({
      success: true,
      data: rules.rows
    });
  } catch (error) {
    console.error('获取运费规则失败:', error);
    res.status(500).json({
      success: false,
      message: '获取运费规则失败',
      error: error.message
    });
  }
};

// 获取单个运费规则
const getShippingRule = async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT 
        id,
        name,
        region,
        type,
        min_weight as minWeight,
        max_weight as maxWeight,
        fee,
        status,
        created_at as createTime
      FROM shipping_rules 
      WHERE id = $1
    `;
    
    const result = await db.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '运费规则不存在'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('获取运费规则失败:', error);
    res.status(500).json({
      success: false,
      message: '获取运费规则失败',
      error: error.message
    });
  }
};

// 创建运费规则
const createShippingRule = async (req, res) => {
  try {
    const { name, region, type, minWeight, maxWeight, fee, status = 'active' } = req.body;
    
    // 验证必填字段
    if (!name || !region || !type || fee === undefined) {
      return res.status(400).json({
        success: false,
        message: '请填写所有必填字段'
      });
    }
    
    const query = `
      INSERT INTO shipping_rules (name, region, type, min_weight, max_weight, fee, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING 
        id,
        name,
        region,
        type,
        min_weight as minWeight,
        max_weight as maxWeight,
        fee,
        status,
        created_at as createTime
    `;
    
    const values = [name, region, type, minWeight || 0, maxWeight || 999, fee, status];
    const result = await db.query(query, values);
    
    res.status(201).json({
      success: true,
      message: '运费规则创建成功',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('创建运费规则失败:', error);
    res.status(500).json({
      success: false,
      message: '创建运费规则失败',
      error: error.message
    });
  }
};

// 更新运费规则
const updateShippingRule = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, region, type, minWeight, maxWeight, fee, status } = req.body;
    
    const query = `
      UPDATE shipping_rules 
      SET 
        name = COALESCE($2, name),
        region = COALESCE($3, region),
        type = COALESCE($4, type),
        min_weight = COALESCE($5, min_weight),
        max_weight = COALESCE($6, max_weight),
        fee = COALESCE($7, fee),
        status = COALESCE($8, status),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING 
        id,
        name,
        region,
        type,
        min_weight as minWeight,
        max_weight as maxWeight,
        fee,
        status,
        created_at as createTime
    `;
    
    const values = [id, name, region, type, minWeight, maxWeight, fee, status];
    const result = await db.query(query, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '运费规则不存在'
      });
    }
    
    res.json({
      success: true,
      message: '运费规则更新成功',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('更新运费规则失败:', error);
    res.status(500).json({
      success: false,
      message: '更新运费规则失败',
      error: error.message
    });
  }
};

// 删除运费规则
const deleteShippingRule = async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = 'DELETE FROM shipping_rules WHERE id = $1 RETURNING id';
    const result = await db.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '运费规则不存在'
      });
    }
    
    res.json({
      success: true,
      message: '运费规则删除成功'
    });
  } catch (error) {
    console.error('删除运费规则失败:', error);
    res.status(500).json({
      success: false,
      message: '删除运费规则失败',
      error: error.message
    });
  }
};

// 切换运费规则状态
const toggleShippingRuleStatus = async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      UPDATE shipping_rules 
      SET 
        status = CASE 
          WHEN status = 'active' THEN 'inactive' 
          ELSE 'active' 
        END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING 
        id,
        name,
        region,
        type,
        min_weight as minWeight,
        max_weight as maxWeight,
        fee,
        status,
        created_at as createTime
    `;
    
    const result = await db.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '运费规则不存在'
      });
    }
    
    res.json({
      success: true,
      message: `运费规则已${result.rows[0].status === 'active' ? '启用' : '禁用'}`,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('切换运费规则状态失败:', error);
    res.status(500).json({
      success: false,
      message: '切换运费规则状态失败',
      error: error.message
    });
  }
};

// 获取地区运费配置
const getRegionShippingConfig = async (req, res) => {
  try {
    const query = `
      SELECT 
        region,
        name,
        rate_per_kg as ratePerKg,
        min_weight as minWeight,
        extra_fee as extraFee,
        regions,
        created_at as createTime
      FROM region_shipping_config 
      ORDER BY region
    `;
    
    const result = await db.query(query);
    
    // 转换为对象格式
    const config = {};
    result.rows.forEach(row => {
      config[row.region] = {
        name: row.name,
        ratePerKg: parseFloat(row.rateperkg) || 0,
        minWeight: row.minweight || 0,
        extraFee: row.extrafee || 0,
        regions: row.regions ? JSON.parse(row.regions) : null,
        createTime: row.createtime
      };
    });
    
    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('获取地区运费配置失败:', error);
    res.status(500).json({
      success: false,
      message: '获取地区运费配置失败',
      error: error.message
    });
  }
};

// 更新地区运费配置
const updateRegionShippingConfig = async (req, res) => {
  try {
    const { region, config } = req.body;
    
    if (!region || !config) {
      return res.status(400).json({
        success: false,
        message: '请提供地区和配置信息'
      });
    }
    
    const query = `
      INSERT INTO region_shipping_config (region, name, rate_per_kg, min_weight, extra_fee, regions)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (region) 
      DO UPDATE SET
        name = EXCLUDED.name,
        rate_per_kg = EXCLUDED.rate_per_kg,
        min_weight = EXCLUDED.min_weight,
        extra_fee = EXCLUDED.extra_fee,
        regions = EXCLUDED.regions,
        updated_at = CURRENT_TIMESTAMP
      RETURNING region, name, rate_per_kg as ratePerKg, min_weight as minWeight, extra_fee as extraFee, regions
    `;
    
    const values = [
      region,
      config.name,
      config.ratePerKg || 0,
      config.minWeight || 0,
      config.extraFee || 0,
      config.regions ? JSON.stringify(config.regions) : null
    ];
    
    const result = await db.query(query, values);
    
    res.json({
      success: true,
      message: '地区运费配置更新成功',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('更新地区运费配置失败:', error);
    res.status(500).json({
      success: false,
      message: '更新地区运费配置失败',
      error: error.message
    });
  }
};

// 计算运费
const calculateShipping = async (req, res) => {
  try {
    const { region, weight, quantity = 1, orderAmount = 0, productBrand = '', deliveryRegion = '' } = req.body;
    
    if (!region || !weight) {
      return res.status(400).json({
        success: false,
        message: '请提供地区和重量信息'
      });
    }
    
    const totalWeight = weight * quantity;
    const shippingFee = calculateShippingFee(region, totalWeight, productBrand, deliveryRegion, orderAmount);
    
    res.json({
      success: true,
      data: {
        region,
        weight: parseFloat(weight),
        quantity,
        totalWeight: parseFloat(totalWeight),
        orderAmount: parseFloat(orderAmount),
        shippingFee: parseFloat(shippingFee)
      }
    });
  } catch (error) {
    console.error('计算运费失败:', error);
    res.status(500).json({
      success: false,
      message: '计算运费失败',
      error: error.message
    });
  }
};

// 运费计算逻辑
const calculateShippingFee = (region, totalWeight, productBrand = '', deliveryRegion = '', orderAmount = 0) => {
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
};

module.exports = {
  getShippingRules,
  getShippingRule,
  createShippingRule,
  updateShippingRule,
  deleteShippingRule,
  toggleShippingRuleStatus,
  getRegionShippingConfig,
  updateRegionShippingConfig,
  calculateShipping,
  calculateShippingFee
};
